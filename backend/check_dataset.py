import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import os

def analyze_dataset_balance():
    # Setup paths
    current_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(current_dir, 'machine learning', 'dataset', 'phishing_url_balanced.csv')
    
    print("Loading dataset...")
    data = pd.read_csv(dataset_path)
    
    # Get class distribution
    class_distribution = data['phishing'].value_counts()
    
    print("\nClass Distribution:")
    print("-" * 40)
    print(f"Legitimate URLs (0): {class_distribution[0]}")
    print(f"Phishing URLs (1): {class_distribution[1]}")
    print("-" * 40)
    
    # Calculate balance ratio
    total_samples = len(data)
    balance_ratio = min(class_distribution) / max(class_distribution)
    
    print(f"\nTotal samples: {total_samples}")
    print(f"Balance ratio: {balance_ratio:.2f}")
    print(f"Majority class: {'Legitimate' if class_distribution[0] > class_distribution[1] else 'Phishing'}")
    
    # Visualize distribution
    plt.figure(figsize=(10, 6))
    sns.countplot(data=data, x='phishing')
    plt.title('Class Distribution in Dataset')
    plt.xlabel('Class (0: Legitimate, 1: Phishing)')
    plt.ylabel('Number of Samples')
    
    # Save plot
    plot_path = os.path.join(current_dir, 'machine learning', 'dataset', 'class_distribution.png')
    plt.savefig(plot_path)
    print(f"\nClass distribution plot saved to: {plot_path}")
    
    # Check if balancing is needed
    if balance_ratio < 0.8:
        print("\nWARNING: Dataset is imbalanced!")
        print("Consider using one of these techniques:")
        print("1. Undersampling majority class")
        print("2. Oversampling minority class")
        print("3. SMOTE for synthetic samples")
    else:
        print("\nDataset is relatively balanced.")

if __name__ == "__main__":
    analyze_dataset_balance()