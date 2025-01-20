document.addEventListener('DOMContentLoaded', function() {
    const currentSiteLink = document.getElementById('currentSiteLink');
    const score = document.getElementById('score');
    const riskExplanation = document.getElementById('riskExplanation');
    
    // Get the current tab URL
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const tab = tabs[0];
        currentSiteLink.href = tab.url;
        currentSiteLink.textContent = tab.url;

        // Get stored risk score
        chrome.storage.local.get(tab.url, (result) => {
            if (result[tab.url]) {
                const data = result[tab.url];
                score.textContent = data.riskScore;
                riskExplanation.textContent = data.explanation;
            } else {
                score.textContent = 'Available soon';
                riskExplanation.textContent = 'Please wait, analysis being performed.';
            }
        });
    });
});