const express = require('express');
const router = express.Router();
const emailHeaderAnalyzer = require('../services/email-header-analyzer');
const authMiddleware = require('../middleware/auth');

// Add a status endpoint to check if the service is running
router.get('/status', (req, res) => {
  res.status(200).json({ status: 'Email analysis service is running' });
});

// Add a test endpoint that doesn't require authentication
router.post('/test-email-headers', (req, res) => {
  try {
    console.log('Test email header analysis endpoint accessed');
    
    // Return a mock response for testing
    res.json({
      risk_score: 45,
      is_phishing: false,
      summary: 'This is a test response from the server.',
      findings: [
        {
          text: 'Test Finding',
          description: 'This is a test finding to verify the API is working.',
          severity: 'medium'
        }
      ],
      headers: { from: 'test@example.com' },
      email_subject: 'Test Email'
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({ message: 'Test endpoint error: ' + error.message });
  }
});

// Process email headers with better error handling for large inputs
router.post('/analyze-email-headers', async (req, res) => {
  try {
    const { headers } = req.body;
    
    if (!headers) {
      return res.status(400).json({ 
        message: 'Email headers are required',
        error: 'MISSING_HEADERS'
      });
    }
    
    console.log(`Received email headers for analysis, length: ${headers.length} characters (${(headers.length / (1024 * 1024)).toFixed(2)}MB)`);
    
    // Safety check for extremely large headers that might cause memory issues
    if (headers.length > 19000000) { // 19MB limit (slightly under our 20MB express limit)
      return res.status(413).json({ 
        message: `Headers exceed maximum size limit (19MB). Current size: ${(headers.length / (1024 * 1024)).toFixed(2)}MB`,
        error: 'PAYLOAD_TOO_LARGE',
        size: headers.length
      });
    }
    
    // Start timer for performance tracking
    const startTime = Date.now();
    
    // Try to process the headers with aggressive timeouts
    let analysisPromise = emailHeaderAnalyzer.analyzeHeaders(headers);
    
    // Set a timeout to prevent hanging on very complex headers
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Analysis timed out')), 30000); // 30 second timeout
    });
    
    // Race the analysis against the timeout
    const analysis = await Promise.race([analysisPromise, timeoutPromise]);
    
    // Calculate processing time
    const processingTime = Date.now() - startTime;
    console.log(`Email analysis completed in ${processingTime}ms`);
    
    // Return the analysis results with processing info
    res.json({
      risk_score: analysis.riskScore,
      is_phishing: analysis.isPhishing,
      summary: analysis.summary,
      findings: analysis.findings,
      headers: analysis.headers,
      email_subject: analysis.email_subject,
      processing_info: {
        input_size: headers.length,
        processing_time: `${processingTime}ms`
      }
    });
    
  } catch (error) {
    console.error('Email header analysis error:', error);
    
    // Specific error handling
    if (error.message === 'Analysis timed out') {
      return res.status(408).json({
        message: 'Email analysis timed out - headers may be too complex to process',
        error: 'ANALYSIS_TIMEOUT'
      });
    }
    
    res.status(500).json({ 
      message: 'Error analyzing email headers: ' + error.message,
      error: error.message
    });
  }
});

// A simple route to check response time - for debugging connection issues
router.get('/ping', (req, res) => {
  res.json({ pong: new Date().toISOString() });
});

module.exports = router;
