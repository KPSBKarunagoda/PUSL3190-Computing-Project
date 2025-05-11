import sys
import json
import os
import pandas as pd
from joblib import load
from typing import Dict, Any, Optional, Union
from utils.feature_extractor import URLFeatureExtractor
from services.safe_browsing import SafeBrowsingService
from services.whitelist import WhitelistService
from services.blacklist import BlacklistService
import numpy as np

class ModelWrapper:
    """Wrapper to standardize model interface regardless of underlying model type"""
    def __init__(self, model):
        self.model = model
        # Detect model type
        self.is_lightgbm_booster = self._is_lightgbm_booster(model)
        self.is_sklearn = hasattr(model, 'predict_proba')
        
    def _is_lightgbm_booster(self, model):
        """Check if the model is a LightGBM Booster object"""
        return model.__class__.__name__ == 'Booster'
        
    def predict(self, X):
        """Make binary predictions"""
        if self.is_lightgbm_booster:
            # LightGBM Booster returns raw probabilities
            probs = self.model.predict(X)
            return (probs > 0.5).astype(int)
        else:
            # Standard sklearn interface
            return self.model.predict(X)
    
    def predict_proba(self, X):
        """Return probability predictions [prob_class0, prob_class1]"""
        if self.is_lightgbm_booster:
            # LightGBM Booster returns just the probability for class 1
            probs_1 = self.model.predict(X)
            if probs_1.ndim == 1:
                # Ensure it's a 1D array
                probs_0 = 1 - probs_1
                # Return in sklearn format: [[prob_0, prob_1], [prob_0, prob_1], ...]
                return np.column_stack((probs_0, probs_1))
            return probs_1  # If already in correct format
        else:
            # Standard sklearn interface
            return self.model.predict_proba(X)

class URLAnalyzer:
    def __init__(self):
        self.whitelist_service = WhitelistService()
        self.blacklist_service = BlacklistService()
        self.feature_extractor = URLFeatureExtractor()
        self.safe_browsing = SafeBrowsingService()
        self.model = None
        self.scaler = None
        self.feature_names = None
        self.threshold = 0.7  # Default threshold
        self._load_model()
        self._initialize_weights()

    def _load_model(self):
        """Load ML model and related components"""
        try:
            current_dir = os.path.dirname(__file__)
            # Try loading the v5 model with new feature names first
            model_path = os.path.join(current_dir, 'machine learning', 'url_model_v5.pkl')
            scaler_path = os.path.join(current_dir, 'machine learning', 'scaler_v5.pkl')
            feature_names_path = os.path.join(current_dir, 'machine learning', 'feature_names_v5.pkl')
            threshold_path = os.path.join(current_dir, 'machine learning', 'classification_threshold.json')
            
            # Try to load the v5 components
            try:
                raw_model = load(model_path)
                self.scaler = load(scaler_path)
                self.model = ModelWrapper(raw_model)  # Wrap the model to standardize the interface
                
                try:
                    self.feature_names = load(feature_names_path)
                    print(f"Model v5 loaded successfully with {len(self.feature_names)} features", file=sys.stderr)
                except:
                    # Fall back to feature names from analyzer
                    from train_model import FEATURE_NAMES
                    self.feature_names = FEATURE_NAMES
                    print(f"Using default feature names with {len(self.feature_names)} features", file=sys.stderr)
                
            except Exception as e:
                print(f"Error loading v5 model: {str(e)}", file=sys.stderr)
                # Fall back to v4 model
                model_path = os.path.join(current_dir, 'machine learning', 'url_model_v4.pkl')
                scaler_path = os.path.join(current_dir, 'machine learning', 'scaler_v4.pkl')
                raw_model = load(model_path)
                self.scaler = load(scaler_path)
                self.model = ModelWrapper(raw_model)  # Wrap the model
                
                # Try different locations for feature names
                try:
                    # First try v5 feature names (may have been saved separately)
                    feature_names_path = os.path.join(current_dir, 'machine learning', 'feature_names_v5.pkl')
                    self.feature_names = load(feature_names_path)
                except:
                    # Fall back to original feature names
                    feature_names_path = os.path.join(current_dir, 'machine learning', 'feature_names.pkl')
                    self.feature_names = load(feature_names_path)
                
                print(f"Fell back to model v4 with {len(self.feature_names)} features", file=sys.stderr)
            
            # Load threshold if available
            try:
                with open(threshold_path, 'r') as f:
                    threshold_data = json.load(f)
                    self.threshold = threshold_data.get('threshold', 0.7)
                    print(f"Using threshold: {self.threshold}", file=sys.stderr)
            except:
                print(f"Using default threshold: {self.threshold}", file=sys.stderr)
                
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
            'domain_google_index': -0.15,  # NEW: Strong negative weight (reduces risk) when domain is indexed
            'url_google_index': -0.1,      # Increased impact when the URL is indexed
            'qty_redirects': 0.1,
            'time_domain_activation': -0.1,
            'qty_ip_resolved': -0.05,
            'domain_spf': -0.05           # NEW: Minor negative weight when SPF is present
        }

    def _ml_analysis(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Perform ML-based analysis"""
        try:
            if self.model and self.scaler and self.feature_names:
                # Calculate risk score
                risk_score = self.calculate_risk_score(features)
                
                # Check if this is an IP-based domain (using the feature extractor's result)
                is_ip_based = bool(features.get('domain_in_ip', 0))
                
                # Apply risk bonus for IP-based domains
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
                try:
                    features_scaled = self.scaler.transform([feature_vector])
                except ValueError as e:
                    print(f"Feature vector scaling error: {str(e)}", file=sys.stderr)
                    # Create diagnostics for feature count mismatch
                    print(f"Features expected: {self.scaler.n_features_in_}, Features provided: {len(feature_vector)}", file=sys.stderr)
                    
                    # Try to handle feature count mismatch
                    if hasattr(self.scaler, 'n_features_in_'):
                        if len(feature_vector) > self.scaler.n_features_in_:
                            # Too many features, truncate
                            print(f"Truncating feature vector from {len(feature_vector)} to {self.scaler.n_features_in_}", file=sys.stderr)
                            feature_vector = feature_vector[:self.scaler.n_features_in_]
                        elif len(feature_vector) < self.scaler.n_features_in_:
                            # Too few features, pad with zeros
                            print(f"Padding feature vector from {len(feature_vector)} to {self.scaler.n_features_in_}", file=sys.stderr)
                            feature_vector.extend([0] * (self.scaler.n_features_in_ - len(feature_vector)))
                        
                        # Try scaling again
                        features_scaled = self.scaler.transform([feature_vector])
                    else:
                        raise
                
                # Get prediction using the wrapper's unified interface
                try:
                    # Get probabilities using the wrapper's predict_proba
                    ml_probability = self.model.predict_proba(features_scaled)[0]
                    phishing_prob = float(ml_probability[1])
                    legitimate_prob = float(ml_probability[0])
                    ml_prediction = 1 if phishing_prob > self.threshold else 0
                    ml_confidence = float(max(legitimate_prob, phishing_prob))
                    
                    # Debug ML output
                    print(f"\n=== ML Debug ===", file=sys.stderr)
                    print(f"Raw ML Prediction: {ml_prediction}", file=sys.stderr)
                    print(f"Probabilities: Legitimate: {legitimate_prob:.2%}, Phishing: {phishing_prob:.2%}", file=sys.stderr)
                    print(f"Confidence: {ml_confidence:.2%}", file=sys.stderr)
                    print(f"Threshold: {self.threshold}", file=sys.stderr)
                    
                except Exception as e:
                    print(f"Error in prediction: {str(e)}", file=sys.stderr)
                    # Fallback to direct prediction
                    ml_prediction = int(self.model.predict(features_scaled)[0])
                    phishing_prob = float(ml_prediction)  # Use prediction as probability
                    legitimate_prob = 1.0 - phishing_prob
                    ml_confidence = max(legitimate_prob, phishing_prob)
                
                # Decision logic
                is_phishing = False

                # Special pattern detection
                has_credentials = '@' in features.get('_url', '') and ':' in features.get('_url', '').split('@')[0]
                has_at_symbol = features.get('qty_at_url', 0) > 0
                is_ip_based = bool(features.get('domain_in_ip', 0))

                # Modified decision logic to reduce false positives
                if is_ip_based:
                    # IP-based URLs are still high risk unless in whitelist
                    is_phishing = True
                    risk_explanation = "IP-based URL detected (rarely used for legitimate websites)"
                elif risk_score > 80:  # Very high risk
                    is_phishing = ml_prediction == 1
                    risk_explanation = "Very high risk score and ML prediction indicates phishing"
                elif risk_score > 60:  # High risk
                    is_phishing = ml_prediction == 1 and ml_confidence > 0.7
                    risk_explanation = "High risk score combined with ML prediction"
                elif risk_score > 30:  # Medium risk
                    is_phishing = ml_prediction == 1 and ml_confidence > 0.8
                    risk_explanation = "Medium risk score with high confidence ML prediction"
                else:  # Low risk
                    is_phishing = False
                    risk_explanation = "Low risk score - unlikely to be phishing"
                
                print(f"\n=== Final Decision ===", file=sys.stderr)
                result = {
                    "risk_score": risk_score,
                    "ml_confidence": ml_confidence,
                    "is_phishing": is_phishing,
                    "decision": "Phishing" if is_phishing else "Legitimate",
                    "risk_explanation": risk_explanation
                }
                print("=" * 25 + "\n", file=sys.stderr)

                return {
                    "risk_score": risk_score,
                    "is_phishing": is_phishing,
                    "ml_prediction": int(ml_prediction),
                    "ml_confidence": ml_confidence,
                    "features": features,
                    "safe_probability": legitimate_prob,
                    "phishing_probability": phishing_prob,
                    "risk_explanation": risk_explanation
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
                    "features": features,
                    "risk_explanation": "Basic risk score analysis (ML model not available)"
                }
        except Exception as e:
            print(f"ML analysis error: {str(e)}", file=sys.stderr)
            raise Exception(f"ML analysis failed: {str(e)}")

    def calculate_risk_score(self, features: Dict[str, Any]) -> float:
        """Calculate risk score based on weighted features"""
        risk_score = 50  # Base score
        
        for feature, weight in self.weights.items():
            if feature in features:
                value = features[feature]
                if isinstance(value, bool):
                    value = 1 if value else 0
                    
                # Apply maximum impact cap for specific features
                if feature == 'time_domain_activation' and value > 0:
                    # Cap domain age impact to maximum of 365 days (1 year)
                    value = min(value, 365)
                
                risk_score += value * weight
        
        return max(0, min(100, risk_score))

    async def analyze_url(self, url: str, use_safe_browsing: bool = True) -> Dict[str, Any]:
        """URL analysis including blacklist and whitelist checks"""
        try:
            print(f"\n=== Starting URL Analysis ===", file=sys.stderr)
            print(f"URL: {url}", file=sys.stderr)
            print(f"Using Safe Browsing API: {use_safe_browsing}", file=sys.stderr)
            
            # Check BLACKLIST first (highest priority)
            print("\nStep 1: Checking blacklist...", file=sys.stderr)
            blacklist_result = self.blacklist_service.is_blacklisted(url)
            
            if blacklist_result["blacklisted"]:
                risk_score = blacklist_result["risk_level"]
                print(f"URL is in blacklist with risk score {risk_score}", file=sys.stderr)
                return {
                    "risk_score": risk_score,
                    "is_phishing": risk_score > 50,  # Consider it phishing if risk score > 50
                    "source": "Blacklist",
                    "message": f"Domain is in known phishing blacklist (Risk: {risk_score}%)",
                    "ml_result": None,
                    "safe_browsing_result": None
                }
                
            # Step 2: Check WHITELIST next
            print("\nStep 2: Checking whitelist...", file=sys.stderr)
            if self.whitelist_service.is_whitelisted(url):
                print("URL is in trusted whitelist - allowing access", file=sys.stderr)
                return {
                    "risk_score": 0,
                    "is_phishing": False,
                    "source": "Whitelist",
                    "message": "Domain is in trusted whitelist",
                    "ml_result": None,
                    "safe_browsing_result": None
                }
                
            # Step 3: Check Safe Browsing API if enabled
            sb_result = {"threats": [], "is_safe": True}
            if use_safe_browsing:
                print("\nStep 3: Checking Google Safe Browsing...", file=sys.stderr)
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
                print("\nStep 3: Safe Browsing check skipped", file=sys.stderr)

            # Step 4: ML Analysis
            print("\nStep 4: Performing ML Analysis...", file=sys.stderr)
            features = self.feature_extractor.extract_features(url)
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
                "risk_score": round(risk_score, 1),  # Round to 1 decimal place
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