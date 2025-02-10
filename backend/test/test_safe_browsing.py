import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.safe_browsing import SafeBrowsingService

async def test_safe_browsing():
    service = SafeBrowsingService()
    
    # Test URLs
    test_urls = [
        "https://www.google.com",                    # Known safe
        "https://www.microsoft.com",                 # Known safe
        "http://malware.testing.google.test/testing/malware/",  # Test malware URL
        "https://testsafebrowsing.appspot.com/s/phishing.html" # Test phishing URL
    ]

    print("\nTesting Google Safe Browsing API Integration")
    print("-" * 50)

    for url in test_urls:
        print(f"\nChecking URL: {url}")
        try:
            result = await service.check_url(url)
            print(f"Status: {'Safe' if result['is_safe'] else 'Unsafe'}")
            print(f"Message: {result['message']}")
            if 'details' in result and result['details']:
                print(f"Details: {result['details']}")
        except Exception as e:
            print(f"Error checking URL: {e}")
        print("-" * 50)

    # Test API toggle
    print("\nTesting API toggle functionality")
    service.set_enabled(False)
    result = await service.check_url("https://www.google.com")
    print(f"API Disabled Test: {result['message']}")

if __name__ == "__main__":
    asyncio.run(test_safe_browsing())