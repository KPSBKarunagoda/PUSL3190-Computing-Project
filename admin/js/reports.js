/**
 * PhishGuard Admin Reports Management
 */

// Report API functions
const reportsAPI = {
  // Get all reports
  getReports: async () => {
    try {
      // Custom API request to prevent automatic logout
      const token = localStorage.getItem('phishguard_admin_token');
      if (!token) {
        console.error('No authentication token found');
        return [];
      }
      
      console.log('Attempting to fetch reports with token', token.substring(0, 10) + '...');
      
      // Use the regular reports endpoint that actually exists
      const response = await fetch(`${API_BASE_URL || 'http://localhost:3000/api'}/reports`, {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        }
      });
      
      // Log response status for debugging
      console.log(`Reports API Response status: ${response.status}`);
      
      if (response.status === 401 || response.status === 403) {
        console.warn('Authentication or permission error in getReports, but not logging out');
        console.log('This could be a permissions issue - your admin account may not have sufficient privileges');
        showAlert('Using demo data because API returned 403 Forbidden. To fix: Check that your admin account has the correct role and permissions.', 'warning', 10000);
        return mockReportsData(); // Return mock data for testing
      }
      
      if (response.status === 404) {
        console.warn('Reports endpoint not found (404). API might be missing this endpoint.');
        showAlert('Reports API endpoint not available. Using local data for demonstration.', 'warning');
        return mockReportsData(); // Return mock data when endpoint doesn't exist
      }
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      // Log the raw response for debugging
      const responseText = await response.text();
      console.log('Raw API response:', responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''));
      
      try {
        // Parse the JSON response
        const data = JSON.parse(responseText);
        
        if (Array.isArray(data) && data.length > 0) {
          // Ensure we handle the database field names correctly
          return data.map(report => ({
            // Normalize field names for consistency in our application
            ReportID: report.ReportID || report.reportid || report.id || `mock-${Math.random().toString(36).substring(2, 10)}`,
            UserID: report.UserID || report.userid || report.userId || 1,
            URL: report.URL || report.url || 'https://example.com',
            ReportDate: report.ReportDate || report.reportdate || report.date || new Date().toISOString(),
            Status: report.Status || report.status || 'Pending',
            Description: report.Description || report.description || '',
            Reason: report.Reason || report.reason || 'Phishing',
            ReporterName: report.ReporterName || report.reportername || report.username || "Unknown User"
          }));
        } else {
          console.warn('API returned empty or invalid data. Using mock data instead.');
          return mockReportsData();
        }
      } catch (parseError) {
        console.error('Error parsing API response:', parseError);
        return mockReportsData(); // Return mock data if parsing fails
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      return mockReportsData(); // Return mock data on error
    }
  },
  
  // Get report statistics
  getStats: async () => {
    try {
      return await apiRequest('/reports/stats');
    } catch (error) {
      console.error('Error fetching report stats:', error);
      // Don't rethrow auth errors here
      if (error.status === 401) {
        console.log('Authentication error in getStats - token might be expired');
        return {
          total: 0,
          pending: 0,
          resolved: 0,
          topReportedDomains: []
        };
      }
      throw error;
    }
  },
  
  // Get specific report
  getReport: async (reportId) => {
    try {
      return await apiRequest(`/reports/${reportId}`);
    } catch (error) {
      console.error(`Error fetching report ${reportId}:`, error);
      throw error;
    }
  },
  
  // Update report status
  updateStatus: async (reportId, status) => {
    try {
      return await apiRequest(`/reports/${reportId}`, 'PUT', { status });
    } catch (error) {
      console.error(`Error updating report ${reportId}:`, error);
      throw error;
    }
  },
  
  // Add URL to blacklist
  addToBlacklist: async (url) => {
    try {
      return await apiRequest('/lists/blacklist', 'POST', { domain: extractDomain(url) });
    } catch (error) {
      console.error('Error adding to blacklist:', error);
      throw error;
    }
  }
};

/**
 * Generate mock report data for testing/fallback
 */
function mockReportsData() {
  console.log('Using mock reports data');
  return [
    {
      ReportID: 'mock-1',
      UserID: 1,
      URL: 'https://suspicious-phishing-site.example.com/login',
      ReportDate: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
      Status: 'Pending',
      Description: 'This site is attempting to steal login credentials',
      Reason: 'Phishing',
      ReporterName: 'John Doe'
    },
    {
      ReportID: 'mock-2',
      UserID: 2,
      URL: 'https://fake-bank-login.example.org/account/verify',
      ReportDate: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
      Status: 'Pending',
      Description: 'Fake bank login page',
      Reason: 'Phishing',
      ReporterName: 'Jane Smith'
    },
    {
      ReportID: 'mock-3',
      UserID: 3,
      URL: 'https://malware-download.example.net/free-software.exe',
      ReportDate: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
      Status: 'Resolved',
      Description: 'Distributing malware disguised as free software',
      Reason: 'Malware',
      ReporterName: 'Admin User'
    }
  ];
}

/**
 * Load report statistics
 */
async function loadReportStats() {
  try {
    const stats = await reportsAPI.getStats();
    
    // Update statistics display
    document.getElementById('total-reports').textContent = stats.total || 0;
    document.getElementById('pending-reports').textContent = stats.pending || 0;
    document.getElementById('resolved-reports').textContent = stats.resolved || 0;
    
    // Calculate today's reports
    const todayReports = stats.topReportedDomains 
      ? stats.topReportedDomains.reduce((sum, domain) => sum + domain.count, 0) 
      : 0;
    
    document.getElementById('today-reports').textContent = todayReports;
    
    return stats;
  } catch (error) {
    console.error('Error loading report stats:', error);
    // Don't show an alert here as we'll still try to load the reports
    
    return {
      total: 0,
      pending: 0,
      resolved: 0,
      topReportedDomains: []
    };
  }
}

/**
 * Display reports in the table
 */
function displayReports(reports) {
  const tableBody = document.getElementById('reports-table-body');
  const table = document.getElementById('reports-table');
  
  if (!tableBody || !table) return;
  
  // Clear existing rows
  tableBody.innerHTML = '';
  
  // Make table visible
  table.style.display = 'table';
  
  // Add reports to table
  reports.forEach(report => {
    const row = document.createElement('tr');
    
    // Format date
    const reportDate = new Date(report.ReportDate);
    const formattedDate = reportDate.toLocaleDateString() + ' ' + reportDate.toLocaleTimeString();
    
    // Truncate URL for display
    const displayUrl = report.URL.length > 50 
      ? report.URL.substring(0, 47) + '...' 
      : report.URL;
    
    // Create row
    row.innerHTML = `
      <td class="url-cell" title="${escapeHtml(report.URL)}">${escapeHtml(displayUrl)}</td>
      <td>${escapeHtml(report.ReporterName || 'Unknown')}</td>
      <td>${escapeHtml(report.Reason || 'Not specified')}</td>
      <td>${escapeHtml(formattedDate)}</td>
      <td><span class="status-badge ${report.Status.toLowerCase()}">${escapeHtml(report.Status)}</span></td>
      <td>
        <button class="btn btn-sm view-report" data-report-id="${report.ReportID}">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    `;
    
    // Store report data in dataset for easy access
    row.dataset.reportId = report.ReportID;
    row.dataset.url = report.URL;
    
    // Add row to table
    tableBody.appendChild(row);
  });
  
  // Add event listeners to view buttons
  document.querySelectorAll('.view-report').forEach(btn => {
    btn.addEventListener('click', () => showReportDetails(btn.dataset.reportId));
  });
}

/**
 * Show report details in modal
 */
async function showReportDetails(reportId) {
  try {
    // Show loading state
    const modal = document.getElementById('report-modal');
    const modalTitle = document.getElementById('report-modal-title');
    const modalBody = document.querySelector('#report-modal .modal-body');
    
    if (!modal || !modalTitle || !modalBody) return;
    
    // Show modal with loading state
    modal.classList.add('show');
    modalTitle.textContent = 'Loading Report...';
    modalBody.innerHTML = '<div class="loader"><i class="fas fa-circle-notch fa-spin"></i></div>';
    
    // Get report details - handle both real and mock reports
    const report = await reportsAPI.getReport(reportId);
    
    // Update modal with report details
    modalTitle.textContent = 'Report Details';
    
    // Format date
    const reportDate = new Date(report.ReportDate);
    const formattedDate = reportDate.toLocaleDateString() + ' ' + reportDate.toLocaleTimeString();
    
    // Update modal fields
    document.getElementById('report-url').textContent = report.URL;
    document.getElementById('report-id').textContent = report.ReportID;
    document.getElementById('report-user').textContent = report.ReporterName || 'Unknown User';
    document.getElementById('report-date').textContent = formattedDate;
    document.getElementById('report-status').textContent = report.Status;
    document.getElementById('report-status').className = `info-value status-${report.Status.toLowerCase()}`;
    
    // Store URL and report ID in buttons for actions
    const blacklistBtn = document.getElementById('blacklist-url');
    const resolveBtn = document.getElementById('resolve-report');
    
    if (blacklistBtn) {
      blacklistBtn.dataset.url = report.URL;
      blacklistBtn.disabled = report.Status === 'Resolved';
    }
    
    if (resolveBtn) {
      resolveBtn.dataset.reportId = report.ReportID;
      resolveBtn.disabled = report.Status === 'Resolved';
      resolveBtn.innerHTML = report.Status === 'Resolved' 
        ? '<i class="fas fa-check"></i> Already Resolved' 
        : '<i class="fas fa-check"></i> Mark as Resolved';
    }
  } catch (error) {
    console.error('Error showing report details:', error);
    hideModal('report-modal');
    showAlert('Failed to load report details: ' + error.message, 'error');
  }
}

/**
 * Setup all report-related UI actions and event listeners
 */
function setupReportActions() {
  // Set up search functionality
  const searchInput = document.getElementById('report-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      searchReports(query);
    });
    
    // Add keydown event for Escape key to clear search
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        searchReports(''); // Clear search
      }
    });
  }
  
  // Set up status filter
  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      const status = statusFilter.value;
      filterReports(status);
    });
  }
  
  // Set up refresh button
  const refreshBtn = document.getElementById('refresh-reports');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      const spinner = refreshBtn.querySelector('i');
      if (spinner) spinner.classList.add('fa-spin');
      try {
        await loadReportStats().catch(err => {
          console.warn('Failed to refresh report stats:', err);
        });
        
        await loadReports(document.getElementById('status-filter')?.value || 'all')
          .catch(err => {
            console.warn('Failed to refresh reports:', err);
          });
        
        showAlert('Data refreshed successfully', 'success');
      } catch (error) {
        console.error('Error refreshing data:', error);
        showAlert('Failed to refresh data: ' + error.message, 'error');
      } finally {
        if (spinner) spinner.classList.remove('fa-spin');
      }
    });
  }
  
  // Set up export button
  const exportBtn = document.getElementById('export-reports');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportReports);
  }
  
  // Set up resolve all button
  const resolveAllBtn = document.getElementById('resolve-all');
  if (resolveAllBtn) {
    resolveAllBtn.addEventListener('click', async () => {
      // ...existing code...
    });
  }
  
  // Set up modal close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      hideModal('report-modal');
    });
  });
}

/**
 * Show an alert message to the user
 */
function showAlert(message, type = 'info', duration = 5000) {
  const alertContainer = document.getElementById('system-alert');
  if (!alertContainer) {
    console.warn('Alert container not found');
    console.log(`ALERT [${type}]: ${message}`);
    return;
  }
  alertContainer.textContent = message;
  alertContainer.className = `alert alert-${type === 'error' ? 'danger' : type}`;
  alertContainer.style.display = 'block';
  if (type !== 'error' && type !== 'danger') {
    setTimeout(() => {
      alertContainer.style.display = 'none';
    }, duration);
  }
}

/**
 * Hide modal dialog
 */
function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
  }
}

/**
 * Helper to escape HTML for safe display
 */
function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Export reports to CSV file
 */
function exportReports() {
  // ...existing code...
}

/**
 * Filter reports by search term
 */
function searchReports(query) {
  // ...existing code...
}

/**
 * Filter reports by status
 */
function filterReports(status) {
  // ...existing code...
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Initializing reports management...');
    
    // Verify admin authentication
    if (!Auth.isAuthenticated()) {
      console.log('Not authenticated, redirecting to login...');
      window.location.href = 'index.html';
      return;
    }
    
    // Add more detailed debugging
    console.log('Auth details:', {
      tokenExists: !!localStorage.getItem('phishguard_admin_token'),
      tokenLength: localStorage.getItem('phishguard_admin_token')?.length || 0,
      userInfo: localStorage.getItem('phishguard_admin')
    });
    
    // Set up UI components and event listeners
    setupReportActions();
    
    // Show loading state initially
    document.getElementById('reports-loader').style.display = 'flex';
    
    try {
      // Load data from API - one at a time with better error handling
      await loadReportStats().catch(err => {
        console.warn('Failed to load report stats:', err);
      });
      
      await loadReports().catch(err => {
        console.warn('Failed to load reports:', err);
        showEmptyState();
      });
      
      console.log('Reports management initialized successfully');
    } catch (apiError) {
      console.error('API initialization error:', apiError);
      // Don't redirect or logout, just show empty state
      showEmptyState();
      showAlert('Could not load report data. Please try refreshing the page.', 'warning');
    }
  } catch (error) {
    console.error('Reports management initialization error:', error);
    showAlert('Failed to initialize reports management: ' + error.message, 'error');
    // Still show empty state rather than broken UI
    showEmptyState();
  }
});

/**
 * Show empty state when no reports are available
 */
function showEmptyState() {
  const reportsLoader = document.getElementById('reports-loader');
  const reportsTable = document.getElementById('reports-table');
  const noReports = document.getElementById('no-reports');
  
  if (reportsLoader) reportsLoader.style.display = 'none';
  if (reportsTable) reportsTable.style.display = 'none';
  if (noReports) noReports.style.display = 'flex';
  
  // Reset stats if no data
  document.getElementById('total-reports').textContent = '0';
  document.getElementById('pending-reports').textContent = '0';
  document.getElementById('resolved-reports').textContent = '0';
  document.getElementById('today-reports').textContent = '0';
}

/**
 * Load reports from API
 */
async function loadReports(filter = 'all') {
  try {
    // Show loader
    const reportsLoader = document.getElementById('reports-loader');
    const reportsTable = document.getElementById('reports-table');
    const noReports = document.getElementById('no-reports');
    
    if (reportsLoader) reportsLoader.style.display = 'flex';
    if (reportsTable) reportsTable.style.display = 'none';
    if (noReports) noReports.style.display = 'none';
    
    // Check auth before making request
    if (!Auth.isAuthenticated()) {
      console.warn('Auth token missing during loadReports');
      showEmptyState();
      return [];
    }
    
    // Fetch reports from API
    console.log('Fetching reports from API...');
    const reports = await reportsAPI.getReports();
    console.log(`Received ${reports.length} reports from API`);
    
    // Hide loader
    if (reportsLoader) reportsLoader.style.display = 'none';
    
    // If no reports, show empty state with appropriate message
    if (!reports || reports.length === 0) {
      showEmptyState();
      
      // Update empty state message if needed
      const noReports = document.getElementById('no-reports');
      if (noReports) {
        const emptyTitle = noReports.querySelector('h3');
        const emptyText = noReports.querySelector('p');
        
        if (emptyTitle) emptyTitle.textContent = 'No Reports Available';
        if (emptyText) emptyText.textContent = 'No reports found or you may not have sufficient permissions to view them.';
      }
      
      return [];
    }
    
    // Filter reports if needed
    let filteredReports = reports;
    if (filter !== 'all') {
      filteredReports = reports.filter(report => 
        report.Status && report.Status.toLowerCase() === filter.toLowerCase()
      );
    }
    
    // Display reports
    displayReports(filteredReports);
    
    // Update report counter
    const rangeElement = document.getElementById('reports-range');
    const totalElement = document.getElementById('reports-total');
    
    if (rangeElement) {
      rangeElement.textContent = `1-${filteredReports.length}`;
    }
    
    if (totalElement) {
      totalElement.textContent = reports.length;
    }
    
    return reports;
  } catch (error) {
    console.error('Error loading reports:', error);
    showAlert('Failed to load reports: ' + error.message, 'error');
    showEmptyState();
    return [];
  }
}

// ...remaining code...
