/**
 * PhishGuard Admin Blacklist Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Initializing blacklist management...');
    
    // Verify admin authentication
    if (!Auth.isAuthenticated()) {
      window.location.href = 'index.html';
      return;
    }
    
    // Set up event handlers
    setupAddForm();
    setupRefreshButton();
    setupSearchFunctionality(); // Add this line
    
    // Load blacklist data
    await loadBlacklist();
  } catch (error) {
    console.error('Blacklist initialization error:', error);
    showAlert('Failed to initialize blacklist page: ' + error.message, 'error');
  }
});

async function loadBlacklist() {
  try {
    // Show loading state
    const blacklistLoader = document.getElementById('blacklist-loader');
    const blacklistTable = document.getElementById('blacklist-table');
    const noBlacklist = document.getElementById('no-blacklist');
    
    if (blacklistLoader) {
      blacklistLoader.style.display = 'flex';
    }
    
    if (blacklistTable) {
      blacklistTable.style.display = 'none';
    }
    
    if (noBlacklist) {
      noBlacklist.style.display = 'none';
    }
    
    // Fetch blacklist
    const blacklist = await listsAPI.getBlacklist();
    console.log('Loaded blacklist data:', blacklist);
    
    // Hide loading indicator
    if (blacklistLoader) {
      blacklistLoader.style.display = 'none';
    }
    
    // Check if empty
    if (!blacklist || blacklist.length === 0) {
      if (noBlacklist) {
        noBlacklist.style.display = 'flex';
      }
      return;
    }
    
    // Show table and populate
    if (blacklistTable) {
      blacklistTable.style.display = 'table';
      
      const tableBody = document.getElementById('blacklist-body');
      if (!tableBody) {
        console.error('blacklist-body element not found');
        return;
      }
      
      // Clear existing rows
      tableBody.innerHTML = '';
      
      // Update pagination info
      document.getElementById('blacklist-total').textContent = blacklist.length;
      document.getElementById('blacklist-range').textContent = `1-${Math.min(blacklist.length, 10)}`;
      
      // Process each item
      blacklist.forEach(item => {
        const row = document.createElement('tr');
        
        // Check if item is a string or an object
        if (typeof item === 'string') {
          // Simple string format
          row.innerHTML = `
            <td>${item}</td>
            <td>Unknown</td>
            <td>Unknown</td>
            <td>
              <button class="btn btn-danger btn-sm delete-domain" data-domain="${item}">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          `;
        } else {
          // Object format with full details
          const domain = item.Domain || item.domain || '';
          const date = item.AddedDate || item.addedDate || new Date().toISOString();
          const addedBy = item.addedByUser || 'Unknown';
          
          row.innerHTML = `
            <td>${domain}</td>
            <td>${addedBy}</td>
            <td>${new Date(date).toLocaleString()}</td>
            <td>
              <button class="btn btn-danger btn-sm delete-domain" data-domain="${domain}">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          `;
        }
        
        tableBody.appendChild(row);
      });
      
      // Add event listeners for delete buttons
      document.querySelectorAll('.delete-domain').forEach(button => {
        button.addEventListener('click', handleDeleteDomain);
      });
    }
  } catch (error) {
    console.error('Error loading blacklist:', error);
    
    // Hide loader and table, show error
    const blacklistLoader = document.getElementById('blacklist-loader');
    if (blacklistLoader) {
      blacklistLoader.style.display = 'none';
    }
    
    // Show alert
    showAlert('Failed to load blacklist: ' + error.message, 'error');
  }
}

function setupAddForm() {
  const addForm = document.getElementById('add-blacklist-form');
  
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const domainInput = document.getElementById('domain-input');
      if (!domainInput) {
        console.error('domain-input element not found');
        return;
      }
      
      const domain = domainInput.value.trim();
      
      if (!domain) {
        showAlert('Please enter a domain', 'warning');
        return;
      }
      
      // Disable form during submission
      const submitButton = addForm.querySelector('button[type="submit"]');
      
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.querySelector('.btn-text').style.display = 'none';
        submitButton.querySelector('.btn-loader').style.display = 'inline-block';
      }
      
      try {
        console.log('Adding domain to blacklist:', domain);
        const response = await listsAPI.addToBlacklist(domain);
        
        // Clear input and reload list
        domainInput.value = '';
        await loadBlacklist();
        
        // Show success message
        showAlert(`Domain "${domain}" added to blacklist successfully`, 'success');
        
        // Add notification toast that fades out
        showToast(`"${domain}" has been added to the blacklist`, 'success');
      } catch (error) {
        console.error('Error adding to blacklist:', error);
        showAlert('Failed to add domain: ' + error.message, 'error');
        showToast(`Failed to add "${domain}" to blacklist`, 'error');
      } finally {
        // Re-enable form
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.querySelector('.btn-text').style.display = 'inline-block';
          submitButton.querySelector('.btn-loader').style.display = 'none';
        }
      }
    });
  } else {
    console.error('add-blacklist-form element not found');
  }
}

function setupRefreshButton() {
  const refreshButton = document.getElementById('refresh-blacklist');
  if (refreshButton) {
    refreshButton.addEventListener('click', async () => {
      try {
        refreshButton.classList.add('rotating');
        await loadBlacklist();
        setTimeout(() => {
          refreshButton.classList.remove('rotating');
        }, 500);
      } catch (error) {
        refreshButton.classList.remove('rotating');
      }
    });
  }
}

// Add this new function for search functionality
function setupSearchFunctionality() {
  const searchInput = document.getElementById('search-input');
  const searchButton = document.querySelector('.search-button');
  
  if (searchInput && searchButton) {
    // Search on input change (keyup)
    searchInput.addEventListener('keyup', () => {
      filterDomains(searchInput.value.trim().toLowerCase());
    });
    
    // Search on button click
    searchButton.addEventListener('click', () => {
      filterDomains(searchInput.value.trim().toLowerCase());
    });
    
    // Clear search with Escape key
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        filterDomains('');
      }
    });
  }
}

// Add this function to filter domains
function filterDomains(searchTerm) {
  const tableBody = document.getElementById('blacklist-body');
  if (!tableBody) return;
  
  const rows = tableBody.getElementsByTagName('tr');
  let visibleCount = 0;
  
  // Loop through all table rows
  for (let i = 0; i < rows.length; i++) {
    const domainCell = rows[i].cells[0]; // Assuming domain is in first column
    
    if (domainCell) {
      const domain = domainCell.textContent.toLowerCase();
      
      // Show/hide row based on search term
      if (domain.includes(searchTerm)) {
        rows[i].style.display = '';
        visibleCount++;
      } else {
        rows[i].style.display = 'none';
      }
    }
  }
  
  // Update counts display
  const totalElement = document.getElementById('blacklist-total');
  const rangeElement = document.getElementById('blacklist-range');
  
  if (totalElement) {
    // Keep showing the total count but note filtered results
    if (searchTerm) {
      totalElement.textContent = `${visibleCount} of ${rows.length}`;
    } else {
      totalElement.textContent = rows.length;
    }
  }
  
  if (rangeElement && searchTerm) {
    rangeElement.textContent = `filtered`;
  } else if (rangeElement) {
    rangeElement.textContent = `1-${Math.min(rows.length, 10)}`;
  }
  
  // Show explanatory message if no results
  if (visibleCount === 0 && searchTerm && rows.length > 0) {
    showToast(`No domains match "${searchTerm}"`, 'info');
  }
}

async function handleDeleteDomain(e) {
  const button = e.currentTarget;
  const domain = button.dataset.domain;
  
  // Simple confirmation
  if (!confirm(`Are you sure you want to remove "${domain}" from the blacklist?`)) {
    return;
  }
  
  // Disable button during request and show loading
  button.disabled = true;
  const originalContent = button.innerHTML;
  button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
  
  try {
    console.log(`Removing domain from blacklist: ${domain}`);
    
    // Make API call with proper error handling
    const response = await listsAPI.removeFromBlacklist(domain);
    console.log(`Successfully removed ${domain} from blacklist`);
    
    // Reload blacklist to reflect changes
    await loadBlacklist();
    
    // Show success message
    showAlert(`Domain "${domain}" removed from blacklist`, 'success');
    
    // Add toast notification
    showToast(`"${domain}" has been removed from the blacklist`, 'info');
  } catch (error) {
    console.error('Error removing domain from blacklist:', error);
    
    // Re-enable button
    button.disabled = false;
    button.innerHTML = originalContent;
    
    // Show error message
    showAlert('Failed to remove domain: ' + (error.message || 'Unknown error'), 'error');
    showToast(`Failed to remove "${domain}"`, 'error');
  }
}

function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById('system-alert');
  if (!alertContainer) return;
  
  alertContainer.textContent = message;
  alertContainer.className = `alert alert-${type === 'error' ? 'danger' : type}`;
  alertContainer.style.display = 'block';
  
  // Auto-dismiss after 5 seconds for non-error alerts
  if (type !== 'error' && type !== 'danger') {
    setTimeout(() => {
      alertContainer.style.display = 'none';
    }, 5000);
  }
}

// Add a toast notification function (identical to whitelist.js)
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
  
  // Style the toast
  toast.style.backgroundColor = type === 'success' ? '#4CAF50' : 
                               type === 'error' ? '#F44336' : 
                               type === 'warning' ? '#FF9800' : '#2196F3';
  toast.style.color = 'white';
  toast.style.padding = '12px 20px';
  toast.style.borderRadius = '4px';
  toast.style.marginTop = '10px';
  toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.minWidth = '250px';
  toast.style.opacity = '0';
  toast.style.transition = 'opacity 0.3s ease';
  
  toast.querySelector('.toast-icon').style.marginRight = '10px';
  
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
