const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class GeminiAdapter {
  constructor() {
    // Load API key from environment
    this.apiKey = process.env.GEMINI_API_KEY;
    this.model = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
    this.cacheEnabled = process.env.ENABLE_AI_CACHE !== 'false';
    this.cachePath = path.join(__dirname, '../../data/ai-cache');
    
    console.log('GeminiAdapter initializing...');
    console.log('Using model:', this.model);
    console.log('AI cache enabled:', this.cacheEnabled);
    
    // Validate API key
    if (!this.apiKey) {
      console.error('ERROR: GEMINI_API_KEY not found in environment variables. AI explanations will not work.');
    } else if (this.apiKey.includes('YOUR_API_KEY') || this.apiKey.length < 30) {
      console.error('ERROR: Invalid GEMINI_API_KEY format. Please set a valid API key.');
      this.apiKey = null;
    } else {
      console.log('Gemini API key found - will initialize client');
      this._initializeClient();
    }
    
    // Create cache directory if it doesn't exist
    if (this.cacheEnabled) {
      try {
        if (!fs.existsSync(this.cachePath)) {
          fs.mkdirSync(this.cachePath, { recursive: true });
          console.log(`Created AI cache directory at ${this.cachePath}`);
        }
      } catch (err) {
        console.error('Failed to create cache directory:', err.message);
      }
    }
    
    // Initialize rate limiting tracking
    this.rateLimiter = {
      requestsThisMinute: 0,
      lastRequestTime: 0,
      limitPerMinute: parseInt(process.env.GEMINI_RPM || '10'),
      resetTime: Date.now() + 60000
    };
  }
  
  _initializeClient() {
    try {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      console.log('Gemini client initialized successfully');
    } catch (err) {
      console.error('Failed to initialize Gemini client:', err.message);
      this.apiKey = null;
    }
  }

  async _handleRateLimit() {
    // Reset counter if minute has passed
    if (Date.now() > this.rateLimiter.resetTime) {
      this.rateLimiter.requestsThisMinute = 0;
      this.rateLimiter.resetTime = Date.now() + 60000;
    }
    
    // If we're at the limit, wait until the next minute
    if (this.rateLimiter.requestsThisMinute >= this.rateLimiter.limitPerMinute) {
      const waitTime = this.rateLimiter.resetTime - Date.now() + 100; // Add 100ms buffer
      console.log(`Rate limit reached. Waiting ${waitTime}ms before next request`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // After waiting, reset the counter
      this.rateLimiter.requestsThisMinute = 0;
      this.rateLimiter.resetTime = Date.now() + 60000;
    }
  }
  
  _getCacheKey(prompt, context, options) {
    // Create a deterministic cache key from inputs
    const input = JSON.stringify({ prompt, context, options });
    return crypto.createHash('md5').update(input).digest('hex');
  }
  
  _checkCache(cacheKey) {
    if (!this.cacheEnabled) return null;
    
    try {
      const cachePath = path.join(this.cachePath, `${cacheKey}.json`);
      if (fs.existsSync(cachePath)) {
        const cacheData = fs.readFileSync(cachePath, 'utf8');
        return JSON.parse(cacheData).content;
      }
    } catch (error) {
      console.error('Cache read error:', error.message);
    }
    
    return null;
  }
  
  _saveToCache(cacheKey, content) {
    if (!this.cacheEnabled) return;
    
    try {
      const cachePath = path.join(this.cachePath, `${cacheKey}.json`);
      fs.writeFileSync(cachePath, JSON.stringify({ 
        timestamp: new Date().toISOString(),
        content
      }));
    } catch (error) {
      console.error('Cache write error:', error.message);
    }
  }

  async generateCompletion(prompt, context = null, options = {}) {
    // Check if properly initialized
    if (!this.apiKey) {
      throw new Error('Gemini AI not properly initialized - check API key');
    }
    
    // Check cache first
    const cacheKey = this._getCacheKey(prompt, context, options);
    const cachedResult = this._checkCache(cacheKey);
    if (cachedResult) {
      console.log('Using cached AI response');
      return cachedResult;
    }
    
    // Apply rate limiting
    await this._handleRateLimit();
    
    // Increment counter
    this.rateLimiter.requestsThisMinute++;
    this.rateLimiter.lastRequestTime = Date.now();
    
    try {
      // Initialize the model
      if (!this.genAI) {
        this._initializeClient();
      }
      
      const genModel = this.genAI.getGenerativeModel({
        model: this.model,
        generationConfig: {
          temperature: options.temperature || 0.7,
          topK: options.topK || 40,
          topP: options.topP || 0.95,
          maxOutputTokens: options.maxTokens || 1024,
        },
      });
      
      // Create prompt parts
      let parts = [
        { text: prompt }
      ];
      
      // Add context if provided
      if (context) {
        parts.push({ text: `\n\nAnalysis Context:\n${JSON.stringify(context, null, 2)}` });
      }
      
      // Generate content
      const result = await genModel.generateContent({
        contents: [{ parts }],
        generationConfig: {
          temperature: options.temperature || 0.7,
          topK: options.topK || 40,
          topP: options.topP || 0.95,
          maxOutputTokens: options.maxTokens || 1024,
        },
      });
      
      const response = result.response;
      const text = response.text();
      
      // Cache the result if caching is enabled
      if (this.cacheEnabled) {
        this._saveToCache(cacheKey, text);
      }
      
      return text;
    } catch (error) {
      console.error('Gemini API error:', error.message);
      // Enhanced error handling
      if (error.message.includes('quota')) {
        throw new Error('API quota exceeded. Please try again later.');
      } else if (error.message.includes('safety')) {
        throw new Error('Content filtered due to safety guidelines.');
      } else {
        throw new Error(`Gemini API error: ${error.message}`);
      }
    }
  }
}

module.exports = GeminiAdapter;
