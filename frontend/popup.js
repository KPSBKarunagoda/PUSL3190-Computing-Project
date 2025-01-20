document.addEventListener('DOMContentLoaded', function() {
    const currentSiteLink = document.getElementById('currentSiteLink');
    const score = document.getElementById('score');
    const riskExplanation = document.getElementById('riskExplanation');
    
    // Listen for score updates
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'riskScoreUpdate') {
            updateScore(message.data);
        }
    });

    function updateScore(data) {
        score.textContent = data.riskScore;
        if (data.riskScore < 30) {
            score.style.color = '#28a745'; // Green for safe
        } else if (data.riskScore >= 30 && data.riskScore <= 70) {
            score.style.color = '#ffc107'; // Yellow for medium risk
        } else {
            score.style.color = '#dc3545'; // Red for high risk
        }
        riskExplanation.textContent = data.explanation;
    }
    
    function checkForUpdates() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const tab = tabs[0];
            if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
                chrome.storage.local.get(tab.url, (result) => {
                    if (result[tab.url]) {
                        updateScore(result[tab.url]);
                    }
                });
            }
        });
    }

    // Initial setup
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const tab = tabs[0];
        currentSiteLink.href = tab.url;
        currentSiteLink.textContent = tab.url;

        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            score.textContent = 'This site is safe';
            score.style.color = '#28a745';
            riskExplanation.textContent = 'Risk analysis is not performed on Chrome system pages.';
            return;
        }

        chrome.storage.local.get(tab.url, (result) => {
            if (result[tab.url]) {
                updateScore(result[tab.url]);
            } else {
                score.textContent = 'Analysis in Progress';
                score.style.color = '#6c757d';
                riskExplanation.textContent = 'The risk score is being calculated. Please wait a moment.';
            }
        });
    });

    // Poll for updates every 500ms while popup is open
    const updateInterval = setInterval(checkForUpdates, 500);

    // Cleanup interval when popup closes
    window.addEventListener('unload', () => {
        clearInterval(updateInterval);
    });
});