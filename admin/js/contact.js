document.addEventListener('DOMContentLoaded', () => {
  // Check authentication using common auth methods
  if (!Auth.isAuthenticated()) {
    window.location.href = 'index.html?error=auth_required';
    return;
  }
  
  // Get admin user info and token
  const token = Auth.getToken();
  const user = Auth.getUser();
  
  if (!user) {
    console.error('User data not found');
    window.location.href = 'index.html?error=invalid_session';
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
    modalConfirm: document.getElementById('modal-confirm'),
    messageModal: document.getElementById('message-modal'),
    messageCloseBtn: document.getElementById('message-close-btn')
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
    
    if (elements.messageCloseBtn) {
      elements.messageCloseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        closeDetailView();
      });
    }
    
    if (elements.messageModal) {
      elements.messageModal.addEventListener('click', function(event) {
        if (event.target === elements.messageModal) {
          closeDetailView();
        }
      });
    }
    
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && elements.messageModal && 
          elements.messageModal.classList.contains('show')) {
        closeDetailView();
      }
    });
    
    if (elements.updateStatusBtn) {
      elements.updateStatusBtn.addEventListener('click', () => {
        updateSubmissionStatus();
      });
    }
    
    if (elements.statusUpdate) {
      elements.statusUpdate.addEventListener('change', () => {
        updateSubmissionStatus();
      });
    }
    
    if (elements.saveNotesBtn) {
      elements.saveNotesBtn.addEventListener('click', async () => {
        try {
          // Show loading state using DOM utility if available
          if (window.DOM && DOM.buttonState) {
            DOM.buttonState(elements.saveNotesBtn, true, null, 'Saving...');
          } else {
            // Fallback if DOM utility isn't available
            elements.saveNotesBtn.disabled = true;
            elements.saveNotesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
          }
          
          const notes = elements.adminNotes.value;
          
          // Send API request to save notes
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
          
          // Show success state
          if (window.DOM && DOM.buttonState) {
            DOM.buttonState(elements.saveNotesBtn, false, 'fas fa-check', 'Saved!');
          } else {
            elements.saveNotesBtn.disabled = false;
            elements.saveNotesBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
          }
          
          // Restore original state after 2 seconds
          setTimeout(() => {
            if (window.DOM && DOM.buttonState) {
              DOM.buttonState(elements.saveNotesBtn, false, 'fas fa-save', 'Save Notes');
            } else {
              elements.saveNotesBtn.disabled = false;
              elements.saveNotesBtn.innerHTML = '<i class="fas fa-save"></i> Save Notes';
            }
          }, 2000);
          
          // Show small notification
          showNotification('Notes saved successfully', 'success');
          
          // Update submission in state
          const submission = state.allSubmissions.find(s => s.id == state.selectedSubmissionId);
          if (submission) {
            submission.admin_notes = notes;
          }
          
        } catch (error) {
          console.error('Error saving notes:', error);
          
          // Show error state
          if (window.DOM && DOM.buttonState) {
            DOM.buttonState(elements.saveNotesBtn, false, 'fas fa-times', 'Error!');
          } else {
            elements.saveNotesBtn.disabled = false;
            elements.saveNotesBtn.innerHTML = '<i class="fas fa-times"></i> Error!';
          }
          
          // Show error notification
          showNotification('Failed to save notes: ' + error.message, 'error');
          
          // Restore original state after 2 seconds
          setTimeout(() => {
            if (window.DOM && DOM.buttonState) {
              DOM.buttonState(elements.saveNotesBtn, false, 'fas fa-save', 'Save Notes');
            } else {
              elements.saveNotesBtn.disabled = false;
              elements.saveNotesBtn.innerHTML = '<i class="fas fa-save"></i> Save Notes';
            }
          }, 2000);
        }
      });
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
        Auth.logout();
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

    // Reply button handler
    if (document.getElementById('reply-message-btn')) {
      document.getElementById('reply-message-btn').addEventListener('click', () => {
        replyToMessage();
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
      
      // Update modal fields
      document.getElementById('message-subject').textContent = submission.subject || 'No Subject';
      document.getElementById('message-date').textContent = formattedDate;
      document.getElementById('message-name').textContent = submission.name || 'Unknown';
      document.getElementById('message-email').textContent = submission.email || 'No Email';
      document.getElementById('message-content').textContent = submission.message || 'No Message Content';
      
      if (elements.adminNotes) {
        elements.adminNotes.value = submission.admin_notes || '';
      }
      
      if (elements.statusUpdate) {
        elements.statusUpdate.value = submission.status;
      }
      
      // Show user info if available
      const userInfoLabel = document.getElementById('message-user-info-label');
      const userInfoElement = document.getElementById('message-user-info');
      if (userInfoLabel && userInfoElement) {
        if (submission.user_id && submission.username) {
          userInfoLabel.style.display = 'block';
          userInfoElement.style.display = 'block';
          document.getElementById('message-username').textContent = submission.username;
          document.getElementById('message-user-id').textContent = submission.user_id;
        } else {
          userInfoLabel.style.display = 'none';
          userInfoElement.style.display = 'none';
        }
      }
      
      console.log('Opening modal for submission:', id); // Debug logging
      
      // Show modal
      if (elements.messageModal) {
        elements.messageModal.classList.add('show');
        document.body.classList.add('modal-open');
      } else {
        console.error('Message modal element not found!');
      }
      
      // Mark as read if not already read
      if (submission.is_read === 0) {
        await markAsRead(id);
      }
    } catch (error) {
      console.error('Error viewing submission:', error);
      showAlert('Failed to load submission details: ' + error.message, 'error');
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
      elements.messageModal.classList.remove('show');
      document.body.classList.remove('modal-open');
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
    console.log('Closing modal'); // Debug logging
    
    if (elements.messageModal) {
      elements.messageModal.classList.remove('show');
    } else {
      console.error('Message modal element not found when attempting to close');
    }
    
    document.body.classList.remove('modal-open');
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

  // Add notification function for feedback
  function showNotification(message, type = 'info') {
    // Check if notification container exists, create if not
    let notificationContainer = document.querySelector('.notification-container');
    if (!notificationContainer) {
      notificationContainer = document.createElement('div');
      notificationContainer.className = 'notification-container';
      document.body.appendChild(notificationContainer);
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-icon">
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
      </div>
      <div class="notification-content">
        ${message}
      </div>
    `;
    
    // Add to container
    notificationContainer.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }

  // Add this new function to handle replying to messages
  function replyToMessage() {
    // Get the recipient email
    const recipientEmail = document.getElementById('message-email').textContent;
    const subject = document.getElementById('message-subject').textContent;
    
    if (!recipientEmail) {
      showNotification('No email address available for reply', 'error');
      return;
    }
    
    // Create subject with Re: prefix if it doesn't already have it
    const emailSubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
    
    // Generate mailto URL with recipient email and subject
    const mailtoUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientEmail)}&su=${encodeURIComponent(emailSubject)}`;
    
    // Open Gmail in a new tab
    window.open(mailtoUrl, '_blank');
    
    // Log and show notification
    console.log(`Opening Gmail to reply to: ${recipientEmail}`);
    showNotification(`Opening Gmail to reply to ${recipientEmail}`, 'success');
  }

  // Add a reusable function to update submission status
  async function updateSubmissionStatus() {
    try {
      const statusUpdateIndicator = document.getElementById('status-update-indicator');
      
      // Show loading indicator
      if (statusUpdateIndicator) {
        statusUpdateIndicator.classList.add('show', 'loading');
        statusUpdateIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
      }
      
      const status = elements.statusUpdate.value;
      
      // Send API request to update status
      const response = await fetch(`http://localhost:3000/api/contact-us/${state.selectedSubmissionId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({ status })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update status');
      }
      
      // Show success state
      if (statusUpdateIndicator) {
        statusUpdateIndicator.classList.remove('loading');
        statusUpdateIndicator.classList.add('success');
        statusUpdateIndicator.innerHTML = '<i class="fas fa-check"></i> Updated!';
        
        // Hide after 2 seconds
        setTimeout(() => {
          statusUpdateIndicator.classList.remove('show', 'success');
        }, 2000);
      }
      
      // Show notification
      showNotification('Status updated successfully', 'success');
      
      // Update submission in state
      const submission = state.allSubmissions.find(s => s.id == state.selectedSubmissionId);
      if (submission) {
        submission.status = status;
        filterSubmissions();
        updateStatistics();
      }
      
      // Update status label in the UI if it exists
      const statusLabel = document.querySelector('#message-detail .status-badge');
      if (statusLabel) {
        statusLabel.className = 'status-badge ' + status;
        statusLabel.textContent = status.replace('_', ' ');
      }
      
    } catch (error) {
      console.error('Error updating status:', error);
      
      // Show error state in indicator
      const statusUpdateIndicator = document.getElementById('status-update-indicator');
      if (statusUpdateIndicator) {
        statusUpdateIndicator.classList.remove('loading');
        statusUpdateIndicator.classList.add('error');
        statusUpdateIndicator.innerHTML = '<i class="fas fa-times"></i> Failed!';
        
        // Hide after 3 seconds
        setTimeout(() => {
          statusUpdateIndicator.classList.remove('show', 'error');
        }, 3000);
      }
      
      // Show error notification
      showNotification('Failed to update status: ' + error.message, 'error');
    }
  }

  // Initialize the page
  setupEventListeners();
  fetchSubmissions();
});
