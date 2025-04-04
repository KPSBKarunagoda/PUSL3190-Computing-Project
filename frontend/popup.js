document.addEventListener('DOMContentLoaded', async () => {
  // Setup settings dropdown
  const settingsBtn = document.getElementById('settings-btn');
  const settingsDropdown = document.getElementById('settings-dropdown');
  
  if (settingsBtn && settingsDropdown) {
    // Toggle dropdown when settings button is clicked
    settingsBtn.addEventListener('click', () => {
      settingsDropdown.classList.toggle('active');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
      if (!event.target.closest('#settings-btn') && !event.target.closest('#settings-dropdown')) {
        settingsDropdown.classList.remove('active');
      }
    });
    
    // Update links with the base URL - FIXED PATH
    const baseUrl = 'http://localhost:3000'; // Change to actual domain in production
    const loginLink = settingsDropdown.querySelector('a[href="login.html"]');
    if (loginLink) {
      // Changed from frontend/login.html to just login.html since the server now handles static files
      loginLink.href = `${baseUrl}/login.html`;
    }
    
    // Set up the report link functionality (disabled for now)
    const reportLink = document.getElementById('report-link');
    if (reportLink) {
      reportLink.addEventListener('click', (e) => {
        e.preventDefault();
        // Display a message that this functionality is coming soon
        showMessage("Reporting functionality will be available soon.");
      });
    }
  }
  
  try {
    // Get current tab
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    
    if (!tabs || tabs.length === 0) {
      throw new Error('No active tab found');
    }
    
    const tab = tabs[0];
    console.log('Current tab URL:', tab.url);
    
    // Skip internal browser pages
    if (!tab.url || tab.url.startsWith('chrome:') || tab.url.startsWith('chrome-extension:')) {
      showError('Cannot analyze browser internal pages');
      return;
    }
    
    // Update URL display
    const currentSiteLink = document.getElementById('currentSiteLink');
    if (currentSiteLink) {
      currentSiteLink.textContent = tab.url;
      currentSiteLink.href = tab.url;
    }
    
    showLoading();
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
      
      showResult(result);
      
      // Add refresh button functionality
      const refreshButton = document.getElementById('refreshAnalysis');
      if (refreshButton) {
        refreshButton.addEventListener('click', async () => {
          showLoading();
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
            showResult(freshResult);
          } catch (error) {
            showError(error.message);
          }
        });
      }
      
    } catch (error) {
      showError(error.message);
    }
    
  } catch (error) {
    console.error('Popup error:', error);
    showError(error.message);
  }
  
  // Rest of your setup functions...
});

// Helper function to send message with timeout
function sendMessageWithTimeout(message, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Analysis timed out after ' + timeout/1000 + ' seconds.'));
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

function setupSafeSearchToggle() {
  const toggle = document.getElementById('safeSearchToggle');
  if (!toggle) return;
  
  chrome.storage.sync.get(['safeSearchEnabled'], function(result) {
    toggle.checked = result.safeSearchEnabled !== false;
    updateDiagnosticNote(toggle.checked);
  });
  
  toggle.addEventListener('change', async function(e) {
    const enabled = e.target.checked;
    await chrome.storage.sync.set({ safeSearchEnabled: enabled });
    updateDiagnosticNote(enabled);
    
    // Re-analyze with new setting
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      showLoading();
      chrome.runtime.sendMessage({ 
        type: 'analyze', 
        url: tab.url,
        useSafeBrowsing: enabled
      }, response => {
        if (response?.error) {
          showError(response.error);
        } else {
          showResult(response);
        }
      });
    }
  });
}

function updateDiagnosticNote(enabled) {
  const diagnosticNote = document.querySelector('.diagnostic-note');
  if (diagnosticNote) {
    diagnosticNote.textContent = enabled ? 
      'Using both ML and Safe Browsing API' : 
      'Using ML analysis only';
  }
}

function showLoading() {
  // Update score to show loading state
  const scoreElement = document.getElementById('score');
  if (scoreElement) {
    scoreElement.textContent = '...';
    scoreElement.className = '';
  }
  
  // Update status to show loading state
  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.textContent = '';
    statusElement.className = '';
  }
  
  // Just show a spinner in the result container without text
  const resultContainer = document.getElementById('result-container');
  if (resultContainer) {
    resultContainer.innerHTML = `
      <div class="analyzing">
        <div class="spinner"></div>
      </div>
    `;
  }
  
  // Reset section styling
  const scoreSection = document.querySelector('.score-section');
  if (scoreSection) {
    scoreSection.className = 'score-section';
  }
  
  const riskExplanation = document.querySelector('.risk-explanation');
  if (riskExplanation) {
    riskExplanation.className = 'risk-explanation';
  }
}

function showResult(result) {
  console.log('Processing result:', result);
  
  // Extract data with defaults
  const displayData = {
    risk_score: Number(result.risk_score) || 0,
    is_phishing: Boolean(result.is_phishing),
    risk_explanation: result.risk_explanation || 'No detailed explanation available',
    features: result.features || {},
    url: result.url || '',
    ml_prediction: result.ml_result?.prediction || 0
  };

  console.log('Display data:', displayData);

  // 1. Update the risk score in the Site Risk Score section
  const scoreElement = document.getElementById('score');
  if (scoreElement) {
    // Just show the actual score in the score section
    scoreElement.textContent = `${displayData.risk_score}/100`;
    
    // Update class based on new criteria
    if (displayData.is_phishing) {
      scoreElement.className = 'unsafe-score';
    } else if (displayData.risk_score > 30 && displayData.ml_prediction === 1) {
      scoreElement.className = 'warning-score';
    } else {
      scoreElement.className = 'safe-score';
    }
  }
  
  // 2. Update the explanation in the Risk Explanation section
  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.textContent = displayData.risk_explanation;
    
    // Add a visual indicator based on new criteria
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
  
  // 3. Add colored backgrounds to the sections
  const scoreSection = document.querySelector('.score-section');
  if (scoreSection) {
    scoreSection.className = `score-section ${displayData.is_phishing ? 'unsafe' : 'safe'}`;
  }
  
  const riskExplanation = document.querySelector('.risk-explanation');
  if (riskExplanation) {
    riskExplanation.className = `risk-explanation ${displayData.is_phishing ? 'unsafe' : 'safe'}`;
  }

  // 4. Update the URL link
  const currentUrlLink = document.getElementById('currentSiteLink');
  if (currentUrlLink) {
    currentUrlLink.textContent = displayData.url;
    currentUrlLink.href = displayData.url;
  }
  
  // 5. IMPORTANT: Clear the result-container to remove spinner
  const resultContainer = document.getElementById('result-container');
  if (resultContainer) {
    // Only add features if we have them, otherwise clear the container
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
      resultContainer.innerHTML = ''; // Clear container if no features
    }
  }

  // Add additional educational content when site is flagged as risky
  if (displayData.is_phishing || displayData.risk_score > 30 || isIpAddressUrl(displayData.url)) {
    // Make API call to get educational content from server
    fetchFeatureExplanations(displayData);
  }
}

/**
 * Check if a URL is an IP address
 */
function isIpAddressUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    return ipPattern.test(hostname);
  } catch (e) {
    return false;
  }
}

/**
 * Fetch feature explanations from the server
 */
async function fetchFeatureExplanations(displayData) {
  try {
    // Check if the URL is an IP address before making the API call
    const isIpAddress = isIpAddressUrl(displayData.url);
    
    // If it's an IP address, make sure the domain_in_ip feature is set
    if (isIpAddress && displayData.features) {
      displayData.features.domain_in_ip = 1;
    }
    
    const response = await fetch('http://localhost:3000/api/education/features', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        analysisResult: displayData
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch feature explanations');
    }
    
    const data = await response.json();
    
    // Create or update the educational section
    updateEducationalSection(displayData, data.html, isIpAddress);
    
  } catch (error) {
    console.error('Error fetching feature explanations:', error);
    
    // Use client-side ML Feature Explainer as fallback
    const mlExplainer = new MLFeatureExplainer();
    const explanationHtml = mlExplainer.generateHTML(displayData.features, displayData.url);
    
    // Update educational section with client-generated content
    updateEducationalSection(displayData, explanationHtml, isIpAddressUrl(displayData.url));
  }
}

/**
 * Update the educational section with the provided content
 */
function updateEducationalSection(displayData, htmlContent, isIpAddress) {
  let educationalSection = document.querySelector('.education-section');
  const manualEntrySection = document.querySelector('.manual-entry');
  
  if (!educationalSection) {
    educationalSection = document.createElement('section');
    educationalSection.className = 'education-section';
    
    // Add it after the result container
    const resultContainer = document.getElementById('result-container');
    resultContainer.parentNode.insertBefore(educationalSection, resultContainer.nextSibling);
  }
  
  // Special title for IP addresses
  const title = isIpAddress ? 
    "Why Are IP Address URLs Dangerous?" : 
    "Why Was This Flagged?";
  
  // Add detailed education for IP addresses
  const ipAddressWarning = isIpAddress ? 
    "<p style='color:#f44336;font-weight:bold;'>This website uses a raw IP address instead of a domain name. This is a major red flag for phishing attempts.</p>" : 
    "";
  
  educationalSection.innerHTML = `
    <h3>${title}</h3>
    <div class="education-content-popup">
      ${ipAddressWarning}
      <p>${displayData.risk_explanation}</p>
      <div id="detailed-reasons">
        <p>Key factors:</p>
        <ul>
          ${htmlContent}
        </ul>
      </div>
      <p><strong>Tip:</strong> Always verify the URL before entering sensitive information.</p>
    </div>
  `;
  
  // Move the educational section above "Check Links Manually" if this is a phishing site
  if (displayData.is_phishing || displayData.risk_score > 60 || isIpAddress) {
    // Add transitional styles for smooth movement
    educationalSection.style.transition = 'opacity 0.3s ease-out';
    educationalSection.style.opacity = '0';
    
    // Remove from current position
    educationalSection.parentNode.removeChild(educationalSection);
    
    // Insert before the manual entry section
    manualEntrySection.parentNode.insertBefore(educationalSection, manualEntrySection);
    
    // Add highlight effect
    educationalSection.style.border = '1px solid var(--warning-color)';
    
    // Fade in after repositioning
    setTimeout(() => {
      educationalSection.style.opacity = '1';
    }, 50);
  }
}

function showError(message) {
  console.error("Error in popup:", message);
  const resultContainer = document.getElementById('result-container');
  if (!resultContainer) return;
  
  resultContainer.innerHTML = `
    <div class="error">
      <p>Error: ${message}</p>
    </div>
  `;
}

function getRiskClass(score) {
  if (score < 30) return 'safe';
  if (score < 70) return 'medium';
  return 'high';
}

// Add this new function to show general messages
function showMessage(message) {
  const resultContainer = document.getElementById('result-container');
  if (!resultContainer) return;
  
  resultContainer.innerHTML = `
    <div class="message">
      <p>${message}</p>
    </div>
  `;
}

// Add this function to help with debugging
function logStoredAnalysisResults() {
  chrome.storage.local.get(null, function(items) {
    console.log('All stored analyses:', items);
    
    // Find analysis for current URL
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs.length > 0) {
        const currentUrl = tabs[0].url;
        const key = `analysis_${currentUrl}`;
        console.log('Current URL:', currentUrl);
        console.log('Analysis for current URL:', items[key]);
      }
    });
  });
}

// Update your message handler to use the enhanced cache
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  if (message.type === 'analyzeNow') {
    // Skip internal pages
    if (!message.url.startsWith('http')) {
      sendResponse({error: 'Cannot analyze browser internal pages'});
      return true;
    }
    
    // Check in-memory cache first
    const cacheKey = message.url;
    if (!message.forceRefresh && analyzedURLs[cacheKey] && 
        (Date.now() - analyzedURLs[cacheKey].timestamp < CACHE_EXPIRY)) {
      console.log('Using cached result for:', message.url);
      sendResponse(analyzedURLs[cacheKey].result);
      return true;
    }
    
    // If not in memory, try Chrome storage
    if (!message.forceRefresh) {
      const domain = new URL(message.url).hostname;
      const storageKey = `analysis_${domain}`;
      
      chrome.storage.local.get([storageKey], function(data) {
        const domainCache = data[storageKey] || {};
        
        if (domainCache[message.url] && 
            (Date.now() - domainCache[message.url].timestamp < CACHE_EXPIRY)) {
          console.log('Using storage cached result for:', message.url);
          
          // Also update in-memory cache
          analyzedURLs[cacheKey] = domainCache[message.url];
          
          sendResponse(domainCache[message.url].result);
          return;
        }
        
        // Not in storage cache either, perform fresh analysis
        performFreshAnalysis();
      });
      
      return true;
    } else {
      // Force refresh requested
      performFreshAnalysis();
      return true;
    }
    
    function performFreshAnalysis() {
      analyzeURL(message.url, message.useSafeBrowsing)
        .then(result => {
          // Cache the new result in memory
          analyzedURLs[cacheKey] = {
            result,
            timestamp: Date.now()
          };
          
          // Also cache in Chrome storage
          const domain = new URL(message.url).hostname;
          const storageKey = `analysis_${domain}`;
          
          chrome.storage.local.get([storageKey], function(data) {
            const domainCache = data[storageKey] || {};
            domainCache[message.url] = {
              result: result,
              timestamp: Date.now()
            };
            
            // Store back to Chrome storage
            chrome.storage.local.set({ [storageKey]: domainCache });
          });
          
          console.log('Fresh analysis complete:', result);
          sendResponse(result);
        })
        .catch(error => {
          console.error('Analysis error:', error);
          sendResponse({error: error.message});
        });
    }
  }
  
  return true; // Keep message port open
});