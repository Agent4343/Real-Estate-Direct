const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Audit log schema
const auditLogSchema = new Schema({
  // Who performed the action
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  userEmail: { type: String },
  userIP: { type: String },
  userAgent: { type: String },

  // What action was performed
  action: {
    type: String,
    required: true,
    enum: [
      // Authentication actions
      'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'REGISTER', 'PASSWORD_CHANGE', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET',
      // User actions
      'PROFILE_UPDATE', 'EMAIL_VERIFIED', 'FINTRAC_VERIFICATION',
      // Property actions
      'PROPERTY_CREATE', 'PROPERTY_UPDATE', 'PROPERTY_DELETE', 'LISTING_ACTIVATE', 'LISTING_DEACTIVATE',
      // Transaction actions
      'OFFER_SUBMIT', 'OFFER_ACCEPT', 'OFFER_REJECT', 'OFFER_COUNTER',
      'TRANSACTION_CREATE', 'TRANSACTION_UPDATE', 'CONDITION_WAIVE', 'TRANSACTION_COMPLETE',
      // Payment actions
      'PAYMENT_INITIATE', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'REFUND_INITIATE',
      // Document actions
      'DOCUMENT_UPLOAD', 'DOCUMENT_SIGN', 'DOCUMENT_DOWNLOAD',
      // Admin actions
      'ADMIN_LOGIN', 'ADMIN_USER_UPDATE', 'ADMIN_COMMISSION_MARK_PAID',
      // Security events
      'RATE_LIMIT_EXCEEDED', 'SUSPICIOUS_ACTIVITY', 'ACCESS_DENIED'
    ],
    index: true
  },

  // What resource was affected
  resourceType: { type: String, enum: ['user', 'property', 'listing', 'offer', 'transaction', 'document', 'payment', 'system'] },
  resourceId: { type: Schema.Types.ObjectId },

  // Details of the action
  details: { type: Schema.Types.Mixed },

  // Status
  success: { type: Boolean, default: true },
  errorMessage: { type: String },

  // Timestamp
  timestamp: { type: Date, default: Date.now, index: true }
}, {
  // Don't allow updates to audit logs
  strict: true,
  collection: 'audit_logs'
});

// Compound indexes for common queries
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

/**
 * Log an audit event
 * @param {Object} options - Audit log options
 * @param {string} options.action - The action being logged
 * @param {string} options.userId - The user performing the action
 * @param {Object} options.req - The Express request object (for IP, user agent)
 * @param {string} options.resourceType - Type of resource affected
 * @param {string} options.resourceId - ID of resource affected
 * @param {Object} options.details - Additional details
 * @param {boolean} options.success - Whether the action succeeded
 * @param {string} options.errorMessage - Error message if failed
 */
async function logAudit({
  action,
  userId = null,
  userEmail = null,
  req = null,
  resourceType = null,
  resourceId = null,
  details = null,
  success = true,
  errorMessage = null
}) {
  try {
    const logEntry = new AuditLog({
      action,
      userId,
      userEmail,
      userIP: req ? (req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress) : null,
      userAgent: req ? req.headers['user-agent'] : null,
      resourceType,
      resourceId,
      details: sanitizeDetails(details),
      success,
      errorMessage
    });

    await logEntry.save();
    return logEntry;
  } catch (err) {
    // Don't throw - audit logging should not break the application
    console.error('Audit logging failed:', err.message);
    return null;
  }
}

/**
 * Sanitize sensitive data from details before logging
 */
function sanitizeDetails(details) {
  if (!details) return null;

  const sanitized = { ...details };

  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'creditCard', 'ssn', 'sin', 'idNumber'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Get audit logs for a user
 */
async function getUserAuditLogs(userId, options = {}) {
  const { limit = 50, skip = 0, action = null, startDate = null, endDate = null } = options;

  const query = { userId };

  if (action) query.action = action;
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = startDate;
    if (endDate) query.timestamp.$lte = endDate;
  }

  return AuditLog.find(query)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

/**
 * Get audit logs for a resource
 */
async function getResourceAuditLogs(resourceType, resourceId, options = {}) {
  const { limit = 50, skip = 0 } = options;

  return AuditLog.find({ resourceType, resourceId })
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .populate('userId', 'name email')
    .lean();
}

/**
 * Get security events (failed logins, rate limits, suspicious activity)
 */
async function getSecurityEvents(options = {}) {
  const { limit = 100, startDate = null } = options;

  const query = {
    action: { $in: ['LOGIN_FAILED', 'RATE_LIMIT_EXCEEDED', 'SUSPICIOUS_ACTIVITY', 'ACCESS_DENIED'] }
  };

  if (startDate) {
    query.timestamp = { $gte: startDate };
  }

  return AuditLog.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
}

module.exports = {
  AuditLog,
  logAudit,
  getUserAuditLogs,
  getResourceAuditLogs,
  getSecurityEvents
};
