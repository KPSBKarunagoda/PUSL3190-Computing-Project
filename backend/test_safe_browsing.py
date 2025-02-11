import sys
import json
import os
import pandas as pd
from joblib import load
from typing import Dict, Any, Optional
from utils.feature_extractor import URLFeatureExtractor
from services.safe_browsing import SafeBrowsingService

class URLAnalyzer:
    def __init__(self):
        self.feature_extractor = URLFeatureExtractor()
        self.safe_browsing = SafeBrowsingService()
        self.model = None
        self.scaler = None
        self.feature_names = None
        self._load_model()
        self._initialize_weights()

    def _load_model(self):
        """Load ML model and related components"""
        try:
            current_dir = os.path.dirname(__file__)
            model_path = os.path.join(current_dir, 'machine learning', 'url_model_v4.pkl')
            scaler_path = os.path.join(current_dir, 'machine learning', 'scaler_v4.pkl')
            feature_names_path = os.path.join(current_dir, 'machine learning', 'feature_names.pkl')
            
            self.model = load(model_path)
            self.scaler = load(scaler_path)
            self.feature_names = load(feature_names_path)
            print("Model loaded successfully", file=sys.stderr)
        except Exception as e:
            print(f"Error loading model: {str(e)}", file=sys.stderr)
            self.model = None
            self.scaler = None
            self.feature_names = None

    def _initialize_weights(self):
        """Initialize feature weights for risk scoring"""
        self.weights = {
            'qty_dot_url': 0.05,
            'qty_hyphen_url': 0.05,
            'length_url': 0.1,
            'qty_at_url': 0.1,
            'domain_in_ip': 0.15,
            'tls_ssl_certificate': -0.15,
            'url_google_index': -0.1,
            'qty_redirects': 0.1,
            'time_domain_activation': -0.1,
            'qty_ip_resolved': -0.05
        }

    def calculate_risk_score(self, features: Dict[str, Any]) -> float:
        """Calculate risk score based on weighted features"""
        risk_score = 50  # Base score
        
        for feature, weight in self.weights.items():
            if feature in features:
                value = features[feature]
                if isinstance(value, bool):
                    value = 1 if value else 0
                risk_score += value * weight
        
        return max(0, min(100, risk_score))

    def _ml_analysis(self, features: Dict[str, Any], use_safe_browsing: bool = False) -> Dict[str, Any]:
        """Perform ML-based analysis"""
        try:
            # Calculate basic risk score
            risk_score = self.calculate_risk_score(features)
            print(f"\nBase Risk Score: {risk_score}", file=sys.stderr)

            if self.model and self.scaler and self.feature_names:
                # Prepare feature vector in correct order
                feature_vector = []
                print("\n=== Feature Values ===", file=sys.stderr)
                for feature in self.feature_names:
                    value = features.get(feature, 0)
                    feature_vector.append(value)
                    print(f"{feature}: {value}", file=sys.stderr)

                # Scale features
                features_scaled = self.scaler.transform([feature_vector])
                
                # Get prediction
                ml_prediction = self.model.predict(features_scaled)[0]
                ml_probability = self.model.predict_proba(features_scaled)[0]
                ml_confidence = float(max(ml_probability))
                
                print(f"\n=== ML Model Results ===", file=sys.stderr)
                print(f"Raw Prediction: {ml_prediction}", file=sys.stderr)
                print(f"Probabilities: Safe={ml_probability[0]:.2f}, Phishing={ml_probability[1]:.2f}", file=sys.stderr)
                print(f"Confidence: {ml_confidence:.2f}", file=sys.stderr)

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
                print(f"Is Phishing: {is_phishing}", file=sys.stderr)
                print("=" * 25 + "\n", file=sys.stderr)

                return {
                    "risk_score": risk_score,
                    "is_phishing": is_phishing,
                    "ml_prediction": int(ml_prediction),
                    "ml_confidence": ml_confidence,
                    "features": features,
                    "ml_used": True,
                    "safe_browsing": False,
                    "safe_browsing_enabled": use_safe_browsing,
                    "message": "Phishing detected" if is_phishing else "Safe - ML Analysis"
                }
            else:
                is_phishing = risk_score > 60
                return {
                    "risk_score": risk_score,
                    "is_phishing": is_phishing,
                    "ml_prediction": 1 if is_phishing else 0,
                    "ml_confidence": 0.0,
                    "features": features,
                    "ml_used": False,
                    "safe_browsing": False,
                    "safe_browsing_enabled": use_safe_browsing,
                    "message": "Analysis based on risk score (ML model unavailable)"
                }
        except Exception as e:
            raise Exception(f"ML analysis failed: {str(e)}")

    async def analyze_url(self, url: str, use_safe_browsing: bool = True) -> Dict[str, Any]:
        """Analyze URL using ML model and optionally Safe Browsing API"""
        try:
            print(f"\n=== Starting URL Analysis ===", file=sys.stderr)
            print(f"URL: {url}", file=sys.stderr)
            print(f"Safe Browsing Enabled: {use_safe_browsing}", file=sys.stderr)
            
            # Extract features first
            features = self.feature_extractor.extract_features(url)
            if features is None:
                raise Exception("Failed to extract features")

            # If Safe Browsing is enabled, only use Safe Browsing results
            if use_safe_browsing:
                try:
                    print("\nChecking Google Safe Browsing API...", file=sys.stderr)
                    sb_result = await self.safe_browsing.check_url(url)
                    print(f"Safe Browsing Result: {sb_result}", file=sys.stderr)
                    
                    # Check if there are any threats in the result
                    has_threats = bool(sb_result.get("threats"))
                    is_safe = not has_threats
                    
                    # Always return Safe Browsing result when enabled
                    return {
                        "risk_score": 100 if has_threats else 0,
                        "is_phishing": has_threats,
                        "ml_used": False,
                        "safe_browsing": True,
                        "safe_browsing_enabled": True,
                        "features": features,
                        "threats": sb_result.get("threats"),
                        "message": (
                            f"Warning - {sb_result.get('threats')[0].get('threat_type')} detected by Google Safe Browsing"
                            if has_threats
                            else "Safe - Verified by Google Safe Browsing"
                        )
                    }
                except Exception as sb_error:
                    print(f"Safe Browsing API error: {str(sb_error)}", file=sys.stderr)
                    return {
                        "error": str(sb_error),
                        "risk_score": 100,
                        "is_phishing": True,
                        "ml_used": False,
                        "safe_browsing": True,
                        "safe_browsing_enabled": True,
                        "message": f"Safe Browsing API Error: {str(sb_error)}"
                    }

            # Only perform ML analysis if Safe Browsing is disabled
            print("\nPerforming ML Analysis...", file=sys.stderr)
            return self._ml_analysis(features, use_safe_browsing)

        except Exception as e:
            error_msg = str(e)
            print(f"Error analyzing URL: {error_msg}", file=sys.stderr)
            return {
                "error": error_msg,
                "risk_score": 100,
                "is_phishing": True,
                "ml_used": False,
                "safe_browsing": use_safe_browsing,
                "safe_browsing_enabled": use_safe_browsing,
                "message": f"Error during analysis: {error_msg}"
            }

def main():
    """CLI entry point"""
    if len(sys.argv) > 2:
        analyzer = URLAnalyzer()
        url = sys.argv[1]
        use_safe_browsing = sys.argv[2].lower() == 'true'
        print(f"CLI args: url={url}, safe_browsing={use_safe_browsing}", file=sys.stderr)
        import asyncio
        result = asyncio.run(analyzer.analyze_url(url, use_safe_browsing))
        print(json.dumps(result, indent=2))
    else:
        print(json.dumps({"error": "Missing arguments"}))

if __name__ == "__main__":
    main()