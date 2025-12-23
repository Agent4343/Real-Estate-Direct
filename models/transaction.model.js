const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // Core References
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
  acceptedOffer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer',
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

  // Province (determines forms and process)
  province: {
    type: String,
    required: true,
    enum: ['ON', 'BC', 'AB', 'QC', 'MB', 'SK', 'NS', 'NB', 'PE', 'NL', 'YT', 'NT', 'NU']
  },

  // Transaction Details
  purchasePrice: {
    type: Number,
    required: true
  },
  depositAmount: {
    type: Number,
    required: true
  },
  depositStatus: {
    type: String,
    enum: ['pending', 'received', 'held_in_trust', 'released', 'refunded'],
    default: 'pending'
  },
  depositReceivedDate: { type: Date },

  // Key Dates
  acceptanceDate: {
    type: Date,
    required: true
  },
  conditionDeadline: { type: Date },
  firmDate: { type: Date }, // When conditions are waived/fulfilled
  closingDate: {
    type: Date,
    required: true
  },
  possessionDate: { type: Date },
  actualClosingDate: { type: Date },

  // Transaction Status
  status: {
    type: String,
    enum: [
      'conditional',     // Offer accepted, conditions pending
      'firm',            // All conditions met/waived
      'closing',         // In closing process
      'completed',       // Transaction complete
      'cancelled',       // Cancelled/fell through
      'disputed'         // Under dispute
    ],
    default: 'conditional'
  },

  // Workflow Step Tracking
  currentStep: {
    type: String,
    enum: [
      'offer_accepted',
      'deposit_pending',
      'conditions_pending',
      'conditions_complete',
      'lawyer_engaged',
      'title_search',
      'mortgage_finalized',
      'closing_documents',
      'final_walkthrough',
      'closing_day',
      'completed'
    ],
    default: 'offer_accepted'
  },

  // Step Completion Tracking
  stepsCompleted: [{
    step: { type: String },
    completedAt: { type: Date },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: { type: String }
  }],

  // Conditions (copied from offer for tracking)
  conditions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Condition'
  }],

  // Documents
  documents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }],

  // Legal Representatives
  buyerLawyer: {
    name: { type: String },
    firm: { type: String },
    phone: { type: String },
    email: { type: String },
    address: { type: String },
    fileNumber: { type: String }
  },
  sellerLawyer: {
    name: { type: String },
    firm: { type: String },
    phone: { type: String },
    email: { type: String },
    address: { type: String },
    fileNumber: { type: String }
  },
  // For Quebec - Notary instead of lawyers
  notary: {
    name: { type: String },
    firm: { type: String },
    phone: { type: String },
    email: { type: String },
    address: { type: String }
  },

  // Platform Commission (1% of sale price, paid by seller)
  platformFee: {
    rate: { type: Number, default: 0.01 }, // 1% commission
    amount: { type: Number }, // Calculated: purchasePrice * rate
    status: {
      type: String,
      enum: ['pending', 'invoiced', 'paid', 'waived'],
      default: 'pending'
    },
    invoicedAt: { type: Date },
    paidAt: { type: Date },
    paymentMethod: { type: String },
    paymentReference: { type: String },
    notes: { type: String }
  },

  // Financial Summary
  financials: {
    purchasePrice: { type: Number },
    deposit: { type: Number },
    mortgageAmount: { type: Number },
    downPayment: { type: Number },

    // Closing Costs
    landTransferTax: { type: Number },
    legalFees: { type: Number },
    titleInsurance: { type: Number },
    homeInspectionFee: { type: Number },
    appraisalFee: { type: Number },

    // Platform Fee (included in seller's costs)
    platformFee: { type: Number },

    // Adjustments
    propertyTaxAdjustment: { type: Number },
    utilityAdjustments: { type: Number },
    condoFeeAdjustment: { type: Number },
    fuelAdjustment: { type: Number },

    // Totals
    totalClosingCosts: { type: Number },
    totalDueOnClosing: { type: Number }
  },

  // Statement of Adjustments
  statementOfAdjustments: {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document'
    },
    generatedAt: { type: Date },
    approvedByBuyer: { type: Boolean, default: false },
    approvedBySeller: { type: Boolean, default: false }
  },

  // Title Information
  titleInfo: {
    searchCompleted: { type: Boolean, default: false },
    searchDate: { type: Date },
    encumbrances: [{ type: String }],
    easements: [{ type: String }],
    titleInsuranceObtained: { type: Boolean, default: false },
    titleInsuranceProvider: { type: String },
    titleInsurancePolicyNumber: { type: String }
  },

  // Mortgage Information
  mortgageInfo: {
    lender: { type: String },
    mortgageAmount: { type: Number },
    interestRate: { type: Number },
    term: { type: Number }, // in years
    amortization: { type: Number }, // in years
    approvalDate: { type: Date },
    commitmentLetter: { type: Boolean, default: false }
  },

  // Cancellation Details (if applicable)
  cancellation: {
    cancelledAt: { type: Date },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: { type: String },
    failedCondition: { type: String },
    depositDisposition: {
      type: String,
      enum: ['returned_to_buyer', 'released_to_seller', 'disputed', 'split']
    }
  },

  // Notes and Communication Log
  notes: [{
    content: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: { type: Date, default: Date.now },
    isPrivate: { type: Boolean, default: false }
  }],

  // Notifications
  lastNotificationSent: { type: Date },
  upcomingDeadlines: [{
    type: { type: String },
    date: { type: Date },
    notified: { type: Boolean, default: false }
  }]
}, {
  timestamps: true
});

// Indexes
transactionSchema.index({ buyer: 1, status: 1 });
transactionSchema.index({ seller: 1, status: 1 });
transactionSchema.index({ property: 1 });
transactionSchema.index({ status: 1, closingDate: 1 });
transactionSchema.index({ currentStep: 1 });

// Calculate platform fee on save
transactionSchema.pre('save', function(next) {
  if (this.purchasePrice && !this.platformFee.amount) {
    const rate = this.platformFee.rate || 0.01; // Default 1%
    this.platformFee.amount = Math.round(this.purchasePrice * rate * 100) / 100;
    this.financials.platformFee = this.platformFee.amount;
  }
  next();
});

// Calculate days until closing
transactionSchema.methods.getDaysUntilClosing = function() {
  const now = new Date();
  const closing = new Date(this.closingDate);
  const diffTime = closing - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Check if transaction is overdue
transactionSchema.methods.isOverdue = function() {
  return new Date() > this.closingDate && this.status !== 'completed';
};

// Get next required action
transactionSchema.methods.getNextAction = function() {
  const actions = {
    'offer_accepted': 'Submit deposit',
    'deposit_pending': 'Confirm deposit received',
    'conditions_pending': 'Fulfill or waive conditions',
    'conditions_complete': 'Engage lawyer/notary',
    'lawyer_engaged': 'Complete title search',
    'title_search': 'Finalize mortgage',
    'mortgage_finalized': 'Review closing documents',
    'closing_documents': 'Schedule final walkthrough',
    'final_walkthrough': 'Prepare for closing day',
    'closing_day': 'Complete closing',
    'completed': 'Transaction complete'
  };
  return actions[this.currentStep] || 'Contact support';
};

module.exports = mongoose.model('Transaction', transactionSchema);
