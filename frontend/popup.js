document.addEventListener('DOMContentLoaded', async () => {
  // Setup elements and state once, reuse throughout
  const elements = {
    settingsBtn: document.getElementById('settings-btn'),
    settingsDropdown: document.getElementById('settings-dropdown'),
    resultContainer: document.getElementById('result-container'),
    currentSiteLink: document.getElementById('currentSiteLink'),
    scoreElement: document.getElementById('score'),
    circleFill: document.querySelector('.circle-fill'),
    statusElement: document.getElementById('status'),
    scoreSection: document.querySelector('.score-section'),
    riskExplanation: document.querySelector('.risk-explanation'),
    // Auth-specific elements
    loginBtn: document.getElementById('login-btn'),
    dashboardBtn: document.getElementById('dashboard-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    userInfo: document.getElementById('user-info'),
    userName: document.getElementById('user-name'),
    refreshBtn: document.getElementById('refreshAnalysis'),
    reportLink: document.getElementById('report-link'),
    
    // NEW: Vote and report elements
    voteUp: document.getElementById('vote-up'),
    voteDown: document.getElementById('vote-down'),
    upvotes: document.getElementById('upvotes'),
    downvotes: document.getElementById('downvotes'),
    reportButton: document.getElementById('report-button'),
    reportForm: document.getElementById('report-form'),
    reportReason: document.getElementById('report-reason'),
    reportComments: document.getElementById('report-comments'),
    submitReport: document.getElementById('submit-report'),
    
    // Added for caching UI
    cacheStatus: document.getElementById('cache-status'),
    cacheText: document.getElementById('cache-text'),

    // User avatar and role elements
    userAvatar: document.querySelector('.user-avatar'),
    userRole: document.getElementById('user-role')
  };

  // First check authentication state
  await checkAuthState(elements);

  // Create voting system instance directly after checking auth state
  window.votingSystem = new VotingSystem(elements);
  
  // Setup settings dropdown
  if (elements.settingsBtn && elements.settingsDropdown) {
    // Toggle dropdown when settings button is clicked
    elements.settingsBtn.addEventListener('click', () => {
      elements.settingsDropdown.classList.toggle('active');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
      if (!event.target.closest('#settings-btn') && !event.target.closest('#settings-dropdown')) {
        elements.settingsDropdown.classList.remove('active');
      }
    });
    
    // Update links with the base URL
    const baseUrl = 'http://localhost:3000';
    const loginLink = elements.settingsDropdown.querySelector('a[href="login.html"]');
    if (loginLink) {
      loginLink.href = `${baseUrl}/login.html`;
    }
    
    // Configure report button to show/hide the report form
    if (elements.reportButton && elements.reportForm) {
      elements.reportButton.addEventListener('click', () => {
        // Toggle form visibility by changing display style directly
        const isVisible = elements.reportForm.style.display !== 'none';
        elements.reportForm.style.display = isVisible ? 'none' : 'flex';
      });
    }
    
    // Configure login button
    if (elements.loginBtn) {
      elements.loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: `${baseUrl}/login.html` });
      });
    }
    
    // Configure dashboard button
    if (elements.dashboardBtn) {
      elements.dashboardBtn.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: `${baseUrl}/dashboard.html` });
      });
    }
    
    // Configure logout button
    if (elements.logoutBtn) {
      elements.logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await logout();
        await checkAuthState(elements);
        showMessage('Successfully logged out', elements);
      });
    }
    
    // Set up the report link functionality
    if (elements.reportLink) {
      elements.reportLink.addEventListener('click', async (e) => {
        e.preventDefault();
        // Check if user is logged in
        const authState = await getAuthState();
        if (authState.isLoggedIn) {
          // Get current tab URL
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs && tabs.length > 0) {
            try {
              await makeAuthenticatedRequest('/api/reports', 'POST', { url: tabs[0].url });
              showMessage("URL reported successfully. Thank you!", elements);
            } catch (error) {
              showMessage("Error reporting URL. Please try again.", elements);
            }
          }
        } else {
          showMessage("Please log in to report suspicious sites", elements);
        }
      });
    }
  }
  
  try {
    // Get current tab
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    
    if (!tabs || tabs.length === 0) {
      throw new Error('No active tab found');
    }
    
    // Process the tab and analyze URL
    await processTab(tabs[0], elements);
    
    // Initialize voting system with current URL
    if (window.votingSystem) {
      window.votingSystem.init(tabs[0].url);
    }
    
  } catch (error) {
    console.error('Popup error:', error);
    showError(error.message, elements);
  }
});

// Separate tab processing to reduce DOMContentLoaded complexity
async function processTab(tab, elements) {
  console.log('Current tab URL:', tab.url);
  
  // Skip internal browser pages
  if (!tab.url || tab.url.startsWith('chrome:') || tab.url.startsWith('chrome-extension:')) {
    showError('Cannot analyze browser internal pages', elements);
    return;
  }
  
  // Update URL display
  if (elements.currentSiteLink) {
    elements.currentSiteLink.textContent = tab.url;
    elements.currentSiteLink.href = tab.url;
  }
  
  // Setup refresh button once, outside of the conditional logic
  setupRefreshButton(tab, elements);
  
  // Check for ANY cached analysis (background or local storage)
  const cachedResult = await getBestCachedAnalysis(tab.url);
  
  if (cachedResult) {
    console.log('Using cached analysis result');
    showResult(cachedResult, elements);
    
    // Show cache indicator if we have UI element for it
    if (elements.cacheStatus) {
      elements.cacheStatus.style.display = 'block';
      
      // Calculate how long ago the analysis was cached - removed cache duration text
      const timeAgo = getTimeAgo(cachedResult.timestamp);
      if (elements.cacheText) {
        elements.cacheText.textContent = `Analysis from ${timeAgo}`;
      }
    }
    return;
  }
  
  // No cached result, show loading and request analysis
  showLoading(elements);
  console.log('Analyzing URL:', tab.url);
  
  // Get user preferences
  const preferences = await chrome.storage.sync.get(['safeSearchEnabled']);
  const useSafeBrowsing = preferences.safeSearchEnabled !== false; // default to true
  
  try {
    // Request analysis (will return cached result if available)
    const result = await sendMessageWithTimeout(
      { 
        type: 'analyzeNow', 
        url: tab.url,
        useSafeBrowsing: useSafeBrowsing,
        forceRefresh: false // Don't force reanalysis
      },
      10000 // 10 second timeout
    );
    
    console.log('Analysis result:', result);
    
    if (!result) {
      throw new Error('Empty response received');
    }
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    // Cache the successful result with timestamp
    await cacheAnalysisResult(tab.url, result);
    
    showResult(result, elements);
  } catch (error) {
    showError(error.message, elements);
  }
}

/**
 * Setup refresh button with proper event handling
 * @param {object} tab - Current tab object
 * @param {object} elements - DOM elements
 */
function setupRefreshButton(tab, elements) {
  const refreshButton = elements.refreshBtn;
  if (!refreshButton) return;
  
  // Remove any existing click listeners to prevent duplicates
  const newButton = refreshButton.cloneNode(true);
  refreshButton.parentNode.replaceChild(newButton, refreshButton);
  elements.refreshBtn = newButton;
  
  // Add fresh click listener
  newButton.addEventListener('click', async () => {
    console.log('Refreshing analysis for:', tab.url);
    showLoading(elements);
    
    // Hide cache indicator during refresh
    if (elements.cacheStatus) {
      elements.cacheStatus.style.display = 'none';
    }
    
    try {
      // Get user preferences for analysis
      const preferences = await chrome.storage.sync.get(['safeSearchEnabled']);
      const useSafeBrowsing = preferences.safeSearchEnabled !== false;
      
      // Request fresh analysis with forceRefresh flag
      const freshResult = await sendMessageWithTimeout(
        { 
          type: 'analyzeNow', 
          url: tab.url,
          useSafeBrowsing: useSafeBrowsing,
          forceRefresh: true // Force reanalysis
        },
        10000
      );
      
      // Validate result
      if (!freshResult) {
        throw new Error('Empty response received');
      }
      
      if (freshResult.error) {
        throw new Error(freshResult.error);
      }
      
      // Update cache with fresh result
      await cacheAnalysisResult(tab.url, freshResult);
      
      // Show the fresh result
      showResult(freshResult, elements);
      
      // Flash a brief "refreshed" message
      showMessage("Analysis refreshed", elements);
      
    } catch (error) {
      console.error('Refresh error:', error);
      showError(`Refresh failed: ${error.message}`, elements);
    }
  });
}

/**
 * Get the best available cached analysis from all sources
 * @param {string} url The URL to check
 * @returns {Promise<Object|null>} The cached result or null if not found/expired
 */
async function getBestCachedAnalysis(url) {
  // First check the background script's memory cache (most up-to-date)
  try {
    const backgroundCache = await new Promise(resolve => {
      chrome.runtime.sendMessage(
        { action: 'getCachedAnalysis', url: url },
        response => {
          if (response && response.cached && response.result) {
            resolve(response.result);
          } else {
            resolve(null);
          }
        }
      );
    });
    
    if (backgroundCache) {
      console.log('Using background script cached result');
      return backgroundCache;
    }
  } catch (error) {
    console.log('Error checking background cache:', error);
  }
  
  // Then check local storage cache
  const localCache = await getCachedAnalysis(url);
  if (localCache) {
    console.log('Using local storage cached result');
    return localCache;
  }
  
  return null;
}

/**
 * Check if we have a valid cached analysis result
 * @param {string} url The URL to check
 * @returns {Promise<Object|null>} The cached result or null if not found/expired
 */
async function getCachedAnalysis(url) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['analysisCache'], (data) => {
      const cache = data.analysisCache || {};
      const cachedItem = cache[url];
      
      if (!cachedItem) {
        resolve(null);
        return;
      }
      
      // Check if the cache is still valid (less than 15 minutes old)
      const now = Date.now();
      const cacheAge = now - cachedItem.timestamp;
      const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
      
      if (cacheAge > CACHE_TTL) {
        // Cache expired
        resolve(null);
        return;
      }
      
      resolve(cachedItem);
    });
  });
}

/**
 * Cache an analysis result with timestamp
 * @param {string} url The URL being analyzed
 * @param {Object} result The analysis result to cache
 */
async function cacheAnalysisResult(url, result) {
  if (!result) return;
  
  // Add timestamp to the result
  const resultWithTimestamp = {
    ...result,
    timestamp: Date.now()
  };
  
  return new Promise((resolve) => {
    chrome.storage.local.get(['analysisCache'], (data) => {
      const cache = data.analysisCache || {};
      
      // Store in cache
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
      
      chrome.storage.local.set({ analysisCache: cache }, resolve);
    });
  });
}

/**
 * Convert timestamp to a human-readable time ago string
 * @param {number} timestamp The timestamp to convert
 * @returns {string} Human readable time ago
 */
function getTimeAgo(timestamp) {
  if (!timestamp) return 'unknown time';
  
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  // Less than a minute
  if (seconds < 60) {
    return 'just now';
  }
  
  // Less than an hour
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }
  
  // Less than a day
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  
  // More than a day
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

// Special function for login-required message with action button
function showLoginRequiredMessage(elements) {
  // Find the vote section
  const votingSection = document.querySelector('.voting-section') || 
                       document.querySelector('.vote-buttons-container') || 
                       elements.voteUp.closest('.card-section');
  
  if (!votingSection && !elements.resultContainer) return;

  // Remove any existing login messages to prevent duplicates
  const existingMessages = document.querySelectorAll('.login-required-message');
  existingMessages.forEach(el => el.remove());

  // Create a dedicated message element that's more noticeable
  const messageElement = document.createElement('div');
  messageElement.className = 'login-required-message notification-message';
  messageElement.innerHTML = `
    <div class="message-content">
      <i class="fas fa-lock message-icon"></i>
      <div class="login-message-text">
        <p><strong>Login Required</strong></p>
      </div>
    </div>
    <button class="login-now-btn">Log in</button>
  `;

  // Insert above the voting section
  if (votingSection) {
    votingSection.parentNode.insertBefore(messageElement, votingSection);
  } else {
    // Fallback to the result container
    elements.resultContainer.insertAdjacentElement('afterbegin', messageElement);
  }

  // Add click handler to the login button
  const loginButton = messageElement.querySelector('.login-now-btn');
  if (loginButton) {
    loginButton.addEventListener('click', () => {
      chrome.tabs.create({ url: 'http://localhost:3000/login.html' });
    });
  }

  // Animate in
  setTimeout(() => messageElement.classList.add('visible'), 10);
  
  // Auto-remove after a period
  setTimeout(() => {
    messageElement.classList.remove('visible');
    setTimeout(() => messageElement.remove(), 500);
  }, 6000);
}

// Check authentication state and update UI - reverted to original implementation
async function checkAuthState(elements) {
  try {
    // Get auth state directly from storage
    const data = await new Promise(resolve => {
      chrome.storage.local.get(['isLoggedIn', 'authToken', 'userData'], resolve);
    });
    
    const isLoggedIn = !!data.isLoggedIn && !!data.authToken;
    
    // Update UI based on auth state
    if (elements.loginBtn) elements.loginBtn.style.display = isLoggedIn ? 'none' : 'block';
    if (elements.dashboardBtn) elements.dashboardBtn.style.display = isLoggedIn ? 'block' : 'none';
    if (elements.logoutBtn) elements.logoutBtn.style.display = isLoggedIn ? 'block' : 'none';
    
    // Show user info if available - original implementation
    if (elements.userInfo && isLoggedIn && data.userData) {
      elements.userInfo.style.display = 'flex';
      
      if (elements.userName) {
        const displayName = data.userData.username || data.userData.email || 'User';
        elements.userName.textContent = displayName;
      }
      
      if (elements.userAvatar) {
        // Reset to default icon
        elements.userAvatar.innerHTML = '<i class="fas fa-user"></i>';
      }
      
      // Set user role if available
      if (elements.userRole && data.userData.role) {
        elements.userRole.textContent = data.userData.role;
      } else if (elements.userRole) {
        elements.userRole.textContent = 'Member';
      }
    } else if (elements.userInfo) {
      elements.userInfo.style.display = 'none';
    }
    
    return { isLoggedIn, userData: data.userData };
  } catch (error) {
    console.error('Error checking auth state:', error);
    return { isLoggedIn: false };
  }
}

// Improved logout function that properly clears all data
function logout() {
  return new Promise((resolve) => {
    // Reset vote UI immediately if voting system exists
    if (window.votingSystem) {
      window.votingSystem.resetVoteUI();
    }
    
    chrome.runtime.sendMessage({ action: 'logout' }, (response) => {
      resolve(response);
    });
  });
}

// More secure auth state check with improved error handling
function getAuthState() {
  return new Promise((resolve) => {
    // First check storage directly to avoid message passing when possible
    chrome.storage.local.get(['isLoggedIn', 'authToken', 'userData'], (data) => {
      const localIsLoggedIn = !!data.isLoggedIn && !!data.authToken;
      
      // If we have local data, use it directly
      if (localIsLoggedIn) {
        // Return auth state immediately from storage without validation
        // This prevents unnecessary token validations that can cause logout issues
        resolve({
          isLoggedIn: true,
          token: data.authToken,
          userData: data.userData
        });
        return;
      }
      
      // Only if no local data, check with background script
      chrome.runtime.sendMessage({ action: 'getAuthState' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error getting auth state:', chrome.runtime.lastError);
          resolve({ isLoggedIn: false });
          return;
        }
        
        resolve(response || { isLoggedIn: false });
      });
    });
  });
}

// More secure authenticated API request
function makeAuthenticatedRequest(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    // First verify auth state
    getAuthState().then(authState => {
      if (!authState.isLoggedIn) {
        reject(new Error('Not authenticated'));
        return;
      }
      
      chrome.runtime.sendMessage({
        action: 'makeAuthenticatedRequest',
        url: `http://localhost:3000${endpoint}`,
        method,
        body
      }, (response) => {
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  });
}

// Replace the vote count retrieval in showResult with the VotingSystem approach
async function showResult(result, elements) {
  const { scoreElement, statusElement, resultContainer, scoreSection, riskExplanation, currentSiteLink, circleFill } = elements;

  console.log('Processing result:', result);

  const displayData = {
    risk_score: Number(result.risk_score) || 0,
    is_phishing: Boolean(result.is_phishing),
    risk_explanation: result.risk_explanation || 'No detailed explanation available',
    features: result.features || {},
    url: result.url || '',
    ml_prediction: result.ml_result?.prediction || 0
  };

  console.log('Display data:', displayData);

  // Update the score text
  if (scoreElement) {
    scoreElement.textContent = Math.round(displayData.risk_score);
    
    // Remove any existing classes
    scoreElement.className = '';
    
    // Add the appropriate class based on the risk level
    if (displayData.is_phishing || displayData.risk_score >= 60) {
      scoreElement.classList.add('danger-score');
    } else if (displayData.risk_score >= 30) {
      scoreElement.classList.add('warning-score');
    } else {
      scoreElement.classList.add('safe-score');
    }
  }
  
  // Update the circular progress bar
  if (circleFill) {
    // Calculate the circumference of the circle
    const circumference = 2 * Math.PI * 54; // 54 is the radius of the circle
    
    // Calculate how much of the circle should be filled (percentage of the circumference)
    const fillPercentage = displayData.risk_score / 100;
    const fillOffset = circumference - (circumference * fillPercentage);
    
    // Remove any existing classes
    circleFill.classList.remove('safe', 'warning', 'danger');
    
    // Add the appropriate class based on the risk level
    if (displayData.is_phishing || displayData.risk_score >= 60) {
      circleFill.classList.add('danger');
    } else if (displayData.risk_score >= 30) {
      circleFill.classList.add('warning');
    } else {
      circleFill.classList.add('safe');
    }
    
    // Set the dashoffset to fill the circle according to the score
    circleFill.style.strokeDashoffset = fillOffset;
  }

  if (statusElement) {
    let indicator;
    if (displayData.is_phishing) {
      indicator = '⚠️ Warning: ';
      statusElement.className = 'unsafe-status';
    } else if (displayData.risk_score > 30 && displayData.ml_prediction === 1) {
      indicator = '⚠️ Caution: ';
      statusElement.className = 'warning-status';
    } else {
      indicator = '✅ Safe: ';
      statusElement.className = 'safe-status';
    }
    statusElement.textContent = indicator + displayData.risk_explanation;
  }

  if (scoreSection) {
    scoreSection.className = `score-section ${displayData.is_phishing ? 'unsafe' : 'safe'}`;
  }

  if (riskExplanation) {
    riskExplanation.className = `risk-explanation ${displayData.is_phishing ? 'unsafe' : 'safe'}`;
  }

  if (currentSiteLink) {
    currentSiteLink.textContent = displayData.url;
    currentSiteLink.href = displayData.url;
  }

  if (resultContainer) {
    if (Object.keys(displayData.features).length > 0) {
      resultContainer.innerHTML = `
        <section class="features-section ${displayData.is_phishing ? 'unsafe' : 'safe'}">
          <h3>Detection Features</h3>
          <ul class="feature-list">
            ${Object.entries(displayData.features)
              .filter(([key]) => key !== '__class__')
              .map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`)
              .join('')}
          </ul>
        </section>
      `;
    } else {
      resultContainer.innerHTML = '';
    }
  }
}

function showLoading(elements) {
  const { scoreElement, statusElement, resultContainer, scoreSection, riskExplanation, circleFill } = elements;

  if (scoreElement) {
    scoreElement.textContent = '...';
    scoreElement.className = '';
  }

  if (statusElement) {
    statusElement.textContent = '';
    statusElement.className = '';
  }

  if (circleFill) {
    circleFill.style.strokeDashoffset = '339.3'; // Reset to empty
    circleFill.classList.remove('safe', 'warning', 'danger');
  }

  if (resultContainer) {
    resultContainer.innerHTML = `
      <div class="analyzing">
        <div class="spinner"></div>
      </div>
    `;
  }

  if (scoreSection) {
    scoreSection.className = 'score-section';
  }

  if (riskExplanation) {
    riskExplanation.className = 'risk-explanation';
  }
}

function showError(message, elements) {
  const { resultContainer } = elements;

  console.error("Error in popup:", message);

  if (resultContainer) {
    resultContainer.innerHTML = `
      <div class="error">
        <p>Error: ${message}</p>
      </div>
    `;
  }
}

function sendMessageWithTimeout(message, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Analysis timed out after ' + timeout / 1000 + ' seconds.'));
    }, timeout);

    try {
      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timer);

        if (chrome.runtime.lastError) {
          console.error('Chrome runtime error:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response) {
          reject(new Error('Empty response received'));
          return;
        }

        resolve(response);
      });
    } catch (err) {
      clearTimeout(timer);
      console.error('Message sending error:', err);
      reject(err);
    }
  });
}

function showMessage(message, elements) {
  const { resultContainer } = elements;
  if (!resultContainer) return;

  // Create a dedicated message element instead of replacing the container's content
  const messageElement = document.createElement('div');
  messageElement.className = 'notification-message';
  messageElement.innerHTML = `
    <div class="message-content">
      <i class="fas fa-check-circle message-icon"></i>
      <p>${message}</p>
    </div>
  `;

  // Add to the DOM - insert at the top
  if (resultContainer.firstChild) {
    resultContainer.insertBefore(messageElement, resultContainer.firstChild);
  } else {
    resultContainer.appendChild(messageElement);
  }

  // Animate in
  setTimeout(() => messageElement.classList.add('visible'), 10);
  
  // Auto-remove after 4 seconds
  setTimeout(() => {
    messageElement.classList.remove('visible');
    // Remove from DOM after animation completes
    setTimeout(() => messageElement.remove(), 500);
  }, 4000);
}

// Add enhanced message and notification styling
document.head.insertAdjacentHTML('beforeend', `
  <style>
    /* Existing vote button styles */
    .vote-button.active {
      color: #4caf50;
      transform: scale(1.2);
    }
    .vote-button.active i {
      color: #4caf50;
    }
    #vote-down.active {
      color: #f44336;
    }
    #vote-down.active i {
      color: #f44336;
    }
    
    /* New notification message styles */
    .notification-message {
      position: relative;
      background-color: #4caf50;
      color: white;
      padding: 10px 15px;
      border-radius: 8px;
      margin-bottom: 15px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.2);
      transform: translateY(-20px);
      opacity: 0;
      transition: transform 0.3s, opacity 0.3s;
      z-index: 100;
    }
    
    .notification-message.visible {
      transform: translateY(0);
      opacity: 1;
    }
    
    .notification-message.error-message {
      background-color: #f44336;
    }
    
    .message-content {
      display: flex;
      align-items: center;
    }
    
    .message-icon {
      margin-right: 10px;
      font-size: 1.2rem;
    }
    
    .notification-message p {
      margin: 0;
      padding: 0;
      font-weight: 500;
    }
    
    /* Login Required Message specific styles - IMPROVED & REPOSITIONED */
    .login-required-message {
      background: linear-gradient(135deg, #2196F3, #1976D2);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 15px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      margin: 0 0 12px 0;
      border: none;
      box-sizing: border-box;
      width: calc(100% - 10px); /* Slightly narrower to account for parent padding */
      max-width: 95%;
      position: relative;
      z-index: 10;
      margin-left: auto;
      margin-right: auto;
      overflow: hidden; /* Prevent content from spilling out */
    }
    
    /* Parent container adjustments to keep message inside */
    .card-section, .voting-section, .vote-buttons-container {
      position: relative;
      overflow: visible;
    }
    
    /* Animation for login message */
    @keyframes gentle-pulse {
      0% { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
      50% { box-shadow: 0 6px 16px rgba(33, 150, 243, 0.3); }
      100% { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
    }
    
    .login-required-message.visible {
      animation: gentle-pulse 2s infinite;
    }
    
    /* Simplified Login Button Styling */
    .login-now-btn {
      background: white;
      color: #1976D2;
      border: none;
      border-radius: 6px;
      padding: 8px 14px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    /* Remove unnecessary styles that were for hover effects */
    
    .login-btn-text {
      position: relative;
      z-index: 2;
    }
    
    .login-btn-icon {
      font-size: 0.8rem;
    }
    
    /* Cache indicator styling */
    .cache-indicator {
      display: none;
      padding: 6px 10px;
      background-color: rgba(0, 0, 0, 0.05);
      border-radius: 6px;
      font-size: 0.8rem;
      color: #666;
      margin-bottom: 10px;
      text-align: center;
      border: 1px solid rgba(0, 0, 0, 0.07);
      transition: all 0.2s ease;
    }
    
    .cache-indicator i {
      margin-right: 6px;
      color: #1976D2;
    }
  </style>
`);