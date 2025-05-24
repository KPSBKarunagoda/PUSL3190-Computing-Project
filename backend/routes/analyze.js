/**
 * URL Analysis Router - Handles URL submission, threat detection, whitelist/blacklist checking,
 * and automated phishing site categorization with educational content generation.
 */
const express = require('express');
const { spawn } = require('child_process');
const ActivityService = require('../services/activity-service');
const EducationService = require('../services/education-service');
const auth = require('../middleware/auth');

// Convert to a function that receives database connection
module.exports = function(db) {
  const router = express.Router();
  const activityService = new ActivityService(db);
  const educationService = new EducationService();

  // Apply authentication middleware but make it optional
  const optionalAuth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) {
      // No token, skip authentication
      console.log('No auth token provided, continuing without user authentication');
      next();
    } else {
      // Token provided, authenticate and attach user
      auth(db)(req, res, next);
    }
  };

  // Helper function for handling educational content with key features
  async function handleEducationalContent(blacklistId, url, riskLevel, response, userId, isSystem = true) {
    try {
      // Create a complete analysis data object with all necessary information
      const analysisData = {
        url: url,
        risk_score: riskLevel,
        blacklist_id: blacklistId,
        
        // Ensure Safe Browsing data is included
        safe_browsing_result: response.safe_browsing_result,
        message: response.message,
        risk_explanation: response.risk_explanation,
        
        // Include any other analysis data that might be useful
        features: response.features || {},
        ml_result: response.ml_result || {}
      };
      
      // Generate key findings
      const eduService = new EducationService();
      const findings = eduService.generateKeyFindings(analysisData, url);
      
      if (findings && findings.length > 0) {
        const keyFeaturesJson = JSON.stringify(findings);
        
        // Store findings in database
        await db.execute(
          'INSERT INTO EducationalContent (BlacklistID, KeyFeatures, CreatedDate, CreatedBy, is_system) VALUES (?, ?, NOW(), ?, ?)',
          [blacklistId, keyFeaturesJson, userId, isSystem ? 1 : 0]
        );
        
        console.log(`Stored educational content for BlacklistID: ${blacklistId}`);
        
        // Add findings to response for immediate display
        response.key_findings = findings;
      }
    } catch (err) {
      console.error('Error creating educational content:', err);
    }
  }

  // Use optional authentication for analyze-url route
  router.post('/analyze-url', optionalAuth, async (req, res) => {
    try {
      // Add debug logging for blacklist checking
      console.log('Analyze URL Request:', req.body);
      
      // Explicitly check if URL is in blacklist first
      const urlToAnalyze = req.body.url;
      console.log(`Checking if URL '${urlToAnalyze}' is in blacklist...`);

      try {
        // Simple URL variations for exact matching only
        const urlObj = new URL(urlToAnalyze);
        const hostname = urlObj.hostname.toLowerCase();
        const urlLower = urlToAnalyze.toLowerCase();
        const urlNoTrailingSlash = urlLower.endsWith('/') ? urlLower.slice(0, -1) : urlLower;
        
        console.log(`Checking blacklist with exact URL matching: ${urlToAnalyze}, ${hostname}`);
        
        // ONLY use exact matching - remove all pattern matching
        const [blacklisted] = await db.execute(
          'SELECT * FROM Blacklist WHERE URL = ? OR URL = ? OR URL = ? OR URL = ?',
          [urlToAnalyze, urlLower, urlNoTrailingSlash, hostname]
        );
        
        if (blacklisted && blacklisted.length > 0) {
          console.log(`URL '${urlToAnalyze}' found in blacklist with exact match: '${blacklisted[0].URL}'`);
          const riskLevel = blacklisted[0].RiskLevel || 100;
          
          // Create the response object
          const response = {
            url: urlToAnalyze,
            risk_score: riskLevel,
            is_phishing: true,
            ml_confidence: 100,
            source: "Blacklist",
            message: `URL is in known phishing blacklist (Risk: ${riskLevel}%)`,
            blacklisted: true,
            blacklist_id: blacklisted[0].BlacklistID // Include the blacklist ID
          };
          
          // Check for educational content and key features
          await handleEducationalContent(blacklisted[0].BlacklistID, urlToAnalyze, riskLevel, response);
          
          // Record activity for blacklisted URLs when user is authenticated
          if (req.user && req.user.id) {
            console.log(`User authenticated (ID: ${req.user.id}), recording blacklist activity...`);
            try {
              // Extract the domain rather than using the full URL
              const domain = new URL(urlToAnalyze).hostname;
              const safeTitle = `Scan: ${domain} (Blacklisted)`;
              
              const activityResult = await activityService.recordActivity(
                req.user.id,
                urlToAnalyze,
                safeTitle,
                riskLevel
              );
              console.log('Blacklist activity recording result:', activityResult);
              
              // Add activity info to response
              response.activity_recorded = true;
              response.activity_result = activityResult;
            } catch (actError) {
              console.error('Failed to record blacklist activity:', actError);
              response.activity_recorded = false;
              response.activity_error = actError.message;
            }
          } else {
            console.log('User not authenticated, skipping blacklist activity recording');
            response.activity_recorded = false;
          }
          
          return res.json(response);
        }
        
        console.log(`URL '${urlToAnalyze}' not found in blacklist`);
      } catch (error) {
        console.error(`Error checking blacklist: ${error.message}`);
        // Continue with analysis even if there was an error checking the blacklist
      }

      const { url, useSafeBrowsing } = req.body;
      
      // Input validation
      if (!url) {
        return res.status(400).json({
          error: 'Missing URL parameter',
          message: 'Please provide a URL to analyze'
        });
      }
      
      // URL validation
      const isValidUrl = (urlString) => {
        try {
          const url = new URL(urlString);
          return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (e) {
          return false;
        }
      };
      
      if (!isValidUrl(url)) {
        return res.status(400).json({
          error: 'Invalid URL format',
          message: 'The provided URL is not valid'
        });
      }
      
      
      // Check whitelist first
      const [whitelisted] = await db.execute(
        'SELECT * FROM Whitelist WHERE URL = ? OR Domain = ?',
        [url, new URL(url).hostname]
      );

      if (whitelisted.length > 0) {
        const response = {
          url: url,
          risk_score: 0,
          is_phishing: false,
          ml_confidence: 100,
          message: 'URL is whitelisted and considered safe',
          features: {
            whitelist_status: 'Approved',
            whitelist_entry: whitelisted[0]
          }
        };
        
        // Record activity for whitelisted URLs when user is authenticated
        if (req.user && req.user.id) {
          console.log(`User authenticated (ID: ${req.user.id}), recording whitelist activity...`);
          try {
            // Extract the domain rather than using the full URL
            const domain = new URL(url).hostname;
            const safeTitle = `Scan: ${domain} (Whitelisted)`;
            
            const activityResult = await activityService.recordActivity(
              req.user.id,
              url,
              safeTitle,
              0  // Risk score 0 for whitelisted URLs
            );
            console.log('Whitelist activity recording result:', activityResult);
            
            // Add activity info to response
            response.activity_recorded = true;
            response.activity_result = activityResult;
          } catch (actError) {
            console.error('Failed to record whitelist activity:', actError);
            response.activity_recorded = false;
            response.activity_error = actError.message;
          }
        } else {
          console.log('User not authenticated, skipping whitelist activity recording');
          response.activity_recorded = false;
        }
        
        return res.json(response);
      }

      // If not whitelisted, continue with Python analysis
      const safeBrowsingFlag = String(Boolean(useSafeBrowsing));
      console.log(`Analyzing URL: ${url}, Safe Browsing enabled: ${safeBrowsingFlag}`);
      
      try {
        const python = spawn('python', [
          'analyze_url.py', 
          url, 
          safeBrowsingFlag
        ]);
        
        let jsonData = '';
        let debugOutput = '';

        python.stdout.on('data', (data) => {
          jsonData += data.toString();
          console.log('Python stdout:', data.toString());
        });

        python.stderr.on('data', (data) => {
          debugOutput += data.toString();
          console.log('Python stderr:', data.toString());
        });

        python.on('close', async (code) => {
          console.log('Python process exited with code', code);
          try {
            if (jsonData.trim()) {
              const result = JSON.parse(jsonData.trim());
              
              // Ensure consistent response structure
              const response = {
                url: url,
                risk_score: result.risk_score || 0,
                is_phishing: result.is_phishing || false,
                risk_explanation: result.risk_explanation || result.message || 'No detailed explanation available',
                features: result.ml_result?.features || {}, 
                ml_confidence: result.ml_confidence || result.ml_result?.confidence || 0,
                timestamp: new Date().toISOString()
              };

              console.log('Analysis result:', {
                url: url,
                is_phishing: response.is_phishing,
                risk_score: response.risk_score,
                ml_confidence: response.ml_confidence
              });
              
              // Auto-blacklist phishing sites -
              if (response.is_phishing || response.risk_score >= 55) {  
                console.log(`Auto-blacklisting detected phishing URL: ${url} (risk: ${response.risk_score})`);
                
                try {
                  // First check if Blacklist table exists
                  const [tables] = await db.execute(`
                    SHOW TABLES LIKE 'Blacklist'
                  `);
                  
                  if (tables.length === 0) {
                    console.log('Creating Blacklist table...');
                    await db.execute(`
                      CREATE TABLE Blacklist (
                        BlacklistID INT AUTO_INCREMENT PRIMARY KEY,
                        URL VARCHAR(512) NOT NULL,
                        RiskLevel INT DEFAULT 100 NOT NULL, 
                        AddedDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        AddedBy INT,
                        is_system TINYINT(1) DEFAULT 0,
                        FOREIGN KEY (AddedBy) REFERENCES User(UserID),
                        UNIQUE INDEX url_idx (URL)
                      )
                    `);
                    console.log('Blacklist table created successfully');
                  }
                  
                  // Check if URL is already in blacklist
                  const [existingBlacklist] = await db.execute(
                    'SELECT * FROM Blacklist WHERE URL = ?', 
                    [url]
                  );
                  
                  if (!existingBlacklist || existingBlacklist.length === 0) {
                    // Get admin user for system-added entries
                    const [adminUsers] = await db.execute(
                      'SELECT UserID FROM User WHERE Role = "Admin" LIMIT 1'
                    );
                    
                    const adminId = adminUsers && adminUsers.length > 0 ? 
                                   adminUsers[0].UserID : 1; // Default to UserID 1 if no admin found
                    
                    console.log(`Using admin ID ${adminId} for blacklist entry`);
                    
                    // Use the exact risk score from analysis instead of enforcing minimum threshold
                    const riskLevel = response.risk_score !== undefined ? 
                                    Math.round(response.risk_score) : 
                                    90; 
                    
                    // Add to blacklist - using the full URL as detected, 
                    try {
                      const [result] = await db.execute(
                        'INSERT INTO Blacklist (URL, RiskLevel, AddedDate, AddedBy, is_system) VALUES (?, ?, NOW(), ?, 1)',
                        [url, riskLevel, adminId]
                      );
                      
                      const insertId = result.insertId;
                      console.log(`✅ Added to blacklist: ${url} (ID: ${insertId}, Risk: ${riskLevel}%, Source: System)`);
                      
                      // Verify the insert was successful by querying the DB again
                      const [verifyInsert] = await db.execute(
                        'SELECT * FROM Blacklist WHERE BlacklistID = ?',
                        [insertId]
                      );
                      
                      if (verifyInsert && verifyInsert.length > 0) {
                        
                        response.blacklisted = true;
                        response.blacklist_id = insertId;
                        response.message = 'URL has been automatically blacklisted for your protection';
                        console.log(`Verified: URL was successfully blacklisted with ID ${insertId}`);
                        
                        // After successfully adding to blacklist, store educational content with key features
                        await handleEducationalContent(insertId, url, riskLevel, response, adminId, true);
                      } else {
                        console.error(`Failed to verify blacklist entry for URL: ${url}`);
                      }
                    } catch (insertError) {
                      console.error('Database error during blacklist insertion:', insertError);
                      if (insertError.code === 'ER_DUP_ENTRY') {
                        console.log('URL already exists in blacklist (caught by duplicate constraint)');
                        response.blacklisted = true;
                        response.message = 'URL is already in blacklist';
                      } else {
                        throw insertError; // Re-throw other errors
                      }
                    }
                  } else {
                    console.log(`URL already in blacklist: ${url}`);
                    response.blacklisted = true;
                    response.blacklist_id = existingBlacklist[0].BlacklistID;
                    response.message = 'URL is already in blacklist';
                    
                    // Get educational content for existing blacklist entry
                    await handleEducationalContent(existingBlacklist[0].BlacklistID, url, existingBlacklist[0].RiskLevel, response);
                  }
                } catch (blacklistError) {
                  console.error('Error during blacklisting:', blacklistError);
                  response.blacklist_error = blacklistError.message;
                  // Continue with the response even if blacklisting fails
                }
              }

              // If user is authenticated, record activity
              if (req.user && req.user.id) {
                console.log(`User authenticated (ID: ${req.user.id}), recording activity...`);
                try {
                  // Extract the domain rather than using the full URL
                  const domain = new URL(url).hostname;
                  const safeTitle = `Scan: ${domain}`;
                  
                  const activityResult = await activityService.recordActivity(
                    req.user.id,
                    url,
                    safeTitle, // Use domain-based title instead of full URL
                    response.risk_score
                  );
                  console.log('Activity recording result:', activityResult);
                  
                  // Add activity info to response
                  response.activity_recorded = true;
                  response.activity_result = activityResult;
                } catch (actError) {
                  console.error('Failed to record activity:', actError);
                  response.activity_recorded = false;
                  response.activity_error = actError.message;
                }
              } else {
                console.log('User not authenticated, skipping activity recording');
                response.activity_recorded = false;
              }

              console.log('Sending analysis response:', response);
              res.json(response);
            } else {
              res.status(500).json({
                error: 'Analysis failed',
                debug: debugOutput
              });
            }
          } catch (e) {
            console.error('JSON parse error:', e);
            res.status(500).json({
              error: 'JSON parse error',
              debug: debugOutput,
              originalError: e.message
            });
          }
        });
      } catch (error) {
        console.error('Python spawn error:', error);
        res.status(500).json({
          error: 'Server error',
          message: error.message
        });
      }

    } catch (error) {
      console.error('Analysis error:', error);
      res.status(500).json({ 
        error: 'Analysis failed',
        message: error.message 
      });
    }
  });

  return router;
};