import pandas as pd
from sklearn.utils import resample

def clean_and_balance_dataset():
    # Load new dataset
    dataset_path = 'machine learning/dataset/new_dataset.csv'
    data = pd.read_csv(dataset_path)
    
    # Remove duplicate rows
    data = data.drop_duplicates()
    
    # Check for any missing values
    if data.isnull().sum().sum() > 0:
        print("Dataset contains missing values. Please handle them before proceeding.")
        return
    
    # Separate majority and minority classes
    legitimate = data[data['phishing'] == 0]
    phishing = data[data['phishing'] == 1]
    
    # Downsample majority class
    legitimate_downsampled = resample(legitimate,
                                      replace=False,  # sample without replacement
                                      n_samples=len(phishing),  # match number in minority class
                                      random_state=42)  # reproducible results
    
    # Combine minority class with downsampled majority class
    balanced_data = pd.concat([legitimate_downsampled, phishing])
    
    # Save the cleaned and balanced dataset
    balanced_dataset_path = 'machine learning/dataset/phishing_url_balanced.csv'
    balanced_data.to_csv(balanced_dataset_path, index=False)
    print(f"\nCleaned and balanced dataset saved to {balanced_dataset_path}")

if __name__ == "__main__":
    clean_and_balance_dataset()