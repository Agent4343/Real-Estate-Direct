const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const Offer = require('../models/offer.model');
const Listing = require('../models/listing.model');
const Property = require('../models/property.model');
const Transaction = require('../models/transaction.model');
const Condition = require('../models/condition.model');
const authMiddleware = require('../auth.middleware');
const { getAllProvinceCodes } = require('../config/provinces');

const provinceCodes = getAllProvinceCodes();

const idValidation = [
  param('id').isMongoId().withMessage('Invalid offer ID')
];

const offerValidation = [
  body('listingId').isMongoId().withMessage('Valid listing ID required'),
  body('offerPrice').isFloat({ min: 1 }).withMessage('Offer price must be positive'),
  body('depositAmount').isFloat({ min: 0 }).withMessage('Deposit must be non-negative'),
  body('depositDueDate').isISO8601().withMessage('Valid deposit due date required'),
  body('closingDate').isISO8601().withMessage('Valid closing date required'),
  body('irrevocableDate').isISO8601().withMessage('Valid irrevocable date required'),
  body('conditions').optional().isArray(),
  body('conditions.*.type').optional().isIn([
    'financing', 'inspection', 'status_certificate', 'sale_of_property',
    'appraisal', 'lawyer_review', 'other'
  ]),
  body('conditions.*.deadlineDays').optional().isInt({ min: 1 }),
  body('inclusions').optional().isArray(),
  body('exclusions').optional().isArray()
];

/**
 * @route GET /offers/my-offers
 * @desc Get current user's offers (as buyer)
 * @access Private
 */
router.get('/my-offers', authMiddleware, async (req, res) => {
  try {
    const offers = await Offer.find({ buyer: req.user.userId })
      .populate('property', 'address askingPrice photos')
      .populate('listing')
      .sort('-createdAt');

    res.json(offers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /offers/received
 * @desc Get offers received on user's listings (as seller)
 * @access Private
 */
router.get('/received', authMiddleware, async (req, res) => {
  try {
    const offers = await Offer.find({ seller: req.user.userId })
      .populate('property', 'address askingPrice photos')
      .populate('buyer', 'name email')
      .populate('listing')
      .sort('-createdAt');

    res.json(offers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /offers/:id
 * @desc Get single offer
 * @access Private (buyer or seller only)
 */
router.get('/:id', authMiddleware, idValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const offer = await Offer.findById(req.params.id)
      .populate('property')
      .populate('listing')
      .populate('buyer', 'name email phone')
      .populate('seller', 'name email phone')
      .populate('parentOffer')
      .populate('counterOffers');

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Check authorization
    const userId = req.user.userId;
    if (offer.buyer.toString() !== userId && offer.seller.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to view this offer' });
    }

    // Mark as viewed if seller viewing for first time
    if (offer.seller._id.toString() === userId && !offer.viewedAt) {
      offer.viewedAt = new Date();
      offer.status = 'viewed';
      await offer.save();
    }

    res.json(offer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route POST /offers
 * @desc Submit a new offer
 * @access Private
 */
router.post('/', authMiddleware, offerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { listingId, ...offerData } = req.body;

    // Get listing and property
    const listing = await Listing.findById(listingId).populate('property');
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (!listing.isActive()) {
      return res.status(400).json({ error: 'Listing is not active' });
    }

    // Can't make offer on own property
    if (listing.seller.toString() === req.user.userId) {
      return res.status(400).json({ error: 'Cannot make offer on your own property' });
    }

    // Validate dates
    const now = new Date();
    const irrevocableDate = new Date(offerData.irrevocableDate);
    const closingDate = new Date(offerData.closingDate);

    if (irrevocableDate <= now) {
      return res.status(400).json({ error: 'Irrevocable date must be in the future' });
    }

    if (closingDate <= irrevocableDate) {
      return res.status(400).json({ error: 'Closing date must be after irrevocable date' });
    }

    // Create offer
    const offer = new Offer({
      property: listing.property._id,
      listing: listingId,
      buyer: req.user.userId,
      seller: listing.seller,
      province: listing.property.province,
      ...offerData,
      status: 'submitted',
      submittedAt: new Date()
    });

    await offer.save();

    // Add offer to listing
    listing.offersReceived.push(offer._id);
    await listing.save();

    await offer.populate('property', 'address askingPrice');
    await offer.populate('listing');

    res.status(201).json(offer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @route POST /offers/:id/accept
 * @desc Accept an offer (seller only)
 * @access Private
 */
router.post('/:id/accept', authMiddleware, idValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const offer = await Offer.findById(req.params.id)
      .populate('property')
      .populate('listing');

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Only seller can accept
    if (offer.seller.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only the seller can accept this offer' });
    }

    // Check offer is still valid
    if (offer.isExpired()) {
      return res.status(400).json({ error: 'Offer has expired' });
    }

    if (offer.status !== 'submitted' && offer.status !== 'viewed') {
      return res.status(400).json({ error: `Cannot accept offer with status: ${offer.status}` });
    }

    // Update offer
    offer.status = 'accepted';
    offer.respondedAt = new Date();
    offer.sellerSignature = {
      signed: true,
      signedAt: new Date()
    };
    await offer.save();

    // Update listing status
    if (offer.listing) {
      offer.listing.status = 'pending';
      await offer.listing.save();
    }

    // Update property status
    if (offer.property) {
      offer.property.status = 'pending';
      await offer.property.save();
    }

    // Create transaction
    const transaction = new Transaction({
      property: offer.property._id,
      listing: offer.listing._id,
      acceptedOffer: offer._id,
      buyer: offer.buyer,
      seller: offer.seller,
      province: offer.province,
      purchasePrice: offer.offerPrice,
      depositAmount: offer.depositAmount,
      acceptanceDate: new Date(),
      closingDate: offer.closingDate,
      possessionDate: offer.possessionDate || offer.closingDate,
      status: offer.conditions.length > 0 ? 'conditional' : 'firm',
      currentStep: 'offer_accepted',
      buyerLawyer: offer.buyerLawyer
    });

    await transaction.save();

    // Create condition records
    if (offer.conditions.length > 0) {
      const conditions = await Promise.all(
        offer.conditions.map(async (cond) => {
          const deadlineDate = new Date(transaction.acceptanceDate);
          deadlineDate.setDate(deadlineDate.getDate() + cond.deadlineDays);

          const condition = new Condition({
            transaction: transaction._id,
            offer: offer._id,
            conditionType: cond.type,
            title: cond.description || Condition.getTemplate(cond.type, offer.province).title,
            description: cond.description || Condition.getTemplate(cond.type, offer.province).description,
            deadlineDate,
            daysFromAcceptance: cond.deadlineDays,
            status: 'pending'
          });

          return condition.save();
        })
      );

      transaction.conditions = conditions.map(c => c._id);
      transaction.conditionDeadline = new Date(Math.max(...conditions.map(c => c.deadlineDate)));
      await transaction.save();
    }

    // Reject all other offers on this listing
    await Offer.updateMany(
      {
        listing: offer.listing._id,
        _id: { $ne: offer._id },
        status: { $in: ['submitted', 'viewed'] }
      },
      {
        status: 'rejected',
        respondedAt: new Date()
      }
    );

    res.json({
      offer,
      transaction,
      message: 'Offer accepted successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route POST /offers/:id/reject
 * @desc Reject an offer (seller only)
 * @access Private
 */
router.post('/:id/reject', authMiddleware, idValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const offer = await Offer.findById(req.params.id);

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    if (offer.seller.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only the seller can reject this offer' });
    }

    if (offer.status !== 'submitted' && offer.status !== 'viewed') {
      return res.status(400).json({ error: `Cannot reject offer with status: ${offer.status}` });
    }

    offer.status = 'rejected';
    offer.respondedAt = new Date();
    await offer.save();

    res.json({ message: 'Offer rejected', offer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route POST /offers/:id/counter
 * @desc Create a counter-offer
 * @access Private (seller only)
 */
router.post('/:id/counter', authMiddleware, idValidation, [
  body('offerPrice').isFloat({ min: 1 }).withMessage('Offer price required'),
  body('irrevocableDate').isISO8601().withMessage('Valid irrevocable date required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const originalOffer = await Offer.findById(req.params.id)
      .populate('property')
      .populate('listing');

    if (!originalOffer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    if (originalOffer.seller.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only the seller can counter this offer' });
    }

    if (originalOffer.status !== 'submitted' && originalOffer.status !== 'viewed') {
      return res.status(400).json({ error: `Cannot counter offer with status: ${originalOffer.status}` });
    }

    // Update original offer status
    originalOffer.status = 'countered';
    originalOffer.respondedAt = new Date();
    await originalOffer.save();

    // Create counter-offer (roles are swapped)
    const counterOffer = new Offer({
      property: originalOffer.property._id,
      listing: originalOffer.listing._id,
      buyer: originalOffer.seller, // Seller becomes the "offerer"
      seller: originalOffer.buyer, // Buyer receives the counter
      province: originalOffer.province,
      offerPrice: req.body.offerPrice,
      depositAmount: req.body.depositAmount || originalOffer.depositAmount,
      depositDueDate: req.body.depositDueDate || originalOffer.depositDueDate,
      closingDate: req.body.closingDate || originalOffer.closingDate,
      possessionDate: req.body.possessionDate || originalOffer.possessionDate,
      irrevocableDate: req.body.irrevocableDate,
      conditions: req.body.conditions || originalOffer.conditions,
      inclusions: req.body.inclusions || originalOffer.inclusions,
      exclusions: req.body.exclusions || originalOffer.exclusions,
      additionalTerms: req.body.additionalTerms || originalOffer.additionalTerms,
      parentOffer: originalOffer._id,
      isCounterOffer: true,
      status: 'submitted',
      submittedAt: new Date()
    });

    await counterOffer.save();

    // Link counter-offer to original
    originalOffer.counterOffers.push(counterOffer._id);
    await originalOffer.save();

    await counterOffer.populate('property', 'address');

    res.status(201).json({
      counterOffer,
      originalOffer,
      message: 'Counter-offer created successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route POST /offers/:id/withdraw
 * @desc Withdraw an offer (buyer only)
 * @access Private
 */
router.post('/:id/withdraw', authMiddleware, idValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const offer = await Offer.findById(req.params.id);

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    if (offer.buyer.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only the buyer can withdraw this offer' });
    }

    if (offer.status === 'accepted') {
      return res.status(400).json({ error: 'Cannot withdraw an accepted offer' });
    }

    offer.status = 'withdrawn';
    await offer.save();

    res.json({ message: 'Offer withdrawn', offer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /offers/listing/:listingId
 * @desc Get all offers on a listing (seller only)
 * @access Private
 */
router.get('/listing/:listingId', authMiddleware, [
  param('listingId').isMongoId().withMessage('Invalid listing ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const listing = await Listing.findById(req.params.listingId);

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.seller.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to view offers on this listing' });
    }

    const offers = await Offer.find({ listing: req.params.listingId })
      .populate('buyer', 'name email')
      .sort('-createdAt');

    res.json(offers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
