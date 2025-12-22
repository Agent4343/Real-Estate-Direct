const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * PDF Form Generator Service
 * Generates province-specific real estate forms
 */
class PDFGenerator {
  constructor() {
    this.outputDir = path.join(__dirname, '../generated-documents');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate Agreement of Purchase and Sale
   */
  async generateAgreementOfPurchaseSale(data, province = 'ON') {
    const doc = new PDFDocument({ margin: 50 });
    const fileName = `APS_${data.transactionId || Date.now()}.pdf`;
    const filePath = path.join(this.outputDir, fileName);
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // Header
    this.addHeader(doc, province);

    // Title
    doc.fontSize(16).font('Helvetica-Bold')
      .text('AGREEMENT OF PURCHASE AND SALE', { align: 'center' });
    doc.moveDown();

    if (province === 'QC') {
      doc.fontSize(12).text('(Promise to Purchase / Promesse d\'achat)', { align: 'center' });
      doc.moveDown();
    }

    // Form number
    const formNumbers = {
      ON: 'OREA Form 100',
      BC: 'Contract of Purchase and Sale',
      AB: 'AREA Residential Purchase Contract',
      QC: 'OACIQ Promise to Purchase'
    };
    doc.fontSize(10).font('Helvetica')
      .text(formNumbers[province] || 'Standard Form', { align: 'right' });
    doc.moveDown(2);

    // Parties
    doc.fontSize(12).font('Helvetica-Bold').text('PARTIES TO THE AGREEMENT');
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10);

    doc.text(`BUYER: ${data.buyerName || '_____________________________'}`);
    doc.text(`Address: ${data.buyerAddress || '_____________________________'}`);
    doc.moveDown();

    doc.text(`SELLER: ${data.sellerName || '_____________________________'}`);
    doc.text(`Address: ${data.sellerAddress || '_____________________________'}`);
    doc.moveDown(2);

    // Property
    doc.fontSize(12).font('Helvetica-Bold').text('PROPERTY');
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10);

    doc.text(`Address: ${data.propertyAddress || '_____________________________'}`);
    doc.text(`Legal Description: ${data.legalDescription || '_____________________________'}`);
    doc.moveDown(2);

    // Purchase Price
    doc.fontSize(12).font('Helvetica-Bold').text('PURCHASE PRICE');
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10);

    const price = data.purchasePrice ? `$${data.purchasePrice.toLocaleString()}` : '$_____________';
    doc.text(`Purchase Price: ${price} (Canadian Dollars)`);
    doc.moveDown();

    // Deposit
    const deposit = data.depositAmount ? `$${data.depositAmount.toLocaleString()}` : '$_____________';
    doc.text(`Deposit: ${deposit}`);
    doc.text(`Deposit to be held in trust by: ${data.depositHolder || '_____________________________'}`);
    doc.moveDown(2);

    // Dates
    doc.fontSize(12).font('Helvetica-Bold').text('KEY DATES');
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10);

    doc.text(`Irrevocable Date: ${this.formatDate(data.irrevocableDate)}`);
    doc.text(`Closing Date: ${this.formatDate(data.closingDate)}`);
    doc.text(`Possession Date: ${this.formatDate(data.possessionDate || data.closingDate)}`);
    doc.moveDown(2);

    // Conditions
    if (data.conditions && data.conditions.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('CONDITIONS');
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10);

      data.conditions.forEach((condition, index) => {
        doc.text(`${index + 1}. ${condition.title || condition.type}`);
        doc.text(`   Deadline: ${condition.deadlineDays} days from acceptance`);
        if (condition.description) {
          doc.text(`   ${condition.description}`, { indent: 20 });
        }
        doc.moveDown(0.5);
      });
      doc.moveDown();
    }

    // Inclusions/Exclusions
    if (data.inclusions && data.inclusions.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('INCLUSIONS');
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10);
      doc.text(data.inclusions.join(', '));
      doc.moveDown();
    }

    if (data.exclusions && data.exclusions.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('EXCLUSIONS');
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10);
      doc.text(data.exclusions.join(', '));
      doc.moveDown();
    }

    // Signatures
    doc.addPage();
    this.addSignatureSection(doc, data);

    // Footer
    this.addFooter(doc, province);

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve({ filePath, fileName }));
      stream.on('error', reject);
    });
  }

  /**
   * Generate Property Disclosure Statement
   */
  async generatePropertyDisclosure(data, province = 'ON') {
    const doc = new PDFDocument({ margin: 50 });
    const fileName = `PDS_${data.propertyId || Date.now()}.pdf`;
    const filePath = path.join(this.outputDir, fileName);
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    this.addHeader(doc, province);

    const titles = {
      ON: 'SELLER PROPERTY INFORMATION STATEMENT',
      BC: 'PROPERTY DISCLOSURE STATEMENT',
      AB: 'PROPERTY DISCLOSURE STATEMENT',
      QC: 'SELLER\'S DECLARATION'
    };

    doc.fontSize(16).font('Helvetica-Bold')
      .text(titles[province] || 'PROPERTY DISCLOSURE STATEMENT', { align: 'center' });
    doc.moveDown(2);

    // Property Info
    doc.fontSize(12).font('Helvetica-Bold').text('PROPERTY INFORMATION');
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10);

    doc.text(`Address: ${data.propertyAddress || '_____________________________'}`);
    doc.text(`Property Type: ${data.propertyType || '_____________________________'}`);
    doc.moveDown(2);

    // Disclosure Sections
    const sections = [
      { title: 'GENERAL', questions: [
        'Are you aware of any structural problems with the building?',
        'Are you aware of any water damage or moisture problems?',
        'Are you aware of any problems with the heating/cooling system?',
        'Are you aware of any problems with the plumbing system?',
        'Are you aware of any problems with the electrical system?'
      ]},
      { title: 'ENVIRONMENTAL', questions: [
        'Are you aware of any environmental problems on the property?',
        'Has the property ever been used for the growth or manufacture of illegal substances?',
        'Are you aware of any underground storage tanks on the property?',
        'Is the property located in a flood plain?'
      ]},
      { title: 'LEGAL', questions: [
        'Are there any encroachments, easements, or rights-of-way?',
        'Are you aware of any zoning violations?',
        'Are there any pending legal actions involving the property?',
        'Are there any outstanding work orders or deficiency notices?'
      ]}
    ];

    sections.forEach(section => {
      doc.fontSize(12).font('Helvetica-Bold').text(section.title);
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10);

      section.questions.forEach((question, index) => {
        doc.text(`${index + 1}. ${question}`);
        doc.text('   [ ] Yes  [ ] No  [ ] Unknown', { indent: 20 });
        doc.moveDown(0.3);
      });
      doc.moveDown();
    });

    // Seller Declaration
    doc.addPage();
    doc.fontSize(12).font('Helvetica-Bold').text('SELLER\'S DECLARATION');
    doc.moveDown();
    doc.font('Helvetica').fontSize(10);
    doc.text('The Seller states that the information contained in this disclosure is true, based on the Seller\'s current actual knowledge as of the date signed. The Seller acknowledges that any misrepresentation may result in legal action.');
    doc.moveDown(2);

    // Signature
    doc.text('Seller Signature: _____________________________');
    doc.text(`Date: ${this.formatDate(new Date())}`);

    this.addFooter(doc, province);

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve({ filePath, fileName }));
      stream.on('error', reject);
    });
  }

  /**
   * Generate Condition Waiver
   */
  async generateConditionWaiver(data, province = 'ON') {
    const doc = new PDFDocument({ margin: 50 });
    const fileName = `Waiver_${data.conditionId || Date.now()}.pdf`;
    const filePath = path.join(this.outputDir, fileName);
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    this.addHeader(doc, province);

    doc.fontSize(16).font('Helvetica-Bold')
      .text('NOTICE OF FULFILLMENT OF CONDITION', { align: 'center' });
    doc.moveDown();

    const formNumbers = { ON: 'OREA Form 408', BC: 'Subject Removal Form', NS: 'Form 408' };
    doc.fontSize(10).font('Helvetica')
      .text(formNumbers[province] || 'Condition Waiver', { align: 'right' });
    doc.moveDown(2);

    doc.font('Helvetica').fontSize(10);
    doc.text(`RE: Property at ${data.propertyAddress || '_____________________________'}`);
    doc.moveDown();
    doc.text(`Agreement dated: ${this.formatDate(data.agreementDate)}`);
    doc.text(`Between Buyer: ${data.buyerName || '_____________________________'}`);
    doc.text(`And Seller: ${data.sellerName || '_____________________________'}`);
    doc.moveDown(2);

    doc.text('The Buyer hereby confirms that the following condition(s) have been:');
    doc.moveDown();
    doc.text('[ ] FULFILLED   [ ] WAIVED');
    doc.moveDown(2);

    doc.fontSize(12).font('Helvetica-Bold').text('CONDITION:');
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10);
    doc.text(data.conditionDescription || '_____________________________');
    doc.moveDown(2);

    doc.text('The Buyer acknowledges that the Agreement of Purchase and Sale remains in full force and effect.');
    doc.moveDown(3);

    doc.text('Buyer Signature: _____________________________');
    doc.text(`Date: ${this.formatDate(new Date())}`);

    this.addFooter(doc, province);

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve({ filePath, fileName }));
      stream.on('error', reject);
    });
  }

  /**
   * Generate Statement of Adjustments
   */
  async generateStatementOfAdjustments(data, province = 'ON') {
    const doc = new PDFDocument({ margin: 50 });
    const fileName = `SOA_${data.transactionId || Date.now()}.pdf`;
    const filePath = path.join(this.outputDir, fileName);
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    this.addHeader(doc, province);

    doc.fontSize(16).font('Helvetica-Bold')
      .text('STATEMENT OF ADJUSTMENTS', { align: 'center' });
    doc.moveDown(2);

    // Property and parties
    doc.fontSize(10).font('Helvetica');
    doc.text(`Property: ${data.propertyAddress}`);
    doc.text(`Closing Date: ${this.formatDate(data.closingDate)}`);
    doc.text(`Buyer: ${data.buyerName}`);
    doc.text(`Seller: ${data.sellerName}`);
    doc.moveDown(2);

    // Table header
    const tableTop = doc.y;
    doc.font('Helvetica-Bold');
    doc.text('ITEM', 50, tableTop);
    doc.text('CREDIT BUYER', 300, tableTop);
    doc.text('CREDIT SELLER', 420, tableTop);
    doc.moveDown();

    // Draw line
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    // Items
    doc.font('Helvetica');
    const items = [
      { name: 'Purchase Price', buyer: '', seller: data.purchasePrice },
      { name: 'Deposit', buyer: data.depositAmount, seller: '' },
      { name: 'Property Tax Adjustment', buyer: data.propertyTaxCredit || 0, seller: data.propertyTaxDebit || 0 },
      { name: 'Utility Adjustments', buyer: data.utilityCredit || 0, seller: data.utilityDebit || 0 }
    ];

    if (data.condoFees) {
      items.push({ name: 'Condo Fee Adjustment', buyer: data.condoFeeCredit || 0, seller: data.condoFeeDebit || 0 });
    }

    items.forEach(item => {
      doc.text(item.name, 50);
      doc.text(item.buyer ? `$${item.buyer.toLocaleString()}` : '', 300, doc.y - 12);
      doc.text(item.seller ? `$${item.seller.toLocaleString()}` : '', 420, doc.y - 12);
      doc.moveDown(0.5);
    });

    // Totals
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    const totalBuyer = (data.depositAmount || 0) + (data.propertyTaxCredit || 0) + (data.utilityCredit || 0);
    const totalSeller = (data.purchasePrice || 0) + (data.propertyTaxDebit || 0) + (data.utilityDebit || 0);
    const balanceDue = totalSeller - totalBuyer;

    doc.font('Helvetica-Bold');
    doc.text('TOTALS', 50);
    doc.text(`$${totalBuyer.toLocaleString()}`, 300, doc.y - 12);
    doc.text(`$${totalSeller.toLocaleString()}`, 420, doc.y - 12);
    doc.moveDown();

    doc.text(`BALANCE DUE ON CLOSING: $${balanceDue.toLocaleString()}`, 50);

    this.addFooter(doc, province);

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve({ filePath, fileName }));
      stream.on('error', reject);
    });
  }

  // Helper methods
  addHeader(doc, province) {
    doc.fontSize(10).font('Helvetica')
      .text('REAL ESTATE DIRECT', { align: 'left' });
    doc.text(`Province: ${province}`, { align: 'right' });
    doc.moveDown(2);
  }

  addFooter(doc, province) {
    const disclaimers = {
      ON: 'This form is provided for convenience only. Consult with a licensed real estate lawyer.',
      QC: 'This form is provided for convenience only. Consult with a licensed notary.',
      default: 'This form is provided for convenience only. Consult with a licensed legal professional.'
    };

    doc.fontSize(8).font('Helvetica')
      .text(disclaimers[province] || disclaimers.default, 50, doc.page.height - 50, {
        align: 'center',
        width: doc.page.width - 100
      });
  }

  addSignatureSection(doc, data) {
    doc.fontSize(12).font('Helvetica-Bold').text('SIGNATURES');
    doc.moveDown(2);

    doc.font('Helvetica').fontSize(10);

    // Buyer
    doc.text('BUYER:');
    doc.moveDown();
    doc.text('Signature: _____________________________');
    doc.text(`Name: ${data.buyerName || '_____________________________'}`);
    doc.text('Date: _____________________________');
    doc.moveDown(2);

    // Seller
    doc.text('SELLER:');
    doc.moveDown();
    doc.text('Signature: _____________________________');
    doc.text(`Name: ${data.sellerName || '_____________________________'}`);
    doc.text('Date: _____________________________');
    doc.moveDown(2);

    // Witness
    doc.text('WITNESS:');
    doc.moveDown();
    doc.text('Signature: _____________________________');
    doc.text('Name: _____________________________');
    doc.text('Date: _____________________________');
  }

  formatDate(date) {
    if (!date) return '_____________________________';
    const d = new Date(date);
    return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  }
}

module.exports = new PDFGenerator();
