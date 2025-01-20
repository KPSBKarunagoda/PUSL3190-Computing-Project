chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    console.log(`Tab updated: ${tab.url}`);
    checkSite(tab.url, (riskScore) => {
      console.log(`Checked site: ${tab.url}, Risk Score: ${riskScore}`);
      // If the score is low, open the popup. Adjust conditions as needed.
      if (typeof riskScore === 'number' && riskScore < 50) {
        chrome.windows.getCurrent({ populate: true }, (window) => {
          if (window && window.tabs.some(t => t.id === tabId)) {
            chrome.action.openPopup().catch(error => {
              console.error('Failed to open popup:', error);
            });
          } else {
            console.error('No active browser window found.');
          }
        });
      }
    });
  }
});

function checkSite(url, callback) {
  fetch('http://localhost:3000/check-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url })
  })
  .then(response => response.json())
  .then(data => {
    callback(data.riskScore);
  })
  .catch(error => {
    console.error('Error checking site:', error);
    callback('Error');
  });
}