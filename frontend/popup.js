document.addEventListener('DOMContentLoaded', async () => {
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
    url: result.url || ''
  };

  console.log('Display data:', displayData);

  // 1. Update the risk score in the Site Risk Score section
  const scoreElement = document.getElementById('score');
  if (scoreElement) {
    // Just show the actual score in the score section
    scoreElement.textContent = `${displayData.risk_score}/100`;
    scoreElement.className = displayData.is_phishing ? 'unsafe-score' : 'safe-score';
  }
  
  // 2. Update the explanation in the Risk Explanation section
  const statusElement = document.getElementById('status');
  if (statusElement) {
    // Just show the risk explanation in the status section
    statusElement.textContent = displayData.risk_explanation;
    statusElement.className = displayData.is_phishing ? 'unsafe-status' : 'safe-status';
    
    // Add a visual indicator of safe/unsafe
    const indicator = displayData.is_phishing ? '⚠️ Warning: ' : '✅ Safe: ';
    statusElement.textContent = indicator + statusElement.textContent;
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