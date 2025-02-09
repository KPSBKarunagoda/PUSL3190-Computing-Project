import sys
from analyze_url import analyze_url

# Test URLs
test_urls = [
    "https://www.google.com",
    "https://www.facebook.com",
    "https://www.microsoft.com",
    "http://example-phishing-site.com",
    "http://192.168.1.1/login.php",
    "http://bit.ly/suspicious",
    "https://legitimate-bank.com.phishing.com",
]

def test_urls():
    print("\nTesting URL Analysis System")
    print("=" * 50)
    
    for url in test_urls:
        print(f"\nTesting URL: {url}")
        print("-" * 30)
        analyze_url(url)
        print("-" * 50)

if __name__ == "__main__":
    test_urls()