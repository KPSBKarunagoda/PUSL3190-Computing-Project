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
  
  // Create confirmation modal for delete action
  const confirmModal = createConfirmationModal();
  document.body.appendChild(confirmModal);
  
  // Keep track of report to delete
  let reportToDelete = null;
  
  // Add event listener for refresh button
  refreshBtn.addEventListener('click', () => {
    loadUserReports();
  });
  
  // Initial load of reports
  await loadUserReports();
  
  /**
   * Create confirmation modal for delete actions
   */
  function createConfirmationModal() {
    const modal = document.createElement('div');
    modal.id = 'confirm-delete-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3><i class="fas fa-exclamation-triangle"></i> Confirm Deletion</h3>
          <span class="close-confirm-modal">&times;</span>
        </div>
        <div class="modal-body">
          <p>Are you sure you want to delete this report? This action cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button id="cancel-delete-btn" class="btn-secondary">Cancel</button>
          <button id="confirm-delete-btn" class="btn-danger">Delete</button>
        </div>
      </div>
    `;
    
    // Add event listeners once the modal is in the DOM
    setTimeout(() => {
      // Close button
      const closeBtn = modal.querySelector('.close-confirm-modal');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          modal.classList.remove('show');
        });
      }
      
      // Cancel button
      const cancelBtn = document.getElementById('cancel-delete-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          modal.classList.remove('show');
        });
      }
      
      // Confirm delete button
      const confirmBtn = document.getElementById('confirm-delete-btn');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
          if (!reportToDelete) return;
          
          try {
            // Show loading state
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
            
            const response = await fetch(`http://localhost:3000/api/reports/${reportToDelete}`, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
              }
            });
            
            if (!response.ok) {
              throw new Error(`Error: ${response.status}`);
            }
            
            // Success - hide modals and reload reports
            modal.classList.remove('show');
            if (reportModal.classList.contains('show')) {
              reportModal.classList.remove('show');
            }
            
            // Show success message
            showNotification('Report deleted successfully', 'success');
            
            // Reload reports
            await loadUserReports();
            
          } catch (error) {
            console.error('Error deleting report:', error);
            showNotification(`Failed to delete report: ${error.message}`, 'error');
          } finally {
            // Reset button state
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = 'Delete';
            reportToDelete = null;
          }
        });
      }
    }, 100);
    
    return modal;
  }
  
  /**
   * Display a notification message
   */
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateY(0)';
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(-20px)';
      setTimeout(() => notification.remove(), 500);
    }, 3000);
  }
  
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
          <button class="btn-view" data-report-id="${report.ReportID}" title="View details">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn-delete" data-report-id="${report.ReportID}" title="Delete report">
            <i class="fas fa-trash-alt"></i>
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
    
    // Add event listeners for delete buttons
    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const reportId = btn.dataset.reportId;
        reportToDelete = reportId;
        confirmModal.classList.add('show');
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
    
    // Create details HTML - Remove the Report ID field
    modalBody.innerHTML = `
      <div class="report-details">
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
        
        <div class="modal-actions">
          <button class="btn-danger delete-report-btn" data-report-id="${report.ReportID}">
            <i class="fas fa-trash-alt"></i> Delete Report
          </button>
        </div>
      </div>
    `;
    
    // Add event listener for delete button in modal
    const deleteBtn = modalBody.querySelector('.delete-report-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        reportToDelete = report.ReportID;
        reportModal.classList.remove('show');
        confirmModal.classList.add('show');
      });
    }
    
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
