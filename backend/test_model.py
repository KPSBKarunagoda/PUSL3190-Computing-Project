import pandas as pd
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix
from joblib import load
import matplotlib.pyplot as plt
import seaborn as sns
from utils.feature_extractor import extract_features

def evaluate_model():
    # Load model and metadata
    print("Loading model and scaler...")
    model = load('url_model_v4.pkl')
    scaler = load('scaler_v4.pkl')
    
    # Load test dataset
    print("\nLoading test data...")
    data = pd.read_csv('machine learning/dataset/phishing_url.csv')
    
    # Define features
    features = [
        'Have_IP', 'Have_At', 'URL_Length', 'URL_Depth',
        'Redirection', 'https_Domain', 'TinyURL', 'Prefix/Suffix',
        'DNS_Record', 'Web_Traffic', 'Domain_Age', 'Domain_End',
        'iFrame', 'Mouse_Over', 'Right_Click', 'Web_Forwards'
    ]
    
    X = data[features].values
    y = data['Label'].values
    
    # Scale features
    X_scaled = scaler.transform(X)
    
    # Get predictions
    y_pred = model.predict(X_scaled)
    y_prob = model.predict_proba(X_scaled)
    
    # Print classification report
    print("\nClassification Report:")
    print(classification_report(y, y_pred, target_names=['Legitimate', 'Phishing']))
    
    # Create confusion matrix
    cm = confusion_matrix(y, y_pred)
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                xticklabels=['Legitimate', 'Phishing'],
                yticklabels=['Legitimate', 'Phishing'])
    plt.title('Confusion Matrix')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    plt.savefig('confusion_matrix.png')
    plt.close()
    
    # Test known URLs
    test_urls = {
        "https://www.google.com": 0,
        "https://www.facebook.com": 0,
        "https://www.microsoft.com": 0,
        "http://suspicious-login.com": 1,
        "http://fake-paypal.com": 1
    }
    
    print("\nTesting Known URLs:")
    for url, expected in test_urls.items():
        # Extract features
        features = extract_features(url)
        
        # Convert to array and scale
        features_array = np.array([[
            features[name] for name in features
        ]])
        features_scaled = scaler.transform(features_array)
        
        # Get prediction and probabilities
        pred = model.predict(features_scaled)[0]
        probs = model.predict_proba(features_scaled)[0]
        
        print(f"\nURL: {url}")
        print(f"Expected: {'Legitimate' if expected == 0 else 'Phishing'}")
        print(f"Predicted: {'Legitimate' if pred == 0 else 'Phishing'}")
        print(f"Confidence: {max(probs):.2%}")
        print(f"Legitimate Probability: {probs[0]:.2%}")
        print(f"Phishing Probability: {probs[1]:.2%}")

if __name__ == "__main__":
    evaluate_model()