const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  province: {
    type: String,
    required: true,
    enum: ['ON', 'BC', 'AB', 'QC', 'MB', 'SK', 'NS', 'NB', 'PE', 'NL', 'YT', 'NT', 'NU']
  },

  // Address Information
  address: {
    street: { type: String, required: true },
    unit: { type: String },
    city: { type: String, required: true },
    province: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, default: 'Canada' }
  },
  legalDescription: {
    type: String,
    required: true
  },

  // Property Details
  propertyType: {
    type: String,
    required: true,
    enum: ['residential', 'condo', 'townhouse', 'semi-detached', 'detached', 'commercial', 'land', 'multi-family']
  },
  bedrooms: { type: Number, min: 0 },
  bathrooms: { type: Number, min: 0 },
  squareFeet: { type: Number, min: 0 },
  lotSize: { type: Number, min: 0 }, // in square feet
  lotSizeUnit: { type: String, enum: ['sqft', 'acres', 'hectares'], default: 'sqft' },
  yearBuilt: { type: Number },
  parkingSpaces: { type: Number, default: 0 },
  parkingType: { type: String, enum: ['garage', 'driveway', 'street', 'underground', 'none'] },

  // Condo-specific fields
  condoInfo: {
    unitNumber: { type: String },
    floor: { type: Number },
    condoFees: { type: Number },
    condoFeesInclude: [{ type: String }], // water, heat, parking, etc.
    condoCorporation: { type: String },
    statusCertificateDate: { type: Date }
  },

  // Pricing
  askingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  priceHistory: [{
    price: { type: Number },
    date: { type: Date, default: Date.now }
  }],

  // Features and Amenities
  features: [{
    type: String
  }],
  amenities: [{
    type: String
  }],
  appliances: [{
    type: String
  }],
  heatingType: { type: String },
  coolingType: { type: String },
  basement: {
    type: String,
    enum: ['finished', 'unfinished', 'partial', 'none', 'crawl']
  },

  // Media
  photos: [{
    url: { type: String },
    caption: { type: String },
    isPrimary: { type: Boolean, default: false },
    uploadedAt: { type: Date, default: Date.now }
  }],
  virtualTourUrl: { type: String },
  floorPlanUrl: { type: String },

  // Property Disclosure
  disclosureCompleted: { type: Boolean, default: false },
  disclosureDocumentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  },

  // Status
  status: {
    type: String,
    enum: ['draft', 'active', 'pending', 'sold', 'withdrawn', 'expired'],
    default: 'draft'
  },

  // Metadata
  description: { type: String, maxlength: 5000 },
  highlights: { type: String, maxlength: 1000 },

  // Taxes and Assessments
  propertyTaxes: {
    annualAmount: { type: Number },
    year: { type: Number }
  },
  assessedValue: {
    amount: { type: Number },
    year: { type: Number }
  }
}, {
  timestamps: true
});

// Indexes for search
propertySchema.index({ 'address.city': 1, 'address.province': 1 });
propertySchema.index({ province: 1, status: 1 });
propertySchema.index({ askingPrice: 1 });
propertySchema.index({ propertyType: 1 });
propertySchema.index({ bedrooms: 1, bathrooms: 1 });
propertySchema.index({ seller: 1 });

// Virtual for full address
propertySchema.virtual('fullAddress').get(function() {
  const unit = this.address.unit ? `${this.address.unit} - ` : '';
  return `${unit}${this.address.street}, ${this.address.city}, ${this.address.province} ${this.address.postalCode}`;
});

// Ensure virtuals are included in JSON
propertySchema.set('toJSON', { virtuals: true });
propertySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Property', propertySchema);
