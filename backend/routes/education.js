const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const AIExplanationService = require('../services/ai-explanation-service');
const EducationService = require('../services/education-service');

// Initialize services
const aiExplanationService = new AIExplanationService();
const educationService = new EducationService();

// Get phishing education resources
router.get('/resources', auth, async (req, res) => {
  try {
    return res.json({
      success: true,
      resources: [
        {
          title: "How to Identify Phishing Websites",
          description: "Learn the key warning signs of phishing websites and how to protect yourself.",
          url: "/education/phishing-identification"
        },
        // ...existing resources...
      ]
    });
  } catch (error) {
    console.error('Error fetching education resources:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Generate key findings for a URL analysis
router.post('/key-findings', async (req, res) => {
  try {
    const { url, analysisResult } = req.body;
    
    if (!url || !analysisResult) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required data' 
      });
    }
    
    // Generate findings
    const findings = educationService.generateKeyFindings(analysisResult, url);
    
    return res.json({
      success: true,
      findings
    });
  } catch (error) {
    console.error('Error generating key findings:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Generate detailed AI-powered analysis
router.post('/detailed-analysis', auth, async (req, res) => {
  try {
    console.log('Detailed analysis request received');
    const { url, analysisResult } = req.body;
    
    // Add size validation for incoming request
    const requestSize = JSON.stringify(req.body).length;
    if (requestSize > 50000) {
      console.warn(`Request size too large (${requestSize} bytes). Trimming features.`);
      
      // Trim down the features to essential ones only
      const essentialFeatures = [
        'tls_ssl_certificate', 'domain_in_ip', 'domain_google_index', 
        'url_google_index', 'qty_redirects', 'time_domain_activation',
        'url_shortened'
      ];
      
      if (analysisResult && analysisResult.features) {
        const trimmedFeatures = {};
        essentialFeatures.forEach(feature => {
          if (feature in analysisResult.features) {
            trimmedFeatures[feature] = analysisResult.features[feature];
          }
        });
        analysisResult.features = trimmedFeatures;
      }
    }
    
    // Reduce timeout slightly to ensure we respond before client times out
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('AI explanation timed out at router level'));
      }, 35000); // 35 second timeout (less than the 45s client timeout)
    });
    
    try {
      // Race between AI explanation and timeout
      console.log('Calling AI explanation service with timeout');
      const aiExplanationPromise = aiExplanationService.generateDetailedExplanation(url, analysisResult);
      const aiExplanation = await Promise.race([aiExplanationPromise, timeoutPromise]);
      
      console.log('AI explanation service returned result, source:', aiExplanation.source || 'ai');
      
      return res.json({ 
        success: true, 
        explanation: aiExplanation.explanation,
        source: aiExplanation.source || 'ai'
      });
    } catch (timeoutError) {
      console.warn('Router-level timeout or error:', timeoutError.message);
      
      // Generate fallback explanation
      console.log('Generating fallback explanation from router');
      const fallbackExplanation = aiExplanationService.generateFallbackExplanation(
        url, 
        analysisResult, 
        analysisResult.features || {}
      );
      
      return res.json({ 
        success: true, 
        explanation: fallbackExplanation,
        source: 'timeout_fallback' 
      });
    }
  } catch (error) {
    console.error('Error handling AI explanation request:', error);
    
    // Return a simplified fallback explanation in case of any error
    return res.json({ 
      success: true, 
      explanation: `# Analysis Error\n\nWe encountered an issue analyzing this URL. Please try again later.`,
      source: 'error'
    });
  }
});

module.exports = router;
