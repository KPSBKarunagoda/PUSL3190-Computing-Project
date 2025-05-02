/**
 * PhishGuard Admin Dashboard Controller
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Make sure Auth is defined - add fallback if not
    if (typeof Auth === 'undefined') {
      console.warn('Auth object not found, creating fallback');
      
      // Create fallback Auth object
      window.Auth = {
        isAuthenticated() {
          return !!localStorage.getItem('phishguard_admin_token');
        },
        getUser() {
          try {
            const adminJson = localStorage.getItem('phishguard_admin');
            return adminJson ? JSON.parse(adminJson) : null;
          } catch (e) {
            return null;
          }
        },
        logout() {
          localStorage.removeItem('phishguard_admin_token');
          localStorage.removeItem('phishguard_admin');
          window.location.href = 'index.html?action=logout';
        }
      };
    }
    
    // Verify authentication
    if (!Auth.isAuthenticated()) {
      console.log('Not authenticated, redirecting to login page');
      window.location.href = 'index.html';
      return;
    }
    
    // Get admin info
    const admin = Auth.getUser();
    if (admin) {
      // Update UI with admin name
      const usernameElement = document.getElementById('admin-username');
      if (usernameElement) {
        usernameElement.textContent = admin.username || 'Admin';
      }
      const currentUser = document.getElementById('current-user');
      if (currentUser) {
        currentUser.textContent = admin.username || 'Admin';
      }
    }
    
    // Initialize dashboard components
    initSidebarToggle();
    await loadSystemStats();
    initActivityAnalytics();
    
  } catch (error) {
    console.error('Dashboard initialization error:', error);
    
    // Try to continue with basic functionality even if there's an error
    initSidebarToggle();
    try {
      await loadSystemStats();
    } catch (e) {
      console.error('Failed to load statistics:', e);
    }
  }
});

function initSidebarToggle() {
  const toggleBtn = document.getElementById('sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      document.querySelector('main').classList.toggle('expanded');
    });
  }
}

async function loadSystemStats() {
  try {
    // Find all stat value elements
    const statElements = document.querySelectorAll('.stat-card .stat-value');
    
    // Show loading spinners
    statElements.forEach(element => {
      element.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    });
    
    // Fetch stats from API
    const stats = await dashboardAPI.getStats();
    console.log('Dashboard stats loaded:', stats);
    
    // Map stat type to data key
    const statKeyMap = {
      'users': 'usersCount',
      'whitelist': 'whitelistCount',
      'blacklist': 'blacklistCount',
      'scans': 'totalScans'
    };
    
    // Update each stat element based on its data attribute or id
    statElements.forEach(element => {
      // Try to determine which stat this element represents
      let statType = null;
      
      // Try getting stat type from data attribute
      if (element.dataset.statType) {
        statType = element.dataset.statType;
      }
      // Try getting from parent card's id
      else if (element.closest('.stat-card') && element.closest('.stat-card').id) {
        const cardId = element.closest('.stat-card').id;
        Object.keys(statKeyMap).forEach(key => {
          if (cardId.includes(key)) {
            statType = key;
          }
        });
      }
      // Try getting from the element's ID
      else if (element.id) {
        Object.keys(statKeyMap).forEach(key => {
          if (element.id.includes(key)) {
            statType = key;
          }
        });
      }
      
      // Update element if we found its type and corresponding data exists
      if (statType && statKeyMap[statType] && stats[statKeyMap[statType]] !== undefined) {
        element.textContent = stats[statKeyMap[statType]].toLocaleString();
      } else {
        element.textContent = '0';
      }
    });
    
    console.log('UI updated with stats');
  } catch (error) {
    console.error('Error loading system statistics:', error);
    
    // Show error in stats containers
    const statElements = document.querySelectorAll('.stat-card .stat-value');
    statElements.forEach(element => {
      element.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error';
    });
  }
}

// Add event listener for logout button (as a backup to the common.js handler)
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Use direct logout implementation as fallback
      localStorage.removeItem('phishguard_admin_token');
      localStorage.removeItem('phishguard_admin');
      window.location.href = 'index.html?action=logout';
    });
  }
});

// Analytics variables
let activityChart = null;

/**
 * Initialize activity analytics components
 */
function initActivityAnalytics() {
  // Get filter elements
  const dateRangeFilter = document.getElementById('date-range');
  const chartTypeFilter = document.getElementById('chart-type');
  const refreshBtn = document.getElementById('refresh-analytics');
  
  // Add event listeners
  if (dateRangeFilter) {
    dateRangeFilter.addEventListener('change', loadActivityData);
  }
  
  if (chartTypeFilter) {
    chartTypeFilter.addEventListener('change', loadActivityData);
  }
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      const icon = refreshBtn.querySelector('i');
      if (icon) icon.classList.add('fa-spin');
      
      loadActivityData().finally(() => {
        setTimeout(() => {
          if (icon) icon.classList.remove('fa-spin');
        }, 500);
      });
    });
  }
  
  // Initial data load
  loadActivityData();
}

/**
 * Load activity analytics data
 */
async function loadActivityData() {
  // Show loading state
  const loader = document.getElementById('analytics-loader');
  if (loader) loader.style.display = 'flex';
  
  try {
    // Get filter values
    const daysValue = document.getElementById('date-range')?.value || 30;
    const chartType = document.getElementById('chart-type')?.value || 'line';
    
    console.log(`Loading activity data for the past ${daysValue} days`);
    
    // Fetch data from API
    const data = await analyticsAPI.getActivityAnalytics({ days: daysValue });
    
    // Update summary stats
    updateSummaryStats(data);
    
    // Update chart
    renderActivityChart(data, chartType);
    
  } catch (error) {
    console.error('Error loading activity data:', error);
    
    // Generate sample data if API fails
    const daysValue = document.getElementById('date-range')?.value || 30;
    const chartType = document.getElementById('chart-type')?.value || 'line';
    
    const sampleData = generateSampleData(parseInt(daysValue));
    updateSummaryStats(sampleData);
    renderActivityChart(sampleData, chartType);
    
  } finally {
    // Hide loading state
    if (loader) loader.style.display = 'none';
  }
}

/**
 * Update summary statistics
 */
function updateSummaryStats(data) {
  document.getElementById('total-activities').textContent = data.totalActivities || 0;
  document.getElementById('high-risk-count').textContent = data.highRiskCount || 0;
  document.getElementById('medium-risk-count').textContent = data.mediumRiskCount || 0;
  document.getElementById('low-risk-count').textContent = data.lowRiskCount || 0;
}

/**
 * Render activity chart
 */
function renderActivityChart(data, chartType) {
  const ctx = document.getElementById('activity-chart');
  if (!ctx) return;
  
  // Destroy existing chart if it exists
  if (activityChart) {
    activityChart.destroy();
  }
  
  // Prepare chart data
  let chartData;
  let options;
  
  if (chartType === 'pie') {
    // Pie chart for risk distribution
    chartData = {
      labels: ['Low Risk', 'Medium Risk', 'High Risk'],
      datasets: [{
        data: [
          data.lowRiskCount || 0,
          data.mediumRiskCount || 0,
          data.highRiskCount || 0
        ],
        backgroundColor: [
          'rgba(76, 175, 80, 0.7)',  // Green for low risk
          'rgba(255, 170, 0, 0.7)',   // Orange for medium risk
          'rgba(255, 82, 82, 0.7)'    // Red for high risk
        ],
        borderWidth: 1
      }]
    };
    
    options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
          }
        },
        title: {
          display: true,
          text: 'Risk Distribution',
          color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary'),
          font: {
            size: 16
          }
        }
      }
    };
  } else {
    // Line or bar chart for activity over time
    chartData = {
      labels: data.labels || [],
      datasets: [{
        label: 'Activity Count',
        data: data.counts || [],
        backgroundColor: chartType === 'line' ? 'rgba(61, 133, 198, 0.2)' : 'rgba(61, 133, 198, 0.7)',
        borderColor: 'rgba(61, 133, 198, 1)',
        borderWidth: 2,
        tension: 0.4,
        fill: chartType === 'line'
      }]
    };
    
    options = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary')
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.7)'
        }
      }
    };
  }
  
  // Create chart
  activityChart = new Chart(ctx, {
    type: chartType,
    data: chartData,
    options: options
  });
}

/**
 * Generate sample data for testing when API is not available
 */
function generateSampleData(daysValue = 30) {
  const labels = [];
  const counts = [];
  
  // Generate dates for the past X days
  const today = new Date();
  
  for (let i = daysValue - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    
    // Format as MM/DD
    const month = date.getMonth() + 1;
    const day = date.getDate();
    labels.push(`${month}/${day}`);
    
    // Generate random activity count (1-20)
    counts.push(Math.floor(Math.random() * 20) + 1);
  }
  
  // Generate risk counts
  const highRiskCount = Math.floor(Math.random() * 50) + 20;
  const mediumRiskCount = Math.floor(Math.random() * 100) + 50;
  const lowRiskCount = Math.floor(Math.random() * 150) + 100;
  const totalActivities = highRiskCount + mediumRiskCount + lowRiskCount;
  
  return {
    labels,
    counts,
    totalActivities,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount
  };
}
