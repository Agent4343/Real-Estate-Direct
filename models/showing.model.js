const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const showingSchema = new Schema({
  // Property being shown
  property: {
    type: Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
    index: true
  },

  // Buyer requesting the showing
  buyer: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Seller who owns the property
  seller: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Requested date and time
  requestedDate: {
    type: Date,
    required: true
  },

  // Time slot (30-minute increments)
  timeSlot: {
    start: { type: String, required: true }, // e.g., "10:00"
    end: { type: String, required: true }    // e.g., "10:30"
  },

  // Status of the showing request
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed', 'no_show'],
    default: 'pending',
    index: true
  },

  // Message from buyer when requesting
  buyerMessage: {
    type: String,
    maxlength: 500
  },

  // Seller's response message
  sellerMessage: {
    type: String,
    maxlength: 500
  },

  // Contact info for showing
  buyerPhone: {
    type: String
  },

  // If seller proposed alternative time
  alternativeTime: {
    date: { type: Date },
    start: { type: String },
    end: { type: String }
  },

  // Feedback after showing
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    interested: { type: Boolean },
    comments: { type: String, maxlength: 1000 },
    submittedAt: { type: Date }
  },

  // Timestamps for status changes
  respondedAt: { type: Date },
  cancelledAt: { type: Date },
  cancelledBy: { type: String, enum: ['buyer', 'seller'] },
  cancellationReason: { type: String },

  // Reminder sent
  reminderSent: { type: Boolean, default: false }

}, {
  timestamps: true
});

// Compound indexes for common queries
showingSchema.index({ property: 1, requestedDate: 1 });
showingSchema.index({ seller: 1, status: 1, requestedDate: 1 });
showingSchema.index({ buyer: 1, status: 1 });
showingSchema.index({ requestedDate: 1, status: 1 });

// Virtual for formatted date
showingSchema.virtual('formattedDate').get(function() {
  return this.requestedDate.toLocaleDateString('en-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Virtual for formatted time
showingSchema.virtual('formattedTime').get(function() {
  return `${this.timeSlot.start} - ${this.timeSlot.end}`;
});

showingSchema.set('toJSON', { virtuals: true });
showingSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Showing', showingSchema);
