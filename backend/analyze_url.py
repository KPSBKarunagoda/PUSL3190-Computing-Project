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
from services.ip_reputation import IPReputationService  # Import the new service
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
        self.ip_reputation = IPReputationService()  # Initialize IP reputation service
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
            # ===== EXISTING FEATURES WITH ADJUSTED WEIGHTS =====
            'domain_in_ip': 0.40,         # [INCREASED] from 0.35 to 0.40 - IP address is a strong indicator
            'tls_ssl_certificate': -0.10,  # [DECREASED] from -0.15 to -0.10 - many phishing sites now use SSL
            'domain_google_index': -0.15,  # -15% if domain is indexed by Google
            'url_google_index': -0.10,     # -10% if specific URL is indexed
            'qty_redirects': 0.15,         # 15% per redirect
            'time_domain_activation': -0.10, # -10% based on domain age
            'qty_ip_resolved': -0.05,      # -5% per resolved IP (negative = good)
            'domain_spf': -0.05,           # -5% if domain has SPF record
            
            # ===== URL STRUCTURE FEATURES =====
            'qty_dot_url': 0.04,           # 4% per dot in URL
            'qty_hyphen_url': 0.04,        # 4% per hyphen in URL
            'qty_at_url': 0.15,            # 15% per @ symbol in URL
            'length_url': 0.003,           # 0.003% per character
            
            # ===== NEW FEATURES ALREADY BEING EXTRACTED =====
            'qty_underline_url': 0.04,     # 4% per underline in URL
            'qty_questionmark_url': 0.02,  # 2% per question mark beyond the first one
            'domain_length': 0.002,        # 0.2% per character - suspicious if very long
            'qty_dot_domain': 0.03,        # 3% per extra dot in domain (subdomain levels)
            'url_shortened': 0.20,         # 20% if URL is shortened (bit.ly, t.co, etc.)
            'ttl_hostname': -0.0005,       # Lower TTL is suspicious, higher is good
            'time_domain_expiration': -0.0004, # Domains with longer expiration are more legitimate
            'qty_vowels_domain': -0.005,   # Legitimate domains usually have proper vowel usage
            'email_in_url': 0.30,          # 30% if email is in URL (highly suspicious)
            'server_client_domain': 0.10,  # 10% if domain contains "server" or "client" (often phishing)
            'qty_mx_servers': -0.02,       # -2% per MX server (legitimate domains often have multiple)
            'qty_nameservers': -0.02,      # [REDUCED] from -0.03 to -0.02 per nameserver (will be adjusted in calculation)
        }
        
        # Parameters that need special normalization 
        self.normalization_params = {
            'length_url': {'max': 150},  # Cap impact for URLs longer than 150 chars
            'domain_length': {'max': 50}, # Cap impact for domains longer than 50 chars
            'ttl_hostname': {'min': 300, 'max': 86400},  # Range for TTL normalization
            'time_domain_activation': {'max': 365},  # Cap at 1 year
            'time_domain_expiration': {'max': 730}   # Cap at 2 years
        }

    def calculate_risk_score(self, features: Dict[str, Any]) -> float:
        """Calculate risk score based on weighted features"""
        risk_score = 50  # Base score
        
        # Add special pattern detection
        # High entropy/random-looking domains are very suspicious
        if features.get('domain_length', 0) > 15 and features.get('qty_vowels_domain', 0) / max(1, features.get('domain_length', 1)) < 0.2:
            risk_score += 15  # Add 15% for suspicious character distribution
        
        # Multiple hyphens in domain is highly suspicious
        if features.get('qty_hyphen_domain', 0) > 2:
            risk_score += 10
        
        # Check if domain is indexed by Google (for context-aware analysis)
        is_google_indexed = bool(features.get('domain_google_index', 0))
        url_indexed = bool(features.get('url_google_index', 0))
        
        # NEW: Check for WHOIS failures (indicated by missing domain age and expiration)
        whois_failed = (features.get('time_domain_activation', 0) == 0 and 
                        features.get('time_domain_expiration', 0) == 0)
        
        # NEW: Handle WHOIS failures differently based on Google indexing
        if whois_failed:
            print("WHOIS lookup failed or data unavailable", file=sys.stderr)
            
            if is_google_indexed:
                # For Google-indexed sites, WHOIS failure is less concerning
                print("Domain is Google-indexed, reducing penalty for WHOIS failure", file=sys.stderr)
                risk_score += 5  # Small penalty for WHOIS failure
            else:
                # For non-indexed sites, WHOIS failure is more suspicious
                print("Domain is not Google-indexed and WHOIS failed - adding penalty", file=sys.stderr)
                risk_score += 15  # Larger penalty for non-indexed domains with WHOIS failure
        else:
            # Standard checks for domain age and expiration when WHOIS works
            # Newly registered domains (less than 7 days) are highly suspicious
            if features.get('time_domain_activation', 0) > 0 and features.get('time_domain_activation', 0) < 7:
                risk_score += 15
                
            # Short expiration is suspicious (less than 90 days)
            if features.get('time_domain_expiration', 0) > 0 and features.get('time_domain_expiration', 0) < 90:
                risk_score += 10
        
        # NEW: Adjust DNS infrastructure weight based on Google indexing
        has_mx_servers = int(features.get('qty_mx_servers', 0)) > 0
        has_nameservers = int(features.get('qty_nameservers', 0)) > 0
        
        # If domain is indexed by Google but missing DNS infrastructure,
        # reduce the penalty since it's likely legitimate despite DNS issues
        if is_google_indexed:
            # For indexed sites, missing DNS infrastructure is less suspicious
            if not has_nameservers:
                risk_score += 10  # Add only 10% penalty (instead of larger penalty below)
                print("Missing nameservers but Google-indexed site: reduced penalty", file=sys.stderr)
            if not has_mx_servers:
                risk_score += 5   # Add only 5% penalty
                print("Missing MX servers but Google-indexed site: reduced penalty", file=sys.stderr)
        else:
            # For non-indexed sites, missing DNS infrastructure is very suspicious
            if not has_nameservers:
                risk_score += 25  # Significant penalty for no nameservers on non-indexed site
                print("Missing nameservers on non-indexed site: major penalty", file=sys.stderr)
            if not has_mx_servers:
                risk_score += 10  # Higher penalty for non-indexed site
                print("Missing MX servers on non-indexed site: increased penalty", file=sys.stderr)
            
            # NEW: Add penalty for non-indexed domain (but only if URL isn't indexed either)
            if not url_indexed:
                risk_score += 10  # Add 10% risk bonus for sites not in Google's index at all
                print("Domain not indexed by Google: +10 points", file=sys.stderr)
        
        # Continue with standard feature weights, but skip nameservers and MX servers
        # as we've already handled them above with context-aware logic
        for feature, weight in self.weights.items():
            if feature in features and feature not in ['qty_nameservers', 'qty_mx_servers']:
                value = features[feature]
                if isinstance(value, bool):
                    value = 1 if value else 0
                    
                # Apply normalization for specific features
                if feature in self.normalization_params:
                    params = self.normalization_params[feature]
                    
                    # Cap maximum value for this feature
                    if 'max' in params and value > params['max']:
                        value = params['max']
                        
                    # Set minimum value
                    if 'min' in params and value < params['min']:
                        value = params['min']
                
                # Special handling for questionmark - only suspicious if more than one
                if feature == 'qty_questionmark_url' and value <= 1:
                    continue  # Skip if there's only one or zero question marks
                
                risk_score += value * weight
        
        return max(0, min(100, risk_score))

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
                    
                    # NEW: Apply ML model contribution to risk score
                    if ml_prediction == 1:  # If model predicts phishing
                        # Calculate ML contribution based on confidence
                        # High confidence (>90%) adds up to 25 points, lower confidence adds proportionally less
                        ml_contribution = min(25, (phishing_prob - self.threshold) * 40)
                        
                        # Add ML contribution to risk score
                        if ml_contribution > 0:
                            print(f"ML predicts phishing with {phishing_prob:.1%} confidence: +{ml_contribution:.1f} points", file=sys.stderr)
                            
                            # Check if adding ML contribution would exceed 100
                            if risk_score + ml_contribution > 100:
                                print(f"Capping risk score to 100 (would have been {risk_score + ml_contribution:.1f})", file=sys.stderr)
                                risk_score = 100
                            else:
                                risk_score += ml_contribution
                            
                            # If the ML model has extremely high confidence (>95%), ensure score is at least in suspicious range
                            if phishing_prob > 0.95 and risk_score < 40:
                                old_score = risk_score
                                risk_score = max(risk_score, 40)
                                print(f"ML has very high confidence: enforcing minimum score of 40 (was {old_score:.1f})", file=sys.stderr)
                    else:
                        # Model predicts legitimate - no additional risk
                        print(f"ML predicts legitimate with {legitimate_prob:.1%} confidence: no risk adjustment", file=sys.stderr)
                    
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
                    # Even for low risk, if ML prediction is phishing with high confidence, flag it
                    if ml_prediction == 1 and ml_confidence > 0.95:
                        is_phishing = True
                        risk_explanation = "Low risk score but ML model detects phishing with high confidence"
                        print("Override: ML has high confidence this is phishing despite low risk score", file=sys.stderr)
                    else:
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

    async def analyze_url(self, url: str, use_safe_browsing: bool = True) -> Dict[str, Any]:
        """URL analysis including blacklist, whitelist, and IP reputation checks"""
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
                
            # Step 3: Check Safe Browsing API
            sb_result = {"threats": [], "is_safe": True}
            if use_safe_browsing:
                print("\nStep 3: Checking Google Safe Browsing...", file=sys.stderr)
                sb_result = await self.safe_browsing.check_url(url)
                has_threats = bool(sb_result.get("threats"))
                
                if has_threats:
                    print(f"Safe Browsing API detected threats: {sb_result.get('threats')}", file=sys.stderr)
                    # We'll incorporate this into the risk score below, not immediately return
            else:
                print("\nStep 3: Safe Browsing check skipped", file=sys.stderr)

            # NEW Step 4: Check IP reputation
            print("\nStep 4: Checking IP reputation...", file=sys.stderr)
            ip_rep_result = await self.ip_reputation.check_ip_reputation(url)
            
            if ip_rep_result["listed"]:
                print(f"IP reputation check: {ip_rep_result['message']}", file=sys.stderr)
                print(f"Found on blocklists: {', '.join(ip_rep_result['blocklists'])}", file=sys.stderr)
                print(f"IP reputation risk contribution: +{ip_rep_result['risk_score']}%", file=sys.stderr)
            else:
                print(f"IP reputation check: {ip_rep_result['message']}", file=sys.stderr)

            # Step 5: ML Analysis
            print("\nStep 5: Performing ML Analysis...", file=sys.stderr)
            features = self.feature_extractor.extract_features(url)
            
            # Add IP reputation info to features so ML model can use it
            features['ip_blacklisted'] = 1 if ip_rep_result["listed"] else 0
            features['ip_blacklist_count'] = len(ip_rep_result.get("blocklists", []))
            
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

            # Add Safe Browsing contributions to risk score
            if sb_result and sb_result.get("threats"):
                threat_count = len(sb_result.get("threats", []))
                safe_browsing_risk_bonus = min(40, threat_count * 20)  # Up to 40% risk bonus based on threats
                
                old_score = risk_score
                risk_score = min(100, risk_score + safe_browsing_risk_bonus)
                
                print(f"Adding Safe Browsing risk bonus: +{safe_browsing_risk_bonus}% (was {old_score:.1f}, now {risk_score:.1f})", file=sys.stderr)
                
                # Also update phishing status based on combined assessment
                if risk_score >= 60:
                    is_phishing = True
                    print("URL marked as phishing due to Safe Browsing threats and high risk score", file=sys.stderr)

            # NEW: Add IP reputation to risk score
            if ip_rep_result["listed"]:
                ip_risk_contribution = ip_rep_result["risk_score"]
                old_score = risk_score
                risk_score = min(100, risk_score + ip_risk_contribution)
                
                print(f"Adding IP reputation risk: +{ip_risk_contribution}% (was {old_score:.1f}, now {risk_score:.1f})", file=sys.stderr)
                
                # Update phishing status based on IP reputation
                if ip_risk_contribution >= 30 and risk_score >= 60:
                    is_phishing = True
                    print("URL marked as phishing due to poor IP reputation and high risk score", file=sys.stderr)

            message = "Phishing site detected" if is_phishing else "Site appears legitimate"
            
            # Include Safe Browsing in message
            if sb_result and sb_result.get("threats"):
                threat_types = [threat.get("threat_type", "Unknown") for threat in sb_result.get("threats", [])]
                threat_message = ", ".join(threat_types)
                message = f"Google Safe Browsing detected: {threat_message}. {message}"
            
            # Include IP reputation in message if it's listed
            if ip_rep_result["listed"]:
                message = f"IP appears on {len(ip_rep_result['blocklists'])} security blocklists. {message}"
                
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
                "ip_reputation_result": ip_rep_result,  # Include IP reputation in results
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

