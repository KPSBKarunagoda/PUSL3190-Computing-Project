const express = require('express');
const router = express.Router();
const EducationService = require('../services/education-service');

module.exports = function(dbConnection) {
  const educationService = new EducationService();
  
  // Generate educational content based on analysis results
  router.post('/generate', async (req, res) => {
    try {
      const { analysisResult, contentType = 'explain' } = req.body;
      
      if (!analysisResult) {
        return res.status(400).json({ 
          success: false, 
          message: 'Analysis result is required' 
        });
      }
      
      // Log incoming request data to help debug
      console.log('Generating educational content for:', {
        url: analysisResult.url,
        is_phishing: analysisResult.is_phishing,
        risk_score: analysisResult.risk_score,
        features: analysisResult.features ? Object.keys(analysisResult.features).length : 0
      });
      
      const result = educationService.generateContent(analysisResult, contentType);
      
      res.json(result);
    } catch (error) {
      console.error('Error generating educational content:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error generating educational content' 
      });
    }
  });
  
  // Generate HTML feature explanations
  router.post('/features', async (req, res) => {
    try {
      const { analysisResult } = req.body;
      
      if (!analysisResult || !analysisResult.features) {
        return res.status(400).json({ 
          success: false, 
          message: 'Analysis result with features is required' 
        });
      }
      
      // Log feature data for debugging
      console.log('Generating feature explanations for URL:', analysisResult.url);
      console.log('Features available:', Object.keys(analysisResult.features));
      
      // Check if the URL is an IP address
      const isIpAddress = educationService.isIpAddress(analysisResult.url);
      if (isIpAddress) {
        console.log(`IP address detected in URL: ${analysisResult.url}`);
        // Ensure domain_in_ip feature is set
        analysisResult.features.domain_in_ip = 1;
      }
      
      const html = educationService.generateFeatureExplanationsHtml(
        analysisResult.features,
        analysisResult.url
      );
      
      res.json({
        success: true,
        html,
        is_ip_address: isIpAddress
      });
    } catch (error) {
      console.error('Error generating feature explanations:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error generating feature explanations' 
      });
    }
  });
  
  return router;
};
