const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const EducationService = require('../services/education-service');

// Initialize services
const educationService = new EducationService();

/**
 * @route   POST /api/education/key-findings
 * @desc    Get key findings for a URL analysis result
 * @access  Public (no auth required)
 */
router.post('/key-findings', async (req, res) => {
  console.log('Key findings endpoint called');
  try {
    const { url, analysisResult } = req.body;
    
    if (!url || !analysisResult) {
      console.log('Missing required data in key-findings request');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required data' 
      });
    }
    
    console.log(`Generating key findings for URL: ${url}`);
    
    // Generate findings
    const findings = educationService.generateKeyFindings(analysisResult, url);
    console.log(`Generated ${findings.length} key findings`);
    
    return res.json({
      success: true,
      findings
    });
  } catch (error) {
    console.error('Error generating key findings:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/education/resources
 * @desc    Get educational resources on phishing security
 * @access  Private (requires authentication)
 */
router.get('/resources', auth, async (req, res) => {
  try {
    // Educational resources response
    const resources = [
      {
        title: "Recognizing Phishing Emails",
        description: "Learn how to identify suspicious emails that may be phishing attempts",
        url: "/education/phishing-emails"
      },
      {
        title: "URL Safety Tips",
        description: "How to check if a URL is safe before visiting it",
        url: "/education/url-safety"
      },
      {
        title: "Password Security",
        description: "Best practices for creating and managing secure passwords",
        url: "/education/password-security"
      }
    ];
    
    return res.json({ success: true, resources });
  } catch (error) {
    console.error('Error fetching educational resources:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
