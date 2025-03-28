import mysql.connector
import sys
import time
import os
from urllib.parse import urlparse

class WhitelistService:
    def __init__(self):
        self.dbconfig = {
            'host': 'localhost',
            'user': 'root',  # Use your MySQL username
            'password': 'Sanuth123',  # Use your MySQL password
            'database': 'phishing_detector',  # Use your database name
            'port': 3306
        }
        
        # Cache for performance
        self.whitelist_cache = {}
        self.cache_validity = 300  # 5 minutes
        self.last_refresh = 0
        
        # Initialize connection and cache
        self._init_connection()
        self._refresh_cache()
        
    def _init_connection(self):
        """Initialize database connection"""
        try:
            self.connection = mysql.connector.connect(**self.dbconfig)
            print("WhitelistService: Database connection successful", file=sys.stderr)
            return True
        except Exception as e:
            print(f"WhitelistService: Database connection error: {str(e)}", file=sys.stderr)
            self.connection = None
            return False
    
    def _refresh_cache(self):
        """Refresh the whitelist cache from database"""
        try:
            # Only refresh if needed
            current_time = time.time()
            if self.last_refresh > 0 and current_time - self.last_refresh < self.cache_validity:
                return
            
            if not self.connection or not self.connection.is_connected():
                self._init_connection()
                
            if not self.connection:
                print("WhitelistService: No database connection available for cache refresh", file=sys.stderr)
                return
                
            cursor = self.connection.cursor()
            cursor.execute("SELECT Domain FROM Whitelist")
            domains = [row[0].lower() for row in cursor.fetchall()]
            cursor.close()
            
            # Update cache
            self.whitelist_cache = {domain.lower(): True for domain in domains}
            self.last_refresh = current_time
            
            print(f"WhitelistService: Cache refreshed with {len(domains)} domains", file=sys.stderr)
            print(f"WhitelistService: Domains in cache: {', '.join(self.whitelist_cache.keys())}", file=sys.stderr)
            
        except Exception as e:
            print(f"WhitelistService: Error refreshing cache: {str(e)}", file=sys.stderr)
    
    def is_whitelisted(self, url):
        """Check if a URL's domain is in the whitelist"""
        try:
            # Make sure cache is fresh
            self._refresh_cache()
            
            # Extract domain from URL
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            
            # Remove port if present
            if ':' in domain:
                domain = domain.split(':')[0]
                
            # Strip 'www.' if present
            if domain.startswith('www.'):
                domain = domain[4:]
            
            print(f"WhitelistService: Checking if domain '{domain}' is whitelisted", file=sys.stderr)
            
            # Direct domain match
            if domain in self.whitelist_cache:
                print(f"WhitelistService: Domain '{domain}' found in whitelist", file=sys.stderr)
                return True
            
            # Check for parent domain match (sub.example.com would match example.com)
            domain_parts = domain.split('.')
            for i in range(1, len(domain_parts)):
                parent_domain = '.'.join(domain_parts[i:])
                if parent_domain in self.whitelist_cache:
                    print(f"WhitelistService: Parent domain '{parent_domain}' found in whitelist", file=sys.stderr)
                    return True
            
            print(f"WhitelistService: Domain '{domain}' is NOT in whitelist", file=sys.stderr)
            return False
            
        except Exception as e:
            print(f"WhitelistService: Error checking whitelist: {str(e)}", file=sys.stderr)
            return False