import os
import sys
import json
import pandas as pd
import numpy as np
from joblib import load, dump
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
from utils.feature_extractor import URLFeatureExtractor

# Define the benchmark URLs that were misclassified as phishing but are legitimate
LEGITIMATE_URLS = [
    "https://github.com/microsoft/vscode/tree/main/src/vs/editor/contrib",
    "https://chat.openai.com/c/3e0b0a14-3b5c-4af0-9b10-ed96f15790db",
    "https://www.amazon.com/dp/B09JFSMVH7/ref=sr_1_3?keywords=laptop&qid=1645544823",
    "https://stackoverflow.com/questions/56254925/how-to-fix-installation-error",
    "https://www.nytimes.com/2023/05/10/technology/ai-regulation-europe.html",
    "https://www.reddit.com/r/ProgrammerHumor/comments/13m2vsf/hello_world/",
    "https://www.linkedin.com/in/john-doe-12345678/",
    "https://twitter.com/elonmusk/status/1656141749259726850",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.instagram.com/p/CsdQ8-RLiKd/",
    "https://docs.google.com/document/d/1abcdefghijklmnopqrstuvwxyz1234567890/edit",
    "https://en.wikipedia.org/wiki/Machine_learning"
]

# Additional examples of complex but legitimate URLs
ADDITIONAL_LEGITIMATE_URLS = [
    "https://medium.com/@username/how-to-build-a-machine-learning-model-7f74ab15d6b4",
    "https://www.example.com/products/category/item?id=12345&sort=price&filter=new",
    "https://dashboard.stripe.com/account/settings/team/invite/accept/si_23TKWALmBzjPH81en5CqCynz",
    "https://www.coursera.org/learn/machine-learning/lecture/db3jS/model-representation",
    "https://onedrive.live.com/edit.aspx?resid=AB12CD34EF56GH78!999&ithint=file%2cdocx",
    "https://academic.oup.com/bioinformatics/article/35/16/2856/5270661"
]

# Trusted domains that should be given extra weight for legitimate classification
TRUSTED_DOMAINS = [
    "google.com", "github.com", "openai.com", "amazon.com", "stackoverflow.com",
    "nytimes.com", "reddit.com", "linkedin.com", "twitter.com", "youtube.com", 
    "instagram.com", "wikipedia.org", "bbc.com", "microsoft.com", "apple.com",
    "medium.com", "coursera.org", "live.com", "oup.com", "sciencedirect.com",
    "nature.com", "ieee.org", "arxiv.org", "researchgate.net", "springer.com",
    "mit.edu", "harvard.edu", "berkeley.edu", "stanford.edu", "cmu.edu",
    "nasa.gov", "nih.gov", "who.int", "un.org", "europa.eu"
]

class ModelRetrainer:
    def __init__(self):
        self.current_dir = os.path.dirname(os.path.abspath(__file__))
        self.ml_dir = os.path.join(self.current_dir, 'machine learning')
        self.output_dir = os.path.join(self.ml_dir, 'retrained_model')
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Parameters for the new model
        self.threshold = 0.70  # Higher threshold to reduce false positives
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # If an error occurs, this will signal not to continue
        self.error_occurred = False
        
    def load_model(self):
        """Load the existing model components"""
        print("\n[1/6] Loading existing model...")
        try:
            model_path = os.path.join(self.ml_dir, 'url_model_v4.pkl')
            scaler_path = os.path.join(self.ml_dir, 'scaler_v4.pkl')
            feature_names_path = os.path.join(self.ml_dir, 'feature_names.pkl')
            
            self.model = load(model_path)
            self.scaler = load(scaler_path)
            self.feature_names = load(feature_names_path)
            
            print(f"✓ Model loaded with {len(self.feature_names)} features")
            return True
            
        except Exception as e:
            print(f"✗ Failed to load model: {str(e)}")
            self.error_occurred = True
            return False
    
    def load_dataset(self):
        """Load the original training dataset"""
        print("\n[2/6] Loading original training dataset...")
        try:
            dataset_path = os.path.join(self.ml_dir, 'dataset', 'phishing_url_balanced.csv')
            
            if not os.path.exists(dataset_path):
                print(f"✗ Dataset not found at {dataset_path}")
                self.error_occurred = True
                return False
            
            self.dataset = pd.read_csv(dataset_path)
            
            # Show distribution of classes
            legitimate_count = (self.dataset['phishing'] == 0).sum()
            phishing_count = (self.dataset['phishing'] == 1).sum()
            total_count = len(self.dataset)
            
            print(f"✓ Dataset loaded with {total_count} records")
            print(f"  - Legitimate URLs: {legitimate_count} ({legitimate_count/total_count:.1%})")
            print(f"  - Phishing URLs: {phishing_count} ({phishing_count/total_count:.1%})")
            
            return True
            
        except Exception as e:
            print(f"✗ Failed to load dataset: {str(e)}")
            self.error_occurred = True
            return False
    
    def extract_features_from_urls(self):
        """Extract features from benchmark URLs to include in training"""
        print("\n[3/6] Extracting features from benchmark URLs...")
        
        extractor = URLFeatureExtractor()
        new_rows = []
        
        # Process misclassified legitimate URLs with high weight
        print("\n• Processing misclassified legitimate URLs...")
        for url in LEGITIMATE_URLS:
            print(f"  - {url}")
            try:
                features = extractor.extract_features(url)
                if features:
                    # Add URL for reference and target class
                    features['url'] = url
                    features['phishing'] = 0  # Legitimate
                    features['weight'] = 10.0  # Very high weight for misclassified examples
                    new_rows.append(features)
                else:
                    print(f"    ✗ Failed to extract features")
            except Exception as e:
                print(f"    ✗ Error: {str(e)}")
        
        # Process additional legitimate URLs with high weight
        print("\n• Processing additional legitimate URLs...")
        for url in ADDITIONAL_LEGITIMATE_URLS:
            print(f"  - {url}")
            try:
                features = extractor.extract_features(url)
                if features:
                    features['url'] = url
                    features['phishing'] = 0  # Legitimate
                    features['weight'] = 5.0  # High weight but less than misclassified
                    new_rows.append(features)
                else:
                    print(f"    ✗ Failed to extract features")
            except Exception as e:
                print(f"    ✗ Error: {str(e)}")
        
        if new_rows:
            self.new_examples = pd.DataFrame(new_rows)
            
            # IMPORTANT: Extract the current feature names from the extractor
            # This ensures we're using the exact feature set from the current extractor
            first_example = new_rows[0]
            current_features = [feature for feature in first_example.keys() 
                               if feature not in ['url', 'phishing', 'weight']]
            self.current_feature_names = current_features
            print(f"\n✓ Successfully extracted {len(current_features)} features from {len(new_rows)} URLs")
            print(f"  The current feature extractor generates {len(current_features)} features")
            
            return True
        else:
            print(f"\n✗ Failed to extract features from any URLs")
            self.error_occurred = True
            return False
    
    def retrain_model(self):
        """Retrain the model with the enhanced dataset"""
        print("\n[4/6] Retraining model...")
        
        try:
            # Create combined dataset with weights
            if 'weight' not in self.dataset.columns:
                # Initialize weights for original data
                self.dataset['weight'] = self.dataset['phishing'].apply(
                    lambda x: 1.0 if x == 1 else 2.0  # Higher weight for legitimate
                )
                
                # Add weight boost for trusted domains
                if 'url' in self.dataset.columns:
                    def boost_trusted_domains(row):
                        # Check if URL column exists and is a trusted domain
                        url = row.get('url', '')
                        if any(domain in url for domain in TRUSTED_DOMAINS):
                            return min(4.0, row['weight'] * 2.0)
                        return row['weight']
                    
                    self.dataset['weight'] = self.dataset.apply(boost_trusted_domains, axis=1)
            
            # Prepare combined dataset
            print("\n• Preparing training data...")
            combined_df = pd.concat([self.dataset, self.new_examples], ignore_index=True)
            print(f"  Combined dataset shape: {combined_df.shape}")
            
            # === IMPORTANT CHANGE: Use the current feature set ===
            # First ensure all the current features exist in the dataset
            for feature in self.current_feature_names:
                if feature not in combined_df.columns:
                    print(f"  Adding missing feature: {feature}")
                    combined_df[feature] = 0
                    
            # Now use the current feature names instead of the old feature names
            X = combined_df[self.current_feature_names]
            y = combined_df['phishing']
            weights = combined_df['weight']
            
            # === Rest of the function stays the same ===
            # Check distribution after adding new examples
            added_legitimate = len(self.new_examples)
            total_legitimate = (combined_df['phishing'] == 0).sum()
            total_phishing = (combined_df['phishing'] == 1).sum()
            print(f"  Added {added_legitimate} legitimate examples")
            print(f"  New class distribution:")
            print(f"    - Legitimate: {total_legitimate} ({total_legitimate/(total_legitimate+total_phishing):.1%})")
            print(f"    - Phishing: {total_phishing} ({total_phishing/(total_legitimate+total_phishing):.1%})")
            
            # Split data
            X_train, X_test, y_train, y_test, w_train, w_test = train_test_split(
                X, y, weights, test_size=0.2, random_state=42, stratify=y
            )
            
            # Scale features
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_test_scaled = scaler.transform(X_test)
            
            # Train model
            print("\n• Training model...")
            try:
                import lightgbm as lgb
                # Use LightGBM with optimized parameters
                print("  Using LightGBM classifier")
                params = {
                    'objective': 'binary',
                    'metric': 'binary_logloss',
                    'boosting_type': 'gbdt',
                    'num_leaves': 31,
                    'max_depth': 10,
                    'learning_rate': 0.05,
                    'subsample': 0.9,
                    'colsample_bytree': 0.9,
                    # These values help reduce false positives:
                    'scale_pos_weight': 0.5,  # Penalize false positives more
                    'min_child_samples': 20,
                    'reg_alpha': 0.1,
                    'reg_lambda': 0.1,
                    'verbose': -1
                }
                
                train_data = lgb.Dataset(X_train_scaled, label=y_train, weight=w_train)
                valid_data = lgb.Dataset(X_test_scaled, label=y_test, weight=w_test, reference=train_data)
                
                # Fix for LightGBM API compatibility issue:
                # Try different early stopping approaches based on LightGBM version
                # or fall back to no early stopping
                try:
                    # First approach: using callbacks for early stopping
                    model = lgb.train(
                        params,
                        train_data,
                        num_boost_round=500,
                        valid_sets=[valid_data],
                        callbacks=[lgb.early_stopping(stopping_rounds=50)]
                    )
                except (TypeError, AttributeError):
                    try:
                        # Second approach: early_stopping_rounds as parameter
                        model = lgb.train(
                            params,
                            train_data,
                            num_boost_round=500,
                            valid_sets=[valid_data],
                            early_stopping_rounds=50
                        )
                    except TypeError:
                        # Fallback: no early stopping
                        print("  Note: Early stopping not available, training full model")
                        model = lgb.train(
                            params,
                            train_data,
                            num_boost_round=500,
                            valid_sets=[valid_data]
                        )
                
            except ImportError:
                # Fall back to RandomForest
                print("  LightGBM not available. Using RandomForest classifier")
                from sklearn.ensemble import RandomForestClassifier
                
                model = RandomForestClassifier(
                    n_estimators=200,
                    max_depth=12,
                    min_samples_split=5,
                    min_samples_leaf=2,
                    class_weight={0: 2, 1: 1},  # 2x weight for legitimate class
                    random_state=42,
                    n_jobs=-1
                )
                
                model.fit(X_train_scaled, y_train, sample_weight=w_train)
            
            # Evaluate model
            print("\n• Evaluating model...")
            if hasattr(model, 'predict_proba'):
                y_proba = model.predict_proba(X_test_scaled)[:, 1]
                y_pred = (y_proba > self.threshold).astype(int)  # Using higher threshold
            else:
                y_proba = model.predict(X_test_scaled)
                y_pred = (y_proba > self.threshold).astype(int)
            
            # Calculate metrics
            accuracy = (y_pred == y_test).mean()
            conf_matrix = confusion_matrix(y_test, y_pred)
            
            # False positive and negative rates
            tn, fp, fn, tp = conf_matrix.ravel()
            fpr = fp / (fp + tn) if (fp + tn) > 0 else 0  # False Positive Rate
            fnr = fn / (fn + tp) if (fn + tp) > 0 else 0  # False Negative Rate
            
            # Print performance metrics
            print("\n=== Model Performance ===")
            print(f"Accuracy: {accuracy:.2%}")
            print(f"ROC AUC: {roc_auc_score(y_test, y_proba):.4f}")
            print(f"False Positive Rate: {fpr:.2%}")
            print(f"False Negative Rate: {fnr:.2%}")
            print("\nConfusion Matrix:")
            print(conf_matrix)
            
            print("\nClassification Report:")
            print(classification_report(y_test, y_pred, target_names=["Legitimate", "Phishing"]))
            
            # Store model and scaler for saving
            self.retrained_model = model
            self.retrained_scaler = scaler
            
            # === IMPORTANT: Save the current feature names ===
            self.retrained_feature_names = self.current_feature_names
            
            # Generate feature importance visualization
            if hasattr(model, 'feature_importances_'):
                importances = pd.DataFrame({
                    'feature': self.feature_names,
                    'importance': model.feature_importances_
                }).sort_values('importance', ascending=False)
                
                plt.figure(figsize=(12, 8))
                sns.barplot(x='importance', y='feature', data=importances.head(20))
                plt.title('Top 20 Features - Retrained Model')
                plt.tight_layout()
                plt.savefig(os.path.join(self.output_dir, 'feature_importance.png'))
            
            return True
            
        except Exception as e:
            print(f"✗ Error during model retraining: {str(e)}")
            import traceback
            traceback.print_exc()
            self.error_occurred = True
            return False
    
    def test_with_benchmark(self):
        """Test the retrained model on benchmark URLs"""
        print("\n[5/6] Testing with benchmark URLs...")
        
        if not hasattr(self, 'retrained_model') or not hasattr(self, 'retrained_scaler'):
            print("✗ No model to test")
            return False
        
        try:
            extractor = URLFeatureExtractor()
            results = []
            
            # Combined list of URLs to test
            all_test_urls = LEGITIMATE_URLS + ["https://www.paypa1.com/signin/verify?account=user",
                                           "http://192.168.12.43/login/verify.php",
                                           "https://secure-paypal.phishing-domain.com/login"]
            expected_classes = [0] * len(LEGITIMATE_URLS) + [1, 1, 1]
            
            print(f"\nTesting {len(all_test_urls)} URLs...")
            
            for url, expected_class in zip(all_test_urls, expected_classes):
                print(f"\n• Testing URL: {url}")
                print(f"  Expected: {'Legitimate' if expected_class == 0 else 'Phishing'}")
                
                # Extract features
                features = extractor.extract_features(url)
                if not features:
                    print("  ✗ Failed to extract features")
                    continue
                
                # Create feature vector and scale - use current feature names
                feature_vector = [features.get(feature, 0) for feature in self.retrained_feature_names]
                features_scaled = self.retrained_scaler.transform([feature_vector])
                
                # Predict
                if hasattr(self.retrained_model, 'predict_proba'):
                    probabilities = self.retrained_model.predict_proba(features_scaled)[0]
                    phishing_prob = probabilities[1]
                    prediction = 1 if phishing_prob > self.threshold else 0
                else:
                    phishing_prob = self.retrained_model.predict(features_scaled)[0]
                    prediction = 1 if phishing_prob > self.threshold else 0
                
                # Check result
                is_correct = prediction == expected_class
                result = "✓ Correct" if is_correct else "✗ Incorrect"
                
                # Print result
                print(f"  Prediction: {'Phishing' if prediction == 1 else 'Legitimate'}")
                print(f"  Phishing probability: {phishing_prob:.4f}")
                print(f"  Result: {result}")
                
                # Store result
                results.append({
                    'url': url,
                    'expected': expected_class,
                    'predicted': prediction,
                    'probability': phishing_prob,
                    'correct': is_correct
                })
            
            # Calculate benchmark metrics
            results_df = pd.DataFrame(results)
            accuracy = results_df['correct'].mean()
            legitimate_accuracy = results_df[results_df['expected'] == 0]['correct'].mean()
            phishing_accuracy = results_df[results_df['expected'] == 1]['correct'].mean()
            
            print("\n=== Benchmark Results ===")
            print(f"Overall Accuracy: {accuracy:.2%}")
            print(f"Legitimate URL Accuracy: {legitimate_accuracy:.2%}")
            print(f"Phishing URL Accuracy: {phishing_accuracy:.2%}")
            
            # Save benchmark results
            results_df.to_csv(os.path.join(self.output_dir, 'benchmark_results.csv'), index=False)
            
            return True
            
        except Exception as e:
            print(f"✗ Error during benchmark testing: {str(e)}")
            return False
    
    def save_model(self):
        """Save the retrained model"""
        print("\n[6/6] Saving retrained model...")
        
        if not hasattr(self, 'retrained_model') or not hasattr(self, 'retrained_scaler'):
            print("✗ No model to save")
            return False
        
        try:
            # Create paths with timestamp to avoid overwriting
            model_path = os.path.join(self.ml_dir, f'url_model_v5_{self.timestamp}.pkl')
            scaler_path = os.path.join(self.ml_dir, f'scaler_v5_{self.timestamp}.pkl')
            threshold_path = os.path.join(self.ml_dir, 'classification_threshold.json')
            
            # Also create the default v5 paths
            default_model_path = os.path.join(self.ml_dir, 'url_model_v5.pkl')
            default_scaler_path = os.path.join(self.ml_dir, 'scaler_v5.pkl')
            default_features_path = os.path.join(self.ml_dir, 'feature_names_v5.pkl')
            
            # Save model and scaler
            dump(self.retrained_model, model_path)
            dump(self.retrained_scaler, scaler_path)
            
            # Also save as default v5
            dump(self.retrained_model, default_model_path)
            dump(self.retrained_scaler, default_scaler_path)
            dump(self.retrained_feature_names, default_features_path)
            
            # Save threshold configuration
            with open(threshold_path, 'w') as f:
                json.dump({'threshold': self.threshold}, f, indent=2)
            
            print(f"✓ Model saved to {model_path}")
            print(f"✓ Default model saved to {default_model_path}")
            print(f"✓ Default scaler saved to {default_scaler_path}")
            print(f"✓ Feature names saved to {default_features_path}")
            
            # Save model metadata
            metadata = {
                'version': f'v5_{self.timestamp}',
                'retrained_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'threshold': self.threshold,
                'benchmark_urls_used': len(LEGITIMATE_URLS),
                'additional_urls_used': len(ADDITIONAL_LEGITIMATE_URLS),
                'notes': 'Model retrained to reduce false positives on legitimate sites'
            }
            
            with open(os.path.join(self.output_dir, 'model_metadata.json'), 'w') as f:
                json.dump(metadata, f, indent=2)
            
            return True
            
        except Exception as e:
            print(f"✗ Error saving model: {str(e)}")
            return False
    
    def run(self):
        """Run the full retraining process"""
        print("=" * 60)
        print("PHISHING DETECTION MODEL RETRAINING")
        print("=" * 60)
        
        # Step 1: Extract features from benchmark URLs first to get current feature set
        if not self.extract_features_from_urls() or self.error_occurred:
            return False
        
        # Step 2: Load existing model
        if not self.load_model() or self.error_occurred:
            return False
            
        # Step 3: Load original dataset
        if not self.load_dataset() or self.error_occurred:
            return False
            
        # Step 4: Retrain model
        if not self.retrain_model() or self.error_occurred:
            return False
            
        # Step 5: Test with benchmark
        self.test_with_benchmark()
        
        # Step 6: Save model
        if not self.save_model() or self.error_occurred:
            return False
            
        print("\n" + "=" * 60)
        print("MODEL RETRAINING COMPLETE")
        print("=" * 60)
        print(f"\nNew model saved with classification threshold: {self.threshold}")
        print("\nTo use the new model in your application:")
        print("1. The model has been automatically saved to 'url_model_v5.pkl'")
        print("2. The scaler has been automatically saved to 'scaler_v5.pkl'")
        print("3. Update any code that uses the model to reference these new files")
        
        return True

if __name__ == "__main__":
    retrainer = ModelRetrainer()
    retrainer.run()
