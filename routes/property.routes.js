const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const Property = require('../models/property.model');
const authMiddleware = require('../auth.middleware');
const { getAllProvinceCodes } = require('../config/provinces');

const provinceCodes = getAllProvinceCodes();

// Validation middleware
const propertyValidation = [
  body('province').isIn(provinceCodes).withMessage('Invalid province code'),
  body('address.street').trim().notEmpty().withMessage('Street address is required'),
  body('address.city').trim().notEmpty().withMessage('City is required'),
  body('address.province').trim().notEmpty().withMessage('Province is required'),
  body('address.postalCode').trim().notEmpty().withMessage('Postal code is required'),
  body('legalDescription').trim().notEmpty().withMessage('Legal description is required'),
  body('propertyType').isIn(['residential', 'condo', 'townhouse', 'semi-detached', 'detached', 'commercial', 'land', 'multi-family'])
    .withMessage('Invalid property type'),
  body('askingPrice').isFloat({ min: 0 }).withMessage('Asking price must be a positive number'),
  body('bedrooms').optional().isInt({ min: 0 }).withMessage('Bedrooms must be a non-negative integer'),
  body('bathrooms').optional().isFloat({ min: 0 }).withMessage('Bathrooms must be a non-negative number'),
  body('squareFeet').optional().isFloat({ min: 0 }).withMessage('Square feet must be a positive number')
];

const idValidation = [
  param('id').isMongoId().withMessage('Invalid property ID')
];

// Search/filter validation
const searchValidation = [
  query('province').optional().isIn(provinceCodes),
  query('city').optional().trim(),
  query('propertyType').optional().isIn(['residential', 'condo', 'townhouse', 'semi-detached', 'detached', 'commercial', 'land', 'multi-family']),
  query('minPrice').optional().isFloat({ min: 0 }),
  query('maxPrice').optional().isFloat({ min: 0 }),
  query('minBedrooms').optional().isInt({ min: 0 }),
  query('maxBedrooms').optional().isInt({ min: 0 }),
  query('minBathrooms').optional().isFloat({ min: 0 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
];

/**
 * @route GET /properties
 * @desc Search and list properties
 * @access Public
 */
router.get('/', searchValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      province,
      city,
      propertyType,
      minPrice,
      maxPrice,
      minBedrooms,
      maxBedrooms,
      minBathrooms,
      page = 1,
      limit = 20,
      sort = '-createdAt'
    } = req.query;

    // Build filter
    const filter = { status: 'active' };

    if (province) filter.province = province;
    if (city) filter['address.city'] = new RegExp(city, 'i');
    if (propertyType) filter.propertyType = propertyType;

    if (minPrice || maxPrice) {
      filter.askingPrice = {};
      if (minPrice) filter.askingPrice.$gte = parseFloat(minPrice);
      if (maxPrice) filter.askingPrice.$lte = parseFloat(maxPrice);
    }

    if (minBedrooms || maxBedrooms) {
      filter.bedrooms = {};
      if (minBedrooms) filter.bedrooms.$gte = parseInt(minBedrooms);
      if (maxBedrooms) filter.bedrooms.$lte = parseInt(maxBedrooms);
    }

    if (minBathrooms) {
      filter.bathrooms = { $gte: parseFloat(minBathrooms) };
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [properties, total] = await Promise.all([
      Property.find(filter)
        .select('-__v')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('seller', 'name email'),
      Property.countDocuments(filter)
    ]);

    res.json({
      properties,
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
 * @route GET /properties/my-properties
 * @desc Get current user's properties
 * @access Private
 */
router.get('/my-properties', authMiddleware, async (req, res) => {
  try {
    const properties = await Property.find({ seller: req.user.userId })
      .select('-__v')
      .sort('-createdAt');

    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /properties/:id
 * @desc Get single property
 * @access Public
 */
router.get('/:id', idValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const property = await Property.findById(req.params.id)
      .populate('seller', 'name email phone')
      .populate('disclosureDocumentId');

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json(property);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route POST /properties
 * @desc Create a new property listing
 * @access Private
 */
router.post('/', authMiddleware, propertyValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const propertyData = {
      ...req.body,
      seller: req.user.userId,
      priceHistory: [{ price: req.body.askingPrice, date: new Date() }]
    };

    const property = new Property(propertyData);
    await property.save();

    res.status(201).json(property);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @route PUT /properties/:id
 * @desc Update a property
 * @access Private (owner only)
 */
router.put('/:id', authMiddleware, idValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Check ownership
    if (property.seller.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to update this property' });
    }

    // Track price changes
    if (req.body.askingPrice && req.body.askingPrice !== property.askingPrice) {
      property.priceHistory.push({
        price: req.body.askingPrice,
        date: new Date()
      });
    }

    // Update fields
    const allowedUpdates = [
      'address', 'legalDescription', 'propertyType', 'bedrooms', 'bathrooms',
      'squareFeet', 'lotSize', 'lotSizeUnit', 'yearBuilt', 'parkingSpaces',
      'parkingType', 'condoInfo', 'askingPrice', 'features', 'amenities',
      'appliances', 'heatingType', 'coolingType', 'basement', 'virtualTourUrl',
      'floorPlanUrl', 'description', 'highlights', 'propertyTaxes', 'assessedValue'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        property[field] = req.body[field];
      }
    });

    await property.save();
    res.json(property);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @route DELETE /properties/:id
 * @desc Delete a property
 * @access Private (owner only)
 */
router.delete('/:id', authMiddleware, idValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Check ownership
    if (property.seller.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this property' });
    }

    // Don't allow deletion if property has active transactions
    if (property.status === 'pending' || property.status === 'sold') {
      return res.status(400).json({ error: 'Cannot delete property with pending or completed transactions' });
    }

    await Property.findByIdAndDelete(req.params.id);
    res.json({ message: 'Property deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route PATCH /properties/:id/status
 * @desc Update property status
 * @access Private (owner only)
 */
router.patch('/:id/status', authMiddleware, idValidation, [
  body('status').isIn(['draft', 'active', 'pending', 'sold', 'withdrawn', 'expired'])
    .withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    if (property.seller.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    property.status = req.body.status;
    await property.save();

    res.json(property);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @route POST /properties/:id/photos
 * @desc Add photos to property
 * @access Private (owner only)
 */
router.post('/:id/photos', authMiddleware, idValidation, [
  body('photos').isArray().withMessage('Photos must be an array'),
  body('photos.*.url').isURL().withMessage('Valid photo URL required'),
  body('photos.*.caption').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    if (property.seller.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Add new photos
    const newPhotos = req.body.photos.map(photo => ({
      url: photo.url,
      caption: photo.caption || '',
      isPrimary: property.photos.length === 0 && !photo.isPrimary ? true : photo.isPrimary || false,
      uploadedAt: new Date()
    }));

    property.photos.push(...newPhotos);
    await property.save();

    res.json(property.photos);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
