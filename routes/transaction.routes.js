const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const Transaction = require('../models/transaction.model');
const Condition = require('../models/condition.model');
const Listing = require('../models/listing.model');
const Property = require('../models/property.model');
const authMiddleware = require('../auth.middleware');
const { calculateLandTransferTax, estimateClosingCosts } = require('../config/provinces');

const idValidation = [
  param('id').isMongoId().withMessage('Invalid transaction ID')
];

/**
 * @route GET /transactions/my-transactions
 * @desc Get current user's transactions
 * @access Private
 */
router.get('/my-transactions', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const transactions = await Transaction.find({
      $or: [{ buyer: userId }, { seller: userId }]
    })
      .populate('property', 'address photos askingPrice')
      .populate('buyer', 'name email')
      .populate('seller', 'name email')
      .sort('-createdAt');

    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /transactions/:id
 * @desc Get single transaction
 * @access Private (buyer or seller only)
 */
router.get('/:id', authMiddleware, idValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const transaction = await Transaction.findById(req.params.id)
      .populate('property')
      .populate('listing')
      .populate('acceptedOffer')
      .populate('buyer', 'name email phone')
      .populate('seller', 'name email phone')
      .populate('conditions')
      .populate('documents');

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Check authorization
    const userId = req.user.userId;
    if (transaction.buyer._id.toString() !== userId &&
        transaction.seller._id.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to view this transaction' });
    }

    // Calculate additional info
    const daysUntilClosing = transaction.getDaysUntilClosing();
    const nextAction = transaction.getNextAction();
    const isOverdue = transaction.isOverdue();

    res.json({
      ...transaction.toObject(),
      daysUntilClosing,
      nextAction,
      isOverdue
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route PUT /transactions/:id/step
 * @desc Advance transaction to next step
 * @access Private
 */
router.put('/:id/step', authMiddleware, idValidation, [
  body('step').notEmpty().withMessage('Step is required'),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const userId = req.user.userId;
    if (transaction.buyer.toString() !== userId &&
        transaction.seller.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const validSteps = [
      'offer_accepted', 'deposit_pending', 'conditions_pending',
      'conditions_complete', 'lawyer_engaged', 'title_search',
      'mortgage_finalized', 'closing_documents', 'final_walkthrough',
      'closing_day', 'completed'
    ];

    if (!validSteps.includes(req.body.step)) {
      return res.status(400).json({ error: 'Invalid step' });
    }

    // Record step completion
    transaction.stepsCompleted.push({
      step: transaction.currentStep,
      completedAt: new Date(),
      completedBy: userId,
      notes: req.body.notes
    });

    transaction.currentStep = req.body.step;

    // Update status based on step
    if (req.body.step === 'conditions_complete') {
      transaction.status = 'firm';
      transaction.firmDate = new Date();
    } else if (req.body.step === 'closing_day') {
      transaction.status = 'closing';
    } else if (req.body.step === 'completed') {
      transaction.status = 'completed';
      transaction.actualClosingDate = new Date();

      // Update listing and property
      await Listing.findByIdAndUpdate(transaction.listing, {
        status: 'sold',
        'soldInfo.soldPrice': transaction.purchasePrice,
        'soldInfo.soldDate': new Date(),
        'soldInfo.transactionId': transaction._id
      });

      await Property.findByIdAndUpdate(transaction.property, {
        status: 'sold'
      });
    }

    await transaction.save();

    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route PUT /transactions/:id/lawyers
 * @desc Update lawyer information
 * @access Private
 */
router.put('/:id/lawyers', authMiddleware, idValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const userId = req.user.userId;
    const isBuyer = transaction.buyer.toString() === userId;
    const isSeller = transaction.seller.toString() === userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update appropriate lawyer info
    if (isBuyer && req.body.buyerLawyer) {
      transaction.buyerLawyer = req.body.buyerLawyer;
    }

    if (isSeller && req.body.sellerLawyer) {
      transaction.sellerLawyer = req.body.sellerLawyer;
    }

    // For Quebec, update notary instead
    if (transaction.province === 'QC' && req.body.notary) {
      transaction.notary = req.body.notary;
    }

    await transaction.save();

    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /transactions/:id/conditions
 * @desc Get conditions for a transaction
 * @access Private
 */
router.get('/:id/conditions', authMiddleware, idValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const userId = req.user.userId;
    if (transaction.buyer.toString() !== userId &&
        transaction.seller.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const conditions = await Condition.find({ transaction: req.params.id })
      .sort('deadlineDate');

    res.json(conditions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route PUT /transactions/:id/conditions/:conditionId
 * @desc Update a condition (fulfill, waive, or fail)
 * @access Private
 */
router.put('/:id/conditions/:conditionId', authMiddleware, [
  param('id').isMongoId(),
  param('conditionId').isMongoId(),
  body('status').isIn(['fulfilled', 'waived', 'failed']).withMessage('Invalid status'),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const userId = req.user.userId;
    if (transaction.buyer.toString() !== userId &&
        transaction.seller.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const condition = await Condition.findOne({
      _id: req.params.conditionId,
      transaction: req.params.id
    });

    if (!condition) {
      return res.status(404).json({ error: 'Condition not found' });
    }

    condition.status = req.body.status;
    condition.resolvedAt = new Date();
    condition.resolvedBy = userId;
    condition.resolutionMethod = req.body.status;
    condition.resolutionNotes = req.body.notes;

    await condition.save();

    // Check if all conditions are resolved
    const allConditions = await Condition.find({ transaction: req.params.id });
    const allResolved = allConditions.every(c =>
      c.status === 'fulfilled' || c.status === 'waived'
    );
    const anyFailed = allConditions.some(c => c.status === 'failed');

    if (anyFailed) {
      // Transaction fails if any condition fails
      transaction.status = 'cancelled';
      transaction.cancellation = {
        cancelledAt: new Date(),
        cancelledBy: userId,
        reason: 'Condition failed',
        failedCondition: condition.title,
        depositDisposition: 'returned_to_buyer'
      };
      await transaction.save();

      // Reactivate listing
      await Listing.findByIdAndUpdate(transaction.listing, { status: 'active' });
      await Property.findByIdAndUpdate(transaction.property, { status: 'active' });
    } else if (allResolved) {
      transaction.status = 'firm';
      transaction.firmDate = new Date();
      transaction.currentStep = 'conditions_complete';
      await transaction.save();
    }

    res.json({ condition, transaction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /transactions/:id/closing-costs
 * @desc Calculate estimated closing costs
 * @access Private
 */
router.get('/:id/closing-costs', authMiddleware, idValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const userId = req.user.userId;
    if (transaction.buyer.toString() !== userId &&
        transaction.seller.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { isFirstTimeBuyer = false, isToronto = false } = req.query;

    const landTransferTax = calculateLandTransferTax(
      transaction.province,
      transaction.purchasePrice,
      { isFirstTimeBuyer: isFirstTimeBuyer === 'true', isToronto: isToronto === 'true' }
    );

    const closingCosts = estimateClosingCosts(
      transaction.province,
      transaction.purchasePrice,
      { isFirstTimeBuyer: isFirstTimeBuyer === 'true' }
    );

    res.json({
      purchasePrice: transaction.purchasePrice,
      deposit: transaction.depositAmount,
      balanceDueOnClosing: transaction.purchasePrice - transaction.depositAmount,
      landTransferTax,
      estimatedClosingCosts: closingCosts,
      totalDueOnClosing: (transaction.purchasePrice - transaction.depositAmount) + closingCosts.total
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route POST /transactions/:id/notes
 * @desc Add a note to transaction
 * @access Private
 */
router.post('/:id/notes', authMiddleware, idValidation, [
  body('content').trim().notEmpty().withMessage('Note content is required'),
  body('isPrivate').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const userId = req.user.userId;
    if (transaction.buyer.toString() !== userId &&
        transaction.seller.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    transaction.notes.push({
      content: req.body.content,
      createdBy: userId,
      isPrivate: req.body.isPrivate || false
    });

    await transaction.save();

    res.json(transaction.notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route POST /transactions/:id/cancel
 * @desc Cancel a transaction
 * @access Private
 */
router.post('/:id/cancel', authMiddleware, idValidation, [
  body('reason').trim().notEmpty().withMessage('Cancellation reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const userId = req.user.userId;
    if (transaction.buyer.toString() !== userId &&
        transaction.seller.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (transaction.status === 'completed') {
      return res.status(400).json({ error: 'Cannot cancel completed transaction' });
    }

    transaction.status = 'cancelled';
    transaction.cancellation = {
      cancelledAt: new Date(),
      cancelledBy: userId,
      reason: req.body.reason,
      depositDisposition: req.body.depositDisposition || 'disputed'
    };

    await transaction.save();

    // Reactivate listing and property
    await Listing.findByIdAndUpdate(transaction.listing, { status: 'active' });
    await Property.findByIdAndUpdate(transaction.property, { status: 'active' });

    res.json({ message: 'Transaction cancelled', transaction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
