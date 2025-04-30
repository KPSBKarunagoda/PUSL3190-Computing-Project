const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const AIExplanationService = require('../services/ai-explanation-service');

// Initialize AI explanation service
const aiExplanationService = new AIExplanationService();

/**
 * EMAIL ANALYZER SERVICE FUNCTIONS
 * These were previously in ../services/email-analyzer.js
 */

/**
 * Analyzes email headers to detect security issues and phishing indicators
 * @param {string} headers - The raw email headers to analyze
 * @returns {Object} Analysis results including risk score and findings
 */
async function analyzeEmailHeaders(headers) {
  console.log('Analyzing email headers...');
  
  // Initialize results object
  const results = {
    risk_score: 0,
    is_phishing: false,
    findings: [],
    spf_result: 'unknown',
    dkim_result: 'unknown',
    dmarc_result: 'unknown',
    headers_parsed: {}
  };

  try {
    // Parse the headers
    const parsedHeaders = parseHeaders(headers);
    results.headers_parsed = parsedHeaders;
    
    // Extract email subject
    if (parsedHeaders.subject) {
      results.email_subject = parsedHeaders.subject;
    }
    
    // Check authentication results (SPF, DKIM, DMARC)
    const authResults = checkAuthentication(parsedHeaders);
    results.spf_result = authResults.spf;
    results.dkim_result = authResults.dkim;
    results.dmarc_result = authResults.dmarc;
    
    // Add findings based on authentication results
    if (authResults.spf === 'fail') {
      results.findings.push({
        text: "SPF Authentication Failed",
        description: "The email failed Sender Policy Framework verification.",
        severity: "high"
      });
      results.risk_score += 25;
    }
    
    if (authResults.dkim === 'fail') {
      results.findings.push({
        text: "DKIM Signature Invalid",
        description: "The email's DKIM signature is invalid or missing.",
        severity: "high"
      });
      results.risk_score += 25;
    }
    
    if (authResults.dmarc === 'fail') {
      results.findings.push({
        text: "DMARC Check Failed",
        description: "The email failed DMARC policy verification.",
        severity: "high"
      });
      results.risk_score += 25;
    }
    
    // Check for suspicious routing patterns
    const routeIssues = checkEmailRoute(parsedHeaders);
    if (routeIssues.suspicious) {
      results.findings.push({
        text: "Suspicious Mail Route",
        description: routeIssues.reason,
        severity: "medium"
      });
      results.risk_score += 15;
    }
    
    // Check for from/sender domain mismatches
    const senderIssues = checkSenderDomain(parsedHeaders);
    if (senderIssues.mismatch) {
      results.findings.push({
        text: "Sender Domain Mismatch",
        description: senderIssues.reason,
        severity: "high"
      });
      results.risk_score += 30;
    }
    
    // Set phishing flag if risk score is high enough
    results.is_phishing = results.risk_score >= 50;
    
    // Cap risk score at 100
    results.risk_score = Math.min(results.risk_score, 100);
    
    return results;
  } catch (error) {
    console.error('Error analyzing email headers:', error);
    throw new Error(`Failed to analyze email headers: ${error.message}`);
  }
}

/**
 * Parse raw email headers into a structured object
 * @param {string} rawHeaders - Raw email header text
 * @returns {Object} Parsed headers
 */
function parseHeaders(rawHeaders) {
  const headers = {};
  const lines = rawHeaders.split(/\r?\n/);
  
  let currentHeader = null;
  let currentValue = '';
  
  for (const line of lines) {
    // If line starts with whitespace, it's a continuation of the previous header
    if (/^\s/.test(line)) {
      currentValue += ' ' + line.trim();
      headers[currentHeader] = currentValue;
    } else {
      // New header
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        if (currentHeader) {
          headers[currentHeader] = currentValue;
        }
        currentHeader = match[1].toLowerCase();
        currentValue = match[2];
      }
    }
  }
  
  // Add the last header if there is one
  if (currentHeader) {
    headers[currentHeader] = currentValue;
  }
  
  return headers;
}

/**
 * Check authentication results from email headers
 * @param {Object} headers - Parsed email headers
 * @returns {Object} Results for SPF, DKIM, and DMARC
 */
function checkAuthentication(headers) {
  const results = {
    spf: 'unknown',
    dkim: 'unknown',
    dmarc: 'unknown'
  };
  
  // Check for Authentication-Results header
  const authHeader = headers['authentication-results'] || '';
  
  // Check SPF
  if (authHeader.includes('spf=pass')) {
    results.spf = 'pass';
  } else if (authHeader.includes('spf=fail') || authHeader.includes('spf=softfail')) {
    results.spf = 'fail';
  } else if (authHeader.includes('spf=neutral')) {
    results.spf = 'neutral';
  }
  
  // Check DKIM
  if (authHeader.includes('dkim=pass')) {
    results.dkim = 'pass';
  } else if (authHeader.includes('dkim=fail')) {
    results.dkim = 'fail';
  } else if (authHeader.includes('dkim=none')) {
    results.dkim = 'none';
  }
  
  // Check DMARC
  if (authHeader.includes('dmarc=pass')) {
    results.dmarc = 'pass';
  } else if (authHeader.includes('dmarc=fail')) {
    results.dmarc = 'fail';
  } else if (authHeader.includes('dmarc=none')) {
    results.dmarc = 'none';
  }
  
  return results;
}

/**
 * Check for suspicious patterns in the email routing
 * @param {Object} headers - Parsed email headers
 * @returns {Object} Assessment of route patterns
 */
function checkEmailRoute(headers) {
  const result = {
    suspicious: false,
    reason: ''
  };
  
  // Check Received headers for suspicious patterns
  const receivedHeaders = [];
  for (const key in headers) {
    if (key.startsWith('received')) {
      receivedHeaders.push(headers[key]);
    }
  }
  
  // Simple check for too many hops
  if (receivedHeaders.length > 10) {
    result.suspicious = true;
    result.reason = "The email passed through an unusually high number of servers.";
    return result;
  }
  
  // Check for suspicious server names or IPs
  for (const header of receivedHeaders) {
    if (header.includes('suspicious-server.com') || 
        header.match(/\b(103\.24\.77\.|91\.243\.89\.)\b/)) {
      result.suspicious = true;
      result.reason = "The email passed through servers associated with suspicious activity.";
      return result;
    }
  }
  
  return result;
}

/**
 * Check for mismatches between the From address and actual sender domain
 * @param {Object} headers - Parsed email headers
 * @returns {Object} Assessment of sender domain consistency
 */
function checkSenderDomain(headers) {
  const result = {
    mismatch: false,
    reason: ''
  };
  
  const fromHeader = headers.from || '';
  const returnPath = headers['return-path'] || '';
  
  // Extract domains
  const fromDomainMatch = fromHeader.match(/@([^>]+)>?/);
  const returnPathMatch = returnPath.match(/@([^>]+)>?/);
  
  if (fromDomainMatch && returnPathMatch) {
    const fromDomain = fromDomainMatch[1];
    const returnPathDomain = returnPathMatch[1];
    
    if (fromDomain !== returnPathDomain) {
      result.mismatch = true;
      result.reason = `From domain (${fromDomain}) doesn't match Return-Path domain (${returnPathDomain})`;
      return result;
    }
  }
  
  return result;
}

/**
 * EMAIL ANALYZER ROUTES
 * These were previously separate route handlers in this file
 */

// Route to analyze email headers
router.post('/analyze-email-headers', auth, async (req, res) => {
  try {
    const { headers } = req.body;
    
    if (!headers) {
      return res.status(400).json({ error: 'Email headers are required' });
    }
    
    const result = await analyzeEmailHeaders(headers);
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
    const analysisResult = await analyzeEmailHeaders(headers);
    
    // If subject was provided in request, use it
    if (subject) {
      analysisResult.email_subject = subject;
    }
    
    console.log('Regular analysis completed, requesting AI analysis...');
    console.log('Analysis result:', JSON.stringify(analysisResult, null, 2));
    
    // Get AI analysis using the AIExplanationService
    try {
      const analysis = await aiExplanationService.generateEmailAnalysis(headers, analysisResult);
      
      console.log('AI analysis completed successfully');
      
      // Return the combined results
      res.json({
        subject: analysisResult.email_subject,
        risk_score: analysisResult.risk_score,
        is_phishing: analysisResult.is_phishing,
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
          risk_score: analysisResult.risk_score,
          is_phishing: analysisResult.is_phishing,
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
