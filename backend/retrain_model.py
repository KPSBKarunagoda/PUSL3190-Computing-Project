import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix
from joblib import dump
import os
import matplotlib.pyplot as plt
import seaborn as sns
import warnings
warnings.filterwarnings('ignore')

# Change the LightGBM import section to force using RandomForest
try:
    import lightgbm as lgb
    # Force RandomForest usage regardless of LightGBM availability
    USE_LGB = False
    print("LightGBM available, but using RandomForest as requested")
except ImportError:
    USE_LGB = False
    print("Using RandomForest for training")

# Define features list (same as your original list)
FEATURE_NAMES = [
    # URL structure features
    'qty_dot_url', 'qty_hyphen_url', 'qty_underline_url', 'qty_slash_url',
    'qty_questionmark_url', 'qty_equal_url', 'qty_at_url', 'qty_and_url',
    'qty_exclamation_url', 'qty_space_url', 'qty_tilde_url', 'qty_comma_url',
    'qty_plus_url', 'qty_asterisk_url', 'qty_hashtag_url', 'qty_dollar_url',
    'qty_percent_url', 'qty_tld_url', 'length_url',
    # Domain features
    'qty_dot_domain', 'qty_hyphen_domain', 'qty_underline_domain', 'qty_slash_domain',
    'qty_questionmark_domain', 'qty_equal_domain', 'qty_at_domain', 'qty_and_domain',
    'qty_exclamation_domain', 'qty_space_domain', 'qty_tilde_domain', 'qty_comma_domain',
    'qty_plus_domain', 'qty_asterisk_domain', 'qty_hashtag_domain', 'qty_dollar_domain',
    'qty_percent_domain', 'qty_vowels_domain', 'domain_length', 'domain_in_ip',
    'server_client_domain',
    # Directory features
    'qty_dot_directory', 'qty_hyphen_directory', 'qty_underline_directory',
    'qty_slash_directory', 'qty_questionmark_directory', 'qty_equal_directory',
    'qty_at_directory', 'qty_and_directory', 'qty_exclamation_directory',
    'qty_space_directory', 'qty_tilde_directory', 'qty_comma_directory',
    'qty_plus_directory', 'qty_asterisk_directory', 'qty_hashtag_directory',
    'qty_dollar_directory', 'qty_percent_directory', 'directory_length',
    # File features
    'qty_dot_file', 'qty_hyphen_file', 'qty_underline_file', 'qty_slash_file',
    'qty_questionmark_file', 'qty_equal_file', 'qty_at_file', 'qty_and_file',
    'qty_exclamation_file', 'qty_space_file', 'qty_tilde_file', 'qty_comma_file',
    'qty_plus_file', 'qty_asterisk_file', 'qty_hashtag_file', 'qty_dollar_file',
    'qty_percent_file', 'file_length',
    # Parameter features
    'qty_dot_params', 'qty_hyphen_params', 'qty_underline_params', 'qty_slash_params',
    'qty_questionmark_params', 'qty_equal_params', 'qty_at_params', 'qty_and_params',
    'qty_exclamation_params', 'qty_space_params', 'qty_tilde_params', 'qty_comma_params',
    'qty_plus_params', 'qty_asterisk_params', 'qty_hashtag_params', 'qty_dollar_params',
    'qty_percent_params', 'params_length', 'tld_present_params', 'qty_params',
    # Security features
    'email_in_url', 'time_response', 'domain_spf', 'asn_ip', 'time_domain_activation',
    'time_domain_expiration', 'qty_ip_resolved', 'qty_nameservers', 'qty_mx_servers',
    'ttl_hostname', 'tls_ssl_certificate', 'qty_redirects', 'url_google_index',
    'domain_google_index', 'url_shortened'
]

# Define trust signal features
TRUST_FEATURES = [
    'time_domain_activation',
    'time_domain_expiration', 
    'tls_ssl_certificate',
    'url_google_index',
    'domain_google_index'
]

def enhance_features(df):
    """Add engineered features to emphasize trust signals"""
    print("\nEnhancing features with trust signals...")
    # Create a copy to avoid modifying original dataframe
    enhanced_df = df.copy()
    
    # Debug NaN values
    print("\nChecking for NaN values in key columns:")
    for col in TRUST_FEATURES:
        if col in df.columns:
            nan_count = df[col].isna().sum()
            nan_pct = (nan_count / len(df)) * 100
            print(f"  {col}: {nan_count} NaNs ({nan_pct:.2f}%)")
    
    # === TRUST FEATURE 1: Log-transformed domain age ===
    if 'time_domain_activation' in df.columns:
        # Fill NaN with 0 first
        domain_age = df['time_domain_activation'].fillna(0)
        enhanced_df['log_domain_age'] = np.log1p(domain_age)
    
    # === TRUST FEATURE 2: Domain age categories ===
    if 'time_domain_activation' in df.columns:
        # Use direct numpy assignment instead of pd.cut
        domain_age_cat = np.zeros(len(df), dtype=int)
        domain_age_values = df['time_domain_activation'].fillna(0).values
        
        # Apply categorization 
        domain_age_cat[(domain_age_values > 30) & (domain_age_values <= 180)] = 1
        domain_age_cat[domain_age_values > 180] = 2
        
        enhanced_df['domain_age_cat'] = domain_age_cat
        print(f"Domain age categories created (0: New, 1: Medium, 2: Established)")
    
    # === TRUST FEATURE 3: Domain age * SSL compound ===
    if 'time_domain_activation' in df.columns and 'tls_ssl_certificate' in df.columns:
        enhanced_df['age_ssl_combined'] = (
            df['time_domain_activation'].fillna(0) * 
            df['tls_ssl_certificate'].fillna(0)
        )
    
    # === TRUST FEATURE 4: Comprehensive trust score ===
    trust_score = np.zeros(len(df))
    
    # SSL certificate component
    if 'tls_ssl_certificate' in df.columns:
        trust_score += df['tls_ssl_certificate'].fillna(0) * 2  # SSL is important
    
    # Domain age component (capped at 3 years)
    if 'time_domain_activation' in df.columns:
        domain_age_years = df['time_domain_activation'].fillna(0) / 365
        domain_age_score = np.minimum(domain_age_years, 3) * 2
        trust_score += domain_age_score
    
    # Google indexing components
    if 'url_google_index' in df.columns:
        trust_score += df['url_google_index'].fillna(0)
    if 'domain_google_index' in df.columns:
        trust_score += df['domain_google_index'].fillna(0)
    
    enhanced_df['trust_score'] = trust_score
    
    # === TRUST FEATURE 5: Interaction features ===
    # Hyphen count is often higher in phishing URLs, but less concerning if site has SSL
    if 'qty_hyphen_url' in df.columns and 'tls_ssl_certificate' in df.columns:
        enhanced_df['hyphen_with_ssl'] = (
            df['qty_hyphen_url'].fillna(0) * 
            df['tls_ssl_certificate'].fillna(0)
        )
    
    # Domain length is often higher in phishing, but less concerning for established domains
    if 'domain_length' in df.columns and 'time_domain_activation' in df.columns:
        # Prevent division by zero by using np.clip to bound the values
        domain_length = df['domain_length'].fillna(0).values
        domain_age_factor = 1 + (df['time_domain_activation'].fillna(0) / 30).values
        
        # Ensure at least 1 to prevent division by zero
        domain_age_factor = np.clip(domain_age_factor, 1.0, 1000.0)
        
        # Perform division and clip to prevent infinity/extreme values
        ratio = domain_length / domain_age_factor
        ratio = np.clip(ratio, 0.0, 100.0)  # Limit maximum ratio
        
        enhanced_df['domain_length_age_ratio'] = ratio
    
    # Check for infinity values after all calculations
    for col in enhanced_df.columns:
        inf_count = np.isinf(enhanced_df[col].values).sum()
        if inf_count > 0:
            print(f"WARNING: Column {col} contains {inf_count} infinity values. Replacing with max values.")
            # Replace infinity with large but finite value
            enhanced_df[col] = enhanced_df[col].replace([np.inf, -np.inf], 100.0)
    
    # Count successfully added features
    added_features = [col for col in enhanced_df.columns if col not in df.columns]
    print(f"Added {len(added_features)} enhanced features: {', '.join(added_features)}")
    
    return enhanced_df

def custom_phishing_metric(y_true, y_pred):
    """
    Custom metric to ensure phishing sites are not overlooked
    Higher penalty for false negatives (missing phishing sites)
    """
    from sklearn.metrics import confusion_matrix
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred > 0.5).ravel()
    
    # Calculate general accuracy
    accuracy = (tp + tn) / (tp + tn + fp + fn)
    
    # Calculate weighted accuracy with high penalty for missing phishing
    # Missing phishing is 3x worse than false positives
    weighted_accuracy = (3*tp + tn) / (3*tp + 3*fn + tn + fp)
    
    # Phishing detection rate (Recall/Sensitivity)
    phishing_detection_rate = tp / (tp + fn) if (tp + fn) > 0 else 0
    
    # Combine metrics with emphasis on phishing detection
    final_score = (phishing_detection_rate * 0.6) + (weighted_accuracy * 0.4)
    
    # Return negative because LightGBM tries to minimize, we want to maximize
    return 'phishing_safe_score', final_score, True

def retrain_model():
    """Train an enhanced model with trust signals while ensuring phishing detection"""
    print("\n=== Retraining Enhanced Model V5 (Trust Signals) ===")
    
    # Setup directories
    current_dir = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(os.path.join(current_dir, 'machine learning'), exist_ok=True)
    
    # Load dataset
    dataset_path = os.path.join(current_dir, 'machine learning', 'dataset', 'phishing_url_balanced.csv')
    print("\n[1/6] Loading dataset...")
    try:
        data = pd.read_csv(dataset_path)
        print(f"Dataset shape: {data.shape}")
        print("\nClass Distribution:")
        print(data['phishing'].value_counts())
    except Exception as e:
        print(f"Error loading dataset: {e}")
        return
    
    # Enhance features
    print("\n[2/6] Enhancing features...")
    X_original = data[FEATURE_NAMES]
    enhanced_data = enhance_features(data)
    
    # Get enhanced feature names (original + new ones)
    enhanced_features = list(FEATURE_NAMES) + [col for col in enhanced_data.columns 
                                              if col not in FEATURE_NAMES and col != 'phishing']
    
    X = enhanced_data[enhanced_features]
    y = enhanced_data['phishing']
    
    # Create a new feature names list
    new_feature_names = enhanced_features
    
    # Split dataset
    print("\n[3/6] Splitting dataset...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # Scale features
    print("\n[4/6] Scaling features...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train model
    print("\n[5/6] Training model...")
    
    if USE_LGB:
        # LightGBM with custom parameters
        param_dist = {
            'objective': 'binary',
            'metric': 'auc',
            'boosting_type': 'gbdt',
            'num_leaves': 63,
            'max_depth': 15,
            'learning_rate': 0.05,
            'n_estimators': 300,
            'subsample': 0.9,
            'colsample_bytree': 0.9,
            'min_child_samples': 20,
            # Increased penalty for false negatives (missing phishing)
            # Value of 1:5 means missing phishing is 5x worse than false alarm
            'scale_pos_weight': 0.5,  # Less than 1 to favor detecting phishing
            'reg_alpha': 0.1,
            'reg_lambda': 0.1,
            'random_state': 42,
            'verbose': -1
        }
        
        # Create LightGBM datasets
        train_data = lgb.Dataset(X_train_scaled, label=y_train)
        valid_data = lgb.Dataset(X_test_scaled, label=y_test, reference=train_data)
        
        # Train with custom metric
        model = lgb.train(
            param_dist,
            train_data,
            valid_sets=[valid_data],
            feval=custom_phishing_metric,
            num_boost_round=param_dist['n_estimators'],
            early_stopping_rounds=30,
            verbose_eval=10
        )
        
        # Prediction for evaluation
        y_pred_proba = model.predict(X_test_scaled)
        y_pred = (y_pred_proba > 0.5).astype(int)
        
    else:
        # RandomForest fallback
        from sklearn.ensemble import RandomForestClassifier
        
        # RandomForest with optimized settings
        model = RandomForestClassifier(
            n_estimators=250,          # More trees for better accuracy
            max_depth=15,              # Allow deeper trees to capture complex patterns
            min_samples_split=5,       # Reduce overfitting
            min_samples_leaf=2,        # Allow more granular leaf nodes
            class_weight={0:1, 1:5},   # Heavily penalize missing phishing sites
            max_features='sqrt',       # Standard practice for RandomForest
            random_state=42,           # For reproducibility
            n_jobs=-1                  # Use all CPU cores for faster training
        )
        
        model.fit(X_train_scaled, y_train)
        y_pred_proba = model.predict_proba(X_test_scaled)[:, 1]
        y_pred = model.predict(X_test_scaled)
    
    # Evaluate model
    print("\n[6/6] Evaluating model...")
    print("\nModel Performance:")
    print("-" * 50)
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    print(f"ROC AUC Score: {roc_auc_score(y_test, y_pred_proba):.4f}")
    
    # Calculate confusion matrix
    cm = confusion_matrix(y_test, y_pred)
    print("\nConfusion Matrix:")
    print(cm)
    
    # Calculate false negative rate (missing phishing sites)
    fn = cm[1, 0]
    total_phishing = cm[1, 0] + cm[1, 1]
    false_negative_rate = fn / total_phishing if total_phishing > 0 else 0
    print(f"\nPhishing Missing Rate: {false_negative_rate:.4f} ({fn} out of {total_phishing})")
    
    # Calculate false positive rate
    fp = cm[0, 1]
    total_clean = cm[0, 0] + cm[0, 1]
    false_positive_rate = fp / total_clean if total_clean > 0 else 0
    print(f"False Alarm Rate: {false_positive_rate:.4f} ({fp} out of {total_clean})")
    
    # Verify performance on sites with trust signals
    print("\nPerformance on sites with strong trust signals:")
    # Filter test set for sites with strong trust signals
    trust_indices = []
    for i, features in enumerate(X_test.values):
        # Get indices of trust features
        age_index = enhanced_features.index('time_domain_activation') if 'time_domain_activation' in enhanced_features else -1
        ssl_index = enhanced_features.index('tls_ssl_certificate') if 'tls_ssl_certificate' in enhanced_features else -1
        
        # Check for strong trust signals (domain age > 180 days and has SSL)
        if (age_index >= 0 and ssl_index >= 0 and 
            features[age_index] > 180 and features[ssl_index] == 1):
            trust_indices.append(i)
    
    if trust_indices:
        # Performance on trusted sites
        trusted_X = X_test.iloc[trust_indices]
        trusted_y = y_test.iloc[trust_indices]
        trusted_pred = y_pred[trust_indices]
        
        print(f"Found {len(trust_indices)} sites with strong trust signals")
        print("Classification on trusted sites:")
        print(classification_report(trusted_y, trusted_pred))
        
        # Check specifically for yourfitnesscompanion.com case
        fitness_example = np.zeros(len(enhanced_features))
        fitness_feature_map = {
            'time_domain_activation': 792,
            'tls_ssl_certificate': 1,
            'domain_length': 28,
            'length_url': 37,
            'qty_dot_url': 2,
            'qty_dot_domain': 2,
            'qty_slash_url': 3,
            'time_domain_expiration': 303
        }
        
        # Set example feature values
        for feature, value in fitness_feature_map.items():
            if feature in enhanced_features:
                idx = enhanced_features.index(feature)
                fitness_example[idx] = value
                
        # Add engineered features for this example
        if 'log_domain_age' in enhanced_features:
            idx = enhanced_features.index('log_domain_age')
            fitness_example[idx] = np.log1p(792)
            
        if 'domain_age_cat' in enhanced_features:
            idx = enhanced_features.index('domain_age_cat')
            fitness_example[idx] = 2  # >180 days
            
        if 'age_ssl_combined' in enhanced_features:
            idx = enhanced_features.index('age_ssl_combined')
            fitness_example[idx] = 792 * 1
            
        if 'trust_score' in enhanced_features:
            idx = enhanced_features.index('trust_score')
            fitness_example[idx] = 2 + 2*(min(792/365, 3))  # SSL + normalized domain age
        
        # Scale the example
        scaled_example = scaler.transform([fitness_example])
        
        # Predict
        if USE_LGB:
            example_pred = model.predict(scaled_example)[0]
        else:
            example_pred = model.predict_proba(scaled_example)[0, 1]
            
        print(f"\nPrediction for yourfitnesscompanion.com example:")
        print(f"Phishing probability: {example_pred:.4f}")
        print(f"Classification: {'Phishing' if example_pred > 0.5 else 'Legitimate'}")
    
    # Save model artifacts
    print("\nSaving model artifacts...")
    model_path = os.path.join(current_dir, 'machine learning', 'url_model_v5.pkl')
    scaler_path = os.path.join(current_dir, 'machine learning', 'scaler_v5.pkl')
    feature_path = os.path.join(current_dir, 'machine learning', 'feature_names_v5.pkl')
    
    dump(model, model_path)
    dump(scaler, scaler_path)
    dump(new_feature_names, feature_path)
    
    print(f"Model saved to {model_path}")
    print(f"Scaler saved to {scaler_path}")
    print(f"Feature names saved to {feature_path}")
    
    # Feature importance visualization
    if hasattr(model, 'feature_importances_'):
        importances = pd.DataFrame({
            'feature': new_feature_names,
            'importance': model.feature_importances_
        }).sort_values('importance', ascending=False)
        
        plt.figure(figsize=(12, 10))
        sns.barplot(x='importance', y='feature', data=importances.head(20))
        plt.title('Top 20 Most Important Features')
        plt.tight_layout()
        plt.savefig(os.path.join(current_dir, 'machine learning', 'feature_importance_v5.png'))
        print("Feature importance plot saved")
        
        # Print top trust features importance
        print("\nTrust Feature Importance:")
        for feature in TRUST_FEATURES + ['trust_score', 'log_domain_age', 'age_ssl_combined']:
            if feature in importances['feature'].values:
                rank = importances[importances['feature'] == feature].index[0] + 1
                imp = importances[importances['feature'] == feature]['importance'].values[0]
                print(f"{feature}: Rank #{rank}, Importance: {imp:.6f}")
    
    print("\nModel retraining complete!")
    return model, scaler, new_feature_names

if __name__ == "__main__":
    retrain_model()