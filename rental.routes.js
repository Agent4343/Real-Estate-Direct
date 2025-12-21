const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { Rental } = require('./rental.model');
const Item = require('./item.model');
const authMiddleware = require('./auth.middleware');

// Validation middleware
const rentalValidation = [
  body('itemId').isMongoId().withMessage('Valid item ID is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('endDate').custom((value, { req }) => {
    if (new Date(value) <= new Date(req.body.startDate)) {
      throw new Error('End date must be after start date');
    }
    return true;
  })
];

const idValidation = [
  param('id').isMongoId().withMessage('Invalid rental ID')
];

// Get all rentals for authenticated user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const rentals = await Rental.find({ userId: req.user.userId })
      .populate('itemId', 'name description price');
    res.json(rentals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single rental
router.get('/:id', authMiddleware, idValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const rental = await Rental.findOne({
      _id: req.params.id,
      userId: req.user.userId
    }).populate('itemId', 'name description price');

    if (!rental) {
      return res.status(404).json({ error: 'Rental not found' });
    }
    res.json(rental);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a rental
router.post('/', authMiddleware, rentalValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Verify item exists
    const item = await Item.findById(req.body.itemId);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Calculate total price based on rental duration
    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const totalPrice = item.price * days;

    const rental = new Rental({
      userId: req.user.userId,
      itemId: req.body.itemId,
      startDate,
      endDate,
      totalPrice
    });

    const newRental = await rental.save();
    await newRental.populate('itemId', 'name description price');
    res.status(201).json(newRental);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Cancel a rental
router.delete('/:id', authMiddleware, idValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const rental = await Rental.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!rental) {
      return res.status(404).json({ error: 'Rental not found' });
    }
    res.json({ message: 'Rental cancelled successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
