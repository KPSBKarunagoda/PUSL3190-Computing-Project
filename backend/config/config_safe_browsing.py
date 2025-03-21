import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Google Safe Browsing API Settings 
GOOGLE_API_KEY = os.environ.get("GOOGLE_SAFE_BROWSING_API_KEY", "")
SAFE_BROWSING_URL = "https://safebrowsing.googleapis.com/v4/threatMatches:find"
CLIENT_ID = "phishing-detector"
CLIENT_VERSION = "1.0.0"
API_ENABLED = bool(GOOGLE_API_KEY)  # Only enable if key exists

# Other configuration settings can be added here
# ML Model Settings
MODEL_VERSION = "v4"
MODEL_PATH = "machine learning/url_model_v4.pkl"
SCALER_PATH = "machine learning/scaler_v4.pkl"