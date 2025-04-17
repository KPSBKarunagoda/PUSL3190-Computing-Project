/**
 * ML Feature Explainer
 * Provides transparent explanations of ML features and risk scoring
 */
class MLFeatureExplainer {
  constructor() {
    // Feature icons for better visualization
    this.featureIcons = {
      'domain_in_ip': 'fas fa-network-wired',
      'tls_ssl_certificate': 'fas fa-certificate', 
      'length_url': 'fas fa-text-width',
      'qty_dot_url': 'fas fa-ellipsis-h',
      'qty_hyphen_url': 'fas fa-minus',
      'qty_underline_url': 'fas fa-underscore',
      'qty_slash_url': 'fas fa-slash',
      'qty_questionmark_url': 'fas fa-question',
      'qty_equal_url': 'fas fa-equals',
      'qty_at_url': 'fas fa-at',
      'qty_and_url': 'fas fa-ampersand',
      'url_shortened': 'fas fa-compress-alt',
      'time_domain_activation': 'fas fa-calendar-alt',
      'qty_redirects': 'fas fa-directions',
      'domain_google_index': 'fas fa-globe',
      'url_google_index': 'fas fa-search',
      'qty_ip_resolved': 'fas fa-server',
      'domain_spf': 'fas fa-envelope-open',
      'asn_ip': 'fas fa-route'
    };
    
    // Enhanced feature explanations for better educational content
    this.featureExplanations = {
      'domain_in_ip': 'Legitimate websites almost always use domain names rather than raw IP addresses. IP addresses in URLs are highly suspicious and commonly used in phishing attacks because they\'re harder to remember and trust.',
      'tls_ssl_certificate': 'SSL certificates encrypt data between your browser and the website, and validate the site\'s identity. Sites without SSL (HTTP instead of HTTPS) pose security risks as data is transmitted in plain text. Most legitimate websites now use HTTPS.',
      'length_url': 'Phishers often use extremely long URLs to hide malicious code or redirect destinations. URLs containing long strings of random characters are often used to evade detection or to make the URL difficult to analyze.',
      'qty_dot_url': 'Multiple dots in a URL can indicate subdomain abuse or an attempt to create confusion. Phishers may use many subdomains (like secure.banking.login.example.com) to make URLs look more legitimate or complex.',
      'qty_hyphen_url': 'Excessive hyphens in a domain name are often used in typosquatting attacks - creating domains that look similar to legitimate ones (like paypal-secure-login.com). Multiple hyphens are uncommon in legitimate domain names.',
      'url_shortened': 'URL shortening services hide the actual destination URL. While they have legitimate uses, they\'re frequently exploited in phishing attacks to disguise malicious links behind innocent-looking shortened URLs.',
      'qty_redirects': 'Multiple redirects can mask the final destination of a URL. Legitimate websites typically use minimal redirects, while phishing sites may use several to evade detection or hide the true destination from security tools.',
      'time_domain_activation': 'Recently registered domains (less than 30 days old) are more likely to be malicious as phishers frequently create new domains for short-term campaigns. Most legitimate websites have established domain history.',
      'qty_ip_resolved': 'Multiple IP resolutions can indicate fast-flux hosting, a technique used by botnets to hide malicious activities behind constantly changing IP addresses, making the source harder to block.',
      'qty_slash_url': 'An excessive number of slashes in a URL can indicate directory manipulation or attempts to create complex paths that hide malicious destinations or code.',
      'qty_questionmark_url': 'Multiple question marks in URLs are unusual and often indicate complex query parameters that may be used to exploit vulnerabilities or pass encoded malicious data.',
      'qty_equal_url': 'An excessive number of equals signs in a URL may indicate complex parameter passing, which can be used for SQL injection or other attacks.',
      'qty_at_url': 'The @ symbol in URLs can be used for deception. In some contexts, browsers may interpret everything before @ as authentication credentials rather than part of the domain.',
      'qty_and_url': 'Multiple ampersands in a URL often indicate complex query parameters. While legitimate in many cases, excessive use can be a sign of attempts to confuse users or security tools.',
      'qty_underline_url': 'Underscores in domain names are less common in legitimate websites and may be used to create look-alike domains for phishing.',
      'domain_google_index': 'Domains not indexed by Google may be new or unpopular, which is sometimes indicative of phishing sites. Most legitimate commercial websites are indexed by major search engines.',
      'url_google_index': 'Specific URLs not indexed by search engines might be new, hidden, or specifically designed to evade detection by security tools that rely on search engine reputation.',
      'domain_spf': 'Missing or improperly configured SPF (Sender Policy Framework) records can indicate domain spoofing risk, especially relevant for email phishing campaigns tied to fake websites.'
    };
    
    // Thresholds for feature significance to better detect important factors
    this.featureThresholds = {
      'length_url': 75,
      'qty_dot_url': 3,
      'qty_hyphen_url': 3,
      'qty_underline_url': 2,
      'qty_slash_url': 5,
      'qty_questionmark_url': 2,
      'qty_equal_url': 3,
      'qty_at_url': 1,
      'qty_and_url': 4,
      'qty_redirects': 1,
      'qty_ip_resolved': 2
    };
  }
  
  /**
   * Check if URL uses an IP address instead of domain
   */
  isIpAddress(url) {
    try {
      const hostname = this.extractHostname(url);
      const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
      return ipPattern.test(hostname);
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Extract hostname from URL
   */
  extractHostname(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      // If URL parsing fails, try to extract the hostname manually
      let hostname = url;
      // Remove protocol
      hostname = hostname.replace(/^(https?:\/\/)/, '');
      // Remove everything after the first slash
      hostname = hostname.split('/')[0];
      return hostname;
    }
  }
  
  /**
   * Format feature name for display
   */
  formatFeatureName(name) {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace('Url', 'URL')
      .replace('Ip', 'IP')
      .replace('Ssl', 'SSL');
  }
  
  /**
   * Generate transparent HTML explanation of risk analysis
   */
  generateTransparentHTML(features, url, result) {
    let html = '';
    const riskScore = result.risk_score;
    const isPhishing = result.is_phishing;
    const isHighRisk = riskScore > 70;
    const isMediumRisk = riskScore > 30 && riskScore <= 70;
    const isLowRisk = riskScore <= 30;
    
    // Get significant risk factors with more comprehensive detection
    const significantFactors = this.getSignificantFactors(features, url);
    
    // Get all features for complete analysis
    const allFeatures = this.getAllFeatures(features);
    
    // Risk overview section
    html += `
      <div class="risk-overview-section">
        <h2><i class="fas fa-shield-alt"></i> Risk Assessment</h2>
        
        <div class="risk-score-overview">
          <div class="risk-score-container">
            <div class="security-score-visual">
              <div class="score-circle circle-background"></div>
              <div class="score-circle circle-progress" id="risk-score-progress"></div>
              <div class="score-circle">
                <div id="risk-score-value" class="score-value">${Math.round(riskScore)}</div>
                <div class="score-label">Risk Score</div>
              </div>
            </div>
            
            <div class="risk-level-badge ${isHighRisk ? 'risk-high' : isMediumRisk ? 'risk-medium' : 'risk-low'}">
              ${isHighRisk ? 'High Risk' : isMediumRisk ? 'Medium Risk' : 'Low Risk'}
            </div>
          </div>
          
          <div class="risk-explanation">
            <h3>${this.getRiskTitle(riskScore, isPhishing)}</h3>
            ${this.getRiskExplanation(riskScore, isPhishing, url)}
            
            <div class="calculation-box">
              <div class="calculation-title">
                <i class="fas fa-calculator"></i> How This Score Was Calculated
              </div>
              <div class="calculation-steps">
                ${this.generateCalculationSteps(significantFactors, riskScore)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Risk factors section - improved to show all significant factors
    html += `
      <div class="risk-factors-section">
        <h2><i class="fas fa-exclamation-circle"></i> Risk Factors</h2>
        <p>The following factors contributed most significantly to this URL's risk assessment:</p>
        
        <div class="risk-factors-grid">
          ${this.generateRiskFactorsHTML(significantFactors)}
        </div>
      </div>
    `;
    
    // Technical details section - enhanced with more comprehensive data
    html += `
      <div class="technical-details-section">
        <h2><i class="fas fa-code"></i> Technical Details</h2>
        
        <div class="expandable open">
          <div class="expandable-header">
            <h3><i class="fas fa-table"></i> Complete Feature Analysis</h3>
            <i class="fas fa-chevron-down expandable-icon"></i>
          </div>
          <div class="expandable-content">
            <div class="expandable-inner">
              <p>Below is a comprehensive analysis of all features examined in this URL. Each feature is evaluated for its impact on the overall risk score.</p>
              <div class="feature-table-legend">
                <div><span class="impact-indicator impact-high"></span> High Impact - Major risk signal</div>
                <div><span class="impact-indicator impact-medium"></span> Medium Impact - Concerning signal</div>
                <div><span class="impact-indicator impact-low"></span> Low Impact - Minor signal</div>
              </div>
              <table class="feature-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Value</th>
                    <th>Impact</th>
                    <th>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.generateFeatureTableRows(features, url)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <div class="expandable">
          <div class="expandable-header">
            <h3><i class="fas fa-chart-pie"></i> Risk Score Distribution</h3>
            <i class="fas fa-chevron-down expandable-icon"></i>
          </div>
          <div class="expandable-content">
            <div class="expandable-inner">
              <p>The final risk score is calculated by evaluating multiple security indicators:</p>
              <ul>
                <li><strong>High-impact features:</strong> Major risk signals like IP-based URLs or missing SSL certificates</li>
                <li><strong>Medium-impact features:</strong> Concerning signals like unusual URL structure or redirects</li>
                <li><strong>Low-impact features:</strong> Minor signals that contribute in aggregate</li>
              </ul>
              <p>The combined evaluation of these factors results in the overall risk score of ${Math.round(riskScore)}/100.</p>
            </div>
          </div>
        </div>

        <div class="expandable">
          <div class="expandable-header">
            <h3><i class="fas fa-code-branch"></i> URL Structure Analysis</h3>
            <i class="fas fa-chevron-down expandable-icon"></i>
          </div>
          <div class="expandable-content">
            <div class="expandable-inner">
              <p>This analysis examines the structural elements of the URL:</p>
              ${this.generateUrlStructureAnalysis(url, features)}
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Educational section - enhanced with specific advice for this URL
    html += `
      <div class="educational-section">
        <h2><i class="fas fa-graduation-cap"></i> Educational Resources</h2>
        
        <div class="expandable">
          <div class="expandable-header">
            <h3><i class="fas fa-search"></i> How to Identify Phishing Sites</h3>
            <i class="fas fa-chevron-down expandable-icon"></i>
          </div>
          <div class="expandable-content">
            <div class="expandable-inner">
              <p>Common characteristics of phishing websites include:</p>
              <ul>
                <li><strong>Suspicious URLs</strong> - Misspelled domain names, IP addresses, or excessive subdomains</li>
                <li><strong>Missing HTTPS</strong> - Legitimate websites typically use secure connections</li>
                <li><strong>Poor Design</strong> - Unprofessional design, spelling errors, or generic greetings</li>
                <li><strong>Urgent Requests</strong> - Creating a false sense of urgency for you to act</li>
                <li><strong>Unexpected Attachments</strong> - Emails with unsolicited attachments that may contain malware</li>
                <li><strong>Strange Sender Addresses</strong> - Email addresses that don't match the claimed organization</li>
              </ul>
              
              <div class="security-advice ${isHighRisk ? 'high-risk' : isMediumRisk ? 'medium-risk' : ''}">
                <h4>For This Website: ${this.truncateUrl(url)}</h4>
                <p>${this.getSecurityAdvice(riskScore, isPhishing, url, significantFactors)}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div class="expandable">
          <div class="expandable-header">
            <h3><i class="fas fa-shield-alt"></i> How to Stay Safe Online</h3>
            <i class="fas fa-chevron-down expandable-icon"></i>
          </div>
          <div class="expandable-content">
            <div class="expandable-inner">
              <p>Follow these best practices to protect yourself from phishing attacks:</p>
              <ul>
                <li>Always verify the URL before entering sensitive information</li>
                <li>Look for HTTPS and valid certificates before providing data</li>
                <li>Be wary of emails/messages asking you to "verify your account" through linked sites</li>
                <li>Use a password manager that won't auto-fill credentials on fake websites</li>
                <li>Enable two-factor authentication on all important accounts</li>
                <li>Keep your browsers and security software updated</li>
                <li>When in doubt, navigate directly to websites by typing their addresses rather than clicking links</li>
                <li>Be especially cautious with financial websites and online payment services</li>
              </ul>
              
              ${this.generateTailoredAdvice(features, url, significantFactors)}
            </div>
          </div>
        </div>
      </div>
    `;
    
    return html;
  }
  
  /**
   * Generate HTML for risk factors
   */
  generateRiskFactorsHTML(factors) {
    if (factors.length === 0) {
      return `
        <div class="no-factors-message">
          <i class="fas fa-check-circle"></i>
          <p>No significant risk factors detected. This is typically a good sign, though all URLs should still be approached with appropriate caution.</p>
        </div>
      `;
    }
    
    let html = '';
    
    factors.forEach(factor => {
      const { name, value, impact, explanation, contribution, description } = factor;
      const iconClass = this.featureIcons[name] || 'fas fa-code';
      
      html += `
        <div class="factor-card ${impact.toLowerCase()}-impact">
          <div class="factor-header">
            <div class="factor-name">
              <i class="${iconClass}"></i>
              ${this.formatFeatureName(name)}
            </div>
            <span class="impact-badge">${impact}</span>
          </div>
          <div class="factor-description">${description}</div>
          <div class="factor-value">${this.formatFeatureValue(name, value)}</div>
          <div class="factor-explanation">${explanation}</div>
          <div class="score-contribution">
            <span>Contribution to Risk Score:</span>
            <div class="contribution-bar">
              <div class="contribution-fill" style="width: ${Math.min(100, contribution * 5)}%"></div>
            </div>
            <span class="contribution-value">+${contribution} points</span>
          </div>
        </div>
      `;
    });
    
    return html;
  }

  /**
   * Get significant factors from features - improved to catch more factors
   */
  getSignificantFactors(features, url) {
    const significantList = [];
    
    // Define feature descriptions for readability
    const featureDescriptions = {
      'domain_in_ip': 'This website uses an IP address instead of a domain name',
      'tls_ssl_certificate': 'This website lacks a secure SSL/TLS certificate',
      'length_url': 'The URL for this website is unusually long',
      'qty_dot_url': 'This URL contains an unusual number of dots',
      'qty_hyphen_url': 'This URL contains an unusual number of hyphens',
      'qty_underline_url': 'This URL contains underscores',
      'qty_slash_url': 'This URL contains many slash characters',
      'qty_questionmark_url': 'This URL contains question marks',
      'qty_equal_url': 'This URL contains equals signs',
      'qty_at_url': 'This URL contains @ symbols',
      'qty_and_url': 'This URL contains ampersand characters',
      'url_shortened': 'This is a shortened URL',
      'time_domain_activation': 'This domain was registered very recently',
      'qty_redirects': 'This URL involves multiple redirects',
      'qty_ip_resolved': 'This domain resolves to multiple IP addresses',
      'domain_google_index': 'This domain is not indexed by Google',
      'url_google_index': 'This specific URL is not indexed by search engines',
      'domain_spf': 'This domain has missing or invalid SPF records'
    };
    
    // First check the URL itself, independent of feature data
    if (this.isIpAddress(url)) {
      significantList.push({
        name: 'domain_in_ip',
        value: 1,
        impact: 'High',
        contribution: 15,
        description: featureDescriptions['domain_in_ip'],
        explanation: this.featureExplanations['domain_in_ip']
      });
    }
    
    if (url.startsWith('http:')) {
      significantList.push({
        name: 'tls_ssl_certificate',
        value: 0,
        impact: 'High',
        contribution: 15,
        description: featureDescriptions['tls_ssl_certificate'],
        explanation: this.featureExplanations['tls_ssl_certificate']
      });
    }
    
    // Check for common URL shorteners
    const shortenerPatterns = ['bit.ly', 'tinyurl', 't.co', 'goo.gl', 'tiny.cc', 'is.gd', 'cli.gs', 'pic.gd', 'DwarfURL', 'ow.ly'];
    if (shortenerPatterns.some(pattern => url.includes(pattern))) {
      significantList.push({
        name: 'url_shortened',
        value: 1,
        impact: 'High',
        contribution: 10,
        description: featureDescriptions['url_shortened'],
        explanation: this.featureExplanations['url_shortened']
      });
    }
    
    // Process each feature from the ML model
    for (const [name, value] of Object.entries(features)) {
      // Skip irrelevant features or ones we've already handled
      if (name === '__class__' || value === undefined) continue;
      if (name === 'domain_in_ip' && this.isIpAddress(url)) continue;
      if (name === 'tls_ssl_certificate' && url.startsWith('http:')) continue;
      if (name === 'url_shortened' && shortenerPatterns.some(pattern => url.includes(pattern))) continue;
      
      const normalizedValue = typeof value === 'boolean' ? (value ? 1 : 0) : Number(value);
      
      let impact = 'Low';
      let contribution = 1;
      
      // Determine impact and contribution based on feature name and value
      if ((name === 'domain_in_ip' && normalizedValue === 1) ||
          (name === 'tls_ssl_certificate' && normalizedValue === 0) ||
          (name === 'url_shortened' && normalizedValue === 1) ||
          (name === 'time_domain_activation' && normalizedValue < 30 && normalizedValue > 0) ||
          (name === 'domain_google_index' && normalizedValue === 0) ||
          (name === 'url_google_index' && normalizedValue === 0)) {
        impact = 'High';
        contribution = 15;
      } else if ((name === 'qty_redirects' && normalizedValue > 1) ||
                (name === 'length_url' && normalizedValue > this.featureThresholds['length_url'] || normalizedValue > 75) ||
                (name === 'qty_dot_url' && normalizedValue > this.featureThresholds['qty_dot_url'] || normalizedValue > 3) ||
                (name === 'qty_hyphen_url' && normalizedValue > this.featureThresholds['qty_hyphen_url'] || normalizedValue > 3) ||
                (name === 'qty_underline_url' && normalizedValue > this.featureThresholds['qty_underline_url'] || normalizedValue > 2) ||
                (name === 'qty_slash_url' && normalizedValue > this.featureThresholds['qty_slash_url'] || normalizedValue > 5) ||
                (name === 'qty_questionmark_url' && normalizedValue > this.featureThresholds['qty_questionmark_url'] || normalizedValue > 2) ||
                (name === 'qty_equal_url' && normalizedValue > this.featureThresholds['qty_equal_url'] || normalizedValue > 3) ||
                (name === 'qty_ip_resolved' && normalizedValue > this.featureThresholds['qty_ip_resolved'] || normalizedValue > 2)) {
        impact = 'Medium';
        contribution = 5;
      } else if ((name === 'qty_at_url' && normalizedValue > 0) || 
                (name === 'domain_spf' && normalizedValue === 0)) {
        impact = 'Medium';
        contribution = 7;
      } else {
        // Low impact factors - skip them in the significant factors list
        // to keep focus on the important ones
        continue;
      }
      
      const description = featureDescriptions[name] || `Feature: ${this.formatFeatureName(name)}`;
      const explanation = this.featureExplanations[name] || 'This feature contributes to the overall risk assessment based on patterns observed in phishing websites.';
      
      significantList.push({
        name,
        value,
        impact,
        contribution,
        description,
        explanation
      });
    }
    
    // Sort factors by impact and contribution for better display
    significantList.sort((a, b) => {
      const impactOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
      if (impactOrder[a.impact] !== impactOrder[b.impact]) {
        return impactOrder[b.impact] - impactOrder[a.impact];
      }
      return b.contribution - a.contribution;
    });
    
    return significantList;
  }
  
  /**
   * Get all features with impact and contribution info
   */
  getAllFeatures(features) {
    const featuresList = [];
    
    for (const [name, value] of Object.entries(features)) {
      // Skip irrelevant features
      if (name === '__class__' || value === undefined) continue;
      
      const normalizedValue = typeof value === 'boolean' ? (value ? 1 : 0) : Number(value);
      
      let impact = 'Low';
      let contribution = 1;
      
      // Determine impact based on feature and value - with more comprehensive rules
      if ((name === 'domain_in_ip' && normalizedValue === 1) ||
          (name === 'tls_ssl_certificate' && normalizedValue === 0) ||
          (name === 'url_shortened' && normalizedValue === 1) ||
          (name === 'time_domain_activation' && normalizedValue < 30 && normalizedValue > 0) ||
          (name === 'domain_google_index' && normalizedValue === 0) ||
          (name === 'url_google_index' && normalizedValue === 0)) {
        impact = 'High';
        contribution = 15;
      } else if ((name === 'qty_redirects' && normalizedValue > 1) ||
                (name === 'length_url' && normalizedValue > this.featureThresholds['length_url']) ||
                (name === 'qty_dot_url' && normalizedValue > this.featureThresholds['qty_dot_url']) ||
                (name === 'qty_hyphen_url' && normalizedValue > this.featureThresholds['qty_hyphen_url']) ||
                (name === 'qty_underline_url' && normalizedValue > this.featureThresholds['qty_underline_url']) ||
                (name === 'qty_slash_url' && normalizedValue > this.featureThresholds['qty_slash_url']) ||
                (name === 'qty_questionmark_url' && normalizedValue > this.featureThresholds['qty_questionmark_url']) ||
                (name === 'qty_equal_url' && normalizedValue > this.featureThresholds['qty_equal_url']) ||
                (name === 'qty_ip_resolved' && normalizedValue > this.featureThresholds['qty_ip_resolved'])) {
        impact = 'Medium';
        contribution = 5;
      } else if ((name === 'qty_at_url' && normalizedValue > 0) || 
                (name === 'domain_spf' && normalizedValue === 0)) {
        impact = 'Medium';
        contribution = 7;
      }
      
      featuresList.push({
        name,
        value,
        impact,
        contribution
      });
    }
    
    // Sort by impact and contribution
    return featuresList.sort((a, b) => {
      const impactOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
      if (impactOrder[a.impact] !== impactOrder[b.impact]) {
        return impactOrder[b.impact] - impactOrder[a.impact];
      }
      return b.contribution - a.contribution;
    });
  }
  
  /**
   * Generate table rows for all features - improved to include URL-derived features
   */
  generateFeatureTableRows(features, url) {
    let html = '';
    const allFeatures = this.getAllFeatures(features);
    
    // Add URL-specific features that might not be in the ML model
    const urlFeatures = this.extractUrlFeatures(url);
    const combinedFeatures = [...allFeatures];
    
    // Add URL features if they're not already in allFeatures
    for (const urlFeature of urlFeatures) {
      if (!allFeatures.some(f => f.name === urlFeature.name)) {
        combinedFeatures.push(urlFeature);
      }
    }
    
    // Group features by category
    const categorizedFeatures = {
      'Domain-Related': [],
      'URL Structure': [],
      'Security Features': [],
      'Reputation': [],
      'Other': []
    };
    
    // Categorize features
    combinedFeatures.forEach(feature => {
      const name = feature.name;
      
      if (['domain_in_ip', 'domain_google_index', 'domain_spf', 'time_domain_activation', 'qty_ip_resolved'].includes(name)) {
        categorizedFeatures['Domain-Related'].push(feature);
      } else if (['length_url', 'qty_dot_url', 'qty_hyphen_url', 'qty_slash_url', 
                 'qty_underline_url', 'qty_questionmark_url', 'qty_equal_url', 
                 'qty_at_url', 'qty_and_url', 'url_shortened'].includes(name)) {
        categorizedFeatures['URL Structure'].push(feature);
      } else if (['tls_ssl_certificate', 'using_http'].includes(name)) {
        categorizedFeatures['Security Features'].push(feature);
      } else if (['url_google_index'].includes(name)) {
        categorizedFeatures['Reputation'].push(feature);
      } else {
        categorizedFeatures['Other'].push(feature);
      }
    });
    
    // Sort features within categories by impact
    for (const category in categorizedFeatures) {
      categorizedFeatures[category].sort((a, b) => {
        const impactOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
        return impactOrder[b.impact] - impactOrder[a.impact];
      });
    }
    
    // Add category headers and features
    let addedHeader = false;
    for (const [category, features] of Object.entries(categorizedFeatures)) {
      if (features.length > 0) {
        // Add category header
        html += `
          <tr class="category-header">
            <td colspan="4">${category}</td>
          </tr>
        `;
        addedHeader = true;
        
        // Add features in this category
        features.forEach(feature => {
          const { name, value, impact, contribution } = feature;
          const impactClass = impact.toLowerCase();
          const explanationText = this.featureExplanations[name] || 'This feature contributes to the risk assessment.';
          
          html += `
            <tr>
              <td>
                <span class="impact-indicator impact-${impactClass}"></span>
                ${this.formatFeatureName(name)}
                <i class="fas fa-info-circle feature-info-icon" title="${explanationText}"></i>
              </td>
              <td>${this.formatFeatureValue(name, value)}</td>
              <td>${impact}</td>
              <td>+${contribution}</td>
            </tr>
          `;
        });
      }
    }
    
    if (!addedHeader) {
      html = `<tr><td colspan="4">No features analyzed</td></tr>`;
    }
    
    return html;
  }

  /**
   * Generate URL structure analysis HTML
   */
  generateUrlStructureAnalysis(url, features) {
    try {
      // Try to parse the URL
      const urlObj = new URL(url);
      const protocol = urlObj.protocol;
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname;
      const search = urlObj.search;
      const hash = urlObj.hash;
      
      let html = `
        <div class="url-structure-box">
          <div class="url-part">
            <span class="url-label">Protocol:</span>
            <span class="url-value ${protocol === 'https:' ? 'secure' : 'insecure'}">${protocol}</span>
            <span class="url-note">${protocol === 'https:' ? '(Secure)' : '(Not secure)'}</span>
          </div>
          <div class="url-part">
            <span class="url-label">Hostname:</span>
            <span class="url-value">${this.isIpAddress(url) ? `<span class="suspicious">${hostname}</span>` : hostname}</span>
            ${this.isIpAddress(url) ? '<span class="url-warning"><i class="fas fa-exclamation-triangle"></i> IP address used instead of domain name</span>' : ''}
          </div>
          <div class="url-part">
            <span class="url-label">Path:</span>
            <span class="url-value">${pathname || '/'}</span>
            ${pathname && pathname.length > 50 ? '<span class="url-warning"><i class="fas fa-exclamation-triangle"></i> Unusually long path</span>' : ''}
          </div>
          ${search ? `
            <div class="url-part">
              <span class="url-label">Query:</span>
              <span class="url-value">${search}</span>
              ${search.split('&').length > 3 ? '<span class="url-warning"><i class="fas fa-exclamation-triangle"></i> Complex query parameters</span>' : ''}
            </div>
          ` : ''}
          ${hash ? `
            <div class="url-part">
              <span class="url-label">Fragment:</span>
              <span class="url-value">${hash}</span>
            </div>
          ` : ''}
        </div>

        <div class="url-statistical-analysis">
          <h4>URL Statistics:</h4>
          <div class="url-stats-grid">
            <div class="url-stat-item">
              <span class="stat-label">Total length:</span>
              <span class="stat-value ${url.length > 75 ? 'suspicious' : ''}">${url.length} characters</span>
            </div>
            <div class="url-stat-item">
              <span class="stat-label">Dots:</span>
              <span class="stat-value ${(url.match(/\./g) || []).length > 3 ? 'suspicious' : ''}">${(url.match(/\./g) || []).length}</span>
            </div>
            <div class="url-stat-item">
              <span class="stat-label">Hyphens:</span>
              <span class="stat-value ${(url.match(/-/g) || []).length > 2 ? 'suspicious' : ''}">${(url.match(/-/g) || []).length}</span>
            </div>
            <div class="url-stat-item">
              <span class="stat-label">Slashes:</span>
              <span class="stat-value">${(url.match(/\//g) || []).length}</span>
            </div>
            <div class="url-stat-item">
              <span class="stat-label">Special characters:</span>
              <span class="stat-value">${(url.match(/[^a-zA-Z0-9\-./:]/g) || []).length}</span>
            </div>
            <div class="url-stat-item">
              <span class="stat-label">Is IP address:</span>
              <span class="stat-value ${this.isIpAddress(url) ? 'suspicious' : ''}">${this.isIpAddress(url) ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>
      `;
      
      return html;
    } catch (e) {
      return `<p>Unable to parse URL structure: ${e.message}</p>`;
    }
  }

  /**
   * Extract features directly from URL - enhanced to detect more features
   */
  extractUrlFeatures(url) {
    const features = [];
    
    // Check for HTTP (non-HTTPS)
    if (url.startsWith('http:')) {
      features.push({
        name: 'using_http',
        value: 1,
        impact: 'High',
        contribution: 15
      });
    }
    
    // Check URL length
    const urlLength = url.length;
    if (urlLength > 75) {
      features.push({
        name: 'excessive_url_length',
        value: urlLength,
        impact: urlLength > 100 ? 'High' : 'Medium',
        contribution: urlLength > 100 ? 10 : 5
      });
    }
    
    // Check for deceptive TLDs
    try {
      const hostname = this.extractHostname(url);
      const suspiciousTlds = ['.zip', '.review', '.country', '.kim', '.cricket', '.science', '.work', '.party', '.gq', '.link', '.click', '.loan'];
      
      for (const tld of suspiciousTlds) {
        if (hostname.endsWith(tld)) {
          features.push({
            name: 'suspicious_tld',
            value: tld,
            impact: 'Medium',
            contribution: 7
          });
          break;
        }
      }
    } catch (e) {
      // If URL parsing fails, continue with other checks
      console.error('Error checking TLD:', e);
    }
    
    return features;
  }

  /**
   * Format feature value for display
   */
  formatFeatureValue(name, value) {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    
    if (name === 'tls_ssl_certificate') return value === 1 ? 'Present' : 'Missing';
    if (name === 'domain_in_ip') return value === 1 ? 'Using IP address' : 'Using domain name';
    
    return value;
  }

  /**
   * Truncate URL for display
   */
  truncateUrl(url, maxLength = 40) {
    if (!url) return '';
    if (url.length <= maxLength) return url;
    
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      return domain + '...';
    } catch (e) {
      return url.substring(0, maxLength - 3) + '...';
    }
  }
  
  /**
   * Get risk title based on score and phishing status
   */
  getRiskTitle(score, isPhishing) {
    if (isPhishing || score >= 70) {
      return 'High Risk Detected';
    } else if (score >= 30) {
      return 'Medium Risk Detected';
    } else {
      return 'Low Risk Level';
    }
  }
  
  /**
   * Get risk explanation based on score
   */
  getRiskExplanation(score, isPhishing, url) {
    if (isPhishing || score >= 70) {
      return `
        <p>This URL has multiple characteristics strongly associated with phishing websites.</p>
        <p>We recommend extreme caution and suggest avoiding this website, especially for any sensitive information.</p>
        <p>The high risk score indicates that this URL matches patterns commonly seen in confirmed phishing attacks.</p>
      `;
    } else if (score >= 30) {
      return `
        <p>This URL has some characteristics that warrant caution.</p>
        <p>While not definitively malicious, consider verifying this website through other means before sharing any sensitive information.</p>
        <p>The moderate risk score suggests some suspicious patterns, though they might have legitimate explanations.</p>
      `;
    } else {
      return `
        <p>This URL shows few or no characteristics commonly associated with phishing or malicious websites.</p>
        <p>While this URL appears safe according to our analysis, always remain vigilant when sharing sensitive information online.</p>
        <p>The low risk score suggests this is likely a legitimate website based on our security indicators.</p>
      `;
    }
  }
  
  /**
   * Get security advice based on risk score
   */
  getSecurityAdvice(score, isPhishing, url, factors) {
    if (isPhishing || score >= 70) {
      let specificAdvice = '';
      
      // Add specific advice based on detected factors
      if (factors.some(f => f.name === 'domain_in_ip')) {
        specificAdvice += ' The use of an IP address instead of a domain name is particularly concerning.';
      }
      
      if (factors.some(f => f.name === 'tls_ssl_certificate' && f.value === 0)) {
        specificAdvice += ' The lack of a secure connection (HTTPS) means your data would not be encrypted if sent to this site.';
      }
      
      return `This website shows multiple high-risk characteristics associated with phishing attacks. We strongly recommend avoiding this site and not entering any personal information.${specificAdvice}`;
    } else if (score >= 30) {
      let cautionAdvice = '';
      
      // Provide more specific advice for medium risk
      const suspiciousFactors = factors.filter(f => f.impact === 'Medium').slice(0, 2);
      if (suspiciousFactors.length > 0) {
        cautionAdvice = ' Pay particular attention to ' + 
          suspiciousFactors.map(f => this.formatFeatureName(f.name).toLowerCase()).join(' and ') + 
          ' when evaluating this site.';
      }
      
      return `This website shows some suspicious characteristics. Exercise caution if you choose to visit, and avoid entering sensitive information until you can verify its legitimacy through other means.${cautionAdvice}`;
    } else {
      return `This website appears to be safe based on our analysis, but always maintain good security practices when sharing information online.`;
    }
  }
  
  /**
   * Generate tailored advice based on detected features
   */
  generateTailoredAdvice(features, url, factors) {
    if (factors.length === 0) {
      return '';
    }
    
    let html = `
      <div class="tailored-advice">
        <h4>Specific Advice for This URL</h4>
        <ul>
    `;
    
    // Add advice based on detected features
    if (factors.some(f => f.name === 'domain_in_ip')) {
      html += `<li>Never trust websites using IP addresses instead of domain names for important services</li>`;
    }
    
    if (factors.some(f => f.name === 'tls_ssl_certificate' && f.value === 0) || url.startsWith('http:')) {
      html += `<li>This site lacks HTTPS encryption. Always look for the padlock icon in your browser</li>`;
    }
    
    if (factors.some(f => f.name === 'url_shortened')) {
      html += `<li>Be wary of shortened URLs - use a URL expander service to check the real destination</li>`;
    }
    
    if (factors.some(f => f.name === 'time_domain_activation' && f.value < 30)) {
      html += `<li>This is a very new domain - legitimate organizations typically use established domains</li>`;
    }
    
    if (factors.some(f => f.name === 'qty_redirects' && f.value > 1)) {
      html += `<li>Multiple redirects detected - be careful as they can mask the true destination</li>`;
    }
    
    html += `
        </ul>
      </div>
    `;
    
    return html;
  }
  
  /**
   * Generate calculation steps HTML
   */
  generateCalculationSteps(significantFactors, finalScore) {
    let html = '';
    let baseScore = 0; // Starting score
    let runningTotal = baseScore;
    
    html += `<div class="calculation-step">
              <div class="step-number">1.</div>
              <div class="step-content">Base Score: <span class="step-highlight">${baseScore}</span></div>
            </div>`;
    
    // Add steps for each significant factor
    significantFactors.forEach((factor, index) => {
      const { name, contribution } = factor;
      runningTotal += contribution;
      
      html += `<div class="calculation-step">
                <div class="step-number">${index + 2}.</div>
                <div class="step-content">Add ${this.formatFeatureName(name)}: <span class="step-highlight">+${contribution}</span> points (subtotal: ${runningTotal})</div>
              </div>`;
    });
    
    // Add minor factors as a group
    const minorFactorsTotal = finalScore - runningTotal;
    if (Math.abs(minorFactorsTotal) > 0.1) {
      html += `<div class="calculation-step">
                <div class="step-number">${significantFactors.length + 2}.</div>
                <div class="step-content">Combined minor factors: <span class="step-highlight">+${minorFactorsTotal.toFixed(1)}</span> points</div>
              </div>`;
    }
    
    // Add final score
    html += `<div class="calculation-step">
              <div class="step-number">${significantFactors.length + 3}.</div>
              <div class="step-content">Final risk score: <span class="step-highlight">${Math.round(finalScore)}/100</span></div>
            </div>`;
    
    return html;
  }
}
