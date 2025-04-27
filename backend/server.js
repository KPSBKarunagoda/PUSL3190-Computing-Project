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
  res.json({ status: 'API is running' });
});

// Setup static file serving for frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Setup static file serving for admin dashboard
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));

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

// Import routes with proper require statements
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const analyzeRoutes = require('./routes/analyze');  
const analysisRoutes = require('./routes/analysis'); 

// When setting up routes, make sure to properly initialize them
console.log('Setting up API routes...');

// Register routes with correct database connection passed
app.use('/api/auth', authRoutes(pool));
app.use('/api/user', userRoutes(pool));
app.use('/', analyzeRoutes(pool));  // This will handle /analyze-url
app.use('/api', analysisRoutes);    // This will handle /api/analyze-email-headers

// Simple status check endpoint
app.get('/api/status', (req, res) => {
  res.json({ status: 'Server is running', uptime: process.uptime() });
});

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

  // Set up routes using a more resilient approach
  console.log('Setting up API routes...');
  
  try {
    // Import routes modules - make sure analyzeRoutes is properly required
    const listRouter = require('./routes/lists');
    const educationRouter = require('./routes/education');
    const adminRouter = require('./routes/admin');
    const votesRouter = require('./routes/votes');
    const passwordCheckRouter = require('./routes/password-check');
    const reportsRouter = require('./routes/reports');
    const adminReportsRouter = require('./routes/admin-reports');
    
    // Mount analyzeRoutes here, not in the API route block since it handles /analyze-url at the root level
    setupRoute('/', analyzeRoutes);
    
    // Debug log for education router
    console.log('Education router loaded:', educationRouter ? 'Yes' : 'No');
    
    // Mount routes with proper logging for setup
    console.log('Setting up /api/education route');
    app.use('/api/education', educationRouter);
    console.log('Education router mounted at /api/education');
    
    // Add direct key-findings endpoint to server.js for redundancy
    // This ensures the endpoint works even if the router has issues
    app.post('/api/education/key-findings', async (req, res) => {
      console.log('Direct key-findings endpoint called');
      try {
        const { url, analysisResult } = req.body;
        
        if (!url || !analysisResult) {
          return res.status(400).json({ 
            success: false, 
            error: 'Missing required data - URL and analysis result are required' 
          });
        }
        
        // Create an educational service instance
        const educationService = new (require('./services/education-service'))();
        
        // Generate findings
        const findings = educationService.generateKeyFindings(analysisResult, url);
        console.log(`Generated ${findings.length} key findings directly`);
        
        return res.json({
          success: true,
          findings
        });
      } catch (error) {
        console.error('Error generating key findings:', error);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to generate key findings' 
        });
      }
    });
    
    // Add AI explanation endpoint
    app.post('/api/ai/explain', async (req, res) => {
      console.log('AI explanation endpoint called');
      try {
        const { url, analysisResult, features } = req.body; // Remove bypassCache parameter
        
        if (!url || !analysisResult) {
          return res.status(400).json({ 
            success: false, 
            error: 'Missing required data - URL and analysis result are required' 
          });
        }
        
        // Create AI explanation service
        const AIExplanationService = require('./services/ai-explanation-service');
        const aiExplanationService = new AIExplanationService();
        
        // Generate explanation - removed bypassCache parameter
        console.log(`Generating AI explanation for URL: ${url}`);
        const explanation = await aiExplanationService.generateExplanation(
          url, 
          analysisResult, 
          features || {}
          // bypassCache parameter removed
        );
        
        return res.json({
          success: true,
          explanation,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error generating AI explanation:', error);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to generate AI explanation',
          message: error.message
        });
      }
    });
    
    setupRoute('/api/auth', authRoutes);
    setupRoute('/api/lists', listRouter);
    setupRoute('/api/admin', adminRouter);
    setupRoute('/api/user', userRoutes);
    setupRoute('/api/votes', votesRouter);
    setupRoute('/api/check-password', passwordCheckRouter);
    setupRoute('/api/reports', reportsRouter);
    setupRoute('/api/admin/reports', adminReportsRouter);
    app.use('/api', analysisRoutes);
    
    // Start the server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`✅ API routes configured:`);
      console.log(`   - /api/education/key-findings`);
      console.log(`   - /api/analyze-email-headers`);
    });
  } catch (error) {
    console.error('Error setting up routes:', error);
    process.exit(1);
  }
}

// Helper function to safely set up routes
function setupRoute(path, routerModule) {
  try {
    if (!routerModule) {
      console.error(`Error: Router module for path ${path} is undefined or not properly exported`);
      return;
    }
    
    if (typeof routerModule === 'function') {
      console.log(`Setting up function-style router at ${path}`);
      app.use(path, routerModule(pool));
    } else {
      console.log(`Setting up object-style router at ${path}`);
      app.use(path, routerModule);
    }
    console.log(`Route mounted: ${path}`);
  } catch (error) {
    console.error(`Error mounting router at ${path}:`, error.message);
  }
}

// Start the initialization process
initializeServer().catch(err => {
  console.error('Server initialization failed:', err);
  process.exit(1);
});

// Add to console log of API routes configured
console.log(`   - /api/analyze-email-headers`);