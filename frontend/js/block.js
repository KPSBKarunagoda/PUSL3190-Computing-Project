document.addEventListener('DOMContentLoaded', function() {
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const blockedUrl = urlParams.get('url');
  const riskScore = urlParams.get('score') || 0;
  const blacklistId = urlParams.get('blacklist_id');
  
  // Display blocked URL
  const urlElement = document.getElementById('blocked-url');
  if (urlElement) {
    urlElement.textContent = blockedUrl || 'Unknown URL';
  }
  
  // Set risk score and animate risk bar
  const scoreElement = document.getElementById('risk-score');
  const barElement = document.getElementById('risk-bar');
  
  if (scoreElement) {
    scoreElement.textContent = `${riskScore}%`;
  }
  
  if (barElement) {
    setTimeout(() => {
      barElement.style.width = `${riskScore}%`;
    }, 100);
  }
  
  // Set up back button
  document.getElementById('back-button').addEventListener('click', () => {
    window.history.back();
  });
  
  // Set up proceed button
  document.getElementById('proceed-button').addEventListener('click', () => {
    if (confirm('Warning: You are about to visit a potentially dangerous website. Are you sure you want to continue?')) {
      // Send message to background script to allow this URL temporarily
      chrome.runtime.sendMessage({
        action: 'allowUrl',
        url: blockedUrl
      }, () => {
        // Navigate to the URL directly
        window.location.href = blockedUrl;
      });
    }
  });

  // Report error button
  document.getElementById('report-error').addEventListener('click', () => {
    chrome.runtime.sendMessage({
      action: 'reportBlockError',
      url: blockedUrl,
      score: riskScore
    });
    alert('Thank you for your feedback. Our team will review this site.');
  });

  // Load key findings about why the site was blocked
  loadKeyFindings(blockedUrl, blacklistId, riskScore);
});

async function loadKeyFindings(url, blacklistId, riskScore) {
  const findingsContainer = document.getElementById('key-findings');
  
  try {
    // Fetch key findings from the background script
    const findings = await new Promise(resolve => {
      chrome.runtime.sendMessage(
        { action: 'getKeyFindings', url, blacklistId, score: riskScore },
        response => resolve(response.findings || [])
      );
    });
    
    // Clear loading indicator
    findingsContainer.innerHTML = '';
    
    if (!findings || findings.length === 0) {
      // Create default findings based on risk score
      if (riskScore > 75) {
        findingsContainer.innerHTML = `
          <div class="finding-item high">
            <div class="finding-title high">
              <i class="fas fa-exclamation-triangle"></i>
              High risk score detected
            </div>
            <div class="finding-description">
              This site has a very high risk score of ${riskScore}%, indicating it is likely to be a phishing website designed to steal your information.
            </div>
          </div>
          <div class="finding-item medium">
            <div class="finding-title medium">
              <i class="fas fa-shield-alt"></i>
              Automatic protection enabled
            </div>
            <div class="finding-description">
              PhishGuard has automatically protected you by blocking this dangerous site.
            </div>
          </div>
        `;
      } else {
        findingsContainer.innerHTML = `
          <div class="finding-item medium">
            <div class="finding-title medium">
              <i class="fas fa-exclamation-circle"></i>
              Suspicious website detected
            </div>
            <div class="finding-description">
              This site has a risk score of ${riskScore}%, which exceeds our safety threshold. It may be attempting to impersonate a legitimate website.
            </div>
          </div>
        `;
      }
      return;
    }
    
    // Sort findings by severity (high -> medium -> low)
    const sortedFindings = [...findings].sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      const aSeverity = a.severity || 'medium';
      const bSeverity = b.severity || 'medium';
      
      return severityOrder[aSeverity] - severityOrder[bSeverity];
    });
    
    // Display the sorted findings
    sortedFindings.forEach(finding => {
      const severityClass = finding.severity || 'medium';
      
      const iconClass = severityClass === 'high' ? 'exclamation-triangle' :
                      severityClass === 'low' ? 'info-circle' : 'exclamation-circle';
      
      const findingDiv = document.createElement('div');
      findingDiv.className = `finding-item ${severityClass}`;
      
      findingDiv.innerHTML = `
        <div class="finding-title ${severityClass}">
          <i class="fas fa-${iconClass}"></i>
          ${escapeHtml(finding.text || 'Potential security issue')}
        </div>
        <div class="finding-description">
          ${escapeHtml(finding.description || 'No additional details available.')}
        </div>
      `;
      
      findingsContainer.appendChild(findingDiv);
    });
    
  } catch (error) {
    console.error('Error loading key findings:', error);
    findingsContainer.innerHTML = `
      <div class="finding-item medium">
        <div class="finding-title medium">
          <i class="fas fa-exclamation-circle"></i>
          Security concerns detected
        </div>
        <div class="finding-description">
          This website has been blocked due to security concerns. Risk score: ${riskScore}%
        </div>
      </div>
    `;
  }
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
