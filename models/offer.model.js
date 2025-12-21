const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    required: true
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Offer Details
  offerPrice: {
    type: Number,
    required: true,
    min: 0
  },
  depositAmount: {
    type: Number,
    required: true,
    min: 0
  },
  depositDueDate: {
    type: Date,
    required: true
  },
  depositHeldBy: {
    type: String,
    enum: ['seller_lawyer', 'buyer_lawyer', 'brokerage', 'other'],
    default: 'seller_lawyer'
  },

  // Dates
  closingDate: {
    type: Date,
    required: true
  },
  possessionDate: {
    type: Date
  },
  irrevocableDate: {
    type: Date,
    required: true
  },

  // Conditions
  conditions: [{
    type: {
      type: String,
      enum: ['financing', 'inspection', 'status_certificate', 'sale_of_property', 'appraisal', 'lawyer_review', 'other'],
      required: true
    },
    description: { type: String },
    deadlineDays: { type: Number, required: true }, // days from acceptance
    status: {
      type: String,
      enum: ['pending', 'fulfilled', 'waived', 'failed'],
      default: 'pending'
    }
  }],

  // Inclusions and Exclusions
  inclusions: [{
    type: String
  }],
  exclusions: [{
    type: String
  }],

  // Rental Items (chattels that can be rented)
  rentalItems: [{
    item: { type: String },
    monthlyRent: { type: Number }
  }],

  // Financing Details
  financing: {
    type: {
      type: String,
      enum: ['conventional', 'insured', 'cash', 'assumption', 'vtb'], // VTB = Vendor Take Back
      default: 'conventional'
    },
    downPaymentAmount: { type: Number },
    downPaymentPercentage: { type: Number },
    mortgageAmount: { type: Number },
    preApproved: { type: Boolean, default: false },
    preApprovalAmount: { type: Number },
    lenderName: { type: String }
  },

  // Status
  status: {
    type: String,
    enum: ['draft', 'submitted', 'viewed', 'accepted', 'rejected', 'countered', 'withdrawn', 'expired'],
    default: 'draft'
  },

  // Counter-offer chain
  parentOffer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer'
  },
  counterOffers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer'
  }],
  isCounterOffer: {
    type: Boolean,
    default: false
  },

  // Documents
  offerDocument: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  },

  // Signatures
  buyerSignature: {
    signed: { type: Boolean, default: false },
    signedAt: { type: Date },
    signatureData: { type: String } // base64 or signature ID
  },
  sellerSignature: {
    signed: { type: Boolean, default: false },
    signedAt: { type: Date },
    signatureData: { type: String }
  },

  // Additional Terms
  additionalTerms: {
    type: String,
    maxlength: 5000
  },

  // Buyer's Lawyer
  buyerLawyer: {
    name: { type: String },
    firm: { type: String },
    phone: { type: String },
    email: { type: String },
    address: { type: String }
  },

  // GST/HST
  gstIncluded: { type: Boolean, default: true },

  // Province (for form selection)
  province: {
    type: String,
    required: true,
    enum: ['ON', 'BC', 'AB', 'QC', 'MB', 'SK', 'NS', 'NB', 'PE', 'NL', 'YT', 'NT', 'NU']
  },

  // Timestamps for tracking
  submittedAt: { type: Date },
  viewedAt: { type: Date },
  respondedAt: { type: Date }
}, {
  timestamps: true
});

// Indexes
offerSchema.index({ property: 1, status: 1 });
offerSchema.index({ buyer: 1 });
offerSchema.index({ seller: 1 });
offerSchema.index({ listing: 1 });
offerSchema.index({ parentOffer: 1 });

// Check if offer is expired
offerSchema.methods.isExpired = function() {
  return new Date() > this.irrevocableDate && this.status === 'submitted';
};

// Check if all conditions are resolved
offerSchema.methods.areConditionsResolved = function() {
  return this.conditions.every(c =>
    c.status === 'fulfilled' || c.status === 'waived'
  );
};

// Check if any condition failed
offerSchema.methods.hasFailedCondition = function() {
  return this.conditions.some(c => c.status === 'failed');
};

module.exports = mongoose.model('Offer', offerSchema);
