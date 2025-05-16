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
        severity: 'high',
        category: 'domain'
      });
    }
    
    if (url.startsWith('http:')) {
      findings.push({
        text: 'No HTTPS',
        description: 'This site uses insecure HTTP instead of HTTPS. Any information you send could be intercepted. Modern legitimate websites use HTTPS encryption.',
        severity: 'high',
        category: 'certificate'
      });
    }
    
    // Check URL length - URLs over 75 characters are suspicious
    if (url.length > 75) {
      findings.push({
        text: 'Unusually long URL',
        description: 'This URL is longer than typical legitimate URLs, which can be a sign of obfuscation.',
        severity: 'medium',
        category: 'url'
      });
    }
  
    // *** NEW: Add Safe Browsing checks BEFORE other feature checks ***
    // This ensures these critical findings are always included
    this._addSafeBrowsingChecks(findings, analysisResult);
    
    // Process features if available
    if (features && Object.keys(features).length > 0) {
      // ===== DOMAIN CHECKS =====
      this._addDomainChecks(url, findings, features);
      
      // ===== CERTIFICATE CHECKS =====
      this._addCertificateChecks(findings, features);
      
      // ===== URL STRUCTURE CHECKS =====
      this._addUrlStructureChecks(url, findings, features);
      
      // ===== CONTENT CHECKS =====
      this._addContentChecks(findings, features);
      
      // ===== INFRASTRUCTURE CHECKS =====
      this._addInfrastructureChecks(findings, features);
    }
    
    // Deduplicate findings to avoid repetition
    const sortedFindings = this._deduplicateFindings(findings);
    
    // Sort findings by severity (high -> medium -> low)
    sortedFindings.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      const aSeverity = a.severity || 'medium';
      const bSeverity = b.severity || 'medium';
      
      return severityOrder[aSeverity] - severityOrder[bSeverity];
    });
    
    return sortedFindings;
  }
  
  // Add a new method to handle Safe Browsing checks
  _addSafeBrowsingChecks(findings, analysisResult) {
    try {
      // Look for Safe Browsing results in various possible locations
      const safeBrowsing = analysisResult.safe_browsing_result || 
                           analysisResult.ml_result?.safe_browsing_result;
      
      // First check: If we have a properly structured safe_browsing_result with threats
      if (safeBrowsing && 
          (safeBrowsing.is_safe === false || safeBrowsing.threats?.length > 0)) {
        
        // Create a general finding about Google Safe Browsing detection
        findings.push({
          text: 'Google Safe Browsing detected threats',
          description: 'This site has been flagged as dangerous by Google Safe Browsing, a security system used by Chrome, Firefox, and Safari. The site likely contains malware, phishing attempts, or other threats to your security.',
          severity: 'high',
          category: 'safe_browsing'
        });
        
        // If threats array exists, add specific findings for each threat type
        if (safeBrowsing.threats && Array.isArray(safeBrowsing.threats) && safeBrowsing.threats.length > 0) {
          // Create a set of unique threat types
          const threatTypes = new Set(safeBrowsing.threats.map(threat => threat.threat_type));
          
          // Add findings for each threat type
          if (threatTypes.has('MALWARE')) {
            findings.push({
              text: 'Malware detected by Google',
              description: 'Google Safe Browsing has identified this site as hosting malware. Visiting this site may result in your device being infected with harmful software that can steal personal information, damage your files, or take control of your device without your knowledge.',
              severity: 'high',
              category: 'safe_browsing'
            });
          }
          
          if (threatTypes.has('SOCIAL_ENGINEERING')) {
            findings.push({
              text: 'Phishing detected by Google',
              description: 'Google Safe Browsing has flagged this as a phishing site that attempts to trick you into revealing sensitive information such as passwords, credit card details, or personal data. These sites often impersonate trusted entities like banks, payment services, or well-known companies.',
              severity: 'high',
              category: 'safe_browsing'
            });
          }
          
          if (threatTypes.has('UNWANTED_SOFTWARE')) {
            findings.push({
              text: 'Unwanted software detected by Google',
              description: 'Google Safe Browsing has identified this site as distributing unwanted software that may change your browser settings, add unwanted extensions, display intrusive ads, collect data without consent, or be difficult to remove once installed.',
              severity: 'high',
              category: 'safe_browsing'
            });
          }
          
          if (threatTypes.has('POTENTIALLY_HARMFUL_APPLICATION')) {
            findings.push({
              text: 'Harmful application detected by Google',
              description: 'Google Safe Browsing has identified this site as distributing potentially harmful applications that may compromise your device security, collect sensitive data without disclosure, or perform actions without your consent.',
              severity: 'high',
              category: 'safe_browsing'
            });
          }
        }
      } 
      // Second check: Look for Safe Browsing information in message/risk_explanation fields
      else if ((analysisResult.message && analysisResult.message.toLowerCase().includes('safe browsing')) || 
               (analysisResult.risk_explanation && analysisResult.risk_explanation.toLowerCase().includes('safe browsing'))) {
        
        findings.push({
          text: 'Google Safe Browsing detected threats',
          description: 'This site has been flagged as dangerous by Google Safe Browsing, a security system used by Chrome, Firefox, and Safari. The site likely contains malware, phishing attempts, or other threats to your security.',
          severity: 'high',
          category: 'safe_browsing'
        });
      }
    } catch (error) {
      console.error('Error in Safe Browsing checks:', error);
    }
  }
  
  _addDomainChecks(url, findings, features) {
    try {
      // Domain Google indexing
      if ('domain_google_index' in features) {
        const domainIndexValue = Number(features.domain_google_index);
        
        if (domainIndexValue === 1) {
          findings.push({
            text: 'Domain properly indexed by Google',
            description: 'This domain is properly indexed by Google search, which is typical for established legitimate websites.',
            severity: 'low',
            category: 'domain'
          });
        } else if (domainIndexValue === 0) {
          findings.push({
            text: 'Domain not indexed by Google',
            description: 'Legitimate websites are typically indexed by search engines. New or malicious sites often aren\'t indexed.',
            severity: 'medium',
            category: 'domain'
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
            severity: 'low',
            category: 'domain'
          });
        } else if (urlIndexValue === 0) {
          findings.push({
            text: 'Page not indexed by Google',
            description: 'This specific page isn\'t in Google\'s index, which could indicate it\'s new or intentionally hidden.',
            severity: 'medium',
            category: 'domain'
          });
        }
      }
      
      // Domain age check
      if ('time_domain_activation' in features) {
        const domainAge = Number(features.time_domain_activation);
        
        // Avoid displaying for invalid values
        if (!isNaN(domainAge) && domainAge > 0) {
          if (domainAge < 7) {
            findings.push({
              text: 'Extremely new domain',
              description: `This domain was registered just ${domainAge} day${domainAge !== 1 ? 's' : ''} ago. Brand new domains are very frequently used for phishing attacks.`,
              severity: 'high',
              category: 'domain'
            });
          } else if (domainAge < 30) {
            findings.push({
              text: 'Very new domain',
              description: `This domain was registered only ${domainAge} days ago. Phishing sites often use newly registered domains.`,
              severity: 'medium',
              category: 'domain'
            });
          }
        }
      }
      
      // Check for excessive hyphens in domain
      if ('qty_hyphen_domain' in features && features.qty_hyphen_domain > 1) {
        findings.push({
          text: 'Excessive hyphens in domain',
          description: `This domain contains ${features.qty_hyphen_domain} hyphens, which is unusual for legitimate websites and often used in phishing domains.`,
          severity: 'medium',
          category: 'domain'
        });
      }
      
      // Check for server/client in domain name (common phishing indicator)
      if (features.server_client_domain === 1) {
        findings.push({
          text: 'Suspicious keywords in domain',
          description: 'This domain contains words like "server" or "client" which are frequently used in phishing domains to mimic technical messages.',
          severity: 'medium',
          category: 'domain'
        });
      }
      
      // Domain expiration check
      if ('time_domain_expiration' in features) {
        const domainExpiration = Number(features.time_domain_expiration);
        
        // Avoid displaying for invalid values
        if (!isNaN(domainExpiration) && domainExpiration > 0) {
          if (domainExpiration < 30) {
            findings.push({
              text: 'Domain expiring very soon',
              description: `This domain will expire in ${domainExpiration} day${domainExpiration !== 1 ? 's' : ''}. Phishing sites often use domains with short registration periods.`,
              severity: 'high',
              category: 'domain'
            });
          } else if (domainExpiration < 90) {
            findings.push({
              text: 'Domain expiring soon',
              description: `This domain will expire in ${domainExpiration} days. Legitimate businesses typically register domains for longer periods.`,
              severity: 'medium',
              category: 'domain'
            });
          }
        }
      }
      
      // Check for Internationalized Domain Name (Punycode)
      try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname;
        
        if (hostname.startsWith('xn--') || hostname.includes('.xn--')) {
          findings.push({
            text: 'Internationalized domain name detected',
            description: 'This URL uses Punycode (xn--) encoding, which can be used to create domain names that visually mimic legitimate sites using different character sets.',
            severity: 'high',
            category: 'domain'
          });
        }
      } catch (e) {
        // URL parsing error, skip this check
      }
      
      // Check for domain in IP (already handled in basic URL check)
      // But add enhanced check for IP in path or query
      try {
        if (!/\d+\.\d+\.\d+\.\d+/.test(url)) {  // If not already caught by basic check
          const parsedUrl = new URL(url);
          const ipInPathOrQuery = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(parsedUrl.pathname + parsedUrl.search);
          
          if (ipInPathOrQuery) {
            findings.push({
              text: 'IP address in URL path or parameters',
              description: 'This URL contains an IP address in its path or parameters, which is unusual and suspicious.',
              severity: 'medium',
              category: 'url'
            });
          }
        }
      } catch (e) {
        // URL parsing error, skip this check
      }
    } catch (error) {
      console.error('Error in domain checks:', error);
    }
  }
  
  _addCertificateChecks(findings, features) {
    try {
      // Check for TLS/SSL certificate feature
      if ('tls_ssl_certificate' in features) {
        if (features.tls_ssl_certificate === 0) {
          findings.push({
            text: 'SSL/TLS certificate validation failed',
            description: 'This site either has no SSL/TLS certificate or has an invalid certificate. Secure sites use valid certificates to encrypt your data and verify their identity.',
            severity: 'high',
            category: 'certificate'
          });
        } else if (features.tls_ssl_certificate === 1) {
          findings.push({
            text: 'Valid SSL/TLS certificate',
            description: 'This site uses a valid SSL/TLS certificate to encrypt data transmission, which is standard security practice.',
            severity: 'low',
            category: 'certificate'
          });
        }
      }
      
      // Check for certificate age if available
      if ('cert_age' in features && features.cert_age !== undefined) {
        const certAge = Number(features.cert_age);
        
        if (!isNaN(certAge) && certAge >= 0) {
          if (certAge < 7) {
            findings.push({
              text: 'Very recently issued SSL certificate',
              description: `This site's SSL certificate was issued just ${certAge} day${certAge !== 1 ? 's' : ''} ago, which is common for new phishing sites.`,
              severity: 'medium',
              category: 'certificate'
            });
          }
        }
      }
      
      // Check for certificate mismatch
      if ('cert_mismatch' in features && features.cert_mismatch) {
        findings.push({
          text: 'SSL certificate domain mismatch',
          description: 'The SSL certificate does not match the domain name, which is a strong indicator of a suspicious site.',
          severity: 'high',
          category: 'certificate'
        });
      }
      
      // Check for self-signed certificates
      if ('cert_self_signed' in features && features.cert_self_signed) {
        findings.push({
          text: 'Self-signed SSL certificate',
          description: 'This site uses a self-signed SSL certificate rather than one from a trusted certificate authority, which is often a sign of a suspicious website.',
          severity: 'high',
          category: 'certificate'
        });
      }
    } catch (error) {
      console.error('Error in certificate checks:', error);
    }
  }
  
  _addUrlStructureChecks(url, findings, features) {
    try {
      // Check for URL shortening services
      if ('url_shortened' in features && features.url_shortened === 1) {
        findings.push({
          text: 'URL shortening service detected',
          description: 'This URL uses a shortening service, which can hide the actual destination. Exercise caution as the real website address is not immediately visible.',
          severity: 'medium',
          category: 'url'
        });
      }
      
      // NEW: Check for cryptographic content identifiers/hashes in URL
      try {
        const parsedUrl = new URL(url);
        const pathAndParams = parsedUrl.pathname + parsedUrl.search;
        
        // Match common cryptographic hash patterns (32+ character hex/base58/base64 strings)
        // Common in IPFS, blockchain links, and other decentralized systems
        const hashPatterns = [
          // IPFS CID pattern (Qm... or bafy... format)
          /\/(Qm[a-zA-Z0-9]{44,}|bafy[a-zA-Z0-9]{44,})/,
          // General long hex hash pattern (32+ hex chars)
          /\/([a-fA-F0-9]{32,})/,
          // Base64-like long hash pattern
          /\/([A-Za-z0-9+/]{43,}=*)/,
          // Long alphanumeric string that's likely a hash
          /\/([a-zA-Z0-9]{32,})(?:\/|$|\?)/
        ];
        
        for (const pattern of hashPatterns) {
          const match = pathAndParams.match(pattern);
          if (match) {
            findings.push({
              text: 'Cryptographic content identifier detected',
              description: 'This URL contains a long cryptographic hash that obscures the actual content. This technique prevents security tools from understanding what content is being accessed without visiting the link.',
              severity: 'medium',
              category: 'url'
            });
            break; // Only add this finding once
          }
        }
      } catch (e) {
        // URL parsing error, skip this check
      }
      
      // Check for excessive subdomains
      if ('qty_dot_domain' in features && features.qty_dot_domain > 3) {
        findings.push({
          text: 'Excessive subdomains',
          description: `This URL contains multiple subdomains (${features.qty_dot_domain - 1} levels). Attackers often use multiple subdomains to make phishing URLs appear legitimate or hide the actual domain.`,
          severity: 'medium',
          category: 'url'
        });
      }
      
      // Check for presence of @ symbol in URL
      if ('qty_at_url' in features && features.qty_at_url > 0) {
        findings.push({
          text: 'At symbol (@) in URL',
          description: 'This URL contains the @ symbol, which can be used to create misleading URLs. Everything before @ is ignored in URL navigation.',
          severity: 'high',
          category: 'url'
        });
      }
      
      // Check for excessive query parameters
      if ('qty_params' in features && features.qty_params > 5) {
        findings.push({
          text: 'Excessive query parameters',
          description: `This URL contains ${features.qty_params} query parameters, which is unusually high and may indicate obfuscation attempts.`,
          severity: 'low',
          category: 'url'
        });
      }
      
      // Check for TLD in URL parameters (domain spoofing technique)
      if ('tld_present_params' in features && features.tld_present_params === 1) {
        findings.push({
          text: 'TLD in query parameters',
          description: 'The URL contains a domain extension in its query parameters, which is a common technique to make phishing URLs look legitimate.',
          severity: 'medium',
          category: 'url'
        });
      }
      
      // Check for redirects
      if ('qty_redirects' in features && features.qty_redirects > 1) {
        findings.push({
          text: 'Multiple redirects detected',
          description: `This URL performs ${features.qty_redirects} redirects before reaching its final destination, which can be used to hide the actual destination.`,
          severity: 'medium',
          category: 'url'
        });
      }
      
      // Check for suspicious URL length (if not already caught)
      if ('length_url' in features && features.length_url > 150) {
        findings.push({
          text: 'Extremely long URL',
          description: `This URL is ${features.length_url} characters long, which is excessively long and often used to hide the true destination or confuse users.`,
          severity: 'high',
          category: 'url'
        });
      }
      
      // Check for excessive special characters
      const specialCharFeatures = [
        'qty_dot_url', 'qty_hyphen_url', 'qty_underline_url', 'qty_equal_url',
        'qty_and_url', 'qty_exclamation_url', 'qty_percent_url', 'qty_plus_url'
      ];
      
      let specialCharCount = 0;
      specialCharFeatures.forEach(feature => {
        if (feature in features) {
          specialCharCount += Number(features[feature]);
        }
      });
      
      if (specialCharCount > 20) {
        findings.push({
          text: 'Excessive special characters in URL',
          description: `This URL contains an unusually high number of special characters (${specialCharCount}), which can be a sign of obfuscation techniques.`,
          severity: 'medium',
          category: 'url'
        });
      }
    } catch (error) {
      console.error('Error in URL structure checks:', error);
    }
  }
  
  _addContentChecks(findings, features) {
    try {
      // Check for email in URL (rare in legitimate URLs)
      if ('email_in_url' in features && features.email_in_url === 1) {
        findings.push({
          text: 'Email address in URL',
          description: 'This URL contains an email address, which is rare in legitimate URLs and often used in phishing attacks.',
          severity: 'medium',
          category: 'content'
        });
      }
      
      // Check for brand impersonation if data exists
      if ('brand_impersonation' in features && features.brand_impersonation) {
        findings.push({
          text: 'Brand impersonation detected',
          description: `This site appears to impersonate ${features.impersonated_brand || 'a known brand'}, but is not actually affiliated with it.`,
          severity: 'high',
          category: 'content'
        });
      }
      
      // Check for known phishing patterns
      if ('known_phishing_patterns' in features && features.known_phishing_patterns) {
        findings.push({
          text: 'Known phishing page patterns',
          description: 'This page contains elements that match known phishing techniques, such as fake login forms or deceptive content.',
          severity: 'high',
          category: 'content'
        });
      }
      
      // Check for cloaking techniques
      if ('content_cloaking' in features && features.content_cloaking) {
        findings.push({
          text: 'Content cloaking detected',
          description: 'This site appears to show different content to different visitors, a technique called "cloaking" that is often used to hide malicious content from security scanners.',
          severity: 'high',
          category: 'content'
        });
      }
      
      // Check for high risk score if available
      if ('risk_score' in features) {
        const riskScore = Number(features.risk_score);
        if (riskScore >= 80) {
          findings.push({
            text: 'Very high risk score',
            description: `Our AI model has assigned this URL a risk score of ${riskScore}%, indicating a high probability of being a phishing site.`,
            severity: 'high',
            category: 'content'
          });
        } else if (riskScore >= 60) {
          findings.push({
            text: 'Elevated risk score',
            description: `Our AI model has assigned this URL a risk score of ${riskScore}%, indicating a moderate to high probability of being a phishing site.`,
            severity: 'medium',
            category: 'content'
          });
        }
      }
    } catch (error) {
      console.error('Error in content checks:', error);
    }
  }
  
  _addInfrastructureChecks(findings, features) {
    try {
      // Check DNS servers
      if ('qty_nameservers' in features) {
        if (features.qty_nameservers === 0) {
          // Only add a high severity warning if Google doesn't index the domain
          if (features.domain_google_index !== 1) {
            findings.push({
              text: 'No DNS nameservers found',
              description: 'This domain does not have proper DNS configuration. Legitimate websites always have DNS nameservers.',
              severity: 'high',
              category: 'infrastructure'
            });
          } else {
            // For Google-indexed sites, this is less severe
            findings.push({
              text: 'DNS configuration issue',
              description: 'This domain has DNS configuration issues, but appears to be established based on its presence in search results.',
              severity: 'medium',
              category: 'infrastructure'
            });
          }
        } else if (features.qty_nameservers < 2) {
          findings.push({
            text: 'Insufficient nameservers',
            description: 'This domain has only one nameserver. Legitimate businesses typically use multiple nameservers for reliability.',
            severity: 'low',
            category: 'infrastructure'
          });
        }
      }
      
      // Check for abnormally low TTL
      if ('ttl_hostname' in features && features.ttl_hostname > 0 && features.ttl_hostname < 300) {
        findings.push({
          text: 'Abnormally low DNS TTL',
          description: 'This domain has an unusually short Time-To-Live value, which can indicate a temporary setup often used in phishing campaigns.',
          severity: 'medium',
          category: 'infrastructure'
        });
      }
      
      // Check for SPF record
      if ('domain_spf' in features) {
        const hasSPF = features.domain_spf === 1;
        if (!hasSPF) {
          findings.push({
            text: 'Missing SPF record',
            description: 'This domain lacks an SPF (Sender Policy Framework) record, which legitimate organizations typically implement to prevent email spoofing.',
            severity: 'medium',
            category: 'infrastructure'
          });
        }
      }

      // NEW: Add IP reputation information
      if (features.ip_blacklisted === 1) {
        findings.push({
          text: 'IP address on security blocklists',
          description: 'The server hosting this website appears on known security blocklists. This indicates the server may have been previously used for spam or malicious activity.',
          severity: 'high',
          category: 'infrastructure'
        });
      }
      
      // Show details if multiple blocklists are involved
      if (features.ip_blacklist_count > 2) {
        findings.push({
          text: `Server blocked by ${features.ip_blacklist_count} security services`,
          description: 'This site is hosted on a server that appears on multiple security blocklists, indicating a high probability of malicious activity from this infrastructure.',
          severity: 'high',
          category: 'infrastructure'
        });
      }
      
      // NEW: Handle WHOIS failure more gracefully
      const whois_failed = (
        ('time_domain_activation' in features && features.time_domain_activation === 0) &&
        ('time_domain_expiration' in features && features.time_domain_expiration === 0)
      );
      
      if (whois_failed && features.domain_google_index !== 1) {
        findings.push({
          text: 'Domain registration information unavailable',
          description: 'We could not verify the age and expiration date of this domain, which is unusual for established legitimate websites.',
          severity: 'medium',
          category: 'infrastructure'
        });
      }
      
    } catch (error) {
      console.error('Error in infrastructure checks:', error);
    }
  }
  
  // Helper function to deduplicate findings based on text content
  _deduplicateFindings(findings) {
    const uniqueFindings = [];
    const seenTexts = new Set();
    
    for (const finding of findings) {
      if (!seenTexts.has(finding.text)) {
        seenTexts.add(finding.text);
        uniqueFindings.push(finding);
      }
    }
    
    return uniqueFindings;
  }
  
  // This method can be used later for creating detailed educational content
  generateEducationalContent(analysisResult, url) {
    // Get key findings 
    const findings = this.generateKeyFindings(analysisResult, url);
    
    // Create educational content with findings
    // Implementation can be expanded later
    
    return {
      findings: findings
    };
  }
}

module.exports = EducationService;
