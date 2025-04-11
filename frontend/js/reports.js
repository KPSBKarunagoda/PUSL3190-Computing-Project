/**
 * PhishGuard User Reports Management
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication
  const token = localStorage.getItem('phishguardToken');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }
  
  // UI References
  const reportsLoader = document.getElementById('reports-loader');
  const reportsTable = document.getElementById('reports-table');
  const reportsTableBody = document.getElementById('reports-table-body');
  const emptyReports = document.getElementById('empty-reports');
  const refreshBtn = document.getElementById('refresh-reports');
  const reportModal = document.getElementById('report-modal');
  const modalBody = document.getElementById('modal-body');
  
  // Add event listener for refresh button
  refreshBtn.addEventListener('click', () => {
    loadUserReports();
  });
  
  // Initial load of reports
  await loadUserReports();
  
  /**
   * Load user reports from the API
   */
  async function loadUserReports() {
    // Show loading state
    if (reportsLoader) reportsLoader.style.display = 'flex';
    if (reportsTable) reportsTable.style.display = 'none';
    if (emptyReports) emptyReports.style.display = 'none';
    
    try {
      const response = await fetch('http://localhost:3000/api/reports/user', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        }
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const reports = await response.json();
      
      // Hide loader
      if (reportsLoader) reportsLoader.style.display = 'none';
      
      // Display reports or empty state
      if (reports && reports.length > 0) {
        displayReports(reports);
        if (reportsTable) reportsTable.style.display = 'table';
      } else {
        if (emptyReports) emptyReports.style.display = 'block';
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      
      // Hide loader and show error message
      if (reportsLoader) reportsLoader.style.display = 'none';
      if (emptyReports) {
        emptyReports.style.display = 'block';
        const title = emptyReports.querySelector('h3');
        const message = emptyReports.querySelector('p');
        if (title) title.textContent = 'Error Loading Reports';
        if (message) message.textContent = 'There was a problem loading your reports. Please try again later.';
      }
    }
  }
  
  /**
   * Display reports in the table
   * @param {Array} reports - The reports to display
   */
  function displayReports(reports) {
    // Clear existing table content
    if (!reportsTableBody) return;
    reportsTableBody.innerHTML = '';
    
    // Store reports for use in view details
    window.reportsList = reports;
    
    // Add each report as a row
    reports.forEach(report => {
      // Format date
      const reportDate = new Date(report.ReportDate);
      const formattedDate = reportDate.toLocaleDateString() + ' ' + reportDate.toLocaleTimeString();
      
      // Create row
      const row = document.createElement('tr');
      
      // Truncate URL for display
      const url = report.URL || '';
      const displayUrl = url.length > 60 ? url.substring(0, 57) + '...' : url;
      
      row.innerHTML = `
        <td class="url-cell" title="${escapeHtml(url)}">${escapeHtml(displayUrl)}</td>
        <td>${escapeHtml(report.Reason || 'Not specified')}</td>
        <td>${escapeHtml(formattedDate)}</td>
        <td><span class="status-badge status-${(report.Status || 'pending').toLowerCase()}">${escapeHtml(report.Status || 'Pending')}</span></td>
        <td class="action-buttons">
          <button class="btn-view" data-report-id="${report.ReportID}">
            <i class="fas fa-eye"></i>
          </button>
        </td>
      `;
      
      reportsTableBody.appendChild(row);
    });
    
    // Add event listeners for view buttons
    document.querySelectorAll('.btn-view').forEach(btn => {
      btn.addEventListener('click', () => {
        const reportId = btn.dataset.reportId;
        showReportDetails(reportId);
      });
    });
  }
  
  /**
   * Show report details in modal
   */
  function showReportDetails(reportId) {
    const reports = window.reportsList || [];
    const report = reports.find(r => r.ReportID == reportId);
    
    if (!report) {
      console.error('Report not found:', reportId);
      return;
    }
    
    // Format date
    const reportDate = new Date(report.ReportDate);
    const formattedDate = reportDate.toLocaleDateString() + ' ' + reportDate.toLocaleTimeString();
    
    // Create details HTML
    modalBody.innerHTML = `
      <div class="report-details">
        <div class="label">Report ID:</div>
        <div class="value">${escapeHtml(report.ReportID)}</div>
        
        <div class="label">URL:</div>
        <div class="value url">${escapeHtml(report.URL)}</div>
        
        <div class="label">Reported:</div>
        <div class="value">${escapeHtml(formattedDate)}</div>
        
        <div class="label">Reason:</div>
        <div class="value">${escapeHtml(report.Reason || 'Not specified')}</div>
        
        <div class="label">Status:</div>
        <div class="value status status-${(report.Status || 'pending').toLowerCase()}">${escapeHtml(report.Status || 'Pending')}</div>
        
        <div class="label">Description:</div>
        <div class="value description">${escapeHtml(report.Description || 'No additional details provided.')}</div>
      </div>
    `;
    
    // Show modal
    reportModal.classList.add('show');
  }
  
  /**
   * Helper function to escape HTML
   */
  function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return unsafe
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
