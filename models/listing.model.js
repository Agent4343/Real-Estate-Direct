const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Listing Agreement
  listingAgreement: {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document'
    },
    signedAt: { type: Date },
    commissionRate: { type: Number }, // percentage
    commissionType: {
      type: String,
      enum: ['percentage', 'flat_fee', 'none'],
      default: 'none'
    },
    flatFeeAmount: { type: Number }
  },

  // Listing Period
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },

  // Listing Type
  listingType: {
    type: String,
    enum: ['exclusive', 'open', 'fsbo'], // For Sale By Owner
    default: 'fsbo'
  },

  // Status
  status: {
    type: String,
    enum: ['draft', 'active', 'pending', 'sold', 'expired', 'withdrawn', 'cancelled'],
    default: 'draft'
  },

  // Showing Instructions
  showingInstructions: {
    type: String,
    maxlength: 1000
  },
  showingContact: {
    name: { type: String },
    phone: { type: String },
    email: { type: String }
  },
  showingAvailability: [{
    dayOfWeek: { type: Number, min: 0, max: 6 }, // 0 = Sunday
    startTime: { type: String }, // "09:00"
    endTime: { type: String }    // "17:00"
  }],
  lockboxCode: { type: String },

  // Marketing
  allowPhotography: { type: Boolean, default: true },
  allowVirtualTour: { type: Boolean, default: true },
  allowOpenHouse: { type: Boolean, default: true },

  // Statistics
  views: { type: Number, default: 0 },
  saves: { type: Number, default: 0 },
  inquiries: { type: Number, default: 0 },
  showings: { type: Number, default: 0 },

  // Offers tracking
  offersReceived: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer'
  }],

  // Sold Information (populated when sold)
  soldInfo: {
    soldPrice: { type: Number },
    soldDate: { type: Date },
    daysOnMarket: { type: Number },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    }
  }
}, {
  timestamps: true
});

// Indexes
listingSchema.index({ property: 1 });
listingSchema.index({ seller: 1 });
listingSchema.index({ status: 1, startDate: 1, endDate: 1 });

// Check if listing is active
listingSchema.methods.isActive = function() {
  const now = new Date();
  return this.status === 'active' &&
         this.startDate <= now &&
         this.endDate >= now;
};

// Calculate days on market
listingSchema.methods.getDaysOnMarket = function() {
  const start = this.startDate;
  const end = this.soldInfo?.soldDate || new Date();
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

module.exports = mongoose.model('Listing', listingSchema);
