const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { check, validationResult } = require('express-validator');

// Load environment variables for email configuration
require('dotenv').config();

/**
 * @route   POST api/contact-us
 * @desc    Submit contact form
 * @access  Public
 */
router.post(
  '/',
  [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('subject', 'Subject is required').not().isEmpty(),
    check('message', 'Message is required').not().isEmpty()
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { name, email, subject, message } = req.body;

    // Get user info if authenticated
    let userId = null;
    let username = null;
    
    if (req.user) {
      userId = req.user.id;
      username = req.user.username;
    }

    try {
      // Configure email transporter
      const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });

      // Create email content
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: process.env.EMAIL_USER, // Send to our own email address
        subject: `PhishGuard Contact: ${subject}`,
        html: `
          <h3>New contact form submission from PhishGuard</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Message:</strong></p>
          <p>${message.replace(/\n/g, '<br>')}</p>
          ${userId ? `<p><strong>User ID:</strong> ${userId}</p>` : ''}
          ${username ? `<p><strong>Username:</strong> ${username}</p>` : ''}
          <hr>
          <p>This message was sent from the PhishGuard contact form.</p>
        `
      };

      // Send email
      await transporter.sendMail(mailOptions);

      // Optional: Log the contact submission to database
      // ...

      res.status(200).json({ success: true, message: 'Message sent successfully' });
    } catch (err) {
      console.error('Contact form error:', err);
      res.status(500).json({ message: 'Server error, could not send message' });
    }
  }
);

module.exports = router;
