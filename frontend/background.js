chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
      if (!tab.url.startsWith('chrome://')) {
          analyzeUrl(tab.url, tabId);
      }
  }
});

async function analyzeUrl(url, tabId) {
  try {
      const response = await fetch('http://localhost:3000/analyze-url', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url })
      });
      
      const result = await response.json();
      console.log('Analysis result:', result);
      
      // Store result
      chrome.storage.local.set({ [url]: result });
      
      // Update badge
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