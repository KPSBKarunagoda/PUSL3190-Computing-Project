/**
 * PhishGuard Admin Dashboard JavaScript
 * Handles dashboard functionality and data loading
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Skip dashboard code on non-dashboard pages
  if (!document.querySelector('.content-header h1')?.textContent.includes('Dashboard')) {
    return;
  }
  
  // Check if admin is logged in - CHANGED TOKEN KEY
  const token = localStorage.getItem('phishguard_admin_token');
  if (!token) {
    window.location.href = 'index.html'; // Redirect to admin login
    return;
  }
  
  // Get admin user info - CHANGED KEY
  const adminUserJson = localStorage.getItem('phishguard_admin');
  let adminUser;
  
  try {
    adminUser = JSON.parse(adminUserJson);
    // Verify it's actually an admin
    if (!adminUser || adminUser.role !== 'Admin') {
      throw new Error('Not an admin user');
    }
    
    // Set admin name in UI if available
    const currentUserElement = document.getElementById('current-user');
    if (currentUserElement && adminUser.username) {
      currentUserElement.textContent = adminUser.username;
    }
  } catch (error) {
    console.error('Admin verification error:', error);
    // Redirect to login if not a valid admin
    localStorage.removeItem('phishguard_admin_token');
    localStorage.removeItem('phishguard_admin');
    window.location.href = 'index.html';
    return;
  }
  
  console.log('Initializing dashboard...');
  
  try {
    // Load system statistics
    await loadSystemStats();
    
    // Load recent activity
    await loadRecentActivity();
    
    // Set up refresh buttons
    DOM.get('refresh-activity')?.addEventListener('click', loadRecentActivity);
    
    // Set up maintenance button
    const maintenanceBtn = DOM.get('run-maintenance');
    if (maintenanceBtn) {
      maintenanceBtn.addEventListener('click', runSystemMaintenance);
    }
    
  } catch (error) {
    console.error('Dashboard initialization error:', error);
    DOM.showAlert('Failed to load dashboard data: ' + error.message, 'danger');
  }
});

// Load system statistics
async function loadSystemStats() {
  console.log('Loading system statistics...');
  
  try {
    // Show loading state
    ['users-count', 'whitelist-count', 'blacklist-count', 'scans-count'].forEach(id => {
      const el = DOM.get(id);
      if (el) el.textContent = '...';
    });
    
    // Fetch statistics data
    const stats = await dashboardAPI.getStats();
    console.log('System stats received:', stats);
    
    // Update UI
    if (stats) {
      DOM.get('users-count').textContent = stats.usersCount || 0;
      DOM.get('whitelist-count').textContent = stats.whitelistCount || 0;
      DOM.get('blacklist-count').textContent = stats.blacklistCount || 0;
      DOM.get('scans-count').textContent = stats.totalScans || 0;
    }
  } catch (error) {
    console.error('Error loading system statistics:', error);
    // Set default values on error
    ['users-count', 'whitelist-count', 'blacklist-count', 'scans-count'].forEach(id => {
      const el = DOM.get(id);
      if (el) el.textContent = '0';
    });
    throw error;
  }
}

// Load recent activity
async function loadRecentActivity() {
  console.log('Loading recent activity...');
  
  try {
    // Show loading state
    const loader = DOM.get('activity-loader');
    const table = DOM.get('activity-table');
    const empty = DOM.get('no-activity');
    
    if (loader) loader.style.display = 'flex';
    if (table) table.style.display = 'none';
    if (empty) empty.style.display = 'none';
    
    // Fetch activity data
    const data = await dashboardAPI.getActivity();
    console.log('Activity data received:', data);
    
    // Update UI
    const activityBody = DOM.get('activity-body');
    if (!activityBody) return;
    
    if (loader) loader.style.display = 'none';
    
    // Check if we have activity data
    if (!data.activities || data.activities.length === 0) {
      if (table) table.style.display = 'none';
      if (empty) empty.style.display = 'flex';
      return;
    }
    
    // Show table with data
    if (table) table.style.display = 'table';
    activityBody.innerHTML = '';
    
    // Render activity items
    data.activities.forEach(activity => {
      const row = document.createElement('tr');
      
      row.innerHTML = `
        <td>${activity.action || 'Unknown action'}</td>
        <td>${activity.user || 'System'}</td>
        <td>${activity.details || '-'}</td>
        <td>${DateTime.formatDateTime(activity.timestamp)}</td>
      `;
      
      activityBody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading recent activity:', error);
    throw error;
  }
}

// Run system maintenance
async function runSystemMaintenance() {
  const confirmRun = confirm('Are you sure you want to run system maintenance? This may take a few moments.');
  if (!confirmRun) return;
  
  const maintenanceBtn = DOM.get('run-maintenance');
  
  try {
    // Show loading state
    DOM.buttonState(maintenanceBtn, true, null, 'Running...');
    DOM.showAlert('Maintenance task started. Please wait...', 'info');
    
    // Call API endpoint
    const response = await fetch('/api/admin/maintenance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': Auth.getToken()
      }
    });
    
    if (!response.ok) {
      throw new Error('Maintenance task failed');
    }
    
    const result = await response.json();
    
    // Show success message
    DOM.showAlert('Maintenance completed successfully: ' + (result.message || 'System optimized'), 'success');
    
    // Refresh stats
    await loadSystemStats();
    await loadRecentActivity();
  } catch (error) {
    console.error('Maintenance error:', error);
    DOM.showAlert('Maintenance error: ' + error.message, 'danger');
  } finally {
    // Restore button state
    DOM.buttonState(maintenanceBtn, false);
  }
}
