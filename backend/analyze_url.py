import sys
import json
import os

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.feature_extractor import extract_features, calculate_risk_score

def analyze_url(url):
    features = extract_features(url, debug=False)
    if not features:
        return {
            "error": "Could not analyze URL",
            "risk_score": 100,
            "is_phishing": True
        }
    
    risk_score = calculate_risk_score(features, debug=False)
    is_phishing = risk_score > 60
    
    return {
        "risk_score": risk_score,
        "is_phishing": is_phishing,
        "risk_level": get_risk_level(risk_score),
        "features": features
    }

def get_risk_level(score):
    if score <= 20: return "Very Safe"
    elif score <= 40: return "Safe"
    elif score <= 60: return "Suspicious"
    elif score <= 80: return "High Risk"
    else: return "Very High Risk"

def main():
    if len(sys.argv) > 1:
        url = sys.argv[1]
        try:
            result = analyze_url(url)
            print(json.dumps(result, indent=2))
        except Exception as e:
            error_result = {
                "error": str(e),
                "risk_score": 100,
                "is_phishing": True
            }
            print(json.dumps(error_result, indent=2))
    else:
        print(json.dumps({"error": "No URL provided"}, indent=2))

if __name__ == "__main__":
    main()