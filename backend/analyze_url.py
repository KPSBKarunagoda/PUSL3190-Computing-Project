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
            'domain_in_ip': 0.15,
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
                # Calculate risk score
                risk_score = self.calculate_risk_score(features)
                
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
                print(f"Risk Score: {risk_score}", file=sys.stderr)
                print(f"ML Confidence: {ml_confidence:.2%}", file=sys.stderr)
                print(f"Decision: {'Phishing' if is_phishing else 'Legitimate'}", file=sys.stderr)
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

    async def analyze_url(self, url: str) -> Dict[str, Any]:
        """Two-step URL analysis using Safe Browsing and ML"""
        try:
            print(f"\n=== Starting Two-Step URL Analysis ===", file=sys.stderr)
            print(f"URL: {url}", file=sys.stderr)
            
            # Extract features
            features = self.feature_extractor.extract_features(url)
            if features is None:
                raise Exception("Failed to extract features")

            # Step 1: Check Safe Browsing API
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

            # Step 2: ML Analysis
            print("\nStep 2: Performing ML Analysis...", file=sys.stderr)
            ml_result = self._ml_analysis(features)
            
            if ml_result is None:
                return {
                    "error": "ML analysis failed",
                    "risk_score": 100,
                    "is_phishing": True
                }

            # Final decision combining both results
            is_phishing = ml_result["is_phishing"]
            risk_score = ml_result["risk_score"]
            message = (
                f"High risk - Phishing detected (ML Confidence: {ml_result['ml_confidence']:.1%})"
                if is_phishing
                else "Safe - Verified by both Safe Browsing and ML analysis"
            )

            return {
                "risk_score": risk_score,
                "is_phishing": is_phishing,
                "ml_result": ml_result,
                "safe_browsing_result": sb_result,
                "features": features,
                "message": message,
                "source": "Combined Analysis"
            }

        except Exception as e:
            error_msg = str(e)
            print(f"Error analyzing URL: {error_msg}", file=sys.stderr)
            return {
                "error": error_msg,
                "risk_score": 100,
                "is_phishing": True,
                "message": f"Error during analysis: {error_msg}"
            }

def main():
    """CLI entry point"""
    if len(sys.argv) > 1:
        analyzer = URLAnalyzer()
        url = sys.argv[1]
        import asyncio
        result = asyncio.run(analyzer.analyze_url(url))
        print(json.dumps(result, indent=2))
    else:
        print(json.dumps({"error": "No URL provided"}))

if __name__ == "__main__":
    main()