document.addEventListener('DOMContentLoaded', function() {
    const currentSiteLink = document.getElementById('currentSiteLink');
    const score = document.getElementById('score');
    const riskExplanation = document.getElementById('riskExplanation');
    const checkLinkButton = document.getElementById('checkLink');
    const manualLink = document.getElementById('manualLink');

    // Get the current tab URL
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const tab = tabs[0];
        currentSiteLink.href = tab.url;
        currentSiteLink.textContent = tab.url;

        // Check the site risk score
        checkSite(tab.url, function(riskScore, explanation) {
            score.textContent = riskScore;
            riskExplanation.textContent = explanation;
        });
    });

    // Check link manually
    checkLinkButton.addEventListener('click', function() {
        const url = manualLink.value;
        checkSite(url, function(riskScore, explanation) {
            alert('Risk Score: ' + riskScore + '\n' + explanation);
        });
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
            callback(data.riskScore, data.explanation);
        })
        .catch(error => {
            console.error('Error checking site:', error);
            callback('Error', 'Could not determine risk score.');
        });
    }
});