document.addEventListener('DOMContentLoaded', async () => {
  // Setup elements and state once, reuse throughout
  const elements = {
    settingsBtn: document.getElementById('settings-btn'),
    settingsDropdown: document.getElementById('settings-dropdown'),
    resultContainer: document.getElementById('result-container'),
    currentSiteLink: document.getElementById('currentSiteLink'),
    scoreElement: document.getElementById('score'),
    statusElement: document.getElementById('status'),
    scoreSection: document.querySelector('.score-section'),
    riskExplanation: document.querySelector('.risk-explanation')
  };

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
    
    // Set up the report link functionality
    const reportLink = document.getElementById('report-link');
    if (reportLink) {
      reportLink.addEventListener('click', (e) => {
        e.preventDefault();
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
    const refreshButton = document.getElementById('refreshAnalysis');
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

// The rest of your functions should be updated to accept elements parameter
function showLoading(elements) {
  const { scoreElement, statusElement, resultContainer, scoreSection, riskExplanation } = elements;

  if (scoreElement) {
    scoreElement.textContent = '...';
    scoreElement.className = '';
  }

  if (statusElement) {
    statusElement.textContent = '';
    statusElement.className = '';
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
  const { scoreElement, statusElement, resultContainer, scoreSection, riskExplanation, currentSiteLink } = elements;

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

  if (scoreElement) {
    scoreElement.textContent = `${displayData.risk_score}/100`;

    if (displayData.is_phishing) {
      scoreElement.className = 'unsafe-score';
    } else if (displayData.risk_score > 30 && displayData.ml_prediction === 1) {
      scoreElement.className = 'warning-score';
    } else {
      scoreElement.className = 'safe-score';
    }
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

function showMessage(message) {
  const resultContainer = document.getElementById('result-container');
  if (!resultContainer) return;

  resultContainer.innerHTML = `
    <div class="message">
      <p>${message}</p>
    </div>
  `;
}