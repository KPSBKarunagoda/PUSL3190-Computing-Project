import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
from joblib import dump

# Feature importance weights
FEATURE_WEIGHTS = {
    'Have_IP': 0.9,
    'Have_At': 0.8,
    'URL_Length': 0.3,
    'URL_Depth': 0.4,
    'Redirection': 0.7,
    'https_Domain': -0.5,
    'TinyURL': 0.6,
    'Prefix/Suffix': 0.5,
    'DNS_Record': -0.9,
    'Web_Traffic': -0.8,
    'Domain_Age': -0.7,
    'Domain_End': -0.6,
    'iFrame': 0.5,
    'Mouse_Over': 0.4,
    'Right_Click': 0.4,
    'Web_Forwards': 0.6
}

def preprocess_data(df):
    # Apply feature weights
    for feature, weight in FEATURE_WEIGHTS.items():
        if feature in df.columns:
            df[feature] = df[feature] * abs(weight)
    return df

def train_model():
    # Load dataset
    print("Loading dataset...")
    data = pd.read_csv('machine learning/dataset/phishing_url.csv')
    
    # Prepare features and target
    X = data.drop(['Domain', 'Label'], axis=1)
    y = data['Label']
    
    # Preprocess features
    X = preprocess_data(X)
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # Initialize and train model
    print("Training model...")
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=20,
        min_samples_split=10,
        min_samples_leaf=2,
        class_weight='balanced',
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate model
    print("\nModel Evaluation:")
    y_pred = model.predict(X_test)
    print(classification_report(y_test, y_pred))
    
    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': X.columns,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    print("\nFeature Importance:")
    print(feature_importance)
    
    # Save model
    print("\nSaving model...")
    dump(model, 'url_model.pkl')
    print("Model saved as 'url_model.pkl'")

if __name__ == "__main__":
    train_model()