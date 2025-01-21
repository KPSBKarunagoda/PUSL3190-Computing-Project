import sys
import json
import pandas as pd
from joblib import load

# Load model
model = load('url_model.pkl')

# Get features from command line argument
features = json.loads(sys.argv[1])
features_df = pd.DataFrame([features])

# Make prediction
prediction = model.predict(features_df)[0]
print(json.dumps({'prediction': int(prediction)}))