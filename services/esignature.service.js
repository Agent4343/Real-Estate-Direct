/**
 * E-Signature Service
 * Integrates with DocuSign and HelloSign for electronic document signing
 * Supports Canadian real estate transaction documents
 */

const crypto = require('crypto');

class ESignatureService {
  constructor() {
    this.provider = process.env.ESIGN_PROVIDER || 'docusign';
    this.apiKey = process.env.ESIGN_API_KEY;
    this.accountId = process.env.ESIGN_ACCOUNT_ID;
    this.baseUrl = process.env.ESIGN_BASE_URL || 'https://demo.docusign.net/restapi';
    this.webhookSecret = process.env.ESIGN_WEBHOOK_SECRET;
  }

  /**
   * Create an envelope for signing
   * @param {Object} options - Envelope options
   * @returns {Object} Envelope details
   */
  async createEnvelope(options) {
    const {
      documentId,
      documentPath,
      documentName,
      signers,
      subject,
      message,
      expiresInDays = 30
    } = options;

    // Generate envelope ID for tracking
    const envelopeId = this.generateEnvelopeId();

    if (this.provider === 'docusign') {
      return this.createDocuSignEnvelope({
        envelopeId,
        documentId,
        documentPath,
        documentName,
        signers,
        subject,
        message,
        expiresInDays
      });
    } else if (this.provider === 'hellosign') {
      return this.createHelloSignRequest({
        envelopeId,
        documentId,
        documentPath,
        documentName,
        signers,
        subject,
        message,
        expiresInDays
      });
    }

    // Fallback: Local signing simulation for development
    return this.createLocalSigningRequest({
      envelopeId,
      documentId,
      documentPath,
      documentName,
      signers,
      subject,
      message,
      expiresInDays
    });
  }

  /**
   * Create DocuSign envelope
   */
  async createDocuSignEnvelope(options) {
    const { envelopeId, documentPath, documentName, signers, subject, message, expiresInDays } = options;

    // In production, this would make actual API calls to DocuSign
    // For now, we return a simulated response

    const signerData = signers.map((signer, index) => ({
      email: signer.email,
      name: signer.name,
      recipientId: String(index + 1),
      routingOrder: String(signer.order || index + 1),
      role: signer.role || 'signer',
      tabs: this.getSignatureTabs(signer.signatureLocations || [])
    }));

    const envelope = {
      provider: 'docusign',
      envelopeId,
      status: 'sent',
      subject,
      message,
      documentName,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
      signers: signerData.map(s => ({
        email: s.email,
        name: s.name,
        role: s.role,
        status: 'pending',
        signedAt: null,
        signingUrl: `${process.env.APP_URL || 'http://localhost:3000'}/sign/${envelopeId}/${s.recipientId}`
      }))
    };

    // Log for development
    console.log('DocuSign envelope created:', envelopeId);

    return envelope;
  }

  /**
   * Create HelloSign signature request
   */
  async createHelloSignRequest(options) {
    const { envelopeId, documentPath, documentName, signers, subject, message, expiresInDays } = options;

    const signerData = signers.map((signer, index) => ({
      email_address: signer.email,
      name: signer.name,
      order: signer.order || index + 1,
      role: signer.role || 'signer'
    }));

    const request = {
      provider: 'hellosign',
      signatureRequestId: envelopeId,
      status: 'awaiting_signature',
      title: subject,
      message,
      documentName,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
      signers: signerData.map(s => ({
        email: s.email_address,
        name: s.name,
        role: s.role,
        status: 'awaiting_signature',
        signedAt: null,
        signingUrl: `${process.env.APP_URL || 'http://localhost:3000'}/sign/${envelopeId}/${s.order}`
      }))
    };

    console.log('HelloSign request created:', envelopeId);

    return request;
  }

  /**
   * Create local signing request for development/testing
   */
  async createLocalSigningRequest(options) {
    const { envelopeId, documentPath, documentName, signers, subject, message, expiresInDays } = options;

    const request = {
      provider: 'local',
      envelopeId,
      status: 'pending',
      subject,
      message,
      documentName,
      documentPath,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
      signers: signers.map((signer, index) => ({
        email: signer.email,
        name: signer.name,
        role: signer.role || 'signer',
        status: 'pending',
        signedAt: null,
        signingUrl: `${process.env.APP_URL || 'http://localhost:3000'}/api/documents/sign/${envelopeId}?signer=${index}`,
        signatureToken: this.generateSignatureToken()
      }))
    };

    console.log('Local signing request created:', envelopeId);

    return request;
  }

  /**
   * Get envelope/request status
   */
  async getStatus(envelopeId) {
    // In production, this would query the e-signature provider API
    return {
      envelopeId,
      status: 'pending',
      message: 'Status check - implement with actual provider'
    };
  }

  /**
   * Void/cancel an envelope
   */
  async voidEnvelope(envelopeId, reason) {
    // In production, this would call the provider API to void the envelope
    return {
      envelopeId,
      status: 'voided',
      voidedAt: new Date().toISOString(),
      reason
    };
  }

  /**
   * Resend signing notification
   */
  async resendNotification(envelopeId, recipientEmail) {
    // In production, this would trigger a resend via the provider
    return {
      envelopeId,
      recipientEmail,
      resentAt: new Date().toISOString(),
      message: 'Notification resent'
    };
  }

  /**
   * Download signed document
   */
  async downloadSignedDocument(envelopeId) {
    // In production, this would download the completed document from the provider
    return {
      envelopeId,
      downloadUrl: `/api/documents/download/${envelopeId}`,
      message: 'Download URL generated'
    };
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.webhookSecret) {
      console.warn('Webhook secret not configured');
      return true; // Skip verification in development
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Process webhook event from provider
   */
  async processWebhook(event) {
    const { eventType, envelopeId, data } = event;

    switch (eventType) {
      case 'envelope-sent':
      case 'signature_request_sent':
        return { action: 'sent', envelopeId };

      case 'envelope-delivered':
      case 'signature_request_viewed':
        return { action: 'viewed', envelopeId };

      case 'recipient-signed':
      case 'signature_request_signed':
        return {
          action: 'signed',
          envelopeId,
          signer: data?.recipientEmail || data?.signer_email_address
        };

      case 'envelope-completed':
      case 'signature_request_all_signed':
        return { action: 'completed', envelopeId };

      case 'envelope-declined':
      case 'signature_request_declined':
        return {
          action: 'declined',
          envelopeId,
          reason: data?.declineReason
        };

      case 'envelope-voided':
      case 'signature_request_canceled':
        return { action: 'voided', envelopeId };

      default:
        return { action: 'unknown', eventType, envelopeId };
    }
  }

  /**
   * Get signature tab positions for DocuSign
   */
  getSignatureTabs(locations) {
    if (!locations || locations.length === 0) {
      // Default signature tab at bottom of first page
      return {
        signHereTabs: [{
          documentId: '1',
          pageNumber: '1',
          xPosition: '100',
          yPosition: '700'
        }],
        dateSignedTabs: [{
          documentId: '1',
          pageNumber: '1',
          xPosition: '300',
          yPosition: '700'
        }]
      };
    }

    return {
      signHereTabs: locations.filter(l => l.type === 'signature').map(l => ({
        documentId: String(l.documentId || 1),
        pageNumber: String(l.page || 1),
        xPosition: String(l.x),
        yPosition: String(l.y)
      })),
      dateSignedTabs: locations.filter(l => l.type === 'date').map(l => ({
        documentId: String(l.documentId || 1),
        pageNumber: String(l.page || 1),
        xPosition: String(l.x),
        yPosition: String(l.y)
      })),
      textTabs: locations.filter(l => l.type === 'text').map(l => ({
        documentId: String(l.documentId || 1),
        pageNumber: String(l.page || 1),
        xPosition: String(l.x),
        yPosition: String(l.y),
        tabLabel: l.label || 'text',
        value: l.value || ''
      }))
    };
  }

  /**
   * Generate unique envelope ID
   */
  generateEnvelopeId() {
    return `ENV-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  /**
   * Generate signature token for local signing
   */
  generateSignatureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get signing URL for embedded signing
   */
  async getEmbeddedSigningUrl(envelopeId, signerEmail, returnUrl) {
    // In production, this would get the embedded signing URL from the provider
    return {
      signingUrl: `${process.env.APP_URL || 'http://localhost:3000'}/sign/${envelopeId}?return=${encodeURIComponent(returnUrl)}`,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
    };
  }
}

// Document types for Canadian real estate
const DOCUMENT_TYPES = {
  AGREEMENT_OF_PURCHASE_SALE: 'aps',
  PROPERTY_DISCLOSURE: 'pds',
  CONDITION_WAIVER: 'waiver',
  AMENDMENT: 'amendment',
  NOTICE_OF_FULFILLMENT: 'fulfillment',
  MUTUAL_RELEASE: 'release',
  DIRECTION_RE_TITLE: 'title_direction',
  STATEMENT_OF_ADJUSTMENTS: 'adjustments'
};

// Signature locations for common document types
const DEFAULT_SIGNATURE_LOCATIONS = {
  [DOCUMENT_TYPES.AGREEMENT_OF_PURCHASE_SALE]: [
    { type: 'signature', page: 1, x: 100, y: 680, role: 'buyer' },
    { type: 'date', page: 1, x: 300, y: 680, role: 'buyer' },
    { type: 'signature', page: 1, x: 100, y: 720, role: 'seller' },
    { type: 'date', page: 1, x: 300, y: 720, role: 'seller' }
  ],
  [DOCUMENT_TYPES.CONDITION_WAIVER]: [
    { type: 'signature', page: 1, x: 100, y: 600, role: 'buyer' },
    { type: 'date', page: 1, x: 300, y: 600, role: 'buyer' }
  ]
};

module.exports = {
  ESignatureService,
  DOCUMENT_TYPES,
  DEFAULT_SIGNATURE_LOCATIONS,
  esignatureService: new ESignatureService()
};
