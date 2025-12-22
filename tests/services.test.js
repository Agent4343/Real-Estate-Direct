/**
 * Services Tests
 * Tests for PDF generator, email service, e-signature, and maps services
 */

const pdfGenerator = require('../services/pdf-generator');
const emailService = require('../services/email.service');
const { ESignatureService } = require('../services/esignature.service');
const { MapsService } = require('../services/maps.service');

describe('PDF Generator Service', () => {
  describe('generateAgreementOfPurchaseSale', () => {
    it('should generate APS document', async () => {
      const data = {
        propertyAddress: '123 Test St, Toronto, ON M5V 1A1',
        purchasePrice: 500000,
        depositAmount: 25000,
        closingDate: new Date('2024-06-01'),
        buyerName: 'John Buyer',
        sellerName: 'Jane Seller',
        province: 'ON'
      };

      const result = await pdfGenerator.generateAgreementOfPurchaseSale(data);

      expect(result).toHaveProperty('buffer');
      expect(result).toHaveProperty('filename');
      expect(result.filename).toContain('APS');
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
    });

    it('should handle missing optional fields', async () => {
      const data = {
        propertyAddress: '123 Test St',
        purchasePrice: 500000,
        depositAmount: 25000,
        closingDate: new Date(),
        buyerName: 'John Buyer',
        sellerName: 'Jane Seller'
      };

      const result = await pdfGenerator.generateAgreementOfPurchaseSale(data);
      expect(result).toHaveProperty('buffer');
    });
  });

  describe('generatePropertyDisclosure', () => {
    it('should generate property disclosure document', async () => {
      const data = {
        propertyAddress: '123 Test St, Toronto, ON M5V 1A1',
        sellerName: 'Jane Seller',
        disclosures: {
          knownDefects: 'None',
          renovations: 'Kitchen updated 2020',
          environmentalIssues: 'None'
        }
      };

      const result = await pdfGenerator.generatePropertyDisclosure(data);

      expect(result).toHaveProperty('buffer');
      expect(result).toHaveProperty('filename');
      expect(result.filename).toContain('Disclosure');
    });
  });

  describe('generateConditionWaiver', () => {
    it('should generate condition waiver document', async () => {
      const data = {
        propertyAddress: '123 Test St, Toronto, ON M5V 1A1',
        conditionType: 'financing',
        originalDeadline: new Date('2024-04-01'),
        buyerName: 'John Buyer'
      };

      const result = await pdfGenerator.generateConditionWaiver(data);

      expect(result).toHaveProperty('buffer');
      expect(result).toHaveProperty('filename');
      expect(result.filename).toContain('Waiver');
    });
  });

  describe('generateStatementOfAdjustments', () => {
    it('should generate statement of adjustments', async () => {
      const data = {
        propertyAddress: '123 Test St, Toronto, ON M5V 1A1',
        purchasePrice: 500000,
        depositAmount: 25000,
        closingDate: new Date('2024-06-01'),
        adjustments: [
          { description: 'Property Tax', amount: 1500, credit: 'buyer' },
          { description: 'Utility Deposit', amount: 200, credit: 'seller' }
        ],
        buyerName: 'John Buyer',
        sellerName: 'Jane Seller'
      };

      const result = await pdfGenerator.generateStatementOfAdjustments(data);

      expect(result).toHaveProperty('buffer');
      expect(result).toHaveProperty('filename');
    });
  });
});

describe('Email Service', () => {
  describe('sendEmail', () => {
    it('should send email in local mode', async () => {
      const result = await emailService.sendEmail(
        'test@example.com',
        'Test Subject',
        '<p>Test HTML content</p>',
        'Test text content'
      );

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('messageId');
      expect(result).toHaveProperty('to');
    });

    it('should handle array of recipients', async () => {
      const result = await emailService.sendEmail(
        ['test1@example.com', 'test2@example.com'],
        'Test Subject',
        '<p>Test HTML content</p>'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('sendOfferReceived', () => {
    it('should send offer received notification', async () => {
      const result = await emailService.sendOfferReceived('seller@example.com', {
        propertyAddress: '123 Test St',
        offerPrice: 500000,
        depositAmount: 25000,
        closingDate: new Date('2024-06-01'),
        conditionCount: 3,
        irrevocableDate: new Date('2024-04-01'),
        viewUrl: 'http://localhost/offer/123'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('sendOfferAccepted', () => {
    it('should send offer accepted notification', async () => {
      const result = await emailService.sendOfferAccepted('buyer@example.com', {
        propertyAddress: '123 Test St',
        depositAmount: 25000,
        depositDueDays: 5,
        hasConditions: true,
        closingDate: new Date('2024-06-01'),
        purchasePrice: 500000,
        transactionUrl: 'http://localhost/transaction/123'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('sendBulk', () => {
    it('should send bulk emails', async () => {
      const recipients = [
        { email: 'user1@example.com', subject: 'Test 1', html: '<p>Content 1</p>' },
        { email: 'user2@example.com', subject: 'Test 2', html: '<p>Content 2</p>' }
      ];

      const result = await emailService.sendBulk(recipients);

      expect(result.total).toBe(2);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
    });
  });

  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2024-06-15');
      const formatted = emailService.formatDate(date);

      expect(formatted).toContain('2024');
      expect(formatted).toContain('June');
      expect(formatted).toContain('15');
    });

    it('should handle null date', () => {
      const formatted = emailService.formatDate(null);
      expect(formatted).toBe('TBD');
    });
  });
});

describe('E-Signature Service', () => {
  let esignService;

  beforeEach(() => {
    esignService = new ESignatureService();
  });

  describe('createEnvelope', () => {
    it('should create local signing envelope', async () => {
      const result = await esignService.createEnvelope({
        documentId: 'doc-123',
        documentPath: '/path/to/doc.pdf',
        documentName: 'Test Document',
        signers: [
          { email: 'signer@example.com', name: 'Test Signer', role: 'buyer' }
        ],
        subject: 'Please sign this document',
        message: 'Please review and sign'
      });

      expect(result).toHaveProperty('envelopeId');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('signers');
      expect(result.signers).toHaveLength(1);
      expect(result.signers[0]).toHaveProperty('signingUrl');
    });

    it('should create envelope with multiple signers', async () => {
      const result = await esignService.createEnvelope({
        documentId: 'doc-123',
        documentPath: '/path/to/doc.pdf',
        documentName: 'Test Document',
        signers: [
          { email: 'buyer@example.com', name: 'Buyer', role: 'buyer', order: 1 },
          { email: 'seller@example.com', name: 'Seller', role: 'seller', order: 2 }
        ],
        subject: 'Agreement of Purchase and Sale'
      });

      expect(result.signers).toHaveLength(2);
    });
  });

  describe('generateEnvelopeId', () => {
    it('should generate unique envelope IDs', () => {
      const id1 = esignService.generateEnvelopeId();
      const id2 = esignService.generateEnvelopeId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^ENV-\d+-[A-F0-9]+$/);
    });
  });

  describe('processWebhook', () => {
    it('should process signed event', async () => {
      const result = await esignService.processWebhook({
        eventType: 'recipient-signed',
        envelopeId: 'ENV-123',
        data: { recipientEmail: 'signer@example.com' }
      });

      expect(result.action).toBe('signed');
      expect(result.signer).toBe('signer@example.com');
    });

    it('should process completed event', async () => {
      const result = await esignService.processWebhook({
        eventType: 'envelope-completed',
        envelopeId: 'ENV-123'
      });

      expect(result.action).toBe('completed');
    });

    it('should handle unknown events', async () => {
      const result = await esignService.processWebhook({
        eventType: 'unknown-event',
        envelopeId: 'ENV-123'
      });

      expect(result.action).toBe('unknown');
    });
  });
});

describe('Maps Service', () => {
  let mapsService;

  beforeEach(() => {
    mapsService = new MapsService();
  });

  describe('geocodeAddress', () => {
    it('should geocode address string', async () => {
      const result = await mapsService.geocodeAddress('123 Test St, Toronto, ON');

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('location');
      expect(result.location).toHaveProperty('lat');
      expect(result.location).toHaveProperty('lng');
    });

    it('should geocode address object', async () => {
      const result = await mapsService.geocodeAddress({
        street: '123 Test St',
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M5V 1A1'
      });

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('formattedAddress');
    });
  });

  describe('reverseGeocode', () => {
    it('should reverse geocode coordinates', async () => {
      const result = await mapsService.reverseGeocode(43.65, -79.38);

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('formattedAddress');
      expect(result).toHaveProperty('components');
    });
  });

  describe('getDistance', () => {
    it('should calculate distance between two points', async () => {
      const origin = { lat: 43.65, lng: -79.38 };
      const destination = { lat: 43.70, lng: -79.42 };

      const result = await mapsService.getDistance(origin, destination);

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('distance');
      expect(result.distance).toHaveProperty('kilometers');
      expect(result.distance.kilometers).toBeGreaterThan(0);
    });
  });

  describe('getNearbyPlaces', () => {
    it('should find nearby schools', async () => {
      const location = { lat: 43.65, lng: -79.38 };

      const result = await mapsService.getNearbyPlaces(location, 'school');

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('places');
      expect(Array.isArray(result.places)).toBe(true);
    });

    it('should find nearby transit stations', async () => {
      const location = { lat: 43.65, lng: -79.38 };

      const result = await mapsService.getNearbyPlaces(location, 'transit_station');

      expect(result.success).toBe(true);
      expect(result.places.length).toBeGreaterThan(0);
    });
  });

  describe('getNeighborhoodData', () => {
    it('should return comprehensive neighborhood data', async () => {
      const location = { lat: 43.65, lng: -79.38 };

      const result = await mapsService.getNeighborhoodData(location);

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('amenities');
      expect(result).toHaveProperty('walkScore');
      expect(result).toHaveProperty('transitScore');
      expect(result.walkScore).toBeGreaterThanOrEqual(0);
      expect(result.walkScore).toBeLessThanOrEqual(100);
    });
  });

  describe('getStaticMapUrl', () => {
    it('should generate static map URL', () => {
      const location = { lat: 43.65, lng: -79.38 };

      const url = mapsService.getStaticMapUrl(location);

      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
    });

    it('should accept custom options', () => {
      const location = { lat: 43.65, lng: -79.38 };

      const url = mapsService.getStaticMapUrl(location, {
        width: 800,
        height: 600,
        zoom: 18
      });

      expect(typeof url).toBe('string');
    });
  });

  describe('formatAddress', () => {
    it('should format address object to string', () => {
      const address = {
        streetNumber: '123',
        street: 'Test St',
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M5V 1A1'
      };

      const formatted = mapsService.formatAddress(address);

      expect(formatted).toContain('123');
      expect(formatted).toContain('Test St');
      expect(formatted).toContain('Toronto');
      expect(formatted).toContain('Canada');
    });

    it('should handle unit number', () => {
      const address = {
        streetNumber: '123',
        street: 'Test St',
        unit: '456',
        city: 'Toronto',
        province: 'ON'
      };

      const formatted = mapsService.formatAddress(address);

      expect(formatted).toContain('Unit 456');
    });
  });
});
