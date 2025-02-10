import requests
import os
import sys
from typing import Dict, Any
import logging

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.config_safe_browsing import *

class SafeBrowsingService:
    def __init__(self):
        self.api_key = GOOGLE_API_KEY
        self.enabled = API_ENABLED

    def set_enabled(self, state: bool) -> bool:
        self.enabled = state
        return self.enabled

    async def check_url(self, url: str) -> Dict[str, Any]:
        if not self.enabled:
            return {"is_safe": None, "message": "API disabled"}

        try:
            payload = {
                "client": {
                    "clientId": CLIENT_ID,
                    "clientVersion": CLIENT_VERSION
                },
                "threatInfo": {
                    "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING"],
                    "platformTypes": ["ANY_PLATFORM"],
                    "threatEntryTypes": ["URL"],
                    "threatEntries": [{"url": url}]
                }
            }

            response = requests.post(
                f"{SAFE_BROWSING_URL}?key={self.api_key}",
                json=payload
            )
            response.raise_for_status()
            data = response.json()

            return {
                "is_safe": "matches" not in data,
                "message": "URL checked successfully"
            }

        except Exception as e:
            return {
                "is_safe": None,
                "message": f"Error: {str(e)}"
            }