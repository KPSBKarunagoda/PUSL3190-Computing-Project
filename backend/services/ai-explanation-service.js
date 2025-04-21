const fs = require('fs');
const path = require('path');

// Import AI providers
const GeminiAdapter = require('./providers/gemini-adapter');

class AIExplanationService {
  constructor() {
    console.log('Initializing AI Explanation Service');
    this.initializeProvider();
    
    this.systemPrompt = `You are an expert in cybersecurity and phishing detection.
Your role is to explain phishing detection results in a clear, educational manner.
You should explain why a URL might be risky or safe based on the analysis data provided.
Include specific security concerns, educational tips, and recommendations.
Format your response in Markdown with appropriate headings, bullet points, and emphasis.`;
  }

  initializeProvider() {
    // Determine which AI provider to use
    const aiProvider = process.env.AI_PROVIDER || 'gemini';
    
    console.log(`Using AI provider: ${aiProvider}`);
    
    // Initialize the appropriate provider
    if (aiProvider.toLowerCase() === 'gemini') {
      this.aiProvider = new GeminiAdapter();
    } else {
      console.error(`Unsupported AI provider: ${aiProvider}`);
      this.aiProvider = null;
    }
  }

  buildPrompt(url, analysisResult) {
    // Extract only the essential data from analysis result
    const features = analysisResult.features || {};
    const riskScore = analysisResult.risk_score || 0;
    const isPhishing = analysisResult.is_phishing || false;
    
    // Only include the most important features in the prompt
    const importantFeatures = [
      'tls_ssl_certificate',
      'domain_in_ip',
      'domain_google_index', 
      'url_google_index',
      'qty_redirects',
      'time_domain_activation',
      'url_shortened'
    ];
    
    let featuresText = '';
    importantFeatures.forEach(feature => {
      if (feature in features) {
        featuresText += `- ${this._getReadableFeatureName(feature)}: ${features[feature]}\n`;
      }
    });
    
    // More concise, direct prompt focusing only on essential information
    return `
Analyze this URL: ${url}

Risk: ${riskScore}/100 (${isPhishing ? 'Potentially Malicious' : 'Likely Safe'})

Key indicators:
${featuresText}

Provide a brief security assessment explaining:
1. Is this likely a phishing URL?
2. What are the key security factors detected?
3. What should the user do?

Use markdown format. Keep it concise (under 200 words).`;
  }

  // Helper method to convert feature names to readable text
  _getReadableFeatureName(feature) {
    const featureMap = {
      'tls_ssl_certificate': 'Has SSL certificate',
      'domain_in_ip': 'IP-based URL',
      'domain_google_index': 'Domain in Google index',
      'url_google_index': 'URL in Google index',
      'qty_redirects': 'Redirect count',
      'time_domain_activation': 'Domain age (days)',
      'url_shortened': 'URL is shortened'
    };
    
    return featureMap[feature] || feature;
  }

  async generateDetailedExplanation(url, analysisResult) {
    try {
      console.log(`Generating explanation for URL: ${url}`);
      
      // Check if result is in cache first (add URL-based caching)
      const cacheKey = `ai_explanation:${url}`;
      const cachedResult = await this._checkCache(cacheKey);
      
      if (cachedResult) {
        console.log('Using cached AI explanation');
        return { explanation: cachedResult, source: 'cache' };
      }
      
      // Build prompt with optimization
      const prompt = this.buildPrompt(url, analysisResult);
      
      // Shorter timeout to fail faster
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AI request timed out')), 25000);
      });
      
      try {
        console.log('Requesting AI completion with reduced token count');
        const completionPromise = this.aiProvider.generateCompletion(
          prompt,
          this.systemPrompt,
          { 
            temperature: 0.2,  // Lower temperature for more predictable, faster responses
            max_tokens: 700,   // Reduce token count to speed up response
            timeout: 22000     // Explicit timeout
          }
        );
        
        // Race between completion and timeout
        const explanation = await Promise.race([completionPromise, timeoutPromise]);
        console.log('Successfully generated AI explanation');
        
        // Save to cache
        await this._saveCache(cacheKey, explanation);
        
        return { explanation };
      } catch (error) {
        console.error('AI explanation generation error:', error.message);
        
        // Use fallback for any error
        console.log('Using fallback explanation due to:', error.message);
        return { 
          explanation: this.generateFallbackExplanation(url, analysisResult),
          source: 'fallback'
        };
      }
    } catch (error) {
      console.error('Error in generateDetailedExplanation:', error);
      
      // Ensure we always return something
      return { 
        explanation: `# Analysis Error\n\nWe encountered an issue analyzing ${url}. Please try again later.`,
        source: 'error' 
      };
    }
  }

  async _checkCache(key) {
    try {
      // Simple in-memory cache with expiration logic could be added here
      return null; // For now, just return null to bypass caching
    } catch (err) {
      console.error('Cache check error:', err);
      return null;
    }
  }

  async _saveCache(key, data) {
    try {
      // Simple in-memory cache with expiration logic could be added here
      return true; 
    } catch (err) {
      console.error('Cache save error:', err);
      return false;
    }
  }

  generateFallbackExplanation(url, analysisResult, features = {}) {
    const riskScore = analysisResult.risk_score || 0;
    const isPhishing = analysisResult.is_phishing || false;
    
    // Extract feature values with defaults
    const featuresObj = features || analysisResult.features || {};
    const hasSslCertificate = featuresObj.tls_ssl_certificate !== 0;
    const isIpBased = featuresObj.domain_in_ip === 1;
    const isIndexed = featuresObj.domain_google_index === 1;
    const urlIsIndexed = featuresObj.url_google_index === 1;
    const hasRedirects = featuresObj.qty_redirects > 0;
    const domainAge = featuresObj.time_domain_activation || 0;
    const urlShortened = featuresObj.url_shortened === 1;
    
    let securityFactors = '';
    
    // Check for IP-based URL
    if (isIpBased) {
      securityFactors += '* **IP Address Used Instead of Domain**: The URL uses a numeric IP address rather than a domain name, which is unusual for legitimate websites\n';
    }
    
    // Check for SSL certificate
    if (hasSslCertificate === false) {
      securityFactors += '* **Missing Security Certificate**: This site does not use HTTPS encryption which makes it vulnerable to data interception\n';
    } else if (hasSslCertificate) {
      securityFactors += '* **Secure Connection**: This site uses HTTPS encryption to protect your data\n';
    }
    
    // Check if domain is indexed by Google
    if (isIndexed === false) {
      securityFactors += '* **Domain Not Indexed**: This domain is not indexed by search engines, which is unusual for legitimate websites\n';
    } else if (isIndexed) {
      securityFactors += '* **Indexed by Google**: This domain is properly indexed by search engines, typical of established websites\n';
    }
    
    // Check if the specific URL is indexed
    if (urlIsIndexed === false) {
      securityFactors += '* **Page Not Indexed**: This specific URL is not indexed by search engines\n';
    } else if (urlIsIndexed) {
      securityFactors += '* **Page Indexed by Google**: This specific URL is indexed by search engines\n';
    }
    
    // Check for redirects
    if (hasRedirects && featuresObj.qty_redirects > 1) {
      securityFactors += `* **Multiple Redirects (${featuresObj.qty_redirects})**: This URL contains redirects which can be used to hide the true destination\n`;
    }
    
    // Check for URL shortening
    if (urlShortened) {
      securityFactors += '* **URL Shortening Detected**: This appears to be a shortened URL which can hide the true destination\n';
    }
    
    // Check domain age
    if (domainAge < 30 && domainAge > 0) {
      securityFactors += `* **Very New Domain**: This domain was created only ${domainAge} days ago. Phishing sites often use newly registered domains\n`;
    } else if (domainAge > 365) {
      securityFactors += `* **Established Domain**: This domain has been active for ${Math.floor(domainAge/365)} year(s), which is typical for legitimate websites\n`;
    }
    
    // If no specific factors, add some generic ones
    if (!securityFactors) {
      if (isPhishing || riskScore > 70) {
        securityFactors = '* **Multiple Risk Factors**: This URL exhibits characteristics commonly found in phishing websites\n';
      } else if (riskScore > 30) {
        securityFactors = '* **Some Suspicious Elements**: This URL has some concerning characteristics but isn\'t definitively malicious\n';
      } else {
        securityFactors = '* **Low Risk Profile**: This URL doesn\'t exhibit characteristics typically associated with phishing attempts\n';
      }
    }
    
    // Generate appropriate markdown based on risk level
    if (isPhishing || riskScore > 70) {
      return `# High Risk URL Detected

## Security Analysis for ${url}

Our analysis indicates this URL has a **high risk score of ${riskScore}/100**. Multiple security concerns were identified that are commonly associated with phishing websites.

### Key Risk Factors:

${securityFactors}

### Recommendation

We strongly advise against visiting this website or entering any personal information. This URL shows multiple characteristics of a phishing attempt.`;
    } else if (riskScore > 30) {
      return `# Medium Risk URL Detected

## Security Analysis for ${url}

Our analysis indicates this URL has a **medium risk score of ${riskScore}/100**. While not definitively malicious, some suspicious characteristics were detected.

### Points of Caution:

${securityFactors}

### Recommendation

Exercise caution when visiting this website. Do not enter sensitive information unless you can verify the site's legitimacy through other means.`;
    } else {
      return `# Low Risk URL Detected

## Security Analysis for ${url}

Our analysis indicates this URL has a **low risk score of ${riskScore}/100**. No significant security concerns were detected.

### Safety Indicators:

${securityFactors}

### Recommendation

This URL appears to be safe based on our analysis. While no significant issues were detected, always practice standard online safety measures when sharing sensitive information online.`;
    }
  }
}

module.exports = AIExplanationService;
