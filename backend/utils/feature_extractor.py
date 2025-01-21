import tldextract
from urllib.parse import urlparse
import dns.resolver

def extract_features(url, debug=True):
    try:
        parsed = urlparse(url)
        extract = tldextract.extract(url)
        domain = f"{extract.domain}.{extract.suffix}"
        
        if debug:
            print(f"\nAnalyzing URL: {url}")
            print(f"Domain: {domain}")
        
        # Include all original features
        features = {
            "Have_IP": 1 if all(part.isdigit() for part in domain.split('.')) else 0,
            "Have_At": 1 if "@" in url else 0,
            "URL_Length": 1 if len(url) > 54 else 0,
            "URL_Depth": min(len([x for x in parsed.path.split('/') if x]), 10),
            "Redirection": 0,  # Set to 0 as we're not analyzing content
            "https_Domain": 1 if parsed.scheme == 'https' else 0,
            "TinyURL": 1 if len(domain) < 7 else 0,
            "Prefix/Suffix": 1 if '-' in domain else 0,
            "DNS_Record": 0,
            "Web_Traffic": 0,
            "Domain_Age": 0,
            "Domain_End": 0,
            "iFrame": 0,       # Set to 0 as we're not analyzing content
            "Mouse_Over": 0,   # Set to 0 as we're not analyzing content
            "Right_Click": 0,  # Set to 0 as we're not analyzing content
            "Web_Forwards": 0  # Set to 0 as we're not analyzing content
        }
        
        # DNS verification
        try:
            dns.resolver.resolve(domain)
            features["DNS_Record"] = 1
            features["Web_Traffic"] = 1
            features["Domain_Age"] = 1
            features["Domain_End"] = 1
        except:
            pass
            
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
        "Redirection": 0,     # Zero weight
        "https_Domain": -15,
        "TinyURL": 10,
        "Prefix/Suffix": 10,
        "DNS_Record": -10,
        "Web_Traffic": -10,
        "Domain_Age": -10,
        "Domain_End": -10,
        "iFrame": 0,          # Zero weight
        "Mouse_Over": 0,      # Zero weight
        "Right_Click": 0,     # Zero weight
        "Web_Forwards": 0     # Zero weight
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