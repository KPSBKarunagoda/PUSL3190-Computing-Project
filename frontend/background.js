chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      console.log('Checking URL:', tab.url);
      checkSite(tab.url, tabId);
    }
  }
});

function checkSite(url, tabId) {
  // Check if we already have the risk score stored
  chrome.storage.local.get(url, (result) => {
    if (result[url]) {
      console.log('Using cached risk score for:', url);
      updateUI(result[url], tabId);
      // Send message to popup if open
      chrome.runtime.sendMessage({
        type: 'riskScoreUpdate',
        data: result[url]
      });
    } else {
      // Only fetch if we don't have stored data
      fetch('http://localhost:3000/check-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      .then(response => response.json())
      .then(data => {
        // Store the risk score
        const scoreData = {
          riskScore: data.riskScore,
          explanation: data.explanation
        };
        chrome.storage.local.set({ [url]: scoreData });
        updateUI(scoreData, tabId);
        // Send message to popup if open
        chrome.runtime.sendMessage({
          type: 'riskScoreUpdate',
          data: scoreData
        });
      })
      .catch(error => {
        console.error('Error checking site:', error);
        chrome.runtime.sendMessage({
          type: 'error',
          error: 'Failed to check site safety'
        });
      });
    }
  });
}

function updateUI(data, tabId) {
  if (data.riskScore > 50) {
    chrome.action.setBadgeText({ 
      text: '!',
      tabId: tabId 
    });
    chrome.action.setBadgeBackgroundColor({ 
      color: '#FF0000',
      tabId: tabId 
    });
  } else {
    chrome.action.setBadgeText({ 
      text: '',
      tabId: tabId 
    });
  }
}