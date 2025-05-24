/**
 * Educational Content API Router - Provides security key analysis findings, phishing indicators,
 */
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
      
      // Validate required parameters
      if (!analysisResult) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing analysis result' 
        });
      }
      
      // For debugging
      console.log('Analysis result features count:', 
                 analysisResult.features ? Object.keys(analysisResult.features).length : 
                 (analysisResult.ml_result?.features ? Object.keys(analysisResult.ml_result.features).length : 0));
      
      console.log('Received request with blacklist_id:', analysisResult.blacklist_id || 'None');
      
      // Check if we have a blacklist ID and can retrieve stored findings
      if (analysisResult.blacklist_id) {
        try {
          // Try to get stored findings for this blacklisted URL 
          const [eduContent] = await db.execute(
            'SELECT KeyFeatures FROM EducationalContent WHERE BlacklistID = ? ORDER BY CreatedDate DESC LIMIT 1',
            [analysisResult.blacklist_id]
          );
          
          if (eduContent && eduContent.length > 0 && eduContent[0].KeyFeatures) {
            try {
              // Use stored findings if available
              const storedFindings = JSON.parse(eduContent[0].KeyFeatures);
              if (Array.isArray(storedFindings) && storedFindings.length > 0) {
                console.log(`Using ${storedFindings.length} stored findings for BlacklistID ${analysisResult.blacklist_id}`);
                
                // Make sure all findings have category property for proper UI display
                const enhancedFindings = storedFindings.map(finding => {
                  if (!finding.category) {
                    // Add default category based on content if missing
                    if (finding.text.match(/domain|dns|typo|homograph|idn|parking/i)) {
                      finding.category = 'domain';
                    } else if (finding.text.match(/certificate|ssl|tls|https/i)) {
                      finding.category = 'certificate';
                    } else if (finding.text.match(/url|link|redirect|path|parameter|subdomain/i)) {
                      finding.category = 'url';
                    } else {
                      finding.category = 'other';
                    }
                  }
                  return finding;
                });
                
                return res.json({
                  success: true,
                  findings: enhancedFindings,
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
      const generatedUrl = url || analysisResult.url || "unknown_url";
      
      console.log(`Generating new key findings for URL: ${generatedUrl}`);
      
      // Generate findings
      const findings = educationService.generateKeyFindings(analysisResult, generatedUrl);
      console.log(`Generated ${findings.length} key findings`);
      
      // Store findings in database if we have a blacklist ID
      if (analysisResult.blacklist_id && findings.length > 0 && db) {
        try {
          const keyFeaturesJson = JSON.stringify(findings);
          
          // Query the blacklist to see if it was a system-added entry
          const [blacklistEntry] = await db.execute(
            'SELECT AddedBy, is_system FROM Blacklist WHERE BlacklistID = ?',
            [analysisResult.blacklist_id]
          );
          
          const userId = (blacklistEntry && blacklistEntry.length > 0) ? 
                        blacklistEntry[0].AddedBy : 1;
          const isSystem = (blacklistEntry && blacklistEntry.length > 0) ?
                          (blacklistEntry[0].is_system === 1) : true;
          
          // Add system user ID as CreatedBy and set is_system flag
          await db.execute(
            'INSERT INTO EducationalContent (BlacklistID, KeyFeatures, CreatedDate, CreatedBy, is_system) VALUES (?, ?, NOW(), ?, ?)',
            [analysisResult.blacklist_id, keyFeaturesJson, userId, isSystem ? 1 : 0]
          );
          console.log(`Stored key findings for BlacklistID ${analysisResult.blacklist_id}, Source: ${isSystem ? 'System' : 'Admin'}`);
        } catch (storeErr) {
          console.error("Error storing key findings:", storeErr);
          // Continue anyway - storage failure shouldn't prevent returning findings
        }
      }
      
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
