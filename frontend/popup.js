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
    userRole: document.getElementById('user-role'),

    // Key findings and detailed analysis elements
    findingsCards: document.getElementById('findings-cards'),
    viewDetailedAnalysis: document.getElementById('view-detailed-analysis'),
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
      elements.reportButton.addEventListener('click', async (e) => {
        // Check if user is logged in before showing form
        const authState = await getAuthState();
        if (!authState.isLoggedIn) {
          showLoginRequiredMessage(elements);
          return;
        }
        
        try {
          // Get current URL from active tab
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tabs || tabs.length === 0) {
            showMessage("Couldn't determine current website URL", elements);
            return;
          }
          
          const url = tabs[0].url;
          
          // Check if user has already reported this URL
          const response = await fetch('http://localhost:3000/api/reports/check', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-auth-token': authState.token
            },
            body: JSON.stringify({ url })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.alreadyReported) {
              // Show permanent message instead of temporary notification
              showAlreadyReportedMessage(elements, data.reportId);
              return;
            }
          }
          
          // Toggle form visibility
          const isVisible = elements.reportForm.style.display !== 'none';
          elements.reportForm.style.display = isVisible ? 'none' : 'flex';
          
          // Hide already-reported message if it exists
          const existingMessage = document.getElementById('already-reported-message');
          if (existingMessage) {
            existingMessage.style.display = 'none';
          }
          
          // If showing the form, focus the reason dropdown
          if (!isVisible && elements.reportReason) {
            elements.reportReason.focus();
          }
        } catch (error) {
          console.error('Error checking report status:', error);
          
          // If the check fails, still allow reporting
          const isVisible = elements.reportForm.style.display !== 'none';
          elements.reportForm.style.display = isVisible ? 'none' : 'flex';
          
          if (!isVisible && elements.reportReason) {
            elements.reportReason.focus();
          }
        }
      });
      
      // Handle report form submission
      if (elements.reportForm) {
        elements.reportForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          
          // Verify auth state again (in case token expired during form interaction)
          const authState = await getAuthState();
          if (!authState.isLoggedIn) {
            showLoginRequiredMessage(elements);
            elements.reportForm.style.display = 'none';
            return;
          }
          
          // Get current URL from active tab
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tabs || tabs.length === 0) {
            showMessage("Couldn't determine current website URL", elements);
            return;
          }
          
          const url = tabs[0].url;
          const reason = elements.reportReason?.value;
          const description = elements.reportComments?.value;
          
          // Form validation
          if (!reason) {
            showMessage("Please select a reason for reporting", elements);
            return;
          }
          
          // Get submit button to show loading state
          const submitBtn = elements.submitReport;
          const originalText = submitBtn.textContent || 'Submit Report';
          
          try {
            // Show loading state
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
            
            // Send report to backend
            const response = await fetch('http://localhost:3000/api/reports', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-auth-token': authState.token
              },
              body: JSON.stringify({
                url, 
                reason,
                description
              })
            });
            
            // Parse response data
            let responseData;
            try {
              responseData = await response.json();
            } catch (parseError) {
              console.error('Error parsing response:', parseError);
              responseData = {};
            }
            
            // Check for duplicate report
            if (response.status === 409 || 
                responseData.message === 'You have already reported this URL' || 
                responseData.alreadyReported) {
              showMessage('You have already reported this website', elements);
              elements.reportForm.style.display = 'none'; // Hide form
              return;
            }
            
            // Check for other errors
            if (!response.ok) {
              throw new Error(responseData.message || 'Failed to submit report');
            }
            
            // Success - show enhanced success message and reset form
            showSuccessMessage(`Report submitted successfully. Thank you for helping keep the web safe!`, elements);
            
            // Add report ID to success message if available
            if (responseData.reportId) {
              console.log(`Report created with ID: ${responseData.reportId}`);
            }
            
            // Hide form and reset it
            elements.reportForm.style.display = 'none';
            elements.reportForm.reset();
            
          } catch (error) {
            console.error('Error submitting report:', error);
            showMessage("Error submitting report. Please try again.", elements);
          } finally {
            // Reset button state
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = originalText;
            }
          }
        });
      }
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

  // Setup detailed analysis button
  if (elements.viewDetailedAnalysis) {
    elements.viewDetailedAnalysis.addEventListener('click', () => {
      // Get analyzed URL from current tab
      chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
        if (tabs && tabs.length > 0) {
          const url = tabs[0].url;
          // Store URL in session storage for analyze.html
          chrome.storage.session.set({ 'lastAnalyzedUrl': url }, () => {
            // Open analyze.html in new tab
            chrome.tabs.create({ url: 'http://localhost:3000/analyze.html' });
          });
        }
      });
    });
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
  
  try {
    // Request analysis (will return cached result if available)
    // Always use Safe Browsing API by default (removing toggle functionality)
    const result = await sendMessageWithTimeout(
      { 
        type: 'analyzeNow', 
        url: tab.url,
        useSafeBrowsing: true, // Always use Safe Browsing
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
      // Request fresh analysis with forceRefresh flag
      // Always use Safe Browsing API (removing toggle functionality)
      const freshResult = await sendMessageWithTimeout(
        { 
          type: 'analyzeNow', 
          url: tab.url,
          useSafeBrowsing: true, // Always use Safe Browsing
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

// Add this new function to show a persistent message when a site has already been reported
function showAlreadyReportedMessage(elements, reportId) {
  // Hide the report form if it's visible
  if (elements.reportForm) {
    elements.reportForm.style.display = 'none';
  }
  
  // Check if the message already exists
  let messageContainer = document.getElementById('already-reported-message');
  
  // If it doesn't exist, create it
  if (!messageContainer) {
    messageContainer = document.createElement('div');
    messageContainer.id = 'already-reported-message';
    messageContainer.className = 'already-reported-container';
    
    // Create the HTML content for the message
    messageContainer.innerHTML = `
      <div class="already-reported-content">
        <div class="already-reported-icon">
          <i class="fas fa-check-circle"></i>
        </div>
        <div class="already-reported-text">
          <h4>Already Reported</h4>
          <p>You have already reported this website. Thank you for helping keep the web safe!</p>
          ${reportId ? `<p class="report-id">Report ID: ${reportId}</p>` : ''}
        </div>
      </div>
    `;
    
    // Find where to insert the message
    const reportSection = elements.reportForm.parentNode;
    reportSection.appendChild(messageContainer);
  } else {
    // If it exists, just make it visible
    messageContainer.style.display = 'block';
    
    // Update the report ID if provided
    if (reportId) {
      const reportIdElement = messageContainer.querySelector('.report-id');
      if (reportIdElement) {
        reportIdElement.textContent = `Report ID: ${reportId}`;
      } else {
        const textDiv = messageContainer.querySelector('.already-reported-text');
        if (textDiv) {
          const reportIdP = document.createElement('p');
          reportIdP.className = 'report-id';
          reportIdP.textContent = `Report ID: ${reportId}`;
          textDiv.appendChild(reportIdP);
        }
      }
    }
  }
  
  // Also show a brief notification
  showMessage('You have already reported this website', elements);
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
function showResult(result, elements) {
  const { scoreElement, statusElement, resultContainer, scoreSection, riskExplanation, currentSiteLink, circleFill, findingsCards } = elements;

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

  // Set prediction data for voting system
  if (window.votingSystem) {
    // Determine prediction from result data
    let prediction = 'Safe';
    if (displayData.is_phishing) {
      prediction = 'Phishing';
    } else if (displayData.risk_score >= 60) {
      prediction = 'Phishing';
    } else if (displayData.risk_score >= 30) {
      prediction = 'Suspicious';
    }
    
    console.log('Setting prediction data in voting system:', prediction, displayData.risk_score);
    window.votingSystem.setPrediction(prediction, displayData.risk_score);
  }

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

  // Only display key findings if risk score is over 40 (changed from 50)
  if (findingsCards) {
    if (displayData.risk_score > 40) {
      displayKeyFindings(findingsCards, result, displayData.url);
    } else {
      // Hide the findings section completely when risk score is 40 or below
      const findingsSection = findingsCards.closest('.key-findings-section');
      if (findingsSection) {
        findingsSection.style.display = 'none';
      } else {
        findingsCards.style.display = 'none';
      }
    }
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

// Add the displayKeyFindings function
async function displayKeyFindings(container, result, url) {
  container.innerHTML = '<div class="finding-placeholder"><div class="finding-loader"></div></div>';
  
  try {
    console.log('Requesting key findings for URL:', url);
    
    // Check if we have a valid token for authentication
    const authState = await getAuthState();
    if (!authState.isLoggedIn) {
      container.innerHTML = `
        <div class="finding-card medium-risk">
          <div class="finding-header">
            <i class="fas fa-info-circle"></i>
            <span>Login Required</span>
          </div>
          <p>Log in to view key security findings for this URL.</p>
        </div>
      `;
      return;
    }
    
    // Call the backend API for key findings
    const response = await fetch('http://localhost:3000/api/education/key-findings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': authState.token
      },
      body: JSON.stringify({ url, analysisResult: result })
    });
    
    console.log('Key findings response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Key findings API error:', response.status, errorText);
      throw new Error(`Failed to fetch key findings: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Key findings retrieved successfully:', data);
    
    const findings = data.findings || [];
    console.log(`Displaying ${findings.length} key findings`);
    
    // Clear the container
    container.innerHTML = '';
    
    // If no findings, show a default message
    if (findings.length === 0) {
      container.innerHTML = `
        <div class="finding-card low-risk">
          <div class="finding-header">
            <i class="fas fa-check-circle"></i>
            <span>No significant risk factors</span>
          </div>
          <p>No major security concerns detected.</p>
        </div>
      `;
      return;
    }
    
    // Check for SSL/HTTPS findings specifically
    const sslFindings = findings.filter(f => 
      f.text.includes('SSL/TLS certificate validation') || 
      f.text.includes('No HTTPS')
    );
    
    // If we have multiple SSL/HTTPS findings, show them together first
    if (sslFindings.length > 1) {
      sslFindings.forEach(finding => {
        const iconClass = 'fas fa-shield-alt'; // Special icon for security issues
        
        container.innerHTML += `
          <div class="finding-card ssl-security-warning ${finding.severity}-risk">
            <div class="finding-header">
              <i class="${iconClass}"></i>
              <span>${finding.text}</span>
            </div>
            <p>${finding.description ? finding.description.split('.')[0] + '.' : 'Security concern detected.'}</p>
          </div>
        `;
      });
      
      // Adjust the remaining findings to show
      const otherFindings = findings.filter(f => !sslFindings.includes(f));
      const remainingCount = Math.min(3 - sslFindings.length, otherFindings.length);
      
      // Show up to (3 - sslFindings.length) more findings
      if (remainingCount > 0) {
        // Show other high priority findings
        const highRisk = otherFindings.filter(f => f.severity === 'high');
        const mediumRisk = otherFindings.filter(f => f.severity === 'medium');
        const lowRisk = otherFindings.filter(f => f.severity === 'low');
        
        // Combine them with high risk first, then medium, then low
        const prioritizedFindings = [...highRisk, ...mediumRisk, ...lowRisk].slice(0, remainingCount);
        
        // Add these findings to the container
        prioritizedFindings.forEach(finding => {
          const iconClass = finding.severity === 'high' ? 'fas fa-exclamation-triangle' : 
                           finding.severity === 'medium' ? 'fas fa-exclamation-circle' : 
                           'fas fa-info-circle';
          
          container.innerHTML += `
            <div class="finding-card ${finding.severity}-risk">
              <div class="finding-header">
                <i class="${iconClass}"></i>
                <span>${finding.text}</span>
              </div>
              <p>${finding.description ? finding.description.split('.')[0] + '.' : 'Risk factor detected.'}</p>
            </div>
          `;
        });
      }
      
      // If we limited the findings, add a note
      if ((findings.length - sslFindings.length) > remainingCount) {
        container.innerHTML += `
          <div class="more-findings-note">
            <i class="fas fa-plus-circle"></i> 
            <span>${findings.length - sslFindings.length} more findings available in detailed view</span>
          </div>
        `;
      }
    } else {
      // Show up to 3 most important findings (prioritize high risk)
      const highRisk = findings.filter(f => f.severity === 'high');
      const mediumRisk = findings.filter(f => f.severity === 'medium');
      const lowRisk = findings.filter(f => f.severity === 'low');
      
      // Combine them with high risk first, then medium, then low
      const prioritizedFindings = [...highRisk, ...mediumRisk, ...lowRisk].slice(0, 3);
      
      // Add findings to the container
      prioritizedFindings.forEach(finding => {
        const iconClass = finding.severity === 'high' ? 'fas fa-exclamation-triangle' : 
                         finding.severity === 'medium' ? 'fas fa-exclamation-circle' : 
                         'fas fa-info-circle';
        
        container.innerHTML += `
          <div class="finding-card ${finding.severity}-risk">
            <div class="finding-header">
              <i class="${iconClass}"></i>
              <span>${finding.text}</span>
            </div>
            <p>${finding.description ? finding.description.split('.')[0] + '.' : 'Risk factor detected.'}</p>
          </div>
        `;
      });
      
      // If we limited the findings, add a note
      if (findings.length > 3) {
        container.innerHTML += `
          <div class="more-findings-note">
            <i class="fas fa-plus-circle"></i> 
            <span>${findings.length - 3} more findings available in detailed view</span>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('Error displaying key findings:', error);
    container.innerHTML = `
      <div class="finding-card medium-risk">
        <div class="finding-header">
          <i class="fas fa-exclamation-circle"></i>
          <span>Error loading findings</span>
        </div>
        <p>Failed to load key findings. View detailed analysis for more information.</p>
      </div>
    `;
  }
}

function showLoading(elements) {
  const { scoreElement, statusElement, resultContainer, scoreSection, riskExplanation, circleFill, findingsCards } = elements;

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

  if (findingsCards) {
    findingsCards.innerHTML = `
      <div class="finding-placeholder">
        <div class="finding-loader"></div>
      </div>
    `;
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

function showSuccessMessage(message, elements) {
  const { resultContainer } = elements;
  if (!resultContainer) return;

  // Remove any existing success messages to prevent stacking
  const existingMessages = document.querySelectorAll('.success-notification');
  existingMessages.forEach(el => el.remove());

  // Create a dedicated success message element with more visual impact
  const messageElement = document.createElement('div');
  messageElement.className = 'success-notification';
  messageElement.innerHTML = `
    <div class="success-content">
      <div class="success-icon-container">
        <i class="fas fa-check-circle success-icon"></i>
        <div class="success-icon-ripple"></div>
      </div>
      <div class="success-message">
        <p class="success-title">Report Submitted!</p>
        <p>${message}</p>
      </div>
    </div>
  `;

  // Add to the DOM - insert at the top
  if (resultContainer.firstChild) {
    resultContainer.insertBefore(messageElement, resultContainer.firstChild);
  } else {
    resultContainer.appendChild(messageElement);
  }

  // Force browser reflow before animation
  void messageElement.offsetWidth;

  // Add extra class for additional animation
  messageElement.classList.add('show-success');
  
  // Animate in
  setTimeout(() => messageElement.classList.add('visible'), 10);
  
  // Show for longer - 8 seconds
  setTimeout(() => {
    messageElement.classList.add('fade-out');
    setTimeout(() => {
      messageElement.classList.remove('visible');
      // Remove from DOM after animation completes
      setTimeout(() => messageElement.remove(), 500);
    }, 500);
  }, 8000);
  
  // Add a temporary flash effect to the form section
  const formContainer = document.querySelector('.report-section');
  if (formContainer) {
    formContainer.classList.add('success-flash');
    setTimeout(() => {
      formContainer.classList.remove('success-flash');
    }, 1500);
  }
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
    
    /* Login Required Message specific styles */
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
    
    /* Enhanced Success Notification */
    .success-notification {
      background: linear-gradient(135deg, #43a047, #4caf50);
      color: white;
      padding: 0;
      border-radius: 8px;
      margin: 0 auto 15px auto;
      box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
      transform: translateY(-20px) scale(0.95);
      opacity: 0;
      transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), 
                  opacity 0.3s ease;
      overflow: hidden;
      position: relative;
      width: 95%;
      max-width: 100%;
      z-index: 1000;
    }
    
    .success-notification:before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: white;
      opacity: 0.7;
    }
    
    .success-notification.visible {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
    
    .success-notification.show-success {
      animation: success-pop 0.5s ease-out;
    }
    
    @keyframes success-pop {
      0% { transform: translateY(-20px) scale(0.95); opacity: 0; }
      50% { transform: translateY(5px) scale(1.02); opacity: 1; }
      100% { transform: translateY(0) scale(1); opacity: 1; }
    }
    
    .success-notification.fade-out {
      transition: all 0.5s ease-out;
      opacity: 0;
      transform: translateY(0) scale(0.95);
    }
    
    .success-content {
      display: flex;
      padding: 15px;
      align-items: center;
    }
    
    .success-icon-container {
      position: relative;
      width: 45px;
      height: 45px;
      margin-right: 15px;
      flex-shrink: 0;
    }
    
    .success-icon {
      font-size: 2.2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      z-index: 2;
    }
    
    .success-icon-ripple {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      transform: scale(0);
      animation: ripple 2s infinite;
    }
    
    @keyframes ripple {
      0% { transform: scale(0); opacity: 1; }
      100% { transform: scale(2.5); opacity: 0; }
    }
    
    .success-message {
      flex: 1;
    }
    
    .success-title {
      font-weight: bold;
      font-size: 1.2rem;
      margin: 0 0 5px 0;
    }
    
    .success-message p {
      margin: 0;
      padding: 0;
      line-height: 1.4;
    }
    
    /* Flash effect for form container */
    .success-flash {
      animation: flash-green 1.5s;
    }
    
    @keyframes flash-green {
      0% { box-shadow: 0 0 0 rgba(76, 175, 80, 0); }
      20% { box-shadow: 0 0 15px rgba(76, 175, 80, 0.7); }
      100% { box-shadow: 0 0 0 rgba(76, 175, 80, 0); }
    }
    
    /* Animation for the success notification */
    @keyframes pulse-success {
      0% { box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3); }
      50% { box-shadow: 0 4px 25px rgba(76, 175, 80, 0.5); }
      100% { box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3); }
    }
    
    .success-notification.visible {
      animation: pulse-success 2s infinite ease-in-out;
    }
    
    /* Make sure report section has relative positioning for the flash effect */
    .report-section {
      position: relative;
      transition: all 0.3s ease;
    }
    
    /* Redesigned "Already Reported" message to match card theme */
    .already-reported-container {
      background: #212121;
      color: white;
      padding: 12px 15px;
      border-radius: 8px;
      margin: 12px 0;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
      animation: fade-in 0.3s ease-out forwards;
      position: relative;
      overflow: hidden;
      border: 2px solid #1565c0;
    }
    
    @keyframes fade-in {
      0% { opacity: 0; transform: translateY(-10px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    
    .already-reported-content {
      display: flex;
      align-items: center;
    }
    
    .already-reported-icon {
      margin-right: 12px;
      font-size: 1.5rem;
      color: #2196F3;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background-color: rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .already-reported-icon i {
      font-size: 1.2rem;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }
    
    .already-reported-text {
      flex: 1;
    }
    
    .already-reported-text h4 {
      margin: 0 0 5px 0;
      font-size: 1rem;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }
    
    .already-reported-text p {
      margin: 0;
      font-size: 0.9rem;
      opacity: 0.95;
      line-height: 1.4;
    }
    
    .report-id {
      margin-top: 8px !important;
      font-size: 0.8rem !important;
      opacity: 0.9 !important;
      font-family: monospace;
      background: rgba(0, 0, 0, 0.15);
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      border-left: 2px solid rgba(255, 255, 255, 0.5);
    }
  </style>
`);