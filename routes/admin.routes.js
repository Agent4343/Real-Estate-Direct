const express = require('express');
const router = express.Router();
const Transaction = require('../models/transaction.model');
const User = require('../models/user.model');
const Property = require('../models/property.model');
const authMiddleware = require('../auth.middleware');

// Platform configuration
const PLATFORM_CONFIG = {
  commissionRate: 0.01, // 1%
  companyName: 'Real Estate Direct',
  currency: 'CAD'
};

// Admin middleware - checks if user is admin
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

// Get platform earnings dashboard
router.get('/earnings', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;

    // Build query
    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (status) {
      query['platformFee.status'] = status;
    }

    // Get all transactions with platform fees
    const transactions = await Transaction.find(query)
      .populate('property', 'address')
      .populate('seller', 'name email')
      .populate('buyer', 'name email')
      .sort({ createdAt: -1 });

    // Calculate totals
    const summary = {
      totalTransactions: transactions.length,
      totalSalesVolume: 0,
      totalEarnings: 0,
      pendingEarnings: 0,
      paidEarnings: 0,
      completedTransactions: 0,
      averageCommission: 0
    };

    transactions.forEach(t => {
      const feeAmount = t.platformFee?.amount || 0;
      summary.totalSalesVolume += t.purchasePrice || 0;
      summary.totalEarnings += feeAmount;

      if (t.platformFee?.status === 'paid') {
        summary.paidEarnings += feeAmount;
      } else if (t.platformFee?.status === 'pending' || t.platformFee?.status === 'invoiced') {
        summary.pendingEarnings += feeAmount;
      }

      if (t.status === 'completed') {
        summary.completedTransactions++;
      }
    });

    if (summary.totalTransactions > 0) {
      summary.averageCommission = summary.totalEarnings / summary.totalTransactions;
    }

    // Format for response
    const earningsData = transactions.map(t => ({
      id: t._id,
      date: t.createdAt,
      property: t.property?.address ?
        `${t.property.address.street}, ${t.property.address.city}` : 'N/A',
      seller: t.seller?.name || 'N/A',
      sellerEmail: t.seller?.email || 'N/A',
      purchasePrice: t.purchasePrice,
      commissionRate: (t.platformFee?.rate || PLATFORM_CONFIG.commissionRate) * 100 + '%',
      commissionAmount: t.platformFee?.amount || 0,
      status: t.platformFee?.status || 'pending',
      transactionStatus: t.status,
      paidAt: t.platformFee?.paidAt
    }));

    res.json({
      config: PLATFORM_CONFIG,
      summary,
      transactions: earningsData
    });
  } catch (err) {
    console.error('Error fetching earnings:', err);
    res.status(500).json({ error: 'Failed to fetch earnings data' });
  }
});

// Get earnings summary by period
router.get('/earnings/summary', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // This month
    const thisMonthStats = await Transaction.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$purchasePrice' },
          totalFees: { $sum: '$platformFee.amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Last month
    const lastMonthStats = await Transaction.aggregate([
      { $match: { createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$purchasePrice' },
          totalFees: { $sum: '$platformFee.amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // This year
    const thisYearStats = await Transaction.aggregate([
      { $match: { createdAt: { $gte: startOfYear } } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$purchasePrice' },
          totalFees: { $sum: '$platformFee.amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // All time
    const allTimeStats = await Transaction.aggregate([
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$purchasePrice' },
          totalFees: { $sum: '$platformFee.amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Monthly breakdown for current year
    const monthlyBreakdown = await Transaction.aggregate([
      { $match: { createdAt: { $gte: startOfYear } } },
      {
        $group: {
          _id: { $month: '$createdAt' },
          totalSales: { $sum: '$purchasePrice' },
          totalFees: { $sum: '$platformFee.amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      thisMonth: thisMonthStats[0] || { totalSales: 0, totalFees: 0, count: 0 },
      lastMonth: lastMonthStats[0] || { totalSales: 0, totalFees: 0, count: 0 },
      thisYear: thisYearStats[0] || { totalSales: 0, totalFees: 0, count: 0 },
      allTime: allTimeStats[0] || { totalSales: 0, totalFees: 0, count: 0 },
      monthlyBreakdown
    });
  } catch (err) {
    console.error('Error fetching earnings summary:', err);
    res.status(500).json({ error: 'Failed to fetch earnings summary' });
  }
});

// Update commission payment status
router.patch('/transactions/:id/commission', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, paymentMethod, paymentReference, notes } = req.body;

    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Update platform fee status
    if (status) {
      transaction.platformFee.status = status;
      if (status === 'invoiced') {
        transaction.platformFee.invoicedAt = new Date();
      }
      if (status === 'paid') {
        transaction.platformFee.paidAt = new Date();
      }
    }
    if (paymentMethod) transaction.platformFee.paymentMethod = paymentMethod;
    if (paymentReference) transaction.platformFee.paymentReference = paymentReference;
    if (notes) transaction.platformFee.notes = notes;

    await transaction.save();

    res.json({
      message: 'Commission status updated',
      platformFee: transaction.platformFee
    });
  } catch (err) {
    console.error('Error updating commission:', err);
    res.status(500).json({ error: 'Failed to update commission status' });
  }
});

// Get platform statistics
router.get('/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [
      totalUsers,
      totalProperties,
      activeListings,
      completedTransactions,
      pendingTransactions
    ] = await Promise.all([
      User.countDocuments(),
      Property.countDocuments(),
      Property.countDocuments({ status: 'active' }),
      Transaction.countDocuments({ status: 'completed' }),
      Transaction.countDocuments({ status: { $in: ['conditional', 'firm', 'closing'] } })
    ]);

    // Recent activity
    const recentTransactions = await Transaction.find()
      .populate('property', 'address askingPrice')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      users: totalUsers,
      properties: totalProperties,
      activeListings,
      completedTransactions,
      pendingTransactions,
      recentTransactions: recentTransactions.map(t => ({
        id: t._id,
        property: t.property?.address?.street || 'N/A',
        price: t.purchasePrice,
        status: t.status,
        date: t.createdAt
      }))
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch platform statistics' });
  }
});

// Get configuration
router.get('/config', authMiddleware, adminMiddleware, (req, res) => {
  res.json(PLATFORM_CONFIG);
});

module.exports = router;
