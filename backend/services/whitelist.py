import mysql.connector
from mysql.connector import pooling
import os
import sys
from typing import Optional
from urllib.parse import urlparse

class WhitelistService:
    def __init__(self):
        self.dbconfig = {
            'host': 'localhost',
            'user': 'root',
            'password': 'Sanuth123',
            'database': 'phishing_detection'
        }
        # Create connection pool
        self.pool = mysql.connector.pooling.MySQLConnectionPool(
            pool_name="whitelist_pool",
            pool_size=5,
            **self.dbconfig
        )
        self._init_db()

    def _init_db(self):
        """Ensure database and table exist"""
        try:
            conn = self.pool.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS whitelist (
                id INT AUTO_INCREMENT PRIMARY KEY,
                domain VARCHAR(255) NOT NULL UNIQUE,
                rank INT,
                date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_domain (domain)
            )
            ''')
            
            conn.commit()
            cursor.close()
            conn.close()
        except Exception as e:
            print(f"Database initialization failed: {str(e)}", file=sys.stderr)

    def is_whitelisted(self, url: str) -> bool:
        """Check if domain is whitelisted"""
        try:
            domain = urlparse(url).netloc.lower()
            if domain.startswith('www.'):
                domain = domain[4:]

            conn = self.pool.get_connection()
            cursor = conn.cursor()
            
            cursor.execute(
                'SELECT EXISTS(SELECT 1 FROM whitelist WHERE domain = %s)',
                (domain,)
            )
            result = cursor.fetchone()
            
            cursor.close()
            conn.close()
            
            return bool(result[0])

        except Exception as e:
            print(f"Whitelist check failed: {str(e)}", file=sys.stderr)
            return False

    def get_domain_info(self, domain: str) -> Optional[dict]:
        """Get detailed information about a whitelisted domain"""
        try:
            conn = self.pool.get_connection()
            cursor = conn.cursor(dictionary=True)
            
            cursor.execute(
                'SELECT domain, rank, date_added FROM whitelist WHERE domain = %s',
                (domain.lower(),)
            )
            result = cursor.fetchone()
            
            cursor.close()
            conn.close()

            return result

        except Exception as e:
            print(f"Error getting domain info: {str(e)}", file=sys.stderr)
            return None