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
      console.log('Using cached result');
      return cachedResult;
    }
    
    try {
      console.log('GeminiAdapter: Generating completion...');
      
      // Limit prompt size to avoid timeouts
      const maxPromptLength = 3000; // Characters
      let limitedPrompt = prompt;
      
      if (prompt.length > maxPromptLength) {
        console.log(`Prompt exceeds max length (${prompt.length}). Truncating to ${maxPromptLength} chars`);
        limitedPrompt = prompt.substring(0, maxPromptLength) + 
          "\n\n[Note: Input was truncated due to length.]";
      }
      
      // Handle rate limiting
      await this._handleRateLimit();
      
      // Increment request counter
      this.rateLimiter.requestsThisMinute++;
      this.rateLimiter.lastRequestTime = Date.now();
      
      // Get the model
      const model = this.genAI.getGenerativeModel({ 
        model: this.model
      });
      
      // Configure generation parameters with adjusted token limits
      const generationConfig = {
        temperature: options.temperature || 0.3,
        maxOutputTokens: 800, // Reduced from default to ensure faster response
        topK: 40,
        topP: 0.95,
      };
      
      // For simplicity, combine context and prompt with limited length
      const fullPrompt = context 
        ? `${context}\n\n${limitedPrompt}`
        : limitedPrompt;
      
      console.log(`Generating content with ${fullPrompt.length} character prompt...`);
      
      const result = await model.generateContent(fullPrompt, generationConfig);
      
      console.log('Received response from Gemini API');
      
      const response = result.response;
      const responseText = response.text();
      
      // Cache the result
      this._saveToCache(cacheKey, responseText);
      
      return responseText;
    } catch (error) {
      console.error('Gemini API error:', error.message);
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }
}

module.exports = GeminiAdapter;
