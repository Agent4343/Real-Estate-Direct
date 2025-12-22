const express = require('express');
const router = express.Router();
const Transaction = require('../models/transaction.model');
const User = require('../models/user.model');
const authMiddleware = require('../auth.middleware');

// Stripe initialization (requires STRIPE_SECRET_KEY in environment)
let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
} catch (err) {
  console.warn('Stripe not initialized. Set STRIPE_SECRET_KEY to enable payments.');
}

// Check if Stripe is configured
const requireStripe = (req, res, next) => {
  if (!stripe) {
    return res.status(503).json({
      error: 'Payment service not configured',
      message: 'Please set STRIPE_SECRET_KEY in environment variables'
    });
  }
  next();
};

// Admin middleware
const adminMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

// Get payment configuration (public key for frontend)
router.get('/config', (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    configured: !!stripe,
    currency: 'cad',
    commissionRate: 0.01
  });
});

// Create payment intent for commission invoice
router.post('/create-payment-intent', authMiddleware, requireStripe, async (req, res) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID required' });
    }

    const transaction = await Transaction.findById(transactionId)
      .populate('seller', 'name email')
      .populate('property', 'address');

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Verify the user is the seller or admin
    const user = await User.findById(req.user.userId);
    if (transaction.seller._id.toString() !== req.user.userId && !user.isAdmin) {
      return res.status(403).json({ error: 'Not authorized to pay this invoice' });
    }

    // Check if already paid
    if (transaction.platformFee.status === 'paid') {
      return res.status(400).json({ error: 'Commission already paid' });
    }

    const amount = transaction.platformFee.amount;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid commission amount' });
    }

    // Create or retrieve Stripe customer
    let customerId;
    const existingCustomers = await stripe.customers.list({
      email: transaction.seller.email,
      limit: 1
    });

    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: transaction.seller.email,
        name: transaction.seller.name,
        metadata: {
          userId: transaction.seller._id.toString()
        }
      });
      customerId = customer.id;
    }

    // Create payment intent (amount in cents)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'cad',
      customer: customerId,
      description: `Real Estate Direct Commission - ${transaction.property.address?.street || 'Property Sale'}`,
      metadata: {
        transactionId: transaction._id.toString(),
        propertyId: transaction.property._id.toString(),
        sellerId: transaction.seller._id.toString(),
        commissionRate: transaction.platformFee.rate.toString()
      }
    });

    // Update transaction to invoiced status
    if (transaction.platformFee.status === 'pending') {
      transaction.platformFee.status = 'invoiced';
      transaction.platformFee.invoicedAt = new Date();
      await transaction.save();
    }

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amount,
      currency: 'CAD'
    });
  } catch (err) {
    console.error('Error creating payment intent:', err);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // For testing without signature verification
      event = JSON.parse(req.body);
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

// Handle successful payment
async function handlePaymentSuccess(paymentIntent) {
  try {
    const transactionId = paymentIntent.metadata.transactionId;
    if (!transactionId) {
      console.error('No transaction ID in payment metadata');
      return;
    }

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      console.error('Transaction not found:', transactionId);
      return;
    }

    transaction.platformFee.status = 'paid';
    transaction.platformFee.paidAt = new Date();
    transaction.platformFee.paymentMethod = 'stripe';
    transaction.platformFee.paymentReference = paymentIntent.id;

    await transaction.save();
    console.log(`Commission paid for transaction ${transactionId}`);
  } catch (err) {
    console.error('Error handling payment success:', err);
  }
}

// Handle failed payment
async function handlePaymentFailed(paymentIntent) {
  try {
    const transactionId = paymentIntent.metadata.transactionId;
    console.log(`Payment failed for transaction ${transactionId}`);
    // Could add notification logic here
  } catch (err) {
    console.error('Error handling payment failure:', err);
  }
}

// Get payment history for a user
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find({
      seller: req.user.userId,
      'platformFee.status': { $in: ['invoiced', 'paid'] }
    })
      .populate('property', 'address')
      .sort({ 'platformFee.paidAt': -1, 'platformFee.invoicedAt': -1 });

    const payments = transactions.map(t => ({
      id: t._id,
      property: t.property?.address ?
        `${t.property.address.street}, ${t.property.address.city}` : 'N/A',
      purchasePrice: t.purchasePrice,
      commissionAmount: t.platformFee.amount,
      status: t.platformFee.status,
      invoicedAt: t.platformFee.invoicedAt,
      paidAt: t.platformFee.paidAt,
      paymentReference: t.platformFee.paymentReference
    }));

    res.json(payments);
  } catch (err) {
    console.error('Error fetching payment history:', err);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// Admin: Get all pending commissions
router.get('/pending', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pendingTransactions = await Transaction.find({
      'platformFee.status': { $in: ['pending', 'invoiced'] }
    })
      .populate('seller', 'name email')
      .populate('property', 'address')
      .sort({ closingDate: 1 });

    const pending = pendingTransactions.map(t => ({
      id: t._id,
      seller: t.seller?.name || 'N/A',
      sellerEmail: t.seller?.email || 'N/A',
      property: t.property?.address ?
        `${t.property.address.street}, ${t.property.address.city}` : 'N/A',
      purchasePrice: t.purchasePrice,
      commissionAmount: t.platformFee.amount,
      status: t.platformFee.status,
      closingDate: t.closingDate,
      invoicedAt: t.platformFee.invoicedAt
    }));

    const totals = {
      pendingCount: pending.filter(p => p.status === 'pending').length,
      invoicedCount: pending.filter(p => p.status === 'invoiced').length,
      totalPendingAmount: pending.reduce((sum, p) => sum + (p.commissionAmount || 0), 0)
    };

    res.json({ pending, totals });
  } catch (err) {
    console.error('Error fetching pending commissions:', err);
    res.status(500).json({ error: 'Failed to fetch pending commissions' });
  }
});

// Admin: Mark commission as paid manually (for offline payments)
router.post('/mark-paid', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { transactionId, paymentMethod, paymentReference, notes } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID required' });
    }

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    transaction.platformFee.status = 'paid';
    transaction.platformFee.paidAt = new Date();
    transaction.platformFee.paymentMethod = paymentMethod || 'manual';
    transaction.platformFee.paymentReference = paymentReference || '';
    if (notes) {
      transaction.platformFee.notes = notes;
    }

    await transaction.save();

    res.json({
      message: 'Commission marked as paid',
      platformFee: transaction.platformFee
    });
  } catch (err) {
    console.error('Error marking commission as paid:', err);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

// Admin: Send payment reminder (placeholder - would integrate with email service)
router.post('/send-reminder', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { transactionId } = req.body;

    const transaction = await Transaction.findById(transactionId)
      .populate('seller', 'name email')
      .populate('property', 'address');

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Placeholder for email sending
    // In production, this would integrate with an email service
    console.log(`Payment reminder would be sent to: ${transaction.seller.email}`);
    console.log(`Amount: $${transaction.platformFee.amount} CAD`);

    res.json({
      message: 'Payment reminder sent',
      sentTo: transaction.seller.email,
      amount: transaction.platformFee.amount
    });
  } catch (err) {
    console.error('Error sending reminder:', err);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

module.exports = router;
