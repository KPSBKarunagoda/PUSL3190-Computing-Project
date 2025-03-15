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
            'password': 'Sanuth123',  # No password for fresh XAMPP installation
            'port': 3306
        }
        try:
            # First try connecting without database
            self.pool = mysql.connector.pooling.MySQLConnectionPool(
                pool_name="whitelist_pool",
                pool_size=5,
                **self.dbconfig
            )
            
            # Create database if it doesn't exist
            conn = self.pool.get_connection()
            cursor = conn.cursor()
            cursor.execute("CREATE DATABASE IF NOT EXISTS phishing_detector")
            cursor.close()
            conn.close()
            
            # Now update config with database
            self.dbconfig['database'] = 'phishing_detector'
            
            # Create new pool with database
            self.pool = mysql.connector.pooling.MySQLConnectionPool(
                pool_name="whitelist_pool",
                pool_size=5,
                **self.dbconfig
            )
            
            # Initialize tables
            self._init_db()
            
        except Exception as e:
            print(f"Failed to initialize database connection: {str(e)}", file=sys.stderr)
            raise

    def _init_db(self):
        """Ensure database and table exist"""
        try:
            conn = self.pool.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS Whitelist (
                WhitelistID INT PRIMARY KEY AUTO_INCREMENT,
                URL VARCHAR(255) NOT NULL,
                Domain VARCHAR(255) NOT NULL,
                AddedDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                AddedBy INT NOT NULL,
                FOREIGN KEY (AddedBy) REFERENCES User(UserID)
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

    async def add_to_whitelist(self, url: str, user_id: int) -> bool:
        """Add a domain to the whitelist"""
        try:
            domain = urlparse(url).netloc.lower()
            if domain.startswith('www.'):
                domain = domain[4:]

            conn = self.pool.get_connection()
            cursor = conn.cursor()
            
            cursor.execute(
                'INSERT INTO whitelist (domain, rank, date_added) VALUES (%s, %s, NOW())',
                (domain, user_id)
            )
            conn.commit()
            
            cursor.close()
            conn.close()
            
            return True

        except Exception as e:
            print(f"Error adding to whitelist: {str(e)}", file=sys.stderr)
            return False

    async def remove_from_whitelist(self, url: str) -> bool:
        """Remove a domain from the whitelist"""
        try:
            domain = urlparse(url).netloc.lower()
            if domain.startswith('www.'):
                domain = domain[4:]

            conn = self.pool.get_connection()
            cursor = conn.cursor()
            
            cursor.execute(
                'DELETE FROM whitelist WHERE domain = %s',
                (domain,)
            )
            conn.commit()
            
            cursor.close()
            conn.close()
            
            return True

        except Exception as e:
            print(f"Error removing from whitelist: {str(e)}", file=sys.stderr)
            return False

    async def get_whitelist(self) -> list:
        """Get the entire whitelist"""
        try:
            conn = self.pool.get_connection()
            cursor = conn.cursor(dictionary=True)
            
            cursor.execute(
                'SELECT * FROM whitelist ORDER BY date_added DESC'
            )
            result = cursor.fetchall()
            
            cursor.close()
            conn.close()
            
            return result

        except Exception as e:
            print(f"Error getting whitelist: {str(e)}", file=sys.stderr)
            return []