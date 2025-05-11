const express = require('express');
const auth = require('../middleware/auth');
const EducationService = require('../services/education-service');

// Convert to a function that receives database connection
module.exports = function(db) {
  const router = express.Router();
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
      
      console.log('Received request with blacklist_id:', analysisResult.blacklist_id || 'None');
      
      // Check if we have a blacklist ID and can retrieve stored findings
      if (analysisResult.blacklist_id) {
        try {
          // Try to get stored findings for this blacklisted URL - use db parameter instead of req.db
          const [eduContent] = await db.execute(
            'SELECT KeyFeatures FROM EducationalContent WHERE BlacklistID = ? ORDER BY CreatedDate DESC LIMIT 1',
            [analysisResult.blacklist_id]
          );
          
          if (eduContent && eduContent.length > 0 && eduContent[0].KeyFeatures) {
            try {
              // Use stored findings if available
              const storedFindings = JSON.parse(eduContent[0].KeyFeatures);
              if (storedFindings && storedFindings.length > 0) {
                console.log(`Using ${storedFindings.length} stored findings for BlacklistID ${analysisResult.blacklist_id}`);
                return res.json({
                  success: true,
                  findings: storedFindings,
                  source: "database"
                });
              }
            } catch (err) {
              console.error("Error parsing stored features:", err);
            }
          } else {
            console.log(`No educational content found for BlacklistID ${analysisResult.blacklist_id}`);
          }
        } catch (dbErr) {
          console.error("Error querying educational content:", dbErr);
        }
      }
      
      // If no stored findings or error occurred, generate new findings
      if (!url || !analysisResult) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required data' 
        });
      }
      
      console.log(`Generating new key findings for URL: ${url}`);
      
      // Generate findings
      const findings = educationService.generateKeyFindings(analysisResult, url);
      console.log(`Generated ${findings.length} key findings`);
      
      return res.json({
        success: true,
        findings,
        source: "generated"
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
  router.get('/resources', auth(db), async (req, res) => {
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

  return router;
};
