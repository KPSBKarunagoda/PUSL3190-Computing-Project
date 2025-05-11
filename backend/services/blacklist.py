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
        self.cache_ttl = 300  # 5 minutes
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
            # Check if cache needs refresh
            current_time = time.time()
            if not hasattr(self, 'blacklist_cache') or current_time - self.last_refresh > self.cache_ttl:
                print("BlacklistService: Refreshing blacklist cache from database", file=sys.stderr)
                
                # Use database connection to get current blacklist
                conn = self.connection
                if not conn or not conn.is_connected():
                    self._init_connection()
                    conn = self.connection
                
                if not conn:
                    print("BlacklistService: No database connection available for cache refresh", file=sys.stderr)
                    return
                
                cursor = conn.cursor(dictionary=True)
                
                # Fetch URLs with risk levels
                cursor.execute("SELECT URL, RiskLevel FROM Blacklist")
                blacklist_entries = cursor.fetchall()
                cursor.close()
                
                # Create dictionary with URLs as keys and risk levels as values
                self.blacklist_cache = {}
                for entry in blacklist_entries:
                    if entry['URL']:
                        self.blacklist_cache[entry['URL'].lower()] = entry['RiskLevel']
                
                print(f"BlacklistService: Loaded {len(self.blacklist_cache)} URLs into blacklist cache", file=sys.stderr)
                self.last_refresh = current_time
        except Exception as e:
            print(f"BlacklistService: Error refreshing cache: {str(e)}", file=sys.stderr)
            # Initialize empty cache in case of error
            if not hasattr(self, 'blacklist_cache'):
                self.blacklist_cache = {}
                self.last_refresh = time.time()
    
    def is_blacklisted(self, url):
        """Check if a URL is blacklisted
        
        Args:
            url (str): The URL to check
            
        Returns:
            dict: Blacklist result with status and risk level
        """
        try:
            print(f"Checking if URL is blacklisted: {url}", file=sys.stderr)
            
            if url in self.blacklist_cache:
                print(f"URL found in cache: {url}", file=sys.stderr)
                return {
                    "blacklisted": True,
                    "risk_level": self.blacklist_cache[url]["risk_level"],
                    "source": "Blacklist Cache"
                }
            
            # Extract domain from URL for simple domain matching
            parsed_url = urlparse(url)
            domain = parsed_url.netloc.lower()
            
            # Simple URL variations for exact matching only
            url_variants = [
                url,                          # Original URL
                url.lower(),                  # Lowercase URL
                url.lower().rstrip('/'),      # Without trailing slash
                domain                        # Just domain
            ]
            
            print(f"Checking blacklist with URLs: {url_variants}", file=sys.stderr)
            
            # Use only exact matching with IN clause
            placeholders = ', '.join(['%s'] * len(url_variants))
            sql = f"SELECT * FROM Blacklist WHERE URL IN ({placeholders})"
            
            cursor = self.connection.cursor(dictionary=True)
            cursor.execute(sql, url_variants)
            result = cursor.fetchone()
            cursor.close()
                
            if result:
                print(f"URL is blacklisted! Match found: {result['URL']}", file=sys.stderr)
                # Add to cache
                self.blacklist_cache[url] = {
                    "risk_level": result["RiskLevel"] if "RiskLevel" in result else 100
                }
                
                return {
                    "blacklisted": True,
                    "risk_level": result["RiskLevel"] if "RiskLevel" in result else 100,
                    "source": "Blacklist Database"
                }
            
            print(f"URL is not blacklisted: {url}", file=sys.stderr)
            return {"blacklisted": False}
        except Exception as e:
            print(f"Blacklist check error: {str(e)}", file=sys.stderr)
            # Return false in case of errors to avoid blocking legitimate sites
            return {"blacklisted": False, "error": str(e)}
    
    def _normalize_url(self, url):
        """Normalize URL for consistent matching
        
        Args:
            url (str): URL to normalize
            
        Returns:
            str: Normalized URL
        """
        try:
            # Remove trailing slash for consistent matching
            url = url.rstrip('/')
            
            # Convert to lowercase
            url = url.lower()
            
            # Parse URL
            parsed = urlparse(url)
            
            # Reconstruct without query parameters and fragments
            normalized = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            
            return normalized
        except Exception as e:
            print(f"URL normalization error: {str(e)}", file=sys.stderr)
            return url