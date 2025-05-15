function displayKeyFindings(container, result, url) {
  try {
    // Clear any existing content
    container.innerHTML = '';
    
    // Get findings from result or generate default ones if not available
    let findings = [];
    
    if (result.keyFindings && result.keyFindings.length > 0) {
      findings = result.keyFindings;
    } else if (result.findings && result.findings.length > 0) {
      findings = result.findings;
    } else {
      // Generate default findings based on the result
      // ...existing code for generating default findings...
    }
    
    // Sort findings by severity (high -> medium -> low)
    const sortedFindings = [...findings].sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      const aSeverity = a.severity || 'medium';
      const bSeverity = b.severity || 'medium';
      
      return severityOrder[aSeverity] - severityOrder[bSeverity];
    });
    
    // Display the findings with proper styling
    sortedFindings.forEach(finding => {
      // ...existing code for displaying each finding...
    });
    
    // ...any remaining existing code...
  } catch (error) {
    console.error('Error displaying key findings:', error);
    container.innerHTML = '<div class="error-message">Failed to display findings</div>';
  }
}
