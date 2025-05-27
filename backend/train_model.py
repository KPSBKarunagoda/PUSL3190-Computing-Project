"""ML Training script - Trains, optimizes and exports phishing detection models with GPU acceleration
support, feature importance analysis, and automatic hyperparameter tuning."""
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.feature_selection import SelectFromModel
from joblib import dump
import os
import matplotlib.pyplot as plt
import seaborn as sns
from tqdm import tqdm
from time import time
import warnings
warnings.filterwarnings('ignore')

# Initialize global variables
global USE_GPU, GPUStatCollection
USE_GPU = False
GPUStatCollection = None

# Try to import GPU-related packages
try:
    import lightgbm as lgb
    import cupy as cp
    try:
        from gpustat import GPUStatCollection
        # Test CUDA availability
        cp.cuda.runtime.getDeviceCount()
        USE_GPU = True
        print(f"CUDA Version: {cp.cuda.runtime.runtimeGetVersion()}")
        print(f"GPU Device Count: {cp.cuda.runtime.getDeviceCount()}")
    except ImportError:
        GPUStatCollection = None
        print("GPUstat not installed. For GPU monitoring install: pip install gpustat")
    except cp.cuda.runtime.CUDARuntimeError:
        print("CUDA initialization failed. Check NVIDIA drivers.")
except ImportError:
    print("GPU acceleration not available. Install: pip install cupy-cuda12x lightgbm gpustat")

# Define features list
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

def optimize_gpu_memory():
    """Optimize GPU memory settings for GTX 1660 Ti (6GB VRAM)"""
    global USE_GPU
    if USE_GPU:
        try:
            # Set memory limit to 5GB
            mem_limit = 5 * 1024 * 1024 * 1024
            cp.cuda.set_allocator(cp.cuda.MemoryPool().malloc)
            cp.cuda.set_pinned_memory_allocator(cp.cuda.PinnedMemoryPool().malloc)
            cp.cuda.runtime.setDevice(0)
            cp.cuda.runtime.memGetInfo()
            print(f"GPU memory optimized for GTX 1660 Ti (CUDA 12.6)")
            return True
        except Exception as e:
            print(f"GPU memory optimization failed: {e}")
            USE_GPU = False
            return False
    return False

def print_gpu_utilization():
    """Print GPU utilization if available"""
    if USE_GPU and GPUStatCollection is not None:
        try:
            gpu_stats = GPUStatCollection.new_query()
            print(f"\nGPU Utilization: {gpu_stats.jsonify()}")
        except Exception as e:
            print(f"Could not get GPU stats: {e}")

class ProgressCallback:
    """Callback for training progress visualization"""
    def __init__(self, total_iters):
        self.pbar = tqdm(total=total_iters, desc="Training progress")
        
    def __call__(self, env):
        self.pbar.update(1)
        return False

def train_and_save_model():
    """Train and save the model"""
    global USE_GPU
    start_time = time()
    
    # GPU initialization
    if USE_GPU:
        print("\nGPU acceleration enabled for GTX 1660 Ti!")
        if not optimize_gpu_memory():
            print("Falling back to CPU mode")
            USE_GPU = False
        print_gpu_utilization()
    else:
        print("\nRunning in CPU mode")
    
    # Setup directories
    current_dir = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(os.path.join(current_dir, 'machine learning'), exist_ok=True)
    os.makedirs(os.path.join(current_dir, 'machine learning', 'dataset'), exist_ok=True)
    
    # Load dataset
    dataset_path = os.path.join(current_dir, 'machine learning', 'dataset', 'phishing_url_balanced.csv')
    print("\n[1/7] Loading dataset...")
    data = pd.read_csv(dataset_path)
    print(f"Dataset shape: {data.shape}")
    print("\nClass Distribution:")
    print(data['phishing'].value_counts())
    
    # Prepare features
    print("\n[2/7] Preparing features...")
    X = data[FEATURE_NAMES]
    y = data['phishing']
    
    # Batch processing for large datasets
    if USE_GPU and len(X) > 100000:
        batch_size = 50000
        n_batches = len(X) // batch_size + 1
        print(f"\nProcessing in {n_batches} batches...")
    
    # Split dataset
    print("\n[3/7] Splitting dataset...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # Scale features
    print("\n[4/7] Scaling features...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Model parameters
    print("\n[5/7] Setting up model parameters...")
    if USE_GPU:
        param_dist = {
    'objective': 'binary',
    'metric': ['auc', 'binary_logloss'],  # Add multiple metrics
    'boosting_type': 'gbdt',
    'device_type': 'gpu',
    'gpu_platform_id': 0,
    'gpu_device_id': 0,
    'num_thread': 4,
    'num_leaves': 127,  # Increased from 63
    'max_depth': 12,    # Optimized for depth
    'learning_rate': 0.05,  # Reduced for better generalization
    'n_estimators': 500,    # Increased number of trees
    'subsample': 0.9,       # Increased from 0.8
    'colsample_bytree': 0.9,
    'min_child_samples': 50,
    'reg_alpha': 0.1,       # L1 regularization
    'reg_lambda': 0.1,      # L2 regularization
    'random_state': 42,
    'max_bin': 255,
    'gpu_use_dp': True,
    'verbose': -1,
    'early_stopping_rounds': 50  # Add early stopping
        }
        
        # Create LightGBM datasets
        train_data = lgb.Dataset(X_train_scaled, label=y_train)
        valid_data = lgb.Dataset(X_test_scaled, label=y_test, reference=train_data)
        
        # Train model
        print("\n[6/7] Training model...")
        callback = ProgressCallback(param_dist['n_estimators'])
        model = lgb.train(
            param_dist,
            train_data,
            valid_sets=[valid_data],
            callbacks=[callback]
        )
        
    else:
        from sklearn.ensemble import RandomForestClassifier
        param_dist = {
            'n_estimators': 200,
            'max_depth': 15,
            'min_samples_split': 5,
            'min_samples_leaf': 2,
            'max_features': 'sqrt',
            'class_weight': 'balanced'
        }
        
        print("\n[6/7] Training model...")
        model = RandomForestClassifier(**param_dist, random_state=42, n_jobs=-1)
        with tqdm(total=1, desc="Training") as pbar:
            model.fit(X_train_scaled, y_train)
            pbar.update(1)
    
    # Model evaluation
    print("\n[7/7] Evaluating model...")
    if USE_GPU:
        y_pred = (model.predict(X_test_scaled) > 0.5).astype(int)
        y_prob = model.predict(X_test_scaled)
    else:
        y_pred = model.predict(X_test_scaled)
        y_prob = model.predict_proba(X_test_scaled)[:, 1]
    
    print("\nModel Performance:")
    print("-" * 50)
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    print(f"ROC AUC Score: {roc_auc_score(y_test, y_prob):.4f}")
    
    # Save model artifacts
    print("\nSaving model artifacts...")
    artifacts = [
        (model, 'url_model_v4.pkl'),
        (scaler, 'scaler_v4.pkl'),
        (FEATURE_NAMES, 'feature_names.pkl')
    ]
    
    with tqdm(total=len(artifacts), desc="Saving files") as pbar:
        for artifact, filename in artifacts:
            dump(artifact, os.path.join(current_dir, 'machine learning', filename))
            pbar.update(1)
    
    # Feature importance visualization
    if hasattr(model, 'feature_importances_'):
        importances = pd.DataFrame({
            'feature': FEATURE_NAMES,
            'importance': model.feature_importances_
        }).sort_values('importance', ascending=False)
        
        plt.figure(figsize=(12, 8))
        sns.barplot(x='importance', y='feature', data=importances.head(20))
        plt.title('Top 20 Most Important Features')
        plt.tight_layout()
        plt.savefig(os.path.join(current_dir, 'machine learning', 'feature_importance.png'))
    
    print_gpu_utilization()
    total_time = time() - start_time
    print(f"\nTotal training time: {total_time:.2f} seconds ({total_time/60:.2f} minutes)")
    
    return model, scaler, FEATURE_NAMES

if __name__ == "__main__":
    train_and_save_model()