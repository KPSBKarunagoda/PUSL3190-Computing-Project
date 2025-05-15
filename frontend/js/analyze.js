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

  async function displayKeyFindings(container, result, url) {
    try {
      container.innerHTML = ''; // Clear container
      
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