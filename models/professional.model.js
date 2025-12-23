const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const professionalSchema = new Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    index: true
  },

  companyName: {
    type: String
  },

  // Service Category
  category: {
    type: String,
    required: true,
    enum: [
      'lawyer',           // Real estate lawyers
      'notary',           // Notaries (especially for Quebec)
      'inspector',        // Home inspectors
      'appraiser',        // Property appraisers
      'mortgage_broker',  // Mortgage brokers
      'photographer',     // Real estate photographers
      'stager',           // Home stagers
      'mover',            // Moving companies
      'cleaner',          // Cleaning services
      'contractor',       // General contractors
      'surveyor',         // Land surveyors
      'insurance'         // Home insurance agents
    ],
    index: true
  },

  // Specializations within category
  specializations: [{
    type: String
  }],

  // Location
  location: {
    city: { type: String, required: true, index: true },
    province: {
      type: String,
      required: true,
      enum: ['ON', 'BC', 'AB', 'QC', 'MB', 'SK', 'NS', 'NB', 'PE', 'NL', 'YT', 'NT', 'NU'],
      index: true
    },
    postalCode: { type: String },
    address: { type: String },
    // Service radius in km
    serviceRadius: { type: Number, default: 50 }
  },

  // Areas served (cities/regions)
  areasServed: [{
    type: String
  }],

  // Contact Information
  contact: {
    phone: { type: String, required: true },
    email: { type: String, required: true },
    website: { type: String },
    alternatePhone: { type: String }
  },

  // Business Hours
  businessHours: {
    monday: { open: String, close: String, closed: { type: Boolean, default: false } },
    tuesday: { open: String, close: String, closed: { type: Boolean, default: false } },
    wednesday: { open: String, close: String, closed: { type: Boolean, default: false } },
    thursday: { open: String, close: String, closed: { type: Boolean, default: false } },
    friday: { open: String, close: String, closed: { type: Boolean, default: false } },
    saturday: { open: String, close: String, closed: { type: Boolean, default: true } },
    sunday: { open: String, close: String, closed: { type: Boolean, default: true } }
  },

  // Professional Details
  licenseNumber: { type: String },
  insuranceVerified: { type: Boolean, default: false },
  yearsInBusiness: { type: Number },
  languages: [{ type: String }],

  // Description and Services
  description: {
    type: String,
    maxlength: 2000
  },

  services: [{
    name: { type: String },
    description: { type: String },
    priceRange: { type: String } // e.g., "$300-$500" or "From $150"
  }],

  // Media
  logo: { type: String },
  photos: [{ type: String }],

  // Reviews and Ratings
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },

  reviews: [{
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String },
    comment: { type: String, maxlength: 1000 },
    propertyType: { type: String }, // What type of property was the service for
    verified: { type: Boolean, default: false }, // Verified through platform transaction
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
    createdAt: { type: Date, default: Date.now },
    response: {
      text: { type: String },
      respondedAt: { type: Date }
    }
  }],

  // Platform Integration
  featured: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
  verifiedAt: { type: Date },

  // Partnership/Referral
  isPartner: { type: Boolean, default: false },
  referralCode: { type: String },
  referralDiscount: { type: String }, // e.g., "10% off for Real Estate Direct users"

  // Stats
  profileViews: { type: Number, default: 0 },
  contactClicks: { type: Number, default: 0 },
  referralsCount: { type: Number, default: 0 },

  // Status
  status: {
    type: String,
    enum: ['active', 'pending', 'suspended', 'inactive'],
    default: 'pending',
    index: true
  },

  // Who added this professional
  addedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }

}, {
  timestamps: true
});

// Compound indexes
professionalSchema.index({ category: 1, 'location.province': 1, status: 1 });
professionalSchema.index({ category: 1, 'location.city': 1, status: 1 });
professionalSchema.index({ 'rating.average': -1, 'rating.count': -1 });
professionalSchema.index({ featured: 1, status: 1 });

// Text search index
professionalSchema.index({
  name: 'text',
  companyName: 'text',
  description: 'text',
  'services.name': 'text'
});

// Method to update rating after new review
professionalSchema.methods.updateRating = function() {
  if (this.reviews.length === 0) {
    this.rating.average = 0;
    this.rating.count = 0;
  } else {
    const sum = this.reviews.reduce((acc, review) => acc + review.rating, 0);
    this.rating.average = Math.round((sum / this.reviews.length) * 10) / 10;
    this.rating.count = this.reviews.length;
  }
};

// Virtual for display category name
professionalSchema.virtual('categoryDisplay').get(function() {
  const categoryNames = {
    'lawyer': 'Real Estate Lawyer',
    'notary': 'Notary',
    'inspector': 'Home Inspector',
    'appraiser': 'Property Appraiser',
    'mortgage_broker': 'Mortgage Broker',
    'photographer': 'Real Estate Photographer',
    'stager': 'Home Stager',
    'mover': 'Moving Company',
    'cleaner': 'Cleaning Service',
    'contractor': 'General Contractor',
    'surveyor': 'Land Surveyor',
    'insurance': 'Insurance Agent'
  };
  return categoryNames[this.category] || this.category;
});

professionalSchema.set('toJSON', { virtuals: true });
professionalSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Professional', professionalSchema);
