import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

def analyze_dataset():
    # Load dataset
    data = pd.read_csv('machine learning/dataset/phishing_url.csv')
    
    # Class distribution
    print("\nClass Distribution:")
    class_dist = data['Label'].value_counts()
    print(class_dist)
    print("\nClass Percentages:")
    print(data['Label'].value_counts(normalize=True) * 100)
    
    # Feature statistics
    print("\nFeature Statistics:")
    feature_cols = [col for col in data.columns if col not in ['Domain', 'Label']]
    print(data[feature_cols].describe())
    
    # Feature correlations with Label
    print("\nCorrelation with Label:")
    correlations = data[feature_cols].corrwith(data['Label']).sort_values(ascending=False)
    print(correlations)
    
    # Save visualizations
    plt.figure(figsize=(12, 6))
    sns.countplot(data=data, x='Label')
    plt.title('Class Distribution')
    plt.savefig('class_distribution.png')
    
    plt.figure(figsize=(12, 8))
    sns.heatmap(data[feature_cols + ['Label']].corr(), annot=True, cmap='coolwarm')
    plt.title('Feature Correlations')
    plt.tight_layout()
    plt.savefig('feature_correlations.png')

if __name__ == "__main__":
    analyze_dataset()