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
  // UPDATED: Use correct form ID from HTML
  const addForm = document.getElementById('add-blacklist-form');
  
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // UPDATED: Use correct input ID from HTML
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
        // Use the proper structure for showing loading state
        submitButton.querySelector('.btn-text').style.display = 'none';
        submitButton.querySelector('.btn-loader').style.display = 'inline-block';
      }
      
      try {
        console.log('Adding domain to blacklist:', domain);
        await listsAPI.addToBlacklist(domain);
        
        // Clear input and reload list
        domainInput.value = '';
        await loadBlacklist();
        
        // Show success message
        showAlert(`Domain "${domain}" added to blacklist`, 'success');
      } catch (error) {
        console.error('Error adding to blacklist:', error);
        showAlert('Failed to add domain: ' + error.message, 'error');
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

async function handleDeleteDomain(e) {
  const button = e.currentTarget;
  const domain = button.dataset.domain;
  
  // Simple confirmation without modal
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
    await listsAPI.removeFromBlacklist(domain);
    console.log(`Successfully removed ${domain} from blacklist`);
    
    // Reload blacklist to reflect changes
    await loadBlacklist();
    
    // Show success message
    showAlert(`Domain "${domain}" removed from blacklist`, 'success');
  } catch (error) {
    console.error('Error removing domain from blacklist:', error);
    
    // Re-enable button
    button.disabled = false;
    button.innerHTML = originalContent;
    
    // Show error message
    showAlert('Failed to remove domain: ' + (error.message || 'Unknown error'), 'error');
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
