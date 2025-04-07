/**
 * PhishGuard Admin Reports Management
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Initializing reports management...');
    
    // Verify admin authentication
    if (!Auth.isAuthenticated()) {
      window.location.href = 'index.html';
      return;
    }
    
    // Set up UI components and event listeners
    setupReportActions();
    
    // Initialize with empty state until API is connected
    showEmptyState();
    
    console.log('Reports management initialized successfully');
  } catch (error) {
    console.error('Reports management initialization error:', error);
    showAlert('Failed to initialize reports management: ' + error.message, 'error');
  }
});

function setupReportActions() {
  // Set up search functionality
  const searchInput = document.getElementById('report-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      // Will implement search functionality when data is available
      console.log('Search query:', query);
    });
    
    // Add keydown event for Escape key to clear search
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        // Will implement search clearing when data is available
      }
    });
  }
  
  // Set up status filter
  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      const status = statusFilter.value;
      // Will implement filtering when data is available
      console.log('Status filter changed to:', status);
    });
  }
  
  // Set up refresh button
  const refreshBtn = document.getElementById('refresh-reports');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.querySelector('i').classList.add('fa-spin');
      
      // Simulate refresh - will be replaced with actual API call
      setTimeout(() => {
        refreshBtn.querySelector('i').classList.remove('fa-spin');
        showAlert('Data refreshed successfully', 'success');
      }, 1000);
    });
  }
  
  // Set up export button
  const exportBtn = document.getElementById('export-reports');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      showAlert('Export functionality will be available when connected to the API', 'info');
    });
  }
  
  // Set up resolve all button
  const resolveAllBtn = document.getElementById('resolve-all');
  if (resolveAllBtn) {
    resolveAllBtn.addEventListener('click', () => {
      showAlert('Bulk resolution will be available when connected to the API', 'info');
    });
  }
  
  // Set up modal close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      hideModal('report-modal');
    });
  });
  
  // Setup modal action buttons for future implementation
  const blacklistUrlBtn = document.getElementById('blacklist-url');
  if (blacklistUrlBtn) {
    blacklistUrlBtn.addEventListener('click', () => {
      showAlert('Blacklist functionality will be connected to the API', 'info');
      hideModal('report-modal');
    });
  }
  
  const resolveReportBtn = document.getElementById('resolve-report');
  if (resolveReportBtn) {
    resolveReportBtn.addEventListener('click', () => {
      showAlert('Resolution functionality will be connected to the API', 'info');
      hideModal('report-modal');
    });
  }
  
  const dismissReportBtn = document.getElementById('dismiss-report');
  if (dismissReportBtn) {
    dismissReportBtn.addEventListener('click', () => {
      hideModal('report-modal');
    });
  }
}

function showEmptyState() {
  const reportsLoader = document.getElementById('reports-loader');
  const reportsTable = document.getElementById('reports-table');
  const noReports = document.getElementById('no-reports');
  
  if (reportsLoader) reportsLoader.style.display = 'none';
  if (reportsTable) reportsTable.style.display = 'none';
  if (noReports) noReports.style.display = 'flex';
  
  // Update stats with zeros
  document.getElementById('total-reports').textContent = '0';
  document.getElementById('pending-reports').textContent = '0';
  document.getElementById('resolved-reports').textContent = '0';
  document.getElementById('today-reports').textContent = '0';
}

// Utility functions
function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
  }
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById('system-alert');
  if (!alertContainer) return;
  
  alertContainer.textContent = message;
  alertContainer.className = `alert alert-${type === 'error' ? 'danger' : type}`;
  alertContainer.style.display = 'block';
  
  if (type !== 'error' && type !== 'danger') {
    setTimeout(() => {
      alertContainer.style.display = 'none';
    }, 5000);
  }
}
