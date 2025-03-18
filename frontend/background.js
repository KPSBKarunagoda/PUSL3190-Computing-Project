// Enhanced caching system for background.js
const analyzedURLs = {}; // In-memory cache
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes cache lifetime

// Track tab history to avoid reanalyzing the same URL
const tabURLHistory = {};

// Listen for tab updates (when user navigates to a new page)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only analyze when the page has completely loaded
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    console.log('Tab updated, analyzing URL:', tab.url);
    
    // Store the current URL for this tab
    tabURLHistory[tabId] = tab.url;
    
    // Skip analysis if this URL was recently analyzed
    const cacheKey = tab.url;
    if (analyzedURLs[cacheKey] && 
        (Date.now() - analyzedURLs[cacheKey].timestamp < CACHE_EXPIRY)) {
      console.log('Using cached analysis for:', tab.url);
      return;
    }
    
    // Analyze the URL and cache the result
    analyzeAndCacheURL(tab.url);
  }
});

// Track tab activation (when user switches tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    
    // Skip if not a valid URL
    if (!tab.url || !tab.url.startsWith('http')) return;
    
    // Check if this tab's URL has changed since we last saw it
    const lastKnownURL = tabURLHistory[tab.tabId];
    if (lastKnownURL === tab.url) {
      console.log('Tab activated with known URL:', tab.url);
      // No need to reanalyze - URL hasn't changed
      return;
    }
    
    // URL has changed or we haven't seen this tab before
    tabURLHistory[tab.tabId] = tab.url;
    
    // Check if this URL is in our cache
    const cacheKey = tab.url;
    if (analyzedURLs[cacheKey] && 
        (Date.now() - analyzedURLs[cacheKey].timestamp < CACHE_EXPIRY)) {
      console.log('Using cached analysis for activated tab:', tab.url);
      return;
    }
    
    // New URL that's not in our cache - analyze it
    console.log('Analyzing URL in activated tab:', tab.url);
    analyzeAndCacheURL(tab.url);
    
  } catch (error) {
    console.error('Error handling tab activation:', error);
  }
});

// Cleanup when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  // Clean up our tab history
  if (tabURLHistory[tabId]) {
    delete tabURLHistory[tabId];
  }
});

// Function to analyze and cache results
async function analyzeAndCacheURL(url) {
  try {
    // Get user preferences
    const preferences = await chrome.storage.sync.get(['safeSearchEnabled']);
    const useSafeBrowsing = preferences.safeSearchEnabled !== false;
    
    // Analyze the URL
    const result = await analyzeURL(url, useSafeBrowsing);
    
    // Cache the result
    const cacheKey = url;
    analyzedURLs[cacheKey] = {
      result: result,
      timestamp: Date.now()
    };
    
    // Also save to chrome.storage for persistence across browser sessions
    // Group results by domain to avoid storage limits
    const domain = new URL(url).hostname;
    const storageKey = `analysis_${domain}`;
    
    chrome.storage.local.get([storageKey], function(data) {
      const domainCache = data[storageKey] || {};
      domainCache[url] = {
        result: result,
        timestamp: Date.now()
      };
      
      // Store back to Chrome storage
      chrome.storage.local.set({ [storageKey]: domainCache });
    });
    
    console.log('Analysis complete and cached:', result);
    return result;
  } catch (error) {
    console.error('Analysis error:', error);
    throw error;
  }
}

// Function to analyze URLs
async function analyzeURL(url, useSafeBrowsing) {
  // Implementation of your analysis function
  try {
    const response = await fetch('http://localhost:3000/analyze-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: url,
        useSafeBrowsing: useSafeBrowsing
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// Clean up expired cache entries periodically
function cleanupCache() {
  console.log('Cleaning up analysis cache...');
  const now = Date.now();
  
  // Clean in-memory cache
  Object.keys(analyzedURLs).forEach(url => {
    if (now - analyzedURLs[url].timestamp > CACHE_EXPIRY) {
      delete analyzedURLs[url];
    }
  });
  
  // Clean storage cache
  chrome.storage.local.get(null, function(items) {
    const analysisKeys = Object.keys(items).filter(key => key.startsWith('analysis_'));
    
    analysisKeys.forEach(key => {
      const domainCache = items[key];
      let modified = false;
      
      Object.keys(domainCache).forEach(url => {
        if (now - domainCache[url].timestamp > CACHE_EXPIRY) {
          delete domainCache[url];
          modified = true;
        }
      });
      
      if (modified) {
        if (Object.keys(domainCache).length > 0) {
          // Update with cleaned cache
          chrome.storage.local.set({ [key]: domainCache });
        } else {
          // Remove empty cache entries
          chrome.storage.local.remove(key);
        }
      }
    });
  });
}

// Run cleanup every hour
setInterval(cleanupCache, 60 * 60 * 1000);

// Also clean on startup
cleanupCache();