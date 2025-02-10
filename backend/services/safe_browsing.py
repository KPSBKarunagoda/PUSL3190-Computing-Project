import requests
import os
import sys
import json
import logging
from typing import Dict, Any
import aiohttp

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.config_safe_browsing import *

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SafeBrowsingService:
    def __init__(self):
        self.api_key = GOOGLE_API_KEY
        self.enabled = API_ENABLED
        self.api_url = SAFE_BROWSING_URL
        
        if not self.api_key:
            logger.warning("Safe Browsing API key not configured")

    def set_enabled(self, state: bool) -> bool:
        """Enable or disable the Safe Browsing service"""
        self.enabled = state
        logger.info(f"Safe Browsing API {'enabled' if state else 'disabled'}")
        return self.enabled

    async def check_url(self, url: str) -> Dict[str, Any]:
        """Check URL against Google Safe Browsing API"""
        if not self.enabled:
            logger.info("Safe Browsing API check skipped (disabled)")
            return {"is_safe": None, "message": "API disabled"}

        if not self.api_key:
            logger.error("Safe Browsing API key not configured")
            return {"is_safe": None, "message": "API key not configured"}

        try:
            payload = {
                "client": {
                    "clientId": CLIENT_ID,
                    "clientVersion": CLIENT_VERSION
                },
                "threatInfo": {
                    "threatTypes": [
                        "MALWARE",
                        "SOCIAL_ENGINEERING",
                        "UNWANTED_SOFTWARE",
                        "POTENTIALLY_HARMFUL_APPLICATION"
                    ],
                    "platformTypes": ["ANY_PLATFORM"],
                    "threatEntryTypes": ["URL"],
                    "threatEntries": [{"url": url}]
                }
            }

            logger.info(f"Checking URL: {url}")
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.api_url}?key={self.api_key}",
                    json=payload
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"API Error: {response.status} - {error_text}")
                        return {
                            "is_safe": None,
                            "message": f"API Error: {response.status}",
                            "error": error_text
                        }

                    data = await response.json()
                    logger.debug(f"API Response: {json.dumps(data, indent=2)}")

                    is_safe = "matches" not in data
                    threat_details = None

                    if not is_safe and "matches" in data:
                        matches = data["matches"]
                        threat_details = [{
                            "threat_type": match.get("threatType"),
                            "platform_type": match.get("platformType"),
                            "threat_entry_type": match.get("threatEntryType")
                        } for match in matches]

                    result = {
                        "is_safe": is_safe,
                        "message": "URL checked successfully",
                        "threats": threat_details if threat_details else None,
                        "raw_response": data if not is_safe else None
                    }

                    logger.info(f"URL Check Result - Safe: {is_safe}")
                    if threat_details:
                        logger.warning(f"Threats found: {json.dumps(threat_details, indent=2)}")

                    return result

        except aiohttp.ClientError as e:
            error_msg = f"Network error: {str(e)}"
            logger.error(error_msg)
            return {
                "is_safe": None,
                "message": error_msg,
                "error": str(e)
            }
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(error_msg)
            return {
                "is_safe": None,
                "message": error_msg,
                "error": str(e)
            }

    async def test_api(self) -> Dict[str, Any]:
        """Test the API configuration with a known test URL"""
        test_url = "http://testsafebrowsing.appspot.com/s/malware.html"
        logger.info("Testing Safe Browsing API configuration...")
        result = await self.check_url(test_url)
        
        if result.get("is_safe") is None:
            logger.error("API test failed")
            return {"status": "failed", "message": result.get("message")}
        
        logger.info("API test successful")
        return {"status": "success", "result": result}