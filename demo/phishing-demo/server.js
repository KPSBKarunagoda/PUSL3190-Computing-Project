const express = require('express');
const path = require('path');
const app = express();
const PORT = 3030;

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the phishing page at multiple URLs to trigger detection
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Add more suspicious URL patterns
const suspiciousPaths = [
  '/login/verify.php',
  '/secure-login/verification/account/update',
  '/signin/secure/validation/',
  '/account/verification/secure/',
  '/confirm-identity/login',
  '/auth/banking/secure',
  '/banking/personal-info',
  '/account/update/payment-method'
];

// Set up routes for all suspicious paths
suspiciousPaths.forEach(path => {
  app.get(path, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });
});

// Handle form submission (just for the demo)
app.post('/auth/verify', (req, res) => {
  console.log('Form submission detected (DEMO ONLY - No data stored)');
  console.log('Form data received:', req.body);
  res.json({ 
    status: 'demo', 
    message: 'This is a demonstration - no data was stored',
    redirect: '/account/verified'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║      PHISHING DEMO SERVER RUNNING                    ║
║                                                      ║
║   To access the demo and trigger your extension:     ║
║                                                      ║
║   1. Access via fake domain (best method):           ║
║      http://paypal-secure-verification.com:3030      ║
║                                                      ║
║   2. Or try these suspicious paths:                  ║
║      /login/verify.php                               ║
║      /secure-login/verification/account/update       ║
║                                                      ║
║   Press Ctrl+C to stop server                        ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
  `);
});
