import os
import sys
import json
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from urllib.parse import urlparse
from joblib import load
from sklearn.metrics import classification_report, confusion_matrix, precision_recall_curve, roc_curve, auc
from utils.feature_extractor import URLFeatureExtractor

# Define the ground truth for benchmark URLs (expanded benchmark set)
BENCHMARK_URLS = {
    # Legitimate URLs (class 0)
    "https://www.google.com": 0,
    "https://www.microsoft.com": 0,
    "https://www.apple.com": 0, 
    "https://www.amazon.com": 0,
    "https://www.facebook.com": 0,
    "https://www.youtube.com": 0,
    "https://www.twitter.com": 0,
    "https://www.instagram.com": 0,
    "https://www.netflix.com": 0,
    "https://www.linkedin.com": 0,
    "https://www.github.com": 0,
    "https://www.stackoverflow.com": 0,
    "https://www.wikipedia.org": 0,
    "https://www.reddit.com": 0,
    "https://www.nytimes.com": 0,
    "https://www.cnn.com": 0,
    "https://www.bbc.com": 0,
    "https://www.weather.com": 0,
    "https://www.nasa.gov": 0,
    "https://www.who.int": 0,
    "https://www.mit.edu": 0,
    "https://www.harvard.edu": 0,
    "https://www.stanford.edu": 0,
    "https://www.toyota.com": 0,
    "https://www.bmw.com": 0,
    "https://www.nike.com": 0,
    "https://www.adidas.com": 0,
    "https://www.steam.com": 0,
    "https://www.spotify.com": 0,
    "https://www.wordpress.org": 0,
    "https://www.dropbox.com": 0,
    "https://www.salesforce.com": 0,
    "https://www.adobe.com": 0,
    "https://www.ebay.com": 0,
    "https://www.paypal.com": 0,
    "https://www.walmart.com": 0,
    "https://www.target.com": 0,
    "https://www.imdb.com": 0,
    "https://www.whatsapp.com": 0,
    "https://www.zoom.us": 0,
    "https://www.slack.com": 0,
    "https://www.discord.com": 0,
    "https://www.twitch.tv": 0,
    "https://www.uber.com": 0,
    "https://www.airbnb.com": 0,
    "https://www.booking.com": 0,
    "https://www.expedia.com": 0,
    "https://www.npr.org": 0,
    "https://www.nba.com": 0,
    "https://www.fifa.com": 0,
    
    # Phishing URLs (class 1) from PhishTank
    # Manually copy recent verified phishing URLs from https://phishtank.org/phish_archive.php?page=1
    # Example format:
    # "https://actual-phishing-url.example": 1,
    
    # Note: The following URLs were previously marked as legitimate (0) but appear to be potentially malicious
    # Consider reviewing these classifications:
    "https://linater.com": 1,  # Changed from 0 to 1
    "https://cpamassurance.com/index.php": 1,  # Changed from 0 to 1
    "https://cpamassurance.com/home/": 1,  # Changed from 0 to 1
    "https://cpamassurance.com/": 1,  # Changed from 0 to 1
    "https://abodisney-plus.com/how/calcul.php": 1,  # Changed from 0 to 1
    "https://www.onlinebgr.vip/": 1,  # Changed from 0 to 1
    "https://www.com-tolleix.icu/": 1,  # Changed from 0 to 1
    "https://www.com-tolleis.icu/": 1,  # Changed from 0 to 1
    "https://www.com-tolleiq.icu/": 1,  # Changed from 0 to 1
    "https://uusdlx.top/": 1,  # Changed from 0 to 1
    "https://uusdlb.top/": 1,  # Changed from 0 to 1
    "https://uusdla.top/": 1,  # Changed from 0 to 1
    "https://usps.com-aybap.vip/": 1,  # Changed from 0 to 1
     

    # Additional phishing URLs from recent dataset
    "https://trezorwallertuc.webflow.io/": 1,
    "http://trezorwallertuc.webflow.io": 1,
    "https://davisinteriordesigner.com/tuny/": 1,
    "http://new.valadar.ru/shiftlessly/derivator": 1,
    "http://allegrolokalniepl.89518934189519.sbs": 1,
    "https://allegrolokalnie.pl-65567845.cfd": 1,
    "http://allegrolokalnie.pll-oferta-firmowa869204.icu": 1,
    "https://allegrolokalnie.oferta-048262.shop": 1,
    "https://allegrolokalnie.pll-oferta-firmowa857419.icu": 1,
    "https://dsfgfhdsftrytuyi675erdgfhguyi8675645etdfyguyiuiytfrdsd222.pages.dev": 1,
    "https://202307051011295385924.onamaeweb.jp/ionos.html": 1,
    "https://dbukyjvrcgykn.xyz/pulglink/": 1,
    "https://bycbmcmhxdqxx.xyz/pulglink/": 1,
    "https://bvenchpwlkqsg.xyz/pulglink/": 1,
    "https://aapjhfrtlcbgm.xyz/pulglink/": 1,
    "https://gdmwynylnpdrh.xyz/pulglink/": 1,
    "https://fzdwphetcphyk.xyz/pulglink/": 1,
    "https://fhncoxpjtmeoq.xyz/pulglink/": 1,
    "https://fcgy.weeblysite.com/": 1,
    "https://charitable-act.org/86689144638.htm": 1,
    "https://knowledgeable-west-taleggio.glitch.me/public/login.ea0f.html": 1,
    "https://meimaibook.s3.us-east-1.amazonaws.com/onedrive.html": 1,
    "https://sbcglobal-net-158882.webflow.io/": 1,
    "https://wfppsatzgtzkoykm.magaka7182.workers.dev/": 1,
    "https://ruideoklauswestphal.aafde5931dd29f9f4279.getmyip.com/": 1,
    "https://nsaskuggdwfifzok.magaka7182.workers.dev": 1,
    "https://getkunden.sbs/ak/login.php": 1,
    "https://dkbidentifikation.su/de/Transaktionsverifizierung/": 1,
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
}

class RawMLBenchmark:
    def __init__(self):
        self.current_dir = os.path.dirname(os.path.abspath(__file__))
        self.output_dir = os.path.join(self.current_dir, 'machine learning', 'raw_ml_benchmark')
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Load ML components
        self._load_model()
        
    def _load_model(self):
        """Load ML model and related components"""
        try:
            # Try to load the v5 model first
            model_path = os.path.join(self.current_dir, 'machine learning', 'url_model_v5.pkl')
            scaler_path = os.path.join(self.current_dir, 'machine learning', 'scaler_v5.pkl')
            
            # Look for v5 feature names first, then fallback
            feature_names_paths = [
                os.path.join(self.current_dir, 'machine learning', 'feature_names_v5.pkl'),
                os.path.join(self.current_dir, 'machine learning', 'dataset', 'feature_names.pkl'),
                os.path.join(self.current_dir, 'machine learning', 'feature_names.pkl')
            ]
            
            # Try to load the model
            try:
                self.model = load(model_path)
                self.scaler = load(scaler_path)
                print(f"Successfully loaded model v5 from {model_path}")
            except:
                # Fallback to v4 model
                model_path = os.path.join(self.current_dir, 'machine learning', 'url_model_v4.pkl')
                scaler_path = os.path.join(self.current_dir, 'machine learning', 'scaler_v4.pkl')
                self.model = load(model_path)
                self.scaler = load(scaler_path)
                print(f"Fell back to model v4 from {model_path}")
            
            # Try to load feature names from different possible locations
            feature_names = None
            for path in feature_names_paths:
                try:
                    if os.path.exists(path):
                        feature_names = load(path)
                        print(f"Loaded feature names from {path}")
                        break
                except Exception as e:
                    print(f"Error loading feature names from {path}: {e}")
            
            if not feature_names:
                raise ValueError("Could not load feature names from any location")
                
            self.feature_names = feature_names
            print(f"Model loaded with {len(self.feature_names)} features")
            return True
            
        except Exception as e:
            print(f"Error loading model: {str(e)}")
            return False
    
    def benchmark_raw_ml(self, urls_dict, threshold=0.5):
        """Run benchmark on the raw ML model predictions"""
        extractor = URLFeatureExtractor()
        results = []
        
        print(f"\nBenchmarking raw ML model on {len(urls_dict)} URLs...")
        
        for url, expected_class in urls_dict.items():
            try:
                print(f"\nTesting URL: {url}")
                print(f"Expected: {'Phishing' if expected_class == 1 else 'Legitimate'}")
                
                # Extract features
                features = extractor.extract_features(url)
                if not features:
                    print("Failed to extract features")
                    continue
                
                # Prepare feature vector in correct order
                feature_vector = []
                for feature in self.feature_names:
                    value = features.get(feature, 0)
                    feature_vector.append(value)
                
                # Scale features - ensure dimension matches
                try:
                    features_scaled = self.scaler.transform([feature_vector])
                except ValueError as e:
                    print(f"Warning: Scaling error - {str(e)}")
                    print(f"Expected {len(feature_vector)} features, but scaler expects {self.scaler.n_features_in_}")
                    
                    # If model expects fewer features, truncate the vector
                    if hasattr(self.scaler, 'n_features_in_') and len(feature_vector) > self.scaler.n_features_in_:
                        print(f"Truncating feature vector to {self.scaler.n_features_in_} features")
                        feature_vector = feature_vector[:self.scaler.n_features_in_]
                        features_scaled = self.scaler.transform([feature_vector])
                    # If model expects more features, pad with zeros
                    elif hasattr(self.scaler, 'n_features_in_') and len(feature_vector) < self.scaler.n_features_in_:
                        print(f"Padding feature vector from {len(feature_vector)} to {self.scaler.n_features_in_} features")
                        feature_vector = feature_vector + [0] * (self.scaler.n_features_in_ - len(feature_vector))
                        features_scaled = self.scaler.transform([feature_vector])
                    else:
                        # If we can't determine what's expected, raise the error
                        raise
                
                # Get raw ML predictions
                try:
                    # Try to get raw probability
                    if hasattr(self.model, 'predict_proba'):
                        raw_probabilities = self.model.predict_proba(features_scaled)[0]
                        raw_prediction = self.model.predict(features_scaled)[0]
                        
                        legitimate_probability = raw_probabilities[0]
                        phishing_probability = raw_probabilities[1]
                    else:
                        # Handle LightGBM native models
                        phishing_probability = float(self.model.predict(features_scaled)[0])
                        legitimate_probability = 1.0 - phishing_probability
                        raw_prediction = 1 if phishing_probability > threshold else 0
                    
                    # Apply threshold to probability to get class
                    predicted_class = 1 if phishing_probability > threshold else 0
                    
                except Exception as e:
                    print(f"Warning: Prediction error - {str(e)}")
                    # Try direct predict as fallback
                    raw_prediction = self.model.predict(features_scaled)[0]
                    predicted_class = int(raw_prediction)
                    phishing_probability = float(raw_prediction) 
                    legitimate_probability = 1.0 - phishing_probability
                
                confidence = max(legitimate_probability, phishing_probability)
                is_correct = predicted_class == expected_class
                
                # Store result
                result = {
                    'url': url,
                    'domain': urlparse(url).netloc,
                    'expected_class': expected_class,
                    'ml_prediction': predicted_class,
                    'correct': is_correct,
                    'confidence': confidence,
                    'phishing_probability': phishing_probability,
                    'legitimate_probability': legitimate_probability,
                    'length_url': features.get('length_url', 0),
                    'directory_length': features.get('directory_length', 0),
                    'domain_in_ip': features.get('domain_in_ip', 0),
                    'tls_ssl_certificate': features.get('tls_ssl_certificate', 0)
                }
                
                results.append(result)
                
                # Print result
                print(f"Raw ML prediction: {'Phishing' if predicted_class == 1 else 'Legitimate'}")
                print(f"Phishing probability: {phishing_probability:.4f}")
                print(f"Confidence: {confidence:.4f}")
                print(f"Result: {'✓ Correct' if is_correct else '✗ Incorrect'}")
                
            except Exception as e:
                print(f"Error analyzing {url}: {str(e)}")
                continue
                
        return results
    
    def analyze_results(self, results, threshold=0.5):
        """Analyze benchmark results"""
        df = pd.DataFrame(results)
        
        # Basic metrics
        accuracy = df['correct'].mean()
        y_true = df['expected_class'].values
        y_pred = df['ml_prediction'].values
        y_prob = df['phishing_probability'].values
        
        # Calculate metrics
        cm = confusion_matrix(y_true, y_pred)
        
        # Split datasets
        legitimate_df = df[df['expected_class'] == 0]
        phishing_df = df[df['expected_class'] == 1]
        
        # Calculate false positive and negative rates
        false_positives = legitimate_df[legitimate_df['ml_prediction'] == 1]
        false_negatives = phishing_df[phishing_df['ml_prediction'] == 0]
        
        fpr = len(false_positives) / len(legitimate_df) if len(legitimate_df) > 0 else 0
        fnr = len(false_negatives) / len(phishing_df) if len(phishing_df) > 0 else 0
        
        # Print summary
        print("\n=== ML Model Performance Summary ===")
        print(f"Model accuracy: {accuracy:.2%}")
        print(f"False positive rate: {fpr:.2%}")
        print(f"False negative rate: {fnr:.2%}")
        
        print("\nConfusion Matrix:")
        print(cm)
        
        print("\nClassification Report:")
        print(classification_report(y_true, y_pred, target_names=["Legitimate", "Phishing"]))
        
        # ROC curve
        try:
            fpr_curve, tpr_curve, _ = roc_curve(y_true, y_prob)
            roc_auc = auc(fpr_curve, tpr_curve)
            print(f"ROC AUC: {roc_auc:.4f}")
        except:
            print("Could not calculate ROC AUC")
        
        # Print misclassified URLs
        print("\nMisclassified URLs:")
        misclassified = df[~df['correct']]
        for _, row in misclassified.iterrows():
            print(f"  URL: {row['url']}")
            print(f"    Expected: {'Phishing' if row['expected_class'] == 1 else 'Legitimate'}")
            print(f"    Predicted: {'Phishing' if row['ml_prediction'] == 1 else 'Legitimate'}")
            print(f"    Phishing Probability: {row['phishing_probability']:.4f}")
        
        # Create visualizations
        self.generate_visualizations(df, cm, threshold)
        
        return accuracy, fpr, fnr, cm
        
    def generate_visualizations(self, df, cm, threshold=0.5):
        """Generate visualization charts"""
        try:
            # Create figures directory
            figures_dir = os.path.join(self.output_dir, 'figures')
            os.makedirs(figures_dir, exist_ok=True)
            
            # 1. Confusion Matrix
            plt.figure(figsize=(8, 6))
            sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                       xticklabels=["Legitimate", "Phishing"], 
                       yticklabels=["Legitimate", "Phishing"])
            plt.xlabel('Predicted')
            plt.ylabel('Actual')
            plt.title('Raw ML Model Confusion Matrix')
            plt.tight_layout()
            plt.savefig(os.path.join(figures_dir, 'raw_ml_confusion_matrix.png'))
            
            # 2. Probability Distribution
            plt.figure(figsize=(10, 6))
            sns.histplot(data=df, x='phishing_probability', hue='expected_class', 
                        bins=20, element='step',
                        palette={0: 'green', 1: 'red'})
            plt.axvline(x=threshold, color='black', linestyle='--', label='Threshold')
            plt.title('ML Phishing Probability Distribution')
            plt.xlabel('Phishing Probability')
            plt.ylabel('Count')
            plt.legend(title='URL Type', labels=['Threshold', 'Legitimate', 'Phishing'])
            plt.tight_layout()
            plt.savefig(os.path.join(figures_dir, 'raw_ml_probability.png'))
            
            # 3. ROC Curve
            try:
                y_true = df['expected_class'].values
                y_prob = df['phishing_probability'].values
                fpr_curve, tpr_curve, _ = roc_curve(y_true, y_prob)
                roc_auc = auc(fpr_curve, tpr_curve)
                
                plt.figure(figsize=(8, 6))
                plt.plot(fpr_curve, tpr_curve, color='darkorange', lw=2, label=f'ROC curve (AUC = {roc_auc:.2f})')
                plt.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--')
                plt.xlim([0.0, 1.0])
                plt.ylim([0.0, 1.05])
                plt.xlabel('False Positive Rate')
                plt.ylabel('True Positive Rate')
                plt.title('Receiver Operating Characteristic')
                plt.legend(loc="lower right")
                plt.tight_layout()
                plt.savefig(os.path.join(figures_dir, 'raw_ml_roc.png'))
            except Exception as e:
                print(f"Could not generate ROC curve: {str(e)}")
            
            # 4. Feature importance (if available)
            if hasattr(self.model, 'feature_importances_'):
                top_n = 20  # Show top 20 features
                
                importances = self.model.feature_importances_
                indices = np.argsort(importances)[::-1]
                
                plt.figure(figsize=(12, 8))
                top_indices = indices[:top_n]
                plt.title('Top 20 Feature Importances')
                plt.barh(range(top_n), importances[top_indices], align='center')
                plt.yticks(range(top_n), [self.feature_names[i] for i in top_indices])
                plt.gca().invert_yaxis()  # Display highest at the top
                plt.xlabel('Relative Importance')
                plt.tight_layout()
                plt.savefig(os.path.join(figures_dir, 'feature_importance.png'))
                
                # Save feature importances to CSV
                importance_df = pd.DataFrame({
                    'feature': self.feature_names,
                    'importance': importances
                }).sort_values('importance', ascending=False)
                
                importance_df.to_csv(os.path.join(self.output_dir, 'feature_importance.csv'), index=False)
            
            print(f"\nVisualizations saved to: {figures_dir}")
            
        except Exception as e:
            print(f"Error generating visualizations: {str(e)}")
    
    def threshold_analysis(self, results):
        """Analyze different threshold values for optimal performance"""
        df = pd.DataFrame(results)
        y_true = df['expected_class'].values
        y_prob = df['phishing_probability'].values
        
        # Test different threshold values
        thresholds = np.arange(0.1, 1.0, 0.05)
        threshold_results = []
        
        print("\n=== Threshold Analysis ===")
        print("Finding optimal threshold for classification...")
        
        for threshold in thresholds:
            # Apply threshold
            y_pred = (y_prob >= threshold).astype(int)
            
            # Calculate metrics
            accuracy = (y_pred == y_true).mean()
            
            # Calculate FPR and FNR
            leg_indices = y_true == 0
            phish_indices = y_true == 1
            
            fpr = np.mean(y_pred[leg_indices] == 1) if np.any(leg_indices) else 0
            fnr = np.mean(y_pred[phish_indices] == 0) if np.any(phish_indices) else 0
            
            # Calculate balanced accuracy
            balanced_acc = 0.5 * ((1 - fpr) + (1 - fnr))
            
            threshold_results.append({
                'threshold': threshold,
                'accuracy': accuracy,
                'fpr': fpr,
                'fnr': fnr,
                'balanced_accuracy': balanced_acc
            })
        
        # Convert to DataFrame
        threshold_df = pd.DataFrame(threshold_results)
        
        # Find optimal threshold based on balanced accuracy
        optimal_row = threshold_df.loc[threshold_df['balanced_accuracy'].idxmax()]
        optimal_threshold = optimal_row['threshold']
        
        print(f"\nOptimal threshold: {optimal_threshold:.2f}")
        print(f"At this threshold:")
        print(f"  Accuracy: {optimal_row['accuracy']:.2%}")
        print(f"  False Positive Rate: {optimal_row['fpr']:.2%}")
        print(f"  False Negative Rate: {optimal_row['fnr']:.2%}")
        print(f"  Balanced Accuracy: {optimal_row['balanced_accuracy']:.2%}")
        
        # Visualize threshold analysis
        try:
            plt.figure(figsize=(10, 6))
            plt.plot(threshold_df['threshold'], threshold_df['accuracy'], label='Accuracy')
            plt.plot(threshold_df['threshold'], threshold_df['fpr'], label='False Positive Rate')
            plt.plot(threshold_df['threshold'], threshold_df['fnr'], label='False Negative Rate')
            plt.plot(threshold_df['threshold'], threshold_df['balanced_accuracy'], label='Balanced Accuracy')
            plt.axvline(x=optimal_threshold, color='black', linestyle='--', label=f'Optimal Threshold ({optimal_threshold:.2f})')
            plt.xlabel('Threshold')
            plt.ylabel('Rate')
            plt.title('Performance Metrics by Threshold')
            plt.legend()
            plt.grid(True)
            plt.tight_layout()
            plt.savefig(os.path.join(self.output_dir, 'figures', 'threshold_analysis.png'))
            
            # Save threshold analysis to CSV
            threshold_df.to_csv(os.path.join(self.output_dir, 'threshold_analysis.csv'), index=False)
            
        except Exception as e:
            print(f"Error generating threshold visualization: {str(e)}")
        
        return optimal_threshold, threshold_df

def load_urls_from_csv(csv_path):
    """Load URLs from a CSV file with url,is_phishing columns"""
    try:
        df = pd.read_csv(csv_path)
        if 'url' not in df.columns or 'is_phishing' not in df.columns:
            print("CSV must have 'url' and 'is_phishing' columns")
            return None
            
        urls_dict = dict(zip(df['url'], df['is_phishing']))
        return urls_dict
    except Exception as e:
        print(f"Error loading URLs from CSV: {str(e)}")
        return None

def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Benchmark raw ML model predictions')
    parser.add_argument('--csv', type=str, help='Path to CSV file with URLs to test')
    parser.add_argument('--threshold', type=float, default=0.5, 
                        help='Probability threshold for classification (default: 0.5)')
    parser.add_argument('--optimize-threshold', action='store_true', 
                        help='Run threshold optimization analysis')
    
    args = parser.parse_args()
    
    # Initialize benchmark
    benchmark = RawMLBenchmark()
    
    # Load URLs
    if args.csv:
        urls_dict = load_urls_from_csv(args.csv)
        if not urls_dict:
            print("Using default benchmark URLs")
            urls_dict = BENCHMARK_URLS
    else:
        urls_dict = BENCHMARK_URLS
    
    # Run benchmark
    results = benchmark.benchmark_raw_ml(urls_dict, args.threshold)
    
    # Analyze results
    benchmark.analyze_results(results, args.threshold)
    
    # Run threshold optimization if requested
    if args.optimize_threshold:
        optimal_threshold, _ = benchmark.threshold_analysis(results)
        
        # Re-analyze with optimal threshold if different
        if abs(optimal_threshold - args.threshold) > 0.01:
            print(f"\n=== Re-analyzing with optimal threshold {optimal_threshold:.2f} ===")
            benchmark.analyze_results(results, optimal_threshold)

if __name__ == "__main__":
    main()

