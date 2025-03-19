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
            scaler_path = os.path.join(current_dir, 'machine learning',  'scaler_v4.pkl')
            feature_names_path = os.path.join(current_dir, 'machine learning', 'dataset', 'feature_names.pkl')
            
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
            'domain_in_ip': 0.35,         # Significantly increased weight for IP addresses 
            'tls_ssl_certificate': -0.15,
            'url_google_index': -0.1,
            'qty_redirects': 0.1,
            'time_domain_activation': -0.1,
            'qty_ip_resolved': -0.05
        }

    def _ml_analysis(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Perform ML-based analysis"""
        try:
            if self.model and self.scaler and self.feature_names:
                # Check explicitly for IP address in URL
                url = features.get('_url', '')
                
                # Check for IP address pattern in domain using regex
                import re
                ip_pattern = re.compile(r'^https?://\d+\.\d+\.\d+\.\d+')
                is_ip_based = bool(ip_pattern.match(url)) if url else False
                
                # Override the feature if we detect an IP
                if is_ip_based and not features.get('domain_in_ip', 0):
                    print("IP address detected in URL but not in features - fixing", file=sys.stderr)
                    features['domain_in_ip'] = 1
                
                # Calculate risk score
                risk_score = self.calculate_risk_score(features)
                
                # IP address override - increase risk score
                if is_ip_based:
                    print("IP-based URL detected - applying risk bonus", file=sys.stderr)
                    risk_score += 25  # Add significant risk for IP-based URLs
                
                # Prepare feature vector in correct order
                feature_vector = []
                print("\n=== Feature Analysis ===", file=sys.stderr)
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
                
                # Debug ML output
                print(f"\n=== ML Debug ===", file=sys.stderr)
                print(f"Raw ML Prediction: {ml_prediction}", file=sys.stderr)
                print(f"Probabilities: Legitimate: {ml_probability[0]:.2%}, Phishing: {ml_probability[1]:.2%}", file=sys.stderr)
                print(f"Confidence: {ml_confidence:.2%}", file=sys.stderr)
                
                # Refined decision logic from working version
                is_phishing = False
                if risk_score > 80:  # Very high risk
                    is_phishing = True
                elif risk_score > 60:  # High risk
                    is_phishing = ml_confidence > 0.8
                else:  # Lower risk
                    is_phishing = ml_prediction == 1 and ml_confidence > 0.9
                
                print(f"\n=== Final Decision ===", file=sys.stderr)
                result = {
                    "risk_score": risk_score,
                    "ml_confidence": ml_confidence,
                    "is_phishing": is_phishing,
                    "decision": "Phishing" if is_phishing else "Legitimate",
                    "risk_explanation": "This site appears to be legitimate based on our analysis." if not is_phishing else "This site appears to be phishing based on our analysis."
                }
                print("=" * 25 + "\n", file=sys.stderr)

                return {
                    "risk_score": risk_score,
                    "is_phishing": is_phishing,
                    "ml_prediction": int(ml_prediction),
                    "ml_confidence": ml_confidence,
                    "features": features,
                    "safe_probability": float(ml_probability[0]),
                    "phishing_probability": float(ml_probability[1])
                }
            else:
                # Fallback to basic risk scoring if ML model is unavailable
                risk_score = self.calculate_risk_score(features)
                is_phishing = risk_score > 60
                return {
                    "risk_score": risk_score,
                    "is_phishing": is_phishing,
                    "ml_prediction": 1 if is_phishing else 0,
                    "ml_confidence": 0.0,
                    "features": features
                }
        except Exception as e:
            raise Exception(f"ML analysis failed: {str(e)}")

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

    async def analyze_url(self, url: str, use_safe_browsing: bool = True) -> Dict[str, Any]:
        """Two-step URL analysis using Safe Browsing and ML"""
        try:
            print(f"\n=== Starting Two-Step URL Analysis ===", file=sys.stderr)
            print(f"URL: {url}", file=sys.stderr)
            print(f"Using Safe Browsing API: {use_safe_browsing}", file=sys.stderr)
            
            # Extract features
            features = self.feature_extractor.extract_features(url)
            if features is None:
                raise Exception("Failed to extract features")
                
            # Add raw URL to features for pattern analysis
            features['_url'] = url
            
            # Step 1: Check Safe Browsing API if enabled
            sb_result = {"threats": [], "is_safe": True}
            if use_safe_browsing:
                print("\nStep 1: Checking Google Safe Browsing...", file=sys.stderr)
                sb_result = await self.safe_browsing.check_url(url)
                has_threats = bool(sb_result.get("threats"))
                
                if has_threats:
                    return {
                        "risk_score": 100,
                        "is_phishing": True,
                        "source": "Safe Browsing API",
                        "threats": sb_result.get("threats"),
                        "message": f"Warning - {sb_result.get('threats')[0].get('threat_type')} detected by Google Safe Browsing"
                    }
            else:
                print("\nStep 1: Safe Browsing check skipped", file=sys.stderr)

            # Step 2: ML Analysis
            print("\nStep 2: Performing ML Analysis...", file=sys.stderr)
            ml_result = self._ml_analysis(features)
            
            if ml_result is None:
                return {
                    "error": "ML analysis failed",
                    "risk_score": 100,
                    "is_phishing": True
                }

            # Ensure boolean values are properly handled
            is_phishing = bool(ml_result["is_phishing"])
            risk_score = float(ml_result["risk_score"])

            message = "Phishing site detected" if is_phishing else "Site appears legitimate"
            return {
                "risk_score": risk_score,
                "is_phishing": is_phishing,
                "ml_result": {
                    "prediction": int(ml_result["ml_prediction"]),
                    "confidence": float(ml_result["ml_confidence"]),
                    "features": {k: float(v) if isinstance(v, (int, float)) else bool(v) if isinstance(v, bool) else str(v)
                               for k, v in ml_result["features"].items()}
                },
                "safe_browsing_result": sb_result,
                "message": message,
                "source": "Combined Analysis"
            }

        except Exception as e:
            error_msg = str(e)
            print(f"Error analyzing URL: {error_msg}", file=sys.stderr)
            return {
                "error": str(error_msg),
                "risk_score": 100.0,
                "is_phishing": True,
                "message": f"Error during analysis: {error_msg}"
            }

class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        try:
            if isinstance(obj, bool):
                return bool(obj)  # Ensure boolean values are properly converted
            if isinstance(obj, (float, int)):
                return float(obj)  # Convert numbers properly
            return json.JSONEncoder.default(self, obj)
        except TypeError:
            return str(obj)  # Fallback to string conversion

def main():
    """CLI entry point"""
    if len(sys.argv) > 1:
        analyzer = URLAnalyzer()
        url = sys.argv[1]
        use_safe_browsing = sys.argv[2].lower() == 'true' if len(sys.argv) > 2 else True
        print(f"CLI args: url={url}, safe_browsing={use_safe_browsing}", file=sys.stderr)
        
        import asyncio
        result = asyncio.run(analyzer.analyze_url(url, use_safe_browsing))
        
        # Convert result dict to ensure all values are JSON serializable
        serializable_result = {}
        for key, value in result.items():
            if isinstance(value, bool):
                serializable_result[key] = bool(value)
            elif isinstance(value, (int, float)):
                serializable_result[key] = float(value)
            elif isinstance(value, dict):
                # Handle nested dictionaries
                serializable_result[key] = {k: str(v) if not isinstance(v, (bool, int, float, str, dict, list)) else v 
                                          for k, v in value.items()}
            else:
                serializable_result[key] = str(value) if not isinstance(value, (str, list, dict)) else value
        
        # Only print the final result to stdout - this is what Node.js will capture
        print(json.dumps(serializable_result, indent=2, cls=JSONEncoder))
        
        # Debug info goes to stderr
        print("Analysis complete", file=sys.stderr)
    else:
        print(json.dumps({"error": "No URL provided"}))

if __name__ == "__main__":
    main()