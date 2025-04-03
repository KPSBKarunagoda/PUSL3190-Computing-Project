class EducationService {
  constructor() {
    // Education templates for different feature types
    this.templates = {
      domain_age: {
        high_risk: "This website is very new (created within the last {value} days). Phishers often use newly registered domains for attacks.",
        explanation: "Legitimate websites typically have been around for some time. Very new domains (less than 30 days old) can be a red flag."
      },
      suspicious_url: {
        high_risk: "The URL contains suspicious elements like '{value}' that are commonly used in phishing attempts.",
        explanation: "Phishers often use techniques like misspellings, special characters, or deceptive subdomain structures."
      },
      ssl_cert: {
        high_risk: "This site has SSL certificate issues. {value}",
        explanation: "Legitimate sites typically have properly configured SSL certificates from trusted authorities."
      },
      redirect_count: {
        high_risk: "The URL involves an unusual number of redirects ({value}), which may be hiding the true destination.",
        explanation: "Multiple redirects can be used to mask malicious destinations or fool security scanners."
      },
      url_length: {
        high_risk: "This URL is unusually long ({value} characters), which is a common phishing tactic.",
        explanation: "Excessively long URLs can hide the true destination or contain encoded malicious payloads."
      },
      special_chars: {
        high_risk: "This URL contains an unusual number of special characters ({value}).",
        explanation: "Special characters in URLs are often used to obfuscate malicious URLs or create misleading links."
      },
      suspicious_tld: {
        high_risk: "This site uses a top-level domain ({value}) that is commonly associated with phishing.",
        explanation: "Some top-level domains have higher rates of abuse for phishing purposes."
      },
      ip_address: {
        high_risk: "This URL uses an IP address ({value}) instead of a domain name, which is a common phishing tactic.",
        explanation: "Legitimate websites almost always use domain names instead of raw IP addresses."
      },
      no_https: {
        high_risk: "This website does not use HTTPS secure connection.",
        explanation: "Most legitimate websites use HTTPS to encrypt data and verify their identity."
      },
      domain_mismatch: {
        high_risk: "The domain name appears to be impersonating a known brand or service.",
        explanation: "Phishers often create domains that look similar to trusted websites to trick users."
      },
      unusual_port: {
        high_risk: "This URL uses an unusual port number ({value}), which is suspicious.",
        explanation: "Most legitimate websites use standard ports (80 for HTTP, 443 for HTTPS)."
      },
      subdomain_abuse: {
        high_risk: "This URL uses a suspicious subdomain structure to appear legitimate.",
        explanation: "Phishers often use subdomains to make their URLs look like they belong to trusted sites."
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
      length_url: {
        high_risk: "This URL is unusually long ({value} characters), which is often a sign of manipulation.",
        explanation: "Excessively long URLs may contain encoded commands or be designed to hide their true nature. Legitimate URLs are typically concise and readable.",
        educational_tip: "Scrutinize very long URLs, especially those containing random-looking character strings."
      }
    };

    // Create a mapping from ML feature names to our template keys
    this.mlFeatureMap = {
      'tls_ssl_certificate': 'tls_ssl_certificate',
      'domain_in_ip': 'domain_in_ip',
      'url_shortened': 'url_shortened',
      'qty_redirects': 'qty_redirects',
      'length_url': 'url_length',
    };

    // General educational tips
    this.generalTips = [
      "Always verify the URL before entering sensitive information.",
      "Look for HTTPS and a valid certificate in your browser's address bar.",
      "Be cautious of websites asking for unusual information.",
      "Legitimate organizations rarely send emails asking you to 'verify your account' through a link.",
      "When in doubt, manually type the website address or use a bookmark instead of clicking links."
    ];
  }
  
  /**
   * Generate educational content based on analysis results
   * @param {Object} analysisResult - The URL analysis result object
   * @param {string} contentType - Type of content to generate (explain, tips, learn)
   * @returns {Object} Educational content object
   */
  generateContent(analysisResult, contentType = 'explain') {
    if (!analysisResult || !analysisResult.features) {
      return { 
        success: false, 
        content: "No analysis data available for educational content." 
      };
    }
    
    switch (contentType) {
      case 'explain':
        return this.generateExplanation(analysisResult);
      case 'tips':
        return this.generateSafetyTips(analysisResult);
      case 'learn':
        return this.generateLearningContent(analysisResult);
      default:
        return this.generateExplanation(analysisResult);
    }
  }
  
  /**
   * Generate explanation of why the site was flagged
   */
  generateExplanation(analysisResult) {
    const { features, risk_score, is_phishing, url } = analysisResult;
    let content = '';
    
    // Introduction based on risk level
    if (is_phishing) {
      content += `## This Website Has Been Flagged as Potentially Dangerous\n\n`;
      content += `Our system detected multiple phishing indicators for this URL: ${url}\n\n`;
    } else if (risk_score > 50) {
      content += `## This Website Has Some Suspicious Characteristics\n\n`;
      content += `While not definitively malicious, this site has some concerning features: ${url}\n\n`;
    } else {
      content += `## Analysis Results\n\n`;
      content += `Here's what our system found when analyzing: ${url}\n\n`;
    }
    
    // Process ML features if available
    const mlEducation = this.generateMlFeatureEducation(features, url);
    
    // Add main points from ML features
    content += `### Key Factors in This Analysis:\n\n`;
    
    if (mlEducation.mainPoints.length > 0) {
      content += mlEducation.mainPoints.map(point => `- ${point}`).join('\n');
      content += '\n\n';
    } else {
      const significantFeatures = this.getSignificantFeatures(features, url);
      
      if (significantFeatures.length === 0) {
        if (url) {
          if (this.isIpAddress(url)) {
            content += "- **IP Address Used**: This website uses an IP address instead of a domain name, which is commonly associated with phishing sites.\n";
          }
          if (url.startsWith('http://')) {
            content += "- **No Secure Connection**: This website doesn't use HTTPS encryption, which is standard for legitimate websites.\n";
          }
          content += "- **Multiple Minor Factors**: A combination of several minor risk indicators contributed to the overall risk assessment.\n";
        } else {
          content += "No specific high-risk features were identified, but the combination of multiple minor factors contributed to the overall risk assessment.\n\n";
        }
      } else {
        significantFeatures.forEach(feature => {
          content += `- **${this.formatFeatureName(feature.name)}**: ${this.explainFeature(feature.name, feature.value)}\n`;
        });
        content += "\n";
      }
    }
    
    // Add detailed explanations if available
    if (mlEducation.detailedExplanations.length > 0) {
      content += `### Understanding These Risks:\n\n`;
      content += mlEducation.detailedExplanations.map(exp => `- ${exp}`).join('\n\n');
      content += '\n\n';
    }
    
    // Add ML-specific safety tips if available
    if (mlEducation.safetyTips.length > 0) {
      content += `### Staying Safe Online:\n\n`;
      content += mlEducation.safetyTips.map(tip => `- ${tip}`).join('\n\n');
      content += '\n\n';
    } else {
      content += `### Staying Safe Online:\n\n`;
      content += this.generalTips.slice(0, 3).map(tip => `- ${tip}`).join('\n');
      content += "\n\n";
    }
    
    return { success: true, content };
  }
  
  /**
   * Generate educational content specifically based on ML features
   */
  generateMlFeatureEducation(mlFeatures, url) {
    if (!mlFeatures || Object.keys(mlFeatures).length === 0) {
      return {
        mainPoints: [],
        detailedExplanations: [],
        safetyTips: []
      };
    }
    
    const mainPoints = [];
    const detailedExplanations = [];
    const safetyTips = [];
    
    // Special check for IP-based URL regardless of ML features
    if (this.isIpAddress(url)) {
      console.log(`Direct IP address detected in URL: ${url}`);
      const ipValue = this.extractHostname(url);
      const template = this.templates.domain_in_ip;
      
      mainPoints.push(`**IP Address in URL**: This website uses a raw IP address (${ipValue}) instead of a domain name, which is a major phishing indicator.`);
      detailedExplanations.push(template.explanation);
      safetyTips.push(template.educational_tip);
      
      // Also set the domain_in_ip feature if not already set
      if (mlFeatures.domain_in_ip !== 1) {
        console.log(`Setting domain_in_ip=1 for IP-based URL: ${url}`);
        mlFeatures.domain_in_ip = 1;
      }
    }
    
    // Process each ML feature and generate educational content
    console.log('Processing ML features:', JSON.stringify(mlFeatures, null, 2));
    
    Object.entries(mlFeatures).forEach(([key, value]) => {
      // Skip non-relevant features
      if (key === '__class__' || value === undefined) return;
      
      console.log(`Processing feature ${key} with value ${value}`);
      
      // Check if we have a template for this feature
      const templateKey = this.mlFeatureMap[key] || key;
      const template = this.templates[templateKey];
      
      if (template) {
        // Generate content based on the feature value
        if ((typeof value === 'number' && value === 0) || value === false) {
          // For features where 0 or false means high risk (like SSL certificate)
          if (key === 'tls_ssl_certificate') {
            mainPoints.push(`**No Secure Connection**: ${template.high_risk.replace('{value}', value)}`);
            detailedExplanations.push(template.explanation);
            if (template.educational_tip) safetyTips.push(template.educational_tip);
          }
        } else if ((typeof value === 'number' && value > 0) || value === true || value === 1.0) {
          // For features where presence/high value indicates risk
          if (key === 'domain_in_ip' && (value === 1.0 || value === 1 || value === true)) {
            const ipValue = this.extractHostname(url);
            mainPoints.push(`**IP-Based URL**: ${template.high_risk.replace('{value}', ipValue)}`);
            detailedExplanations.push(template.explanation);
            if (template.educational_tip) safetyTips.push(template.educational_tip);
            console.log(`Added domain_in_ip explanation for ${url}`);
          } 
          else if (key === 'url_shortened' && value === 1.0) {
            mainPoints.push(`**Shortened URL**: ${template.high_risk}`);
            detailedExplanations.push(template.explanation);
            if (template.educational_tip) safetyTips.push(template.educational_tip);
          }
          else if (key === 'qty_redirects' && value > 1) {
            mainPoints.push(`**Multiple Redirects**: ${template.high_risk.replace('{value}', value)}`);
            detailedExplanations.push(template.explanation);
            if (template.educational_tip) safetyTips.push(template.educational_tip);
          }
          else if (key === 'length_url' && value > 50) {
            mainPoints.push(`**Long URL**: ${template.high_risk.replace('{value}', value)}`);
            detailedExplanations.push(template.explanation);
            if (template.educational_tip) safetyTips.push(template.educational_tip);
          }
        }
      }
      
      // Handle special cases for qty_ features
      if (key.includes('qty_') && key !== 'qty_redirects' && value > 3) {
        const specialChar = key.replace('qty_', '').replace('_url', '').replace('_domain', '');
        mainPoints.push(`**Suspicious URL Pattern**: Contains many ${specialChar} characters (${value})`);
        detailedExplanations.push(`URLs containing many special characters are often used in phishing attacks to obfuscate malicious code.`);
        safetyTips.push(`Be wary of URLs with unusual character patterns or excessive special characters.`);
      }
    });
    
    // If no specific explanations were generated but we know it's phishing,
    // give a more helpful message than "multiple minor factors"
    if (mainPoints.length === 0 && this.isIpAddress(url)) {
      mainPoints.push(`**IP Address Used**: The URL ${url} uses an IP address instead of a domain name, which is a strong indicator of a phishing attempt.`);
      detailedExplanations.push("Legitimate websites use domain names, not IP addresses. This practice makes websites easier to remember and provides a layer of abstraction from the server's actual address.");
      safetyTips.push("Never trust websites that use IP addresses in the URL. Always look for a proper domain name.");
    }
    
    return {
      mainPoints,
      detailedExplanations,
      safetyTips
    };
  }

  /**
   * Generate safety tips based on analysis results
   */
  generateSafetyTips(analysisResult) {
    const { features, risk_score } = analysisResult;
    const mlEducation = this.generateMlFeatureEducation(features);
    
    let content = '## How to Protect Yourself\n\n';
    
    if (mlEducation.safetyTips.length > 0) {
      content += mlEducation.safetyTips.map(tip => `- ${tip}`).join('\n');
    } else {
      content += this.generalTips.map(tip => `- ${tip}`).join('\n');
    }
    
    // Add more targeted advice based on risk level
    if (risk_score > 80) {
      content += '\n\n### For High-Risk Sites:\n';
      content += '- Never enter personal or financial information on this site\n';
      content += '- Consider reporting this site to [Google Safe Browsing](https://safebrowsing.google.com/safebrowsing/report_phish/)\n';
      content += '- If you\'ve already entered information, consider changing passwords and monitoring accounts\n';
    }
    
    return { success: true, content };
  }
  
  /**
   * Generate deeper learning content about phishing
   */
  generateLearningContent(analysisResult) {
    // This would include more detailed educational material
    let content = '## Understanding Phishing Attacks\n\n';
    
    content += 'Phishing is a cybercrime where attackers pretend to be trusted entities to steal sensitive information. ';
    content += 'These attacks can be sophisticated and are constantly evolving.\n\n';
    
    content += '### Common Types of Phishing:\n\n';
    content += '- **Email Phishing**: Fraudulent emails claiming to be from legitimate companies\n';
    content += '- **Spear Phishing**: Targeted attacks on specific individuals or organizations\n';
    content += '- **Clone Phishing**: Duplicating legitimate communications but inserting malicious content\n';
    content += '- **Whaling**: Targeting high-profile executives or other high-value targets\n';
    content += '- **Smishing**: Phishing conducted via SMS text messages\n';
    content += '- **Vishing**: Voice phishing, typically conducted over phone calls\n\n';
    
    content += '### How to Stay Safe:\n\n';
    content += '1. **Verify the sender\'s identity** before clicking links or opening attachments\n';
    content += '2. **Check the URL** carefully before entering any information\n';
    content += '3. **Use multi-factor authentication** whenever possible\n';
    content += '4. **Keep software updated** with the latest security patches\n';
    content += '5. **Use security software** that includes phishing protection\n';
    content += '6. **Report suspected phishing** attempts to the organization being impersonated\n\n';
    
    content += 'Learn more about phishing protection from these trusted resources:\n\n';
    content += '- [FTC Consumer Information on Phishing](https://consumer.ftc.gov/articles/how-recognize-and-avoid-phishing-scams)\n';
    content += '- [CISA Phishing Guidance](https://www.cisa.gov/topics/cybersecurity-best-practices/phishing)\n';
    content += '- [Anti-Phishing Working Group](https://apwg.org/)\n';
    
    return { success: true, content };
  }

  /**
   * Generate HTML list of feature explanations - enhanced to use ML features
   */
  generateFeatureExplanationsHtml(features, url) {
    // Process specific ML features first if available
    const mlFeatures = features.domain_in_ip !== undefined ? features : null;
    
    if (mlFeatures) {
      // Process specific ML features
      const htmlItems = [];
      
      // Check for SSL certificate
      if (mlFeatures.tls_ssl_certificate === 0) {
        htmlItems.push('<li><strong>Missing SSL Certificate</strong>: This site does not use HTTPS encryption, putting your data at risk</li>');
      }
      
      // Check for IP-based URL
      if (mlFeatures.domain_in_ip === 1) {
        htmlItems.push('<li><strong>IP Address URL</strong>: This site uses a numeric IP address instead of a domain name, which is a common phishing tactic</li>');
      }
      
      // Check for URL shortening
      if (mlFeatures.url_shortened === 1) {
        htmlItems.push('<li><strong>Shortened URL</strong>: This URL has been shortened, hiding its true destination</li>');
      }
      
      // Check redirects
      if (mlFeatures.qty_redirects > 1) {
        htmlItems.push(`<li><strong>Multiple Redirects</strong>: This URL uses ${mlFeatures.qty_redirects} redirects, which can mask its true destination</li>`);
      }
      
      // Check URL length
      if (mlFeatures.length_url > 50) {
        htmlItems.push(`<li><strong>Excessive URL Length</strong>: This URL is unusually long (${mlFeatures.length_url} characters), often used to hide malicious code</li>`);
      }
      
      // Check for excessive special characters
      const specialCharCount = [
        'qty_dot_url', 'qty_hyphen_url', 'qty_underline_url', 'qty_slash_url',
        'qty_questionmark_url', 'qty_equal_url', 'qty_at_url', 'qty_and_url'
      ].reduce((sum, key) => sum + (mlFeatures[key] || 0), 0);
      
      if (specialCharCount > 5) {
        htmlItems.push(`<li><strong>Excessive Special Characters</strong>: This URL contains ${specialCharCount} special characters, which can be used to obfuscate malicious URLs</li>`);
      }
      
      // Return generated HTML if we found specific features
      if (htmlItems.length > 0) {
        return htmlItems.join('');
      }
    }
    
    // General fallback content if no specific features were found
    return '<li><strong>Multiple Minor Factors</strong>: A combination of several minor risk indicators contributed to this assessment</li>';
  }
  
  // Helper methods
  getSignificantFeatures(features, url) {
    // Implementation for extracting significant features
    return [];
  }
  
  formatFeatureName(name) {
    return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  
  explainFeature(name, value) {
    return `Value: ${value}`;
  }
  
  isIpAddress(url) {
    try {
      const hostname = this.extractHostname(url);
      // More robust IP pattern matching - handles IPv4 addresses
      const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
      
      if (ipPattern.test(hostname)) {
        console.log(`IP address detected: ${hostname}`);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error checking for IP address:', e);
      return false;
    }
  }
  
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
}

module.exports = EducationService;
