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

// Process email headers in chunks to handle large inputs
router.post('/analyze-email-headers', async (req, res) => {
  try {
    const { headers } = req.body;
    
    if (!headers) {
      return res.status(400).json({ message: 'Email headers are required' });
    }
    
    console.log('Received email headers for analysis, processing...');
    console.log(`Header length: ${headers.length} characters`);
    
    // Analyze the headers
    const analysis = await emailHeaderAnalyzer.analyzeHeaders(headers);
    
    console.log('Analysis complete, sending response');
    
    // Return the analysis results
    res.json({
      risk_score: analysis.riskScore,
      is_phishing: analysis.isPhishing,
      summary: analysis.summary,
      findings: analysis.findings,
      headers: analysis.headers,
      email_subject: analysis.email_subject
    });
    
  } catch (error) {
    console.error('Email header analysis error:', error);
    res.status(500).json({ message: 'Error analyzing email headers: ' + error.message });
  }
});

// A simple route to check response time - for debugging connection issues
router.get('/ping', (req, res) => {
  res.json({ pong: new Date().toISOString() });
});

module.exports = router;
