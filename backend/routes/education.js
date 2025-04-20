const express = require('express');
const router = express.Router();
const EducationService = require('../services/education-service');

module.exports = function(pool) {
    const educationService = new EducationService(pool);

    // POST /api/education/generate - Generate educational content
    router.post('/generate', async (req, res) => {
        try {
            const { analysisResult, contentType = 'explain' } = req.body;
            
            if (!analysisResult) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Analysis result required' 
                });
            }

            // Generate appropriate content based on the analysis and contentType
            let content = '';
            const isPhishing = analysisResult.is_phishing;
            const riskScore = analysisResult.risk_score || 0;
            const features = analysisResult.features || {};
            
            // Different content types
            if (contentType === 'explain') {
                if (isPhishing) {
                    content = `# Phishing Alert: This URL Shows Multiple Danger Signs\n\n`;
                    content += `Our analysis detected multiple indicators of a phishing attempt with a risk score of ${riskScore}/100.\n\n`;
                    
                    // Add specific warnings based on features
                    if (features.domain_in_ip) {
                        content += `## IP Address Used Instead of Domain\n`;
                        content += `This site uses a numeric IP address rather than a proper domain name. Legitimate websites almost always use domain names (like example.com).\n\n`;
                    }
                    
                    if (features.tls_ssl_certificate === 0) {
                        content += `## Missing Secure Connection\n`;
                        content += `This site doesn't use HTTPS, which means your connection is not encrypted. Sensitive information should never be sent over unencrypted connections.\n\n`;
                    }
                    
                    content += `## Stay Safe\n`;
                    content += `We recommend avoiding this website and not entering any personal information.`;
                } else {
                    content = `# URL Analysis Results\n\n`;
                    content += `This URL appears to be legitimate with a risk score of ${riskScore}/100.\n\n`;
                    content += `## Good Practices\n`;
                    content += `While this URL appears safe, always remain cautious when entering personal information online.`;
                }
            } else if (contentType === 'tips') {
                content = `# Phishing Protection Tips\n\n`;
                content += `* Always check the URL in your address bar before entering sensitive information\n`;
                content += `* Be wary of emails asking for personal information\n`;
                content += `* Look for HTTPS and a padlock icon in your browser\n`;
                content += `* Use unique, strong passwords for each website\n`;
                content += `* Enable two-factor authentication when available`;
            }
            
            // Return the generated content
            res.json({
                success: true,
                content,
                contentType
            });
            
        } catch (error) {
            console.error('Error generating educational content:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to generate educational content' 
            });
        }
    });

    // Add new endpoint for key findings
    router.post('/key-findings', async (req, res) => {
        try {
            const { url, analysisResult } = req.body;
            
            if (!url || !analysisResult) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Missing required parameters: url and analysisResult' 
                });
            }
            
            const findings = educationService.generateKeyFindings(analysisResult, url);
            
            return res.json({
                success: true,
                findings
            });
        } catch (error) {
            console.error('Error generating key findings:', error);
            return res.status(500).json({ 
                success: false, 
                message: 'Error generating key findings',
                error: error.message
            });
        }
    });

    // Add this route for the extension
    router.post('/extension-findings', async (req, res) => {
        try {
            const { url, analysisResult } = req.body;
            
            if (!url || !analysisResult) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required parameters'
                });
            }
            
            // Get findings
            const findings = educationService.generateKeyFindings(analysisResult, url);
            
            // Format findings for extension display
            const html = educationService.formatFindingsForExtension(findings);
            
            return res.json({
                success: true,
                findings,
                html
            });
        } catch (error) {
            console.error('Error generating extension findings:', error);
            return res.status(500).json({
                success: false,
                message: 'Error generating findings',
                error: error.message
            });
        }
    });

    return router;
};
