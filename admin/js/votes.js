/**
 * PhishGuard Admin Votes Management
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Initializing votes management...');
    
    // Verify admin authentication
    if (!Auth.isAuthenticated()) {
      window.location.href = 'index.html';
      return;
    }
    
    // Set up UI components and event listeners
    setupVoteActions();
    
    // Initialize with empty state until API is connected
    showEmptyState();
    
    console.log('Votes management initialized successfully');
  } catch (error) {
    console.error('Votes management initialization error:', error);
    showAlert('Failed to initialize votes management: ' + error.message, 'error');
  }
});

function setupVoteActions() {
  // Set up search functionality
  const searchInput = document.getElementById('vote-search');
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
  
  // Set up vote type filter
  const voteFilter = document.getElementById('vote-filter');
  if (voteFilter) {
    voteFilter.addEventListener('change', () => {
      const filterValue = voteFilter.value;
      // Will implement filtering when data is available
      console.log('Filter changed to:', filterValue);
    });
  }
  
  // Set up refresh button
  const refreshBtn = document.getElementById('refresh-votes');
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
  const exportBtn = document.getElementById('export-votes');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      showAlert('Export functionality will be available when connected to the API', 'info');
    });
  }
  
  // Set up trends button
  const trendsBtn = document.getElementById('view-vote-trends');
  if (trendsBtn) {
    trendsBtn.addEventListener('click', () => {
      showAlert('Trends view will be available in a future update', 'info');
    });
  }
  
  // Set up modal close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      hideModal('vote-modal');
    });
  });
}

function showEmptyState() {
  const votesLoader = document.getElementById('votes-loader');
  const votesTable = document.getElementById('votes-table');
  const noVotes = document.getElementById('no-votes');
  
  if (votesLoader) votesLoader.style.display = 'none';
  if (votesTable) votesTable.style.display = 'none';
  if (noVotes) noVotes.style.display = 'flex';
  
  // Update stats with zeros
  document.getElementById('total-votes').textContent = '0';
  document.getElementById('safe-votes').textContent = '0';
  document.getElementById('phishing-votes').textContent = '0';
  document.getElementById('today-votes').textContent = '0';
  
  // Update analytics placeholders
  document.getElementById('most-voted-url').textContent = '-';
  document.getElementById('most-contested-url').textContent = '-';
  document.getElementById('most-phishing-url').textContent = '-';
  document.getElementById('most-safe-url').textContent = '-';
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

function showToast(message, type = 'info') {
  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.position = 'fixed';
    toastContainer.style.bottom = '20px';
    toastContainer.style.right = '20px';
    toastContainer.style.zIndex = '9999';
    document.body.appendChild(toastContainer);
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
    </div>
    <div class="toast-content">${message}</div>
  `;
  
  // Add to container
  toastContainer.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => {
    toast.style.opacity = '1';
  }, 10);
  
  // Remove after delay
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}