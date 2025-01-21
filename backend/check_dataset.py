import pandas as pd
import numpy as np

# Load dataset
data = pd.read_csv('machine learning/dataset/phishing_url.csv')

# Check class distribution
print("Class Distribution:")
print(data['Label'].value_counts())
print("\nPercentage Distribution:")
print(data['Label'].value_counts(normalize=True))

# Sample legitimate URLs
print("\nSample Legitimate URLs:")
print(data[data['Label'] == 0]['Domain'].head())