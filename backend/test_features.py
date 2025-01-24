from utils.feature_extractor import extract_features, calculate_risk_score

def test_url_features(url):
    print(f"\nTesting URL: {url}")
    print("=" * 50)
    
    # Extract features
    features = extract_features(url, debug=True)
    
    if features:
        # Calculate risk score
        risk_score = calculate_risk_score(features, debug=True)
        print(f"\nRisk Score: {risk_score}/100")

def main():
    # Test URLs
    test_urls = [
        "https://www.google.com",  # Legitimate site
        "http://tiny.cc/test",     # Short URL
        "https://example.com/login@fake.com",  # URL with @
        "https://192.168.1.1/admin",  # IP-based URL
        "https://facebook.com-login.tk"  # Suspicious domain
    ]
    
    for url in test_urls:
        test_url_features(url)

if __name__ == "__main__":
    main()