// Enhanced caching system for background.js
const analyzedURLs = {}; // In-memory cache
const CACHE_EXPIRY = 15 * 60 * 1000; // 15 minutes cache lifetime

// Track tab history to avoid reanalyzing the same URL
const tabURLHistory = {};

// Add centralized auth state management
let authState = {
  isLoggedIn: false,
  token: null,
  userData: null,
  lastVerified: 0
};

// Initialize auth state from storage
chrome.runtime.onStartup.addListener(() => {
  loadAuthState();
});

// Load auth state when extension is installed/updated
chrome.runtime.onInstalled.addListener(() => {
  loadAuthState();
});

// Load auth state from storage
async function loadAuthState() {
  try {
    const data = await chrome.storage.local.get(['isLoggedIn', 'authToken', 'userData', 'authTimestamp']);
    
    // Check if token exists and is not expired
    if (data.isLoggedIn && data.authToken) {
      // Store the token regardless of validation for now (will validate before use)
      authState = {
        isLoggedIn: true,
        token: data.authToken,
        userData: data.userData,
        lastVerified: data.authTimestamp || Date.now()
      };
      console.log('Auth state loaded - user appears to be logged in', data.userData?.username);
      
      // Validate in the background but don't wait for it
      validateToken(data.authToken).catch(err => {
        console.warn('Token validation failed on load:', err);
      });
    } else {
      console.log('No valid auth data found');
      authState = {
        isLoggedIn: false,
        token: null,
        userData: null,
        lastVerified: 0
      };
    }
  } catch (error) {
    console.error('Error loading auth state:', error);
    authState = {
      isLoggedIn: false,
      token: null,
      userData: null,
      lastVerified: 0
    };
  }
}

// Validate token with server with proper error handling
async function validateToken(token) {
  if (!token) return false;
  
  try {
    // Only validate if we haven't done so recently (within 5 minutes)
    if (authState.lastVerified && Date.now() - authState.lastVerified < 5 * 60 * 1000) {
      return true;
    }
    
    console.log('Validating token...');
    const response = await fetch('http://localhost:3000/api/auth/verify', {
      method: 'GET',
      headers: {
        'x-auth-token': token
      }
    });
    
    // Check status code specifically for expired token
    if (response.status === 401) {
      const data = await response.json();
      if (data.code === 'TOKEN_EXPIRED') {
        console.log('Token has expired, logging out user');
        await logoutUser();
        return false;
      }
    }
    
    if (response.ok) {
      console.log('Token validation successful');
      authState.lastVerified = Date.now();
      // Update timestamp in storage too
      chrome.storage.local.set({ authTimestamp: Date.now() });
      return true;
    }
    
    console.warn('Token validation failed: server returned', response.status);
    return false;
  } catch (error) {
    console.error('Token validation error (network):', error);
    // Return true on network errors to prevent false negatives
    return true; // Don't log out on network errors
  }
}

// Centralized logout function
async function logoutUser() {
  console.log('Logging out user and clearing data');
  
  // Clear auth state
  authState = {
    isLoggedIn: false,
    token: null,
    userData: null,
    lastVerified: 0
  };
  
  // Clear storage data - note we're using the clear method for voteCounts
  await chrome.storage.local.remove([
    'isLoggedIn', 
    'authToken', 
    'userData', 
    'authTimestamp'
  ]);
  
  // Clear vote counts separately to ensure it completes
  await chrome.storage.local.set({ voteCounts: {} });
  
  // Check if popup is open before sending messages
  try {
    const views = chrome.extension.getViews({ type: "popup" });
    if (views && views.length > 0) {
      // Popup is open, safe to send message
      try {
        await chrome.runtime.sendMessage({ action: 'authStateChanged', isLoggedIn: false });
      } catch (e) {
        // Swallow errors, don't log them
      }
    }
  } catch (error) {
    // Ignore any errors in getting views
  }
}

// Send message safely without logging disconnection errors
function safelySendMessage(message) {
  try {
    const views = chrome.extension.getViews({ type: "popup" });
    if (views && views.length > 0) {
      chrome.runtime.sendMessage(message).catch(() => {});
    }
  } catch (error) {
    // Silently catch errors
  }
}

// Check token expiry every 5 minutes (instead of every minute)
// This reduces the frequency of token validations
setInterval(() => {
  if (authState.isLoggedIn && authState.token) {
    validateToken(authState.token).then(isValid => {
      if (!isValid) {
        logoutUser();
      }
    });
  }
}, 5 * 60 * 1000); // 5 minutes

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
    
    // Add timestamp to the result for time tracking
    const resultWithTimestamp = {
      ...result,
      timestamp: Date.now()
    };
    
    // Cache the result in memory
    const cacheKey = url;
    analyzedURLs[cacheKey] = {
      result: resultWithTimestamp,
      timestamp: Date.now()
    };
    
    // Also save to chrome.storage for persistence across browser sessions
    // Store in shared cache that popup can access
    chrome.storage.local.get(['analysisCache'], (data) => {
      const cache = data.analysisCache || {};
      cache[url] = resultWithTimestamp;
      
      // Limit cache size (keep only most recent 20 entries)
      const urls = Object.keys(cache);
      if (urls.length > 20) {
        // Sort by timestamp (oldest first)
        urls.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
        
        // Remove oldest entries to keep size under limit
        for (let i = 0; i < urls.length - 20; i++) {
          delete cache[urls[i]];
        }
      }
      
      chrome.storage.local.set({ analysisCache: cache });
    });
    
    // Group results by domain to avoid storage limits - as before
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
    return resultWithTimestamp;
  } catch (error) {
    console.error('Analysis error:', error);
    throw error;
  }
}

// Function to analyze URLs
async function analyzeURL(url, useSafeBrowsing) {
  // Implementation of your analysis function
  try {
    // Always use Safe Browsing, ignoring the parameter
    const response = await fetch('http://localhost:3000/analyze-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: url,
        useSafeBrowsing: true // Always use Safe Browsing
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

// Add message listeners for auth-related operations
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle URL analysis requests (keep existing functionality)
  if (message.type === 'analyzeNow') {
    // Check if we should force refresh or use cache
    if (message.forceRefresh) {
      console.log('Forcing fresh analysis for:', message.url);
      // Remove from memory cache to force refresh
      delete analyzedURLs[message.url];
    }
    
    analyzeAndCacheURL(message.url)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({error: error.message}));
    return true; // Keep message channel open for async response
  }
  
  // Handle authenticated API requests
  if (message.action === 'makeAuthenticatedRequest') {
    chrome.storage.local.get(['authToken'], async (data) => {
      if (!data.authToken) {
        sendResponse({ error: 'Not authenticated' });
        return;
      }
      
      try {
        const response = await fetch(message.url, {
          method: message.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': data.authToken,
            ...message.headers
          },
          body: message.body ? JSON.stringify(message.body) : undefined
        });
        
        const result = await response.json();
        sendResponse(result);
      } catch (error) {
        sendResponse({ error: error.message });
      }
    });
    return true; // Keep message channel open for async response
  }
  
  // Handle auth state requests with updated security - IMPROVED VERSION
  if (message.action === 'getAuthState') {
    // Don't validate token on every popup open - just return current auth state
    // This prevents unnecessary validations that can cause logout issues
    sendResponse({
      isLoggedIn: authState.isLoggedIn,
      token: authState.token,
      userData: authState.userData
    });
    
    // Only perform validation in the background if it's been a while
    const validationNeeded = !authState.lastVerified || 
      (Date.now() - authState.lastVerified > 10 * 60 * 1000); // 10 minutes
    
    if (validationNeeded && authState.isLoggedIn && authState.token) {
      // Validate in background after responding - don't block popup
      validateToken(authState.token).then(isValid => {
        if (!isValid) {
          // Schedule logout if needed, but don't block popup rendering
          setTimeout(() => logoutUser(), 100);
        }
      }).catch(err => {
        console.warn('Background validation error:', err);
      });
    }
    
    return true;
  }

  // Handle login success from web page
  if (message.action === 'loginSuccess') {
    const { token, user } = message;
    
    if (!token || !user) {
      sendResponse({ success: false, error: 'Invalid login data' });
      return true;
    }
    
    // Update auth state
    authState = {
      isLoggedIn: true,
      token: token,
      userData: user,
      lastVerified: Date.now()
    };
    
    // Save to storage
    chrome.storage.local.set({
      isLoggedIn: true,
      authToken: token,
      userData: user,
      authTimestamp: Date.now()
    }).then(() => {
      sendResponse({ success: true });
    });
    
    return true;
  }
  
  // Handle logout request
  if (message.action === 'logout') {
    logoutUser().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  // Handle voting action - remove feedbackType from request body
  if (message.action === 'voteNoResponse') {
    // Step 1: Verify authentication status from storage
    chrome.storage.local.get(['isLoggedIn', 'authToken'], async (authData) => {
      // If not logged in, stop immediately
      if (!authData.isLoggedIn || !authData.authToken) {
        console.log('Vote rejected: User not authenticated');
        
        // Notify popup about failed vote to update UI
        safelySendMessage({ 
          action: 'voteRejected', 
          reason: 'authentication' 
        });
        return;
      }
      
      console.log('Processing vote for URL:', message.url);
      console.log('Vote includes prediction data:', message.predictionShown, message.predictionScore);
      
      // Step 2: Get current vote data
      chrome.storage.local.get(['voteCounts'], async (storage) => {
        const voteCounts = storage.voteCounts || {};
        const currentCounts = voteCounts[message.url] || { 
          safe: 0, 
          phishing: 0, 
          userVote: null 
        };
        
        try {
          // Ensure we have values for prediction and score
          const predictionToSend = message.predictionShown || 'Unknown';
          const scoreToSend = message.predictionScore !== undefined && message.predictionScore !== null ? 
                            Number(message.predictionScore) : 0;
          
          console.log('Sending vote to API with prediction:', predictionToSend, 'score:', scoreToSend);
          
          // Step 3: Send vote to server - without feedbackType
          const response = await fetch('http://localhost:3000/api/votes', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-auth-token': authData.authToken
            },
            body: JSON.stringify({
              url: message.url, 
              voteType: message.voteType,
              predictionShown: predictionToSend,
              predictionScore: scoreToSend
            })
          });
          
          // Step 4: Handle response
          if (!response.ok) {
            if (response.status === 401) {
              // Auth error - mark for revalidation but don't logout yet
              authState.lastVerified = 0;
              throw new Error('Authentication error');
            }
            throw new Error(`Server error: ${response.status}`);
          }
          
          // Step 5: Process successful vote
          const data = await response.json();
          console.log('Vote recorded successfully:', data);
          
          // Step 6: Update local storage with fresh data
          chrome.storage.local.get(['voteCounts'], (currentStorage) => {
            const updatedCounts = currentStorage.voteCounts || {};
            updatedCounts[message.url] = {
              // Map from server response (positive/negative) to UI format (safe/phishing)
              safe: data.counts?.positive || 0,
              phishing: data.counts?.negative || 0,
              userVote: message.feedbackAction, // Store agree/disagree
              lastUpdated: Date.now()
            };
            
            chrome.storage.local.set({ voteCounts: updatedCounts });
            
            // Step 7: Notify popup about vote success
            safelySendMessage({
              action: 'voteRecorded',
              url: message.url,
              voteType: message.voteType, // Backend vote type (Positive/Negative)
              uiVoteType: message.uiVoteType || (message.voteType === 'Positive' ? 'Safe' : 'Phishing'), // UI vote type (Safe/Phishing)
              counts: data.counts
            });
          });
        } catch (error) {
          console.error('Vote error:', error.message);
          
          // Step 8: Handle error cases
          if (error.message.includes('Authentication')) {
            // Let the popup know authentication failed
            safelySendMessage({
              action: 'voteRejected',
              reason: 'authentication'
            });
          } else {
            // General server error
            safelySendMessage({
              action: 'voteRejected',
              reason: 'server',
              error: error.message
            });
          }
        }
      });
    });
  }
  
  // Handle getting vote counts with better error handling
  if (message.action === 'getVoteCountsNoResponse') {
    const headers = {};
    
    // Only include auth token if logged in
    chrome.storage.local.get(['isLoggedIn', 'authToken'], (authData) => {
      if (authData.isLoggedIn && authData.authToken) {
        headers['x-auth-token'] = authData.authToken;
      }
      
      fetch(`http://localhost:3000/api/votes/counts?url=${encodeURIComponent(message.url)}`, {
        headers: headers
      })
      .then(response => {
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        return response.json();
      })
      .then(data => {
        // Update vote counts in storage - map from positive/negative to safe/phishing
        chrome.storage.local.get(['voteCounts'], (storage) => {
          const voteCounts = storage.voteCounts || {};
          
          // Convert backend positive/negative to UI safe/phishing
          const mappedCounts = {
            safe: data.counts?.positive || 0,
            phishing: data.counts?.negative || 0
          };
          
          // Get the user's feedback type based on vote
          let userFeedbackType = null;
          if (data.userVote) {
            // Look up the user's current prediction from storage
            // (temporary fix - we would need to store this on the server long-term)
            const existingVoteData = voteCounts[message.url];
            if (existingVoteData && existingVoteData.userVote) {
              userFeedbackType = existingVoteData.userVote; // This should be 'agree' or 'disagree'
            }
          }
          
          // Only include userVote if user is logged in
          voteCounts[message.url] = {
            safe: mappedCounts.safe,
            phishing: mappedCounts.phishing,
            userVote: userFeedbackType, 
            lastUpdated: Date.now()
          };
          
          chrome.storage.local.set({ voteCounts });
          
          // Notify popup with the proper format
          safelySendMessage({
            action: 'voteCounts',
            url: message.url,
            counts: mappedCounts,
            userVote: userFeedbackType
          });
        });
      })
      .catch(error => {
        console.error('Vote count error:', error);
        chrome.storage.local.get(['voteCounts'], (storage) => {
          const voteCounts = storage.voteCounts || {};
          if (!voteCounts[message.url]) {
            voteCounts[message.url] = { 
              safe: 0, 
              phishing: 0, 
              userVote: null,
              error: true
            };
            chrome.storage.local.set({ voteCounts });
          }
        });
      });
    });
  }
  
  // Direct immediate vote count for popup - FIX MAPPING BETWEEN BACKEND AND UI
  if (message.action === 'getVoteCountsImmediate') {
    const headers = {};
    
    // Only include auth token if logged in
    chrome.storage.local.get(['isLoggedIn', 'authToken'], (authData) => {
      if (authData.isLoggedIn && authData.authToken) {
        headers['x-auth-token'] = authData.authToken;
      }
      
      fetch(`http://localhost:3000/api/votes/counts?url=${encodeURIComponent(message.url)}`, {
        headers: headers
      })
      .then(response => {
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        return response.json();
      })
      .then(data => {
        console.log('Immediate vote counts fetched:', data);
        
        // Convert backend positive/negative to UI safe/phishing
        const mappedCounts = {
          safe: data.counts?.positive || 0,
          phishing: data.counts?.negative || 0
        };
        
        // Fix: Convert backend vote type to UI vote type directly
        let uiVote = null;
        if (data.userVote === 'Positive') uiVote = 'Safe';
        else if (data.userVote === 'Negative') uiVote = 'Phishing';
        
        sendResponse({
          success: true,
          counts: mappedCounts,
          userVote: uiVote // Use the properly mapped vote type
        });
        
        // Fix: Store the correct user vote type in storage
        chrome.storage.local.get(['voteCounts'], (storage) => {
          const voteCounts = storage.voteCounts || {};
          
          voteCounts[message.url] = {
            safe: mappedCounts.safe,
            phishing: mappedCounts.phishing,
            userVote: uiVote, // Store the UI-friendly vote type
            lastUpdated: Date.now()
          };
          
          chrome.storage.local.set({ 
            voteCounts, 
            voteLastChecked: Date.now() 
          });
          
          // Also send a message to update any open popups
          if (uiVote) {
            safelySendMessage({
              action: 'voteCounts',
              url: message.url,
              counts: mappedCounts,
              userVote: uiVote
            });
          }
        });
      })
      .catch(error => {
        console.error('Immediate vote count error:', error);
        sendResponse({ success: false, error: error.message });
      });
    });
    
    return true; // Keep message channel open
  }

  // New handler for fetching cached analysis directly
  if (message.action === 'getCachedAnalysis') {
    const url = message.url;
    const cachedData = analyzedURLs[url];
    
    console.log('Cache request for:', url);
    console.log('Cache available:', !!cachedData);
    
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_EXPIRY)) {
      console.log('Returning cached analysis for:', url);
      sendResponse({ 
        cached: true, 
        result: cachedData.result 
      });
    } else {
      sendResponse({ cached: false });
    }
    return true;  // Keep channel open for async response
  }

  // Handle vote counts response for UI - FIX THE REFERENCE ERROR WITH data
  if (message.action === 'voteCounts') {
    // Fix: Don't use 'data' which is undefined - use 'message' instead
    const response = {
      action: 'voteCounts',
      url: message.url,
      counts: {
        safe: message.counts?.positive || 0,
        phishing: message.counts?.negative || 0
      },
      userVote: message.userVote === 'Positive' ? 'Safe' : 
                message.userVote === 'Negative' ? 'Phishing' : null
    };
    
    // Actually send the processed message
    safelySendMessage(response);
  }

  // Handle API request proxying with token expiration check
  if (message.action === 'apiRequest') {
    (async () => {
      try {
        const data = await chrome.storage.local.get(['authToken']);
        
        const response = await fetch(message.url, {
          method: message.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': data.authToken,
            ...message.headers
          },
          body: message.body ? JSON.stringify(message.body) : undefined
        });
        
        // Check for token expiration
        if (response.status === 401) {
          try {
            const responseData = await response.json();
            if (responseData.code === 'TOKEN_EXPIRED') {
              console.log('API request failed due to expired token, logging out');
              await logoutUser();
              sendResponse({ 
                error: 'Your session has expired. Please log in again.',
                code: 'TOKEN_EXPIRED'
              });
              return;
            }
          } catch (e) {
            // If we can't parse the response as JSON, continue with normal processing
          }
        }
        
        const result = await response.json();
        sendResponse(result);
      } catch (error) {
        sendResponse({ error: error.message });
      }
    })();
    return true; // Keep message channel open for async response
  }
});