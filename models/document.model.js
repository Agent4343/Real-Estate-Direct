const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  // References
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property'
  },
  offer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer'
  },
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing'
  },

  // Document Classification
  documentType: {
    type: String,
    required: true,
    enum: [
      // Listing Documents
      'listing_agreement',
      'property_disclosure',
      'seller_representation',

      // Offer Documents
      'agreement_purchase_sale',
      'counter_offer',
      'amendment',
      'condition_waiver',
      'notice_fulfillment',
      'mutual_release',

      // Buyer Documents
      'buyer_representation',
      'pre_approval_letter',
      'mortgage_commitment',

      // Inspection Documents
      'home_inspection_report',
      'status_certificate',
      'survey_certificate',
      'real_property_report',  // Alberta

      // Closing Documents
      'statement_of_adjustments',
      'direction_re_title',
      'direction_re_funds',
      'deed_transfer',
      'title_insurance',
      'mortgage_documents',

      // Tax Documents
      'land_transfer_tax_affidavit',
      'property_transfer_tax_return',  // BC
      'gst_rebate_application',

      // Other
      'power_of_attorney',
      'corporate_authorization',
      'identification',
      'other'
    ]
  },

  // Province-specific form
  province: {
    type: String,
    required: true,
    enum: ['ON', 'BC', 'AB', 'QC', 'MB', 'SK', 'NS', 'NB', 'PE', 'NL', 'YT', 'NT', 'NU']
  },
  formNumber: {
    type: String  // e.g., "OREA Form 100", "Form 400"
  },
  formVersion: {
    type: String
  },

  // Document Details
  title: {
    type: String,
    required: true
  },
  description: { type: String },

  // File Information
  filePath: { type: String },
  fileName: { type: String },
  fileType: {
    type: String,
    enum: ['pdf', 'docx', 'image', 'other'],
    default: 'pdf'
  },
  fileSize: { type: Number }, // in bytes
  mimeType: { type: String },

  // Status
  status: {
    type: String,
    enum: ['draft', 'pending_signatures', 'partially_signed', 'signed', 'archived', 'voided'],
    default: 'draft'
  },

  // Document Content (for generated forms)
  content: {
    type: mongoose.Schema.Types.Mixed  // JSON structure for form data
  },
  generatedPdfPath: { type: String },

  // Signatures
  requiredSignatures: [{
    role: {
      type: String,
      enum: ['buyer', 'seller', 'buyer_spouse', 'seller_spouse', 'witness', 'lawyer', 'notary', 'agent']
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: { type: String },
    email: { type: String }
  }],
  signatures: [{
    role: { type: String },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: { type: String },
    email: { type: String },
    signedAt: { type: Date },
    signatureData: { type: String }, // base64 or signature ID
    ipAddress: { type: String },
    userAgent: { type: String }
  }],

  // Timestamps
  generatedAt: { type: Date },
  sentForSignatureAt: { type: Date },
  completedAt: { type: Date },
  expiresAt: { type: Date },

  // Access Control
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  accessibleBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isPublic: { type: Boolean, default: false },

  // Versioning
  version: { type: Number, default: 1 },
  previousVersions: [{
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document'
    },
    version: { type: Number },
    archivedAt: { type: Date }
  }],

  // Audit Trail
  auditLog: [{
    action: {
      type: String,
      enum: ['created', 'viewed', 'edited', 'signed', 'sent', 'downloaded', 'voided', 'archived']
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: { type: Date, default: Date.now },
    details: { type: String },
    ipAddress: { type: String }
  }]
}, {
  timestamps: true
});

// Indexes
documentSchema.index({ transaction: 1, documentType: 1 });
documentSchema.index({ property: 1 });
documentSchema.index({ offer: 1 });
documentSchema.index({ listing: 1 });
documentSchema.index({ createdBy: 1 });
documentSchema.index({ status: 1 });
documentSchema.index({ province: 1, documentType: 1 });

// Check if all signatures collected
documentSchema.methods.isFullySigned = function() {
  if (this.requiredSignatures.length === 0) return true;
  return this.requiredSignatures.every(required =>
    this.signatures.some(sig => sig.role === required.role)
  );
};

// Get missing signatures
documentSchema.methods.getMissingSignatures = function() {
  const signedRoles = this.signatures.map(s => s.role);
  return this.requiredSignatures.filter(req => !signedRoles.includes(req.role));
};

// Add audit log entry
documentSchema.methods.logAction = function(action, userId, details, ipAddress) {
  this.auditLog.push({
    action,
    userId,
    timestamp: new Date(),
    details,
    ipAddress
  });
};

// Get form template info by province and document type
documentSchema.statics.getFormInfo = function(province, documentType) {
  const formMappings = {
    ON: {
      agreement_purchase_sale: { formNumber: 'OREA Form 100', title: 'Agreement of Purchase and Sale' },
      listing_agreement: { formNumber: 'OREA Form 200', title: 'Listing Agreement' },
      property_disclosure: { formNumber: 'OREA Form 220', title: 'Seller Property Information Statement' },
      buyer_representation: { formNumber: 'OREA Form 300', title: 'Buyer Representation Agreement' },
      amendment: { formNumber: 'OREA Form 120', title: 'Amendment to Agreement' },
      condition_waiver: { formNumber: 'OREA Form 408', title: 'Waiver' }
    },
    BC: {
      agreement_purchase_sale: { formNumber: 'Form 578', title: 'Contract of Purchase and Sale' },
      property_disclosure: { formNumber: 'PDS', title: 'Property Disclosure Statement' },
      condition_waiver: { formNumber: 'Subject Removal', title: 'Subject Removal Form' }
    },
    AB: {
      agreement_purchase_sale: { formNumber: 'AREA RPC', title: 'Residential Purchase Contract' },
      property_disclosure: { formNumber: 'AREA PDS', title: 'Property Disclosure Statement' }
    },
    QC: {
      agreement_purchase_sale: { formNumber: 'OACIQ PP', title: 'Promise to Purchase' },
      listing_agreement: { formNumber: 'OACIQ BC', title: 'Brokerage Contract' }
    }
    // Add other provinces as needed
  };

  const provinceForums = formMappings[province] || {};
  return provinceForums[documentType] || {
    formNumber: 'Standard Form',
    title: documentType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  };
};

module.exports = mongoose.model('Document', documentSchema);
