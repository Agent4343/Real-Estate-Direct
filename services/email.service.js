/**
 * Email Notification Service
 * Handles all email notifications for the real estate platform
 *
 * Note: This is a template service. In production, integrate with:
 * - SendGrid, Mailgun, AWS SES, or similar
 */

class EmailService {
  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@realestatedirect.ca';
    this.appName = 'Real Estate Direct';
    // In production, initialize your email provider here
    // this.client = new SendGridClient(process.env.SENDGRID_API_KEY);
  }

  /**
   * Send email (template method - integrate with your email provider)
   */
  async sendEmail(to, subject, html, text) {
    // In production, send actual email
    console.log(`[EMAIL] To: ${to}`);
    console.log(`[EMAIL] Subject: ${subject}`);
    console.log(`[EMAIL] Preview: ${text?.substring(0, 100)}...`);

    // Simulate sending
    return {
      success: true,
      messageId: `msg_${Date.now()}`,
      to,
      subject
    };
  }

  // ==========================================
  // Offer Notifications
  // ==========================================

  async sendOfferReceived(sellerEmail, data) {
    const subject = `New Offer Received - ${data.propertyAddress}`;
    const html = `
      <h2>You've Received a New Offer!</h2>
      <p>A buyer has submitted an offer on your property.</p>

      <h3>Offer Details:</h3>
      <ul>
        <li><strong>Property:</strong> ${data.propertyAddress}</li>
        <li><strong>Offer Price:</strong> $${data.offerPrice.toLocaleString()}</li>
        <li><strong>Deposit:</strong> $${data.depositAmount.toLocaleString()}</li>
        <li><strong>Closing Date:</strong> ${this.formatDate(data.closingDate)}</li>
        <li><strong>Conditions:</strong> ${data.conditionCount || 0}</li>
        <li><strong>Expires:</strong> ${this.formatDate(data.irrevocableDate)}</li>
      </ul>

      <p><a href="${data.viewUrl}">View Offer Details</a></p>

      <p>Please respond before the irrevocable date.</p>
    `;

    return this.sendEmail(sellerEmail, subject, html, this.stripHtml(html));
  }

  async sendOfferAccepted(buyerEmail, data) {
    const subject = `Congratulations! Your Offer Was Accepted - ${data.propertyAddress}`;
    const html = `
      <h2>Your Offer Has Been Accepted!</h2>
      <p>Congratulations! The seller has accepted your offer.</p>

      <h3>Next Steps:</h3>
      <ol>
        <li>Submit your deposit of $${data.depositAmount.toLocaleString()} within ${data.depositDueDays} days</li>
        ${data.hasConditions ? '<li>Complete your conditions before the deadline</li>' : ''}
        <li>Engage a real estate lawyer to handle closing</li>
        <li>Prepare for closing on ${this.formatDate(data.closingDate)}</li>
      </ol>

      <h3>Transaction Summary:</h3>
      <ul>
        <li><strong>Property:</strong> ${data.propertyAddress}</li>
        <li><strong>Purchase Price:</strong> $${data.purchasePrice.toLocaleString()}</li>
        <li><strong>Closing Date:</strong> ${this.formatDate(data.closingDate)}</li>
      </ul>

      <p><a href="${data.transactionUrl}">View Transaction</a></p>
    `;

    return this.sendEmail(buyerEmail, subject, html, this.stripHtml(html));
  }

  async sendOfferRejected(buyerEmail, data) {
    const subject = `Offer Update - ${data.propertyAddress}`;
    const html = `
      <h2>Offer Update</h2>
      <p>Unfortunately, your offer on ${data.propertyAddress} was not accepted.</p>

      <p>Don't give up! There are many great properties available.</p>

      <p><a href="${data.searchUrl}">Continue Your Search</a></p>
    `;

    return this.sendEmail(buyerEmail, subject, html, this.stripHtml(html));
  }

  async sendCounterOffer(buyerEmail, data) {
    const subject = `Counter-Offer Received - ${data.propertyAddress}`;
    const html = `
      <h2>You've Received a Counter-Offer!</h2>
      <p>The seller has responded with a counter-offer.</p>

      <h3>Counter-Offer Details:</h3>
      <ul>
        <li><strong>Your Original Offer:</strong> $${data.originalPrice.toLocaleString()}</li>
        <li><strong>Counter-Offer Price:</strong> $${data.counterPrice.toLocaleString()}</li>
        <li><strong>Difference:</strong> $${(data.counterPrice - data.originalPrice).toLocaleString()}</li>
        <li><strong>Expires:</strong> ${this.formatDate(data.irrevocableDate)}</li>
      </ul>

      <p><a href="${data.viewUrl}">View and Respond</a></p>

      <p>Please respond before the expiry date.</p>
    `;

    return this.sendEmail(buyerEmail, subject, html, this.stripHtml(html));
  }

  // ==========================================
  // Condition Notifications
  // ==========================================

  async sendConditionReminder(userEmail, data) {
    const subject = `Condition Deadline Approaching - ${data.propertyAddress}`;
    const html = `
      <h2>Condition Deadline Reminder</h2>
      <p>You have a condition deadline approaching.</p>

      <h3>Condition Details:</h3>
      <ul>
        <li><strong>Condition:</strong> ${data.conditionTitle}</li>
        <li><strong>Deadline:</strong> ${this.formatDate(data.deadlineDate)}</li>
        <li><strong>Days Remaining:</strong> ${data.daysRemaining}</li>
      </ul>

      <p>Please ensure you fulfill or waive this condition before the deadline.</p>

      <p><a href="${data.conditionUrl}">Update Condition Status</a></p>
    `;

    return this.sendEmail(userEmail, subject, html, this.stripHtml(html));
  }

  async sendConditionFulfilled(recipientEmail, data) {
    const subject = `Condition Fulfilled - ${data.propertyAddress}`;
    const html = `
      <h2>Condition Update</h2>
      <p>A condition has been fulfilled for your transaction.</p>

      <h3>Details:</h3>
      <ul>
        <li><strong>Condition:</strong> ${data.conditionTitle}</li>
        <li><strong>Status:</strong> ${data.status}</li>
        <li><strong>Resolved:</strong> ${this.formatDate(data.resolvedAt)}</li>
      </ul>

      ${data.allConditionsMet ? '<p><strong>All conditions are now met! The agreement is now firm.</strong></p>' : ''}

      <p><a href="${data.transactionUrl}">View Transaction</a></p>
    `;

    return this.sendEmail(recipientEmail, subject, html, this.stripHtml(html));
  }

  // ==========================================
  // Transaction Notifications
  // ==========================================

  async sendTransactionUpdate(userEmail, data) {
    const subject = `Transaction Update - ${data.propertyAddress}`;
    const html = `
      <h2>Transaction Update</h2>
      <p>Your transaction has progressed to the next step.</p>

      <h3>Current Status:</h3>
      <ul>
        <li><strong>Step:</strong> ${data.currentStep}</li>
        <li><strong>Status:</strong> ${data.status}</li>
        <li><strong>Next Action:</strong> ${data.nextAction}</li>
      </ul>

      <p><a href="${data.transactionUrl}">View Transaction Details</a></p>
    `;

    return this.sendEmail(userEmail, subject, html, this.stripHtml(html));
  }

  async sendClosingReminder(userEmail, data) {
    const subject = `Closing in ${data.daysUntilClosing} Days - ${data.propertyAddress}`;
    const html = `
      <h2>Closing Date Approaching</h2>
      <p>Your closing date is coming up!</p>

      <h3>Details:</h3>
      <ul>
        <li><strong>Property:</strong> ${data.propertyAddress}</li>
        <li><strong>Closing Date:</strong> ${this.formatDate(data.closingDate)}</li>
        <li><strong>Days Remaining:</strong> ${data.daysUntilClosing}</li>
      </ul>

      <h3>Checklist:</h3>
      <ul>
        <li>Confirm with your lawyer/notary</li>
        <li>Arrange closing funds</li>
        <li>Schedule final walkthrough</li>
        <li>Arrange moving and utilities</li>
      </ul>

      <p><a href="${data.transactionUrl}">View Transaction</a></p>
    `;

    return this.sendEmail(userEmail, subject, html, this.stripHtml(html));
  }

  async sendTransactionComplete(userEmail, data) {
    const subject = `Congratulations! Transaction Complete - ${data.propertyAddress}`;
    const html = `
      <h2>🎉 Congratulations!</h2>
      <p>Your real estate transaction has been completed successfully.</p>

      <h3>Transaction Summary:</h3>
      <ul>
        <li><strong>Property:</strong> ${data.propertyAddress}</li>
        <li><strong>Final Price:</strong> $${data.purchasePrice.toLocaleString()}</li>
        <li><strong>Closing Date:</strong> ${this.formatDate(data.closingDate)}</li>
      </ul>

      ${data.isBuyer ? '<p>Welcome to your new home!</p>' : '<p>Thank you for using Real Estate Direct.</p>'}

      <p><a href="${data.documentsUrl}">Download Transaction Documents</a></p>
    `;

    return this.sendEmail(userEmail, subject, html, this.stripHtml(html));
  }

  // ==========================================
  // Document Notifications
  // ==========================================

  async sendDocumentForSignature(recipientEmail, data) {
    const subject = `Document Ready for Signature - ${data.documentTitle}`;
    const html = `
      <h2>Document Ready for Your Signature</h2>
      <p>A document requires your signature.</p>

      <h3>Document Details:</h3>
      <ul>
        <li><strong>Document:</strong> ${data.documentTitle}</li>
        <li><strong>From:</strong> ${data.senderName}</li>
        <li><strong>Property:</strong> ${data.propertyAddress}</li>
      </ul>

      <p><a href="${data.signUrl}">Review and Sign Document</a></p>

      <p>Please sign at your earliest convenience.</p>
    `;

    return this.sendEmail(recipientEmail, subject, html, this.stripHtml(html));
  }

  async sendDocumentSigned(recipientEmail, data) {
    const subject = `Document Signed - ${data.documentTitle}`;
    const html = `
      <h2>Document Has Been Signed</h2>
      <p>${data.signerName} has signed the document.</p>

      <h3>Details:</h3>
      <ul>
        <li><strong>Document:</strong> ${data.documentTitle}</li>
        <li><strong>Signed By:</strong> ${data.signerName}</li>
        <li><strong>Signed At:</strong> ${this.formatDate(data.signedAt)}</li>
      </ul>

      ${data.allSigned ? '<p><strong>All signatures have been collected!</strong></p>' : `<p>Waiting for: ${data.pendingSigners.join(', ')}</p>`}

      <p><a href="${data.documentUrl}">View Document</a></p>
    `;

    return this.sendEmail(recipientEmail, subject, html, this.stripHtml(html));
  }

  // ==========================================
  // Account Notifications
  // ==========================================

  async sendWelcome(userEmail, data) {
    const subject = `Welcome to Real Estate Direct!`;
    const html = `
      <h2>Welcome to Real Estate Direct!</h2>
      <p>Hi ${data.name},</p>
      <p>Thank you for joining Real Estate Direct, your platform for buying and selling real estate in Canada.</p>

      <h3>Get Started:</h3>
      <ul>
        <li><a href="${data.searchUrl}">Browse Properties</a></li>
        <li><a href="${data.listUrl}">List Your Property</a></li>
        <li><a href="${data.profileUrl}">Complete Your Profile</a></li>
      </ul>

      <p>If you have any questions, we're here to help!</p>
    `;

    return this.sendEmail(userEmail, subject, html, this.stripHtml(html));
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  formatDate(date) {
    if (!date) return 'TBD';
    return new Date(date).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}

module.exports = new EmailService();
