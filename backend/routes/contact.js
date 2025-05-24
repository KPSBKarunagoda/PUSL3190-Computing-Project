/**
 * Contact Form API Router - Handles user contact submissions with database storage,
 * and provides admin endpoints for managing, tracking, and responding to user inquiries
 * with status updates and admin notes functionality.
 */
const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // User endpoint to submit contact form
  router.post('/', async (req, res) => {
    try {
      // Create the table if it doesn't exist
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

      // Extract data from request body
      const { name, email, subject, message, userId, username } = req.body;

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

  // ADMIN ENDPOINTS - Require admin authentication middleware
  const adminAuth = require('../middleware/admin-auth')(pool);

  // Get all contact submissions for admin
  router.get('/', adminAuth, async (req, res) => {
    try {
      const [submissions] = await pool.query(`
        SELECT * FROM contact_submissions 
        ORDER BY submission_date DESC
      `);
      
      res.json({ 
        submissions, 
        totalCount: submissions.length 
      });
    } catch (err) {
      console.error('Error fetching contact submissions:', err);
      res.status(500).json({ message: 'Server error, could not fetch submissions' });
    }
  });

  // Mark submission as read
  router.put('/:id/read', adminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      await pool.query(`
        UPDATE contact_submissions 
        SET is_read = 1 
        WHERE id = ?
      `, [id]);
      
      res.json({ 
        success: true, 
        message: 'Submission marked as read' 
      });
    } catch (err) {
      console.error('Error marking submission as read:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Update submission status
  router.put('/:id/status', adminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!['new', 'in_progress', 'completed'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      
      await pool.query(`
        UPDATE contact_submissions 
        SET status = ? 
        WHERE id = ?
      `, [status, id]);
      
      res.json({ 
        success: true, 
        message: 'Status updated successfully' 
      });
    } catch (err) {
      console.error('Error updating submission status:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Update admin notes
  router.put('/:id/notes', adminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { admin_notes } = req.body;
      
      await pool.query(`
        UPDATE contact_submissions 
        SET admin_notes = ? 
        WHERE id = ?
      `, [admin_notes, id]);
      
      res.json({ 
        success: true, 
        message: 'Notes updated successfully' 
      });
    } catch (err) {
      console.error('Error updating admin notes:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Delete submission
  router.delete('/:id', adminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      await pool.query(`
        DELETE FROM contact_submissions 
        WHERE id = ?
      `, [id]);
      
      res.json({ 
        success: true, 
        message: 'Submission deleted successfully' 
      });
    } catch (err) {
      console.error('Error deleting submission:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });

  return router;
};
