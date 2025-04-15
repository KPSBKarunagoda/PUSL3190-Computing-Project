const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
const { pool, testConnection } = require('./config/db');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Configure secure CORS settings
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'] 
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
  credentials: true,
  maxAge: 86400
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add security headers
app.use((req, res, next) => {
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; img-src 'self' data:;"
  );
  
  // Other security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  
  next();
});

// Debug endpoint - add this before any other routes
app.get('/api/debug', (req, res) => {
  console.log('Debug endpoint accessed');
  res.json({ status: 'Server is running' });
});

// Setup static file serving for frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Add login-specific rate limiting with more generous limits
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes instead of 15
  max: 20, // Increased from 5 to 20 attempts
  message: { message: 'Too many login attempts, please try again later' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply login rate limiter only to login routes
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/admin-login', loginLimiter);

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

  // Remove the automatic admin creation
  // const AuthService = require('./services/auth');
  // const authService = new AuthService(pool);
  // await authService.createInitialAdmin().catch(console.error);

  // Set up routes - WELL-ORGANIZED AND SEPARATED
  console.log('Setting up API routes...');
  const authRouter = require('./routes/auth')(pool);
  const listRouter = require('./routes/lists')(pool);
  const educationRouter = require('./routes/education')(pool);
  const adminRouter = require('./routes/admin')(pool);
  const userRouter = require('./routes/user')(pool);
  const votesRouter = require('./routes/votes')(pool);
  const passwordCheckRouter = require('./routes/password-check')(pool); // Add this line

  // Mount routes
  app.use('/api/auth', authRouter);
  app.use('/api/lists', listRouter);
  app.use('/api/education', educationRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/user', userRouter);
  app.use('/api/votes', votesRouter);
  app.use('/api/reports', require('./routes/reports')(pool));
  app.use('/api/check-password', passwordCheckRouter); // Add this line

  // ADDED: Admin reports endpoint that uses admin authentication middleware
  app.use('/api/admin/reports', require('./routes/admin-reports')(pool));

  // Log routes before mounting
  console.log('Auth routes stack:', authRouter.stack.length);
  console.log('Admin routes stack:', adminRouter.stack.length);
  console.log('User routes stack:', userRouter.stack.length);
  console.log('Votes routes stack:', votesRouter.stack.length);

  // Mount routes
  app.use('/api/auth', authRouter);
  app.use('/api/lists', listRouter);
  app.use('/api/education', educationRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/user', userRouter);
  app.use('/api/votes', votesRouter);
  app.use('/api/reports', require('./routes/reports')(pool));

  // Add test endpoint directly to app
  app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working' });
  });

  // Log all routes that were registered (for debugging)
  console.log('Registered API routes:');
  app._router.stack.forEach((r) => {
    if (r.route && r.route.path) {
      console.log(`${Object.keys(r.route.methods)} ${r.route.path}`);
    } else if (r.name === 'router') {
      r.handle.stack.forEach((layer) => {
        if (layer.route) {
          const methods = Object.keys(layer.route.methods).join(',');
          console.log(`${methods.toUpperCase()} ${r.regexp.toString().replace('/^\\', '/').replace('\\/?(?=\\/|$)/i', '')}${layer.route.path}`);
        }
      });
    }
  });

  // Serve static admin panel files
  app.use('/admin', express.static(path.join(__dirname, '../admin')));

  // Serve admin panel
  app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../admin/index.html'));
  });

  // URL analysis endpoint with URL validation
  app.post('/analyze-url', async (req, res) => {
    const { url, useSafeBrowsing } = req.body;
    
    // Validate URL before processing
    const isValidUrl = (urlString) => {
      try {
        const url = new URL(urlString);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch (e) {
        return false;
      }
    };
    
    if (!url || !isValidUrl(url)) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    
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

  // Route to handle frontend page requests
  app.get('*.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', req.path));
  });

  // Catch-all route to serve index.html for client-side routing
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !path.extname(req.path)) {
      res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
    } else {
      res.status(404).json({ error: 'Not found' });
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