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
  
  // Add event listeners for new vote buttons
  if (elements.voteUp) {
    elements.voteUp.addEventListener('click', () => {
      // Add active class for UI feedback
      elements.voteUp.classList.add('active');
      elements.voteDown.classList.remove('active');
      
      // Increment count for visual feedback (no backend integration yet)
      const currentCount = parseInt(elements.upvotes.textContent || '0');
      elements.upvotes.textContent = currentCount + 1;
      
      // Show thank you message
      showMessage('Thank you for your feedback!', elements);
    });
  }
  
  if (elements.voteDown) {
    elements.voteDown.addEventListener('click', () => {
      // Add active class for UI feedback
      elements.voteDown.classList.add('active');
      elements.voteUp.classList.remove('active');
      
      // Increment count for visual feedback (no backend integration yet)
      const currentCount = parseInt(elements.downvotes.textContent || '0');
      elements.downvotes.textContent = currentCount + 1;
      
      // Show thank you message
      showMessage('Thank you for your feedback!', elements);
    });
  }
  
  // Add event listener for report button
  if (elements.reportButton) {
    elements.reportButton.addEventListener('click', () => {
      // Toggle report form visibility
      if (elements.reportForm.style.display === 'none' || !elements.reportForm.style.display) {
        elements.reportForm.style.display = 'flex';
        elements.reportButton.textContent = 'Cancel Report';
        elements.reportButton.style.borderColor = '#808080';
        elements.reportButton.style.color = '#808080';
      } else {
        elements.reportForm.style.display = 'none';
        elements.reportButton.innerHTML = '<i class="fas fa-flag"></i> Report this website';
        elements.reportButton.style.borderColor = '';
        elements.reportButton.style.color = '';
      }
    });
  }
  
  // Add event listener for report submission
  if (elements.submitReport) {
    elements.submitReport.addEventListener('click', () => {
      const reason = elements.reportReason.value;
      
      if (!reason) {
        // Show error if no reason selected
        alert('Please select a reason for your report');
        return;
      }
      
      // Visual feedback for form submission (no backend integration)
      elements.submitReport.disabled = true;
      elements.submitReport.textContent = 'Submitting...';
      
      // Simulate submission delay
      setTimeout(() => {
        // Reset form
        elements.reportForm.style.display = 'none';
        elements.reportButton.innerHTML = '<i class="fas fa-flag"></i> Report this website';
        elements.reportButton.style.borderColor = '';
        elements.reportButton.style.color = '';
        elements.reportReason.value = '';
        
        if (elements.reportComments) {
          elements.reportComments.value = '';
        }
        
        // Re-enable submit button
        elements.submitReport.disabled = false;
        elements.submitReport.textContent = 'Submit Report';
        
        // Show thank you message
        showMessage('Thank you! Your report has been submitted.', elements);
      }, 1000);
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

// Get authentication state
function getAuthState() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getAuthState' }, (response) => {
      resolve(response || { isLoggedIn: false });
    });
  });
}

// Logout function
function logout() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['isLoggedIn', 'authToken', 'userData', 'authTimestamp'], resolve);
  });
}

// Make authenticated API request
function makeAuthenticatedRequest(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
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
}

// The rest of your functions should be updated to accept elements parameter
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

function showResult(result, elements) {
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

  // Add random vote counts for demo purposes
  if (upvotes && downvotes) {
    upvotes.textContent = Math.floor(Math.random() * 30);
    downvotes.textContent = Math.floor(Math.random() * 10);
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

  resultContainer.innerHTML = `
    <div class="message">
      <p>${message}</p>
    </div>
  `;
}