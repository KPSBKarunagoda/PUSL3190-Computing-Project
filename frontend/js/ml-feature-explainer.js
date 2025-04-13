/**
 * ML Feature Explainer Component
 * 
 * This component takes ML features and generates educational content
 * explaining why certain features indicate phishing or unsafe websites.
 * Enhanced with transparent explanation capabilities.
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
        },
        impact: "high"
      },
      
      // IP Address in Domain
      'domain_in_ip': {
        name: 'IP Address Used as Domain',
        dangerous: (val) => val === 1.0 || val === 1 || val === true,
        explanation: {
          risky: "This site uses a numeric IP address instead of a domain name. Legitimate websites almost always use proper domain names (like 'example.com') rather than raw IP addresses. This is one of the strongest indicators of a phishing site.",
          safe: "This site uses a proper domain name rather than a raw IP address."
        },
        impact: "critical"
      },
      
      // URL Length
      'length_url': {
        name: 'URL Length',
        dangerous: (val) => val > 50,
        explanation: {
          risky: (val) => `This URL is unusually long (${val} characters). Phishing URLs are often excessively long to hide their true nature or include encoded malicious scripts.`,
          safe: "This URL has a reasonable length, which is typical for legitimate websites."
        },
        impact: "medium",
        valueFormatter: (val) => `${val} characters`
      },
      
      // URL Shortening
      'url_shortened': {
        name: 'URL Shortening',
        dangerous: (val) => val === 1.0 || val === 1 || val === true,
        explanation: {
          risky: "This URL has been shortened, making it impossible to see the actual destination before clicking.",
          safe: "This URL is not shortened, allowing you to see its full destination."
        },
        impact: "high"
      },
      
      // Redirects
      'qty_redirects': {
        name: 'Number of Redirects',
        dangerous: (val) => val > 1,
        explanation: {
          risky: (val) => `This URL involves ${val} redirects. Multiple redirects can mask the true destination of a URL and are common in phishing attempts.`,
          safe: "This URL has minimal or no redirects, which is typical for legitimate websites."
        },
        impact: "medium",
        valueFormatter: (val) => `${val} redirect${val !== 1 ? 's' : ''}`
      },
      
      // Domain Age
      'time_domain_activation': {
        name: 'Domain Age',
        dangerous: (val) => val < 30 && val !== 0,
        explanation: {
          risky: (val) => `This domain is very new (only ${val} days old). Phishing websites often use newly registered domains that exist for short periods.`,
          safe: (val) => `This domain has been registered for ${val > 365 ? 'over a year' : val + ' days'}, which is a positive signal.`
        },
        impact: "medium",
        valueFormatter: (val) => val === 0 ? 'Unknown age' : val > 365 ? `${Math.floor(val/365)} year(s), ${val%365} days` : `${val} days`
      },
      
      // Special Characters
      'qty_at_url': {
        name: 'At Symbol (@) in URL',
        dangerous: (val) => val > 0,
        explanation: {
          risky: `This URL contains the @ symbol, which can be used to hide the actual destination. Everything before @ is ignored in URL navigation.`,
          safe: "This URL doesn't contain suspicious @ symbols."
        },
        impact: "high"
      },
      
      'qty_dot_url': {
        name: 'Excessive Dots in URL',
        dangerous: (val) => val > 5,
        explanation: {
          risky: (val) => `This URL contains an unusual number of dots (${val}). Multiple subdomains or complex paths can be used to make phishing URLs appear legitimate.`,
          safe: "This URL has a reasonable number of dots, which is typical for legitimate websites."
        },
        impact: "low",
        valueFormatter: (val) => `${val} dots`
      },
      
      'qty_hyphen_url': {
        name: 'Hyphens in URL',
        dangerous: (val) => val > 3,
        explanation: {
          risky: (val) => `This URL contains many hyphens (${val}), which can be used to create misleading domain names that look similar to legitimate websites.`,
          safe: "This URL has few or no hyphens in its structure."
        },
        impact: "low",
        valueFormatter: (val) => `${val} hyphen${val !== 1 ? 's' : ''}`
      },
      
      // Domain Features
      'domain_google_index': {
        name: 'Domain Indexing',
        dangerous: (val) => val === 0,
        explanation: {
          risky: "This domain doesn't appear to be indexed by search engines. Most legitimate websites are discoverable through search engines.",
          safe: "This domain appears to be indexed by search engines, which is typical for established websites."
        },
        impact: "medium" 
      },
      
      // Additional Security Features
      'qty_ip_resolved': {
        name: 'DNS Resolution',
        dangerous: (val) => val === 0,
        explanation: {
          risky: "This domain doesn't properly resolve to any IP addresses, which is unusual for legitimate websites.",
          safe: "This domain properly resolves to IP addresses, as expected for legitimate websites."
        },
        impact: "medium",
        valueFormatter: (val) => `${val} IP address${val !== 1 ? 'es' : ''}`
      },
      
      'qty_nameservers': {
        name: 'Name Servers',
        dangerous: (val) => val === 0,
        explanation: {
          risky: "This domain doesn't have proper name servers configured, which is unusual for legitimate websites.",
          safe: "This domain has properly configured name servers, as expected for legitimate websites."
        },
        impact: "low",
        valueFormatter: (val) => `${val} nameserver${val !== 1 ? 's' : ''}`
      },
      
      'domain_spf': {
        name: 'Email Authentication',
        dangerous: (val) => val === 0,
        explanation: {
          risky: "This domain doesn't have SPF records for email authentication. Legitimate organizations typically protect their email domains.",
          safe: "This domain has SPF records for email authentication, which helps prevent email spoofing."
        },
        impact: "low"
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
    const allFactors = []; // To track all factors in order of importance
    
    // Special check for IP address in URL
    if (url && this.isIpAddress(url)) {
      riskFactors.push({
        name: 'IP Address in URL',
        value: true,
        explanation: "This site uses a numeric IP address instead of a domain name. This is a strong indicator of a phishing site as legitimate websites almost always use proper domain names.",
        impact: "critical"
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
      
      // Format value if formatter exists
      const formattedValue = featureInfo.valueFormatter ? featureInfo.valueFormatter(value) : value;
      
      // Check if this feature indicates risk
      if (featureInfo.dangerous(value)) {
        // Handle explanation function or string
        let explanation = featureInfo.explanation.risky;
        if (typeof explanation === 'function') {
          explanation = explanation(value);
        }
        
        const factor = {
          name: featureInfo.name,
          value: formattedValue,
          rawValue: value,
          explanation: explanation,
          impact: featureInfo.impact || "medium"
        };
        
        riskFactors.push(factor);
        allFactors.push({...factor, isRisk: true});
      } else {
        // Handle explanation function or string
        let explanation = featureInfo.explanation.safe;
        if (typeof explanation === 'function') {
          explanation = explanation(value);
        }
        
        const factor = {
          name: featureInfo.name,
          value: formattedValue,
          rawValue: value,
          explanation: explanation,
          impact: featureInfo.impact || "low"
        };
        
        safeFactors.push(factor);
        allFactors.push({...factor, isRisk: false});
      }
    });
    
    // Sort factors by impact for display
    const impactOrder = {"critical": 0, "high": 1, "medium": 2, "low": 3};
    riskFactors.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);
    allFactors.sort((a, b) => {
      // First prioritize risk factors
      if (a.isRisk && !b.isRisk) return -1;
      if (!a.isRisk && b.isRisk) return 1;
      // Then sort by impact
      return impactOrder[a.impact] - impactOrder[b.impact];
    });
    
    // Generate a summary
    let summary = "";
    if (riskFactors.length > 0) {
      const criticalFactors = riskFactors.filter(f => f.impact === "critical");
      const highFactors = riskFactors.filter(f => f.impact === "high");
      
      if (criticalFactors.length > 0) {
        summary = `Critical security concerns detected, including ${criticalFactors.map(f => f.name.toLowerCase()).join(" and ")}.`;
      } else if (highFactors.length > 0) {
        summary = `Significant security concerns detected, including ${highFactors.slice(0, 2).map(f => f.name.toLowerCase()).join(" and ")}.`;
      } else if (riskFactors.length > 2) {
        summary = `Multiple security concerns were detected, including ${riskFactors.slice(0, 2).map(f => f.name.toLowerCase()).join(" and ")}.`;
      } else {
        summary = `Security concerns detected: ${riskFactors.map(f => f.name.toLowerCase()).join(" and ")}.`;
      }
    } else if (safeFactors.length > 0) {
      summary = "No concerning features were detected in this URL.";
    } else {
      summary = "Unable to perform detailed feature analysis.";
    }
    
    return {
      riskFactors,
      safeFactors,
      allFactors,
      summary
    };
  }
  
  /**
   * Generate transparent HTML content for display
   * @param {Object} features - ML features from analysis
   * @param {string} url - The URL being analyzed
   * @param {Object} scanResult - Full scan result including risk score
   * @returns {string} HTML content explaining features with transparency
   */
  generateTransparentHTML(features, url = '', scanResult = {}) {
    console.log("Generating transparent HTML for features:", features);
    
    try {
      const analysis = this.explainFeatures(features || {}, url);
      let html = '';
      
      // Add scan summary header - simplified design
      html += `<div class="scan-summary">
        <h3>Security Analysis</h3>
        <div class="risk-score">
          <span class="risk-score-label">Risk Score:</span>
          <span class="${this.getRiskClass(scanResult.risk_score || 0)}">${scanResult.risk_score || 0}/100</span>
        </div>
      </div>`;
      
      // Add factors section with cleaner design
      html += '<div class="factors-section">';
      
      // Add risk factors section if any exist
      if (analysis.riskFactors && analysis.riskFactors.length > 0) {
        html += `
          <div class="section-title">
            <i class="fas fa-exclamation-circle"></i>
            Security Issues Detected
          </div>
          <div class="risk-factors-list">`;
        
        analysis.riskFactors.forEach(factor => {
          html += `<div class="factor-card ${factor.impact}">
            <div class="factor-header">
              <span class="factor-name">${factor.name}</span>
              <span class="impact-badge ${factor.impact}">${this.capitalizeFirst(factor.impact)}</span>
            </div>
            <p class="factor-explanation">${factor.explanation}</p>
            ${factor.value !== undefined && factor.value !== true ? 
              `<p class="factor-value">Found: ${factor.value}</p>` : ''}
          </div>`;
        });
        
        html += '</div>';
      } else {
        html += `
          <div class="section-title">
            <i class="fas fa-check-circle"></i>
            No Security Issues Detected
          </div>
          <div class="factor-card safe">
            <p class="factor-explanation">Our analysis did not find any significant security concerns with this URL. Always continue practicing safe browsing habits.</p>
          </div>`;
      }
      
      // Add safe factors section if any exist and risk score is under threshold
      if (analysis.safeFactors && analysis.safeFactors.length > 0 && (scanResult.risk_score || 0) < 60) {
        html += `
          <div class="section-title">
            <i class="fas fa-shield-alt"></i>
            Positive Security Signals
          </div>
          <div class="safe-factors-list">`;
        
        // Display up to 2 most important safe factors
        analysis.safeFactors
          .sort((a, b) => this.getImpactWeight(a.impact) - this.getImpactWeight(b.impact))
          .slice(0, 2)
          .forEach(factor => {
            html += `<div class="factor-card safe">
              <span class="factor-name">${factor.name}</span>
              <p class="factor-explanation">${factor.explanation}</p>
            </div>`;
          });
        
        html += '</div>';
      }
      
      html += '</div>';
      
      // Add technical details section (collapsible) - cleaner design
      html += `<div class="technical-section" id="technical-details">
        <div class="technical-header" onclick="document.getElementById('technical-details').classList.toggle('expanded')">
          <h4><i class="fas fa-code"></i> Technical Details</h4>
          <span class="toggle-icon">+</span>
        </div>
        <div class="technical-content">
          <table class="features-table">
            <tr>
              <th>Feature</th>
              <th>Value</th>
              <th>Impact</th>
            </tr>`;
      
      // Make sure allFactors exists before trying to iterate over it
      if (analysis.allFactors && Array.isArray(analysis.allFactors)) {
        // Show analyzed features
        analysis.allFactors.forEach(factor => {
          html += `<tr class="${factor.isRisk ? 'risk' : 'safe'}">
            <td>${factor.name}</td>
            <td>${factor.value !== undefined ? factor.value : (factor.rawValue !== undefined ? factor.rawValue : 'N/A')}</td>
            <td class="impact ${factor.impact}">${this.capitalizeFirst(factor.impact)}</td>
          </tr>`;
        });
      } else {
        // Fallback if allFactors is missing
        Object.entries(features || {}).forEach(([key, value]) => {
          if (this.featureDescriptions[key]) {
            const featureInfo = this.featureDescriptions[key];
            const isRisky = featureInfo.dangerous(value);
            html += `<tr class="${isRisky ? 'risk' : 'safe'}">
              <td>${featureInfo.name || key}</td>
              <td>${value}</td>
              <td class="impact ${featureInfo.impact || 'medium'}">${this.capitalizeFirst(featureInfo.impact || 'medium')}</td>
            </tr>`;
          }
        });
      }
      
      html += `</table>
          <p class="table-note">
            These features were analyzed by our machine learning model to determine the risk score.
          </p>
        </div>
      </div>`;
      
      // Add recommendations section - improved design
      html += `<div class="recommendations-section">
        <h4 class="recommendations-title"><i class="fas fa-lightbulb"></i> Recommendations</h4>`;
      
      // Add advice based on risk level
      if (scanResult.risk_score > 70) {
        html += `<div class="security-advice high-risk">
          <p>We recommend that you do not proceed to this website or enter any personal information.</p>
        </div>`;
      } else if (scanResult.risk_score > 30) {
        html += `<div class="security-advice medium-risk">
          <p>Exercise caution with this website. If you proceed, be vigilant about sharing any information.</p>
        </div>`;
      } else {
        html += `<div class="security-advice">
          <p>This website appears to be legitimate, but always maintain good security practices.</p>
        </div>`;
      }
      
      // Add specific advice based on risk factors
      html += '<ul class="safety-tips">';
      
      // Always show general safety tip
      html += '<li>Always verify the website address before entering personal information</li>';
      
      // Show specific advice for detected risks
      if (analysis.riskFactors.some(f => f.name === "SSL Certificate Status")) {
        html += '<li>Never enter sensitive information on websites without HTTPS encryption</li>';
      }
      
      if (analysis.riskFactors.some(f => f.name === "IP Address Used as Domain" || f.name === "IP Address in URL")) {
        html += '<li>Legitimate websites almost never use IP addresses instead of domain names</li>';
      }
      
      if (analysis.riskFactors.some(f => f.name === "URL Shortening")) {
        html += '<li>Use URL expansion services to check the real destination of shortened links</li>';
      }
      
      html += '</ul></div>';
      
      return html;
    } catch (error) {
      console.error("Error in generateTransparentHTML:", error);
      
      // Provide a fallback simple explanation when the full analysis fails
      return `
        <div class="scan-summary">
          <h3>Security Analysis</h3>
          <div class="risk-score">
            <span class="risk-score-label">Risk Score:</span>
            <span class="${this.getRiskClass(scanResult.risk_score || 0)}">${scanResult.risk_score || 0}/100</span>
          </div>
        </div>
        <div class="factor-card ${scanResult.risk_score > 60 ? 'high' : scanResult.risk_score > 30 ? 'medium' : 'safe'}">
          <p class="factor-explanation">We encountered an issue while analyzing this URL's detailed features. The risk score is still accurate, but detailed explanation is not available.</p>
          ${this.isIpAddress(url) ? '<p class="factor-explanation"><strong>Note:</strong> This URL uses an IP address instead of a domain name, which is a common characteristic of phishing sites.</p>' : ''}
        </div>
      `;
    }
  }
  
  /**
   * Generate older/simple HTML content for display (backward compatibility)
   * @param {Object} features - ML features from analysis
   * @param {string} url - The URL being analyzed
   * @returns {string} HTML content explaining features
   */
  generateHTML(features, url = '') {
    const analysis = this.explainFeatures(features, url);
    let html = '<ul class="feature-list">';
    
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
    
    html += '</ul>';
    return html;
  }
  
  /**
   * Helper: Get risk class for CSS styling
   */
  getRiskClass(score) {
    if (score > 70) return "high-risk";
    if (score > 30) return "medium-risk";
    return "low-risk";
  }
  
  /**
   * Helper: Get numeric weight for impact sorting
   */
  getImpactWeight(impact) {
    const weights = {"critical": 0, "high": 1, "medium": 2, "low": 3};
    return weights[impact] || 4;
  }
  
  /**
   * Helper: Capitalize first letter
   */
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
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
