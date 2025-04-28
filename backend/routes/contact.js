const express = require('express');

// Export a function that accepts the pool parameter
module.exports = (pool) => {
  const router = express.Router();

  /**
   * @route   POST /
   * @desc    Submit contact form
   * @access  Public
   */
  router.post('/', async (req, res) => {
    try {
      // Basic validation
      const { name, email, subject, message } = req.body;
      
      if (!name || !email || !subject || !message) {
        return res.status(400).json({ message: 'Please include all required fields' });
      }
      
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Please include a valid email' });
      }

      // Get user info if authenticated
      let userId = null;
      let username = null;
      
      if (req.headers['x-auth-token']) {
        try {
          // Only try to verify token if one is provided
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(
            req.headers['x-auth-token'], 
            process.env.JWT_SECRET
          );
          
          userId = decoded.user.id;
          
          // Get username from database
          const [userRows] = await pool.query('SELECT username FROM users WHERE id = ?', [userId]);
          if (userRows.length > 0) {
            username = userRows[0].username;
            console.log('Username found:', username);
          }
        } catch (err) {
          console.error('Token error in contact form:', err);
          // Continue without user info
        }
      }

      // Create database table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS contact_submissions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          user_id VARCHAR(100) NULL,
          username VARCHAR(100) NULL,
          submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status ENUM('new', 'in_progress', 'completed') DEFAULT 'new',
          is_read BOOLEAN DEFAULT FALSE,
          admin_notes TEXT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Insert into database
      const query = `
        INSERT INTO contact_submissions 
        (name, email, subject, message, user_id, username, status, is_read) 
        VALUES (?, ?, ?, ?, ?, ?, 'new', 0)
      `;
      
      const [result] = await pool.query(query, [name, email, subject, message, userId, username]);
      
      res.status(200).json({ 
        success: true, 
        message: 'Your message has been sent successfully!',
        submissionId: result.insertId
      });
      
    } catch (err) {
      console.error('Contact submission error:', err);
      res.status(500).json({ message: 'Server error, could not send message' });
    }
  });

  // You can add more contact-related routes here
  
  return router;
};
