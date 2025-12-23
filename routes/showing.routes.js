const express = require('express');
const router = express.Router();
const Showing = require('../models/showing.model');
const Property = require('../models/property.model');
const User = require('../models/user.model');
const authMiddleware = require('../auth.middleware');
const { body, validationResult } = require('express-validator');
const emailService = require('../services/email.service');

// Validation for showing request
const showingValidation = [
  body('propertyId').isMongoId().withMessage('Valid property ID required'),
  body('requestedDate').isISO8601().withMessage('Valid date required'),
  body('timeSlot.start').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid start time required'),
  body('timeSlot.end').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid end time required'),
  body('buyerMessage').optional().isLength({ max: 500 }).withMessage('Message too long')
];

// Request a showing (buyer)
router.post('/request', authMiddleware, showingValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { propertyId, requestedDate, timeSlot, buyerMessage, buyerPhone } = req.body;

    // Get the property
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    if (property.status !== 'active') {
      return res.status(400).json({ error: 'Property is not available for showings' });
    }

    // Can't request showing on your own property
    if (property.seller.toString() === req.user.userId) {
      return res.status(400).json({ error: 'Cannot request showing on your own property' });
    }

    // Check for existing showing at same time
    const existingShowing = await Showing.findOne({
      property: propertyId,
      requestedDate: new Date(requestedDate),
      'timeSlot.start': timeSlot.start,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingShowing) {
      return res.status(400).json({ error: 'This time slot is already booked' });
    }

    // Create the showing request
    const showing = new Showing({
      property: propertyId,
      buyer: req.user.userId,
      seller: property.seller,
      requestedDate: new Date(requestedDate),
      timeSlot,
      buyerMessage,
      buyerPhone
    });

    await showing.save();

    // Notify seller
    const seller = await User.findById(property.seller);
    if (seller && seller.email) {
      try {
        await emailService.sendEmail({
          to: seller.email,
          subject: 'New Showing Request - Real Estate Direct',
          html: `
            <h2>New Showing Request</h2>
            <p>You have a new showing request for your property at:</p>
            <p><strong>${property.address.street}, ${property.address.city}</strong></p>
            <p><strong>Requested Date:</strong> ${new Date(requestedDate).toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong>Time:</strong> ${timeSlot.start} - ${timeSlot.end}</p>
            ${buyerMessage ? `<p><strong>Message from buyer:</strong> ${buyerMessage}</p>` : ''}
            <p>Log in to your dashboard to approve or decline this request.</p>
          `
        });
      } catch (emailErr) {
        console.error('Failed to send showing notification:', emailErr);
      }
    }

    res.status(201).json({
      message: 'Showing request submitted successfully',
      showing: await showing.populate('property', 'address askingPrice')
    });
  } catch (err) {
    console.error('Error requesting showing:', err);
    res.status(500).json({ error: 'Failed to submit showing request' });
  }
});

// Get showings for a property (seller)
router.get('/property/:propertyId', authMiddleware, async (req, res) => {
  try {
    const property = await Property.findById(req.params.propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Only property owner can see all showings
    if (property.seller.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const showings = await Showing.find({ property: req.params.propertyId })
      .populate('buyer', 'name email phone')
      .sort({ requestedDate: 1, 'timeSlot.start': 1 });

    res.json(showings);
  } catch (err) {
    console.error('Error fetching showings:', err);
    res.status(500).json({ error: 'Failed to fetch showings' });
  }
});

// Get my showing requests (buyer)
router.get('/my-requests', authMiddleware, async (req, res) => {
  try {
    const showings = await Showing.find({ buyer: req.user.userId })
      .populate('property', 'address askingPrice images')
      .populate('seller', 'name')
      .sort({ requestedDate: -1 });

    res.json(showings);
  } catch (err) {
    console.error('Error fetching showings:', err);
    res.status(500).json({ error: 'Failed to fetch showings' });
  }
});

// Get showings I need to respond to (seller)
router.get('/my-properties', authMiddleware, async (req, res) => {
  try {
    const showings = await Showing.find({ seller: req.user.userId })
      .populate('property', 'address askingPrice')
      .populate('buyer', 'name email phone')
      .sort({ requestedDate: 1 });

    res.json(showings);
  } catch (err) {
    console.error('Error fetching showings:', err);
    res.status(500).json({ error: 'Failed to fetch showings' });
  }
});

// Approve showing (seller)
router.put('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const showing = await Showing.findById(req.params.id)
      .populate('property', 'address')
      .populate('buyer', 'name email');

    if (!showing) {
      return res.status(404).json({ error: 'Showing not found' });
    }

    if (showing.seller.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (showing.status !== 'pending') {
      return res.status(400).json({ error: 'Showing has already been processed' });
    }

    showing.status = 'approved';
    showing.respondedAt = new Date();
    showing.sellerMessage = req.body.message || '';
    await showing.save();

    // Notify buyer
    if (showing.buyer && showing.buyer.email) {
      try {
        await emailService.sendEmail({
          to: showing.buyer.email,
          subject: 'Showing Approved - Real Estate Direct',
          html: `
            <h2>Your Showing Request Has Been Approved!</h2>
            <p>Great news! Your showing request has been approved for:</p>
            <p><strong>${showing.property.address.street}, ${showing.property.address.city}</strong></p>
            <p><strong>Date:</strong> ${showing.formattedDate}</p>
            <p><strong>Time:</strong> ${showing.timeSlot.start} - ${showing.timeSlot.end}</p>
            ${showing.sellerMessage ? `<p><strong>Message from seller:</strong> ${showing.sellerMessage}</p>` : ''}
            <p>Please arrive on time. The seller is expecting you!</p>
          `
        });
      } catch (emailErr) {
        console.error('Failed to send approval notification:', emailErr);
      }
    }

    res.json({ message: 'Showing approved', showing });
  } catch (err) {
    console.error('Error approving showing:', err);
    res.status(500).json({ error: 'Failed to approve showing' });
  }
});

// Reject showing (seller)
router.put('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const showing = await Showing.findById(req.params.id)
      .populate('property', 'address')
      .populate('buyer', 'name email');

    if (!showing) {
      return res.status(404).json({ error: 'Showing not found' });
    }

    if (showing.seller.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (showing.status !== 'pending') {
      return res.status(400).json({ error: 'Showing has already been processed' });
    }

    showing.status = 'rejected';
    showing.respondedAt = new Date();
    showing.sellerMessage = req.body.message || '';

    // If alternative time proposed
    if (req.body.alternativeTime) {
      showing.alternativeTime = req.body.alternativeTime;
    }

    await showing.save();

    // Notify buyer
    if (showing.buyer && showing.buyer.email) {
      try {
        let alternativeText = '';
        if (showing.alternativeTime && showing.alternativeTime.date) {
          alternativeText = `
            <p><strong>The seller has proposed an alternative time:</strong></p>
            <p>Date: ${new Date(showing.alternativeTime.date).toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p>Time: ${showing.alternativeTime.start} - ${showing.alternativeTime.end}</p>
          `;
        }

        await emailService.sendEmail({
          to: showing.buyer.email,
          subject: 'Showing Request Update - Real Estate Direct',
          html: `
            <h2>Showing Request Update</h2>
            <p>Unfortunately, your showing request could not be accommodated for:</p>
            <p><strong>${showing.property.address.street}, ${showing.property.address.city}</strong></p>
            <p><strong>Requested Date:</strong> ${showing.formattedDate}</p>
            <p><strong>Time:</strong> ${showing.timeSlot.start} - ${showing.timeSlot.end}</p>
            ${showing.sellerMessage ? `<p><strong>Message from seller:</strong> ${showing.sellerMessage}</p>` : ''}
            ${alternativeText}
            <p>You can request a different time through the platform.</p>
          `
        });
      } catch (emailErr) {
        console.error('Failed to send rejection notification:', emailErr);
      }
    }

    res.json({ message: 'Showing declined', showing });
  } catch (err) {
    console.error('Error rejecting showing:', err);
    res.status(500).json({ error: 'Failed to decline showing' });
  }
});

// Cancel showing (buyer or seller)
router.put('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const showing = await Showing.findById(req.params.id)
      .populate('property', 'address')
      .populate('buyer', 'name email')
      .populate('seller', 'name email');

    if (!showing) {
      return res.status(404).json({ error: 'Showing not found' });
    }

    const isBuyer = showing.buyer._id.toString() === req.user.userId;
    const isSeller = showing.seller._id.toString() === req.user.userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!['pending', 'approved'].includes(showing.status)) {
      return res.status(400).json({ error: 'Cannot cancel this showing' });
    }

    showing.status = 'cancelled';
    showing.cancelledAt = new Date();
    showing.cancelledBy = isBuyer ? 'buyer' : 'seller';
    showing.cancellationReason = req.body.reason || '';
    await showing.save();

    // Notify the other party
    const recipient = isBuyer ? showing.seller : showing.buyer;
    const cancelledBy = isBuyer ? 'buyer' : 'seller';

    if (recipient && recipient.email) {
      try {
        await emailService.sendEmail({
          to: recipient.email,
          subject: 'Showing Cancelled - Real Estate Direct',
          html: `
            <h2>Showing Cancelled</h2>
            <p>A showing has been cancelled by the ${cancelledBy}:</p>
            <p><strong>${showing.property.address.street}, ${showing.property.address.city}</strong></p>
            <p><strong>Date:</strong> ${showing.formattedDate}</p>
            <p><strong>Time:</strong> ${showing.timeSlot.start} - ${showing.timeSlot.end}</p>
            ${showing.cancellationReason ? `<p><strong>Reason:</strong> ${showing.cancellationReason}</p>` : ''}
          `
        });
      } catch (emailErr) {
        console.error('Failed to send cancellation notification:', emailErr);
      }
    }

    res.json({ message: 'Showing cancelled', showing });
  } catch (err) {
    console.error('Error cancelling showing:', err);
    res.status(500).json({ error: 'Failed to cancel showing' });
  }
});

// Mark showing as completed (seller)
router.put('/:id/complete', authMiddleware, async (req, res) => {
  try {
    const showing = await Showing.findById(req.params.id);

    if (!showing) {
      return res.status(404).json({ error: 'Showing not found' });
    }

    if (showing.seller.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (showing.status !== 'approved') {
      return res.status(400).json({ error: 'Can only complete approved showings' });
    }

    showing.status = 'completed';
    await showing.save();

    res.json({ message: 'Showing marked as completed', showing });
  } catch (err) {
    console.error('Error completing showing:', err);
    res.status(500).json({ error: 'Failed to complete showing' });
  }
});

// Mark as no-show (seller)
router.put('/:id/no-show', authMiddleware, async (req, res) => {
  try {
    const showing = await Showing.findById(req.params.id);

    if (!showing) {
      return res.status(404).json({ error: 'Showing not found' });
    }

    if (showing.seller.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (showing.status !== 'approved') {
      return res.status(400).json({ error: 'Can only mark approved showings as no-show' });
    }

    showing.status = 'no_show';
    await showing.save();

    res.json({ message: 'Showing marked as no-show', showing });
  } catch (err) {
    console.error('Error marking no-show:', err);
    res.status(500).json({ error: 'Failed to update showing' });
  }
});

// Submit feedback after showing (buyer)
router.post('/:id/feedback', authMiddleware, async (req, res) => {
  try {
    const showing = await Showing.findById(req.params.id);

    if (!showing) {
      return res.status(404).json({ error: 'Showing not found' });
    }

    if (showing.buyer.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (showing.status !== 'completed') {
      return res.status(400).json({ error: 'Can only submit feedback for completed showings' });
    }

    const { rating, interested, comments } = req.body;

    showing.feedback = {
      rating: rating || null,
      interested: interested || false,
      comments: comments || '',
      submittedAt: new Date()
    };

    await showing.save();

    res.json({ message: 'Feedback submitted', showing });
  } catch (err) {
    console.error('Error submitting feedback:', err);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// Get available time slots for a property on a specific date
router.get('/available-slots/:propertyId/:date', async (req, res) => {
  try {
    const { propertyId, date } = req.params;

    const property = await Property.findById(propertyId);
    if (!property || property.status !== 'active') {
      return res.status(404).json({ error: 'Property not available' });
    }

    // Get already booked slots for this date
    const bookedShowings = await Showing.find({
      property: propertyId,
      requestedDate: new Date(date),
      status: { $in: ['pending', 'approved'] }
    });

    const bookedSlots = bookedShowings.map(s => s.timeSlot.start);

    // Generate available 30-minute slots from 9am to 7pm
    const allSlots = [];
    for (let hour = 9; hour < 19; hour++) {
      allSlots.push(`${hour.toString().padStart(2, '0')}:00`);
      allSlots.push(`${hour.toString().padStart(2, '0')}:30`);
    }

    const availableSlots = allSlots.filter(slot => !bookedSlots.includes(slot));

    res.json({
      date,
      availableSlots: availableSlots.map(start => ({
        start,
        end: getEndTime(start)
      }))
    });
  } catch (err) {
    console.error('Error fetching available slots:', err);
    res.status(500).json({ error: 'Failed to fetch available slots' });
  }
});

// Helper to calculate end time (30 min after start)
function getEndTime(startTime) {
  const [hours, minutes] = startTime.split(':').map(Number);
  let endMinutes = minutes + 30;
  let endHours = hours;
  if (endMinutes >= 60) {
    endMinutes -= 60;
    endHours += 1;
  }
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
}

module.exports = router;
