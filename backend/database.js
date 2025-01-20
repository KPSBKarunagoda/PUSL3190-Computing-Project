const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost', // XAMPP MySQL server host
  user: 'your_mysql_user', // Your MySQL username
  password: 'your_mysql_password', // Your MySQL password
  database: 'phishing_detector' // Your MySQL database name
});

async function isWhitelisted(url) {
  const [rows] = await pool.query('SELECT url FROM whitelist WHERE url = ?', [url]);
  return rows.length > 0;
}

async function addToWhitelist(url) {
  await pool.query('INSERT INTO whitelist (url) VALUES (?)', [url]);
}

module.exports = {
  isWhitelisted,
  addToWhitelist
};