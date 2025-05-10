import os
import sys
import json
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from tqdm import tqdm
from datetime import datetime
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
from sklearn.metrics import roc_curve, auc
from joblib import load
from urllib.parse import urlparse

# Import the feature extractor directly instead of using the analyzer
from utils.feature_extractor import URLFeatureExtractor

# Directory for saving benchmark results
BENCHMARK_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'benchmark_results')
os.makedirs(BENCHMARK_DIR, exist_ok=True)

class ModelBenchmark:
    def __init__(self):
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.results_dir = os.path.join(BENCHMARK_DIR, f'benchmark_{self.timestamp}')
        os.makedirs(self.results_dir, exist_ok=True)
        
        # Load the ML model components directly
        self._load_model()
        
        # Set up dataset from reliable sources
        self.dataset = self._initialize_dataset()
    
    def _load_model(self):
        """Load ML model and related components directly"""
        try:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            
            # Try to load the v5 model first
            model_path = os.path.join(current_dir, 'machine learning', 'url_model_v5.pkl')
            scaler_path = os.path.join(current_dir, 'machine learning', 'scaler_v5.pkl')
            feature_names_path = os.path.join(current_dir, 'machine learning', 'feature_names_v5.pkl')
            
            # Try to load the v5 components
            try:
                self.model = load(model_path)
                self.scaler = load(scaler_path)
                print(f"Successfully loaded model v5 from {model_path}")
                
                try:
                    self.feature_names = load(feature_names_path)
                    print(f"Loaded v5 feature names with {len(self.feature_names)} features")
                except:
                    # Fall back to feature names from train_model.py
                    from train_model import FEATURE_NAMES
                    self.feature_names = FEATURE_NAMES
                    print(f"Using default feature names with {len(self.feature_names)} features")
                
            except:
                # Fall back to v4 model
                model_path = os.path.join(current_dir, 'machine learning', 'url_model_v4.pkl')
                scaler_path = os.path.join(current_dir, 'machine learning', 'scaler_v4.pkl')
                feature_names_path = os.path.join(current_dir, 'machine learning', 'feature_names.pkl')
                
                self.model = load(model_path)
                self.scaler = load(scaler_path)
                print(f"Fell back to model v4 from {model_path}")
                
                try:
                    self.feature_names = load(feature_names_path)
                    print(f"Loaded v4 feature names with {len(self.feature_names)} features")
                except:
                    # Fall back to feature names from train_model.py
                    from train_model import FEATURE_NAMES
                    self.feature_names = FEATURE_NAMES
                    print(f"Using default feature names with {len(self.feature_names)} features")
            
            return True
            
        except Exception as e:
            print(f"Error loading model: {str(e)}")
            raise ValueError("Failed to load ML model components")
    
    def _initialize_dataset(self):
        """Initialize the benchmark dataset with URLs from reliable sources"""
        # This dataset combines URLs from:
        # - PhishTank (verified phishing)
        # - APWG (Anti-Phishing Working Group)
        # - Common Crawl (verified legitimate)
        # - Alexa/Tranco top sites (legitimate)
        # - Academic datasets (ISCX-URL-2016, UCI Machine Learning Repository)
        
        dataset = {
            # LEGITIMATE URLs (reputable sites, educational institutions, government)
            "https://www.google.com": 0,
            "https://www.microsoft.com": 0,
            "https://www.apple.com": 0,
            "https://www.amazon.com": 0,
            "https://www.github.com": 0,
            "https://www.wikipedia.org": 0,
            "https://www.youtube.com": 0,
            "https://www.linkedin.com": 0,
            "https://www.facebook.com": 0,
            "https://www.twitter.com": 0,
            "https://www.netflix.com": 0,
            "https://www.nytimes.com": 0,
            "https://www.bbc.co.uk": 0,
            "https://www.cnn.com": 0,
            "https://www.harvard.edu": 0,
            "https://www.mit.edu": 0,
            "https://www.stanford.edu": 0,
            "https://www.ucla.edu": 0,
            "https://www.ox.ac.uk": 0,
            "https://www.cam.ac.uk": 0,
            "https://www.gov.uk": 0,
            "https://www.nasa.gov": 0,
            "https://www.nih.gov": 0,
            "https://www.cdc.gov": 0,
            "https://www.imf.org": 0,
            "https://www.who.int": 0,
            "https://www.un.org": 0,
            "https://www.ieee.org": 0,
            "https://www.acm.org": 0,
            "https://www.springer.com": 0,
            "https://www.nature.com": 0,
            "https://www.science.org": 0,
            "https://www.elsevier.com": 0,
            "https://www.wiley.com": 0,
            "https://www.etsy.com": 0,
            "https://www.walmart.com": 0,
            "https://www.target.com": 0,
            "https://www.ebay.com": 0,
            "https://www.paypal.com": 0,
            "https://www.stackoverflow.com": 0,
            
            # 50 ADDITIONAL LEGITIMATE URLS
            "https://www.adobe.com": 0,
            "https://www.oracle.com": 0,
            "https://www.ibm.com": 0,
            "https://www.intel.com": 0,
            "https://www.cisco.com": 0,
            "https://www.salesforce.com": 0,
            "https://www.samsung.com": 0,
            "https://www.sony.com": 0,
            "https://www.nvidia.com": 0,
            "https://www.amd.com": 0,
            "https://www.hp.com": 0,
            "https://www.dell.com": 0,
            "https://www.lenovo.com": 0,
            "https://www.asus.com": 0,
            "https://www.toshiba.com": 0,
            "https://www.lg.com": 0,
            "https://www.panasonic.com": 0,
            "https://www.canon.com": 0,
            "https://www.nikon.com": 0,
            "https://www.gopro.com": 0,
            "https://www.spotify.com": 0,
            "https://www.pandora.com": 0,
            "https://www.soundcloud.com": 0,
            "https://www.bandcamp.com": 0,
            "https://www.airbnb.com": 0,
            "https://www.booking.com": 0,
            "https://www.expedia.com": 0,
            "https://www.tripadvisor.com": 0,
            "https://www.kayak.com": 0,
            "https://www.uber.com": 0,
            "https://www.lyft.com": 0,
            "https://www.doordash.com": 0,
            "https://www.grubhub.com": 0,
            "https://www.ubereats.com": 0,
            "https://www.instacart.com": 0,
            "https://www.pinterest.com": 0,
            "https://www.reddit.com": 0,
            "https://www.tumblr.com": 0,
            "https://www.quora.com": 0,
            "https://www.medium.com": 0,
            "https://www.wordpress.com": 0,
            "https://www.blogger.com": 0,
            "https://www.dropbox.com": 0,
            "https://www.box.com": 0,
            "https://www.slack.com": 0,
            "https://www.zoom.us": 0,
            "https://www.discord.com": 0,
            "https://www.webex.com": 0,
            "https://www.trello.com": 0,
            "https://www.notion.so": 0,
            
            # PHISHING URLs (verified phishing URLs from reliable sources)
            # These examples were once live phishing sites that have been reported and taken down
            # Format: 'phishing-url': 1 (indicating phishing)
            "http://secure-paypal.com.verification.dunsguide.org": 1,
            "http://secure.paypal-support.confirm-information.com": 1,
            "https://myaccount-paypal-signin.helix-leisure.ru": 1,
            "http://paypal.com.account.update.secure.doubleplusgood.co.uk": 1,
            "http://signin-ebay-com.gq/signin": 1,
            "http://chasebank.com-secure.info": 1,
            "http://secure.bankofamerica.com.login.check.session.garciniacambogiasideeffects.org": 1,
            "http://online.bankofamerica.checking.update.alfalahsa.com": 1,
            "https://appleid.apple.com-signin.payment-secure-login.com": 1,
            "http://appleid.apple.com-management-system.idset8273.org": 1,
            "https://amazoncdn.login-session.com": 1,
            "http://myaccount-amazon.com.signin.userid.top": 1,
            "http://facebook-account-login.servermc.org": 1,
            "https://facebook.com-check.live": 1,
            "http://login.microsoftonline.com.authentication.support": 1,
            "https://microsoftonline.com-login-secure.info": 1,
            "http://outlook.office-365.live.com.recovery.login-secure.com": 1,
            "https://www.signup.blockchain.info.login.blckchn.xyz": 1,
            "http://www.netflix.com.payment.update.rubygene.org": 1,
            "https://www.netflix-billing.update-info.securemaill.cu.ma": 1,
            "http://wordpress-update.cloudapp.net": 1,
            "http://dropbox-documents.com.cloud-backup.club": 1,
            "http://instagram.com-recover-login.gq": 1,
            "http://verify-twitter-account-secure.com": 1,
            "http://googleaccount.verify-server.com": 1,
            "http://linkedin.com.secure.login.sessionid.crbcapital.in": 1,
            "http://online-banking-hsbc-secure.com": 1,
            "http://www.santander.co.uk-online.banking.auth.egov-system.net": 1,
            "http://www.wellsfargo.com-banking.secure.login.usinjs.net": 1,
            "http://citibank.com.verification.moneymovers.com.au": 1,
            "http://barclays.co.uk-securebanking.com": 1,
            "http://www.deutsche-bank.de.onlinesecure.info": 1,
            "http://www.bnpparibas.fr.secure-banking.fr": 1,
            "http://americanexpress.com.secure.account.amexservice.net": 1,
            "http://capitalone.com-verify.live": 1,
            "http://jpmorganchase.com-secure.banking.co.uk": 1,
            "http://usaa.com-inet.secure.account.hwp22.com": 1,
            "http://citizensbank.com.online.login.security.caxino.org": 1,
            "http://squareup-login.secure-signin.com": 1,
            "http://venmo.com.account.verification.signalm.com": 1,
            "http://docusign.com.authenticated.login.esignature.taxi": 1,
            
            # ADDITIONAL PHISHING URLS (recently reported/discovered)
            "https://fcgy.weeblysite.com/": 1,
            "https://charitable-act.org/86689144638.htm": 1,
            "https://docs.google.com/presentation/d/e/2PACX-1vTRWzIe0HLHEeCo339qYQ8": 1,
            "https://knowledgeable-west-taleggio.glitch.me/public/login.ea0f.html": 1,
            "https://www.bing.com/ck/a?!&&p=6bdf5c4598bd2e3ce1394f72c95bd6289f6cd08": 1,
            "http://docs.edoctransfer.com/s/VBM3OCPM44REMIPAZC/31ddc9/3fc6e1d0-7d34": 1,
            "http://docs.edoctransfer.com/s/VBM3OCPM44REMIPAZC/31ddc9/d874a916-9c6b": 1,
            "https://meimaibook.s3.us-east-1.amazonaws.com/onedrive.html": 1,
            "https://sbcglobal-net-158882.webflow.io/": 1,
            "https://docs.google.com/presentation/d/e/2PACX-1vTNMm-zNXZkuwVsELuCiJC": 1,
            "https://wfppsatzgtzkoykm.magaka7182.workers.dev/": 1,
            "https://ruideoklauswestphal.aafde5931dd29f9f4279.getmyip.com/": 1,
            "https://nsaskuggdwfifzok.magaka7182.workers.dev": 1,
            "https://getkunden.sbs/ak/login.php": 1,
            "https://dkbidentifikation.su/de/Transaktionsverifizierung/Tan2goBestat": 1,
            "http://bing515591433.813a85a2298fc76bc976.ham-radio-op.net/": 1,
            "https://walletconnect-97k.pages.dev/wallet": 1,
            "http://srv229936.hoster-test.ru/app/": 1,
            "https://monespace-suivilivraison.com/": 1,
            "https://monespace-suivilivraison.com/pac/calcul.php": 1,
            "https://mettamskloginei.webflow.io": 1,
            "https://openmintseas.site": 1,
            "https://xy-finance.fi": 1,
            "https://websolveclouddesk.xyz": 1,
            "https://testnet-humanity.net": 1,
            "https://coinfactoryapp.live": 1,
            "https://berachajn.network": 1,
            "https://829531-coinbase.com": 1,
            "https://check-solayer.live": 1,
            "https://web3dappfix-v2.pages.dev": 1,
            "https://sumcentramidtled.click": 1,
            "https://alpha-nodefoundation.live": 1,
            "https://access-claim-portal.pages.dev": 1,
            "https://substleravgul.click": 1,
            "https://aitprotocol-refund.pages.dev": 1,
            "http://terzon.cloud": 1,
            "https://293094-coinbase.com": 1,
            "https://m-wisemonkey.pages.dev": 1,
            "https://defl.cloud": 1,
            "https://dapprectify.site": 1,
            "https://ipkobiznesncs.com/": 1,
            "https://funkylace.com/japanpost.html": 1,
            "https://bludulce.com/index/login": 1,
            "https://accedi-hypeclienti-contespa.codeanyapp.com/supporto/notifica/": 1,
            "https://dltechhorizons.com/preland/biznesalert-orlen/": 1,
            "https://d7kansd1.botard.life/": 1,
            "https://wa.me/17787151585": 1,
            "https://docs.google.com/presentation/d/e/2PACX-1vSIqd7TTfzROLId1q10Ngy": 1,
            "https://4frontcu.cc": 1,
            "https://banprogrupopromerica-com-84367ee1e040.herokuapp.com/index.html": 1,
            "https://abvnd.top/": 1,
            "https://acasd.top/": 1
        }
        
        return dataset
    
    def benchmark_model(self):
        """Run the benchmark process using raw ML model predictions and combined approach"""
        print(f"\n=== Starting Comprehensive Benchmark at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ===")
        print(f"Benchmarking {len(self.dataset)} URLs using two approaches:")
        print("1. Raw ML model output")
        print("2. Combined score + ML approach (current system)")
        
        results_ml = []     # Raw ML results
        results_combined = []  # Combined approach results
        total = len(self.dataset)
        feature_extractor = URLFeatureExtractor()
        
        progress_bar = tqdm(total=total, desc="Testing URLs", unit="url")
        
        for url, expected_class in self.dataset.items():
            progress_bar.update(1)
            
            try:
                # Extract features directly using feature extractor
                features = feature_extractor.extract_features(url)
                if not features:
                    print(f"\nSkipping URL {url}: Failed to extract features")
                    continue
                
                # Prepare feature vector in correct order
                feature_vector = []
                for feature in self.feature_names:
                    value = features.get(feature, 0)
                    feature_vector.append(value)
                
                # Scale features
                try:
                    features_scaled = self.scaler.transform([feature_vector])
                except ValueError as e:
                    print(f"\nWarning: Scaling error for {url}: {str(e)}")
                    # Handle dimension mismatch by ensuring vector length matches scaler expectations
                    if hasattr(self.scaler, 'n_features_in_') and len(feature_vector) > self.scaler.n_features_in_:
                        print(f"Truncating feature vector to {self.scaler.n_features_in_} features")
                        feature_vector = feature_vector[:self.scaler.n_features_in_]
                        features_scaled = self.scaler.transform([feature_vector])
                    elif hasattr(self.scaler, 'n_features_in_') and len(feature_vector) < self.scaler.n_features_in_:
                        print(f"Padding feature vector from {len(feature_vector)} to {self.scaler.n_features_in_} features")
                        feature_vector = feature_vector + [0] * (self.scaler.n_features_in_ - len(feature_vector))
                        features_scaled = self.scaler.transform([feature_vector])
                    else:
                        # Skip if we can't resolve the issue
                        print(f"Cannot resolve feature dimension mismatch for {url}")
                        continue
                
                # APPROACH 1: Raw ML predictions
                try:
                    # Use raw model - first try predict_proba for scikit-learn models
                    if hasattr(self.model, 'predict_proba'):
                        raw_probabilities = self.model.predict_proba(features_scaled)[0]
                        ml_prediction = self.model.predict(features_scaled)[0]
                        phishing_probability = raw_probabilities[1]
                        legitimate_probability = raw_probabilities[0]
                    else:
                        # Handle LightGBM or other models that return raw probabilities
                        phishing_probability = float(self.model.predict(features_scaled)[0])
                        legitimate_probability = 1.0 - phishing_probability
                        ml_prediction = 1 if phishing_probability > 0.5 else 0
                    
                    ml_confidence = max(phishing_probability, legitimate_probability)
                    ml_prediction = int(ml_prediction)  # Ensure integer prediction
                    
                    # Check correctness for raw ML prediction
                    is_correct_ml = ml_prediction == expected_class
                    
                    # Store raw ML result
                    result_ml = {
                        'url': url,
                        'domain': urlparse(url).netloc,
                        'expected_class': expected_class,
                        'ml_prediction': ml_prediction,
                        'correct': is_correct_ml,
                        'ml_confidence': ml_confidence,
                        'phishing_probability': phishing_probability,
                        'legitimate_probability': legitimate_probability
                    }
                    
                    results_ml.append(result_ml)
                    
                    # APPROACH 2: Combined risk scoring + ML approach (similar to analyze_url.py)
                    # Calculate risk score
                    risk_score = self.calculate_risk_score(features)
                    
                    # Apply the combined decision logic
                    is_ip_based = bool(features.get('domain_in_ip', 0))
                    has_at_symbol = features.get('qty_at_url', 0) > 0
                    
                    # Decision logic from analyze_url.py
                    if is_ip_based:
                        combined_prediction = 1  # Phishing
                        risk_explanation = "IP-based URL detected"
                    elif risk_score > 80:  # Very high risk
                        combined_prediction = 1 if ml_prediction == 1 else 0
                        risk_explanation = "Very high risk score"
                    elif risk_score > 60:  # High risk
                        combined_prediction = 1 if ml_prediction == 1 and ml_confidence > 0.7 else 0
                        risk_explanation = "High risk score + ML confidence"
                    elif risk_score > 30:  # Medium risk
                        combined_prediction = 1 if ml_prediction == 1 and ml_confidence > 0.8 else 0
                        risk_explanation = "Medium risk with high ML confidence"
                    else:  # Low risk
                        combined_prediction = 0
                        risk_explanation = "Low risk score"
                        
                    # Check correctness for combined approach
                    is_correct_combined = combined_prediction == expected_class
                    
                    # Store combined approach result
                    result_combined = {
                        'url': url,
                        'domain': urlparse(url).netloc,
                        'expected_class': expected_class,
                        'prediction': combined_prediction,
                        'correct': is_correct_combined,
                        'ml_confidence': ml_confidence,
                        'ml_prediction': ml_prediction,
                        'risk_score': risk_score,
                        'phishing_probability': phishing_probability,
                        'legitimate_probability': legitimate_probability,
                        'is_ip_based': is_ip_based,
                        'risk_explanation': risk_explanation
                    }
                    
                    results_combined.append(result_combined)
                    
                except Exception as e:
                    print(f"\nPrediction error for {url}: {str(e)}")
                    continue
                
            except Exception as e:
                print(f"\nError analyzing URL {url}: {str(e)}")
                # Add error result to both arrays
                error_result = {
                    'url': url,
                    'expected_class': expected_class,
                    'error': str(e),
                    'correct': False
                }
                results_ml.append(error_result)
                results_combined.append(error_result)
        
        progress_bar.close()
        
        # Create dataframes
        df_ml = pd.DataFrame(results_ml)
        df_combined = pd.DataFrame(results_combined)
        
        # Analyze results for both approaches
        metrics_ml = self.analyze_ml_results(df_ml, "Raw ML Model")
        metrics_combined = self.analyze_combined_results(df_combined, "Combined Approach")
        
        # Generate visualizations for both approaches
        self.generate_comparative_visualizations(df_ml, df_combined)
        
        # Save results
        self.save_benchmark_results(df_ml, df_combined, metrics_ml, metrics_combined)
        
        return metrics_ml, metrics_combined
    
    def calculate_risk_score(self, features):
        """Calculate risk score based on weighted features (from analyze_url.py)"""
        # Define the weights (copied from analyze_url.py)
        weights = {
            'qty_dot_url': 0.05,
            'qty_hyphen_url': 0.05,
            'length_url': 0.1,
            'qty_at_url': 0.1, 
            'domain_in_ip': 0.35,         # Significantly increased weight for IP addresses 
            'tls_ssl_certificate': -0.15,
            'domain_google_index': -0.15,  # Strong negative weight when domain is indexed
            'url_google_index': -0.1,      # Increased impact when the URL is indexed
            'qty_redirects': 0.1,
            'time_domain_activation': -0.1,
            'qty_ip_resolved': -0.05,
            'domain_spf': -0.05           # Minor negative weight when SPF is present
        }
        
        risk_score = 50  # Base score
        
        for feature, weight in weights.items():
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
    
    def analyze_ml_results(self, df, approach_name="Raw ML Model"):
        """Calculate benchmark metrics for raw ML performance"""
        print(f"\n=== {approach_name} Performance ===")
        
        # Filter out errors
        df = df[~df['url'].str.contains('error', na=False) if 'url' in df.columns else True]
        
        if len(df) == 0:
            print("No valid results to analyze")
            return None
        
        # Extract true and predicted classes
        y_true = df['expected_class'].values
        y_pred = df['ml_prediction'].values if 'ml_prediction' in df.columns else df['prediction'].values
        
        # Calculate basic metrics
        accuracy = accuracy_score(y_true, y_pred)
        precision = precision_score(y_true, y_pred, zero_division=0)
        recall = recall_score(y_true, y_pred, zero_division=0)
        f1 = f1_score(y_true, y_pred, zero_division=0)
        
        # Calculate confusion matrix
        cm = confusion_matrix(y_true, y_pred)
        
        # Extract false positives and negatives
        legitimate_mask = y_true == 0
        phishing_mask = y_true == 1
        
        legitimate_count = np.sum(legitimate_mask)
        phishing_count = np.sum(phishing_mask)
        
        false_positive_count = np.sum((y_pred == 1) & legitimate_mask)
        false_negative_count = np.sum((y_pred == 0) & phishing_mask)
        
        false_positive_rate = false_positive_count / legitimate_count if legitimate_count > 0 else 0
        false_negative_rate = false_negative_count / phishing_count if phishing_count > 0 else 0
        
        # Calculate ROC AUC if probabilities are available
        roc_auc = None
        if 'phishing_probability' in df.columns:
            try:
                fpr, tpr, _ = roc_curve(y_true, df['phishing_probability'])
                roc_auc = auc(fpr, tpr)
            except Exception as e:
                print(f"Error calculating ROC AUC: {e}")
        
        # Print performance metrics
        print(f"\nPerformance Metrics for {approach_name}:")
        print(f"  Accuracy: {accuracy:.2%}")
        print(f"  Precision: {precision:.2%}")
        print(f"  Recall: {recall:.2%}")
        print(f"  F1 Score: {f1:.2%}")
        print(f"  False Positive Rate: {false_positive_rate:.2%}")
        print(f"  False Negative Rate: {false_negative_rate:.2%}")
        if roc_auc is not None:
            print(f"  ROC AUC: {roc_auc:.4f}")
        
        # Print confusion matrix
        print("\nConfusion Matrix:")
        print(cm)
        
        # Create a metrics dictionary
        metrics = {
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1_score': f1,
            'false_positive_rate': false_positive_rate,
            'false_negative_rate': false_negative_rate,
            'roc_auc': roc_auc if roc_auc is not None else 0,
            'confusion_matrix': cm.tolist(),
            'legitimate_count': int(legitimate_count),
            'phishing_count': int(phishing_count),
            'false_positive_count': int(false_positive_count),
            'false_negative_count': int(false_negative_count),
            'approach': approach_name
        }
        
        return metrics
    
    def analyze_combined_results(self, df, approach_name="Combined Approach"):
        """Calculate benchmark metrics for the combined approach"""
        print(f"\n=== {approach_name} Performance ===")
        
        # Filter out errors
        df = df[~df['url'].str.contains('error', na=False) if 'url' in df.columns else True]
        
        if len(df) == 0:
            print("No valid results to analyze")
            return None
        
        # Extract true and predicted classes
        y_true = df['expected_class'].values
        y_pred = df['prediction'].values
        
        # Calculate basic metrics
        accuracy = accuracy_score(y_true, y_pred)
        precision = precision_score(y_true, y_pred, zero_division=0)
        recall = recall_score(y_true, y_pred, zero_division=0)
        f1 = f1_score(y_true, y_pred, zero_division=0)
        
        # Calculate confusion matrix
        cm = confusion_matrix(y_true, y_pred)
        
        # Extract false positives and negatives
        legitimate_mask = y_true == 0
        phishing_mask = y_true == 1
        
        legitimate_count = np.sum(legitimate_mask)
        phishing_count = np.sum(phishing_mask)
        
        false_positive_count = np.sum((y_pred == 1) & legitimate_mask)
        false_negative_count = np.sum((y_pred == 0) & phishing_mask)
        
        false_positive_rate = false_positive_count / legitimate_count if legitimate_count > 0 else 0
        false_negative_rate = false_negative_count / phishing_count if phishing_count > 0 else 0
        
        # Print performance metrics
        print(f"\nPerformance Metrics for {approach_name}:")
        print(f"  Accuracy: {accuracy:.2%}")
        print(f"  Precision: {precision:.2%}")
        print(f"  Recall: {recall:.2%}")
        print(f"  F1 Score: {f1:.2%}")
        print(f"  False Positive Rate: {false_positive_rate:.2%}")
        print(f"  False Negative Rate: {false_negative_rate:.2%}")
        
        # Print confusion matrix
        print("\nConfusion Matrix:")
        print(cm)
        
        # Create a metrics dictionary
        metrics = {
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1_score': f1,
            'false_positive_rate': false_positive_rate,
            'false_negative_rate': false_negative_rate,
            'confusion_matrix': cm.tolist(),
            'legitimate_count': int(legitimate_count),
            'phishing_count': int(phishing_count),
            'false_positive_count': int(false_positive_count),
            'false_negative_count': int(false_negative_count),
            'approach': approach_name
        }
        
        return metrics
    
    def generate_comparative_visualizations(self, df_ml, df_combined):
        """Generate visualizations comparing both approaches"""
        print("\nGenerating comparative visualizations...")
        
        # Create figures directory
        figures_dir = os.path.join(self.results_dir, 'figures')
        os.makedirs(figures_dir, exist_ok=True)
        
        # 1. Confusion Matrices Side by Side
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))
        
        # ML Model Confusion Matrix
        y_true_ml = df_ml['expected_class'].values
        y_pred_ml = df_ml['ml_prediction'].values
        cm_ml = confusion_matrix(y_true_ml, y_pred_ml)
        
        sns.heatmap(cm_ml, annot=True, fmt='d', cmap='Blues', ax=ax1,
                   xticklabels=["Legitimate", "Phishing"], 
                   yticklabels=["Legitimate", "Phishing"])
        ax1.set_xlabel('Predicted')
        ax1.set_ylabel('Actual')
        ax1.set_title('Raw ML Model Confusion Matrix')
        
        # Combined Approach Confusion Matrix
        y_true_comb = df_combined['expected_class'].values
        y_pred_comb = df_combined['prediction'].values
        cm_comb = confusion_matrix(y_true_comb, y_pred_comb)
        
        sns.heatmap(cm_comb, annot=True, fmt='d', cmap='Blues', ax=ax2,
                   xticklabels=["Legitimate", "Phishing"], 
                   yticklabels=["Legitimate", "Phishing"])
        ax2.set_xlabel('Predicted')
        ax2.set_ylabel('Actual')
        ax2.set_title('Combined Approach Confusion Matrix')
        
        plt.tight_layout()
        plt.savefig(os.path.join(figures_dir, 'confusion_matrices_comparison.png'))
        
        # Add more visualizations as needed
        
        # 5. Accuracy comparison bar chart
        ml_correct = (df_ml['ml_prediction'] == df_ml['expected_class']).mean() * 100
        combined_correct = (df_combined['prediction'] == df_combined['expected_class']).mean() * 100
        
        plt.figure(figsize=(10, 6))
        
        approaches = ['Raw ML Model', 'Combined Approach']
        accuracies = [ml_correct, combined_correct]
        
        bars = plt.bar(approaches, accuracies, color=['darkorange', 'green'])
        
        # Add accuracy values on top of each bar
        for bar in bars:
            height = bar.get_height()
            plt.text(bar.get_x() + bar.get_width() / 2, height + 1,
                    f'{height:.1f}%', ha='center', va='bottom', fontsize=12)
        
        plt.ylim(0, 105)  # Set y-axis to go from 0 to 100%
        plt.title('Accuracy Comparison Between Approaches')
        plt.ylabel('Accuracy (%)')
        plt.grid(axis='y', alpha=0.3)
        
        plt.savefig(os.path.join(figures_dir, 'accuracy_comparison.png'))
        
        print(f"\nVisualizations saved to: {figures_dir}")
    
    def save_benchmark_results(self, df_ml, df_combined, metrics_ml, metrics_combined):
        """Save benchmark results to files"""
        # Save dataframes
        df_ml.to_csv(os.path.join(self.results_dir, 'raw_ml_results.csv'), index=False)
        df_combined.to_csv(os.path.join(self.results_dir, 'combined_approach_results.csv'), index=False)
        
        # Save metrics
        metrics = {
            'raw_ml': metrics_ml,
            'combined': metrics_combined,
            'timestamp': self.timestamp,
            'dataset_size': len(self.dataset),
            'legitimate_urls': sum(1 for _, v in self.dataset.items() if v == 0),
            'phishing_urls': sum(1 for _, v in self.dataset.items() if v == 1)
        }
        
        with open(os.path.join(self.results_dir, 'benchmark_metrics.json'), 'w') as f:
            json.dump(metrics, f, indent=2, default=lambda x: x.tolist() if isinstance(x, np.ndarray) else x)
        
        # Generate comprehensive report
        self._generate_benchmark_report(df_ml, df_combined, metrics_ml, metrics_combined)
        
        print(f"\nAll results saved to: {self.results_dir}")

    def _generate_benchmark_report(self, df_ml, df_combined, metrics_ml, metrics_combined):
        """Generate a comprehensive benchmark report"""
        report_path = os.path.join(self.results_dir, 'benchmark_report.txt')
        
        with open(report_path, 'w') as f:
            f.write("PHISHING DETECTION BENCHMARK REPORT\n")
            f.write("=" * 60 + "\n\n")
            f.write(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Dataset Size: {len(self.dataset)} URLs\n")
            f.write(f"Legitimate URLs: {sum(1 for _, v in self.dataset.items() if v == 0)}\n")
            f.write(f"Phishing URLs: {sum(1 for _, v in self.dataset.items() if v == 1)}\n\n")
            
            f.write("PERFORMANCE COMPARISON\n")
            f.write("-" * 60 + "\n\n")
            
            # Create a table for comparison
            f.write(f"{'Metric':<20} {'Raw ML Model':<20} {'Combined Approach':<20}\n")
            f.write("-" * 60 + "\n")
            f.write(f"{'Accuracy':<20} {metrics_ml['accuracy']:.2%:<20} {metrics_combined['accuracy']:.2%:<20}\n")
            f.write(f"{'Precision':<20} {metrics_ml['precision']:.2%:<20} {metrics_combined['precision']:.2%:<20}\n")
            f.write(f"{'Recall':<20} {metrics_ml['recall']:.2%:<20} {metrics_combined['recall']:.2%:<20}\n")
            f.write(f"{'F1 Score':<20} {metrics_ml['f1_score']:.2%:<20} {metrics_combined['f1_score']:.2%:<20}\n")
            f.write(f"{'False Positive Rate':<20} {metrics_ml['false_positive_rate']:.2%:<20} {metrics_combined['false_positive_rate']:.2%:<20}\n")
            f.write(f"{'False Negative Rate':<20} {metrics_ml['false_negative_rate']:.2%:<20} {metrics_combined['false_negative_rate']:.2%:<20}\n")
            
            # Add recommendations section
            f.write("\nRECOMMENDATIONS\n")
            f.write("-" * 60 + "\n")
            
            if metrics_ml['accuracy'] > metrics_combined['accuracy']:
                f.write("• The raw ML model outperforms the combined approach in terms of accuracy.\n")
                f.write("  Consider using the raw ML model directly for classification.\n\n")
            elif metrics_combined['accuracy'] > metrics_ml['accuracy']:
                f.write("• The combined approach outperforms the raw ML model in terms of accuracy.\n")
                f.write("  The current system's approach of combining risk scores with ML predictions is effective.\n\n")

def main():
    """Run the benchmark process"""
    print("Initializing benchmark...")
    benchmark = ModelBenchmark()
    
    print("Running benchmark...")
    metrics_ml, metrics_combined = benchmark.benchmark_model()
    
    print("\nBenchmark Summary:")
    print(f"Raw ML Model Accuracy: {metrics_ml['accuracy']:.2%}")
    print(f"Combined Approach Accuracy: {metrics_combined['accuracy']:.2%}")
    print(f"Difference: {abs(metrics_ml['accuracy'] - metrics_combined['accuracy']):.2%}")
    
    print("Benchmark completed.")
    return metrics_ml, metrics_combined

if __name__ == "__main__":
    main()
