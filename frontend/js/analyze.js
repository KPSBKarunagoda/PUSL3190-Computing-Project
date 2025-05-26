/**
 * URL Analysis Module - Handles URL submission, phishing detection API requests,
 * and visualization of key analysis results with risk scoring.
 */
document.addEventListener('DOMContentLoaded', function() {
  // Check auth status on page load
  const token = localStorage.getItem('phishguardToken');
  if (token) {
    console.log('User is authenticated, activity will be recorded');
  } else {
    console.log('User not authenticated, activity will not be recorded');
  }
  
  // Check if user is logged in
  const isLoggedIn = !!localStorage.getItem('phishguardToken');
  
  // Get form element and add submit handler
  const analyzeForm = document.getElementById('analyze-form');
  if (analyzeForm) {
    analyzeForm.addEventListener('submit', function(e) {
      e.preventDefault();
      analyzeUrl();
    });
  }
  
  // URL Analysis function
  async function analyzeUrl() {
    const urlInput = document.getElementById('url-input');
    const resultContainer = document.getElementById('result-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultContent = document.getElementById('result-content');
    
    if (!urlInput || !urlInput.value) {
      showError('Please enter a URL to analyze');
      return;
    }
    
    // Show loading state
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    if (resultContent) resultContent.style.display = 'none';
    if (resultContainer) resultContainer.classList.remove('result-safe', 'result-warning', 'result-danger');
    
    try {
      // Create headers object with content type
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Add auth token if available
      const token = localStorage.getItem('phishguardToken');
      if (token) {
        console.log('Adding auth token to request');
        headers['x-auth-token'] = token;
      } else {
        console.log('No auth token available');
      }
      
      // Send analysis request
      const response = await fetch('http://localhost:3000/api/analyze-url', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          url: urlInput.value,
          useSafeBrowsing: true
        })
      });
      
      // Process response
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Log if activity was recorded
      if (result.activity_recorded) {
        console.log('Activity recorded successfully:', result.activity_result);
      } else {
        console.log('Activity not recorded:', result.activity_error || 'User not authenticated');
      }
      
      // Display result
      displayResult(result);
      
      // Mark URL analysis task as completed for security score
      if (token) {
        localStorage.setItem('completed_url_analysis', 'true');
      }
      
    } catch (error) {
      console.error('Error analyzing URL:', error);
      showError(`Analysis failed: ${error.message}`);
    } finally {
      if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
  }

  function displayResult(result) {
    const resultContainer = document.getElementById('result-container');
    const riskScore = result.risk_score || 0;
    let riskLevel, riskClass, riskIconClass, riskMessage;
    
 
    //  risk level thresholds
    if (riskScore >= 70) {
      riskLevel = 'High Risk Detected';
      riskClass = 'result-danger';
      riskIconClass = 'fa-exclamation-triangle';
      riskMessage = 'This URL has characteristics typical of phishing or malicious sites. We strongly recommend against visiting or sharing any information with this site.';
    } else if (riskScore >= 30) {
      riskLevel = 'Medium Risk Detected';
      riskClass = 'result-warning';
      riskIconClass = 'fa-exclamation-circle';
      riskMessage = 'This URL has suspicious characteristics that warrant caution. While not definitively malicious, we recommend verifying its legitimacy through other means before sharing sensitive information.';
    } else {
      riskLevel = 'Low Risk Detected';
      riskClass = 'result-safe';
      riskIconClass = 'fa-check-circle';
      riskMessage = 'This URL appears to be safe based on our analysis. As always, exercise normal caution when browsing.';
    }
    
    // Apply the risk level to the UI elements
    document.getElementById('risk-level').textContent = riskLevel;
    document.getElementById('risk-message').textContent = riskMessage;
    resultContainer.classList.add(riskClass);
    document.getElementById('result-icon').className = `fas ${riskIconClass}`;
    
    // Set risk score display (ensure this is always showing the actual score)
    const scoreElement = document.getElementById('risk-score');
    if (scoreElement) {
      scoreElement.textContent = `${Math.round(riskScore)}`;
    }
  }

  async function displayKeyFindings(container, result, url) {
    try {
      container.innerHTML = ''; 
      
      // Get findings from result or fetch them if needed
      let findings = result.findings || [];
      
      if (findings.length === 0) {
        // Handle no findings case
        // ...existing code...
        return;
      }
      
      // Sort findings by severity (high -> medium -> low)
      const sortedFindings = [...findings].sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        const aSeverity = a.severity || 'medium';
        const bSeverity = b.severity || 'medium';
        
        return severityOrder[aSeverity] - severityOrder[bSeverity];
      });
      
      // Display sorted findings
      sortedFindings.forEach(finding => {
        // ...existing code for displaying findings...
      });
      
    } catch (error) {
      console.error('Error displaying key findings:', error);
      container.innerHTML = '<div class="error-message">Failed to display findings</div>';
    }
  }
});