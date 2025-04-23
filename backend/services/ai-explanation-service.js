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
    
    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      try {
        fs.mkdirSync(this.cacheDir, { recursive: true });
        console.log(`Created AI cache directory: ${this.cacheDir}`);
      } catch (error) {
        console.error(`Failed to create cache directory: ${error.message}`);
      }
    }
  }

  _loadPromptTemplate() {
    try {
      // Try to load custom prompt template if it exists
      const promptPath = path.join(__dirname, '..', 'prompts', 'phishing-explanation.txt');
      if (fs.existsSync(promptPath)) {
        return fs.readFileSync(promptPath, 'utf8');
      } else {
        // Default prompt template
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

  async generateExplanation(url, analysisResult, features) {
    if (!this.promptTemplate) {
      throw new Error('Prompt template not loaded');
    }

    try {
      // Normalize URL for consistent caching
      const normalizedUrl = this._normalizeUrl(url);
      
      // Generate a consistent hash for the cache file
      const cacheKey = crypto.createHash('md5').update(normalizedUrl).digest('hex');
      const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
      
      console.log(`Checking cache for URL: ${normalizedUrl}`);
      console.log(`Cache key: ${cacheKey}`);
      
      // Check if we have a cache hit
      if (fs.existsSync(cacheFile)) {
        try {
          const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
          const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
          const MAX_CACHE_AGE = 60 * 60 * 1000; // 1 hour in ms 
          
          console.log(`Found cache file (${Math.round(cacheAge / (1000 * 60))} minutes old)`);
          
          if (cacheAge < MAX_CACHE_AGE) {
            console.log('Using cached explanation');
            return cacheData.content;
          } else {
            console.log('Cache expired, generating new explanation');
            // We'll let the old cache be overwritten
          }
        } catch (error) {
          console.error(`Error reading cache: ${error.message}`);
          // Continue to generate a new explanation
        }
      } else {
        console.log('No cache found, generating new explanation');
      }

      // Generate a new explanation
      const context = {
        url: normalizedUrl,
        result: analysisResult,
        features,
        timestamp: new Date().toISOString()
      };

      const explanation = await this.geminiAdapter.generateCompletion(
        this.promptTemplate, 
        context,
        {
          temperature: 0.3, // Lower temperature for more factual responses
          topP: 0.9,
          maxTokens: 1500
        }
      );

      const formattedExplanation = this._formatExplanation(explanation);
      
      // Cache the result
      try {
        const cacheData = {
          timestamp: new Date().toISOString(),
          content: formattedExplanation
        };
        
        fs.writeFileSync(cacheFile, JSON.stringify(cacheData));
        console.log(`Cached explanation to ${cacheFile}`);
        
        // Clean up old cache files if we have too many
        this._cleanupOldCache();
      } catch (error) {
        console.error(`Failed to cache explanation: ${error.message}`);
      }

      return formattedExplanation;
    } catch (error) {
      console.error('Error generating AI explanation:', error);
      throw new Error(`Failed to generate AI explanation: ${error.message}`);
    }
  }

  _formatExplanation(explanation) {
    // Convert markdown to basic HTML
    let formatted = explanation
      // Headers
      .replace(/^# (.*$)/gm, '<h2>$1</h2>')
      .replace(/^## (.*$)/gm, '<h3>$1</h3>')
      .replace(/^### (.*$)/gm, '<h4>$1</h4>')
      
      // Bold and italic
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      
      // Lists
      .replace(/^\- (.*)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)\n(?!<li>)/g, '$1</ul>\n')
      .replace(/(?<!<\/ul>\n)(<li>)/g, '<ul>$1')
      
      // Paragraphs
      .replace(/^\s*$/gm, '</p><p>')
      .replace(/<\/p><p>/g, '</p>\n<p>');
    
    // Wrap in paragraphs if not already
    if (!formatted.startsWith('<h2>') && !formatted.startsWith('<p>')) {
      formatted = `<p>${formatted}</p>`;
    }
    
    // Highlight important parts
    formatted = formatted.replace(
      /(?:IMPORTANT|NOTE|WARNING):([^<]+)/gi, 
      '<div class="highlight"><strong>$&</strong></div>'
    );
    
    return formatted;
  }
  
  _normalizeUrl(url) {
    try {
      // Create a standardized version of the URL for caching
      let normalizedUrl = url.trim().toLowerCase();
      
      // Add protocol if missing
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl;
      }
      
      // Use URL parsing to handle normalization
      const urlObj = new URL(normalizedUrl);
      
      // Remove www. prefix if present
      let hostname = urlObj.hostname;
      if (hostname.startsWith('www.')) {
        hostname = hostname.slice(4);
      }
      
      // Remove trailing slashes from pathname
      let pathname = urlObj.pathname;
      while (pathname.endsWith('/') && pathname.length > 1) {
        pathname = pathname.slice(0, -1);
      }
      
      // For caching purposes, we'll ignore query parameters, hash, etc.
      // Just use the domain + path as the cache key
      return hostname + pathname;
    } catch (error) {
      console.warn(`URL normalization failed: ${error.message}`);
      return url; // Return original if normalization fails
    }
  }
  
  _cleanupOldCache() {
    try {
      const files = fs.readdirSync(this.cacheDir);
      
      // Only process if we have more than 10 cache files (changed from 100)
      if (files.length <= 10) return;
      
      console.log(`Cache directory has ${files.length} files, cleaning up old files`);
      
      const cacheFiles = [];
      
      // Get stats for all cache files
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.cacheDir, file);
            const stats = fs.statSync(filePath);
            cacheFiles.push({
              path: filePath,
              filename: file,
              mtime: stats.mtime.getTime()
            });
          } catch (error) {
            console.error(`Error getting stats for ${file}: ${error.message}`);
          }
        }
      }
      
      // Sort by modification time (oldest first)
      cacheFiles.sort((a, b) => a.mtime - b.mtime);
      
      // Delete the oldest files, keeping only the 5 newest (changed from 50)
      const filesToDelete = cacheFiles.slice(0, cacheFiles.length - 5);
      
      console.log(`Deleting ${filesToDelete.length} old cache files`);
      
      // Delete files
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
