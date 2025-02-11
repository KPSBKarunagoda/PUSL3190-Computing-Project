chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (!tab.url.startsWith('chrome://')) {
            analyzeUrl(tab.url, tabId);
        }
    }
});

async function analyzeUrl(url, tabId) {
    try {
        // Check if we already have results for this URL
        const stored = await chrome.storage.local.get(url);
        if (stored[url]) {
            console.log('Using cached result for:', url);
            updateBadge(stored[url], tabId);
            return;
        }

        const { safeSearchEnabled } = await chrome.storage.sync.get(['safeSearchEnabled']);
        const response = await fetch('http://localhost:3000/analyze-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                url,
                useSafeBrowsing: safeSearchEnabled 
            })
        });
        
        const result = await response.json();
        // Store result in cache
        await chrome.storage.local.set({ [url]: result });
        updateBadge(result, tabId);
    } catch (error) {
        console.error('Analysis failed:', error);
    }
}

function updateBadge(result, tabId) {
  if (!result) return;
  
  let color, text;
  
  if (result.risk_score <= 20) {
      color = '#00FF00'; // Green
  } else if (result.risk_score <= 60) {
      color = '#FFA500'; // Orange
  } else {
      color = '#FF0000'; // Red
  }
  
  text = result.risk_score.toString();
  
  chrome.action.setBadgeText({ text, tabId });
  chrome.action.setBadgeBackgroundColor({ color, tabId });
}