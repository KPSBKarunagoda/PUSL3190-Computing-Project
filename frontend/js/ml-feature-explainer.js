/**
 * ML Feature Explainer Component
 * 
 * This component takes ML features and generates educational content
 * explaining why certain features indicate phishing or unsafe websites.
 */
class MLFeatureExplainer {
  constructor() {
    this.featureDescriptions = {
      // SSL Certificate
      'tls_ssl_certificate': {
        name: 'SSL Certificate Status',
        dangerous: (val) => val === 0.0,
        explanation: {
          risky: "This site doesn't use secure HTTPS encryption. Without SSL/TLS encryption, any data you send (like passwords or credit card numbers) could be intercepted by attackers.",
          safe: "This site uses proper HTTPS encryption, which helps protect your data during transmission."
        }
      },
      
      // IP Address in Domain
      'domain_in_ip': {
        name: 'IP Address Used as Domain',
        dangerous: (val) => val === 1.0 || val === 1 || val === true,
        explanation: {
          risky: "This site uses a numeric IP address instead of a domain name. Legitimate websites almost always use proper domain names (like 'example.com') rather than raw IP addresses. This is one of the strongest indicators of a phishing site.",
          safe: "This site uses a proper domain name rather than a raw IP address."
        }
      },
      
      // URL Length
      'length_url': {
        name: 'URL Length',
        dangerous: (val) => val > 50,
        explanation: {
          risky: "This URL is unusually long. Phishing URLs are often excessively long to hide their true nature or include encoded malicious scripts.",
          safe: "This URL has a reasonable length, which is typical for legitimate websites."
        }
      },
      
      // URL Shortening
      'url_shortened': {
        name: 'URL Shortening',
        dangerous: (val) => val === 1.0,
        explanation: {
          risky: "This URL has been shortened, making it impossible to see the actual destination before clicking.",
          safe: "This URL is not shortened, allowing you to see its full destination."
        }
      },
      
      // Redirects
      'qty_redirects': {
        name: 'Number of Redirects',
        dangerous: (val) => val > 1,
        explanation: {
          risky: "This URL involves multiple redirects. Multiple redirects can mask the true destination of a URL and are common in phishing attempts.",
          safe: "This URL has minimal or no redirects, which is typical for legitimate websites."
        }
      }
    };
  }
  
  /**
   * Analyze ML features and generate explanations
   * @param {Object} features - ML features from analysis
   * @param {string} url - The URL being analyzed
   * @returns {Object} Educational content based on features
   */
  explainFeatures(features, url = '') {
    if (!features || Object.keys(features).length === 0) {
      return {
        riskFactors: [],
        safeFactors: [],
        summary: "No detailed features were available for analysis."
      };
    }
    
    const riskFactors = [];
    const safeFactors = [];
    
    // Special check for IP address in URL
    if (url && this.isIpAddress(url)) {
      riskFactors.push({
        name: 'IP Address in URL',
        value: true,
        explanation: "This site uses a numeric IP address instead of a domain name. This is a strong indicator of a phishing site as legitimate websites almost always use proper domain names."
      });
      
      // If domain_in_ip isn't in features, add it
      if (!features.hasOwnProperty('domain_in_ip')) {
        features.domain_in_ip = 1;
      }
    }
    
    // Process each feature
    Object.entries(features).forEach(([key, value]) => {
      // Skip irrelevant features
      if (key === '__class__' || value === undefined || !this.featureDescriptions[key]) {
        return;
      }
      
      const featureInfo = this.featureDescriptions[key];
      
      // Check if this feature indicates risk
      if (featureInfo.dangerous(value)) {
        riskFactors.push({
          name: featureInfo.name,
          value: value,
          explanation: featureInfo.explanation.risky
        });
      } else {
        safeFactors.push({
          name: featureInfo.name,
          value: value,
          explanation: featureInfo.explanation.safe
        });
      }
    });
    
    // Generate a summary
    let summary = "";
    if (riskFactors.length > 0) {
      if (riskFactors.length > 2) {
        summary = `Multiple high-risk features were detected, including ${riskFactors.slice(0, 2).map(f => f.name.toLowerCase()).join(" and ")} issues.`;
      } else {
        summary = `Risk detected due to ${riskFactors.map(f => f.name.toLowerCase()).join(" and ")}.`;
      }
    } else if (safeFactors.length > 0) {
      summary = "No concerning features were detected in this URL.";
    } else {
      summary = "Unable to perform detailed feature analysis.";
    }
    
    return {
      riskFactors,
      safeFactors,
      summary
    };
  }
  
  /**
   * Generate HTML content for display
   * @param {Object} features - ML features from analysis
   * @param {string} url - The URL being analyzed
   * @returns {string} HTML content explaining features
   */
  generateHTML(features, url = '') {
    const analysis = this.explainFeatures(features, url);
    let html = '';
    
    if (analysis.riskFactors.length > 0) {
      analysis.riskFactors.forEach(factor => {
        html += `<li><strong>${factor.name}:</strong> ${factor.explanation}</li>`;
      });
    } else if (analysis.safeFactors.length > 0) {
      analysis.safeFactors.forEach(factor => {
        html += `<li><strong>${factor.name}:</strong> ${factor.explanation}</li>`;
      });
    } else if (url && this.isIpAddress(url)) {
      // Special case for IP addresses when no features were detected
      html = '<li><strong>IP Address in URL:</strong> This website uses a numeric IP address instead of a domain name, which is a strong indicator of a phishing attempt.</li>';
    } else {
      html = '<li>No specific feature information available for this URL.</li>';
    }
    
    return html;
  }
  
  /**
   * Check if a URL contains an IP address as the hostname
   */
  isIpAddress(url) {
    try {
      let hostname = url;
      // Try to extract hostname using URL API
      try {
        const urlObj = new URL(url);
        hostname = urlObj.hostname;
      } catch (e) {
        // If URL parsing fails, try to extract the hostname manually
        hostname = hostname.replace(/^(https?:\/\/)/, '');
        hostname = hostname.split('/')[0];
      }
      
      // Check for IPv4 pattern
      const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
      return ipPattern.test(hostname);
    } catch (e) {
      return false;
    }
  }
}

// Export the class for use in both browser and Node.js environments
try {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MLFeatureExplainer;
  }
} catch (e) {
  // Browser environment - ignore export error
}
