import mysql.connector
import pandas as pd
import os
import sys

def setup_whitelist_db():
    try:
        # MySQL connection configuration
        config = {
            'host': 'localhost',
            'user': 'root',
            'password': 'Sanuth123',  # Default XAMPP password
            'database': 'phishing_detector'
        }

        # First create database if it doesn't exist
        temp_conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='Sanuth123'
        )
        temp_cursor = temp_conn.cursor()
        temp_cursor.execute('CREATE DATABASE IF NOT EXISTS phishing_detection')
        temp_conn.close()

        # Create main connection
        conn = mysql.connector.connect(**config)
        cursor = conn.cursor()

        # Create whitelist table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS whitelist (
            id INT AUTO_INCREMENT PRIMARY KEY,
            domain VARCHAR(255) NOT NULL UNIQUE,
            rank INT,
            date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_domain (domain)
        )
        ''')

        # Load CSV data
        current_dir = os.path.dirname(os.path.dirname(__file__))
        csv_path = os.path.join(current_dir, 'data', 'tranco_whitelist.csv')
        df = pd.read_csv(csv_path)
        print(f"Loading {len(df)} domains from CSV...", file=sys.stderr)

        # Insert data in batches
        batch_size = 1000
        for i in range(0, len(df), batch_size):
            batch = df.iloc[i:i+batch_size]
            values = [(row['domain'].lower().strip(), index + i + 1) 
                     for index, row in batch.iterrows()]
            
            cursor.executemany(
                'INSERT IGNORE INTO whitelist (domain, rank) VALUES (%s, %s)',
                values
            )
            conn.commit()
            print(f"Processed {i + len(batch)} domains...", file=sys.stderr)

        print("Successfully loaded whitelist into database", file=sys.stderr)

        # Verify data
        cursor.execute('SELECT COUNT(*) FROM whitelist')
        count = cursor.fetchone()[0]
        print(f"Total domains in database: {count}", file=sys.stderr)

        cursor.close()
        conn.close()

    except Exception as e:
        print(f"Database setup failed: {str(e)}", file=sys.stderr)
        raise

if __name__ == "__main__":
    setup_whitelist_db()