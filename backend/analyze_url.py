import sys
import json
import os
import pandas as pd
from joblib import load
from utils.feature_extractor import extract_features, calculate_risk_score

# Load ML model silently
try:
    model_path = os.path.join(os.path.dirname(__file__), 'machine learning', 'url_model_v1.pkl')
    model = load(model_path)
except Exception as e:
    model = None

def analyze_url(url):
    try:
        features = extract_features(url, debug=False)
        
        # Calculate risk score
        risk_score = calculate_risk_score(features, debug=False)
        
        # ML prediction with detailed debug
        if model is not None:
            features_df = pd.DataFrame([features])
            ml_prediction = model.predict(features_df)[0]
            ml_probability = model.predict_proba(features_df)[0]
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