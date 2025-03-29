import mysql.connector
import sys
import time
import os
from urllib.parse import urlparse

class BlacklistService:
    def __init__(self):
        self.dbconfig = {
            'host': 'localhost',
            'user': 'root',
            'password': 'Sanuth123',
            'database': 'phishing_detector',
            'port': 3306
        }
        
        # Cache for performance
        self.blacklist_cache = {}
        self.cache_validity = 300  # 5 minutes
        self.last_refresh = 0
        
        # Initialize connection and cache
        self._init_connection()
        self._refresh_cache()
        
    def _init_connection(self):
        """Initialize database connection"""
        try:
            self.connection = mysql.connector.connect(**self.dbconfig)
            print("BlacklistService: Database connection successful", file=sys.stderr)
            return True
        except Exception as e:
            print(f"BlacklistService: Database connection error: {str(e)}", file=sys.stderr)
            self.connection = None
            return False
    
    def _refresh_cache(self):
        """Refresh the blacklist cache from database"""
        try:
            # Only refresh if needed
            current_time = time.time()
            if self.last_refresh > 0 and current_time - self.last_refresh < self.cache_validity:
                return
            
            if not self.connection or not self.connection.is_connected():
                self._init_connection()
                
            if not self.connection:
                print("BlacklistService: No database connection available for cache refresh", file=sys.stderr)
                return
                
            cursor = self.connection.cursor()
            cursor.execute("SELECT Domain FROM Blacklist")
            domains = [row[0].lower() for row in cursor.fetchall()]
            cursor.close()
            
            # Update cache
            self.blacklist_cache = {domain.lower(): True for domain in domains}
            self.last_refresh = current_time
            
            print(f"BlacklistService: Cache refreshed with {len(domains)} domains", file=sys.stderr)
            
        except Exception as e:
            print(f"BlacklistService: Error refreshing cache: {str(e)}", file=sys.stderr)
    
    def is_blacklisted(self, url):
        """Check if a URL's domain is in the blacklist"""
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
            
            print(f"BlacklistService: Checking if domain '{domain}' is blacklisted", file=sys.stderr)
            
            # Direct domain match
            if domain in self.blacklist_cache:
                print(f"BlacklistService: Domain '{domain}' found in blacklist", file=sys.stderr)
                return True
            
            # Check for parent domain match (sub.example.com would match example.com)
            domain_parts = domain.split('.')
            for i in range(1, len(domain_parts)):
                parent_domain = '.'.join(domain_parts[i:])
                if parent_domain in self.blacklist_cache:
                    print(f"BlacklistService: Parent domain '{parent_domain}' found in blacklist", file=sys.stderr)
                    return True
            
            print(f"BlacklistService: Domain '{domain}' is NOT in blacklist", file=sys.stderr)
            return False
            
        except Exception as e:
            print(f"BlacklistService: Error checking blacklist: {str(e)}", file=sys.stderr)
            return False