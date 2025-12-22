/**
 * Email Notification Service
 * Handles all email notifications for the real estate platform
 *
 * Supports: SendGrid, Mailgun, AWS SES, or local development mode
 */

class EmailService {
  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@realestatedirect.ca';
    this.fromName = process.env.EMAIL_FROM_NAME || 'Real Estate Direct';
    this.appName = 'Real Estate Direct';
    this.provider = process.env.EMAIL_PROVIDER || 'local'; // sendgrid, mailgun, ses, local

    // Provider-specific configurations
    this.sendgridApiKey = process.env.SENDGRID_API_KEY;
    this.mailgunApiKey = process.env.MAILGUN_API_KEY;
    this.mailgunDomain = process.env.MAILGUN_DOMAIN;
    this.awsRegion = process.env.AWS_REGION || 'us-east-1';
  }

  /**
   * Send email using configured provider
   */
  async sendEmail(to, subject, html, text) {
    const emailData = {
      from: { email: this.fromEmail, name: this.fromName },
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text: text || this.stripHtml(html)
    };

    try {
      switch (this.provider) {
        case 'sendgrid':
          return await this.sendWithSendGrid(emailData);
        case 'mailgun':
          return await this.sendWithMailgun(emailData);
        case 'ses':
          return await this.sendWithSES(emailData);
        default:
          return await this.sendLocal(emailData);
      }
    } catch (error) {
      console.error(`[EMAIL ERROR] ${error.message}`);
      // Return error but don't throw - email failures shouldn't break the app
      return {
        success: false,
        error: error.message,
        to,
        subject
      };
    }
  }

  /**
   * Send email via SendGrid
   */
  async sendWithSendGrid(emailData) {
    if (!this.sendgridApiKey) {
      console.warn('[EMAIL] SendGrid API key not configured, falling back to local');
      return this.sendLocal(emailData);
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.sendgridApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: emailData.to.map(email => ({ email }))
        }],
        from: emailData.from,
        subject: emailData.subject,
        content: [
          { type: 'text/plain', value: emailData.text },
          { type: 'text/html', value: emailData.html }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid error: ${error}`);
    }

    const messageId = response.headers.get('x-message-id') || `sg_${Date.now()}`;

    console.log(`[EMAIL] Sent via SendGrid: ${emailData.subject} to ${emailData.to.join(', ')}`);

    return {
      success: true,
      provider: 'sendgrid',
      messageId,
      to: emailData.to,
      subject: emailData.subject
    };
  }

  /**
   * Send email via Mailgun
   */
  async sendWithMailgun(emailData) {
    if (!this.mailgunApiKey || !this.mailgunDomain) {
      console.warn('[EMAIL] Mailgun not configured, falling back to local');
      return this.sendLocal(emailData);
    }

    const formData = new URLSearchParams();
    formData.append('from', `${emailData.from.name} <${emailData.from.email}>`);
    emailData.to.forEach(to => formData.append('to', to));
    formData.append('subject', emailData.subject);
    formData.append('text', emailData.text);
    formData.append('html', emailData.html);

    const response = await fetch(
      `https://api.mailgun.net/v3/${this.mailgunDomain}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${this.mailgunApiKey}`).toString('base64')}`
        },
        body: formData
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mailgun error: ${error}`);
    }

    const result = await response.json();

    console.log(`[EMAIL] Sent via Mailgun: ${emailData.subject} to ${emailData.to.join(', ')}`);

    return {
      success: true,
      provider: 'mailgun',
      messageId: result.id,
      to: emailData.to,
      subject: emailData.subject
    };
  }

  /**
   * Send email via AWS SES
   */
  async sendWithSES(emailData) {
    // AWS SES requires the AWS SDK - check if available
    try {
      const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

      const client = new SESClient({ region: this.awsRegion });

      const command = new SendEmailCommand({
        Source: `${emailData.from.name} <${emailData.from.email}>`,
        Destination: {
          ToAddresses: emailData.to
        },
        Message: {
          Subject: { Data: emailData.subject },
          Body: {
            Text: { Data: emailData.text },
            Html: { Data: emailData.html }
          }
        }
      });

      const result = await client.send(command);

      console.log(`[EMAIL] Sent via SES: ${emailData.subject} to ${emailData.to.join(', ')}`);

      return {
        success: true,
        provider: 'ses',
        messageId: result.MessageId,
        to: emailData.to,
        subject: emailData.subject
      };
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        console.warn('[EMAIL] AWS SDK not installed, falling back to local');
        return this.sendLocal(emailData);
      }
      throw error;
    }
  }

  /**
   * Local development mode - logs email to console
   */
  async sendLocal(emailData) {
    console.log('\n========== EMAIL (Local Mode) ==========');
    console.log(`To: ${emailData.to.join(', ')}`);
    console.log(`From: ${emailData.from.name} <${emailData.from.email}>`);
    console.log(`Subject: ${emailData.subject}`);
    console.log('-----------------------------------------');
    console.log(`Preview: ${emailData.text?.substring(0, 200)}...`);
    console.log('=========================================\n');

    return {
      success: true,
      provider: 'local',
      messageId: `local_${Date.now()}`,
      to: emailData.to,
      subject: emailData.subject
    };
  }

  /**
   * Send bulk emails (for notifications to multiple users)
   */
  async sendBulk(recipients) {
    const results = await Promise.allSettled(
      recipients.map(r => this.sendEmail(r.email, r.subject, r.html, r.text))
    );

    return {
      total: recipients.length,
      sent: results.filter(r => r.status === 'fulfilled' && r.value.success).length,
      failed: results.filter(r => r.status === 'rejected' || !r.value?.success).length,
      results
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
  // Messaging Notifications
  // ==========================================

  async sendNewMessage(recipientEmail, data) {
    const subject = `New Message from ${data.senderName}`;
    const html = `
      <h2>You Have a New Message</h2>
      <p>Hi ${data.recipientName},</p>
      <p><strong>${data.senderName}</strong> has sent you a message${data.propertyAddress ? ` regarding ${data.propertyAddress}` : ''}.</p>

      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p style="margin: 0; font-style: italic;">"${data.messagePreview}..."</p>
      </div>

      <p><a href="${data.messageUrl}">View Full Conversation</a></p>
    `;

    return this.sendEmail(recipientEmail, subject, html, this.stripHtml(html));
  }

  // ==========================================
  // Commission/Payment Notifications
  // ==========================================

  async sendCommissionInvoice(sellerEmail, data) {
    const subject = `Platform Commission Invoice - ${data.propertyAddress}`;
    const html = `
      <h2>Platform Commission Invoice</h2>
      <p>Hi ${data.sellerName},</p>
      <p>Congratulations on your successful sale! Here is your platform commission invoice.</p>

      <h3>Invoice Details:</h3>
      <ul>
        <li><strong>Property:</strong> ${data.propertyAddress}</li>
        <li><strong>Sale Price:</strong> $${data.salePrice.toLocaleString()}</li>
        <li><strong>Commission Rate:</strong> ${(data.commissionRate * 100).toFixed(1)}%</li>
        <li><strong>Amount Due:</strong> $${data.commissionAmount.toLocaleString()}</li>
        <li><strong>Due Date:</strong> ${this.formatDate(data.dueDate)}</li>
      </ul>

      <p><a href="${data.paymentUrl}">Pay Now</a></p>

      <p>Thank you for using Real Estate Direct. You saved approximately $${data.savingsAmount.toLocaleString()} compared to traditional real estate commissions!</p>
    `;

    return this.sendEmail(sellerEmail, subject, html, this.stripHtml(html));
  }

  async sendPaymentConfirmation(sellerEmail, data) {
    const subject = `Payment Confirmed - Commission for ${data.propertyAddress}`;
    const html = `
      <h2>Payment Confirmed</h2>
      <p>Hi ${data.sellerName},</p>
      <p>Thank you! Your commission payment has been received.</p>

      <h3>Payment Details:</h3>
      <ul>
        <li><strong>Property:</strong> ${data.propertyAddress}</li>
        <li><strong>Amount Paid:</strong> $${data.amountPaid.toLocaleString()}</li>
        <li><strong>Payment Date:</strong> ${this.formatDate(data.paymentDate)}</li>
        <li><strong>Reference:</strong> ${data.paymentReference}</li>
      </ul>

      <p>Thank you for using Real Estate Direct!</p>
    `;

    return this.sendEmail(sellerEmail, subject, html, this.stripHtml(html));
  }

  async sendPaymentReminder(sellerEmail, data) {
    const subject = `Payment Reminder - Commission Due for ${data.propertyAddress}`;
    const html = `
      <h2>Payment Reminder</h2>
      <p>Hi ${data.sellerName},</p>
      <p>This is a friendly reminder that your platform commission payment is due.</p>

      <h3>Invoice Details:</h3>
      <ul>
        <li><strong>Property:</strong> ${data.propertyAddress}</li>
        <li><strong>Amount Due:</strong> $${data.amountDue.toLocaleString()}</li>
        <li><strong>Due Date:</strong> ${this.formatDate(data.dueDate)}</li>
        <li><strong>Days Overdue:</strong> ${data.daysOverdue || 0}</li>
      </ul>

      <p><a href="${data.paymentUrl}">Pay Now</a></p>

      <p>If you have any questions, please contact us.</p>
    `;

    return this.sendEmail(sellerEmail, subject, html, this.stripHtml(html));
  }

  // ==========================================
  // Password Reset
  // ==========================================

  async sendPasswordReset(userEmail, data) {
    const subject = `Password Reset Request - Real Estate Direct`;
    const html = `
      <h2>Password Reset Request</h2>
      <p>Hi ${data.name},</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>

      <p style="text-align: center;">
        <a href="${data.resetUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a>
      </p>

      <p>This link will expire in ${data.expiresInHours || 1} hour(s).</p>

      <p>If you didn't request this reset, you can safely ignore this email. Your password will remain unchanged.</p>
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
