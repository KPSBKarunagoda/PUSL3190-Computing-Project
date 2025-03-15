let analyzedURLs = {};

// Listen for tab updates to analyze URLs automatically
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    console.log('Tab updated, analyzing URL:', tab.url);
    analyzeURL(tab.url)
      .then(result => {
        console.log('Analysis complete for tab update:', result);
        // Store results in local storage using URL as key
        chrome.storage.local.set({
          [`analysis_${tab.url}`]: {
            result,
            timestamp: Date.now()
          }
        });
      })
      .catch(error => {
        console.error('Analysis failed for tab update:', error);
        chrome.storage.local.set({
          [`analysis_${tab.url}`]: {
            error: error.message,
            timestamp: Date.now()
          }
        });
      });
  }
});

// THIS IS THE CRITICAL PART - listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  if (message.type === 'analyzeNow') {
    // Verify URL is valid
    if (!message.url || !message.url.startsWith('http')) {
      console.log('Skipping invalid URL:', message.url);
      sendResponse({error: 'Cannot analyze non-HTTP URLs'});
      return true;
    }
    
    // Handle URL analysis (use cache or fetch)
    const cacheKey = message.url;
    
    // Check cache first (5 minute expiration)
    if (analyzedURLs[cacheKey] && 
        (Date.now() - analyzedURLs[cacheKey].timestamp < 5 * 60 * 1000)) {
      console.log('Using cached result for:', message.url);
      sendResponse(analyzedURLs[cacheKey].result);
      return true;
    }
    
    // Fetch fresh analysis
    console.log('Fetching fresh analysis for:', message.url);
    
    fetch('http://localhost:3000/analyze-url', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({url: message.url})
    })
    .then(response => response.json())
    .then(result => {
      console.log('Analysis result:', result);
      
      // Cache result
      analyzedURLs[cacheKey] = {
        result,
        timestamp: Date.now()
      };
      
      sendResponse(result);
    })
    .catch(error => {
      console.error('Analysis error:', error);
      sendResponse({error: error.message});
    });
    
    return true; // Keep message port open
  }
});

// Separate function to handle async work
function handleAnalysisRequest(message, sendResponse) {
  const url = message.url;
  const cacheKey = url;
  
  // Check cache first for quick response
  if (analyzedURLs[cacheKey] && 
      Date.now() - analyzedURLs[cacheKey].timestamp < 60000) {
    console.log('Using cached result for:', url);
    sendResponse(analyzedURLs[cacheKey].result);
    return;
  }

  console.log('Fetching fresh analysis for:', url);
  
  // Make the network request
  fetch('http://localhost:3000/analyze-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }
    return response.json();
  })
  .then(result => {
    console.log('Analysis result:', result);
    
    // Cache the result
    analyzedURLs[cacheKey] = {
      result,
      timestamp: Date.now()
    };
    
    // Send response back to popup
    sendResponse(result);
  })
  .catch(error => {
    console.error('Analysis error:', error);
    sendResponse({ error: error.message });
  });
}

async function analyzeURL(url, useSafeBrowsing = true) {
  console.log(`Starting analysis for: ${url} (Safe Browsing: ${useSafeBrowsing})`);
  
  try {
    if (!url.startsWith('http')) {
      return { 
        status: 'skipped', 
        is_phishing: false,
        risk_score: 0,
        risk_explanation: 'Internal browser page - analysis skipped',
        features: {}
      };
    }
    
    const response = await fetch('http://localhost:3000/analyze-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, useSafeBrowsing })
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Analysis result received:', result);
    
    // Cache the result with a key specific to URL and safe browsing flag
    const cacheKey = `${url}_${useSafeBrowsing}`;
    analyzedURLs[cacheKey] = { result, timestamp: Date.now() };
    
    return result;
  } catch (error) {
    console.error('Analysis error:', error);
    throw error;
  }
}

// Optionally clear cache periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  Object.keys(analyzedURLs).forEach(key => {
    if (now - analyzedURLs[key].timestamp > 5 * 60 * 1000) {
      delete analyzedURLs[key];
    }
  });
}, 5 * 60 * 1000);