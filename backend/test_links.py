import os
import sys
import json
import argparse
import asyncio
import pandas as pd
from analyze_url import URLAnalyzer
from urllib.parse import urlparse

def print_result_details(result, url):
    """Print detailed analysis results for a URL"""
    print("\n" + "=" * 80)
    print(f"URL: {url}")
    print("=" * 80)
    
    # Basic result information
    is_phishing = result.get("is_phishing", False)
    risk_score = result.get("risk_score", 0)
    
    print(f"VERDICT: {'⚠️  PHISHING' if is_phishing else '✅  LEGITIMATE'}")
    print(f"Risk Score: {risk_score:.1f}/100")
    
    # ML model details
    ml_result = result.get("ml_result", {})
    if ml_result:
        print("\nML MODEL DETAILS:")
        print(f"  Prediction: {'Phishing' if ml_result.get('prediction') == 1 else 'Legitimate'}")
        print(f"  Confidence: {ml_result.get('confidence', 0):.2%}")
        print(f"  Phishing Probability: {result.get('ml_result', {}).get('phishing_probability', 0):.2%}")
        print(f"  Safe Probability: {result.get('ml_result', {}).get('safe_probability', 0):.2%}")
    
    # Safe Browsing API result
    sb_result = result.get("safe_browsing_result", {})
    if sb_result:
        threats = sb_result.get("threats", [])
        if threats:
            print("\nSAFE BROWSING API RESULTS: ⚠️  THREATS DETECTED")
            for threat in threats:
                print(f"  - {threat.get('threat_type')}: {threat.get('platform_type')}")
        else:
            print("\nSAFE BROWSING API RESULTS: ✅  No threats detected")
    
    # Key features
    print("\nKEY URL FEATURES:")
    features = ml_result.get("features", {})
    
    # URL structure
    domain = urlparse(url).netloc
    print(f"  Domain: {domain}")
    
    key_features = [
        ('domain_in_ip', 'IP-based Domain'),
        ('length_url', 'URL Length'),
        ('directory_length', 'Directory Length'),
        ('qty_slash_directory', 'Slashes in Directory'),
        ('qty_dot_url', 'Dots in URL'),
        ('qty_hyphen_url', 'Hyphens in URL'),
        ('tls_ssl_certificate', 'Has SSL Certificate'),
        ('time_domain_activation', 'Domain Age (days)'),
        ('qty_redirects', 'Number of Redirects')
    ]
    
    for key, label in key_features:
        if key in features:
            value = features[key]
            if key == 'tls_ssl_certificate':
                print(f"  {label}: {'Yes' if value == 1 else 'No'}")
            else:
                print(f"  {label}: {value}")

async def test_url(url, use_safe_browsing=True):
    """Test a single URL and print the results"""
    analyzer = URLAnalyzer()
    result = await analyzer.analyze_url(url, use_safe_browsing)
    print_result_details(result, url)
    return result

async def test_urls_from_file(filename, use_safe_browsing=True):
    """Test URLs from a file, one URL per line"""
    if not os.path.exists(filename):
        print(f"Error: File '{filename}' not found")
        return
    
    with open(filename, 'r') as f:
        urls = [line.strip() for line in f if line.strip() and not line.strip().startswith('#')]
    
    if not urls:
        print("No URLs found in the file")
        return
    
    print(f"Testing {len(urls)} URLs from {filename}...")
    results = []
    
    analyzer = URLAnalyzer()
    for url in urls:
        result = await analyzer.analyze_url(url, use_safe_browsing)
        print_result_details(result, url)
        results.append({
            'url': url,
            'is_phishing': result.get('is_phishing', False),
            'risk_score': result.get('risk_score', 0),
            'ml_confidence': result.get('ml_result', {}).get('confidence', 0)
        })
    
    # Create a summary DataFrame
    df = pd.DataFrame(results)
    print("\n" + "=" * 80)
    print("SUMMARY:")
    print(f"Total URLs tested: {len(df)}")
    print(f"Phishing URLs detected: {df['is_phishing'].sum()} ({df['is_phishing'].mean():.1%})")
    print(f"Average risk score: {df['risk_score'].mean():.1f}/100")
    
    return results

def main():
    parser = argparse.ArgumentParser(description='Test URLs against phishing detection model')
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('-u', '--url', help='URL to test')
    group.add_argument('-f', '--file', help='File containing URLs to test (one URL per line)')
    parser.add_argument('--no-sb', action='store_true', help='Disable Safe Browsing API check')
    
    args = parser.parse_args()
    use_safe_browsing = not args.no_sb
    
    if args.url:
        asyncio.run(test_url(args.url, use_safe_browsing))
    elif args.file:
        asyncio.run(test_urls_from_file(args.file, use_safe_browsing))

if __name__ == "__main__":
    main()
