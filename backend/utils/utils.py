import tldextract
from urllib.parse import urlparse
import dns.resolver
from datetime import datetime
import requests
import socket
import whois

def debug_feature_extraction(url):
    """Detailed feature extraction with logging"""
    try:
        parsed = urlparse(url)
        extract = tldextract.extract(url)
        domain = f"{extract.domain}.{extract.suffix}"
        
        print(f"\nDetailed Feature Extraction for: {url}")
        print(f"Domain: {domain}")
        
        features = {}
        
        # Have_IP
        is_ip = all(part.isdigit() and int(part) >= 0 and int(part) <= 255 
                   for part in domain.split('.'))
        features["Have_IP"] = 1 if is_ip else 0
        print(f"Have_IP: {features['Have_IP']} (Domain contains IP: {is_ip})")
        
        # Have_At
        features["Have_At"] = 1 if "@" in url else 0
        print(f"Have_At: {features['Have_At']} (@ symbol present: {'@' in url})")
        
        # URL_Length
        features["URL_Length"] = 1 if len(url) > 54 else 0
        print(f"URL_Length: {features['URL_Length']} (Length: {len(url)})")
        
        # URL_Depth
        depth = len([x for x in parsed.path.split('/') if x])
        features["URL_Depth"] = depth
        print(f"URL_Depth: {depth} (Path: {parsed.path})")
        
        # Redirection
        features["Redirection"] = 1 if url.count('//') > 1 else 0
        print(f"Redirection: {features['Redirection']} (// count: {url.count('//')})")
        
        # https_Domain
        features["https_Domain"] = 1 if parsed.scheme == 'https' else 0
        print(f"https_Domain: {features['https_Domain']} (Scheme: {parsed.scheme})")
        
        # TinyURL
        features["TinyURL"] = 1 if len(domain) < 7 else 0
        print(f"TinyURL: {features['TinyURL']} (Domain length: {len(domain)})")
        
        # Prefix/Suffix
        features["Prefix/Suffix"] = 1 if '-' in domain else 0
        print(f"Prefix/Suffix: {features['Prefix/Suffix']} (Hyphens: {'-' in domain})")
        
        try:
            # DNS_Record
            dns.resolver.resolve(domain)
            features["DNS_Record"] = 1
        except:
            features["DNS_Record"] = 0
        print(f"DNS_Record: {features['DNS_Record']}")
        
        try:
            # Web_Traffic (Based on DNS resolution time as proxy)
            start = datetime.now()
            socket.gethostbyname(domain)
            resolution_time = (datetime.now() - start).total_seconds()
            features["Web_Traffic"] = 1 if resolution_time < 0.1 else 0
        except:
            features["Web_Traffic"] = 0
        print(f"Web_Traffic: {features['Web_Traffic']}")
        
        try:
            # Domain_Age & Domain_End
            w = whois.whois(domain)
            if w.creation_date:
                age = (datetime.now() - (w.creation_date[0] if isinstance(w.creation_date, list) 
                       else w.creation_date)).days
                features["Domain_Age"] = 1 if age > 180 else 0
            else:
                features["Domain_Age"] = 0
                
            if w.expiration_date:
                exp = (w.expiration_date[0] if isinstance(w.expiration_date, list) 
                      else w.expiration_date)
                features["Domain_End"] = 1 if (exp - datetime.now()).days > 90 else 0
            else:
                features["Domain_End"] = 0
        except:
            features["Domain_Age"] = 0
            features["Domain_End"] = 0
        print(f"Domain_Age: {features['Domain_Age']}")
        print(f"Domain_End: {features['Domain_End']}")
        
        try:
            # Content-based features
            response = requests.get(url, timeout=5)
            html = response.text.lower()
            features["iFrame"] = 1 if '<iframe' in html else 0
            features["Mouse_Over"] = 1 if 'onmouseover=' in html else 0
            features["Right_Click"] = 1 if 'preventdefault' in html or 'contextmenu' in html else 0
            features["Web_Forwards"] = 1 if len(response.history) > 1 else 0
        except:
            features["iFrame"] = 0
            features["Mouse_Over"] = 0
            features["Right_Click"] = 0
            features["Web_Forwards"] = 0
        
        print(f"iFrame: {features['iFrame']}")
        print(f"Mouse_Over: {features['Mouse_Over']}")
        print(f"Right_Click: {features['Right_Click']}")
        print(f"Web_Forwards: {features['Web_Forwards']}")
        
        return features
        
    except Exception as e:
        print(f"Error during feature extraction: {str(e)}")
        return None

# Update test_model.py to use debug_feature_extraction