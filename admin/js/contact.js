document.addEventListener('DOMContentLoaded', () => {
  // Check authentication
  const token = localStorage.getItem('phishguard_admin_token');
  const userJson = localStorage.getItem('phishguard_admin');
  let user;
  
  try {
    user = JSON.parse(userJson);
  } catch (e) {
    console.error('Error parsing user data', e);
  }
  
  if (!token || !user) {
    window.location.href = 'index.html';
    return;
  }
  
  // Set admin username in header
  document.getElementById('current-user').textContent = user.username || 'Admin';
  
  // UI State
  const state = {
    allSubmissions: [],
    currentPage: 1,
    itemsPerPage: 10,
    totalSubmissions: 0,
    selectedSubmissionId: null,
    currentFilters: {
      status: 'all',
      read: 'all',
      search: ''
    }
  };

  // UI Elements
  const elements = {
    submissionsTable: document.getElementById('submissions-table'),
    noSubmissionsMessage: document.getElementById('no-submissions-message'),
    paginationEl: document.getElementById('pagination'),
    messageDetail: document.getElementById('message-detail'),
    statusFilter: document.getElementById('status-filter'),
    readFilter: document.getElementById('read-filter'),
    searchInput: document.getElementById('search-input'),
    closeDetailBtn: document.getElementById('close-detail-btn'),
    deleteMessageBtn: document.getElementById('delete-message-btn'),
    updateStatusBtn: document.getElementById('update-status-btn'),
    statusUpdate: document.getElementById('status-update'),
    saveNotesBtn: document.getElementById('save-notes-btn'),
    adminNotes: document.getElementById('admin-notes'),
    submissionsLoader: document.getElementById('submissions-loader'),
    refreshBtn: document.getElementById('refresh-submissions'),
    rangeElement: document.getElementById('submissions-range'),
    totalElement: document.getElementById('submissions-total'),
    totalMessages: document.getElementById('total-messages'),
    unreadMessages: document.getElementById('unread-messages'),
    completedMessages: document.getElementById('completed-messages'),
    confirmationModal: document.getElementById('confirmation-modal'),
    modalClose: document.querySelector('.modal-close'),
    modalCancel: document.getElementById('modal-cancel'),
    modalConfirm: document.getElementById('modal-confirm')
  };

  // Setup Event Listeners
  function setupEventListeners() {
    if (elements.statusFilter) {
      elements.statusFilter.addEventListener('change', () => {
        state.currentPage = 1;
        filterSubmissions();
      });
    }
    
    if (elements.readFilter) {
      elements.readFilter.addEventListener('change', () => {
        state.currentPage = 1;
        filterSubmissions();
      });
    }
    
    if (elements.searchInput) {
      elements.searchInput.addEventListener('input', debounce(() => {
        state.currentPage = 1;
        filterSubmissions();
      }, 300));
    }
    
    if (elements.closeDetailBtn) {
      elements.closeDetailBtn.addEventListener('click', closeDetailView);
    }
    
    if (elements.updateStatusBtn) {
      elements.updateStatusBtn.addEventListener('click', handleStatusUpdate);
    }
    
    if (elements.saveNotesBtn) {
      elements.saveNotesBtn.addEventListener('click', handleSaveNotes);
    }
    
    if (elements.deleteMessageBtn) {
      elements.deleteMessageBtn.addEventListener('click', () => {
        if (elements.confirmationModal) {
          elements.confirmationModal.style.display = 'block';
        }
      });
    }
    
    if (elements.refreshBtn) {
      elements.refreshBtn.addEventListener('click', () => {
        const icon = elements.refreshBtn.querySelector('i');
        if (icon) icon.classList.add('fa-spin');
        
        fetchSubmissions().finally(() => {
          setTimeout(() => {
            if (icon) icon.classList.remove('fa-spin');
          }, 500);
        });
      });
    }
    
    if (elements.modalClose) {
      elements.modalClose.addEventListener('click', () => {
        elements.confirmationModal.style.display = 'none';
      });
    }
    
    if (elements.modalCancel) {
      elements.modalCancel.addEventListener('click', () => {
        elements.confirmationModal.style.display = 'none';
      });
    }
    
    if (elements.modalConfirm) {
      elements.modalConfirm.addEventListener('click', confirmDelete);
    }
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('phishguard_admin_token');
        localStorage.removeItem('phishguard_admin');
        window.location.href = 'index.html';
      });
    }
    
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const content = document.getElementById('content');
        if (sidebar) sidebar.classList.toggle('collapsed');
        if (content) content.classList.toggle('expanded');
      });
    }
  }

  // Fetch all contact submissions
  async function fetchSubmissions() {
    showLoading(true);
    hideNoSubmissionsMessage();
    
    try {
      const response = await fetch('http://localhost:3000/api/contact-us', {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data || !Array.isArray(data.submissions)) {
        throw new Error('Invalid response format from server');
      }
      
      // Update state
      state.allSubmissions = data.submissions;
      state.totalSubmissions = data.totalCount || data.submissions.length;
      
      // Calculate stats from submissions
      updateStatistics();
      
      // Apply filters and display
      filterSubmissions();
      
      showLoading(false);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      showAlert('Failed to load contact submissions: ' + error.message, 'error');
      showLoading(false);
      showNoSubmissionsMessage('Error Loading Data', 'Could not load submissions from the server. Please try again.');
    }
  }

  // Calculate and update statistics
  function updateStatistics() {
    const stats = {
      total: state.allSubmissions.length,
      unread: 0,
      completed: 0
    };
    
    state.allSubmissions.forEach(submission => {
      if (submission.is_read === 0) stats.unread++;
      if (submission.status === 'completed') stats.completed++;
    });
    
    if (elements.totalMessages) elements.totalMessages.textContent = stats.total;
    if (elements.unreadMessages) elements.unreadMessages.textContent = stats.unread;
    if (elements.completedMessages) elements.completedMessages.textContent = stats.completed;
  }

  // Filter submissions based on current filter settings
  function filterSubmissions() {
    if (elements.statusFilter) state.currentFilters.status = elements.statusFilter.value;
    if (elements.readFilter) state.currentFilters.read = elements.readFilter.value;
    if (elements.searchInput) state.currentFilters.search = elements.searchInput.value.toLowerCase();
    
    // Apply filters
    let filteredSubmissions = [...state.allSubmissions];
    
    // Status filter
    if (state.currentFilters.status !== 'all') {
      filteredSubmissions = filteredSubmissions.filter(
        s => s.status === state.currentFilters.status
      );
    }
    
    // Read status filter
    if (state.currentFilters.read === 'read') {
      filteredSubmissions = filteredSubmissions.filter(s => s.is_read === 1);
    } else if (state.currentFilters.read === 'unread') {
      filteredSubmissions = filteredSubmissions.filter(s => s.is_read === 0);
    }
    
    // Search filter
    if (state.currentFilters.search) {
      filteredSubmissions = filteredSubmissions.filter(s => 
        (s.name?.toLowerCase().includes(state.currentFilters.search)) ||
        (s.email?.toLowerCase().includes(state.currentFilters.search)) ||
        (s.subject?.toLowerCase().includes(state.currentFilters.search)) ||
        (s.message?.toLowerCase().includes(state.currentFilters.search))
      );
    }
    
    // Update total count based on filters
    state.totalSubmissions = filteredSubmissions.length;
    
    // Display filtered submissions
    displaySubmissions(filteredSubmissions);
    updatePagination();
  }

  // Display submissions in the table
  function displaySubmissions(submissions) {
    if (!elements.submissionsTable) {
      return;
    }
    
    // Calculate pagination limits
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;
    const paginatedSubmissions = submissions.slice(startIndex, endIndex);
    
    // Show empty state if no results
    if (submissions.length === 0) {
      elements.submissionsTable.innerHTML = '';
      showNoSubmissionsMessage();
      
      // Update range and total
      if (elements.rangeElement) elements.rangeElement.textContent = '0';
      if (elements.totalElement) elements.totalElement.textContent = '0';
      
      return;
    }
    
    // Hide empty state message
    hideNoSubmissionsMessage();
    
    // Clear table and populate with new data
    elements.submissionsTable.innerHTML = '';
    
    paginatedSubmissions.forEach(submission => {
      const row = document.createElement('tr');
      
      // Add unread class if submission is not read
      if (submission.is_read === 0) {
        row.classList.add('unread');
      }
      
      // Format date
      const submissionDate = new Date(submission.submission_date);
      const formattedDate = formatDate(submissionDate);
      
      // Determine status class and text
      const statusClass = getStatusClass(submission.status);
      const statusText = formatStatusText(submission.status);
      
      // Build row HTML
      row.innerHTML = `
        <td>${escapeHtml(submission.name || '')}</td>
        <td>${escapeHtml(submission.email || '')}</td>
        <td>${escapeHtml(submission.subject || 'No Subject')}</td>
        <td>${formattedDate}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-icon view-submission" data-id="${submission.id}" title="View submission">
              <i class="fas fa-eye"></i>
            </button>
          </div>
        </td>
      `;
      
      elements.submissionsTable.appendChild(row);
      
      // Add click handler for view button
      const viewBtn = row.querySelector('.view-submission');
      if (viewBtn) {
        viewBtn.addEventListener('click', () => viewSubmission(submission.id));
      }
    });
    
    // Update range and total counts
    if (elements.rangeElement) {
      elements.rangeElement.textContent = 
        submissions.length === 0 ? '0' : 
        `${startIndex + 1}-${Math.min(endIndex, submissions.length)}`;
    }
    
    if (elements.totalElement) {
      elements.totalElement.textContent = submissions.length;
    }
  }

  // Create and update pagination
  function updatePagination() {
    if (!elements.paginationEl) return;
    
    const totalPages = Math.ceil(state.totalSubmissions / state.itemsPerPage);
    
    // Hide pagination if only one page
    if (totalPages <= 1) {
      elements.paginationEl.innerHTML = '';
      return;
    }
    
    let paginationHTML = '';
    
    // Previous button
    if (state.currentPage > 1) {
      paginationHTML += `<a href="#" class="pagination-item" data-page="${state.currentPage - 1}"><i class="fas fa-chevron-left"></i></a>`;
    }
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
      if (i === state.currentPage) {
        paginationHTML += `<a href="#" class="pagination-item active">${i}</a>`;
      } else if (i <= 2 || i >= totalPages - 1 || Math.abs(i - state.currentPage) <= 1) {
        paginationHTML += `<a href="#" class="pagination-item" data-page="${i}">${i}</a>`;
      } else if (i === 3 && state.currentPage > 4 || i === totalPages - 2 && state.currentPage < totalPages - 3) {
        paginationHTML += '<span class="pagination-item dots">...</span>';
      }
    }
    
    // Next button
    if (state.currentPage < totalPages) {
      paginationHTML += `<a href="#" class="pagination-item" data-page="${state.currentPage + 1}"><i class="fas fa-chevron-right"></i></a>`;
    }
    
    elements.paginationEl.innerHTML = paginationHTML;
    
    // Add event listeners to pagination items
    document.querySelectorAll('.pagination-item[data-page]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        state.currentPage = parseInt(item.dataset.page);
        filterSubmissions();
        // Scroll to top of table
        const tableContainer = elements.submissionsTable.closest('.table-responsive');
        if (tableContainer) tableContainer.scrollTo(0, 0);
      });
    });
  }

  // Show submission details
  async function viewSubmission(id) {
    try {
      const submission = state.allSubmissions.find(s => s.id == id);
      
      if (!submission) {
        throw new Error('Submission not found');
      }
      
      // Set selected submission ID
      state.selectedSubmissionId = id;
      
      // Format date
      const submissionDate = new Date(submission.submission_date);
      const formattedDate = formatDate(submissionDate);
      
      // Update detail view fields
      document.getElementById('message-subject').textContent = submission.subject || 'No Subject';
      document.getElementById('message-date').textContent = formattedDate;
      document.getElementById('message-name').textContent = submission.name || 'Unknown';
      document.getElementById('message-email').textContent = submission.email || 'No Email';
      document.getElementById('message-content').textContent = submission.message || 'No Message Content';
      elements.adminNotes.value = submission.admin_notes || '';
      elements.statusUpdate.value = submission.status;
      
      // Show user info if available
      const userInfoElement = document.getElementById('message-user-info');
      if (userInfoElement) {
        if (submission.user_id && submission.username) {
          userInfoElement.style.display = 'block';
          document.getElementById('message-username').textContent = submission.username;
          document.getElementById('message-user-id').textContent = submission.user_id;
        } else {
          userInfoElement.style.display = 'none';
        }
      }
      
      // Show detail view
      elements.messageDetail.style.display = 'block';
      
      // Scroll detail into view
      elements.messageDetail.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Mark as read if not already read
      if (submission.is_read === 0) {
        await markAsRead(id);
      }
    } catch (error) {
      console.error('Error viewing submission:', error);
      showAlert('Failed to load submission details', 'error');
    }
  }

  // Mark submission as read
  async function markAsRead(id) {
    try {
      const response = await fetch(`http://localhost:3000/api/contact-us/${id}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark as read');
      }
      
      // Update submission in state
      const submission = state.allSubmissions.find(s => s.id == id);
      if (submission) {
        submission.is_read = 1;
        filterSubmissions();
        updateStatistics();
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }

  // Handle status update
  async function handleStatusUpdate() {
    if (!state.selectedSubmissionId) return;
    
    const newStatus = elements.statusUpdate.value;
    
    try {
      showButtonLoading(elements.updateStatusBtn, true);
      
      const response = await fetch(`http://localhost:3000/api/contact-us/${state.selectedSubmissionId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update status');
      }
      
      showAlert(`Status updated to ${formatStatusText(newStatus)}`, 'success');
      
      // Update submission in state
      const submission = state.allSubmissions.find(s => s.id == state.selectedSubmissionId);
      if (submission) {
        submission.status = newStatus;
        filterSubmissions();
        updateStatistics();
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showAlert('Failed to update status', 'error');
    } finally {
      showButtonLoading(elements.updateStatusBtn, false);
    }
  }

  // Handle saving notes
  async function handleSaveNotes() {
    if (!state.selectedSubmissionId) return;
    
    const notes = elements.adminNotes.value;
    
    try {
      showButtonLoading(elements.saveNotesBtn, true);
      
      const response = await fetch(`http://localhost:3000/api/contact-us/${state.selectedSubmissionId}/notes`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({ admin_notes: notes })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save notes');
      }
      
      showAlert('Notes saved successfully', 'success');
      
      // Update submission in state
      const submission = state.allSubmissions.find(s => s.id == state.selectedSubmissionId);
      if (submission) {
        submission.admin_notes = notes;
      }
    } catch (error) {
      console.error('Error saving notes:', error);
      showAlert('Failed to save notes', 'error');
    } finally {
      showButtonLoading(elements.saveNotesBtn, false);
    }
  }
  
  // Confirm delete action
  async function confirmDelete() {
    if (!state.selectedSubmissionId) return;
    
    try {
      // Disable confirm button and show loading
      const confirmButton = elements.modalConfirm;
      confirmButton.disabled = true;
      confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
      
      const response = await fetch(`http://localhost:3000/api/contact-us/${state.selectedSubmissionId}`, {
        method: 'DELETE',
        headers: {
          'x-auth-token': token
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete submission');
      }
      
      showAlert('Submission deleted successfully', 'success');
      
      // Remove from state and reset
      state.allSubmissions = state.allSubmissions.filter(s => s.id != state.selectedSubmissionId);
      state.selectedSubmissionId = null;
      
      // Hide detail view and modal
      elements.messageDetail.style.display = 'none';
      elements.confirmationModal.style.display = 'none';
      
      // Update display and stats
      filterSubmissions();
      updateStatistics();
    } catch (error) {
      console.error('Error deleting submission:', error);
      showAlert('Failed to delete submission', 'error');
    } finally {
      // Reset button state
      elements.modalConfirm.disabled = false;
      elements.modalConfirm.textContent = 'Delete';
    }
  }

  // Close detail view
  function closeDetailView() {
    if (elements.messageDetail) {
      elements.messageDetail.style.display = 'none';
    }
    state.selectedSubmissionId = null;
  }
  
  // Show loading state
  function showLoading(show) {
    if (elements.submissionsLoader) {
      elements.submissionsLoader.style.display = show ? 'flex' : 'none';
    }
  }
  
  // Show no submissions message
  function showNoSubmissionsMessage(title = 'No Submissions Found', message = 'No submissions match your current filters.') {
    if (elements.noSubmissionsMessage) {
      const titleEl = elements.noSubmissionsMessage.querySelector('h3');
      const messageEl = elements.noSubmissionsMessage.querySelector('p');
      
      if (titleEl) titleEl.textContent = title;
      if (messageEl) messageEl.textContent = message;
      
      elements.noSubmissionsMessage.style.display = 'flex';
    }
  }
  
  // Hide no submissions message
  function hideNoSubmissionsMessage() {
    if (elements.noSubmissionsMessage) {
      elements.noSubmissionsMessage.style.display = 'none';
    }
  }
  
  // Show button loading state
  function showButtonLoading(button, isLoading) {
    if (!button) return;
    
    if (isLoading) {
      button.disabled = true;
      button._originalText = button.innerHTML;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    } else {
      button.disabled = false;
      button.innerHTML = button._originalText || button.innerHTML;
    }
  }
  
  // Show alert message
  function showAlert(message, type = 'info') {
    const alertEl = document.getElementById('system-alert');
    if (!alertEl) return;
    
    // Clear any existing timeouts
    if (alertEl._timeout) {
      clearTimeout(alertEl._timeout);
    }
    
    // Set alert text and class
    alertEl.textContent = message;
    alertEl.className = `alert alert-${type}`;
    alertEl.style.display = 'block';
    
    // Auto-dismiss non-error alerts
    if (type !== 'error') {
      alertEl._timeout = setTimeout(() => {
        alertEl.style.display = 'none';
      }, 5000);
    }
  }
  
  // Helper function to format status class
  function getStatusClass(status) {
    return status === 'new' ? 'status-new' : 
           status === 'in_progress' ? 'status-in-progress' : 
           'status-completed';
  }
  
  // Helper function to format status text
  function formatStatusText(status) {
    return status === 'new' ? 'New' : 
           status === 'in_progress' ? 'In Progress' : 
           'Completed';
  }
  
  // Helper function to format date
  function formatDate(date) {
    return date.toLocaleDateString() + ' ' + 
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Debounce function for search input
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
  
  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    if (!text) return '';
    return text
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Initialize the page
  setupEventListeners();
  fetchSubmissions();
});
