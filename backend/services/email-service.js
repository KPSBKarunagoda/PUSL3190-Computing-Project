const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');

class EmailService {
  constructor() {
    // Create email transporter with more specific configuration
    this.transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        // Remove any spaces from the password
        pass: process.env.EMAIL_PASSWORD ? process.env.EMAIL_PASSWORD.replace(/\s+/g, '') : ''
      },
      debug: process.env.NODE_ENV !== 'production' // Enable debug output in development
    });
    
    // Log connection status
    this.verifyConnection();
    
    // Load email templates
    this.templates = {
      passwordReset: this._loadTemplate('password-reset.html')
    };
  }
  
  /**
   * Verify SMTP connection on startup
   */
  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('Email server connection established successfully');
    } catch (error) {
      console.error('Email server connection failed:', error.message);
      console.log('Email credentials being used:', {
        service: process.env.EMAIL_SERVICE,
        user: process.env.EMAIL_USER,
        // Don't log the actual password, just indicate if it exists
        passwordProvided: !!process.env.EMAIL_PASSWORD
      });
    }
  }
  
  /**
   * Load an email template from the templates directory
   * @param {string} templateName - Name of the template file
   * @returns {function} Compiled handlebars template
   */
  _loadTemplate(templateName) {
    try {
      const templatePath = path.join(__dirname, '../templates/emails', templateName);
      const templateSource = fs.readFileSync(templatePath, 'utf8');
      return handlebars.compile(templateSource);
    } catch (error) {
      console.error(`Failed to load email template ${templateName}:`, error);
      // Return a simple fallback template function
      return (data) => `<h1>PhishGuard</h1><p>${data.message || 'No message provided'}</p>`;
    }
  }
  
  /**
   * Send a password reset email
   * @param {string} to - Recipient email address
   * @param {object} data - Data for the template (token, resetUrl, username)
   * @returns {Promise} Promise that resolves when email is sent
   */
  async sendPasswordResetEmail(to, data) {
    const html = this.templates.passwordReset({
      resetUrl: data.resetUrl,
      username: data.username || 'User',
      expiryTime: '1 hour'
    });
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"PhishGuard Security" <security@phishguard.com>',
      to,
      subject: 'Reset Your PhishGuard Password',
      html
    };
    
    return this.transporter.sendMail(mailOptions);
  }
  
  /**
   * Send a test email to verify configuration
   * @param {string} to - Recipient email address
   * @returns {Promise} Promise that resolves when email is sent
   */
  async sendTestEmail(to) {
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"PhishGuard Security" <security@phishguard.com>',
      to,
      subject: 'PhishGuard Email Test',
      text: 'This is a test email from PhishGuard to verify email functionality.',
      html: '<h1>PhishGuard Email Test</h1><p>This is a test email to verify that the email service is working correctly.</p>'
    };
    
    return this.transporter.sendMail(mailOptions);
  }
}

module.exports = new EmailService();
