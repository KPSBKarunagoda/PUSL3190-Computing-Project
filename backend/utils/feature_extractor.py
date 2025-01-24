import tldextract
from urllib.parse import urlparse
import dns.resolver
from datetime import datetime
import socket
import whois
import requests

def extract_features(url, debug=True):
    try:
        parsed = urlparse(url)
        extract = tldextract.extract(url)
        domain = f"{extract.domain}.{extract.suffix}"
        
        if debug:
            print(f"\nAnalyzing URL: {url}")
            print(f"Domain: {domain}")
        
        features = {
            "Have_IP": 1 if all(part.isdigit() for part in domain.split('.')) else 0,
            "Have_At": 1 if "@" in url else 0,
            "URL_Length": 1 if len(url) > 54 else 0,
            "URL_Depth": min(len([x for x in parsed.path.split('/') if x]), 10),
            "Redirection": 0,
            "https_Domain": 1 if parsed.scheme == 'https' else 0,
            "TinyURL": 1 if len(domain) < 7 else 0,
            "Prefix/Suffix": 1 if '-' in domain else 0,
            "DNS_Record": 0,
            "Web_Traffic": 0,
            "Domain_Age": 0,
            "Domain_End": 0,
            "iFrame": 0,
            "Mouse_Over": 0,
            "Right_Click": 0,
            "Web_Forwards": 0
        }

        # DNS and Traffic Check
        try:
            dns.resolver.resolve(domain)
            features["DNS_Record"] = 1
            start = datetime.now()
            socket.gethostbyname(domain)
            resolution_time = (datetime.now() - start).total_seconds()
            features["Web_Traffic"] = 1 if resolution_time < 0.1 else 0
        except:
            features["DNS_Record"] = 0
            features["Web_Traffic"] = 0

        # Domain Age Check
        try:
            w = whois.whois(domain)
            if w.creation_date:
                age = (datetime.now() - (w.creation_date[0] if isinstance(w.creation_date, list) 
                       else w.creation_date)).days
                features["Domain_Age"] = 1 if age > 180 else 0
            
            if w.expiration_date:
                exp = (w.expiration_date[0] if isinstance(w.expiration_date, list) 
                      else w.expiration_date)
                features["Domain_End"] = 1 if (exp - datetime.now()).days > 90 else 0
        except:
            features["Domain_Age"] = 0
            features["Domain_End"] = 0

        # Content Analysis
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(url, headers=headers, timeout=5, allow_redirects=True)
            html = response.text.lower()
            
            features["iFrame"] = 1 if '<iframe' in html else 0
            features["Mouse_Over"] = 1 if 'onmouseover=' in html else 0
            
            right_click_patterns = [
                'oncontextmenu="return false"',
                'addEventListener("contextmenu"',
                'preventDefault()',
                'contextmenu: false'
            ]
            features["Right_Click"] = 1 if any(pattern in html for pattern in right_click_patterns) else 0
            
            redirect_patterns = [
                '<meta http-equiv="refresh"',
                'window.location.href',
                'document.location.href'
            ]
            features["Redirection"] = 1 if (
                any(pattern in html for pattern in redirect_patterns) or 
                len(response.history) > 0
            ) else 0
            
            features["Web_Forwards"] = len(response.history)
            
        except:
            features["iFrame"] = 0
            features["Mouse_Over"] = 0
            features["Right_Click"] = 0
            features["Redirection"] = 0
            features["Web_Forwards"] = 0

        if debug:
            for key, value in features.items():
                print(f"{key}: {value}")
        
        return features
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return None

def calculate_risk_score(features, debug=True):
    if not features:
        return 100
        
    weights = {
        "Have_IP": 15,
        "Have_At": 15,
        "URL_Length": 10,
        "URL_Depth": 5,
        "Redirection": 0,    # Updated weight
        "https_Domain": -15,
        "TinyURL": 10,
        "Prefix/Suffix": 10,
        "DNS_Record": -10,
        "Web_Traffic": -10,
        "Domain_Age": -10,
        "Domain_End": -10,
        "iFrame": 8,          # Updated weight
        "Mouse_Over": 8,      # Updated weight
        "Right_Click": 8,     # Updated weight
        "Web_Forwards": 8     # Updated weight
    }
    
    base_score = 50
    total_score = base_score
    
    if debug:
        print("\nRisk Score Calculation:")
        print(f"Starting score: {base_score}")
    
    for feature, weight in weights.items():
        contribution = features[feature] * weight
        total_score += contribution
        
        if debug:
            print(f"{feature}: {features[feature]} * {weight} = {contribution}")
    
    final_score = max(0, min(100, total_score))
    
    if debug:
        print(f"Final risk score: {final_score}")
    
    return int(final_score)