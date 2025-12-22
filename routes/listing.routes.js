const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const Listing = require('../models/listing.model');
const Property = require('../models/property.model');
const authMiddleware = require('../auth.middleware');

const idValidation = [
  param('id').isMongoId().withMessage('Invalid listing ID')
];

const listingValidation = [
  body('propertyId').isMongoId().withMessage('Valid property ID required'),
  body('endDate').isISO8601().withMessage('Valid end date required'),
  body('listingType').optional().isIn(['exclusive', 'open', 'fsbo']).withMessage('Invalid listing type')
];

/**
 * @route GET /listings
 * @desc Get all active listings
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const now = new Date();
    const filter = {
      status: 'active',
      startDate: { $lte: now },
      endDate: { $gte: now }
    };

    const [listings, total] = await Promise.all([
      Listing.find(filter)
        .populate({
          path: 'property',
          select: 'address askingPrice bedrooms bathrooms squareFeet photos propertyType'
        })
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit)),
      Listing.countDocuments(filter)
    ]);

    res.json({
      listings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /listings/my-listings
 * @desc Get current user's listings
 * @access Private
 */
router.get('/my-listings', authMiddleware, async (req, res) => {
  try {
    const listings = await Listing.find({ seller: req.user.userId })
      .populate('property')
      .sort('-createdAt');

    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /listings/:id
 * @desc Get single listing
 * @access Public
 */
router.get('/:id', idValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const listing = await Listing.findById(req.params.id)
      .populate('property')
      .populate('seller', 'name email phone')
      .populate('offersReceived');

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Increment view count
    listing.views += 1;
    await listing.save();

    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route POST /listings
 * @desc Create a new listing (activate a property)
 * @access Private
 */
router.post('/', authMiddleware, listingValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { propertyId, endDate, listingType, showingInstructions, showingContact } = req.body;

    // Verify property exists and belongs to user
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    if (property.seller.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to list this property' });
    }

    // Check if property already has an active listing
    const existingListing = await Listing.findOne({
      property: propertyId,
      status: 'active'
    });

    if (existingListing) {
      return res.status(400).json({ error: 'Property already has an active listing' });
    }

    // Validate end date is in the future
    if (new Date(endDate) <= new Date()) {
      return res.status(400).json({ error: 'End date must be in the future' });
    }

    // Create listing
    const listing = new Listing({
      property: propertyId,
      seller: req.user.userId,
      startDate: new Date(),
      endDate: new Date(endDate),
      listingType: listingType || 'fsbo',
      status: 'active',
      showingInstructions,
      showingContact
    });

    await listing.save();

    // Update property status
    property.status = 'active';
    await property.save();

    await listing.populate('property');
    res.status(201).json(listing);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @route PUT /listings/:id
 * @desc Update a listing
 * @access Private (owner only)
 */
router.put('/:id', authMiddleware, idValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.seller.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const allowedUpdates = [
      'endDate', 'listingType', 'showingInstructions', 'showingContact',
      'showingAvailability', 'lockboxCode', 'allowPhotography',
      'allowVirtualTour', 'allowOpenHouse'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        listing[field] = req.body[field];
      }
    });

    await listing.save();
    await listing.populate('property');

    res.json(listing);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @route PATCH /listings/:id/status
 * @desc Update listing status
 * @access Private (owner only)
 */
router.patch('/:id/status', authMiddleware, idValidation, [
  body('status').isIn(['active', 'pending', 'sold', 'expired', 'withdrawn', 'cancelled'])
    .withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const listing = await Listing.findById(req.params.id).populate('property');

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.seller.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const oldStatus = listing.status;
    listing.status = req.body.status;

    // Update property status to match
    if (listing.property) {
      if (req.body.status === 'sold') {
        listing.property.status = 'sold';
        listing.soldInfo = {
          soldDate: new Date(),
          daysOnMarket: listing.getDaysOnMarket()
        };
      } else if (req.body.status === 'withdrawn' || req.body.status === 'cancelled') {
        listing.property.status = 'withdrawn';
      } else if (req.body.status === 'expired') {
        listing.property.status = 'expired';
      }
      await listing.property.save();
    }

    await listing.save();
    res.json(listing);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @route POST /listings/:id/save
 * @desc Save/favorite a listing
 * @access Private
 */
router.post('/:id/save', authMiddleware, idValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    listing.saves += 1;
    await listing.save();

    res.json({ message: 'Listing saved', saves: listing.saves });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route POST /listings/:id/inquiry
 * @desc Record an inquiry on a listing
 * @access Private
 */
router.post('/:id/inquiry', authMiddleware, idValidation, [
  body('message').trim().notEmpty().withMessage('Message is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const listing = await Listing.findById(req.params.id).populate('seller', 'email name');

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    listing.inquiries += 1;
    await listing.save();

    // In a real app, send email to seller here

    res.json({ message: 'Inquiry sent successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
