class EducationService {
  constructor() {
    // Keep only templates that are needed for key findings
    this.templates = {
      domain_age: {
        high_risk: "This website was created very recently ({value} days ago). Phishers often use newly registered domains that exist for short periods.",
        explanation: "Legitimate websites typically have a longer history. Very new domains (less than 30 days old) can be a red flag because phishers often discard domains quickly after using them for attacks.",
        educational_tip: "Be especially cautious with newly created websites, particularly when they request sensitive information."
      },
      tls_ssl_certificate: {
        high_risk: "This site has no SSL certificate. Secure sites use HTTPS to encrypt your data.",
        explanation: "When a website lacks an SSL certificate (shown as HTTP instead of HTTPS), any data you send (passwords, credit card numbers) can be intercepted. Legitimate sites almost always use HTTPS encryption to protect your information.",
        educational_tip: "Always look for 'https://' and a padlock icon in your browser's address bar before entering sensitive information."
      },
      domain_in_ip: {
        high_risk: "This website uses an IP address ({value}) instead of a proper domain name.",
        explanation: "Legitimate websites almost always use recognizable domain names (like example.com) instead of numeric IP addresses. IP-based URLs are commonly used in phishing attacks because they're harder to identify and remember.",
        educational_tip: "Be extremely cautious of URLs that contain only numbers and dots instead of readable domain names. IP addresses in URLs are one of the strongest indicators of phishing attempts."
      },
      url_shortened: {
        high_risk: "This URL has been shortened, hiding its true destination.",
        explanation: "URL shortening services (like bit.ly or tinyurl) can hide malicious destinations. Phishers often use these to disguise unsafe links.",
        educational_tip: "Use URL expander services to check the real destination before clicking shortened links."
      },
      qty_redirects: {
        high_risk: "This URL involves {value} redirects, potentially hiding its true destination.",
        explanation: "Multiple redirects can be used to mask the final destination of a URL. Legitimate websites typically use minimal redirects.",
        educational_tip: "Be wary of links that bounce through multiple websites before reaching their destination."
      },
      url_length: {
        high_risk: "This URL is unusually long ({value} characters), which is a common phishing tactic.",
        explanation: "Excessively long URLs can hide the true destination or contain encoded malicious payloads.",
        educational_tip: "Scrutinize very long URLs, especially those containing random-looking character strings."
      },
      mx_records: {
        high_risk: "This domain lacks MX records for email functionality. Legitimate businesses typically have email infrastructure.",
        explanation: "Mail Exchange (MX) records direct email to a domain's mail servers. Legitimate business domains almost always have MX records set up.",
        educational_tip: "Consider whether a legitimate business would operate without email capability on their domain."
      },
      nameservers: {
        high_risk: "This domain has insufficient nameserver configuration ({value}), which is unusual for legitimate websites.",
        explanation: "DNS nameservers translate domain names to IP addresses. Legitimate websites typically have multiple nameservers for reliability.",
        educational_tip: "Incomplete DNS setup can indicate a hastily created phishing site."
      },
      dns_resolution: {
        high_risk: "This domain doesn't properly resolve to IP addresses, indicating potential technical issues or a very new site.",
        explanation: "When a domain cannot be resolved to an IP address, it suggests the domain may be newly registered, misconfigured, or abandoned.",
        educational_tip: "Domains with DNS resolution problems may be part of temporary phishing infrastructure."
      }
    };

    // Create a mapping from ML feature names to our template keys
    this.mlFeatureMap = {
      'tls_ssl_certificate': 'tls_ssl_certificate',
      'domain_in_ip': 'domain_in_ip',
      'url_shortened': 'url_shortened',
      'qty_redirects': 'qty_redirects',
      'length_url': 'url_length',
      'time_domain_activation': 'domain_age',
      'qty_nameservers': 'nameservers',
      'qty_mx_servers': 'mx_records',
      'qty_ip_resolved': 'dns_resolution'
    };
  }
  
  /**
   * Generate key findings based on analysis result
   * @param {Object} analysisResult - The analysis result containing features
   * @param {string} url - The URL that was analyzed
   * @returns {Array} Array of findings objects with text, description, and severity
   */
  generateKeyFindings(analysisResult, url) {
    const findings = [];
    const features = analysisResult.features || 
                     analysisResult.ml_result?.features || 
                     {};
    
    // Basic URL checks
    if (/\d+\.\d+\.\d+\.\d+/.test(url)) {
      findings.push({
        text: 'IP address used instead of domain name',
        description: 'This is the HIGHEST risk indicator in our analysis. Legitimate sites use domain names, not raw IP addresses.',
        severity: 'high'
      });
    }
    
    if (url.startsWith('http:')) {
      findings.push({
        text: 'No HTTPS',
        description: 'This site uses insecure HTTP instead of HTTPS. Any information you send could be intercepted. Modern legitimate websites use HTTPS encryption.',
        severity: 'high'
      });
    }
    
    // Check URL length
    if (url.length > 75) {
      findings.push({
        text: 'Unusually long URL',
        description: 'This URL is longer than typical legitimate URLs, which can be a sign of obfuscation.',
        severity: 'medium'
      });
    }
  
    // Process features if available
    if (features && Object.keys(features).length > 0) {
      // Check for TLS/SSL certificate feature explicitly
      if ('tls_ssl_certificate' in features && features.tls_ssl_certificate === 0) {
        findings.push({
          text: 'SSL/TLS certificate validation failed',
          description: 'This site either has no SSL/TLS certificate or has an invalid certificate. Secure sites use valid certificates to encrypt your data and verify their identity.',
          severity: 'high'
        });
      }

      // Domain Google indexing
      if ('domain_google_index' in features) {
        const domainIndexValue = Number(features.domain_google_index);
        
        if (domainIndexValue === 1) {
          findings.push({
            text: 'Domain properly indexed by Google',
            description: 'This domain is properly indexed by Google search, which is typical for established legitimate websites.',
            severity: 'low'
          });
        } else if (domainIndexValue === 0) {
          findings.push({
            text: 'Domain not indexed by Google',
            description: 'Legitimate websites are typically indexed by search engines. New or malicious sites often aren\'t indexed.',
            severity: 'medium'
          });
        }
      }
      
      // URL Google indexing
      if ('url_google_index' in features) {
        const urlIndexValue = Number(features.url_google_index);
        
        if (urlIndexValue === 1) {
          findings.push({
            text: 'Page properly indexed by Google',
            description: 'This specific URL is indexed by search engines, suggesting it\'s an established legitimate page.',
            severity: 'low'
          });
        } else if (urlIndexValue === 0) {
          findings.push({
            text: 'Page not indexed by Google',
            description: 'This specific page isn\'t in Google\'s index, which could indicate it\'s new or intentionally hidden.',
            severity: 'medium'
          });
        }
      }
      
      // SPF Email Security
      if ('domain_spf' in features) {
        const hasSPF = Number(features.domain_spf) === 1;
        
        if (!hasSPF) {
          findings.push({
            text: 'Missing SPF email security records',
            description: 'This domain lacks SPF records that help prevent email spoofing, suggesting less security consciousness.',
            severity: 'medium'
          });
        } else {
          findings.push({
            text: 'Proper SPF email security configured',
            description: 'This domain has SPF records for email authentication, which helps prevent spoofing.',
            severity: 'low'
          });
        }
      }
      
      // Domain age analysis
      if ('time_domain_activation' in features && features.time_domain_activation > 0) {
        const domainAge = Number(features.time_domain_activation);
        
        if (domainAge < 30) {
          findings.push({
            text: 'Very new domain',
            description: `This domain was registered only ${domainAge} days ago. Phishing sites often use newly created domains.`,
            severity: 'medium'
          });
        } else if (domainAge < 90) {
          findings.push({
            text: 'Recently created domain',
            description: `This domain was registered ${domainAge} days ago. While not necessarily suspicious, newer domains deserve more scrutiny.`,
            severity: 'low'
          });
        } else if (domainAge > 365) {
          findings.push({
            text: 'Well-established domain',
            description: `This domain has been registered for over a year (${Math.floor(domainAge/365)} year(s)), which is typical for legitimate websites.`,
            severity: 'low'
          });
        }
      }
      
      // URL shortening check
      if ('url_shortened' in features && features.url_shortened === 1) {
        findings.push({
          text: 'URL shortening detected',
          description: 'This URL has been shortened, making it impossible to see the actual destination before clicking.',
          severity: 'high'
        });
      }
      
      // Excessive redirects
      if ('qty_redirects' in features && features.qty_redirects > 1) {
        findings.push({
          text: 'Multiple redirects detected',
          description: `This URL involves ${features.qty_redirects} redirects. Multiple redirects can mask the true destination.`,
          severity: 'medium'
        });
      }
      
      // DNS configuration
      if ('qty_nameservers' in features) {
        const nameserverCount = Number(features.qty_nameservers);
        
        if (nameserverCount === 0) {
          findings.push({
            text: 'Missing DNS nameservers',
            description: 'This domain doesn\'t have properly configured nameservers, which is unusual for legitimate websites.',
            severity: 'medium'
          });
        } else if (nameserverCount > 0 && nameserverCount < 2) {
          findings.push({
            text: 'Minimal DNS configuration',
            description: 'This domain has only one nameserver. Legitimate domains typically use multiple nameservers for reliability.',
            severity: 'low'
          });
        }
      }
      
      // MX record check for email capability
      if ('qty_mx_servers' in features) {
        const mxCount = Number(features.qty_mx_servers);
        
        if (mxCount === 0) {
          findings.push({
            text: 'No email capability',
            description: 'This domain lacks MX records needed for email. Legitimate businesses typically have email infrastructure.',
            severity: 'low'
          });
        }
      }
      
      // IP resolution check
      if ('qty_ip_resolved' in features) {
        const ipCount = Number(features.qty_ip_resolved);
        
        if (ipCount === 0) {
          findings.push({
            text: 'DNS resolution failure',
            description: 'This domain doesn\'t properly resolve to IP addresses, which is unusual for legitimate websites.',
            severity: 'medium'
          });
        }
      }
    }
    
    // Fallback for URL patterns if no specific findings
    if (findings.length === 0 && (url.includes('startup') || url.includes('new') || url.includes('2023'))) {
      findings.push({
        text: 'Potentially new domain',
        description: 'This appears to be a new domain. New domains have a higher risk of being used for phishing.',
        severity: 'medium'
      });
    }
    
    return findings;
  }

  /**
   * Format key findings for extension display
   * @param {Array} findings - Array of finding objects
   * @returns {string} HTML string for the extension popup
   */
  formatFindingsForExtension(findings) {
    if (!findings || findings.length === 0) {
      return `
        <div class="ext-finding low-risk">
          <div class="ext-finding-header">
            <i class="fa fa-check-circle"></i>
            <span>No significant risks detected</span>
          </div>
          <p>Good news! We didn't find any major security concerns with this URL.</p>
        </div>
      `;
    }
    
    // Sort by severity: high, medium, low
    const severityOrder = { high: 1, medium: 2, low: 3 };
    const sortedFindings = [...findings].sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );
    
    // Only take the top 3 findings for the extension (to save space)
    const topFindings = sortedFindings.slice(0, 3);
    
    return topFindings.map(finding => {
      const iconClass = 
        finding.severity === 'high' ? 'fa fa-exclamation-triangle' : 
        finding.severity === 'medium' ? 'fa fa-exclamation-circle' : 
        'fa fa-info-circle';
      
      return `
        <div class="ext-finding ${finding.severity}-risk">
          <div class="ext-finding-header">
            <i class="${iconClass}"></i>
            <span>${finding.text}</span>
          </div>
          <p>${finding.description}</p>
        </div>
      `;
    }).join('');
  }
  
  /**
   * Generate educational content with key findings for database storage
   * @param {Object} analysisResult - The analysis result
   * @param {string} url - The URL analyzed
   * @returns {Object} Educational content with title, content and key findings
   */
  generateEducationalContent(analysisResult, url) {
    try {
      // Generate HTML title for the content
      const domain = new URL(url).hostname;
      const title = `Phishing Analysis: ${domain}`;
      
      // Generate key findings
      const findings = this.generateKeyFindings(analysisResult, url);
      
      // Format current date
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Build HTML content with findings
      let content = `<h2>Phishing Analysis for ${domain}</h2>`;
      content += `<p><strong>Detection Date:</strong> ${currentDate}</p>`;
      content += `<p><strong>Risk Score:</strong> ${Math.round(analysisResult.risk_score)}%</p>`;
      
      content += `<h3>Detected Security Concerns</h3>`;
      
      if (findings && findings.length > 0) {
        // Create HTML list of findings
        content += '<ul class="findings-list">';
        findings.forEach(finding => {
          const severityClass = finding.severity === 'high' ? 'high-risk' : 
                               finding.severity === 'medium' ? 'medium-risk' : 'low-risk';
          content += `<li class="${severityClass}"><strong>${finding.text}</strong>: ${finding.description}</li>`;
        });
        content += '</ul>';
      } else {
        content += `<p>No specific suspicious features were identified, but the overall pattern matched known phishing techniques.</p>`;
      }
      
      // Add educational information
      content += `<h3>How to Protect Yourself</h3>`;
      content += `<ul>
        <li>Always verify the domain name before entering sensitive information</li>
        <li>Look for HTTPS and a padlock icon in your browser's address bar</li>
        <li>Be cautious of unexpected requests for personal information</li>
        <li>Use unique passwords for different websites and consider a password manager</li>
        <li>Enable two-factor authentication when available</li>
      </ul>`;
      
      return {
        title: title,
        content: content,
        findings: findings // Include raw findings for JSON storage
      };
    } catch (error) {
      console.error('Error generating educational content:', error);
      return {
        title: `Phishing Analysis for ${url}`,
        content: `<p>This URL was identified as potentially malicious.</p>`,
        findings: [] 
      };
    }
  }
}

module.exports = EducationService;
