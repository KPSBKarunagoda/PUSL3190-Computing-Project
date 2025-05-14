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
    setupSearchFunctionality();
    setupExportButton(); // Add this line to initialize the export button
    
    // Load whitelist data
    await loadWhitelist();
  } catch (error) {
    console.error('Whitelist initialization error:', error);
    showAlert('Failed to initialize whitelist page: ' + error.message, 'error');
  }
});

// Create variable to store whitelist data for export
if (!window.state) window.state = {};
window.state.allWhitelist = [];

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
    
    // Store whitelist in state for export functionality
    window.state.allWhitelist = whitelist || [];
    
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
          // Simple string format with domain overflow handling
          const domain = item;
          
          // Create cells with enhanced styling
          const domainCell = document.createElement('td');
          domainCell.className = 'url-column';
          
          const domainDiv = document.createElement('div');
          domainDiv.className = 'url-cell';
          domainDiv.title = domain; // Add tooltip
          domainDiv.textContent = domain;
          domainCell.appendChild(domainDiv);
          
          row.appendChild(domainCell);
          row.appendChild(document.createElement('td')).textContent = 'Unknown';
          row.appendChild(document.createElement('td')).textContent = 'Unknown';
          
          // Create actions cell with enhanced button
          const actionsCell = document.createElement('td');
          const actionsDiv = document.createElement('div');
          actionsDiv.className = 'actions';
          
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'btn btn-icon btn-sm delete-domain';
          deleteBtn.dataset.domain = domain;
          deleteBtn.title = 'Remove domain from whitelist';
          deleteBtn.setAttribute('aria-label', 'Delete domain');
          deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
          
          actionsDiv.appendChild(deleteBtn);
          actionsCell.appendChild(actionsDiv);
          row.appendChild(actionsCell);
        } else {
          // Object format with full details
          const domain = item.Domain || item.domain || '';
          const date = item.AddedDate || item.addedDate || new Date().toISOString();
          const addedBy = item.addedByUser || 'Unknown';
          
          // Create cells with enhanced styling
          const domainCell = document.createElement('td');
          domainCell.className = 'url-column';
          
          const domainDiv = document.createElement('div');
          domainDiv.className = 'url-cell';
          domainDiv.title = domain; // Add tooltip
          domainDiv.textContent = domain;
          domainCell.appendChild(domainDiv);
          
          row.appendChild(domainCell);
          row.appendChild(document.createElement('td')).textContent = addedBy;
          row.appendChild(document.createElement('td')).textContent = new Date(date).toLocaleString();
          
          // Create actions cell with enhanced button
          const actionsCell = document.createElement('td');
          const actionsDiv = document.createElement('div');
          actionsDiv.className = 'actions';
          
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'btn btn-icon btn-sm delete-domain';
          deleteBtn.dataset.domain = domain;
          deleteBtn.title = 'Remove domain from whitelist';
          deleteBtn.setAttribute('aria-label', 'Delete domain');
          deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
          
          actionsDiv.appendChild(deleteBtn);
          actionsCell.appendChild(actionsDiv);
          row.appendChild(actionsCell);
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
  const addForm = document.getElementById('add-whitelist-form');
  
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
        console.log('Adding domain to whitelist:', domain);
        const response = await listsAPI.addToWhitelist(domain);
        
        // Clear input and reload list
        domainInput.value = '';
        await loadWhitelist();
        
        // Show success message with more details
        showAlert(`Domain "${domain}" added to whitelist successfully`, 'success');
        
        // Add notification toast that fades out
        showToast(`"${domain}" has been added to the whitelist`, 'success');
      } catch (error) {
        console.error('Error adding to whitelist:', error);
        showAlert('Failed to add domain: ' + error.message, 'error');
        showToast(`Failed to add "${domain}" to whitelist`, 'error');
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
  const tableBody = document.getElementById('whitelist-body');
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
  const totalElement = document.getElementById('whitelist-total');
  const rangeElement = document.getElementById('whitelist-range');
  
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

// Add this new function for export functionality
function exportWhitelist() {
  try {
    // Show loading state on button
    const exportBtn = document.getElementById('export-whitelist');
    const originalText = exportBtn.innerHTML;
    exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
    
    // Get current whitelist data
    const whitelist = [...window.state.allWhitelist] || [];
    
    if (!whitelist.length) {
      showAlert('No domains available to export', 'warning');
      exportBtn.innerHTML = originalText;
      return;
    }
    
    // Create CSV content with header
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Domain,Added By,Date Added\n";
    
    // Add each domain as a row
    whitelist.forEach(item => {
      // Handle if item is a string or object
      let domain, addedBy, dateAdded;
      
      if (typeof item === 'string') {
        domain = item;
        addedBy = 'Unknown';
        dateAdded = 'Unknown';
      } else {
        domain = item.Domain || item.domain || '';
        addedBy = item.addedByUser || 'Unknown';
        dateAdded = item.AddedDate ? new Date(item.AddedDate).toLocaleDateString() : 'Unknown';
      }
      
      // Format each field with proper CSV escaping
      const formatForCsv = (str) => {
        if (str === null || str === undefined) return '';
        return `"${String(str).replace(/"/g, '""')}"`;
      };
      
      // Build row with all fields
      const row = [
        formatForCsv(domain),
        formatForCsv(addedBy),
        formatForCsv(dateAdded)
      ];
      
      csvContent += row.join(',') + '\n';
    });
    
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `phishguard_whitelist_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    
    // Trigger download
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    
    // Reset button state
    exportBtn.innerHTML = originalText;
    
    // Show success notification
    showToast('Whitelist exported successfully', 'success');
    
  } catch (error) {
    console.error('Error exporting whitelist:', error);
    showAlert('Failed to export whitelist: ' + error.message, 'error');
    
    // Reset button state
    const exportBtn = document.getElementById('export-whitelist');
    if (exportBtn) {
      exportBtn.innerHTML = '<i class="fas fa-download"></i> Export Whitelist';
    }
  }
}

// Add setup function for the export button
function setupExportButton() {
  const exportBtn = document.getElementById('export-whitelist');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportWhitelist);
  }
}

async function handleDeleteDomain(e) {
  const button = e.currentTarget;
  const domain = button.dataset.domain;
  
  // Simple confirmation
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
    const response = await listsAPI.removeFromWhitelist(domain);
    console.log(`Successfully removed ${domain} from whitelist`);
    
    // Reload whitelist to reflect changes
    await loadWhitelist();
    
    // Show success message
    showAlert(`Domain "${domain}" removed from whitelist`, 'success');
    
    // Add toast notification
    showToast(`"${domain}" has been removed from the whitelist`, 'info');
  } catch (error) {
    console.error('Error removing domain from whitelist:', error);
    
    // Re-enable button
    button.disabled = false;
    button.innerHTML = '<i class="fas fa-trash-alt"></i>';
    
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

// Add a toast notification function
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
