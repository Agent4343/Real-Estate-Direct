const express = require('express');
const router = express.Router();
const emailService = require('../services/email.service');
const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');
const authMiddleware = require('../auth.middleware');

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

// Get notification settings
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Default settings if not set
    const settings = user.notificationSettings || {
      emailOffers: true,
      emailMessages: true,
      emailTransactions: true,
      emailDocuments: true,
      emailMarketing: false
    };

    res.json(settings);
  } catch (err) {
    console.error('Error fetching notification settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update notification settings
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const { emailOffers, emailMessages, emailTransactions, emailDocuments, emailMarketing } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.notificationSettings = {
      emailOffers: emailOffers !== false,
      emailMessages: emailMessages !== false,
      emailTransactions: emailTransactions !== false,
      emailDocuments: emailDocuments !== false,
      emailMarketing: emailMarketing === true
    };

    await user.save();
    res.json({ message: 'Settings updated', settings: user.notificationSettings });
  } catch (err) {
    console.error('Error updating notification settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Test email endpoint (admin only)
router.post('/test', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { email, type } = req.body;
    const targetEmail = email || req.user.email;

    const testData = {
      name: 'Test User',
      propertyAddress: '123 Test Street, Toronto',
      offerPrice: 500000,
      depositAmount: 25000,
      closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      conditionCount: 2,
      irrevocableDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      viewUrl: process.env.APP_URL || 'http://localhost:3000'
    };

    let result;
    switch (type) {
      case 'offer':
        result = await emailService.sendOfferReceived(targetEmail, testData);
        break;
      case 'welcome':
        result = await emailService.sendWelcome(targetEmail, {
          name: 'Test User',
          searchUrl: `${testData.viewUrl}/properties`,
          listUrl: `${testData.viewUrl}/list-property`,
          profileUrl: `${testData.viewUrl}/profile`
        });
        break;
      case 'closing':
        result = await emailService.sendClosingReminder(targetEmail, {
          ...testData,
          daysUntilClosing: 7,
          transactionUrl: testData.viewUrl
        });
        break;
      default:
        result = await emailService.sendWelcome(targetEmail, {
          name: 'Test User',
          searchUrl: testData.viewUrl,
          listUrl: testData.viewUrl,
          profileUrl: testData.viewUrl
        });
    }

    res.json({ message: 'Test email sent', result });
  } catch (err) {
    console.error('Error sending test email:', err);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// Send commission invoice (admin only)
router.post('/commission-invoice/:transactionId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { transactionId } = req.params;

    const transaction = await Transaction.findById(transactionId)
      .populate('seller', 'name email')
      .populate('property', 'address');

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const result = await emailService.sendCommissionInvoice(transaction.seller.email, {
      sellerName: transaction.seller.name,
      propertyAddress: `${transaction.property.address?.street || 'N/A'}, ${transaction.property.address?.city || ''}`,
      salePrice: transaction.purchasePrice,
      commissionRate: transaction.platformFee?.rate || 0.01,
      commissionAmount: transaction.platformFee?.amount || 0,
      dueDate,
      paymentUrl: `${appUrl}/payments`,
      savingsAmount: Math.round((transaction.purchasePrice * 0.05) - (transaction.platformFee?.amount || 0))
    });

    // Update transaction to invoiced status
    if (transaction.platformFee.status === 'pending') {
      transaction.platformFee.status = 'invoiced';
      transaction.platformFee.invoicedAt = new Date();
      await transaction.save();
    }

    res.json({ message: 'Invoice sent', result });
  } catch (err) {
    console.error('Error sending commission invoice:', err);
    res.status(500).json({ error: 'Failed to send invoice' });
  }
});

// Send payment reminder (admin only)
router.post('/payment-reminder/:transactionId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { transactionId } = req.params;

    const transaction = await Transaction.findById(transactionId)
      .populate('seller', 'name email')
      .populate('property', 'address');

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const invoicedAt = transaction.platformFee.invoicedAt || new Date();
    const dueDate = new Date(invoicedAt);
    dueDate.setDate(dueDate.getDate() + 30);

    const now = new Date();
    const daysOverdue = Math.max(0, Math.floor((now - dueDate) / (1000 * 60 * 60 * 24)));

    const result = await emailService.sendPaymentReminder(transaction.seller.email, {
      sellerName: transaction.seller.name,
      propertyAddress: `${transaction.property.address?.street || 'N/A'}, ${transaction.property.address?.city || ''}`,
      amountDue: transaction.platformFee?.amount || 0,
      dueDate,
      daysOverdue,
      paymentUrl: `${appUrl}/payments`
    });

    res.json({ message: 'Reminder sent', result });
  } catch (err) {
    console.error('Error sending payment reminder:', err);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

// Send bulk closing reminders (admin only - for scheduled tasks)
router.post('/closing-reminders', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { daysBeforeClosing = 7 } = req.body;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysBeforeClosing);

    // Find transactions closing within the target window
    const transactions = await Transaction.find({
      status: { $in: ['conditional', 'firm', 'closing'] },
      closingDate: {
        $gte: new Date(),
        $lte: targetDate
      }
    })
      .populate('buyer', 'name email')
      .populate('seller', 'name email')
      .populate('property', 'address');

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const results = [];

    for (const transaction of transactions) {
      const daysUntilClosing = Math.ceil(
        (new Date(transaction.closingDate) - new Date()) / (1000 * 60 * 60 * 24)
      );

      const emailData = {
        propertyAddress: `${transaction.property.address?.street || 'N/A'}, ${transaction.property.address?.city || ''}`,
        closingDate: transaction.closingDate,
        daysUntilClosing,
        transactionUrl: `${appUrl}/transactions/${transaction._id}`
      };

      // Send to both buyer and seller
      if (transaction.buyer?.email) {
        const buyerResult = await emailService.sendClosingReminder(
          transaction.buyer.email,
          emailData
        );
        results.push({ user: 'buyer', transactionId: transaction._id, ...buyerResult });
      }

      if (transaction.seller?.email) {
        const sellerResult = await emailService.sendClosingReminder(
          transaction.seller.email,
          emailData
        );
        results.push({ user: 'seller', transactionId: transaction._id, ...sellerResult });
      }
    }

    res.json({
      message: `Sent ${results.length} closing reminders`,
      transactionsFound: transactions.length,
      results
    });
  } catch (err) {
    console.error('Error sending closing reminders:', err);
    res.status(500).json({ error: 'Failed to send closing reminders' });
  }
});

// Get email provider status
router.get('/status', authMiddleware, adminMiddleware, (req, res) => {
  const provider = process.env.EMAIL_PROVIDER || 'local';
  const configured = {
    sendgrid: !!process.env.SENDGRID_API_KEY,
    mailgun: !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN),
    ses: !!process.env.AWS_ACCESS_KEY_ID,
    local: true
  };

  res.json({
    activeProvider: provider,
    providers: configured,
    fromEmail: process.env.EMAIL_FROM || 'noreply@realestatedirect.ca',
    fromName: process.env.EMAIL_FROM_NAME || 'Real Estate Direct'
  });
});

module.exports = router;
