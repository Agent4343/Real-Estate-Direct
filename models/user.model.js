const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // Admin access
  isAdmin: { type: Boolean, default: false },
  phone: { type: String },
  // Password reset fields
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  // Email verification
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },
  // FINTRAC compliance - identity verification for real estate transactions
  fintracCompliance: {
    // Identity verification status
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    verificationMethod: { type: String, enum: ['government_id', 'dual_process', 'credit_file', 'not_verified'], default: 'not_verified' },
    // Personal Information
    legalFirstName: { type: String },
    legalLastName: { type: String },
    dateOfBirth: { type: Date },
    // Address
    address: {
      street: { type: String },
      city: { type: String },
      province: { type: String },
      postalCode: { type: String },
      country: { type: String, default: 'Canada' }
    },
    // Government ID
    idType: { type: String, enum: ['drivers_license', 'passport', 'provincial_id', 'permanent_resident_card', null] },
    idNumber: { type: String }, // Encrypted/hashed in production
    idExpiry: { type: Date },
    idIssuingProvince: { type: String },
    // For business clients
    isBusinessClient: { type: Boolean, default: false },
    businessName: { type: String },
    businessNumber: { type: String },
    // Politically Exposed Person (PEP) determination
    isPEP: { type: Boolean, default: false },
    pepDetails: { type: String },
    // Beneficial ownership
    beneficialOwnerConfirmed: { type: Boolean, default: false },
    // Risk assessment
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    // Document references
    idDocumentPath: { type: String },
    // Audit trail
    verificationHistory: [{
      action: { type: String },
      timestamp: { type: Date, default: Date.now },
      performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      notes: { type: String }
    }]
  },
  // Checklist progress - stores which items are completed
  checklistProgress: {
    type: Map,
    of: Boolean,
    default: new Map()
  },
  // Notification preferences
  notificationSettings: {
    emailOffers: { type: Boolean, default: true },
    emailMessages: { type: Boolean, default: true },
    emailTransactions: { type: Boolean, default: true },
    emailDocuments: { type: Boolean, default: true },
    emailMarketing: { type: Boolean, default: false }
  },
  // Saved/favorite properties
  favoriteProperties: [{
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property' },
    address: {
      street: String,
      city: String,
      province: String
    },
    askingPrice: Number,
    bedrooms: Number,
    bathrooms: Number,
    squareFeet: Number,
    propertyType: String,
    image: String,
    savedAt: { type: Date, default: Date.now }
  }],
  // AI Tools usage tracking
  aiToolsUsage: {
    count: { type: Number, default: 0 },
    lastResetMonth: { type: Number, default: null },
    lastResetYear: { type: Number, default: null }
  },
  // Premium subscription (for unlimited AI usage)
  isPremium: { type: Boolean, default: false },
  premiumExpiresAt: { type: Date, default: null }
});

userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
