const dns = require('dns').promises;

class EmailHeaderAnalyzer {
  constructor() {
    // Same risk factors
    this.riskFactors = {
      // Authentication Failures
      spf_fail: 10,
      dkim_fail: 10,
      dmarc_fail: 10,
      
      // Domain Inconsistencies
      domain_mismatch: 15,
      display_name_deception: 12,
      
      // Routing Red Flags
      suspicious_routing: 8,
      excessive_hops: 5,
      known_spam_network: 20,
      
      // Technical Anomalies
      missing_headers: 6,
      timestamp_anomaly: 8
    };
  }
  
  async analyzeHeaders(rawHeaders) {
    try {
      console.log('Starting header analysis with optimized parser...');
      // Parse the headers with improved performance
      const parsedHeaders = this._parseHeadersOptimized(rawHeaders);
      console.log('Headers parsed successfully');
      
      // Initialize analysis results
      const results = {
        riskScore: 0,
        findings: [],
        authResults: {},
        routingAnalysis: {},
        domainAnalysis: {},
        detectedDeceptions: [],
        headers: parsedHeaders.headerFields,
        email_subject: parsedHeaders.subject || 'No Subject'
      };
      
      // Process findings in sequence rather than parallel for better stability
      await this._checkAuthentication(parsedHeaders, results);
      await this._analyzeRouting(parsedHeaders, results);
      await this._analyzeDomains(parsedHeaders, results);
      await this._detectDeception(parsedHeaders, results);
      // ADDED: New check for suspicious headers
      await this._checkSuspiciousHeaders(parsedHeaders, results);
      
      console.log('All analysis steps completed');
      
      // Calculate overall risk score
      results.riskScore = this._calculateRiskScore(results);
      results.isPhishing = results.riskScore >= 50; // FIXED: Lower threshold to be more sensitive
      
      // Generate summary
      results.summary = this._generateSummary(results);
      
      console.log(`Analysis complete: Risk score ${results.riskScore}, Findings: ${results.findings.length}`);
      return results;
    } catch (error) {
      console.error('Error analyzing email headers:', error);
      throw new Error('Error analyzing email headers: ' + error.message);
    }
  }
  
  _parseHeadersOptimized(rawHeaders) {
    try {
      const headerFields = {};
      const lines = rawHeaders.split(/\r?\n/);
      let currentHeader = '';
      let currentValue = '';
      
      // Extract email subject if present - optimized regex
      const subjectMatch = /^Subject:\s*([^\r\n]+)/im.exec(rawHeaders);
      const subject = subjectMatch ? subjectMatch[1].trim() : 'No Subject';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip empty lines
        if (!line.trim()) continue;
        
        // Check if this is a new header line (starts with a name followed by a colon)
        if (/^[\w-]+:/.test(line)) {
          // Save the previous header if there is one
          if (currentHeader) {
            headerFields[currentHeader.toLowerCase()] = currentValue.trim();
          }
          
          // Start a new header
          const colonIndex = line.indexOf(':');
          currentHeader = line.substring(0, colonIndex).trim();
          currentValue = line.substring(colonIndex + 1).trim();
        } else if (currentHeader) {
          // Continuation of previous header
          currentValue += ' ' + line.trim();
        }
      }
      
      // Don't forget the last header being processed
      if (currentHeader) {
        headerFields[currentHeader.toLowerCase()] = currentValue.trim();
      }
      
      return { headerFields, subject };
    } catch (error) {
      console.error('Error parsing email headers:', error);
      return { headerFields: {}, subject: 'No Subject' };
    }
  }
  
  async _checkAuthentication(parsedHeaders, results) {
    const { headerFields } = parsedHeaders;
    const authResults = {};
    
    try {
      // Look for Authentication-Results header
      const authHeader = headerFields['authentication-results'] || '';
      
      // Check SPF
      const spfMatch = authHeader.match(/spf=(\w+)/i);
      if (spfMatch) {
        const spfResult = spfMatch[1].toLowerCase();
        authResults.spf = spfResult;
        
        if (spfResult === 'fail' || spfResult === 'softfail') {
          results.findings.push({
            text: 'SPF Authentication Failure',
            description: `The message failed SPF authentication (${spfResult}). This suggests the sender's address may be forged.`,
            severity: spfResult === 'fail' ? 'high' : 'medium'
          });
        } else if (spfResult === 'none') {
          // FIXED: Add finding for SPF "none" case
          results.findings.push({
            text: 'No SPF Authentication',
            description: 'The sending domain does not have SPF configured or the check was skipped. SPF helps verify email authenticity.',
            severity: 'medium'
          });
        } else if (spfResult === 'pass') {
          // Good sign, but we don't need a finding for this
          authResults.spfPassed = true;
        }
      } else {
        authResults.spf = 'none';
        results.findings.push({
          text: 'No SPF Verification Results',
          description: 'This email lacks SPF authentication results, which makes it harder to verify the sender.',
          severity: 'medium'
        });
      }
      
      // Check DKIM
      const dkimMatch = authHeader.match(/dkim=(\w+)/i);
      if (dkimMatch) {
        const dkimResult = dkimMatch[1].toLowerCase();
        authResults.dkim = dkimResult;
        
        if (dkimResult === 'fail') {
          results.findings.push({
            text: 'DKIM Signature Failure',
            description: 'The DKIM signature verification failed. This email\'s content may have been altered in transit.',
            severity: 'high'
          });
        } else if (dkimResult === 'none') {
          // UPDATED: Changed severity from 'low' to 'medium'
          results.findings.push({
            text: 'No DKIM Signature',
            description: 'This email is not signed with DKIM. While not all legitimate emails use DKIM, it\'s an important authentication method that helps verify email integrity.',
            severity: 'medium'  // Changed from 'low'
          });
        } else if (dkimResult === 'pass') {
          authResults.dkimPassed = true;
        }
      } else {
        authResults.dkim = 'none';
        // Not all emails have DKIM, so this is less severe than missing SPF
        authResults.dkimPassed = false;
      }
      
      // Check DMARC
      const dmarcMatch = authHeader.match(/dmarc=(\w+)/i);
      if (dmarcMatch) {
        const dmarcResult = dmarcMatch[1].toLowerCase();
        authResults.dmarc = dmarcResult;
        
        if (dmarcResult === 'fail') {
          results.findings.push({
            text: 'DMARC Policy Failure',
            description: 'This message failed DMARC policy checks. The sender domain\'s email security policy indicates this is suspicious.',
            severity: 'high'
          });
        } else if (dmarcResult === 'none') {
          // UPDATED: Changed severity from 'low' to 'medium'
          results.findings.push({
            text: 'No DMARC Policy',
            description: 'The sending domain does not have a DMARC policy. DMARC helps protect against email spoofing and phishing.',
            severity: 'medium'  // Changed from 'low'
          });
        } else if (dmarcResult === 'pass') {
          authResults.dmarcPassed = true;
        }
      } else {
        authResults.dmarc = 'none';
        // Not all domains have DMARC yet
        authResults.dmarcPassed = false;
      }
      
      // If all authentications passed, add a positive finding
      if (authResults.spfPassed && authResults.dkimPassed && authResults.dmarcPassed) {
        results.findings.push({
          text: 'Strong Email Authentication',
          description: 'This email passed all available authentication checks (SPF, DKIM, DMARC), indicating the sender is legitimate.',
          severity: 'info'  // Changed from 'low' to 'info' for positive findings
        });
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
    }
    
    results.authResults = authResults;
  }
  
  async _analyzeRouting(parsedHeaders, results) {
    const { headerFields } = parsedHeaders;
    const routing = {};
    
    try {
      // Count the number of received headers (mail server hops)
      let receivedHeaders = [];
      for (const key in headerFields) {
        if (key.startsWith('received')) {
          receivedHeaders.push(headerFields[key]);
        }
      }
      
      const receivedCount = receivedHeaders.length;
      routing.hopCount = receivedCount;
      
      // Check if the number of hops is excessive
      if (receivedCount > 7) {
        results.findings.push({
          text: 'Excessive Mail Server Hops',
          description: `This email passed through an unusually high number of mail servers (${receivedCount}). This could indicate an attempt to obscure the origin.`,
          severity: 'medium'
        });
      } else if (receivedCount === 0) {
        results.findings.push({
          text: 'Missing Routing Information',
          description: 'This email is missing expected routing information. Legitimate emails typically include details about the servers they passed through.',
          severity: 'high'
        });
      }
      
      // Look for suspicious terms in routing path
      const suspiciousTerms = [
        'proxy', 'relay', 'unknown', 'tempmail', 'temporarymail', 'mailinator', 'throwaway'
      ];
      
      for (const header of receivedHeaders) {
        for (const term of suspiciousTerms) {
          if (header.toLowerCase().includes(term)) {
            results.findings.push({
              text: 'Suspicious Routing Detected',
              description: `The email was routed through a potentially suspicious server (containing "${term}").`,
              severity: 'medium'
            });
            routing.suspiciousRouting = true;
            break;
          }
        }
      }
    } catch (error) {
      console.error('Error analyzing routing:', error);
    }
    
    results.routingAnalysis = routing;
  }
  
  async _analyzeDomains(parsedHeaders, results) {
    const { headerFields } = parsedHeaders;
    const domainAnalysis = {};
    
    try {
      // Extract domains from From, Return-Path and Reply-To headers
      const fromHeader = headerFields['from'] || '';
      const returnPathHeader = headerFields['return-path'] || '';
      const replyToHeader = headerFields['reply-to'] || '';
      
      // Extract domains using regex
      const extractDomain = (header) => {
        const emailMatch = header.match(/<([^@]+@([^>]+))>/i) || header.match(/([^@\s]+@([^\s]+))/i);
        if (emailMatch && emailMatch[2]) {
          return emailMatch[2].toLowerCase();
        }
        return null;
      };
      
      const fromDomain = extractDomain(fromHeader);
      const returnPathDomain = extractDomain(returnPathHeader);
      const replyToDomain = extractDomain(replyToHeader);
      
      domainAnalysis.fromDomain = fromDomain;
      domainAnalysis.returnPathDomain = returnPathDomain;
      domainAnalysis.replyToDomain = replyToDomain;
      
      // Check for domain mismatches - improved logic to handle subdomains
      if (fromDomain && returnPathDomain && fromDomain !== returnPathDomain) {
        // Extract root domains to check if it's a subdomain situation
        const getRootDomain = (domain) => {
          const parts = domain.split('.');
          // Get the root domain (usually last two parts, e.g., example.com)
          if (parts.length >= 2) {
            return parts.slice(-2).join('.');
          }
          return domain;
        };
        
        const fromRootDomain = getRootDomain(fromDomain);
        const returnPathRootDomain = getRootDomain(returnPathDomain);
        
        // Only flag as suspicious if root domains differ
        if (fromRootDomain !== returnPathRootDomain) {
          results.findings.push({
            text: 'Completely Different Sender Domains',
            description: `The From domain (${fromDomain}) doesn't match the Return-Path domain (${returnPathDomain}). Different root domains are a strong indicator of email spoofing.`,
            severity: 'high'
          });
          domainAnalysis.domainMismatch = true;
        } else {
          // Subdomain case - less severe warning
          results.findings.push({
            text: 'Sender Domain Variation',
            description: `The From domain (${fromDomain}) uses a different subdomain than the Return-Path (${returnPathDomain}). This is common for legitimate emails using email service providers, but worth noting.`,
            severity: 'low'
          });
          domainAnalysis.subdomainVariation = true;
        }
      }
      
      if (fromDomain && replyToDomain && fromDomain !== replyToDomain) {
        // Similar check for Reply-To domain
        const fromRootDomain = fromDomain.split('.').slice(-2).join('.');
        const replyToRootDomain = replyToDomain.split('.').slice(-2).join('.');
        
        if (fromRootDomain !== replyToRootDomain) {
          results.findings.push({
            text: 'Reply-To Domain Mismatch',
            description: `The From domain (${fromDomain}) doesn't match the Reply-To domain (${replyToDomain}). This could indicate an attempt to capture replies to a different address.`,
            severity: 'high'
          });
          domainAnalysis.replyToMismatch = true;
        }
      }
      
      // Check for display name deception - keep this logic
      const displayNameMatch = fromHeader.match(/^([^<]+)</);
      if (displayNameMatch) {
        const displayName = displayNameMatch[1].trim();
        
        // Check if display name contains a different domain than the actual from address
        const displayNameDomainMatch = displayName.match(/[@\.]([\w-]+\.[\w-]+)$/i);
        if (displayNameDomainMatch) {
          const displayNameDomain = displayNameDomainMatch[1].toLowerCase();
          
          if (fromDomain && displayNameDomain !== fromDomain && 
              !displayName.includes('<') && !displayName.includes('>')) {
            results.findings.push({
              text: 'Display Name Deception',
              description: `The sender's display name contains a different domain (${displayNameDomain}) than the actual email address (${fromDomain}). This is a common phishing tactic.`,
              severity: 'high'
            });
            domainAnalysis.displayNameDeception = true;
          }
        }
        
        // MODIFIED: Remove specific political figure detection, instead use more general categories
        const wellKnownServices = [
          'paypal', 'apple', 'microsoft', 'google', 'amazon', 'bank', 'netflix', 'facebook',
          'government', 'official', 'support', 'service', 'security', 'admin',
          'billing', 'payment', 'account', 'secure', 'help', 'team'
        ];
        
        // ADDED: Check for government/official entity generically instead of specific figures
        if (displayName.toLowerCase().includes('president') || 
            displayName.toLowerCase().includes('minister') ||
            displayName.toLowerCase().includes('official') ||
            displayName.toLowerCase().includes('administration')) {
            
          const domainLooksGovernmental = fromDomain && 
            (fromDomain.includes('gov') || 
             fromDomain.includes('government') || 
             fromDomain.endsWith('.gov') || 
             fromDomain.includes('official'));
             
          if (!domainLooksGovernmental) {
            results.findings.push({
              text: 'Potential Official Entity Impersonation',
              description: `The sender appears to represent an official or governmental entity but is using a non-governmental email domain (${fromDomain}).`,
              severity: 'high'
            });
            domainAnalysis.officialImpersonation = true;
          }
        }
        
        // Keep general service impersonation check
        for (const service of wellKnownServices) {
          if (displayName.toLowerCase().includes(service) && 
              fromDomain && !fromDomain.includes(service)) {
            results.findings.push({
              text: `Possible ${service.charAt(0).toUpperCase() + service.slice(1)} Impersonation`,
              description: `The sender display name includes "${service}" but comes from an unrelated domain (${fromDomain}). This is a common phishing tactic.`,
              severity: 'high'
            });
            domainAnalysis.serviceImpersonation = true;
            break;
          }
        }
      }
      
      // ADDED: Extract email addresses for additional checks
      const extractEmail = (header) => {
        const emailMatch = header.match(/<([^@]+@[^>]+)>/i) || header.match(/([^@\s]+@[^\s]+)/i);
        return emailMatch ? emailMatch[1].toLowerCase() : null;
      };
      
      const fromEmail = extractEmail(fromHeader);
      const replyToEmail = extractEmail(replyToHeader);
      
      // ADDED: Check for reply-to mismatch with the same domain
      if (fromEmail && replyToEmail && fromEmail !== replyToEmail && fromDomain === replyToDomain) {
        results.findings.push({
          text: 'Suspicious Reply-To Address',
          description: `Replies will go to ${replyToEmail}, which is different from the sender (${fromEmail}) even though they share the same domain. This could be an attempt to redirect responses.`,
          severity: 'medium'
        });
      }
    } catch (error) {
      console.error('Error analyzing domains:', error);
    }
    
    results.domainAnalysis = domainAnalysis;
  }
  
  async _detectDeception(parsedHeaders, results) {
    const { headerFields } = parsedHeaders;
    
    try {
      // Check for common phishing subject lines
      const subject = parsedHeaders.subject.toLowerCase();
      const phishingTerms = [
        'account', 'suspend', 'verify', 'login', 'urgent', 'attention', 
        'update', 'security', 'unusual', 'password', 'confirm',
        'bank', 'paypal', 'amazon', 'netflix', 'apple', 'microsoft'
      ];
      
      const urgencyTerms = [
        'urgent', 'immediate', 'attention', 'alert', 'important',
        'update required', 'action required', 'immediately', 
        'verify now', 'suspended', 'limited', 'unusual'
      ];
      
      // Count phishing terms in subject
      const phishingTermCount = phishingTerms.filter(term => 
        subject.includes(term)).length;
      
      // Count urgency terms in subject
      const urgencyTermCount = urgencyTerms.filter(term => 
        subject.includes(term)).length;
      
      if (urgencyTermCount >= 1) {
        results.findings.push({
          text: 'Urgency Tactics in Subject',
          description: 'The email subject creates a false sense of urgency. Phishers often use urgency to pressure recipients into acting without thinking.',
          severity: 'medium'
        });
      }
      
      if (phishingTermCount >= 2 && phishingTermCount > urgencyTermCount) {
        results.findings.push({
          text: 'Suspicious Subject Keywords',
          description: 'The email subject contains multiple terms commonly found in phishing attempts.',
          severity: 'medium'
        });
      }
      
      // Check for missing essential headers
      const essentialHeaders = ['date', 'from', 'to', 'subject', 'message-id'];
      const missingHeaders = essentialHeaders.filter(header => !headerFields[header]);
      
      if (missingHeaders.length > 0) {
        results.findings.push({
          text: 'Missing Essential Headers',
          description: `This email is missing essential headers: ${missingHeaders.join(', ')}. Legitimate emails typically contain these standard headers.`,
          severity: 'high'
        });
      }
    } catch (error) {
      console.error('Error detecting deception:', error);
    }
  }
  
  async _checkSuspiciousHeaders(parsedHeaders, results) {
    const { headerFields } = parsedHeaders;
    
    try {
      // Look for suspicious script indicators in headers
      const suspiciousScriptKeywords = ['php', 'script', 'spoof', 'originating-script'];
      
      for (const key in headerFields) {
        const headerValue = headerFields[key].toLowerCase();
        
        // Special check for X-PHP-Originating-Script header
        if (key.toLowerCase().includes('php-originating-script')) {
          results.findings.push({
            text: 'Suspicious PHP Script Origin',
            description: `This email was generated by a PHP script (${headerFields[key]}). This is unusual for legitimate emails and often indicates an automated phishing campaign.`,
            severity: 'high'
          });
          break;
        }
        
        // Check header name and value for suspicious terms
        for (const keyword of suspiciousScriptKeywords) {
          if ((key.toLowerCase().includes(keyword) || headerValue.includes(keyword)) && 
              headerValue.includes('spoof')) {
            results.findings.push({
              text: 'Suspicious Script Indicators',
              description: `Header "${key}" contains suspicious script references that may indicate this email was generated by an automated phishing tool.`,
              severity: 'high'
            });
            break;
          }
        }
      }
      
      // Check for unusual or custom X- headers that could indicate manipulation
      const suspiciousXHeaders = Object.keys(headerFields)
        .filter(key => key.toLowerCase().startsWith('x-') && 
               !['x-mailer', 'x-originating-ip', 'x-spam-status'].includes(key.toLowerCase()));
      
      if (suspiciousXHeaders.length > 5) {
        results.findings.push({
          text: 'Unusual Custom Headers',
          description: `This email contains an unusual number of custom X- headers (${suspiciousXHeaders.length}), which may indicate email manipulation or automated generation.`,
          severity: 'medium'  // Changed from 'low'
        });
      }
    } catch (error) {
      console.error('Error checking suspicious headers:', error);
    }
  }
  
  _calculateRiskScore(results) {
    // Base score
    let score = 0;
    
    // Add weighted scores for findings by severity
    for (const finding of results.findings) {
      if (finding.severity === 'high') {
        score += 25;
      } else if (finding.severity === 'medium') {
        score += 15;
      } else if (finding.severity === 'low') {
        score += 5;  // Changed from -5 to +5 for 'low' severity
      } else if (finding.severity === 'info') {
        // Only reduce score for truly positive findings
        score -= 5;
      }
    }
    
    // Ensure score is not negative
    score = Math.max(score, 0);
    
    // Cap the score at 100
    return Math.min(score, 100);
  }
  
  _generateSummary(results) {
    // Count findings by severity
    const highCount = results.findings.filter(f => f.severity === 'high').length;
    const mediumCount = results.findings.filter(f => f.severity === 'medium').length;
    
    if (highCount > 0) {
      return `This email shows ${highCount} high-risk and ${mediumCount} medium-risk indicators of potential phishing.`;
    } else if (mediumCount > 1) {
      return `This email contains ${mediumCount} suspicious characteristics that warrant caution.`;
    } else if (results.findings.some(f => f.severity === 'medium')) {
      return 'This email has some minor suspicious characteristics but is likely legitimate.';
    } else {
      return 'This email appears to be legitimate with no significant security concerns detected.';
    }
  }
}

module.exports = new EmailHeaderAnalyzer();
