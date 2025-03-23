const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
const { pool, testConnection } = require('./config/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize server with database connection
async function initializeServer() {
  // Test database connection
  const connected = await testConnection();
  if (!connected) {
    console.error('Unable to start server without database connection');
    process.exit(1);
  }

  // Initialize list tables
  const ListService = require('./services/list-service');
  const listService = new ListService(pool);
  await listService.createListTables().catch(console.error);

  // Create initial admin user if needed
  const AuthService = require('./services/auth');
  const authService = new AuthService(pool);
  await authService.createInitialAdmin().catch(console.error);

  // Set up routes
  app.use('/api/auth', require('./routes/auth')(pool));
  app.use('/api/lists', require('./routes/lists')(pool));

  // Serve static admin panel files
  app.use('/admin', express.static(path.join(__dirname, '../admin')));

  // Serve admin panel
  app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../admin/index.html'));
  });

  // URL analysis endpoint
  app.post('/analyze-url', async (req, res) => {
    const { url, useSafeBrowsing } = req.body;
    const safeBrowsingFlag = String(Boolean(useSafeBrowsing));
    console.log(`Analyzing URL: ${url}, Safe Browsing enabled: ${safeBrowsingFlag}`);
    
    try {
      const python = spawn('python', [
        'analyze_url.py', 
        url, 
        safeBrowsingFlag
      ]);
      
      let jsonData = '';
      let debugOutput = '';

      python.stdout.on('data', (data) => {
        jsonData += data.toString();
        console.log('Python stdout:', data.toString());
      });

      python.stderr.on('data', (data) => {
        debugOutput += data.toString();
        console.log('Python stderr:', data.toString());
      });

      python.on('close', (code) => {
        console.log('Python process exited with code', code);
        try {
          if (jsonData.trim()) {
            const result = JSON.parse(jsonData.trim());
            
            // Ensure consistent response structure
            const response = {
              url: url,
              risk_score: result.risk_score || 0,
              is_phishing: result.is_phishing || false,
              risk_explanation: result.risk_explanation || result.message || 'No detailed explanation available',
              features: result.features || {},
              ml_confidence: result.ml_confidence || result.ml_result?.confidence || 0,
              timestamp: new Date().toISOString()
            };

            console.log('Sending analysis response:', response);
            res.json(response);
          } else {
            res.status(500).json({
              error: 'Analysis failed',
              debug: debugOutput
            });
          }
        } catch (e) {
          console.error('JSON parse error:', e);
          res.status(500).json({
            error: 'JSON parse error',
            debug: debugOutput,
            originalError: e.message
          });
        }
      });
    } catch (error) {
      console.error('Server error:', error);
      res.status(500).json({
        error: 'Server error',
        message: error.message
      });
    }
  });

  // Start server
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`Admin panel available at: http://localhost:${PORT}/admin`);
  });
}

// Start the initialization process
initializeServer().catch(err => {
  console.error('Server initialization failed:', err);
  process.exit(1);
});