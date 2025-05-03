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
    
    // Load blacklist data
    await loadBlacklist();
    await loadBlacklistStats();
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
