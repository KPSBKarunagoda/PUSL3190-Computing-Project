/**
 * ML Feature Explainer Component
 * 
 * This component takes ML features and generates educational content
 * explaining why certain features indicate phishing or unsafe websites.
 * Enhanced with transparent explanation capabilities.
 */
class MLFeatureExplainer {
  constructor() {
    // Define all feature weights and their meanings
    this.weights = {
      'qty_dot_url': 0.05,          // Number of dots in URL
      'qty_hyphen_url': 0.05,       // Number of hyphens in URL
      'length_url': 0.1,            // Length of the URL
      'qty_at_url': 0.1,            // Number of @ symbols 
      'domain_in_ip': 0.35,         // IP address instead of domain name (major flag)
      'tls_ssl_certificate': -0.15, // HTTPS/SSL reduces risk (negative weight)
      'url_google_index': -0.1,     // Google indexed site reduces risk
      'domain_google_index': -0.1,  // Google indexed domain reduces risk
      'qty_redirects': 0.1,         // More redirects increase risk
      'time_domain_activation': -0.1, // Older domains reduce risk
      'qty_ip_resolved': -0.05,     // Number of IPs a domain resolves to
      'domain_spf': -0.05,          // SPF record for email security
      'asn_ip': -0.05               // Autonomous System Number
    };
    
    // Feature display names for better readability
    this.featureNames = {
      'qty_dot_url': 'Number of Dots in URL',
      'qty_hyphen_url': 'Number of Hyphens in URL',
      'length_url': 'URL Length',
      'qty_at_url': 'Number of @ Symbols',
      'domain_in_ip': 'IP Address Used as Domain',
      'tls_ssl_certificate': 'SSL/TLS Certificate',
      'url_google_index': 'URL Indexed by Google',
      'domain_google_index': 'Domain Indexed by Google',
      'qty_redirects': 'Number of Redirects',
      'time_domain_activation': 'Domain Age',
      'qty_ip_resolved': 'Number of IP Addresses',
      'domain_spf': 'Domain SPF Record',
      'asn_ip': 'Autonomous System Number'
    };
    
    // Feature explanations
    this.featureExplanations = {
      'qty_dot_url': 'Multiple dots may indicate subdomain abuse or complex URL structure',
      'qty_hyphen_url': 'Multiple hyphens often appear in deceptive look-alike domains',
      'length_url': 'Excessively long URLs can hide malicious code or redirect destinations',
      'qty_at_url': 'The @ symbol in URLs can be used to hide the true destination',
      'domain_in_ip': 'Using an IP address instead of a domain name is a common phishing technique',
      'tls_ssl_certificate': 'HTTPS encryption protects data transmission and verifies site identity',
      'url_google_index': 'Legitimate sites are typically indexed by search engines',
      'domain_google_index': 'Domains not indexed by search engines may be newly created for phishing',
      'qty_redirects': 'Multiple redirects can mask the true destination of a URL',
      'time_domain_activation': 'Newer domains are more likely to be used for phishing',
      'qty_ip_resolved': 'Multiple IP addresses may indicate fast-flux hosting (evasion technique)',
      'domain_spf': 'SPF records help prevent email spoofing',
      'asn_ip': 'ASN identifies the network where a site is hosted'
    };
    
    // Feature risk thresholds - when a feature becomes concerning
    this.riskThresholds = {
      'qty_dot_url': 5,
      'qty_hyphen_url': 3,
      'length_url': 70,
      'qty_at_url': 1,
      'domain_in_ip': 0.5,
      'tls_ssl_certificate': 0.5,  // Below this is risky (no SSL)
      'url_google_index': 0.5,     // Below this is risky (not indexed)
      'domain_google_index': 0.5,  // Below this is risky (not indexed)
      'qty_redirects': 2,
      'time_domain_activation': 30, // Below this is risky (new domain)
      'qty_ip_resolved': 5,        // Above this is suspicious
      'domain_spf': 0.5,           // Below this is risky (no SPF)
      'asn_ip': 0                  // Default
    };

    // Feature impact levels
    this.featureImpacts = {
      'domain_in_ip': 'High',
      'tls_ssl_certificate': 'High',
      'qty_at_url': 'High',
      'length_url': 'Medium',
      'qty_redirects': 'Medium',
      'url_google_index': 'Medium',
      'domain_google_index': 'Medium',
      'time_domain_activation': 'Medium',
      'qty_dot_url': 'Low',
      'qty_hyphen_url': 'Low',
      'qty_ip_resolved': 'Low',
      'url_shortened': 'High',
      'domain_spf': 'Low',
      'asn_ip': 'Low'
    };
    
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
   * Generate transparent HTML for the risk explanation - Summary Version
   * This generates a simplified version for the main analysis page
   */
  generateSummaryHTML(features, url, result) {
    try {
      const riskScore = result.risk_score;
      const isPhishing = result.is_phishing;
      let html = '';
      
      // Add security overview section
      html += `<div class="scan-summary">
        <h3>Security Analysis</h3>
        <div class="risk-score">
          <div class="risk-score-label">Risk Score:</div>
          <span class="${riskScore > 60 ? 'high-risk' : riskScore > 30 ? 'medium-risk' : 'low-risk'}">${riskScore}/100</span>
        </div>`;
      
      // Display overall assessment
      if (isPhishing || riskScore > 80) {
        html += `<p><strong>High-Risk Features Detected</strong><br>
        This URL displays multiple characteristics commonly associated with phishing sites.</p>`;
      } else if (riskScore > 60) {
        html += `<p><strong>Suspicious URL Detected</strong><br>
        This URL has some concerning characteristics that warrant caution.</p>`;
      } else if (riskScore > 30) {
        html += `<p><strong>Some Caution Advised</strong><br>
        While not clearly malicious, this site has some minor risk factors.</p>`;
      } else {
        html += `<p><strong>No Security Issues Detected</strong><br>
        Our analysis did not find any significant security concerns with this URL. Always continue practicing safe browsing habits.</p>`;
      }
      
      html += `</div>`;
      
      // Calculate the contribution each feature made to the final score
      const contributions = {};
      Object.keys(this.weights).forEach(feature => {
        if (typeof features[feature] !== 'undefined') {
          contributions[feature] = features[feature] * this.weights[feature];
        }
      });
      
      // Sort features by absolute contribution value
      const sortedFeatures = Object.keys(contributions)
        .sort((a, b) => Math.abs(contributions[b]) - Math.abs(contributions[a]));
        
      // Generate positive and negative contributors
      const positiveContributors = sortedFeatures.filter(f => contributions[f] > 0);
      const negativeContributors = sortedFeatures.filter(f => contributions[f] < 0);
      
      // Start risk factors section - show only top 2 factors for summary
      if (positiveContributors.length > 0) {
        html += `<div class="factors-section">
          <div class="section-title"><i class="fas fa-exclamation-triangle"></i> Risk Factors</div>
          <div class="risk-factors-list">`;
          
        // Display the top risk contributors  
        for (const feature of positiveContributors.slice(0, 2)) {
          const impact = this.featureImpacts[feature] || 'Medium';
          const impactClass = impact === 'High' ? 'high' : impact === 'Medium' ? 'medium' : 'low';
          const displayValue = this.formatFeatureValue(feature, features[feature]);
          
          html += `<div class="factor-card ${impactClass}">
            <div class="factor-header">
              <div class="factor-name">${this.featureNames[feature] || this.formatFeatureName(feature)}</div>
              <div class="factor-impact">
                <span class="impact-badge ${impactClass}">${impact}</span>
              </div>
            </div>
            <p class="factor-explanation">${this.featureExplanations[feature] || ''}</p>
            <p class="factor-value">Value: ${displayValue}</p>
          </div>`;
        }
        
        html += `</div></div>`;
      }
      
      // Add positive security factors - show only top 1 factor for summary
      if (negativeContributors.length > 0) {
        html += `<div class="factors-section">
          <div class="section-title"><i class="fas fa-shield-alt"></i> Positive Security Signals</div>
          <div class="safe-factors-list">`;
          
        for (const feature of negativeContributors.slice(0, 1)) {
          const displayValue = this.formatFeatureValue(feature, features[feature]);
          
          html += `<div class="factor-card safe">
            <div class="factor-header">
              <div class="factor-name">${this.featureNames[feature] || this.formatFeatureName(feature)}</div>
              <div class="factor-impact">
                <span class="impact-badge low" style="background-color:#4caf50;">Positive</span>
              </div>
            </div>
            <p class="factor-explanation">${this.featureExplanations[feature] || ''}</p>
            <p class="factor-value">Value: ${displayValue}</p>
          </div>`;
        }
        
        html += `</div></div>`;
      }
      
      // Add "View Detailed Analysis" button
      html += `<div style="text-align: center; margin-top: 20px;">
        <a href="analysis-details.html" 
           onclick="sessionStorage.setItem('analysisData', JSON.stringify({url: '${encodeURIComponent(url)}', features: ${JSON.stringify(features)}, result: ${JSON.stringify(result)}}));"
           class="btn-primary" style="display: inline-flex; text-decoration: none;">
          <i class="fas fa-chart-bar"></i> View Detailed Analysis
        </a>
      </div>`;
      
      // Recommendations section (simplified for summary)
      html += `<div class="recommendations-section">
        <div class="recommendations-title"><i class="fas fa-lightbulb"></i> Recommendations</div>
        <div class="security-advice ${riskScore > 60 ? 'high-risk' : riskScore > 30 ? 'medium-risk' : ''}">
          <p>${this.getRecommendation(riskScore, isPhishing)}</p>
        </div>
      </div>`;
      
      return html;
    } catch (error) {
      console.error('Error generating summary HTML:', error);
      return `<p>An error occurred while generating the summary report. Risk score: ${result.risk_score}/100</p>`;
    }
  }

  /**
   * Generate transparent HTML for the risk explanation - FULL Version
   */
  generateTransparentHTML(features, url, result) {
    try {
      // Make sure we have a numeric risk score between 0-100
      let riskScore = result.risk_score;
      if (typeof riskScore === 'string') {
        riskScore = parseFloat(riskScore);
      }
      // If the score is in decimal (0-1 range), convert to 0-100 scale
      if (riskScore <= 1.0 && riskScore > 0) {
        riskScore = riskScore * 100;
      }
      // Round to 1 decimal place for display
      riskScore = Math.round(riskScore * 10) / 10;
      
      const isPhishing = result.is_phishing;
      const baseScore = 50; // Start from a base of 50
      
      // Add styles for modern UI
      let html = `<style>
        /* Modern UI Styles */
        .analysis-details-container {
          font-family: var(--font-main);
          max-width: 1000px;
          margin: 0 auto;
        }
        
        .details-header {
          position: relative;
          padding: 35px;
          margin-bottom: 30px;
          border-radius: 16px;
          overflow: hidden;
          background: linear-gradient(145deg, var(--card-bg) 0%, rgba(35, 35, 45, 0.95) 100%);
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .details-header::before {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          width: 300px;
          height: 100%;
          background-image: radial-gradient(circle at 80% 40%, rgba(61, 133, 198, 0.1) 0%, transparent 60%);
          z-index: 0;
        }
        
        .details-title {
          position: relative;
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 15px;
          color: var(--text-primary);
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          z-index: 1;
        }
        
        .details-description {
          position: relative;
          color: var(--text-secondary);
          font-size: 16px;
          max-width: 650px;
          line-height: 1.6;
          z-index: 1;
          margin-bottom: 25px;
        }
        
        .details-meta {
          position: relative;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 25px;
          z-index: 1;
        }
        
        .meta-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: var(--text-secondary);
          background-color: rgba(255, 255, 255, 0.05);
          padding: 8px 16px;
          border-radius: 30px;
          border: 1px solid rgba(255, 255, 255, 0.03);
          transition: all 0.2s ease;
        }
        
        .meta-item:hover {
          background-color: rgba(255, 255, 255, 0.08);
          transform: translateY(-2px);
        }
        
        .meta-item i {
          color: var(--primary-color);
        }
        
        .score-ring-container {
          position: absolute;
          top: 35px;
          right: 35px;
          width: 140px;
          height: 140px;
          z-index: 2;
          filter: drop-shadow(0 10px 15px rgba(0, 0, 0, 0.2));
        }
        
        .score-ring {
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          transform: perspective(1000px) rotateY(-10deg);
        }
        
        .score-circle {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: conic-gradient(
            ${riskScore > 60 ? '#f44336' : riskScore > 30 ? '#ff9800' : '#4caf50'} 
            0% ${riskScore}%, 
            rgba(255, 255, 255, 0.1) ${riskScore}% 100%
          );
          box-shadow: 0 0 30px rgba(
            ${riskScore > 60 ? '244, 67, 54' : riskScore > 30 ? '255, 152, 0' : '76, 175, 80'}, 0.2);
          transform: rotate(-90deg);
        }
        
        .score-inner {
          position: absolute;
          top: 10px;
          left: 10px;
          right: 10px;
          bottom: 10px;
          background-color: var(--card-bg);
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        
        .score-value {
          font-size: 26px;
          font-weight: 700;
          color: ${riskScore > 60 ? '#f44336' : riskScore > 30 ? '#ff9800' : '#4caf50'};
        }
        
        .score-label {
          font-size: 12px;
          color: var(--text-tertiary);
          margin-top: 3px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        /* Main layout */
        .details-grid {
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          gap: 20px;
        }
        
        /* Cards */
        .details-card {
          background-color: var(--card-bg);
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          margin-bottom: 20px;
        }
        
        .details-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
        }
        
        .card-header {
          padding: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .card-title {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .card-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background-color: rgba(61, 133, 198, 0.1);
          color: var(--primary-color);
        }
        
        .card-danger .card-icon {
          background-color: rgba(244, 67, 54, 0.1);
          color: #f44336;
        }
        
        .card-warning .card-icon {
          background-color: rgba(255, 152, 0, 0.1);
          color: #ff9800;
        }
        
        .card-success .card-icon {
          background-color: rgba(76, 175, 80, 0.1);
          color: #4caf50;
        }
        
        .card-content {
          padding: 20px;
        }
        
        /* Feature cards grid */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 15px;
        }
        
        .feature-card {
          background-color: rgba(255, 255, 255, 0.02);
          border-radius: 12px;
          padding: 15px;
          position: relative;
          overflow: hidden;
          border-left: 3px solid transparent;
        }
        
        .feature-card.risky {
          border-left-color: #f44336;
        }
        
        .feature-card.safe {
          border-left-color: #4caf50;
        }
        
        .feature-title {
          font-weight: 600;
          font-size: 15px;
          margin: 0 0 5px 0;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .feature-badge {
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 12px;
          background-color: rgba(244, 67, 54, 0.1);
          color: #f44336;
        }
        
        .feature-badge.safe {
          background-color: rgba(76, 175, 80, 0.1);
          color: #4caf50;
        }
        
        .feature-description {
          color: var(--text-secondary);
          font-size: 13px;
          line-height: 1.5;
          margin: 8px 0;
        }
        
        .feature-meta {
          display: flex;
          justify-content: space-between;
          color: var(--text-tertiary);
          font-size: 12px;
          margin-top: 10px;
        }
        
        /* Score breakdown */
        .score-breakdown {
          margin: 20px 0;
        }
        
        .score-bar-container {
          height: 60px;
          background-color: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          position: relative;
          display: flex;
          overflow: visible;
        }
        
        .score-segment {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 13px;
          font-weight: 600;
          position: relative;
          min-width: 2px;
          transition: width 0.8s cubic-bezier(0.65, 0, 0.35, 1);
        }
        
        .score-segment.base {
          background-color: #5c6bc0;
          border-radius: 8px 0 0 8px;
        }
        
        .score-segment.positive {
          background-color: #f44336;
        }
        
        .score-segment.negative {
          background-color: #4caf50;
        }
        
        .score-label {
          position: absolute;
          top: -25px;
          transform: translateX(-50%);
          white-space: nowrap;
          font-size: 12px;
          font-weight: 500;
        }
        
        .final-score-pointer {
          position: absolute;
          top: -15px;
          width: 3px;
          height: 80px;
          background-color: rgba(255, 255, 255, 0.8);
          border-radius: 3px;
          z-index: 10;
          transition: left 1s cubic-bezier(0.65, 0, 0.35, 1);
        }
        
        .final-score-pointer::after {
          content: 'Final: ${Math.round(riskScore)}';
          position: absolute;
          bottom: -25px;
          left: 50%;
          transform: translateX(-50%);
          background-color: #333;
          color: white;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 12px;
          white-space: nowrap;
        }
        
        .score-legend {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-top: 40px;
        }
        
        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-secondary);
        }
        
        .legend-color {
          width: 12px;
          height: 12px;
          border-radius: 3px;
        }
        
        .legend-base {
          background-color: #5c6bc0;
        }
        
        .legend-positive {
          background-color: #f44336;
        }
        
        .legend-negative {
          background-color: #4caf50;
        }
        
        /* Tables */
        .details-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .details-table th {
          text-align: left;
          padding: 12px;
          background-color: rgba(255, 255, 255, 0.02);
          color: var(--text-secondary);
          font-weight: 500;
          font-size: 14px;
        }
        
        .details-table td {
          padding: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 14px;
        }
        
        .details-table tr:hover td {
          background-color: rgba(255, 255, 255, 0.02);
        }
        
        .details-table .risky {
          color: #f44336;
        }
        
        .details-table .safe {
          color: #4caf50;
        }
        
        /* Expandable sections */
        .expandable {
          margin-bottom: 15px;
        }
        
        .expandable-header {
          padding: 15px;
          background-color: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          user-select: none;
        }
        
        .expandable-title {
          font-weight: 600;
          font-size: 15px;
          margin: 0;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .expandable-toggle {
          color: var(--text-tertiary);
          transition: transform 0.3s ease;
        }
        
        .expandable-content {
          background-color: rgba(255, 255, 255, 0.01);
          border-radius: 0 0 8px 8px;
          margin-top: 2px;
          padding: 20px;
          max-height: 0;
          overflow: hidden;
          opacity: 0;
          transition: all 0.3s ease;
        }
        
        .expandable.open .expandable-toggle {
          transform: rotate(180deg);
        }
        
        .expandable.open .expandable-content {
          max-height: 2000px;
          opacity: 1;
        }
        
        /* Recommendations section */
        .recommendations {
          padding: 25px;
          background: linear-gradient(135deg, rgba(76, 175, 80, 0.05) 0%, rgba(76, 175, 80, 0.01) 100%);
          border-radius: 16px;
          border-left: 4px solid #4caf50;
        }
        
        .recommendations.high-risk {
          background: linear-gradient(135deg, rgba(244, 67, 54, 0.05) 0%, rgba(244, 67, 54, 0.01) 100%);
          border-left: 4px solid #f44336;
        }
        
        .recommendations.medium-risk {
          background: linear-gradient(135deg, rgba(255, 152, 0, 0.05) 0%, rgba(255, 152, 0, 0.01) 100%);
          border-left: 4px solid #ff9800;
        }
        
        .rec-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 15px;
          color: var(--text-primary);
        }
        
        .rec-icon {
          color: #4caf50;
        }
        
        .recommendations.high-risk .rec-icon {
          color: #f44336;
        }
        
        .recommendations.medium-risk .rec-icon {
          color: #ff9800;
        }
        
        .rec-message {
          color: var(--text-secondary);
          font-size: 16px;
          margin-bottom: 20px;
          line-height: 1.6;
        }
        
        .safety-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 15px;
          list-style-type: none;
          padding: 0;
          margin: 0;
        }
        
        .safety-item {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          color: var(--text-secondary);
          font-size: 14px;
        }
        
        .safety-item i {
          color: var(--primary-color);
          margin-top: 3px;
        }
        
        /* Footer */
        .details-footer {
          margin-top: 40px;
          padding: 20px;
          text-align: center;
          color: var(--text-tertiary);
          font-size: 13px;
        }
        
        /* Responsive */
        @media (max-width: 960px) {
          .score-ring-container {
            position: relative;
            top: auto;
            right: auto;
            margin: 20px auto;
          }
          
          .details-grid {
            grid-template-columns: 1fr;
          }
          
          .features-grid {
            grid-template-columns: 1fr;
          }
          
          .safety-list {
            grid-template-columns: 1fr;
          }
        }
      </style>`;

      // Begin main container
      html += `<div class="analysis-details-container">
        <!-- Header with URL and score -->
        <div class="details-header">
          <div class="url-badge">${url}</div>
          <h1 class="details-title">
            ${isPhishing || riskScore > 80 
              ? 'High-Risk Website Detected' 
              : riskScore > 60 
                ? 'Suspicious Website Detected' 
                : riskScore > 30 
                  ? 'Some Caution Advised' 
                  : 'No Major Security Concerns'}
          </h1>
          <p class="details-description">
            ${isPhishing || riskScore > 80 
              ? 'Our analysis detected multiple high-risk factors typically associated with phishing websites. Proceed with extreme caution.' 
              : riskScore > 60 
                ? 'This website displays some suspicious characteristics that warrant your attention.' 
                : riskScore > 30 
                  ? 'While not clearly malicious, this website has some minor risk factors to be aware of.' 
                  : 'Our analysis did not find significant security concerns with this website, but always practice safe browsing habits.'}
          </p>
          <div class="details-meta">
            <div class="meta-item">
              <i class="fas fa-calendar-alt"></i>
              <span>Analyzed ${new Date().toLocaleDateString()}</span>
            </div>
            <div class="meta-item">
              <i class="fas ${isPhishing ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
              <span>Risk Level: ${riskScore > 80 ? 'Very High' : riskScore > 60 ? 'High' : riskScore > 30 ? 'Moderate' : 'Low'}</span>
            </div>
          </div>
          
          <!-- Circular score indicator -->
          <div class="score-ring-container">
            <div class="score-ring">
              <div class="score-circle"></div>
              <div class="score-inner">
                <div class="score-value">${Math.round(riskScore)}</div>
                <div class="score-label">Risk Score</div>
              </div>
            </div>
          </div>
        </div>`;

      // Calculate the contribution each feature made to the final score
      const contributions = {};
      let totalContribution = 0;
      let totalPositive = 0;
      let totalNegative = 0;
      
      Object.keys(this.weights).forEach(feature => {
        if (features[feature] !== undefined) {
          // Ensure numeric values for calculation
          let value = features[feature];
          if (typeof value === 'boolean') value = value ? 1 : 0;
          if (typeof value === 'string' && !isNaN(value)) value = parseFloat(value);
          
          contributions[feature] = value * this.weights[feature];
          totalContribution += contributions[feature];
          
          if (contributions[feature] > 0) {
            totalPositive += contributions[feature];
          } else {
            totalNegative += Math.abs(contributions[feature]);
          }
        }
      });
      
      // Sort features by absolute contribution value
      const sortedFeatures = Object.keys(contributions)
        .sort((a, b) => Math.abs(contributions[b]) - Math.abs(contributions[a]));
        
      // Generate positive and negative contributors
      const positiveContributors = sortedFeatures.filter(f => contributions[f] > 0);
      const negativeContributors = sortedFeatures.filter(f => contributions[f] < 0);

      // Risk factors card
      if (positiveContributors.length > 0) {
        html += `
          <!-- Risk Factors Card -->
          <div class="details-card card-danger">
            <div class="card-header">
              <h2 class="card-title">
                <span class="card-icon"><i class="fas fa-exclamation-triangle"></i></span>
                Risk Factors
              </h2>
              <span>${positiveContributors.length} detected</span>
            </div>
            <div class="card-content">
              <div class="features-grid">`;
        
        // Add each risk factor as a card
        positiveContributors.forEach(feature => {
          const impact = this.featureImpacts[feature] || 'Medium';
          const displayValue = this.formatFeatureValue(feature, features[feature]);
          
          html += `
            <div class="feature-card risky">
              <div class="feature-title">
                ${this.featureNames[feature] || this.formatFeatureName(feature)}
                <span class="feature-badge">${impact} Impact</span>
              </div>
              <div class="feature-description">
                ${this.featureExplanations[feature] || 'This feature indicates potential risk.'}
              </div>
              <div class="feature-meta">
                <div>Value: ${displayValue}</div>
                <div>Contribution: +${contributions[feature].toFixed(2)} pts</div>
              </div>
            </div>`;
        });
              
        html += `
              </div>
            </div>
          </div>`;
      }

      // Positive security factors card
      if (negativeContributors.length > 0) {
        html += `
          <!-- Positive Security Signals Card -->
          <div class="details-card card-success">
            <div class="card-header">
              <h2 class="card-title">
                <span class="card-icon"><i class="fas fa-shield-alt"></i></span>
                Security Strengths
              </h2>
              <span>${negativeContributors.length} detected</span>
            </div>
            <div class="card-content">
              <div class="features-grid">`;
        
        // Add each security strength as a card
        negativeContributors.forEach(feature => {
          const displayValue = this.formatFeatureValue(feature, features[feature]);
          
          html += `
            <div class="feature-card safe">
              <div class="feature-title">
                ${this.featureNames[feature] || this.formatFeatureName(feature)}
                <span class="feature-badge safe">Positive</span>
              </div>
              <div class="feature-description">
                ${this.featureExplanations[feature] || 'This feature indicates good security practice.'}
              </div>
              <div class="feature-meta">
                <div>Value: ${displayValue}</div>
                <div>Contribution: ${contributions[feature].toFixed(2)} pts</div>
              </div>
            </div>`;
        });
              
        html += `
              </div>
            </div>
          </div>`;
      }

      // Score visualization card
      const finalScore = Math.max(0, Math.min(100, baseScore + totalContribution));
      html += `
        <!-- Score Breakdown Card -->
        <div class="details-card">
          <div class="card-header">
            <h2 class="card-title">
              <span class="card-icon"><i class="fas fa-chart-bar"></i></span>
              Score Calculation
            </h2>
          </div>
          <div class="card-content">
            <p>Risk scores start from a base of 50 points. Features with positive values increase the risk, while negative values decrease it.</p>
            
            <!-- Visual score bar -->
            <div class="score-breakdown">
              <div class="score-bar-container">
                <!-- Base score segment -->
                <div class="score-segment base" style="width: ${baseScore}%;">
                  <span class="score-label">Base: 50</span>
                </div>
                
                <!-- Risk factors segment -->
                <div class="score-segment positive" style="width: ${totalPositive}%;">
                  <span class="score-label">+${totalPositive.toFixed(1)}</span>
                </div>
                
                <!-- Safety factors segment -->
                <div class="score-segment negative" style="width: ${totalNegative}%;">
                  <span class="score-label">${totalNegative ? '-' + totalNegative.toFixed(1) : ''}</span>
                </div>
                
                <!-- Final score marker - explicitly calculate position -->
                <div class="final-score-pointer" style="left: ${finalScore}%;">
                  <div class="marker-line"></div>
                  <div class="marker-label">Final: ${finalScore.toFixed(1)}</div>
                </div>
              </div>
              
              <div class="score-legend">
                <div class="legend-item">
                  <div class="legend-color legend-base"></div>
                  <span>Base Score (50)</span>
                </div>
                <div class="legend-item">
                  <div class="legend-color legend-positive"></div>
                  <span>Risk Factors (+${totalPositive.toFixed(1)})</span>
                </div>
                <div class="legend-item">
                  <div class="legend-color legend-negative"></div>
                  <span>Safety Factors (-${totalNegative.toFixed(1)})</span>
                </div>
              </div>
            </div>

            <!-- Expandable detailed calculation -->
            <div class="expandable" id="calculation-details">
              <div class="expandable-header" onclick="document.getElementById('calculation-details').classList.toggle('open')">
                <h3 class="expandable-title">
                  <i class="fas fa-table"></i>
                  Detailed Calculation
                </h3>
                <span class="expandable-toggle">
                  <i class="fas fa-chevron-down"></i>
                </span>
              </div>
              <div class="expandable-content">
                <table class="details-table">
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th>Weight</th>
                      <th>Value</th>
                      <th>Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Base Score</strong></td>
                      <td>-</td>
                      <td>-</td>
                      <td>+50.00</td>
                    </tr>`;
      
      // Add individual feature calculations
      sortedFeatures.forEach(feature => {
        const weight = this.weights[feature];
        const value = features[feature];
        const contribution = contributions[feature];
        const isRisk = contribution > 0;
        
        html += `
                    <tr>
                      <td class="${isRisk ? 'risky' : 'safe'}">${this.featureNames[feature] || this.formatFeatureName(feature)}</td>
                      <td>${weight > 0 ? '+' + weight : weight}</td>
                      <td>${this.formatFeatureValue(feature, value)}</td>
                      <td class="${isRisk ? 'risky' : 'safe'}">${contribution > 0 ? '+' + contribution.toFixed(2) : contribution.toFixed(2)}</td>
                    </tr>`;
      });
      
      // Add total row
      html += `
                    <tr style="font-weight: bold;">
                      <td colspan="3">Final Score</td>
                      <td>${finalScore.toFixed(1)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>`;

      // Technical details card with all features
      html += `
        <!-- All Features Card -->
        <div class="details-card">
          <div class="card-header">
            <h2 class="card-title">
              <span class="card-icon"><i class="fas fa-code"></i></span>
              Technical Details
            </h2>
          </div>
          <div class="card-content">
            <div class="expandable open" id="all-features">
              <div class="expandable-header" onclick="document.getElementById('all-features').classList.toggle('open')">
                <h3 class="expandable-title">
                  <i class="fas fa-list"></i>
                  All Detected Features
                </h3>
                <span class="expandable-toggle">
                  <i class="fas fa-chevron-down"></i>
                </span>
              </div>
              <div class="expandable-content">
                <table class="details-table">
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th>Value</th>
                      <th>Description</th>
                      <th>Risk Level</th>
                    </tr>
                  </thead>
                  <tbody>`;
      
      // Add all features from weights dictionary
      for (const feature of Object.keys(this.weights)) {
        const value = typeof features[feature] !== 'undefined' ? features[feature] : 'Not detected';
        const displayValue = this.formatFeatureValue(feature, value);
        const impact = this.featureImpacts[feature] || 'Medium';
        
        // Determine if this is a risk feature
        let isRisk = false;
        if (typeof features[feature] !== 'undefined') {
          if (features[feature] * this.weights[feature] > 0) {
            isRisk = true;
          }
        }
        
        html += `
                    <tr>
                      <td class="${typeof features[feature] !== 'undefined' ? (isRisk ? 'risky' : 'safe') : ''}">${this.featureNames[feature] || this.formatFeatureName(feature)}</td>
                      <td>${displayValue}</td>
                      <td>${this.featureExplanations[feature] || 'No description available'}</td>
                      <td>${impact}</td>
                    </tr>`;
      }
      
      html += `
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>`;

      // Recommendations section
      html += `
        <!-- Recommendations -->
        <div class="recommendations ${riskScore > 60 ? 'high-risk' : riskScore > 30 ? 'medium-risk' : ''}">
          <div class="rec-title">
            <i class="fas fa-lightbulb rec-icon"></i>
            Recommendations
          </div>
          <div class="rec-message">
            ${this.getRecommendation(riskScore, isPhishing)}
          </div>
          <ul class="safety-list">
            <li class="safety-item">
              <i class="fas fa-check-circle"></i>
              <span>Always verify the website address before entering personal information</span>
            </li>
            <li class="safety-item">
              <i class="fas fa-check-circle"></i>
              <span>Check for HTTPS and valid certificates before sharing sensitive data</span>
            </li>
            <li class="safety-item">
              <i class="fas fa-check-circle"></i>
              <span>Use unique passwords for different websites</span>
            </li>
            <li class="safety-item">
              <i class="fas fa-check-circle"></i>
              <span>Enable two-factor authentication when available</span>
            </li>
          </ul>
        </div>
        
        <!-- Footer -->
        <div class="details-footer">
          Analysis performed by PhishGuard using machine learning and security heuristics
        </div>
      </div>

      <script>
        // Initialize expandable sections
        document.addEventListener('DOMContentLoaded', function() {
          // Make calculation details initially open
          document.getElementById('calculation-details').classList.add('open');
          
          // Animation for score segments
          setTimeout(() => {
            document.querySelectorAll('.score-segment').forEach(el => {
              el.style.width = el.getAttribute('data-width') + '%';
            });
          }, 500);
        });
      </script>`;
      
      return html;
    } catch (error) {
      console.error('Error generating transparent HTML:', error);
      return `<p>An error occurred while generating the detailed report. Risk score: ${result.risk_score}/100</p>`;
    }
  }

  /**
   * Format feature value for display
   */
  formatFeatureValue(feature, value) {
    if (value === 'Not detected') return value;
    
    if (feature === 'domain_in_ip') {
      return value === 1 || value === true ? "Yes" : "No";
    } else if (feature === 'tls_ssl_certificate') {
      return value === 1 ? "Secure (HTTPS)" : "Missing";
    } else if (feature === 'url_google_index' || feature === 'domain_google_index') {
      return value === 1 ? "Yes" : "No";
    } else if (feature === 'domain_spf') {
      return value === 1 ? "Present" : "Missing";
    } else if (feature === 'time_domain_activation') {
      return value === 0 ? "Unknown" : `${value} days`;
    } else if (feature === 'length_url') {
      return `${value} characters`;
    }
    
    return value;
  }
  
  /**
   * Format feature names for display
   */
  formatFeatureName(name) {
    // Replace underscores with spaces and capitalize each word
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  
  /**
   * Get recommendation based on risk score
   */
  getRecommendation(score, isPhishing) {
    if (isPhishing || score > 80) {
      return 'This URL is high risk. We strongly recommend not proceeding to this website.';
    } else if (score > 60) {
      return 'Exercise significant caution with this website. We recommend verifying its legitimacy through other sources before proceeding.';
    } else if (score > 30) {
      return 'Exercise caution with this website. If you proceed, be vigilant about sharing any information.';
    } else {
      return 'This URL appears to be safe, but always follow good security practices when browsing.';
    }
  }
}

// Make sure the script can be imported in Node and browsers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MLFeatureExplainer;
}
