/**
 * PhishGuard Admin Reports Management
 */

// Report API functions with improved error handling
const reportsAPI = {
  // Get all reports
  getReports: async () => {
    try {
      const token = localStorage.getItem('phishguard_admin_token');
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }
      
      const response = await fetch(`${API_BASE_URL || 'http://localhost:3000/api'}/admin/reports`, {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        }
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} - ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Normalize field names for consistency
      return Array.isArray(data) ? data.map(report => ({
        ReportID: report.ReportID || report.reportid || report.id,
        UserID: report.UserID || report.userid || report.userId,
        URL: report.URL || report.url,
        ReportDate: report.ReportDate || report.reportdate || report.date,
        Status: report.Status || report.status || 'Pending',
        Description: report.Description || report.description || '',
        Reason: report.Reason || report.reason || 'Phishing',
        ReporterName: report.ReporterName || report.reportername || report.username || report.user?.username || "Unknown User"
      })) : [];
    } catch (error) {
      console.error('Error fetching reports:', error);
      showAlert('Failed to fetch reports: ' + error.message, 'error');
      throw error;
    }
  },
  
  // Get report statistics
  getStats: async () => {
    try {
      const token = localStorage.getItem('phishguard_admin_token');
      if (!token) throw new Error('Authentication required');
      
      try {
        const response = await fetch(`${API_BASE_URL || 'http://localhost:3000/api'}/admin/reports/stats`, {
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token
          }
        });
        
        if (!response.ok) {
          throw new Error(`Stats API error: ${response.status}`);
        }
        
        return await response.json();
      } catch (statsError) {
        return calculateStatsFromReports(await reportsAPI.getReports());
      }
    } catch (error) {
      console.error('Error fetching report stats:', error);
      throw error;
    }
  },
  
  // Get specific report
  getReport: async (reportId) => {
    try {
      const token = localStorage.getItem('phishguard_admin_token');
      if (!token) throw new Error('Authentication required');
      
      try {
        const response = await fetch(`${API_BASE_URL || 'http://localhost:3000/api'}/admin/reports/${reportId}`, {
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token
          }
        });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
      } catch (singleReportError) {
        // Fall back to getting all reports and finding the specific one
        const reports = await reportsAPI.getReports();
        const report = reports.find(r => r.ReportID == reportId);
        if (!report) throw new Error('Report not found');
        return report;
      }
    } catch (error) {
      console.error(`Error fetching report ${reportId}:`, error);
      throw error;
    }
  },
  
  // Update report status
  updateStatus: async (reportId, status) => {
    try {
      const token = localStorage.getItem('phishguard_admin_token');
      if (!token) throw new Error('Authentication required');
      
      const response = await fetch(`${API_BASE_URL || 'http://localhost:3000/api'}/admin/reports/${reportId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({ status })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error updating report ${reportId}:`, error);
      throw error;
    }
  },
  
  // Add URL to blacklist
  addToBlacklist: async (url) => {
    try {
      const domain = extractDomain(url);
      const token = localStorage.getItem('phishguard_admin_token');
      if (!token) throw new Error('Authentication required');
      
      const response = await fetch(`${API_BASE_URL || 'http://localhost:3000/api'}/lists/blacklist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({ domain }) 
      });
      
      if (!response.ok) {
        throw new Error(`Failed to add to blacklist: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error adding to blacklist:', error);
      throw error;
    }
  }
};

// Helper functions
function extractDomain(url) {
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    const parsed = new URL(url);
    return parsed.hostname;
  } catch (e) {
    return url;
  }
}

function calculateStatsFromReports(reports) {
  if (!Array.isArray(reports)) return {
    total: 0,
    pending: 0,
    resolved: 0,
    todayCount: 0
  };
  
  const stats = {
    total: reports.length,
    pending: 0,
    resolved: 0,
    todayCount: 0
  };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  reports.forEach(report => {
    if (report.Status?.toLowerCase() === 'resolved') {
      stats.resolved++;
    } else {
      stats.pending++;
    }
    
    const reportDate = new Date(report.ReportDate);
    if (reportDate >= today) {
      stats.todayCount++;
    }
  });
  
  return stats;
}

// Page initialization
document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (!Auth.isAuthenticated()) {
      showAlert('Authentication required. Please log in.', 'error');
      return;
    }

    setupReportActions();
    
    const reportsLoader = document.getElementById('reports-loader');
    if (reportsLoader) reportsLoader.style.display = 'flex';
    
    try {
      await loadReportStats();
      await loadReports();
    } catch (error) {
      showEmptyState('Error Loading Reports', 'Could not load reports from the server. Please try again.');
    }
  } catch (error) {
    console.error('Reports initialization error:', error);
    showAlert('Failed to initialize reports management', 'error');
    showEmptyState();
  }
});

// UI Functions
function setupReportActions() {
  const searchInput = document.getElementById('report-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      searchReports(query);
    });
  }
  
  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      const status = statusFilter.value;
      loadReports(status);
    });
  }
  
  const refreshBtn = document.getElementById('refresh-reports');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      const spinner = refreshBtn.querySelector('i');
      if (spinner) spinner.classList.add('fa-spin');
      
      try {
        await loadReportStats();
        await loadReports(document.getElementById('status-filter')?.value || 'all');
        showAlert('Data refreshed successfully', 'success');
      } catch (error) {
        showAlert('Failed to refresh data: ' + error.message, 'error');
      } finally {
        if (spinner) spinner.classList.remove('fa-spin');
      }
    });
  }
  
  const exportBtn = document.getElementById('export-reports');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportReports);
  }
  
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => hideModal('report-modal'));
  });

  const resolveAllBtn = document.getElementById('resolve-all');
  if (resolveAllBtn) {
    resolveAllBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to mark ALL pending reports as resolved?')) {
        resolveAllReports();
      }
    });
  }
}

function searchReports(query) {
  if (!query) {
    const currentFilter = document.getElementById('status-filter')?.value || 'all';
    loadReports(currentFilter);
    return;
  }
  
  const rows = document.querySelectorAll('#reports-table-body tr');
  let visibleCount = 0;
  
  rows.forEach(row => {
    const url = row.querySelector('.url-cell')?.textContent?.toLowerCase() || '';
    const reporter = row.cells[1]?.textContent?.toLowerCase() || '';
    const date = row.cells[2]?.textContent?.toLowerCase() || '';
    const status = row.querySelector('.status-badge')?.textContent?.toLowerCase() || '';
    
    if (url.includes(query) || reporter.includes(query) || date.includes(query) || status.includes(query)) {
      row.style.display = '';
      visibleCount++;
    } else {
      row.style.display = 'none';
    }
  });
  
  const rangeElement = document.getElementById('reports-range');
  if (rangeElement) rangeElement.textContent = `${visibleCount}`;
  
  const table = document.getElementById('reports-table');
  const noReports = document.getElementById('no-reports');
  
  if (visibleCount === 0 && table) {
    table.style.display = 'none';
    if (noReports) {
      noReports.style.display = 'flex';
      noReports.querySelector('h3').textContent = 'No Matching Reports';
      noReports.querySelector('p').textContent = `No reports match the search "${query}"`;
    }
  } else {
    if (table) table.style.display = 'table';
    if (noReports) noReports.style.display = 'none';
  }
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('show');
}

function showEmptyState(title = 'No Reports Found', message = 'No reports have been submitted yet.') {
  const reportsLoader = document.getElementById('reports-loader');
  const reportsTable = document.getElementById('reports-table');
  const noReports = document.getElementById('no-reports');
  
  if (reportsLoader) reportsLoader.style.display = 'none';
  if (reportsTable) reportsTable.style.display = 'none';
  if (noReports) {
    noReports.style.display = 'flex';
    const titleElem = noReports.querySelector('h3');
    const messageElem = noReports.querySelector('p');
    if (titleElem) titleElem.textContent = title;
    if (messageElem) messageElem.textContent = message;
  }
}

async function loadReportStats() {
  try {
    const stats = await reportsAPI.getStats();
    
    document.getElementById('total-reports').textContent = stats.total || 0;
    document.getElementById('pending-reports').textContent = stats.pending || 0;
    document.getElementById('resolved-reports').textContent = stats.resolved || 0;
    document.getElementById('today-reports').textContent = stats.todayCount || 0;
    
    return stats;
  } catch (error) {
    console.error('Error loading report stats:', error);
    return { total: 0, pending: 0, resolved: 0, todayCount: 0 };
  }
}

async function loadReports(filter = 'all') {
  try {
    const reportsLoader = document.getElementById('reports-loader');
    const reportsTable = document.getElementById('reports-table');
    const noReports = document.getElementById('no-reports');
    
    if (reportsLoader) reportsLoader.style.display = 'flex';
    if (reportsTable) reportsTable.style.display = 'none';
    if (noReports) noReports.style.display = 'none';
    
    const reports = await reportsAPI.getReports();
    
    if (reportsLoader) reportsLoader.style.display = 'none';
    
    if (!reports || reports.length === 0) {
      showEmptyState();
      return [];
    }
    
    let filteredReports = reports;
    if (filter !== 'all') {
      filteredReports = reports.filter(report => 
        report.Status && report.Status.toLowerCase() === filter.toLowerCase()
      );
      
      if (filteredReports.length === 0) {
        if (reportsTable) reportsTable.style.display = 'none';
        if (noReports) {
          noReports.style.display = 'flex';
          const title = noReports.querySelector('h3');
          const message = noReports.querySelector('p');
          if (title) title.textContent = 'No Matching Reports';
          if (message) message.textContent = `No reports with status "${filter}" found.`;
        }
        return reports;
      }
    }
    
    displayReports(filteredReports);
    
    const rangeElement = document.getElementById('reports-range');
    const totalElement = document.getElementById('reports-total');
    
    if (rangeElement) rangeElement.textContent = `1-${filteredReports.length}`;
    if (totalElement) totalElement.textContent = reports.length;
    
    return reports;
  } catch (error) {
    console.error('Error loading reports:', error);
    showAlert('Failed to load reports: ' + error.message, 'error');
    showEmptyState('Error Loading Reports', 'Failed to load reports. Please check your connection.');
    return [];
  }
}

function displayReports(reports) {
  const tableBody = document.getElementById('reports-table-body');
  const table = document.getElementById('reports-table');
  
  if (!tableBody || !table) return;
  
  tableBody.innerHTML = '';
  table.style.display = 'table';
  
  reports.forEach(report => {
    const row = document.createElement('tr');
    
    let formattedDate = 'Unknown';
    try {
      const reportDate = new Date(report.ReportDate);
      formattedDate = reportDate.toLocaleDateString() + ' ' + reportDate.toLocaleTimeString();
    } catch (e) {}
    
    const displayUrl = report.URL?.length > 50 
      ? report.URL.substring(0, 47) + '...' 
      : report.URL || 'Unknown URL';
    
    row.innerHTML = `
      <td class="url-cell" title="${escapeHtml(report.URL)}">${escapeHtml(displayUrl)}</td>
      <td>${escapeHtml(report.ReporterName || 'Unknown')}</td>
      <td>${escapeHtml(formattedDate)}</td>
      <td><span class="status-badge ${report.Status?.toLowerCase() || 'pending'}">${escapeHtml(report.Status || 'Pending')}</span></td>
      <td>
        <button class="btn btn-sm view-report" data-report-id="${report.ReportID}">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    `;
    
    tableBody.appendChild(row);
  });
  
  document.querySelectorAll('.view-report').forEach(btn => {
    btn.addEventListener('click', () => showReportDetails(btn.dataset.reportId));
  });
}

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

function showAlert(message, type = 'info', duration = 5000) {
  const alertContainer = document.getElementById('system-alert');
  if (!alertContainer) return;
  
  alertContainer.textContent = message;
  alertContainer.className = `alert alert-${type === 'error' ? 'danger' : type}`;
  alertContainer.style.display = 'block';
  
  if (type !== 'error' && type !== 'danger') {
    setTimeout(() => alertContainer.style.display = 'none', duration);
  }
}

async function showReportDetails(reportId) {
  try {
    const modal = document.getElementById('report-modal');
    const modalTitle = document.getElementById('report-modal-title');
    const modalBody = document.querySelector('#report-modal .modal-body');
    
    if (!modal || !modalTitle || !modalBody) return;
    
    modal.classList.add('show');
    modalTitle.textContent = 'Loading Report...';
    modalBody.innerHTML = '<div class="loader"><i class="fas fa-circle-notch fa-spin"></i></div>';
    
    const report = await reportsAPI.getReport(reportId);
    
    modalTitle.textContent = 'Report Details';
    
    let formattedDate = 'Unknown';
    try {
      const reportDate = new Date(report.ReportDate);
      formattedDate = reportDate.toLocaleDateString() + ' ' + reportDate.toLocaleTimeString();
    } catch (e) {}
    
    modalBody.innerHTML = `
      <div class="report-details">
        <div class="report-url-container">
          <h4>Reported URL</h4>
          <p id="report-url" class="report-url">${escapeHtml(report.URL || 'Unknown URL')}</p>
        </div>
        
        <div class="report-info-grid">
          <div class="report-info-item">
            <span class="info-label">Report ID:</span>
            <span id="report-id" class="info-value">${escapeHtml(report.ReportID || 'Unknown')}</span>
          </div>
          <div class="report-info-item">
            <span class="info-label">Reported By:</span>
            <span id="report-user" class="info-value">${escapeHtml(report.ReporterName || 'Unknown User')}</span>
          </div>
          <div class="report-info-item">
            <span class="info-label">Report Date:</span>
            <span id="report-date" class="info-value">${escapeHtml(formattedDate)}</span>
          </div>
          <div class="report-info-item">
            <span class="info-label">Status:</span>
            <span id="report-status" class="info-value status-${report.Status?.toLowerCase() || 'pending'}">${escapeHtml(report.Status || 'Pending')}</span>
          </div>
          <div class="report-info-item">
            <span class="info-label">Reason:</span>
            <span class="info-value">${escapeHtml(report.Reason || 'Not specified')}</span>
          </div>
          <div class="report-info-item">
            <span class="info-label">Description:</span>
            <span class="info-value description">${escapeHtml(report.Description || 'No additional details provided')}</span>
          </div>
        </div>
        
        <div class="action-container">
          <h4>Actions</h4>
          <div class="action-buttons">
            <button id="blacklist-url" class="btn btn-danger" data-url="${escapeHtml(report.URL)}">
              <i class="fas fa-ban"></i> Add to Blacklist
            </button>
            <button id="resolve-report" class="btn btn-success" data-report-id="${report.ReportID}">
              <i class="fas fa-check"></i> ${report.Status?.toLowerCase() === 'resolved' ? 'Already Resolved' : 'Mark as Resolved'}
            </button>
            <button id="dismiss-report" class="btn btn-outline modal-close">
              <i class="fas fa-times"></i> Dismiss
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('blacklist-url').addEventListener('click', handleBlacklistUrl);
    document.getElementById('resolve-report').addEventListener('click', handleResolveReport);
    document.getElementById('dismiss-report').addEventListener('click', () => hideModal('report-modal'));
    
    if (report.Status?.toLowerCase() === 'resolved') {
      document.getElementById('resolve-report').disabled = true;
    }
  } catch (error) {
    console.error('Error showing report details:', error);
    hideModal('report-modal');
    showAlert('Failed to load report details: ' + error.message, 'error');
  }
}

async function resolveAllReports() {
  try {
    const reports = await reportsAPI.getReports();
    const pendingReports = reports.filter(r => r.Status?.toLowerCase() !== 'resolved');
    
    if (pendingReports.length === 0) {
      showAlert('No pending reports to resolve', 'info');
      return;
    }
    
    const resolveAllBtn = document.getElementById('resolve-all');
    if (resolveAllBtn) {
      resolveAllBtn.disabled = true;
      resolveAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }
    
    const promises = pendingReports.map(report => 
      reportsAPI.updateStatus(report.ReportID, 'Resolved')
    );
    
    await Promise.all(promises);
    
    showAlert(`${pendingReports.length} reports marked as resolved`, 'success');
    
    await loadReportStats();
    await loadReports(document.getElementById('status-filter')?.value || 'all');
    
    if (resolveAllBtn) {
      resolveAllBtn.disabled = false;
      resolveAllBtn.innerHTML = '<i class="fas fa-check-double"></i> Mark All as Resolved';
    }
  } catch (error) {
    console.error('Error resolving all reports:', error);
    showAlert('Failed to resolve all reports: ' + error.message, 'error');
    
    const resolveAllBtn = document.getElementById('resolve-all');
    if (resolveAllBtn) {
      resolveAllBtn.disabled = false;
      resolveAllBtn.innerHTML = '<i class="fas fa-check-double"></i> Mark All as Resolved';
    }
  }
}

async function handleBlacklistUrl(e) {
  const url = e.target.dataset.url || e.target.parentElement.dataset.url;
  if (!url) {
    showAlert('No URL provided for blacklisting', 'error');
    return;
  }
  
  try {
    const button = e.target.closest('button');
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }
    
    await reportsAPI.addToBlacklist(url);
    
    showAlert(`Domain ${extractDomain(url)} added to blacklist`, 'success');
    
    hideModal('report-modal');
    
    if (button) {
      button.disabled = false;
      button.innerHTML = '<i class="fas fa-ban"></i> Add to Blacklist';
    }
  } catch (error) {
    console.error('Error blacklisting URL:', error);
    showAlert('Failed to add to blacklist: ' + error.message, 'error');
    
    const button = e.target.closest('button');
    if (button) {
      button.disabled = false;
      button.innerHTML = '<i class="fas fa-ban"></i> Add to Blacklist';
    }
  }
}

async function handleResolveReport(e) {
  const reportId = e.target.dataset.reportId || e.target.parentElement.dataset.reportId;
  if (!reportId) {
    showAlert('No report ID provided', 'error');
    return;
  }
  
  try {
    const button = e.target.closest('button');
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }
    
    await reportsAPI.updateStatus(reportId, 'Resolved');
    
    showAlert('Report marked as resolved', 'success');
    
    hideModal('report-modal');
    
    await loadReportStats();
    await loadReports(document.getElementById('status-filter')?.value || 'all');
  } catch (error) {
    console.error('Error resolving report:', error);
    showAlert('Failed to resolve report: ' + error.message, 'error');
    
    const button = e.target.closest('button');
    if (button) {
      button.disabled = false;
      button.innerHTML = '<i class="fas fa-check"></i> Mark as Resolved';
    }
  }
}

function exportReports() {
  try {
    const table = document.getElementById('reports-table');
    if (!table || table.style.display === 'none') {
      showAlert('No reports available to export', 'warning');
      return;
    }
    
    let csv = 'URL,Reporter,Date,Status\n';
    const rows = document.querySelectorAll('#reports-table-body tr');
    
    rows.forEach(row => {
      const url = row.querySelector('.url-cell')?.title || '';
      const reporter = row.cells[1]?.textContent || '';
      const date = row.cells[2]?.textContent || '';
      const status = row.querySelector('.status-badge')?.textContent || '';
      
      csv += `"${url.replace(/"/g, '""')}","${reporter.replace(/"/g, '""')}","${date.replace(/"/g, '""')}","${status.replace(/"/g, '""')}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'phishguard_reports.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showAlert('Reports exported successfully', 'success');
  } catch (error) {
    console.error('Error exporting reports:', error);
    showAlert('Failed to export reports: ' + error.message, 'error');
  }
}
