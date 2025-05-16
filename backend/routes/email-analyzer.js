const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const AIExplanationService = require('../services/ai-explanation-service');
const emailHeaderAnalyzer = require('../services/email-header-analyzer');  // Import the service

// Initialize AI explanation service
const aiExplanationService = new AIExplanationService();

// Route to analyze email headers
router.post('/analyze-email-headers', auth, async (req, res) => {
  try {
    const { headers } = req.body;
    
    if (!headers) {
      return res.status(400).json({ error: 'Email headers are required' });
    }
    
    // Use the service instead of a local function
    const result = await emailHeaderAnalyzer.analyzeHeaders(headers);
    res.json(result);
  } catch (error) {
    console.error('Error analyzing email headers:', error);
    res.status(500).json({ error: 'Error analyzing email headers: ' + error.message });
  }
});

// Route for AI-powered analysis of email headers
router.post('/analyze-email-ai', async (req, res) => {
  try {
    console.log('Email AI analysis request received');
    const { headers, subject } = req.body;
    
    if (!headers) {
      return res.status(400).json({ error: 'Email headers are required' });
    }
    
    // First, get regular analysis to use as context
    const analysisResult = await emailHeaderAnalyzer.analyzeHeaders(headers);
    
    // If subject was provided in request, use it
    if (subject) {
      analysisResult.email_subject = subject;
    }
    
    console.log('Regular analysis completed, requesting AI analysis...');
    
    // Get AI analysis using the AIExplanationService - pass raw headers directly
    try {
      // Pass both the raw headers and the analysis results to the AI service
      const analysis = await aiExplanationService.generateEmailAnalysis(headers, analysisResult);
      
      console.log('AI analysis completed successfully');
      
      // Return the combined results
      res.json({
        subject: analysisResult.email_subject,
        risk_score: analysisResult.riskScore,
        is_phishing: analysisResult.isPhishing,
        findings: analysisResult.findings,
        analysis
      });
    } catch (aiError) {
      console.error('Error in AI analysis:', aiError);
      // Return partial results if AI analysis fails
      res.status(500).json({ 
        error: 'Error generating AI analysis',
        message: aiError.message,
        partial_results: {
          subject: analysisResult.email_subject,
          risk_score: analysisResult.riskScore,
          is_phishing: analysisResult.isPhishing,
          findings: analysisResult.findings,
          analysis: "AI analysis failed: " + aiError.message
        }
      });
    }
  } catch (error) {
    console.error('Error in email AI analysis:', error);
    res.status(500).json({ error: 'Error analyzing email with AI: ' + error.message });
  }
});

// Export the router for use in server.js
module.exports = router;
