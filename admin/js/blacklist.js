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
    setupSearchFunctionality();
    setupBlacklistAnalytics();
    setupExportButton(); // Add this line to initialize export button
    
    // Load blacklist data
    await loadBlacklist();
    await loadBlacklistStats();
  } catch (error) {
    console.error('Blacklist initialization error:', error);
    showAlert('Failed to initialize blacklist page: ' + error.message, 'error');
  }
});

// Create variable to store blacklist data for export
if (!window.state) window.state = {};
window.state.allBlacklist = [];

/**
 * Show or hide the loader element
 * @param {boolean} show - Whether to show (true) or hide (false) the loader
 */
function showLoader(show) {
  const loader = document.getElementById('blacklist-loader');
  if (loader) {
    loader.style.display = show ? 'flex' : 'none';
  }
}

// Load blacklist entries from the API
async function loadBlacklist() {
  try {
    showLoader(true);
    
    const response = await listsAPI.getBlacklist();
    console.log('Loaded blacklist data:', response);
    
    // Extract the blacklist entries from the response
    const blacklist = response.entries || [];
    
    // Store blacklist in state for export functionality
    window.state.allBlacklist = blacklist || [];
    
    const tableBody = document.getElementById('blacklist-table-body');
    if (!tableBody) {
      console.error('blacklist-table-body element not found');
      return;
    }
    
    // Clear existing entries
    tableBody.innerHTML = '';
    
    if (!blacklist || blacklist.length === 0) {
      document.getElementById('no-blacklist').style.display = 'flex';
      document.getElementById('blacklist-table').style.display = 'none';
      return;
    }
    
    // Display the table
    document.getElementById('no-blacklist').style.display = 'none';
    document.getElementById('blacklist-table').style.display = 'table';
    
    // Update the count display
    const totalDisplay = document.getElementById('domains-count');
    if (totalDisplay) {
      totalDisplay.textContent = blacklist.length.toString();
    }
    
    // Add each entry to the table
    blacklist.forEach(entry => {
      const tr = document.createElement('tr');
      
      // URL column (first column) - UPDATED with proper overflow handling
      const urlTd = document.createElement('td');
      urlTd.className = 'url-column';
      const urlDiv = document.createElement('div');
      urlDiv.className = 'url-cell';
      urlDiv.title = entry.URL; // Add title for tooltip on hover
      urlDiv.textContent = entry.URL || 'Unknown URL';
      urlTd.appendChild(urlDiv);
      tr.appendChild(urlTd);
      
      // Risk level column
      const riskTd = document.createElement('td');
      riskTd.className = 'text-center';
      const riskLevel = entry.RiskLevel || 100;
      
      // Create risk level badge
      const riskBadge = document.createElement('span');
      riskBadge.classList.add('score-value');
      
      if (riskLevel >= 75) {
        riskBadge.classList.add('score-high');
        riskBadge.textContent = `${riskLevel}%`;
      } else if (riskLevel >= 50) {
        riskBadge.classList.add('score-medium');
        riskBadge.textContent = `${riskLevel}%`;
      } else {
        riskBadge.classList.add('score-low');
        riskBadge.textContent = `${riskLevel}%`;
      }
      
      riskTd.appendChild(riskBadge);
      tr.appendChild(riskTd);
      
      // Added by column - show "System" if is_system flag is true
      const addedByTd = document.createElement('td');
      if (entry.is_system) {
        // Create a styled badge for system entries
        const systemBadge = document.createElement('span');
        systemBadge.className = 'badge badge-system';
        systemBadge.innerHTML = '<i class="fas fa-robot"></i> System';
        addedByTd.appendChild(systemBadge);
      } else {
        // Show admin username with avatar
        const adminSpan = document.createElement('span');
        adminSpan.className = 'admin-name';
        adminSpan.innerHTML = `<i class="fas fa-user-shield"></i> ${entry.addedByUser || 'Admin'}`;
        addedByTd.appendChild(adminSpan);
      }
      tr.appendChild(addedByTd);
      
      // Date column
      const dateTd = document.createElement('td');
      dateTd.textContent = formatDate(entry.AddedDate);
      tr.appendChild(dateTd);
      
      // Actions column
      const actionsTd = document.createElement('td');
      
      // Create a div to hold the buttons and apply the actions class to it
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'actions';

      // Create the view details button
      const viewBtn = document.createElement('button');
      viewBtn.className = 'btn btn-icon btn-sm view-details';
      viewBtn.innerHTML = '<i class="fas fa-eye"></i>';
      viewBtn.addEventListener('click', () => showKeyFindings(entry.BlacklistID, entry.URL));
      viewBtn.title = 'View key findings for this domain';
      viewBtn.setAttribute('aria-label', 'View details');
      viewBtn.dataset.blacklistId = entry.BlacklistID;
      viewBtn.dataset.url = entry.URL;
      
      // Create the delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-icon btn-sm';
      deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
      deleteBtn.addEventListener('click', handleDeleteDomain);
      deleteBtn.title = 'Remove domain from blacklist';
      deleteBtn.setAttribute('aria-label', 'Delete domain');
      deleteBtn.dataset.domain = entry.URL;
      
      // Add spacing between buttons
      viewBtn.style.marginRight = '8px';
      
      // Append buttons to the actions div
      actionsDiv.appendChild(viewBtn);
      actionsDiv.appendChild(deleteBtn);
      
      // Append actions div to the cell
      actionsTd.appendChild(actionsDiv);
      
      // Append the cell to the row
      tr.appendChild(actionsTd);
      
      tableBody.appendChild(tr);
    });
    
    // Update stats if available
    if (response.stats) {
      const totalBlacklisted = document.getElementById('total-blacklisted');
      const recentBlacklisted = document.getElementById('recent-blacklisted');
      
      if (totalBlacklisted) totalBlacklisted.textContent = response.stats.total || '0';
      if (recentBlacklisted) recentBlacklisted.textContent = response.stats.recent || '0';
    }
  } catch (error) {
    console.error('Error loading blacklist:', error);
    showAlert('Failed to load blacklist: ' + error.message, 'error');
  } finally {
    showLoader(false);
  }
}

// Add new function to show key findings modal
async function showKeyFindings(blacklistId, url) {
  // Show modal
  const modal = document.getElementById('key-findings-modal');
  modal.classList.add('show');
  
  // Set URL in modal
  const urlElement = document.getElementById('findings-url');
  if (urlElement) urlElement.textContent = url || 'Unknown URL';
  
  // Set title
  const titleElement = document.getElementById('findings-modal-title');
  if (titleElement) titleElement.textContent = 'Key Findings for URL';
  
  // Show loader
  const loader = document.getElementById('findings-loader');
  const content = document.getElementById('findings-content');
  const noFindings = document.getElementById('no-findings');
  
  if (loader) loader.style.display = 'flex';
  if (content) content.style.display = 'none';
  if (noFindings) noFindings.style.display = 'none';
  
  try {
    // Fetch key findings data
    const findings = await fetchKeyFindings(blacklistId);
    
    // Hide loader
    if (loader) loader.style.display = 'none';
    
    // Check if we got findings data
    if (!findings || findings.length === 0) {
      if (noFindings) noFindings.style.display = 'flex';
      return;
    }
    
    // Show findings content
    if (content) content.style.display = 'block';
    
    // Display findings
    displayKeyFindings(findings);
  } catch (error) {
    console.error('Error fetching key findings:', error);
    
    // Hide loader
    if (loader) loader.style.display = 'none';
    
    // Show error message
    if (noFindings) {
      noFindings.style.display = 'flex';
      const message = noFindings.querySelector('p');
      if (message) message.textContent = 'Error loading key findings data.';
    }
  }
}

// Function to fetch key findings data
async function fetchKeyFindings(blacklistId) {
  try {
    // Check if we have a valid blacklist ID
    if (!blacklistId) {
      console.warn('No blacklist ID provided for key findings');
      return [];
    }
    
    // Fetch key findings from API
    const response = await fetch(`${API_BASE_URL || 'http://localhost:3000/api'}/education/key-findings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': Auth.getToken()
      },
      body: JSON.stringify({
        analysisResult: { blacklist_id: blacklistId }
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Key findings data:', data);
    
    return data.findings || [];
  } catch (error) {
    console.error('Error fetching key findings:', error);
    throw error;
  }
}

// Function to display key findings in the modal
function displayKeyFindings(findings) {
  const findingsList = document.getElementById('findings-list');
  if (!findingsList) return;
  
  // Clear previous findings
  findingsList.innerHTML = '';
  
  // Add each finding to the list
  findings.forEach(finding => {
    const item = document.createElement('div');
    item.className = `finding-item ${finding.severity || 'medium'}`;
    
    const iconClass = finding.severity === 'high' ? 'exclamation-triangle' :
                      finding.severity === 'low' ? 'info-circle' : 'exclamation-circle';
    
    item.innerHTML = `
      <div class="finding-title ${finding.severity || 'medium'}">
        <i class="fas fa-${iconClass}"></i>
        ${escapeHtml(finding.text || 'Unknown finding')}
      </div>
      <div class="finding-description">
        ${escapeHtml(finding.description || 'No description available')}
      </div>
    `;
    
    findingsList.appendChild(item);
  });
}

// Helper function to escape HTML to prevent XSS
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Setup modal close button
document.addEventListener('DOMContentLoaded', function() {
  try {
    const keyFindingsModal = document.getElementById('key-findings-modal');
    const keyFindingsCloseBtn = keyFindingsModal?.querySelector('.modal-close');
    
    if (keyFindingsCloseBtn) {
      keyFindingsCloseBtn.addEventListener('click', () => {
        keyFindingsModal.classList.remove('show');
      });
    }
    
    // Close modal if overlay is clicked
    keyFindingsModal?.querySelector('.modal-overlay')?.addEventListener('click', () => {
      keyFindingsModal.classList.remove('show');
    });
  } catch (error) {
    console.error('Error setting up modal close button:', error);
  }
});

// Helper function to format dates
function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return 'Error';
  }
}

// Function to handle deleting a URL from blacklist
async function handleDeleteDomain(e) {
  try {
    // Find the closest table row
    const row = e.target.closest('tr');
    if (!row) {
      console.error('Could not find table row for delete action');
      return;
    }
    
    // Get the URL from the first cell in the row
    const urlCell = row.querySelector('td:first-child');
    if (!urlCell) {
      console.error('Could not find URL cell');
      return;
    }
    
    const url = urlCell.textContent || urlCell.innerText;
    if (!url) {
      console.error('URL is empty');
      return;
    }
    
    console.log('Removing from blacklist:', url);
    
    // Confirm deletion
    if (!confirm(`Are you sure you want to remove "${url}" from the blacklist?`)) {
      return;
    }
    
    // Show loading state
    e.target.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
    e.target.disabled = true;
    
    // Call API to delete the URL
    await listsAPI.removeFromBlacklist(url);
    
    // Show success message
    showAlert(`URL "${url}" has been removed from the blacklist`, 'success');
    
    // Reload blacklist data
    await loadBlacklist();
    
  } catch (error) {
    console.error('Error removing domain from blacklist:', error);
    showAlert('Failed to remove URL: ' + error.message, 'error');
    
    // Reset button state
    if (e.target) {
      e.target.innerHTML = '<i class="fas fa-trash-alt"></i>';
      e.target.disabled = false;
    }
  }
}

// Update function to add domain to blacklist
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
      
      // Get risk level from select dropdown
      const riskLevelSelect = document.getElementById('risk-level');
      const riskLevel = riskLevelSelect ? parseInt(riskLevelSelect.value) : 100;
      
      // Disable form during submission
      const submitButton = addForm.querySelector('button[type="submit"]');
      
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.querySelector('.btn-text').style.display = 'none';
        submitButton.querySelector('.btn-loader').style.display = 'inline-block';
      }
      
      try {
        console.log(`Adding domain to blacklist: ${domain} with risk level: ${riskLevel}`);
        
        // Get the current admin's information
        const adminUser = Auth.getUser();
        
        // Set is_system=false flag to indicate manual addition by admin
        const response = await listsAPI.addToBlacklist(domain, null, riskLevel, false);
        
        // Clear input and reload list
        domainInput.value = '';
        await loadBlacklist();
        
        // Show success message
        showAlert(`Domain "${domain}" added to blacklist successfully with risk level ${riskLevel}%`, 'success');
        
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

function filterDomains(searchTerm) {
  const tableBody = document.getElementById('blacklist-table-body');
  if (!tableBody) return;
  
  const rows = tableBody.getElementsByTagName('tr');
  let visibleCount = 0;
  
  // Loop through all table rows
  for (let i = 0; i < rows.length; i++) {
    const urlCell = rows[i].cells[0]; // URL is in first column
    
    if (urlCell) {
      const url = urlCell.textContent.toLowerCase();
      
      // Show/hide row based on search term
      if (url.includes(searchTerm)) {
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
    showToast(`No URLs match "${searchTerm}"`, 'info');
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

// Add new functions for blacklist analytics
function setupBlacklistAnalytics() {
  const timeframeSelector = document.getElementById('timeframe-selector');
  const chartTypeSelector = document.getElementById('chart-type-selector');
  
  if (timeframeSelector) {
    timeframeSelector.addEventListener('change', async () => {
      const chartType = chartTypeSelector ? chartTypeSelector.value : 'auto';
      await loadBlacklistStats(timeframeSelector.value, chartType);
    });
  }
  
  if (chartTypeSelector) {
    chartTypeSelector.addEventListener('change', async () => {
      const timeframe = timeframeSelector ? timeframeSelector.value : 'week';
      await loadBlacklistStats(timeframe, chartTypeSelector.value);
    });
  }
}

let blacklistChart = null;

async function loadBlacklistStats(timeframe = 'week', chartType = 'auto') {
  try {
    // Show loading state
    const chartLoader = document.getElementById('chart-loader');
    const noChartData = document.getElementById('no-chart-data');
    const chartContainer = document.getElementById('blacklist-chart-container');
    
    if (chartLoader) chartLoader.style.display = 'flex';
    if (noChartData) noChartData.style.display = 'none';
    
    // Set chart container height based on timeframe for better visualization
    if (chartContainer) {
      if (timeframe === 'day') {
        chartContainer.style.height = '250px';
      } else if (timeframe === 'year') {
        chartContainer.style.height = '350px';
      } else {
        chartContainer.style.height = '300px';
      }
    }
    
    // Fetch stats data
    const stats = await listsAPI.getBlacklistStats(timeframe);
    console.log('Blacklist stats:', stats);
    
    // Hide loader
    if (chartLoader) chartLoader.style.display = 'none';
    
    // Update stat cards
    document.getElementById('total-blacklisted').textContent = stats.totalCount || 0;
    document.getElementById('recent-blacklisted').textContent = stats.recentAdditions || 0;
    
    // Update trend indicator
    updateTrendIndicator(stats);
    
    // Check if there's data to display
    if (!stats.labels || stats.labels.length === 0) {
      if (noChartData) noChartData.style.display = 'flex';
      return;
    }
    
    // Create or update chart with enhanced styling
    const ctx = document.getElementById('blacklist-chart').getContext('2d');
    
    // Generate gradient background
    let gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(220, 53, 69, 0.7)');
    gradient.addColorStop(1, 'rgba(220, 53, 69, 0.1)');
    
    // Format labels based on timeframe
    const formattedLabels = formatLabels(stats.labels, timeframe);
    
    // Determine if we should use line chart based on type or timeframe
    // If chartType is 'auto', use line for day view and bar for others
    // Otherwise use the explicitly selected chart type
    const useLineChart = chartType === 'line' || (chartType === 'auto' && timeframe === 'day');
    
    const chartConfig = {
      type: useLineChart ? 'line' : 'bar',
      data: {
        labels: formattedLabels,
        datasets: [{
          label: 'Domains Added',
          data: stats.counts,
          backgroundColor: useLineChart ? gradient : 'rgba(220, 53, 69, 0.7)',
          borderColor: 'rgba(220, 53, 69, 1)',
          borderWidth: useLineChart ? 3 : 1,
          tension: 0.4,
          fill: useLineChart,
          pointBackgroundColor: 'rgba(220, 53, 69, 1)',
          pointBorderColor: '#fff',
          pointRadius: useLineChart ? 4 : 0,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1000,
          easing: 'easeOutQuart'
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0,
              font: {
                weight: 'bold'
              }
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          },
          x: {
            grid: {
              display: timeframe !== 'year',
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              maxRotation: 45,
              minRotation: 0,
              font: {
                weight: 'bold'
              }
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: `Blacklisted Domains Added (${timeframeToTitle(timeframe)})`,
            font: {
              size: 16,
              weight: 'bold'
            },
            padding: {
              top: 10,
              bottom: 20
            }
          },
          legend: {
            position: 'top',
            labels: {
              boxWidth: 15,
              usePointStyle: true,
              pointStyle: 'circle',
              font: {
                weight: 'bold'
              }
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleFont: {
              weight: 'bold'
            },
            bodyFont: {
              weight: 'normal'
            },
            padding: 12,
            cornerRadius: 6,
            callbacks: {
              title: function(tooltipItems) {
                const item = tooltipItems[0];
                return `Date: ${item.label}`;
              },
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += context.parsed.y + (context.parsed.y === 1 ? ' domain' : ' domains');
                }
                return label;
              }
            }
          }
        }
      }
    };
    
    if (blacklistChart) {
      blacklistChart.data = chartConfig.data;
      blacklistChart.options = chartConfig.options;
      blacklistChart.config.type = chartConfig.type; // Update chart type
      blacklistChart.update();
    } else {
      blacklistChart = new Chart(ctx, chartConfig);
    }
  } catch (error) {
    console.error('Error loading blacklist stats:', error);
    showAlert('Failed to load blacklist analytics: ' + error.message, 'error');
    
    const chartLoader = document.getElementById('chart-loader');
    if (chartLoader) chartLoader.style.display = 'none';
    
    const noChartData = document.getElementById('no-chart-data');
    if (noChartData) {
      noChartData.style.display = 'flex';
      noChartData.querySelector('p').textContent = 'Error loading chart data';
    }
  }
}

function updateTrendIndicator(stats) {
  const trendElement = document.getElementById('trend-indicator');
  if (!trendElement || !stats.counts || stats.counts.length < 2) {
    if (trendElement) trendElement.innerHTML = '<i class="fas fa-minus"></i>';
    return;
  }
  
  // Calculate trend by comparing the latest two periods
  const latestValue = stats.counts[stats.counts.length - 1];
  const previousValue = stats.counts[stats.counts.length - 2];
  
  if (latestValue > previousValue) {
    trendElement.innerHTML = '<i class="fas fa-arrow-up" style="color: #dc3545;"></i> Increasing';
  } else if (latestValue < previousValue) {
    trendElement.innerHTML = '<i class="fas fa-arrow-down" style="color: #28a745;"></i> Decreasing';
  } else {
    trendElement.innerHTML = '<i class="fas fa-equals" style="color: #ffc107;"></i> Stable';
  }
}

function formatLabels(labels, timeframe) {
  if (!labels) return [];
  
  // Format based on timeframe
  switch(timeframe) {
    case 'day':
      // Format hours as "HH:00"
      return labels.map(label => {
        const parts = label.split(' ');
        if (parts.length > 1) {
          return parts[1].substr(0, 5); // Get hour part "HH:00"
        }
        return label;
      });
    case 'year':
      // Format as Month abbreviation
      return labels.map(label => {
        try {
          const date = new Date(label);
          return date.toLocaleString('default', { month: 'short' });
        } catch(e) {
          return label;
        }
      });
    default:
      // For week/month, keep as is or format as needed
      return labels;
  }
}

function timeframeToTitle(timeframe) {
  switch(timeframe) {
    case 'day': return 'Last 24 Hours';
    case 'month': return 'Last 30 Days';
    case 'year': return 'Last 12 Months';
    case 'week': 
    default: return 'Last 7 Days';
  }
}

// Add function for export button setup
function setupExportButton() {
  const exportBtn = document.getElementById('export-blacklist');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportBlacklist);
  }
}

// Add function to export blacklist data
function exportBlacklist() {
  try {
    // Show loading state on button
    const exportBtn = document.getElementById('export-blacklist');
    const originalText = exportBtn.innerHTML;
    exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
    
    // Get current blacklist data
    const blacklist = [...window.state.allBlacklist] || [];
    
    if (!blacklist.length) {
      showAlert('No domains available to export', 'warning');
      exportBtn.innerHTML = originalText;
      return;
    }
    
    // Create CSV content with header
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "URL,Risk Level,Added By,Date Added\n";
    
    // Add each domain as a row
    blacklist.forEach(item => {
      // Format each field with proper CSV escaping
      const formatForCsv = (str) => {
        if (str === null || str === undefined) return '';
        return `"${String(str).replace(/"/g, '""')}"`;
      };
      
      let addedBy = item.is_system ? 'System' : (item.addedByUser || 'Admin');
      
      // Build row with all fields
      const row = [
        formatForCsv(item.URL || ''),
        formatForCsv(item.RiskLevel || '100'),
        formatForCsv(addedBy),
        formatForCsv(formatDate(item.AddedDate))
      ];
      
      csvContent += row.join(',') + '\n';
    });
    
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `phishguard_blacklist_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    
    // Trigger download
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    
    // Reset button state
    exportBtn.innerHTML = originalText;
    
    // Show success notification
    showToast('Blacklist exported successfully', 'success');
    
  } catch (error) {
    console.error('Error exporting blacklist:', error);
    showAlert('Failed to export blacklist: ' + error.message, 'error');
    
    // Reset button state
    const exportBtn = document.getElementById('export-blacklist');
    if (exportBtn) {
      exportBtn.innerHTML = '<i class="fas fa-download"></i> Export Blacklist';
    }
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => {
      console.log(`Successfully loaded script: ${src}`);
      resolve();
    };
    script.onerror = (error) => {
      console.error(`Error loading script ${src}:`, error);
      reject(error);
    };
    document.head.appendChild(script);
  });
}
