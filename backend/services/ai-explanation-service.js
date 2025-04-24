const { GoogleGenerativeAI } = require("@google/generative-ai");
const GeminiAdapter = require('./providers/gemini-adapter');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class AIExplanationService {
  constructor() {
    this.geminiAdapter = new GeminiAdapter();
    this.promptTemplate = this._loadPromptTemplate();
    this.cacheDir = path.join(__dirname, '..', 'data', 'ai-cache');
    
    // Create an in-memory map of normalized URLs to cache files
    // This helps prevent duplicate cache files by keeping track of all URL variations
    this.urlToFileMap = new Map();
    
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
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
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
    } catch (error) {
      console.error("Error cleaning up duplicate cache files:", error);
    }
  }
  
  _normalizeUrl(url) {
    if (!url) return '';
    
    try {
      if (url.startsWith('normalized:')) {
        return url;
      }
      
      let normalizedUrl = url.trim().toLowerCase();
      
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl;
      }
      
      try {
        const urlObj = new URL(normalizedUrl);
        
        let hostname = urlObj.hostname.replace(/^www\./, '');
        
        let pathname = urlObj.pathname;
        if (pathname === '/') pathname = '';
        else if (pathname.endsWith('/')) pathname = pathname.slice(0, -1);
        
        const canonical = `normalized:${hostname}${pathname}`;
        return canonical;
      } catch (e) {
        console.warn(`URL object creation failed: ${e.message}. Using direct string normalization.`);
        
        normalizedUrl = normalizedUrl.replace(/^https?:\/\//, '');
        normalizedUrl = normalizedUrl.replace(/^www\./, '');
        normalizedUrl = normalizedUrl.replace(/\/+$/, '');
        
        return `normalized:${normalizedUrl}`;
      }
    } catch (error) {
      console.warn(`URL normalization failed: ${error.message}`);
      
      const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
      return `normalized:fallback:${hash}`;
    }
  }

  async generateExplanation(url, analysisResult, features) { // Remove bypassCache parameter
    if (!this.promptTemplate) {
      throw new Error('Prompt template not loaded');
    }

    try {
      console.log(`====== AI Explanation Request ======`);
      console.log(`URL: ${url}`);
      
      // Normalize URL for consistent caching
      const normalizedUrl = this._normalizeUrl(url);
      console.log(`Normalized URL: ${normalizedUrl}`);
      
      // Check for cached content
      const cachedContent = this._getCachedContent(normalizedUrl);
      if (cachedContent) {
        console.log(`Using cached explanation for ${url}`);
        return cachedContent;
      }
      
      // Generate a new explanation
      console.log('Generating new AI explanation...');
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
      
      this._saveToCache(url, normalizedUrl, formattedExplanation);
      
      return formattedExplanation;
    } catch (error) {
      console.error('Error generating AI explanation:', error);
      throw new Error(`Failed to generate AI explanation: ${error.message}`);
    }
  }
  
  _getCachedContent(normalizedUrl) {
    try {
      if (!this.urlToFileMap.has(normalizedUrl)) {
        console.log(`No cache entry for ${normalizedUrl}`);
        return null;
      }
      
      const cacheFileName = this.urlToFileMap.get(normalizedUrl);
      const cacheFilePath = path.join(this.cacheDir, cacheFileName);
      
      if (!fs.existsSync(cacheFilePath)) {
        console.log(`Cache file doesn't exist: ${cacheFileName}`);
        this.urlToFileMap.delete(normalizedUrl);
        return null;
      }
      
      const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
      
      const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
      const MAX_CACHE_AGE = 60 * 60 * 1000;
      
      if (cacheAge > MAX_CACHE_AGE) {
        console.log(`Cache expired for ${normalizedUrl} (${Math.round(cacheAge / 60000)} minutes old)`);
        return null;
      }
      
      console.log(`Cache hit for ${normalizedUrl} (${Math.round(cacheAge / 60000)} minutes old)`);
      return cacheData.content;
    } catch (error) {
      console.error(`Error reading cache: ${error.message}`);
      return null;
    }
  }
  
  _saveToCache(originalUrl, normalizedUrl, content) {
    try {
      if (this.urlToFileMap.has(normalizedUrl)) {
        const existingFile = this.urlToFileMap.get(normalizedUrl);
        const existingPath = path.join(this.cacheDir, existingFile);
        
        if (fs.existsSync(existingPath)) {
          try {
            console.log(`Updating existing cache file ${existingFile} for ${normalizedUrl}`);
            
            const existingData = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
            existingData.content = content;
            existingData.timestamp = new Date().toISOString();
            
            fs.writeFileSync(existingPath, JSON.stringify(existingData, null, 2));
            return;
          } catch (updateError) {
            console.error(`Error updating existing cache: ${updateError.message}`);
          }
        }
      }
      
      const cacheKey = crypto.createHash('md5').update(normalizedUrl).digest('hex');
      const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
      
      console.log(`Creating new cache file ${cacheKey}.json for ${normalizedUrl}`);
      
      const cacheData = {
        timestamp: new Date().toISOString(),
        content: content,
        originalUrl: originalUrl,
        normalizedUrl: normalizedUrl
      };
      
      fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
      
      this.urlToFileMap.set(normalizedUrl, `${cacheKey}.json`);
      
      this._cleanupOldCache();
    } catch (error) {
      console.error(`Failed to cache explanation: ${error.message}`);
    }
  }

  _formatExplanation(explanation) {
    let formatted = explanation
      .replace(/^# (.*$)/gm, '<h2>$1</h2>')
      .replace(/^## (.*$)/gm, '<h3>$1</h3>')
      .replace(/^### (.*$)/gm, '<h4>$1</h4>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^\- (.*)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)\n(?!<li>)/g, '$1</ul>\n')
      .replace(/(?<!<\/ul>\n)(<li>)/g, '<ul>$1')
      .replace(/^\s*$/gm, '</p><p>')
      .replace(/<\/p><p>/g, '</p>\n<p>');
    
    if (!formatted.startsWith('<h2>') && !formatted.startsWith('<p>')) {
      formatted = `<p>${formatted}</p>`;
    }
    
    formatted = formatted.replace(
      /(?:IMPORTANT|NOTE|WARNING):([^<]+)/gi, 
      '<div class="highlight"><strong>$&</strong></div>'
    );
    
    return formatted;
  }
  
  _cleanupOldCache() {
    try {
      const files = fs.readdirSync(this.cacheDir);
      
      if (files.length <= 10) return;
      console.log(`Cache directory has ${files.length} files, cleaning up old files`);
      const cacheFiles = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.cacheDir, file);
            const stats = fs.statSync(filePath);
            cacheFiles.push({
              path: filePath,
              filename: file,
              mtime: stats.mtime.getTime(),
            });
          } catch (error) {
            console.error(`Error getting stats for ${file}: ${error.message}`);
          }
        }
      }
      
      cacheFiles.sort((a, b) => a.mtime - b.mtime);
      
      const filesToDelete = cacheFiles.slice(0, cacheFiles.length - 5);
      console.log(`Deleting ${filesToDelete.length} old cache files`);
      
      for (const file of filesToDelete) {
        try {
          fs.unlinkSync(file.path);
        } catch (error) {
          console.error(`Error deleting ${file.filename}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`Cache cleanup error: ${error.message}`);
    }
  }
}

module.exports = AIExplanationService;
