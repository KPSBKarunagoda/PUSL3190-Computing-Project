const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost', // XAMPP MySQL server host
  user: 'root', // Your MySQL username
  password: 'sanuth', // Your MySQL password
  database: 'phishing_detector' // Your MySQL database name
});

async function testConnection() {
  try {
    // Test the connection
    const connection = await pool.getConnection();
    console.log('Database connection successful!');

    // Perform a simple query to test the connection
    const [rows] = await connection.query('SELECT 1 + 1 AS solution');
    console.log('Query result:', rows[0].solution); // Should output: 2

    // Release the connection back to the pool
    connection.release();
  } catch (error) {
    console.error('Error connecting to the database:', error);
  }
}

testConnection();