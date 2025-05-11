const express = require('express');
const { spawn } = require('child_process');
const ActivityService = require('../services/activity-service');
const auth = require('../middleware/auth');

// Convert to a function that receives database connection
module.exports = function(db) {
  const router = express.Router();
  const activityService = new ActivityService(db);

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
          return res.json({
            url: urlToAnalyze,
            risk_score: riskLevel,
            is_phishing: true,
            ml_confidence: 100,
            source: "Blacklist",
            message: `URL is in known phishing blacklist (Risk: ${riskLevel}%)`
          });
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
      
      // Now db is properly defined from the function parameter
      // Check whitelist first
      const [whitelisted] = await db.execute(
        'SELECT * FROM Whitelist WHERE URL = ? OR Domain = ?',
        [url, new URL(url).hostname]
      );

      if (whitelisted.length > 0) {
        return res.json({
          url: url,
          risk_score: 0,
          is_phishing: false,
          ml_confidence: 100,
          message: 'URL is whitelisted and considered safe',
          features: {
            whitelist_status: 'Approved',
            whitelist_entry: whitelisted[0]
          }
        });
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

        // Fix: Add 'async' keyword to make this callback an async function
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
                features: result.ml_result?.features || {}, // Include the features from ml_result
                ml_confidence: result.ml_confidence || result.ml_result?.confidence || 0,
                timestamp: new Date().toISOString()
              };

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