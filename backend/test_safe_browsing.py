import asyncio
import json
from services.safe_browsing import SafeBrowsingService

async def test_safe_browsing():
    service = SafeBrowsingService()
    
    test_urls = [
        "https://google.com",  # Known safe
        "http://testsafebrowsing.appspot.com/s/malware.html",  # Test malware
        "http://testsafebrowsing.appspot.com/s/phishing.html",  # Test phishing
    ]
    
    print("\n=== Testing Safe Browsing API ===")
    
    # Test API configuration
    api_test = await service.test_api()
    print(f"\nAPI Configuration Test: {json.dumps(api_test, indent=2)}")
    
    # Test URLs
    for url in test_urls:
        print(f"\nTesting URL: {url}")
        result = await service.check_url(url)
        print(f"Result: {json.dumps(result, indent=2)}")
    
    print("\n=== Test Complete ===")

if __name__ == "__main__":
    asyncio.run(test_safe_browsing())