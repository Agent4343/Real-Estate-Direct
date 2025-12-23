const express = require('express');
const router = express.Router();
const Professional = require('../models/professional.model');
const authMiddleware = require('../auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');
const { body, validationResult, query } = require('express-validator');

// Category display names
const CATEGORY_NAMES = {
  'lawyer': 'Real Estate Lawyers',
  'notary': 'Notaries',
  'inspector': 'Home Inspectors',
  'appraiser': 'Property Appraisers',
  'mortgage_broker': 'Mortgage Brokers',
  'photographer': 'Real Estate Photographers',
  'stager': 'Home Stagers',
  'mover': 'Moving Companies',
  'cleaner': 'Cleaning Services',
  'contractor': 'General Contractors',
  'surveyor': 'Land Surveyors',
  'insurance': 'Insurance Agents'
};

// Get all categories
router.get('/categories', (req, res) => {
  res.json(Object.entries(CATEGORY_NAMES).map(([value, label]) => ({ value, label })));
});

// Search professionals
router.get('/search', async (req, res) => {
  try {
    const {
      category,
      province,
      city,
      q, // search query
      featured,
      verified,
      minRating,
      page = 1,
      limit = 20,
      sort = 'rating' // rating, name, reviews
    } = req.query;

    const query = { status: 'active' };

    if (category) query.category = category;
    if (province) query['location.province'] = province;
    if (city) query['location.city'] = new RegExp(city, 'i');
    if (featured === 'true') query.featured = true;
    if (verified === 'true') query.verified = true;
    if (minRating) query['rating.average'] = { $gte: parseFloat(minRating) };

    // Text search
    if (q) {
      query.$text = { $search: q };
    }

    // Sorting
    let sortOption = {};
    switch (sort) {
      case 'rating':
        sortOption = { 'rating.average': -1, 'rating.count': -1 };
        break;
      case 'reviews':
        sortOption = { 'rating.count': -1 };
        break;
      case 'name':
        sortOption = { name: 1 };
        break;
      default:
        sortOption = { featured: -1, 'rating.average': -1 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [professionals, total] = await Promise.all([
      Professional.find(query)
        .select('-reviews') // Don't include full reviews in list
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit)),
      Professional.countDocuments(query)
    ]);

    res.json({
      professionals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error searching professionals:', err);
    res.status(500).json({ error: 'Failed to search professionals' });
  }
});

// Get featured professionals (for homepage)
router.get('/featured', async (req, res) => {
  try {
    const { province, limit = 6 } = req.query;

    const query = {
      status: 'active',
      featured: true
    };

    if (province) query['location.province'] = province;

    const professionals = await Professional.find(query)
      .select('name companyName category location rating logo verified isPartner referralDiscount')
      .sort({ 'rating.average': -1 })
      .limit(parseInt(limit));

    res.json(professionals);
  } catch (err) {
    console.error('Error fetching featured professionals:', err);
    res.status(500).json({ error: 'Failed to fetch featured professionals' });
  }
});

// Get professional by ID
router.get('/:id', async (req, res) => {
  try {
    const professional = await Professional.findById(req.params.id)
      .populate('reviews.user', 'name');

    if (!professional) {
      return res.status(404).json({ error: 'Professional not found' });
    }

    // Increment profile views
    professional.profileViews += 1;
    await professional.save();

    res.json(professional);
  } catch (err) {
    console.error('Error fetching professional:', err);
    res.status(500).json({ error: 'Failed to fetch professional' });
  }
});

// Track contact click
router.post('/:id/contact-click', async (req, res) => {
  try {
    await Professional.findByIdAndUpdate(req.params.id, {
      $inc: { contactClicks: 1 }
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Error tracking contact click:', err);
    res.status(500).json({ error: 'Failed to track contact' });
  }
});

// Submit a review (authenticated users only)
router.post('/:id/review', authMiddleware, [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('comment').optional().isLength({ max: 1000 }).withMessage('Comment too long'),
  body('title').optional().isLength({ max: 100 }).withMessage('Title too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const professional = await Professional.findById(req.params.id);
    if (!professional) {
      return res.status(404).json({ error: 'Professional not found' });
    }

    // Check if user already reviewed
    const existingReview = professional.reviews.find(
      r => r.user && r.user.toString() === req.user.userId
    );

    if (existingReview) {
      return res.status(400).json({ error: 'You have already reviewed this professional' });
    }

    const { rating, title, comment, propertyType } = req.body;

    professional.reviews.push({
      user: req.user.userId,
      userName: req.user.name || 'Anonymous',
      rating,
      title,
      comment,
      propertyType,
      verified: false // Can be set to true if linked to transaction
    });

    // Update average rating
    professional.updateRating();
    await professional.save();

    res.status(201).json({
      message: 'Review submitted successfully',
      rating: professional.rating
    });
  } catch (err) {
    console.error('Error submitting review:', err);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// Suggest a professional (user submission)
router.post('/suggest', authMiddleware, [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('category').isIn(Object.keys(CATEGORY_NAMES)).withMessage('Invalid category'),
  body('location.city').notEmpty().withMessage('City is required'),
  body('location.province').notEmpty().withMessage('Province is required'),
  body('contact.phone').notEmpty().withMessage('Phone is required'),
  body('contact.email').isEmail().withMessage('Valid email required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const professionalData = {
      ...req.body,
      status: 'pending', // Requires admin approval
      addedBy: req.user.userId
    };

    const professional = new Professional(professionalData);
    await professional.save();

    res.status(201).json({
      message: 'Thank you! Your suggestion has been submitted for review.',
      id: professional._id
    });
  } catch (err) {
    console.error('Error suggesting professional:', err);
    res.status(500).json({ error: 'Failed to submit suggestion' });
  }
});

// ============================================
// Admin Routes
// ============================================

// Get all professionals (admin)
router.get('/admin/all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, category, page = 1, limit = 50 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [professionals, total] = await Promise.all([
      Professional.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Professional.countDocuments(query)
    ]);

    res.json({
      professionals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error fetching professionals:', err);
    res.status(500).json({ error: 'Failed to fetch professionals' });
  }
});

// Create professional (admin)
router.post('/admin/create', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const professional = new Professional({
      ...req.body,
      status: 'active',
      addedBy: req.user.userId
    });

    await professional.save();

    res.status(201).json({
      message: 'Professional created successfully',
      professional
    });
  } catch (err) {
    console.error('Error creating professional:', err);
    res.status(500).json({ error: 'Failed to create professional' });
  }
});

// Update professional (admin)
router.put('/admin/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const professional = await Professional.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!professional) {
      return res.status(404).json({ error: 'Professional not found' });
    }

    res.json({
      message: 'Professional updated successfully',
      professional
    });
  } catch (err) {
    console.error('Error updating professional:', err);
    res.status(500).json({ error: 'Failed to update professional' });
  }
});

// Approve pending professional (admin)
router.put('/admin/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const professional = await Professional.findByIdAndUpdate(
      req.params.id,
      {
        status: 'active',
        verified: req.body.verified || false,
        verifiedAt: req.body.verified ? new Date() : null
      },
      { new: true }
    );

    if (!professional) {
      return res.status(404).json({ error: 'Professional not found' });
    }

    res.json({
      message: 'Professional approved successfully',
      professional
    });
  } catch (err) {
    console.error('Error approving professional:', err);
    res.status(500).json({ error: 'Failed to approve professional' });
  }
});

// Delete professional (admin)
router.delete('/admin/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const professional = await Professional.findByIdAndDelete(req.params.id);

    if (!professional) {
      return res.status(404).json({ error: 'Professional not found' });
    }

    res.json({ message: 'Professional deleted successfully' });
  } catch (err) {
    console.error('Error deleting professional:', err);
    res.status(500).json({ error: 'Failed to delete professional' });
  }
});

// Toggle featured status (admin)
router.put('/admin/:id/featured', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const professional = await Professional.findById(req.params.id);

    if (!professional) {
      return res.status(404).json({ error: 'Professional not found' });
    }

    professional.featured = !professional.featured;
    await professional.save();

    res.json({
      message: `Professional ${professional.featured ? 'featured' : 'unfeatured'}`,
      featured: professional.featured
    });
  } catch (err) {
    console.error('Error toggling featured:', err);
    res.status(500).json({ error: 'Failed to update featured status' });
  }
});

// Respond to a review (professional owner - future feature)
router.put('/:professionalId/review/:reviewId/respond', authMiddleware, async (req, res) => {
  try {
    // This would need professional account linking in future
    // For now, admin only
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { text } = req.body;

    const professional = await Professional.findOneAndUpdate(
      {
        _id: req.params.professionalId,
        'reviews._id': req.params.reviewId
      },
      {
        $set: {
          'reviews.$.response': {
            text,
            respondedAt: new Date()
          }
        }
      },
      { new: true }
    );

    if (!professional) {
      return res.status(404).json({ error: 'Professional or review not found' });
    }

    res.json({ message: 'Response added successfully' });
  } catch (err) {
    console.error('Error responding to review:', err);
    res.status(500).json({ error: 'Failed to respond to review' });
  }
});

module.exports = router;
