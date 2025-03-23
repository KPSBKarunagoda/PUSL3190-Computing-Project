import json
from typing import Dict, Any, List, Optional

class EducationService:
    """Service for generating educational content about phishing using templates instead of AI"""
    
    def __init__(self):
        # No API keys needed for template-based approach
        pass
    
    async def generate_summary(self, url: str, analysis_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate a brief summary of phishing analysis for display in the extension
        
        Args:
            url: The URL that was analyzed
            analysis_result: Results from phishing analysis
            
        Returns:
            Dictionary with brief explanation content
        """
        # Extract key information
        is_phishing = analysis_result.get("is_phishing", False)
        risk_score = analysis_result.get("risk_score", 0)
        
        # Get top features
        notable_features = self._extract_notable_features(analysis_result)[:3]
        
        # Generate summary using templates
        content = self._generate_summary_from_template(url, is_phishing, risk_score, notable_features)
        
        return {
            "success": True,
            "content": content
        }
    
    async def generate_detailed_content(self, url: str, analysis_result: Dict[str, Any], 
                                       content_type: str = "explain") -> Dict[str, Any]:
        """
        Generate detailed educational content for the "Learn More" section
        
        Args:
            url: The URL that was analyzed
            analysis_result: Results from phishing analysis
            content_type: Type of content to generate (explain, tips, learn)
            
        Returns:
            Dictionary with detailed educational content
        """
        # Extract key information
        is_phishing = analysis_result.get("is_phishing", False)
        risk_score = analysis_result.get("risk_score", 0)
        
        # Get all features
        notable_features = self._extract_notable_features(analysis_result)
        
        # Select appropriate template based on content type
        if content_type == "explain":
            content = self._generate_explanation_from_template(url, is_phishing, risk_score, notable_features)
        elif content_type == "tips":
            content = self._generate_tips_from_template(is_phishing)
        elif content_type == "learn":
            content = self._generate_learning_content_from_template(is_phishing)
        else:
            content = self._generate_explanation_from_template(url, is_phishing, risk_score, notable_features)
        
        return {
            "success": True,
            "content": content
        }
    
    def _generate_summary_from_template(self, url: str, is_phishing: bool, risk_score: float, 
                                      features: List[str]) -> str:
        """Generate summary using templates instead of AI"""
        # Join features for display
        features_text = ", ".join(features) if features else "no specific suspicious features"
        
        if is_phishing:
            if any("IP address" in feature for feature in features):
                return f"""This URL appears to be a phishing attempt (risk score: {risk_score}/100) because it uses an IP address instead of a proper domain name, which is a common tactic to hide the website's true identity."""
            
            elif any("HTTPS" in feature for feature in features):
                return f"""This URL is likely a phishing site (risk score: {risk_score}/100) as it lacks proper security protocols. Without HTTPS, any data you send to this site could be intercepted."""
            
            elif any("recently" in feature for feature in features):
                return f"""This URL appears suspicious (risk score: {risk_score}/100) primarily because it was registered very recently, which is common for phishing sites that operate briefly to avoid detection."""
                
            elif any("subdomain" in feature or "impersonation" in feature for feature in features):
                return f"""This URL has been flagged as phishing (risk score: {risk_score}/100) because it appears to be impersonating a legitimate brand or service through suspicious domain techniques."""
                
            else:
                return f"""This URL has been identified as potentially phishing (risk score: {risk_score}/100) based on several suspicious characteristics in its structure and configuration."""
        else:
            if risk_score < 20:
                return f"""This URL appears to be safe (risk score: {risk_score}/100) with no concerning characteristics detected. It uses proper security protocols and has established trust indicators."""
                
            elif risk_score < 40:
                return f"""This URL seems to be legitimate (risk score: {risk_score}/100) as it has good security features including proper HTTPS implementation and established domain registration."""
                
            else:
                return f"""This URL appears to be legitimate but with some minor concerns (risk score: {risk_score}/100). While it has essential security features, there are some unusual aspects to its configuration."""
    
    def _generate_explanation_from_template(self, url: str, is_phishing: bool, risk_score: float, 
                                         features: List[str]) -> str:
        """Generate detailed explanation using templates"""
        features_list = "\n".join([f"- {feature}" for feature in features])
        
        if is_phishing:
            # Base template for phishing explanation
            explanation = f"""
# Why This URL Was Flagged as Potentially Phishing

## URL Analysis Results
The URL **{url}** has been analyzed and identified as potentially phishing with a **risk score of {risk_score}/100**.

## Detected Suspicious Characteristics
{features_list}

## What This Means
"""
            
            # Add explanations based on feature types
            if any("IP address" in feature for feature in features):
                explanation += """
### Suspicious IP Usage
Using an IP address (like 123.45.67.89) instead of a domain name is a major red flag. Legitimate services almost always use proper domain names. Phishers use raw IP addresses to:
- Avoid domain registration that could identify them
- Create temporary sites that are harder to track
- Hide the true nature of the site from users
"""
            
            if any("HTTPS" in feature and "Missing" in feature for feature in features):
                explanation += """
### Insecure Connection
The lack of HTTPS encryption means:
- Data transmitted to this site isn't encrypted
- Anyone on the same network could potentially intercept your information
- The site hasn't been validated by a certificate authority
"""
            
            if any("recently" in feature for feature in features):
                explanation += """
### Very New Domain
Recently registered domains are commonly used for phishing because:
- They haven't been blacklisted yet
- They're often discarded after a short phishing campaign
- There's no established reputation to evaluate
"""
            
            if any("suspicious" in feature and "domain" in feature for feature in features):
                explanation += """
### Suspicious Domain Structure
The domain has unusual characteristics that legitimate sites typically avoid, making it likely an attempt to confuse users or hide its true nature.
"""
            
            # Add standard conclusion for phishing
            explanation += """
## Potential Risks
If this is indeed a phishing site, interacting with it could lead to:
- Theft of login credentials
- Financial information compromise
- Installation of malware
- Identity theft

## Recommended Actions
- **Do not** enter any personal information
- **Do not** download files from this site
- **Close** the site and clear your browser cache
- If you've already entered information, change your passwords immediately
"""
            
            return explanation
            
        else:
            # Legitimate URL explanation
            explanation = f"""
# Why This URL Appears to be Legitimate

## URL Analysis Results
The URL **{url}** has been analyzed and appears to be legitimate with a **risk score of {risk_score}/100**.

## Security Characteristics
{features_list}

## What This Means
"""
            
            # Add explanations based on feature types
            if any("HTTPS" in feature and "secure" in feature for feature in features):
                explanation += """
### Secure Connection
This site uses proper HTTPS encryption, which means:
- Data transmitted between you and the site is encrypted
- The site has been validated by a certificate authority
- Your connection to the site is protected from eavesdropping
"""
            
            if any("year" in feature for feature in features):
                explanation += """
### Established Domain
This domain has been registered for a significant period of time, which is a positive indicator because:
- Phishing sites rarely maintain domains for extended periods
- Longevity suggests legitimate business operations
- The domain has had time to establish a reputation
"""
            
            if any("Google" in feature and "index" in feature for feature in features):
                explanation += """
### Indexed by Search Engines
The site is properly indexed by Google, suggesting:
- It's been established long enough to be crawled by search engines
- It's not trying to hide from search engine scrutiny
- It has content that search engines consider valuable
"""
            
            # Add standard conclusion for legitimate sites
            explanation += """
## Good Security Practices
Even on legitimate websites, it's good practice to:
- Use unique, strong passwords
- Be cautious about what personal information you share
- Keep your browser and security software updated
- Enable two-factor authentication when available

## How This Differs From Phishing Sites
Unlike phishing websites, legitimate sites typically:
- Use proper domain names rather than IP addresses
- Implement HTTPS encryption correctly
- Have longer registration histories
- Don't use excessive redirects or suspicious URL structures
"""
            
            return explanation
    
    def _generate_tips_from_template(self, is_phishing: bool) -> str:
        """Generate security tips based on whether the site is phishing or legitimate"""
        if is_phishing:
            return """
# Security Tips: Encountered a Phishing Website

## Immediate Actions to Take

* **Close the website immediately** without entering any information
* **Scan your device** with an up-to-date antivirus program
* **Clear your browser cache and cookies** to remove any tracking scripts
* **Report the phishing site** to Google Safe Browsing, Microsoft, or your browser's reporting tool
* **Change passwords** for any accounts if you've already entered credentials on the site

## Check If Your Information Is Compromised

* **Monitor your accounts** for suspicious activity
* **Check your bank and credit card statements** for unauthorized transactions
* **Consider credit monitoring services** if you shared sensitive information
* **Use haveibeenpwned.com** to check if your email was involved in data breaches

## Reporting Phishing Websites

* **Google:** Report at safebrowsing.google.com/safebrowsing/report_phish/
* **Microsoft:** Report at microsoft.com/en-us/wdsi/support/report-unsafe-site
* **Anti-Phishing Working Group:** Report at reportphishing.org
* **Federal Trade Commission:** Report at ftc.gov/complaint

## Spotting Future Phishing Attempts

* **Verify the URL** before entering any information
* **Look for HTTPS** and a padlock icon in the address bar
* **Be suspicious of urgent requests** for personal information
* **Check for poor grammar and spelling** which are common in phishing
* **Don't trust unsolicited emails** asking you to visit websites

## Protective Tools

* **Password managers** can help avoid auto-filling credentials on fake sites
* **Two-factor authentication** provides an extra layer of security
* **Anti-phishing browser extensions** can warn about suspicious sites
* **Email filtering services** can catch many phishing attempts before you see them
"""
        else:
            return """
# Security Tips: Safe Browsing Practices

## Verifying Website Legitimacy

* **Check the URL carefully** before entering sensitive information
* **Look for HTTPS** and a valid certificate (padlock icon)
* **Verify site ownership** through contact information and about pages
* **Search for the site** to see if it's well-established
* **Look for trust seals** from recognized security companies

## Password Management Best Practices

* **Use unique passwords** for each website and service
* **Create strong passwords** with at least 12 characters, including numbers, symbols, and mixed case
* **Consider using a password manager** to generate and store complex passwords
* **Change passwords periodically** for sensitive accounts like banking
* **Never share passwords** via email or messaging

## Keeping Your System Secure

* **Update your operating system** and applications regularly
* **Use up-to-date antivirus and anti-malware software**
* **Enable automatic updates** when available
* **Use a firewall** to monitor network traffic
* **Be cautious about browser extensions** and only install from official sources

## Recognizing When Legitimate Sites May Be Compromised

* **Unexpected certificate warnings** could indicate a problem
* **Unusual redirects** might suggest the site has been hacked
* **Strange popups or advertisements** could be signs of compromise
* **Unexpected login prompts** when you're already logged in
* **Performance issues** or new behaviors on familiar sites

## When to Be Extra Cautious

* **Financial transactions** should always warrant extra scrutiny
* **Government services** sites should be carefully verified
* **Healthcare portals** with personal medical information
* **Job application sites** where you share personal details
* **Any site requesting identification documents** deserves special verification
"""
    
    def _generate_learning_content_from_template(self, is_phishing: bool) -> str:
        """Generate educational content about phishing or website security"""
        if is_phishing:
            return """
# Understanding Phishing Attacks

## How Phishing Attacks Work

Phishing attacks are deceptive attempts to steal your personal information by impersonating trusted entities. The typical attack flow works like this:

1. **Creation:** Attackers create fake websites that mimic legitimate services
2. **Distribution:** They send emails, messages, or create ads with links to these fake sites
3. **Deception:** When you visit, the site appears legitimate to trick you into entering information
4. **Collection:** Any information you enter is captured by the attackers
5. **Exploitation:** Your information is then used for identity theft, fraud, or sold to other criminals

## Common Phishing Techniques

Modern phishing attacks use several sophisticated techniques:

* **Spear phishing:** Targeted attacks customized to specific individuals using personal information
* **Clone phishing:** Exact copies of legitimate emails with links replaced by malicious ones
* **Smishing:** SMS/text message phishing that tries to get you to click mobile links
* **Vishing:** Voice phishing using phone calls to trick people into revealing information
* **Search engine phishing:** Creating fake websites optimized to appear in search results

## Recent Trends in Phishing (2023-2024)

* **AI-generated content:** Using AI to create more convincing phishing messages without language errors
* **QR code phishing:** Using QR codes that direct to phishing sites
* **Multi-factor authentication bypass:** Tricks to get around 2FA/MFA protections
* **Brand impersonation:** Increasing focus on mimicking trusted brands like Microsoft, Google, and financial institutions
* **Shortened URLs:** Using URL shorteners to hide suspicious domain names

## Technologies Combating Phishing

The security industry is fighting back with several technologies:

* **Machine learning detection:** Algorithms that identify phishing patterns in real-time
* **Email authentication standards:** DMARC, SPF, and DKIM to verify email sender legitimacy
* **Browser-based protections:** Built-in safe browsing features in major browsers
* **Automated URL analysis:** Tools that scan links for malicious behavior before you visit
* **Real-time threat intelligence:** Shared databases of known phishing sites for faster blocking

Remember: Being aware and cautious is your best defense against phishing attacks. Always verify before you trust.
"""
        else:
            return """
# Understanding Website Security

## How Website Security Works

Website security is a multi-layered approach designed to protect both website owners and users:

1. **Authentication:** Verifying the identity of users through secure login systems
2. **Encryption:** Protecting data transmission using HTTPS/TLS protocols
3. **Access control:** Limiting what users can access based on their permissions
4. **Data validation:** Checking all inputs to prevent malicious code injection
5. **Regular updates:** Patching security vulnerabilities as they're discovered

## How Legitimate Websites Establish Trust

Trustworthy websites implement several visible and invisible security measures:

* **SSL/TLS certificates:** The padlock icon and HTTPS in your browser
* **Privacy policies:** Clear explanations of how user data is collected and used
* **Secure payment processing:** Using established payment gateways and security standards
* **Recognizable branding:** Consistent design that matches across all channels
* **Transparent contact information:** Visible addresses, phone numbers, and support options

## Recent Trends in Web Security (2023-2024)

* **Zero Trust architecture:** Assuming no user or system is trusted by default
* **Widespread HTTPS adoption:** Nearly all legitimate websites now use encryption
* **Privacy-focused design:** Responding to regulations like GDPR and user concerns
* **Passwordless authentication:** Moving toward biometrics and security keys
* **Content Security Policies:** Controlling what resources a browser can load

## Technologies Improving Security

The web is becoming safer through several technological advances:

* **Extended Validation Certificates:** Providing stronger identity verification
* **Web Application Firewalls:** Filtering malicious traffic before it reaches websites
* **Automatic vulnerability scanning:** Identifying security issues before they're exploited
* **HTTPS Strict Transport Security (HSTS):** Ensuring connections remain secure
* **Browser security headers:** Preventing common attack vectors like cross-site scripting

A secure website isn't just about protecting the site owner — it's about creating a safe environment for all users to browse, shop, and share information confidently.
"""
    
    def _extract_notable_features(self, analysis: Dict[str, Any]) -> List[str]:
        """Extract notable features from analysis results for educational content"""
        notable_features = []
        
        try:
            # Check if ml_result exists in analysis
            if "ml_result" not in analysis:
                # Try to get features directly from the analysis
                features = analysis.get("features", {})
            else:
                # Get features from ml_result
                features = analysis.get("ml_result", {}).get("features", {})
            
            # Suspicious URL characteristics
            if features.get("domain_in_ip", 0) == 1:
                notable_features.append("Uses an IP address instead of a domain name")
                
            if features.get("tls_ssl_certificate", 0) == 0:
                notable_features.append("Missing secure HTTPS connection")
            else:
                notable_features.append("Uses secure HTTPS connection")
            
            if features.get("url_google_index", 0) == 0:
                notable_features.append("Not indexed by Google")
            else:
                notable_features.append("Indexed by Google search")
            
            # Domain age
            if "time_domain_activation" in features:
                domain_age = features.get("time_domain_activation", 0)
                if domain_age < 30:
                    notable_features.append("Domain registered very recently (less than 30 days old)")
                elif domain_age < 180:
                    notable_features.append("Domain registered within the last 6 months")
                elif domain_age > 365:
                    notable_features.append("Domain has been registered for over a year")
            
            # URL structure
            if features.get("length_url", 0) > 100:
                notable_features.append("Unusually long URL")
                
            if features.get("qty_dot_url", 0) > 3:
                notable_features.append("Contains many dots in the URL")
                
            if features.get("qty_hyphen_url", 0) > 2:
                notable_features.append("Contains multiple hyphens in the URL")
                
            if features.get("qty_at_url", 0) > 0:
                notable_features.append("Contains @ symbol in the URL")
                
            if features.get("qty_dot_domain", 0) > 3:
                notable_features.append("Uses an excessive number of subdomains")
                
            if features.get("qty_redirects", 0) > 1:
                notable_features.append("Contains multiple redirects")
                
            # Domain characteristics
            if features.get("server_client_domain", 0) == 1:
                notable_features.append("Different domains for server and client")
                
            if features.get("shortening_service", 0) == 1:
                notable_features.append("Uses a URL shortening service")
                
            if features.get("suspicious_tld", 0) == 1:
                notable_features.append("Uses a suspicious top-level domain")
                
            if features.get("prefix_suffix", 0) == 1:
                notable_features.append("Uses hyphens as prefix or suffix in domain")
                
            if features.get("random_domain", 0) == 1:
                notable_features.append("Domain name appears to be randomly generated")
                
            # Content indicators
            if features.get("phishing_terms", 0) == 1:
                notable_features.append("Contains common phishing terms in the URL")
                
            if features.get("brand_in_subdomain", 0) == 1:
                notable_features.append("Contains a brand name in the subdomain (possible impersonation)")
                
            if features.get("brand_in_path", 0) == 1:
                notable_features.append("Contains a brand name in the URL path (possible impersonation)")
                
            # Trust indicators
            if features.get("domain_age_trusted", 0) == 1:
                notable_features.append("Domain age is within trusted range")
                
            if features.get("dns_record", 0) == 0:
                notable_features.append("Missing DNS records")
            else:
                notable_features.append("Has proper DNS records")
                
            if features.get("abnormal_url", 0) == 1:
                notable_features.append("URL structure is abnormal")
                
            # Additional indicators that might be in your feature set
            if features.get("favicon", 0) == 0:
                notable_features.append("Missing favicon")
                
            if features.get("port", 0) == 1:
                notable_features.append("Uses uncommon port number")
                
            if features.get("https_token", 0) == 1:
                notable_features.append("HTTPS token in domain part")
                
            if features.get("request_url", 0) == 1:
                notable_features.append("Requests resources from external domains")
                
            if features.get("url_of_anchor", 0) == 1:
                notable_features.append("Anchor links point to external domains")
                
            if features.get("sfh", 0) == 1:
                notable_features.append("Server form handler is suspicious")
                
            if features.get("submitting_to_email", 0) == 1:
                notable_features.append("Form submits information to email")
                
            if features.get("iframe", 0) == 1:
                notable_features.append("Uses invisible iframe")
                
            if features.get("right_click", 0) == 1:
                notable_features.append("Disables right-click")
                
            if features.get("popup_window", 0) == 1:
                notable_features.append("Uses popup windows")
                
            if features.get("forwarding", 0) == 1:
                notable_features.append("Uses multiple redirects")
                
        except Exception as e:
            print(f"Error extracting features: {str(e)}")
            
        return notable_features