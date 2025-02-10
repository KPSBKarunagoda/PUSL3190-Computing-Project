import sys
import json
import os
import pandas as pd
from joblib import load
from utils.feature_extractor import URLFeatureExtractor

# Load ML model and feature names
try:
    current_dir = os.path.dirname(__file__)
    model_path = os.path.join(current_dir, 'machine learning', 'url_model_v4.pkl')
    scaler_path = os.path.join(current_dir, 'machine learning', 'scaler_v4.pkl')
    feature_names_path = os.path.join(current_dir, 'machine learning', 'feature_names.pkl')
    
    model = load(model_path)
    scaler = load(scaler_path)
    feature_names = load(feature_names_path)
    
    print("Model loaded successfully", file=sys.stderr)
except Exception as e:
    print(f"Error loading model: {str(e)}", file=sys.stderr)
    model = None
    scaler = None
    feature_names = None

def calculate_risk_score(features):
    """Calculate risk score based on important features"""
    weights = {
        'qty_dot_url': 0.05,
        'qty_hyphen_url': 0.05,
        'length_url': 0.1,
        'qty_at_url': 0.1,
        'domain_in_ip': 0.15,
        'tls_ssl_certificate': -0.15,  # Negative weight as it's a good signal
        'url_google_index': -0.1,      # Negative weight as it's a good signal
        'qty_redirects': 0.1,
        'time_domain_activation': -0.1, # Negative weight as older domains are trusted
        'qty_ip_resolved': -0.05       # Negative weight as multiple IPs can be legitimate
    }
    
    risk_score = 50  # Base score
    
    for feature, weight in weights.items():
        if feature in features:
            value = features[feature]
            if isinstance(value, bool):
                value = 1 if value else 0
            risk_score += value * weight
    
    return max(0, min(100, risk_score))

def analyze_url(url):
    try:
        # Extract features using the new feature extractor
        extractor = URLFeatureExtractor()
        features = extractor.extract_features(url)
        
        if features is None:
            raise Exception("Failed to extract features")
        
        # Calculate risk score
        risk_score = calculate_risk_score(features)
        
        # ML prediction with detailed debug
        if model is not None and scaler is not None:
            # Prepare features in correct order
            feature_vector = []
            for feature in feature_names:
                feature_vector.append(features.get(feature, 0))
            
            # Scale features
            features_scaled = scaler.transform([feature_vector])
            
            # Get prediction
            ml_prediction = model.predict(features_scaled)[0]
            ml_probability = model.predict_proba(features_scaled)[0]
            ml_confidence = float(max(ml_probability))
            
            # Debug ML output
            print(f"\n=== ML Debug ===", file=sys.stderr)
            print(f"Raw ML Prediction: {ml_prediction}", file=sys.stderr)
            print(f"Probabilities: Legitimate: {ml_probability[0]:.2%}, Phishing: {ml_probability[1]:.2%}", file=sys.stderr)
            print(f"Confidence: {ml_confidence:.2%}", file=sys.stderr)
            
            # Refined decision logic
            is_phishing = False
            if risk_score > 80:  # Very high risk
                is_phishing = True
            elif risk_score > 60:  # High risk
                is_phishing = ml_confidence > 0.8
            else:  # Lower risk
                is_phishing = ml_prediction == 1 and ml_confidence > 0.9
            
            print(f"\n=== Final Decision ===", file=sys.stderr)
            print(f"Risk Score: {risk_score}", file=sys.stderr)
            print(f"ML Confidence: {ml_confidence:.2%}", file=sys.stderr)
            print(f"Decision: {'Phishing' if is_phishing else 'Legitimate'}", file=sys.stderr)
            
        else:
            ml_prediction = 1 if risk_score > 60 else 0
            ml_confidence = 0.0
            is_phishing = risk_score > 60

        # Print debug info to stderr
        print(f"\nAnalyzing URL: {url}", file=sys.stderr)
        print("=== Feature Analysis ===", file=sys.stderr)
        for key, value in features.items():
            print(f"{key}: {value}", file=sys.stderr)
        print(f"\nRisk Score: {risk_score}", file=sys.stderr)
        print(f"ML Prediction: {'Phishing' if is_phishing else 'Legitimate'}", file=sys.stderr)
        print(f"ML Confidence: {ml_confidence:.2%}", file=sys.stderr)

        # Print JSON result to stdout
        print(json.dumps({
            "risk_score": risk_score,
            "is_phishing": is_phishing,
            "ml_prediction": int(ml_prediction),
            "ml_confidence": ml_confidence,
            "features": features
        }))

    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "risk_score": 100,
            "is_phishing": True
        }))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        analyze_url(sys.argv[1])
    else:
        print(json.dumps({"error": "No URL provided"}))