/**
 * PhishGuard Admin Whitelist Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Initializing whitelist management...');
    
    // Verify admin authentication
    if (!Auth.isAuthenticated()) {
      window.location.href = 'index.html';
      return;
    }
    
    // Set up event handlers
    setupAddForm();
    setupRefreshButton();
    
    // Load whitelist data
    await loadWhitelist();
  } catch (error) {
    console.error('Whitelist initialization error:', error);
    showAlert('Failed to initialize whitelist page: ' + error.message, 'error');
  }
});

async function loadWhitelist() {
  try {
    // Show loading state
    const whitelistLoader = document.getElementById('whitelist-loader');
    const whitelistTable = document.getElementById('whitelist-table');
    const noWhitelist = document.getElementById('no-whitelist');
    
    if (whitelistLoader) {
      whitelistLoader.style.display = 'flex';
    }
    
    if (whitelistTable) {
      whitelistTable.style.display = 'none';
    }
    
    if (noWhitelist) {
      noWhitelist.style.display = 'none';
    }
    
    // Fetch whitelist
    const whitelist = await listsAPI.getWhitelist();
    console.log('Loaded whitelist data:', whitelist);
    
    // Hide loading indicator
    if (whitelistLoader) {
      whitelistLoader.style.display = 'none';
    }
    
    // Check if empty
    if (!whitelist || whitelist.length === 0) {
      if (noWhitelist) {
        noWhitelist.style.display = 'flex';
      }
      return;
    }
    
    // Show table and populate
    if (whitelistTable) {
      whitelistTable.style.display = 'table';
      
      const tableBody = document.getElementById('whitelist-body');
      if (!tableBody) {
        console.error('whitelist-body element not found');
        return;
      }
      
      // Clear existing rows
      tableBody.innerHTML = '';
      
      // Update pagination info
      document.getElementById('whitelist-total').textContent = whitelist.length;
      document.getElementById('whitelist-range').textContent = `1-${Math.min(whitelist.length, 10)}`;
      
      // Process each item
      whitelist.forEach(item => {
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
    console.error('Error loading whitelist:', error);
    
    // Hide loader and table, show error
    const whitelistLoader = document.getElementById('whitelist-loader');
    if (whitelistLoader) {
      whitelistLoader.style.display = 'none';
    }
    
    // Show alert
    showAlert('Failed to load whitelist: ' + error.message, 'error');
  }
}

function setupAddForm() {
  // UPDATED: Use correct form ID from HTML
  const addForm = document.getElementById('add-whitelist-form');
  
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
        console.log('Adding domain to whitelist:', domain);
        await listsAPI.addToWhitelist(domain);
        
        // Clear input and reload list
        domainInput.value = '';
        await loadWhitelist();
        
        // Show success message
        showAlert(`Domain "${domain}" added to whitelist`, 'success');
      } catch (error) {
        console.error('Error adding to whitelist:', error);
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
    console.error('add-whitelist-form element not found');
  }
}

function setupRefreshButton() {
  const refreshButton = document.getElementById('refresh-whitelist');
  if (refreshButton) {
    refreshButton.addEventListener('click', async () => {
      try {
        refreshButton.classList.add('rotating');
        await loadWhitelist();
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
  if (!confirm(`Are you sure you want to remove "${domain}" from the whitelist?`)) {
    return;
  }
  
  // Disable button during request and show loading
  button.disabled = true;
  const originalContent = button.innerHTML;
  button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
  
  try {
    console.log(`Removing domain from whitelist: ${domain}`);
    
    // Make API call with proper error handling
    await listsAPI.removeFromWhitelist(domain);
    console.log(`Successfully removed ${domain} from whitelist`);
    
    // Reload whitelist to reflect changes
    await loadWhitelist();
    
    // Show success message
    showAlert(`Domain "${domain}" removed from whitelist`, 'success');
  } catch (error) {
    console.error('Error removing domain from whitelist:', error);
    
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
