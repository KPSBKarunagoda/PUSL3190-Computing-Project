import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix
from joblib import dump
import matplotlib.pyplot as plt
import seaborn as sns

def train_model():
    # Load and validate data
    print("Loading dataset...")
    data = pd.read_csv('machine learning/dataset/phishing_url.csv')
    print(f"\nDataset Shape: {data.shape}")
    print("\nClass Distribution:")
    print(data['Label'].value_counts(normalize=True) * 100)
    
    # Prepare features
    X = data.drop(['Domain', 'Label'], axis=1)
    y = data['Label']
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Grid search parameters
    param_grid = {
        'n_estimators': [100, 200, 300],
        'max_depth': [15, 20, 25],
        'min_samples_split': [5, 10],
        'class_weight': ['balanced'],
        'criterion': ['gini', 'entropy']
    }
    
    # Grid search with cross validation
    print("\nPerforming grid search...")
    grid_search = GridSearchCV(
        RandomForestClassifier(random_state=42),
        param_grid,
        cv=5,
        scoring='f1',
        n_jobs=-1,
        verbose=2
    )
    
    grid_search.fit(X_train_scaled, y_train)
    print(f"\nBest parameters: {grid_search.best_params_}")
    
    # Get best model
    model = grid_search.best_estimator_
    
    # Evaluate model
    y_pred = model.predict(X_test_scaled)
    print("\nModel Evaluation:")
    print(classification_report(y_test, y_pred))
    
    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': X.columns,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    print("\nTop 10 Most Important Features:")
    print(feature_importance.head(10))
    
    # Plot confusion matrix
    plt.figure(figsize=(8, 6))
    cm = confusion_matrix(y_test, y_pred)
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues')
    plt.title('Confusion Matrix')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    plt.savefig('machine learning/confusion_matrix.png')
    
    # Plot feature importance
    plt.figure(figsize=(10, 6))
    sns.barplot(x='importance', y='feature', data=feature_importance.head(10))
    plt.title('Top 10 Most Important Features')
    plt.tight_layout()
    plt.savefig('machine learning/feature_importance.png')
    
    # Save model and scaler
    dump(model, 'machine learning/url_model_v3.pkl')
    dump(scaler, 'machine learning/scaler.pkl')
    print("\nModel and scaler saved successfully")

if __name__ == "__main__":
    train_model()