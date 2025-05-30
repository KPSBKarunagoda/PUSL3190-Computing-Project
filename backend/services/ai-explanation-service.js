const { GoogleGenerativeAI } = require("@google/generative-ai");
const GeminiAdapter = require('./providers/gemini-adapter');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class AIExplanationService {
  constructor() {
    this.geminiAdapter = new GeminiAdapter();
    this.promptTemplate = this._loadPromptTemplate();
    this.emailPromptTemplate = this._loadEmailPromptTemplate();
    this.cacheDir = path.join(__dirname, '..', 'data', 'ai-cache');
    
    // Create an in-memory map of normalized URLs to cache files
    this.urlToFileMap = new Map();
    
    // Track in-progress requests to avoid duplicate processing
    this.inProgressRequests = new Map();
    
    // Global lock to prevent race conditions in file operations
    this.locks = new Map();
    
    // Cache configuration settings - making them explicit for easier tuning
    this.cacheConfig = {
      maxCacheFiles: 50,          // Changed from 100 to 50 maximum files
      maxCacheAge: 24 * 60 * 60 * 1000, // Maximum age of cache files (24 hours)
      filesToKeep: 50,            // Number of newest files to keep when cleaning
      maxCacheSizeMB: 50,         // Maximum cache directory size in MB
      cleanupThreshold: 0.8,      // Run cleanup when cache reaches 80% of max size
    };
    
    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      try {
        fs.mkdirSync(this.cacheDir, { recursive: true });
        console.log(`Created AI cache directory: ${this.cacheDir}`);
      } catch (error) {
        console.error(`Failed to create cache directory: ${error.message}`);
      }
    }
    
    // Initialize URL map from existing cache files
    this._initializeUrlMap();
    
    // Clean up any duplicates on startup
    this._cleanupDuplicateCacheFiles();
  }

  _loadPromptTemplate() {
    try {
      const promptPath = path.join(__dirname, '..', 'prompts', 'phishing-explanation.txt');
      if (fs.existsSync(promptPath)) {
        return fs.readFileSync(promptPath, 'utf8');
      } else {
        return `
You are an expert cybersecurity analyst specializing in phishing detection. Analyze the given URL and explain why it is considered safe or risky.

Provide your analysis in this format:

# Phishing Risk Analysis

## Overview
[Provide a brief summary of the risk assessment]

## Key Risk Factors
[List the main factors that contribute to the risk score]

## Technical Details
[Explain technical indicators found in the analysis]

## Recommendations
[Provide actionable recommendations for the user]

Important: 
- Be educational but not alarmist
- Focus on the specific features detected in the URL
- Use clear language that non-technical users can understand
- Format your response using Markdown for readability
- DO NOT invent details not present in the analysis
`;
      }
    } catch (error) {
      console.error('Error loading prompt template:', error);
      return null;
    }
  }
  
  _loadEmailPromptTemplate() {
    try {
      const promptPath = path.join(__dirname, '..', 'prompts', 'email-analysis.txt');
      if (fs.existsSync(promptPath)) {
        return fs.readFileSync(promptPath, 'utf8');
      } else {
        return `
You are an expert email security analyst helping to determine if an email is potentially phishing or legitimate.
I will provide you with the email headers analysis findings and I need your expert interpretation.

Please analyze the following email header analysis data and provide:

1. An overall assessment of whether this email is likely phishing, suspicious, or legitimate
2. A detailed explanation of the key security indicators found in the headers
3. What these findings mean from a security perspective
4. Recommendations for the recipient on how to proceed with this email

Keep your analysis concise but thorough, using professional security terminology where appropriate.
Focus on patterns or anomalies that are strong indicators of either legitimacy or phishing attempts.
`;
      }
    } catch (error) {
      console.error('Error loading email prompt template:', error);
      return null;
    }
  }
  
  _initializeUrlMap() {
    try {
      console.log("Initializing URL map from cache directory...");
      if (!fs.existsSync(this.cacheDir)) return;
      
      const files = fs.readdirSync(this.cacheDir);
      let loadedFiles = 0;
      let errorCount = 0;
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.cacheDir, file);
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const cacheData = JSON.parse(fileContent);
            
            if (cacheData.normalizedUrl) {
              this.urlToFileMap.set(cacheData.normalizedUrl, file);
              loadedFiles++;
            }
            
            if (cacheData.originalUrl) {
              const normalizedOriginal = this._normalizeUrl(cacheData.originalUrl);
              this.urlToFileMap.set(normalizedOriginal, file);
            }
            
          } catch (error) {
            errorCount++;
          }
        }
      }
      
      console.log(`URL map initialized with ${loadedFiles} cache files (${errorCount} errors)`);
    } catch (error) {
      console.error("Error initializing URL map:", error);
    }
  }
  
  _cleanupDuplicateCacheFiles() {
    try {
      console.log("Checking for duplicate cache files...");
      
      const urlsToFiles = new Map();
      const files = fs.readdirSync(this.cacheDir);
      
      // Track duplicate stats for logging
      let totalFiles = 0;
      let duplicateCount = 0;
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        totalFiles++;
        
        try {
          const filePath = path.join(this.cacheDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(content);
          
          const normalizedUrl = data.normalizedUrl || 
                              (data.originalUrl ? this._normalizeUrl(data.originalUrl) : null);
          
          if (!normalizedUrl) continue;
          
          if (!urlsToFiles.has(normalizedUrl)) {
            urlsToFiles.set(normalizedUrl, []);
          }
          
          urlsToFiles.get(normalizedUrl).push({
            file,
            path: filePath,
            timestamp: new Date(data.timestamp || 0).getTime()
          });
        } catch (error) {
          console.warn(`Error processing cache file ${file}:`, error.message);
        }
      }
      
      let removedCount = 0;
      for (const [url, fileEntries] of urlsToFiles.entries()) {
        if (fileEntries.length > 1) {
          fileEntries.sort((a, b) => b.timestamp - a.timestamp);
          
          const newestFile = fileEntries[0];
          console.log(`Found ${fileEntries.length - 1} duplicates for URL ${url}`);
          console.log(`Keeping newest file: ${newestFile.file} (${new Date(newestFile.timestamp).toISOString()})`);
          
          for (let i = 1; i < fileEntries.length; i++) {
            try {
              console.log(`Removing duplicate: ${fileEntries[i].file}`);
              fs.unlinkSync(fileEntries[i].path);
              removedCount++;
            } catch (error) {
              console.error(`Failed to delete duplicate file: ${fileEntries[i].file}`, error);
            }
          }
          
          this.urlToFileMap.set(url, newestFile.file);
        }
      }
      
      console.log(`Cache cleanup complete. Removed ${removedCount} duplicate files.`);
      console.log(`Cache statistics: ${totalFiles} total files, ${duplicateCount} duplicates found`);
      
      // After cleaning duplicates, check if we need a general cleanup
      this._checkCacheSize();
    } catch (error) {
      console.error("Error cleaning up duplicate cache files:", error);
    }
  }

  _checkCacheSize() {
    try {
      // Get cache directory stats
      let totalSize = 0;
      let fileCount = 0;
      const cacheFiles = [];
      
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        try {
          const filePath = path.join(this.cacheDir, file);
          const stats = fs.statSync(filePath);
          totalSize += stats.size;
          fileCount++;
          
          cacheFiles.push({
            path: filePath,
            filename: file,
            size: stats.size,
            mtime: stats.mtime.getTime()
          });
        } catch (error) {
          console.error(`Error getting stats for file ${file}:`, error.message);
        }
      }
      
      // Log cache stats
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      const maxSizeMB = this.cacheConfig.maxCacheSizeMB;
      console.log(`Cache stats: ${fileCount} files, ${totalSizeMB}MB / ${maxSizeMB}MB max`);
      
      // Check if we need to clean up based on file count
      if (fileCount > this.cacheConfig.maxCacheFiles) {
        console.log(`Cache file count (${fileCount}) exceeds limit (${this.cacheConfig.maxCacheFiles}), cleaning up...`);
        this._performCleanup(cacheFiles, 'count');
        return;
      }
      
      // Check if we need to clean up based on size
      if (totalSize > (this.cacheConfig.maxCacheSizeMB * 1024 * 1024 * this.cacheConfig.cleanupThreshold)) {
        console.log(`Cache size (${totalSizeMB}MB) approaching limit (${maxSizeMB}MB), cleaning up...`);
        this._performCleanup(cacheFiles, 'size');
      }
    } catch (error) {
      console.error('Cache size check error:', error);
    }
  }
  
  _performCleanup(cacheFiles, mode) {
    try {
      // Sort files by modification time (oldest first)
      cacheFiles.sort((a, b) => a.mtime - b.mtime);
      
      const filesToKeep = this.cacheConfig.filesToKeep;
      let filesToDelete;
      
      if (mode === 'count') {
        // Keep newest N files, delete the rest
        filesToDelete = cacheFiles.slice(0, Math.max(0, cacheFiles.length - filesToKeep));
      } else {
        // Delete oldest files until we're under the size threshold
        const targetSize = this.cacheConfig.maxCacheSizeMB * 1024 * 1024 * 0.7; // Target 70% of max
        
        let currentSize = cacheFiles.reduce((sum, file) => sum + file.size, 0);
        filesToDelete = [];
        
        // Keep removing oldest files until we're under target size
        // but always keep at least filesToKeep newest files
        for (let i = 0; i < cacheFiles.length - filesToKeep && currentSize > targetSize; i++) {
          filesToDelete.push(cacheFiles[i]);
          currentSize -= cacheFiles[i].size;
        }
      }
      
      console.log(`Deleting ${filesToDelete.length} cache files...`);
      
      // Delete the files
      for (const file of filesToDelete) {
        try {
          fs.unlinkSync(file.path);
          
          // Remove from in-memory map if present
          for (const [url, filename] of this.urlToFileMap.entries()) {
            if (filename === file.filename) {
              this.urlToFileMap.delete(url);
              break;
            }
          }
        } catch (error) {
          console.error(`Error deleting cache file ${file.filename}:`, error.message);
        }
      }
      
      console.log(`Cache cleanup complete. Deleted ${filesToDelete.length} files.`);
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }

  _cleanupOldCache() {
    this._checkCacheSize();
  }

  _normalizeUrl(url) {
    if (!url) return '';
    
    try {
      if (url.startsWith('normalized:')) {
        return url;
      }
      
      // Make URL lowercase and trim whitespace
      let normalizedUrl = url.trim().toLowerCase();
      
      // Unified protocol handling - standardize on https://
      normalizedUrl = normalizedUrl.replace(/^https?:\/\//, '');
      
      // Remove 'www.' if present
      normalizedUrl = normalizedUrl.replace(/^www\./, '');
      
      // Remove trailing slashes consistently
      normalizedUrl = normalizedUrl.replace(/\/+$/, '');
      
      // Remove query parameters and hash fragments
      normalizedUrl = normalizedUrl.split(/[?#]/)[0];
      
      // Add standard prefix for all normalized URLs
      return `normalized:${normalizedUrl}`;
    } catch (error) {
      console.error('URL normalization failed:', error);
      // Create a fallback hash for consistency
      return `normalized:hash:${crypto.createHash('md5').update(url).digest('hex').substring(0, 8)}`;
    }
  }
  
  // Add missing cache key generation function
  _generateCacheKey(normalizedUrl) {
    // Generate a simple hash of the normalized URL for the cache filename
    const hash = crypto.createHash('md5').update(normalizedUrl).digest('hex');
    return hash.substring(0, 16); // Use first 16 chars of hash for filename
  }
  
  // Add missing lock function
  async _acquireLock(lockKey) {
    if (!this.locks.has(lockKey)) {
      this.locks.set(lockKey, false);
    }
    
    // Simple wait-and-retry mechanism (up to 20 attempts)
    const maxAttempts = 20;
    let attempts = 0;
    
    while (this.locks.get(lockKey) === true) {
      // Wait 100ms before retrying
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
      
      if (attempts >= maxAttempts) {
        console.warn(`Lock acquisition timeout for ${lockKey}`);
        break;
      }
    }
    
    // Acquire lock
    this.locks.set(lockKey, true);
    console.log(`Lock acquired for ${lockKey}`);
    
    // Return a release function
    return () => {
      this.locks.set(lockKey, false);
      console.log(`Lock released for ${lockKey}`);
    };
  }
  
  async generateExplanation(url, analysisResult, features) {
    if (!this.promptTemplate) {
      throw new Error('Prompt template not loaded');
    }

    try {
      console.log(`====== AI Explanation Request ======`);
      console.log(`URL: ${url}`);
      
      // Normalize URL and log the result for debugging duplicate requests
      const normalizedUrl = this._normalizeUrl(url);
      console.log(`Normalized URL: "${url}" → "${normalizedUrl}"`);
      
      // Check if there's already a request in progress for this URL
      if (this.inProgressRequests.has(normalizedUrl)) {
        console.log(`Request for ${normalizedUrl} already in progress, waiting for result...`);
        return await this.inProgressRequests.get(normalizedUrl);
      }
      
      // Check cache first - using original method without _generateCacheKey
      const cachedContent = this._getCachedContent(normalizedUrl);
      if (cachedContent) {
        console.log(`Using cached explanation for ${url} (cache hit)`);
        return cachedContent;
      }
      
      console.log(`No cache found for ${normalizedUrl}, generating new explanation...`);
      
      // Create promise for this request
      const requestPromise = (async () => {
        try {
          // Generate new explanation since no cache exists
          console.log(`Generating new AI explanation for ${normalizedUrl}...`);
          
          const context = {
            url: url,
            result: analysisResult,
            features: features,
            timestamp: new Date().toISOString()
          };

          const explanation = await this.geminiAdapter.generateCompletion(
            this.promptTemplate, 
            context,
            {
              temperature: 0.3,
              topP: 0.9,
              maxTokens: 1500
            }
          );

          const formattedExplanation = this._formatExplanation(explanation);
          
          // Save to cache using original method
          await this._saveToCache(url, normalizedUrl, formattedExplanation);
          
          return formattedExplanation;
        } finally {
          // Clean up when complete
          this.inProgressRequests.delete(normalizedUrl);
          console.log(`Request for ${normalizedUrl} completed`);
        }
      })();
      
      // Store the promise before awaiting it
      this.inProgressRequests.set(normalizedUrl, requestPromise);
      
      // Await and return the result
      return await requestPromise;
    } catch (error) {
      console.error('Error generating AI explanation:', error);
      throw new Error(`Failed to generate AI explanation: ${error.message}`);
    }
  }

  async generateEmailAnalysis(emailHeaders, analysisResult) {
    if (!this.emailPromptTemplate) {
      throw new Error('Email prompt template not loaded');
    }

    try {
      console.log(`====== AI Email Analysis Request ======`);
      
      // Create a unique identifier based on the email headers
      const headerHash = crypto.createHash('md5').update(emailHeaders).digest('hex');
      const cacheKey = `email-${headerHash.substring(0, 16)}`;
      
      console.log(`Email analysis request: ${cacheKey}`);
      
      // Check if there's already a request in progress for this email
      if (this.inProgressRequests.has(cacheKey)) {
        console.log(`Request for ${cacheKey} already in progress, waiting for result...`);
        return await this.inProgressRequests.get(cacheKey);
      }
      
      // Check cache first
      const cachedContent = this._getEmailCachedContent(cacheKey);
      if (cachedContent) {
        console.log(`Using cached email analysis (cache hit)`);
        return cachedContent;
      }
      
      console.log(`No cache found for ${cacheKey}, generating new analysis...`);
      
      // Create promise for this request
      const requestPromise = (async () => {
        try {
          // Generate new explanation since no cache exists
          console.log(`Generating new AI email analysis...`);
          
          const context = {
            subject: analysisResult.email_subject || 'Unknown',
            risk_score: analysisResult.riskScore,
            findings: analysisResult.findings,
            raw_headers: emailHeaders, // Pass the raw headers to the AI
            authentication: {
              spf: analysisResult.authResults?.spf || 'unknown',
              dkim: analysisResult.authResults?.dkim || 'unknown',
              dmarc: analysisResult.authResults?.dmarc || 'unknown'
            }
          };

          const analysis = await this.geminiAdapter.generateCompletion(
            this.emailPromptTemplate, 
            context,
            {
              temperature: 0.2,
              topP: 0.9,
              maxTokens: 1024
            }
          );

          // Don't apply additional formatting to the email analysis
          // as we're already asking the AI to return HTML formatted content
          // Avoid using the _formatExplanation method here
          
          // Save raw analysis to cache
          await this._saveEmailToCache(cacheKey, analysis);
          
          return analysis;
        } finally {
          // Clean up when complete
          this.inProgressRequests.delete(cacheKey);
          console.log(`Request for ${cacheKey} completed`);
        }
      })();
      
      // Store the promise before awaiting it
      this.inProgressRequests.set(cacheKey, requestPromise);
      
      // Await and return the result
      return await requestPromise;
    } catch (error) {
      console.error('Error generating AI email analysis:', error);
      throw new Error(`Failed to generate AI email analysis: ${error.message}`);
    }
  }
  
  _getCachedContent(normalizedUrl) {
    try {
      // Generate a simple hash of the normalized URL for the cache filename
      const hash = crypto.createHash('md5').update(normalizedUrl).digest('hex');
      const cacheKey = hash.substring(0, 16); // Use first 16 chars of hash for filename
      const cacheFilePath = path.join(this.cacheDir, `${cacheKey}.json`);
      
      if (!fs.existsSync(cacheFilePath)) {
        console.log(`No cache file found at ${cacheFilePath}`);
        return null;
      }
      
      const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
      
      const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
      const MAX_CACHE_AGE = this.cacheConfig.maxCacheAge;
      
      if (cacheAge > MAX_CACHE_AGE) {
        console.log(`Cache expired for ${normalizedUrl} (${Math.round(cacheAge / 60000)} minutes old)`);
        return null;
      }
      
      console.log(`Cache hit for ${normalizedUrl} (${Math.round(cacheAge / 60000)} minutes old)`);
      
      this.urlToFileMap.set(normalizedUrl, `${cacheKey}.json`);
      
      return cacheData.content;
    } catch (error) {
      console.error(`Error reading cache: ${error.message}`);
      return null;
    }
  }
  
  _getEmailCachedContent(cacheKey) {
    try {
      const cacheFilePath = path.join(this.cacheDir, `${cacheKey}.json`);
      
      if (!fs.existsSync(cacheFilePath)) {
        console.log(`No cache file found at ${cacheFilePath}`);
        return null;
      }
      
      const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
      
      const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
      const MAX_CACHE_AGE = this.cacheConfig.maxCacheAge;
      
      if (cacheAge > MAX_CACHE_AGE) {
        console.log(`Cache expired for ${cacheKey} (${Math.round(cacheAge / 60000)} minutes old)`);
        return null;
      }
      
      console.log(`Cache hit for ${cacheKey} (${Math.round(cacheAge / 60000)} minutes old)`);
      
      return cacheData.content;
    } catch (error) {
      console.error(`Error reading email cache: ${error.message}`);
      return null;
    }
  }
  
  async _saveToCache(originalUrl, normalizedUrl, content) {
    try {
      // Generate a simple hash of the normalized URL for the cache filename
      const hash = crypto.createHash('md5').update(normalizedUrl).digest('hex');
      const cacheKey = hash.substring(0, 16); // Use first 16 chars of hash for filename
      const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
      
      console.log(`Creating/updating cache file ${cacheKey}.json for ${normalizedUrl}`);
      
      const cacheData = {
        timestamp: new Date().toISOString(),
        content: content,
        originalUrl: originalUrl,
        normalizedUrl: normalizedUrl,
        cacheKey: cacheKey
      };
      
      fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
      
      this.urlToFileMap.set(normalizedUrl, `${cacheKey}.json`);
      
      console.log(`Cache saved successfully for ${normalizedUrl}`);
      
      this._cleanupOldCache();
      
      return true;
    } catch (error) {
      console.error(`Failed to cache explanation: ${error.message}`);
      return false;
    }
  }
  
  async _saveEmailToCache(cacheKey, content) {
    try {
      const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
      
      console.log(`Creating/updating cache file ${cacheKey}.json`);
      
      const cacheData = {
        timestamp: new Date().toISOString(),
        content: content,
        cacheKey: cacheKey
      };
      
      fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
      
      console.log(`Email analysis cache saved successfully for ${cacheKey}`);
      
      this._cleanupOldCache();
      
      return true;
    } catch (error) {
      console.error(`Failed to cache email analysis: ${error.message}`);
      return false;
    }
  }

  _formatExplanation(explanation) {
    // Enhanced formatting for better readability
    let formatted = explanation
      // Handle headings
      .replace(/^# (.*$)/gm, '<h2>$1</h2>')
      .replace(/^## (.*$)/gm, '<h3>$1</h3>')
      .replace(/^### (.*$)/gm, '<h4>$1</h4>')
      
      // Handle text formatting
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      
      // Handle special highlights for risk levels
      .replace(/high risk/gi, '<span class="risk-high">High Risk</span>')
      .replace(/medium risk/gi, '<span class="risk-medium">Medium Risk</span>')
      .replace(/low risk/gi, '<span class="risk-low">Low Risk</span>')
      
      // Handle lists - unordered
      .replace(/^\- (.*)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)\n(?!<li>)/g, '$1</ul>\n')
      .replace(/(?<!<\/ul>\n)(<li>)/g, '<ul>$1')
      
      // Handle lists - ordered
      .replace(/^\d+\. (.*)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)\n(?!<li>)/g, '$1</ol>\n')
      .replace(/(?<!<\/ol>\n)(<li>)/g, '<ol>$1')
      
      // Handle paragraphs
      .replace(/^\s*$/gm, '</p><p>')
      .replace(/<\/p><p>/g, '</p>\n<p>');
    
    // Ensure content starts with a paragraph if not a heading
    if (!formatted.startsWith('<h2>') && !formatted.startsWith('<h3>') && !formatted.startsWith('<p>')) {
      formatted = `<p>${formatted}</p>`;
    }
    
    // Create enhanced highlight boxes
    formatted = formatted.replace(
      /NOTE:([^<]+)/gi, 
      '<div class="highlight"><strong>Note:</strong>$1</div>'
    );
    formatted = formatted.replace(
      /IMPORTANT:([^<]+)/gi, 
      '<div class="highlight"><strong>Important:</strong>$1</div>'
    );
    formatted = formatted.replace(
      /WARNING:([^<]+)/gi, 
      '<div class="highlight warning"><strong>Warning:</strong>$1</div>'
    );
    
    // Handle blockquotes
    formatted = formatted.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');
    
    return formatted;
  }
}

module.exports = AIExplanationService;
