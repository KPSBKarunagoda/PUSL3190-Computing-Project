document.addEventListener('DOMContentLoaded', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;

    const url = tab.url;
    document.getElementById('currentSiteLink').textContent = url;
    
    // Get stored analysis
    chrome.storage.local.get(url, (result) => {
        if (result[url]) {
            displayResults(result[url], url);
        } else {
            displayLoading();
            analyzeCurrentUrl(url);
        }
    });
});

function displayResults(result, url) {
    document.getElementById('siteLink').textContent = url;
    document.getElementById('score').textContent = `Risk Score: ${result.risk_score}/100`;
    document.getElementById('status').textContent = getRiskLevelText(result);
    document.getElementById('status').className = getRiskLevelClass(result.risk_score);
}

function getRiskLevelText(result) {
    return `Risk Level: ${result.risk_level}\n${result.is_phishing ? 'Potential Phishing Site' : 'Likely Safe'}`;
}

function getRiskLevelClass(score) {
    if (score <= 20) return 'safe';
    if (score <= 60) return 'warning';
    return 'danger';
}

function displayLoading() {
    document.getElementById('score').textContent = 'Analyzing...';
    document.getElementById('status').textContent = 'Please wait while we analyze the site...';
}

async function analyzeCurrentUrl(url) {
    try {
        const response = await fetch('http://localhost:3000/analyze-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });
        
        const result = await response.json();
        chrome.storage.local.set({ [url]: result });
        displayResults(result, url);
    } catch (error) {
        console.error('Analysis failed:', error);
        document.getElementById('status').textContent = 'Analysis failed. Please try again.';
    }
}