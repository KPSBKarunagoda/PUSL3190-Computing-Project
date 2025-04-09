// Enhanced caching system for background.js
const analyzedURLs = {}; // In-memory cache
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes cache lifetime

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
    
    const response = await fetch('http://localhost:3000/api/auth/verify', {
      method: 'GET',
      headers: {
        'x-auth-token': token
      }
    });
    
    if (response.ok) {
      authState.lastVerified = Date.now();
      // Update timestamp in storage too
      chrome.storage.local.set({ authTimestamp: Date.now() });
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
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
  
  // Clear storage data
  await chrome.storage.local.remove([
    'isLoggedIn', 
    'authToken', 
    'userData', 
    'authTimestamp', 
    'voteCounts'
  ]);
  
  // Notify any open popup
  safelySendMessage({ action: 'authStateChanged', isLoggedIn: false });
}

// Send message safely to handle cases where receiver might be gone
function safelySendMessage(message) {
  try {
    chrome.runtime.sendMessage(message).catch(error => {
      // Just log disconnection errors without throwing
      if (error.message && error.message.includes("Receiving end does not exist")) {
        console.log("Ignored disconnection: popup probably closed");
      } else {
        console.error("Message send error:", error);
      }
    });
  } catch (error) {
    // Just log any errors without throwing
    console.log("Safe message send caught error:", error);
  }
}

// Check token expiry every minute
setInterval(() => {
  if (authState.isLoggedIn && authState.token) {
    validateToken(authState.token).then(isValid => {
      if (!isValid) {
        logoutUser();
      }
    });
  }
}, 60 * 1000);

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

// Add message listeners for auth-related operations
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle URL analysis requests (keep existing functionality)
  if (message.type === 'analyzeNow') {
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
  
  // Handle auth state requests with updated security
  if (message.action === 'getAuthState') {
    validateToken(authState.token).then(isValid => {
      if (isValid) {
        sendResponse({
          isLoggedIn: true,
          token: authState.token,
          userData: authState.userData
        });
      } else {
        // Token is invalid - force logout
        logoutUser().then(() => {
          sendResponse({ isLoggedIn: false, userData: null });
        });
      }
    });
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
  
  // Handle voting action
  if (message.action === 'vote') {
    // Always respond immediately before doing any processing
    sendResponse({ status: 'received' });
    
    // Get auth token and do the API call asynchronously
    chrome.storage.local.get(['authToken'], (data) => {
      if (!data.authToken) {
        console.error('Cannot submit vote: User not authenticated');
        return;
      }
      
      // Process the vote after responding
      fetch('http://localhost:3000/api/votes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': data.authToken
        },
        body: JSON.stringify({ 
          url: message.url, 
          voteType: message.voteType 
        })
      })
      .then(response => response.json())
      .then(data => console.log('Vote recorded:', data))
      .catch(error => console.error('Vote error:', error));
    });
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  }
  
  // Handle request for vote counts
  if (message.action === 'getVoteCounts') {
    // For vote counts, also respond immediately
    sendResponse({ counts: { safe: 0, phishing: 0 } });
    
    // Then fetch real counts asynchronously
    chrome.storage.local.get(['authToken'], (data) => {
      fetch(`http://localhost:3000/api/votes/counts?url=${encodeURIComponent(message.url)}`, {
        headers: {
          'x-auth-token': data.authToken || ''
        }
      })
      .then(response => response.json())
      .then(data => {
        // Store in local storage for future reference
        chrome.storage.local.get(['voteCounts'], (storage) => {
          const voteCounts = storage.voteCounts || {};
          voteCounts[message.url] = data.counts;
          chrome.storage.local.set({ voteCounts });
        });
      })
      .catch(error => console.error('Vote count error:', error));
    });
    
    return true;
  }
  
  // Handle voting action with no response
  if (message.action === 'voteNoResponse') {
    validateToken(authState.token).then(isValid => {
      if (!isValid) {
        console.error('Cannot submit vote: User token is invalid');
        logoutUser(); // Force logout if token is invalid
        return;
      }
      
      // Get current cached vote counts for this URL
      chrome.storage.local.get(['voteCounts'], (storage) => {
        const voteCounts = storage.voteCounts || {};
        const currentCounts = voteCounts[message.url] || { safe: 0, phishing: 0 };
        
        // Process the vote asynchronously with secure token
        fetch('http://localhost:3000/api/votes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': authState.token
          },
          body: JSON.stringify({ 
            url: message.url, 
            voteType: message.voteType 
          })
        })
        .then(response => {
          if (!response.ok) {
            if (response.status === 401) {
              // Authentication failed - token likely expired
              logoutUser();
              throw new Error('Authentication failed');
            }
            return response.text().then(text => {
              throw new Error(`API error (${response.status}): ${text}`);
            });
          }
          return response.json();
        })
        .then(data => {
          console.log('Vote recorded:', data);
          
          // Save to local storage with the most up-to-date counts
          chrome.storage.local.get(['voteCounts'], (storage) => {
            const voteCounts = storage.voteCounts || {};
            voteCounts[message.url] = {
              safe: data.counts?.safe || currentCounts.safe,
              phishing: data.counts?.phishing || currentCounts.phishing,
              userVote: message.voteType
            };
            chrome.storage.local.set({ voteCounts });
            console.log('Vote counts updated in storage:', voteCounts[message.url]);
          });
        })
        .catch(error => console.error('Vote error:', error));
      });
    });
    
    // No return value needed since we're not responding
  }
  
  // Handle getting vote counts with no response
  if (message.action === 'getVoteCountsNoResponse') {
    // Don't validate token here - we want counts regardless of login state
    const headers = authState.token ? 
      { 'x-auth-token': authState.token } : 
      {};
    
    fetch(`http://localhost:3000/api/votes/counts?url=${encodeURIComponent(message.url)}`, {
      headers: headers
    })
    .then(response => {
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return response.json();
    })
    .then(data => {
      // Store in local storage for UI to access, including the userVote
      chrome.storage.local.get(['voteCounts'], (storage) => {
        const voteCounts = storage.voteCounts || {};
        voteCounts[message.url] = {
          ...(data.counts || { safe: 0, phishing: 0 }),
          userVote: data.userVote
        };
        chrome.storage.local.set({ voteCounts });
        console.log('Updated vote counts in storage:', voteCounts[message.url]);
        
        // No need to send message back to popup - it will read from storage
      });
    })
    .catch(error => {
      console.error('Vote count error:', error);
      // Still ensure we have a record in storage
      chrome.storage.local.get(['voteCounts'], (storage) => {
        const voteCounts = storage.voteCounts || {};
        if (!voteCounts[message.url]) {
          voteCounts[message.url] = { safe: 0, phishing: 0, userVote: null };
          chrome.storage.local.set({ voteCounts });
        }
      });
    });
  }
});

// Function to process votes
async function processVote(url, voteType, token) {
  try {
    console.log(`Processing vote: ${voteType} for ${url}`);
    
    // Send vote to backend API
    const response = await fetch('http://localhost:3000/api/votes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      },
      body: JSON.stringify({ url, voteType })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `API error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Vote recorded successfully:', result);
    
    // Save vote counts AND userVote in local storage for future reference
    if (result.counts) {
      chrome.storage.local.get(['voteCounts'], (data) => {
        const voteCounts = data.voteCounts || {};
        voteCounts[url] = {
          ...result.counts,
          userVote: voteType  // Store the user's vote type
        };
        chrome.storage.local.set({ voteCounts });
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error submitting vote:', error);
    throw error;
  }
}

// Ensure our vote storage is cleared when the user logs out
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.isLoggedIn || changes.authToken)) {
    if (changes.isLoggedIn?.newValue === false || !changes.authToken?.newValue) {
      console.log('User logged out - clearing vote data');
      chrome.storage.local.remove(['voteCounts']);
    }
  }
});