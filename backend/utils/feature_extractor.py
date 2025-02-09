from urllib.parse import urlparse, parse_qs
import re
import dns.resolver
import requests
import socket
import whois
from datetime import datetime
import ssl
import OpenSSL
import concurrent.futures

class URLFeatureExtractor:
    def __init__(self):
        self.features = {}
        
    def count_chars(self, text, char):
        return text.count(char)
        
    def extract_features(self, url):
        try:
            # Parse URL
            parsed = urlparse(url)
            
            # URL component extraction
            domain = parsed.netloc
            path = parsed.path
            params = parsed.query
            
            # Basic URL features
            self.features['length_url'] = len(url)
            self.features['qty_dot_url'] = self.count_chars(url, '.')
            self.features['qty_hyphen_url'] = self.count_chars(url, '-')
            self.features['qty_underline_url'] = self.count_chars(url, '_')
            self.features['qty_slash_url'] = self.count_chars(url, '/')
            self.features['qty_questionmark_url'] = self.count_chars(url, '?')
            self.features['qty_equal_url'] = self.count_chars(url, '=')
            self.features['qty_at_url'] = self.count_chars(url, '@')
            self.features['qty_and_url'] = self.count_chars(url, '&')
            self.features['qty_exclamation_url'] = self.count_chars(url, '!')
            self.features['qty_space_url'] = self.count_chars(url, ' ')
            self.features['qty_tilde_url'] = self.count_chars(url, '~')
            self.features['qty_comma_url'] = self.count_chars(url, ',')
            self.features['qty_plus_url'] = self.count_chars(url, '+')
            self.features['qty_asterisk_url'] = self.count_chars(url, '*')
            self.features['qty_hashtag_url'] = self.count_chars(url, '#')
            self.features['qty_dollar_url'] = self.count_chars(url, '$')
            self.features['qty_percent_url'] = self.count_chars(url, '%')
            
            # Domain features
            self.features['domain_length'] = len(domain)
            self.features['qty_dot_domain'] = self.count_chars(domain, '.')
            self.features['qty_hyphen_domain'] = self.count_chars(domain, '-')
            # ... Add all domain-related features
            
            # Directory features
            self.features['directory_length'] = len(path)
            self.features['qty_dot_directory'] = self.count_chars(path, '.')
            self.features['qty_hyphen_directory'] = self.count_chars(path, '-')
            # ... Add all directory-related features
            
            # Parameter features
            self.features['params_length'] = len(params)
            self.features['qty_params'] = len(parse_qs(params))
            # ... Add all parameter-related features
            
            # Additional security features
            with concurrent.futures.ThreadPoolExecutor() as executor:
                # DNS features
                future_dns = executor.submit(self.get_dns_features, domain)
                # SSL features
                future_ssl = executor.submit(self.get_ssl_features, domain)
                # Domain age features
                future_domain = executor.submit(self.get_domain_features, domain)
                
                # Get results
                dns_features = future_dns.result()
                ssl_features = future_ssl.result()
                domain_features = future_domain.result()
                
                self.features.update(dns_features)
                self.features.update(ssl_features)
                self.features.update(domain_features)
            
            return self.features
            
        except Exception as e:
            print(f"Error extracting features: {str(e)}")
            return None
            
    def get_dns_features(self, domain):
        features = {}
        try:
            # DNS resolution
            answers = dns.resolver.resolve(domain, 'A')
            features['qty_ip_resolved'] = len(answers)
            
            # MX records
            mx_records = dns.resolver.resolve(domain, 'MX')
            features['qty_mx_servers'] = len(mx_records)
            
            # NS records
            ns_records = dns.resolver.resolve(domain, 'NS')
            features['qty_nameservers'] = len(ns_records)
            
        except:
            features['qty_ip_resolved'] = 0
            features['qty_mx_servers'] = 0
            features['qty_nameservers'] = 0
            
        return features
        
    def get_ssl_features(self, domain):
        features = {}
        try:
            ctx = ssl.create_default_context()
            with ctx.wrap_socket(socket.socket(), server_hostname=domain) as s:
                s.connect((domain, 443))
                cert = s.getpeercert()
                features['tls_ssl_certificate'] = 1
        except:
            features['tls_ssl_certificate'] = 0
            
        return features
        
    def get_domain_features(self, domain):
        features = {}
        try:
            w = whois.whois(domain)
            creation_date = w.creation_date
            expiration_date = w.expiration_date
            
            if isinstance(creation_date, list):
                creation_date = creation_date[0]
            if isinstance(expiration_date, list):
                expiration_date = expiration_date[0]
                
            features['time_domain_activation'] = (datetime.now() - creation_date).days
            features['time_domain_expiration'] = (expiration_date - datetime.now()).days
            
        except:
            features['time_domain_activation'] = -1
            features['time_domain_expiration'] = -1
            
        return features