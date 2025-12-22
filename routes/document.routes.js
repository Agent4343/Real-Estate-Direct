const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const Document = require('../models/document.model');
const Transaction = require('../models/transaction.model');
const Property = require('../models/property.model');
const authMiddleware = require('../auth.middleware');
const { getProvince } = require('../config/provinces');

const idValidation = [
  param('id').isMongoId().withMessage('Invalid document ID')
];

/**
 * @route GET /documents/my-documents
 * @desc Get current user's documents
 * @access Private
 */
router.get('/my-documents', authMiddleware, async (req, res) => {
  try {
    const documents = await Document.find({
      $or: [
        { createdBy: req.user.userId },
        { accessibleBy: req.user.userId }
      ]
    })
      .select('-content -auditLog')
      .sort('-createdAt');

    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /documents/:id
 * @desc Get single document
 * @access Private
 */
router.get('/:id', authMiddleware, idValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const document = await Document.findById(req.params.id)
      .populate('transaction')
      .populate('property')
      .populate('createdBy', 'name email');

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check authorization
    const userId = req.user.userId;
    const hasAccess = document.createdBy._id.toString() === userId ||
                      document.accessibleBy.includes(userId) ||
                      document.isPublic;

    if (!hasAccess) {
      return res.status(403).json({ error: 'Not authorized to view this document' });
    }

    // Log view action
    document.logAction('viewed', userId, 'Document viewed', req.ip);
    await document.save();

    res.json(document);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route POST /documents/generate
 * @desc Generate a new document from template
 * @access Private
 */
router.post('/generate', authMiddleware, [
  body('documentType').notEmpty().withMessage('Document type is required'),
  body('province').notEmpty().withMessage('Province is required'),
  body('transactionId').optional().isMongoId(),
  body('propertyId').optional().isMongoId(),
  body('data').isObject().withMessage('Document data is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { documentType, province, transactionId, propertyId, data } = req.body;

    // Get form info for province
    const formInfo = Document.getFormInfo(province, documentType);

    // Verify transaction/property ownership if provided
    if (transactionId) {
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      if (transaction.buyer.toString() !== req.user.userId &&
          transaction.seller.toString() !== req.user.userId) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    if (propertyId) {
      const property = await Property.findById(propertyId);
      if (!property) {
        return res.status(404).json({ error: 'Property not found' });
      }
      if (property.seller.toString() !== req.user.userId) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    // Determine required signatures based on document type
    const requiredSignatures = getRequiredSignatures(documentType);

    // Create document
    const document = new Document({
      transaction: transactionId,
      property: propertyId,
      documentType,
      province,
      formNumber: formInfo.formNumber,
      title: formInfo.title,
      content: data,
      status: 'draft',
      requiredSignatures,
      createdBy: req.user.userId,
      accessibleBy: [req.user.userId],
      generatedAt: new Date()
    });

    document.logAction('created', req.user.userId, 'Document generated', req.ip);
    await document.save();

    res.status(201).json(document);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @route POST /documents/:id/sign
 * @desc Sign a document
 * @access Private
 */
router.post('/:id/sign', authMiddleware, idValidation, [
  body('role').notEmpty().withMessage('Signature role is required'),
  body('signatureData').notEmpty().withMessage('Signature data is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check if user is authorized to sign
    const userId = req.user.userId;
    const hasAccess = document.createdBy.toString() === userId ||
                      document.accessibleBy.includes(userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Not authorized to sign this document' });
    }

    // Check if this role is required
    const requiredRole = document.requiredSignatures.find(s => s.role === req.body.role);
    if (!requiredRole) {
      return res.status(400).json({ error: 'This signature role is not required' });
    }

    // Check if already signed for this role
    const alreadySigned = document.signatures.find(s => s.role === req.body.role);
    if (alreadySigned) {
      return res.status(400).json({ error: 'Document already signed for this role' });
    }

    // Add signature
    document.signatures.push({
      role: req.body.role,
      userId: userId,
      name: req.body.name,
      email: req.body.email,
      signedAt: new Date(),
      signatureData: req.body.signatureData,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Update status
    if (document.isFullySigned()) {
      document.status = 'signed';
      document.completedAt = new Date();
    } else {
      document.status = 'partially_signed';
    }

    document.logAction('signed', userId, `Signed as ${req.body.role}`, req.ip);
    await document.save();

    res.json(document);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route POST /documents/:id/send-for-signature
 * @desc Send document for signature
 * @access Private
 */
router.post('/:id/send-for-signature', authMiddleware, idValidation, [
  body('recipients').isArray().withMessage('Recipients array is required'),
  body('recipients.*.email').isEmail().withMessage('Valid email required'),
  body('recipients.*.role').notEmpty().withMessage('Role is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only document creator can send for signature' });
    }

    // Update required signatures with recipient info
    req.body.recipients.forEach(recipient => {
      const existing = document.requiredSignatures.find(s => s.role === recipient.role);
      if (existing) {
        existing.email = recipient.email;
        existing.name = recipient.name;
      }
    });

    document.status = 'pending_signatures';
    document.sentForSignatureAt = new Date();

    // In a real app, send email notifications here

    document.logAction('sent', req.user.userId, 'Sent for signature', req.ip);
    await document.save();

    res.json({ message: 'Document sent for signature', document });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /documents/transaction/:transactionId
 * @desc Get all documents for a transaction
 * @access Private
 */
router.get('/transaction/:transactionId', authMiddleware, [
  param('transactionId').isMongoId().withMessage('Invalid transaction ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const transaction = await Transaction.findById(req.params.transactionId);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const userId = req.user.userId;
    if (transaction.buyer.toString() !== userId &&
        transaction.seller.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const documents = await Document.find({ transaction: req.params.transactionId })
      .select('-content -auditLog')
      .sort('-createdAt');

    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /documents/forms/:province
 * @desc Get available forms for a province
 * @access Public
 */
router.get('/forms/:province', async (req, res) => {
  try {
    const province = getProvince(req.params.province);

    if (!province) {
      return res.status(404).json({ error: 'Province not found' });
    }

    const documentTypes = [
      'agreement_purchase_sale',
      'listing_agreement',
      'property_disclosure',
      'buyer_representation',
      'condition_waiver',
      'amendment',
      'counter_offer'
    ];

    const forms = documentTypes.map(type => ({
      documentType: type,
      ...Document.getFormInfo(req.params.province, type)
    }));

    res.json({
      province: province.name,
      code: province.code,
      regulatoryBody: province.regulatoryBody,
      formsProvider: province.formsProvider,
      forms
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route DELETE /documents/:id
 * @desc Delete a document (only drafts)
 * @access Private
 */
router.delete('/:id', authMiddleware, idValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (document.status !== 'draft') {
      return res.status(400).json({ error: 'Can only delete draft documents' });
    }

    await Document.findByIdAndDelete(req.params.id);

    res.json({ message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper function to determine required signatures
function getRequiredSignatures(documentType) {
  const signatureMap = {
    agreement_purchase_sale: [
      { role: 'buyer' },
      { role: 'seller' },
      { role: 'witness' }
    ],
    listing_agreement: [
      { role: 'seller' }
    ],
    property_disclosure: [
      { role: 'seller' }
    ],
    buyer_representation: [
      { role: 'buyer' }
    ],
    condition_waiver: [
      { role: 'buyer' }
    ],
    amendment: [
      { role: 'buyer' },
      { role: 'seller' }
    ],
    counter_offer: [
      { role: 'seller' }
    ],
    mutual_release: [
      { role: 'buyer' },
      { role: 'seller' }
    ]
  };

  return signatureMap[documentType] || [{ role: 'buyer' }, { role: 'seller' }];
}

module.exports = router;
