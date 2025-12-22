const mongoose = require('mongoose');

const conditionSchema = new mongoose.Schema({
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: true
  },
  offer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer',
    required: true
  },

  // Condition Type
  conditionType: {
    type: String,
    required: true,
    enum: [
      'financing',           // Buyer needs to secure financing
      'inspection',          // Home inspection
      'status_certificate',  // Condo status certificate review
      'sale_of_property',    // Buyer needs to sell their property
      'appraisal',          // Property appraisal
      'lawyer_review',       // Lawyer review of documents
      'insurance',           // Buyer needs to obtain insurance
      'well_septic',        // Well and septic inspection
      'survey',             // Property survey
      'environmental',       // Environmental assessment
      'zoning',             // Zoning compliance
      'other'               // Custom condition
    ]
  },

  // Condition Details
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },

  // Deadline
  deadlineDate: {
    type: Date,
    required: true
  },
  daysFromAcceptance: {
    type: Number
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'fulfilled', 'waived', 'failed', 'extended'],
    default: 'pending'
  },

  // Resolution Details
  resolvedAt: { type: Date },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolutionMethod: {
    type: String,
    enum: ['fulfilled', 'waived', 'failed', 'mutual_release']
  },
  resolutionNotes: { type: String },

  // Waiver Document
  waiverDocument: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  },

  // For Financing Condition
  financingDetails: {
    lenderName: { type: String },
    preApprovalAmount: { type: Number },
    approvalDate: { type: Date },
    approvalLetter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document'
    }
  },

  // For Inspection Condition
  inspectionDetails: {
    inspectorName: { type: String },
    inspectorCompany: { type: String },
    inspectionDate: { type: Date },
    inspectionReport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document'
    },
    issuesFound: [{ type: String }],
    repairsRequested: [{ type: String }],
    repairsAgreed: [{ type: String }],
    creditAmount: { type: Number }
  },

  // For Status Certificate Condition (Condo)
  statusCertDetails: {
    requestedDate: { type: Date },
    receivedDate: { type: Date },
    reviewedBy: { type: String }, // Usually lawyer
    issues: [{ type: String }],
    reserveFundAmount: { type: Number },
    specialAssessments: { type: Boolean },
    specialAssessmentAmount: { type: Number }
  },

  // For Sale of Property Condition
  saleOfPropertyDetails: {
    propertyAddress: { type: String },
    listingDate: { type: Date },
    askingPrice: { type: Number },
    status: {
      type: String,
      enum: ['not_listed', 'listed', 'pending', 'sold', 'failed']
    },
    soldDate: { type: Date },
    soldPrice: { type: Number }
  },

  // Notifications
  remindersSent: [{
    sentAt: { type: Date },
    daysBeforeDeadline: { type: Number }
  }],

  // Extension History
  extensions: [{
    previousDeadline: { type: Date },
    newDeadline: { type: Date },
    reason: { type: String },
    agreedAt: { type: Date },
    agreedByBuyer: { type: Boolean },
    agreedBySeller: { type: Boolean }
  }]
}, {
  timestamps: true
});

// Indexes
conditionSchema.index({ transaction: 1, status: 1 });
conditionSchema.index({ offer: 1 });
conditionSchema.index({ deadlineDate: 1, status: 1 });
conditionSchema.index({ conditionType: 1 });

// Check if deadline passed
conditionSchema.methods.isOverdue = function() {
  return new Date() > this.deadlineDate && this.status === 'pending';
};

// Get days until deadline
conditionSchema.methods.getDaysUntilDeadline = function() {
  const now = new Date();
  const deadline = new Date(this.deadlineDate);
  const diffTime = deadline - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Standard condition templates by type
conditionSchema.statics.getTemplate = function(type, province = 'ON') {
  const templates = {
    financing: {
      title: 'Financing Condition',
      description: 'This offer is conditional upon the Buyer arranging, at the Buyer\'s own expense, a new first mortgage for not less than the principal amount specified, bearing interest at a rate of not more than the rate specified, calculated semi-annually not in advance, repayable in blended monthly payments amortized over the period specified.'
    },
    inspection: {
      title: 'Home Inspection Condition',
      description: 'This offer is conditional upon the inspection of the subject property by a home inspector at the Buyer\'s own expense, and the obtaining of a report satisfactory to the Buyer in the Buyer\'s sole and absolute discretion.'
    },
    status_certificate: {
      title: 'Status Certificate Condition',
      description: 'This offer is conditional upon the Buyer\'s lawyer\'s review and approval of the Status Certificate and all attachments. The Seller agrees to request at the Seller\'s expense the Status Certificate within the specified timeframe.'
    },
    sale_of_property: {
      title: 'Sale of Buyer\'s Property Condition',
      description: 'This offer is conditional upon the sale of the Buyer\'s property. Unless the Buyer gives notice in writing to the Seller by the specified date that this condition is fulfilled, this offer shall be null and void and the deposit shall be returned to the Buyer in full without deduction.'
    },
    lawyer_review: {
      title: 'Lawyer Review Condition',
      description: 'This offer is conditional upon the approval of the terms hereof by the Buyer\'s lawyer. Unless the Buyer gives notice in writing to the Seller by the specified date that this condition is fulfilled, this offer shall be null and void and the deposit shall be returned to the Buyer in full without deduction.'
    },
    appraisal: {
      title: 'Appraisal Condition',
      description: 'This offer is conditional upon the property appraising for at least the purchase price by an accredited appraiser satisfactory to the Buyer\'s lender.'
    },
    insurance: {
      title: 'Insurance Condition',
      description: 'This offer is conditional upon the Buyer obtaining property insurance for the subject property on terms satisfactory to the Buyer.'
    }
  };

  return templates[type] || {
    title: 'Custom Condition',
    description: ''
  };
};

module.exports = mongoose.model('Condition', conditionSchema);
