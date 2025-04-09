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
  
  // Use the enhanced setup for vote buttons
  setupVoteButtons(elements);
  
  try {
    // Get current tab
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    
    if (!tabs || tabs.length === 0) {
      throw new Error('No active tab found');
    }
    
    // Process the tab and analyze URL
    await processTab(tabs[0], elements);
    
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
    
    showResult(result, elements);
    
    // Check if the user has already voted for this URL and highlight the appropriate button
    await checkUserVoteForUrl(tab.url, elements);
    
    // Add refresh button functionality
    const refreshButton = elements.refreshBtn;
    if (refreshButton) {
      refreshButton.addEventListener('click', async () => {
        showLoading(elements);
        try {
          const freshResult = await sendMessageWithTimeout(
            { 
              type: 'analyzeNow', 
              url: tab.url,
              useSafeBrowsing: useSafeBrowsing,
              forceRefresh: true // Force reanalysis
            },
            10000
          );
          showResult(freshResult, elements);
        } catch (error) {
          showError(error.message, elements);
        }
      });
    }
  } catch (error) {
    showError(error.message, elements);
  }
}

// Enhanced function to check and display user's previous vote with better error handling
async function checkUserVoteForUrl(url, elements) {
  try {
    // First clear any active state
    elements.voteUp.classList.remove('active');
    elements.voteDown.classList.remove('active');
    
    // Check if user is logged in
    const authState = await getAuthState();
    if (!authState.isLoggedIn) {
      console.log('User not logged in, no vote to highlight');
      return;
    }
    
    // First check local storage for quick UI update
    chrome.storage.local.get(['voteCounts'], (data) => {
      try {
        if (data.voteCounts && data.voteCounts[url]) {
          console.log('Found local vote data for URL:', data.voteCounts[url]);
          updateVoteUI(data.voteCounts[url], elements);
        }
      } catch (err) {
        console.error('Error updating vote UI from storage:', err);
      }
    });
    
    // Make a direct API call for the most up-to-date data - with better error handling
    if (authState.token) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch(`http://localhost:3000/api/votes/counts?url=${encodeURIComponent(url)}`, {
          headers: {
            'x-auth-token': authState.token
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          if (response.status === 401) {
            console.log('Token expired or invalid, logging out');
            await logout();
            return;
          }
          throw new Error(`API error: ${response.status}`);
        }
        
        const voteData = await response.json();
        console.log('Got fresh vote data from API:', voteData);
        
        // Save the fresh data to local storage
        chrome.storage.local.get(['voteCounts'], (storage) => {
          try {
            const voteCounts = storage.voteCounts || {};
            voteCounts[url] = {
              safe: voteData.counts?.safe || 0,
              phishing: voteData.counts?.phishing || 0,
              userVote: voteData.userVote
            };
            chrome.storage.local.set({ voteCounts });
            
            // Now update the UI with the fresh data
            updateVoteUI(voteCounts[url], elements);
          } catch (err) {
            console.error('Error saving vote data to storage:', err);
          }
        });
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('Vote count API request timed out');
        } else {
          console.error('Error fetching vote data from API:', error);
        }
        
        // Don't logout on network errors, only on auth errors
        if (error.message && error.message.includes('401')) {
          console.log('Auth error in vote fetch, logging out');
          await logout();
        }
      }
    }
  } catch (error) {
    console.error('Error checking user vote:', error);
  }
}

// New function to centralize vote UI updates
function updateVoteUI(voteData, elements) {
  if (!voteData) return;
  
  // Update vote counts
  if (elements.upvotes && typeof voteData.safe !== 'undefined') {
    elements.upvotes.textContent = voteData.safe;
  }
  
  if (elements.downvotes && typeof voteData.phishing !== 'undefined') {
    elements.downvotes.textContent = voteData.phishing;
  }
  
  // Highlight appropriate button based on user's vote
  if (voteData.userVote) {
    if (voteData.userVote === 'Safe') {
      elements.voteUp.classList.add('active');
      elements.voteDown.classList.remove('active');
      console.log('Highlighting vote up button');
    } else if (voteData.userVote === 'Phishing') {
      elements.voteDown.classList.add('active');
      elements.voteUp.classList.remove('active');
      console.log('Highlighting vote down button');
    }
  }
}

// Enhanced vote button handler with login prompt and better error handling
async function setupVoteButtons(elements) {
  if (!elements.voteUp || !elements.voteDown) return;
  
  // Track current vote state to prevent multiple votes
  let currentVoteState = null;
  let isVoting = false; // Add a flag to prevent double-clicks
  
  // Get current vote state from storage
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs && tabs.length > 0) {
    const currentUrl = tabs[0].url;
    chrome.storage.local.get(['voteCounts'], (data) => {
      if (data.voteCounts && data.voteCounts[currentUrl]) {
        currentVoteState = data.voteCounts[currentUrl].userVote || null;
      }
    });
  }
  
  elements.voteUp.addEventListener('click', async () => {
    // Prevent rapid clicking
    if (isVoting) return;
    isVoting = true;
    
    try {
      // Double-check if user is logged in with valid token
      const authState = await getAuthState();
      if (!authState.isLoggedIn) {
        showLoginRequiredMessage(elements);
        isVoting = false;
        return;
      }
      
      // Get current tab URL
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0) {
        const currentUrl = tabs[0].url;
        
        // If user already voted Safe, prevent additional clicks
        if (currentVoteState === 'Safe') {
          console.log('User already voted Safe for this URL - ignoring click');
          return;
        }
        
        // Get current vote counts
        const safeCount = parseInt(elements.upvotes.textContent || '0');
        const phishingCount = parseInt(elements.downvotes.textContent || '0');
        
        // Calculate new counts based on previous vote state
        let newSafeCount = safeCount + 1;
        let newPhishingCount = phishingCount;
        
        // If user had previously voted "Phishing", reduce that count
        if (currentVoteState === 'Phishing') {
          newPhishingCount = Math.max(0, phishingCount - 1);
        }
        
        // Update vote state
        currentVoteState = 'Safe';
        
        // Add visual feedback immediately
        elements.voteUp.classList.add('active');
        elements.voteDown.classList.remove('active');
        
        // Update UI with corrected counts
        elements.upvotes.textContent = newSafeCount;
        elements.downvotes.textContent = newPhishingCount;
        
        // Show thank you message
        showMessage('Thank you for your feedback! You marked this site as safe.', elements);
        
        // Save optimistic update to local storage for immediate persistence
        chrome.storage.local.get(['voteCounts'], (data) => {
          const voteCounts = data.voteCounts || {};
          voteCounts[currentUrl] = {
            safe: newSafeCount,
            phishing: newPhishingCount,
            userVote: 'Safe'
          };
          chrome.storage.local.set({ voteCounts });
        });
        
        // Send the vote securely
        chrome.runtime.sendMessage({
          action: 'voteNoResponse',
          url: currentUrl,
          voteType: 'Safe'
        });
      }
    } catch (error) {
      console.error('Error handling upvote:', error);
      showMessage('Error recording vote. Please try again.', elements);
    } finally {
      // Re-enable voting after a short delay
      setTimeout(() => {
        isVoting = false;
      }, 1000);
    }
  });
  
  elements.voteDown.addEventListener('click', async () => {
    // Prevent rapid clicking
    if (isVoting) return;
    isVoting = true;
    
    try {
      // Double-check if user is logged in with valid token
      const authState = await getAuthState();
      if (!authState.isLoggedIn) {
        showLoginRequiredMessage(elements);
        isVoting = false;
        return;
      }
      
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0) {
        const currentUrl = tabs[0].url;
        
        // If user already voted Phishing, prevent additional clicks
        if (currentVoteState === 'Phishing') {
          console.log('User already voted Phishing for this URL - ignoring click');
          return;
        }
        
        // Get current vote counts
        const safeCount = parseInt(elements.upvotes.textContent || '0');
        const phishingCount = parseInt(elements.downvotes.textContent || '0');
        
        // Calculate new counts based on previous vote state
        let newSafeCount = safeCount;
        let newPhishingCount = phishingCount + 1;
        
        // If user had previously voted "Safe", reduce that count
        if (currentVoteState === 'Safe') {
          newSafeCount = Math.max(0, safeCount - 1);
        }
        
        // Update vote state
        currentVoteState = 'Phishing';
        
        // Add visual feedback immediately
        elements.voteDown.classList.add('active');
        elements.voteUp.classList.remove('active');
        
        // Update UI optimistically
        elements.upvotes.textContent = newSafeCount;
        elements.downvotes.textContent = newPhishingCount;
        
        // Show thank you message
        showMessage('Thank you for your feedback! You marked this site as suspicious.', elements);
        
        // Save optimistic update to local storage for immediate persistence
        chrome.storage.local.get(['voteCounts'], (data) => {
          const voteCounts = data.voteCounts || {};
          voteCounts[currentUrl] = {
            safe: newSafeCount,
            phishing: newPhishingCount,
            userVote: 'Phishing'
          };
          chrome.storage.local.set({ voteCounts });
        });
        
        // Send the vote securely
        chrome.runtime.sendMessage({
          action: 'voteNoResponse',
          url: currentUrl,
          voteType: 'Phishing'
        });
      }
    } catch (error) {
      console.error('Error handling downvote:', error);
      showMessage('Error recording vote. Please try again.', elements);
    } finally {
      // Re-enable voting after a short delay
      setTimeout(() => {
        isVoting = false;
      }, 1000);
    }
  });
}

// Special function for login-required message with action button
function showLoginRequiredMessage(elements) {
  const { resultContainer } = elements;
  if (!resultContainer) return;

  // Remove any existing login messages to prevent duplicates
  const existingMessages = resultContainer.querySelectorAll('.login-required-message');
  existingMessages.forEach(el => el.remove());

  // Create a dedicated message element that's more noticeable
  const messageElement = document.createElement('div');
  messageElement.className = 'login-required-message notification-message';
  messageElement.innerHTML = `
    <div class="message-content">
      <i class="fas fa-lock message-icon"></i>
      <div class="login-message-text">
        <p><strong>Login Required</strong></p>
        <p>You need to be logged in to vote on websites.</p>
      </div>
    </div>
    <button class="login-now-btn">Log in now</button>
  `;

  // Add to the DOM at the top
  if (resultContainer.firstChild) {
    resultContainer.insertBefore(messageElement, resultContainer.firstChild);
  } else {
    resultContainer.appendChild(messageElement);
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
  
  // Auto-remove after a longer period (8 seconds since it has a button)
  setTimeout(() => {
    messageElement.classList.remove('visible');
    // Remove from DOM after animation completes
    setTimeout(() => messageElement.remove(), 500);
  }, 8000);
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
    chrome.runtime.sendMessage({ action: 'logout' }, (response) => {
      // Reset UI after logout
      document.querySelectorAll('.vote-button').forEach(btn => {
        btn.classList.remove('active');
      });
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
        // Then verify with background in parallel but don't block
        chrome.runtime.sendMessage({ action: 'getAuthState' }).catch(err => {
          console.log('Background validation will happen asynchronously');
        });
        
        resolve({
          isLoggedIn: true,
          token: data.authToken,
          userData: data.userData
        });
        return;
      }
      
      // If no local data or not logged in, check with background script
      chrome.runtime.sendMessage({ action: 'getAuthState' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error getting auth state:', chrome.runtime.lastError);
          resolve({ isLoggedIn: false });
          return;
        }
        
        // Handle invalid states
        if (response && response.isLoggedIn && !response.token) {
          console.error('Invalid auth state: logged in but no token');
          logout().then(() => resolve({ isLoggedIn: false }));
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

// Replace the vote count retrieval in showResult with the centralized updateVoteUI function
async function showResult(result, elements) {
  const { scoreElement, statusElement, resultContainer, scoreSection, riskExplanation, currentSiteLink, upvotes, downvotes, circleFill } = elements;

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

  // Get vote counts from local storage first, then request fresh data
  if (elements.upvotes && elements.downvotes) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0) {
        const currentUrl = tabs[0].url;
        
        // Get vote counts from local storage for immediate display
        chrome.storage.local.get(['voteCounts'], (data) => {
          const voteCounts = data.voteCounts || {};
          if (voteCounts[currentUrl]) {
            updateVoteUI(voteCounts[currentUrl], elements);
          }
        });
        
        // Always request fresh counts from API via background script
        chrome.runtime.sendMessage({
          action: 'getVoteCountsNoResponse',
          url: currentUrl
        });
      }
    } catch (error) {
      console.error('Error getting vote counts:', error);
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
  <style|
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
      background-color: #2196F3;
      display: flex;
      flex-direction: column;
      padding: 15px;
    }
    
    .login-message-text {
      display: flex;
      flex-direction: column;
    }
    
    .login-message-text p:first-child {
      margin-bottom: 5px;
    }
    
    .login-message-text p:last-child {
      font-weight: 400;
      font-size: 0.9rem;
      opacity: 0.9;
    }
    
    .login-now-btn {
      margin-top: 10px;
      align-self: flex-end;
      background-color: white;
      color: #2196F3;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .login-now-btn:hover {
      background-color: #f5f5f5;
      transform: translateY(-2px);
    }
  </style>
`);