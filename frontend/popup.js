document.addEventListener('DOMContentLoaded', async () => {
    const toggle = document.getElementById('safeSearchToggle');
    
    // Load initial state
    chrome.storage.sync.get(['safeSearchEnabled'], function(result) {
        toggle.checked = result.safeSearchEnabled !== false;
        updateDiagnosticNote(toggle.checked);
    });

    // Set up toggle handler
    toggle.addEventListener('change', async function(e) {
        const enabled = e.target.checked;
        console.log('Toggle changed:', enabled);
        
        // Save state
        await chrome.storage.sync.set({ safeSearchEnabled: enabled });
        updateDiagnosticNote(enabled);

        // Re-analyze current URL with new settings
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
            await analyzeCurrentUrl(tab.url);
        }
    });

    // Initialize current tab
    initializeCurrentTab();
});

async function analyzeCurrentUrl(url) {
    try {
        const { safeSearchEnabled } = await chrome.storage.sync.get(['safeSearchEnabled']);
        console.log('Analyzing with Safe Browsing:', safeSearchEnabled);

        displayLoading();
        
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
        chrome.storage.local.set({ [url]: result });
        displayResults(result, url);
    } catch (error) {
        console.error('Analysis failed:', error);
        displayError('Analysis failed. Please try again.');
    }
}

function displayResults(result, url) {
    document.getElementById('currentSiteLink').textContent = url;
    
    // Display risk score and source
    let scoreText = `Risk Score: ${result.risk_score}/100`;
    if (result.ml_result?.ml_confidence) {
        scoreText += ` (ML Confidence: ${(result.ml_result.ml_confidence * 100).toFixed(1)}%)`;
    }
    document.getElementById('score').textContent = scoreText;

    // Set status message and class
    document.getElementById('status').textContent = result.message;
    document.getElementById('status').className = getRiskLevelClass(result);

    // Update diagnostic note
    const diagnosticNote = document.querySelector('.diagnostic-note');
    if (diagnosticNote) {
        let message = `Analysis: ${result.source || 'Unknown'}`;
        if (result.threats) {
            message += `\nThreats found: ${result.threats.map(t => t.threat_type).join(', ')}`;
        }
        if (result.ml_result) {
            message += `\nML Analysis: ${result.ml_result.is_phishing ? 'Suspicious' : 'Safe'}`;
        }
        diagnosticNote.textContent = message;
    }
}

function getRiskLevelText(result) {
    if (result.safe_browsing === true) {
        return 'Safe - Verified by Google Safe Browsing';
    }
    if (result.is_phishing) {
        return 'Warning: Potential Phishing Site Detected';
    }
    return result.message || 'Analysis Complete';
}

function getRiskLevelClass(result) {
    if (result.is_phishing) return 'danger';
    if (result.risk_score > 60) return 'warning';
    return 'safe';
}

function updateDiagnosticNote(enabled) {
    const diagnosticNote = document.querySelector('.diagnostic-note');
    if (diagnosticNote) {
        diagnosticNote.textContent = enabled ? 
            'Using both ML and Safe Browsing API' : 
            'Using ML analysis only';
    }
}

function displayLoading() {
    document.getElementById('status').textContent = 'Analyzing...';
    document.getElementById('score').textContent = 'Please wait...';
    document.getElementById('status').className = '';
}

function displayError(message) {
    document.getElementById('status').textContent = message;
    document.getElementById('score').textContent = 'Error';
    document.getElementById('status').className = 'error';
}

async function initializeCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
        document.getElementById('currentSiteLink').textContent = tab.url;
        await analyzeCurrentUrl(tab.url);
    }
}

// Manual URL check handler
document.getElementById('checkLink').addEventListener('click', async () => {
    const manualLink = document.getElementById('manualLink').value;
    if (manualLink) {
        displayLoading();
        await analyzeCurrentUrl(manualLink);
    }
});

// Helper function to validate URLs
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

// Add input validation for manual URL entry
document.getElementById('manualLink').addEventListener('input', function(e) {
    const checkButton = document.getElementById('checkLink');
    checkButton.disabled = !isValidUrl(e.target.value);
});