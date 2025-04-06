/**
 * PhishGuard Admin Users Management
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Initializing user management...');
    
    // Verify admin authentication
    if (!Auth.isAuthenticated()) {
      window.location.href = 'index.html';
      return;
    }
    
    // Load initial data
    await Promise.all([
      loadUserStats(),
      loadUsers()
    ]);
    
    // Initialize UI components
    setupUserActions();
    
    console.log('User management initialized successfully');
  } catch (error) {
    console.error('User management initialization error:', error);
    showAlert('Failed to initialize user management: ' + error.message, 'error');
  }
});

async function loadUserStats() {
  try {
    console.log('Loading user statistics...');
    const stats = await usersAPI.getStats();
    console.log('User stats received:', stats);
    
    // Update stats cards with data
    document.getElementById('total-users').textContent = stats.totalUsers || 0;
    document.getElementById('active-users').textContent = stats.activeUsers || 0;
    document.getElementById('admin-users').textContent = stats.adminUsers || 0;
    document.getElementById('new-users').textContent = stats.newUsers || 0;
    
    console.log('User statistics updated successfully');
  } catch (error) {
    console.error('Failed to load user statistics:', error);
    showAlert('Failed to load user statistics', 'error');
  }
}

async function loadUsers() {
  try {
    // Show loading state
    const userLoader = document.getElementById('user-loader');
    const userTable = document.getElementById('user-table');
    const noUsers = document.getElementById('no-users');
    
    if (userLoader) userLoader.style.display = 'flex';
    if (userTable) userTable.style.display = 'none';
    if (noUsers) noUsers.style.display = 'none';
    
    // Fetch users
    const users = await usersAPI.getUsers();
    console.log(`Loaded ${users.length} users`);
    
    // Hide loading state
    if (userLoader) userLoader.style.display = 'none';
    
    // Handle empty state
    if (!users || users.length === 0) {
      if (noUsers) noUsers.style.display = 'flex';
      return;
    }
    
    // Sort users: Admins first, then by creation date
    users.sort((a, b) => {
      // First sort by role (Admin comes first)
      if (a.role === 'Admin' && b.role !== 'Admin') return -1;
      if (a.role !== 'Admin' && b.role === 'Admin') return 1;
      
      // If both are the same role, sort by creation date (newest first)
      const dateA = new Date(a.created);
      const dateB = new Date(b.created);
      return dateB - dateA; // Reverse to get newest first
    });
    
    // Show table and populate
    if (userTable) {
      userTable.style.display = 'table';
      
      const tableBody = document.getElementById('user-table-body');
      if (!tableBody) {
        console.error('user-table-body element not found');
        return;
      }
      
      // Clear existing rows
      tableBody.innerHTML = '';
      
      // Update pagination info
      const totalElement = document.getElementById('users-total');
      const rangeElement = document.getElementById('users-range');
      
      if (totalElement) totalElement.textContent = users.length;
      if (rangeElement) rangeElement.textContent = `1-${Math.min(users.length, 10)}`;
      
      // Add users to table
      users.forEach(user => {
        // Create row
        const row = document.createElement('tr');
        
        // Add 'admin-row' class to admin rows for additional styling if needed
        if (user.role === 'Admin') {
          row.classList.add('admin-row');
        }
        
        // Format date (handle future dates from the example data)
        let formattedDate;
        try {
          const createdDate = new Date(user.created);
          formattedDate = createdDate.toLocaleDateString() + ' ' + 
                          createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
          formattedDate = 'Invalid date';
        }
        
        // Get initials for the avatar
        const initials = getInitialsFromEmail(user.email);
        
        // Set row HTML
        row.innerHTML = `
          <td>
            <div class="user-name">
              <div class="avatar ${user.role === 'Admin' ? 'avatar-admin' : ''}">${initials}</div>
              <div class="user-info">
                <div class="user-primary">${escapeHtml(user.email)}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="badge ${user.role === 'Admin' ? 'badge-admin' : 'badge-secondary'}">${user.role}</span>
          </td>
          <td>
            <span class="badge ${user.status === 'active' ? 'badge-success' : 'badge-warning'}">${user.status}</span>
          </td>
          <td>${formattedDate}</td>
          <td>
            <div class="actions">
              <button class="btn btn-icon edit-user" data-id="${user.id}" title="Edit user">
                <i class="fas fa-pencil-alt"></i>
              </button>
              <button class="btn btn-icon delete-user" data-id="${user.id}" title="Delete user" 
                ${user.role === 'Admin' ? 'disabled' : ''}>
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        `;
        
        tableBody.appendChild(row);
      });
      
      // Add event listeners to buttons
      setupActionButtons();
    }
  } catch (error) {
    console.error('Failed to load users:', error);
    
    // Hide loader
    const userLoader = document.getElementById('user-loader');
    if (userLoader) userLoader.style.display = 'none';
    
    // Show error
    showAlert('Failed to load users: ' + error.message, 'error');
  }
}

// New function to get initials from email
function getInitialsFromEmail(email) {
  if (!email) return '?';
  
  // Extract first part of the email (before @)
  const username = email.split('@')[0];
  
  if (username.length > 0) {
    // Take first character and make it uppercase
    return username.charAt(0).toUpperCase();
  } else {
    return '?';
  }
}

function getUserInitials(name) {
  if (!name) return '?';
  
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setupUserActions() {
  // Add User button
  const addUserBtn = document.getElementById('add-user-btn');
  if (addUserBtn) {
    addUserBtn.addEventListener('click', () => {
      // Open user modal for adding new user
      showUserModal();
    });
  }
  
  // Add user button in empty state
  const addFirstUserBtn = document.getElementById('add-first-user');
  if (addFirstUserBtn) {
    addFirstUserBtn.addEventListener('click', () => {
      showUserModal();
    });
  }
  
  // Refresh users button
  const refreshBtn = document.getElementById('refresh-users');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await Promise.all([
        loadUserStats(),
        loadUsers()
      ]);
    });
  }
  
  // Setup search - fix the search input ID and enhance functionality
  const searchInput = document.getElementById('user-search');
  if (searchInput) {
    // Add input event listener for real-time searching
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      searchUsers(query);
    });
    
    // Add keydown event for Escape key to clear search
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        searchUsers('');
      }
    });
    
    // Add search icon click handler
    const searchIcon = searchInput.nextElementSibling;
    if (searchIcon && searchIcon.tagName === 'I') {
      searchIcon.style.cursor = 'pointer';
      searchIcon.addEventListener('click', () => {
        const query = searchInput.value.trim().toLowerCase();
        searchUsers(query);
      });
    }
  } else {
    console.warn('Search input element not found (ID: user-search)');
  }
}

function setupActionButtons() {
  // Edit buttons
  document.querySelectorAll('.edit-user').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.dataset.id;
      showUserModal(userId); // Not implemented in this fix, would fetch user and show modal
    });
  });
  
  // Delete buttons
  document.querySelectorAll('.delete-user').forEach(btn => {
    if (!btn.disabled) {
      btn.addEventListener('click', () => {
        const userId = btn.dataset.id;
        if (confirm('Are you sure you want to delete this user?')) {
          deleteUser(userId);
        }
      });
    }
  });
}

function searchUsers(query) {
  console.log('Searching users for:', query);
  const tableBody = document.getElementById('user-table-body');
  if (!tableBody) return;
  
  const rows = tableBody.getElementsByTagName('tr');
  let visibleCount = 0;
  let totalCount = rows.length;
  
  for (let i = 0; i < rows.length; i++) {
    const email = rows[i].querySelector('.user-primary')?.textContent?.toLowerCase() || '';
    const role = rows[i].querySelector('.badge')?.textContent?.toLowerCase() || '';
    const status = rows[i].querySelectorAll('.badge')[1]?.textContent?.toLowerCase() || '';
    
    if (email.includes(query) || role.includes(query) || status.includes(query)) {
      rows[i].style.display = '';
      visibleCount++;
    } else {
      rows[i].style.display = 'none';
    }
  }
  
  // Update count display
  const totalElement = document.getElementById('users-total');
  const rangeElement = document.getElementById('users-range');
  
  if (totalElement) {
    if (query && visibleCount !== totalCount) {
      totalElement.textContent = `${visibleCount} of ${totalCount}`;
    } else {
      totalElement.textContent = totalCount;
    }
  }
  
  if (rangeElement) {
    if (query && visibleCount !== totalCount) {
      rangeElement.textContent = 'filtered';
    } else {
      rangeElement.textContent = `1-${Math.min(totalCount, 10)}`;
    }
  }
  
  // Show toast message when no results are found
  if (query && visibleCount === 0 && totalCount > 0) {
    showToast(`No users matching "${query}" found`, 'info');
  }
}

// Add toast notification function for search feedback
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

// Placeholder for user modal functionality
function showUserModal(userId = null) {
  // This would be implemented to show a modal for adding/editing users
  if (userId) {
    console.log(`Would show edit modal for user ID: ${userId}`);
  } else {
    console.log('Would show add user modal');
  }
}

// Placeholder for user deletion
async function deleteUser(userId) {
  try {
    await usersAPI.deleteUser(userId);
    showAlert('User deleted successfully', 'success');
    await Promise.all([
      loadUserStats(),
      loadUsers()
    ]);
  } catch (error) {
    console.error('Error deleting user:', error);
    showAlert('Failed to delete user: ' + error.message, 'error');
  }
}

function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById('system-alert');
  if (!alertContainer) return;
  
  alertContainer.textContent = message;
  alertContainer.className = `alert alert-${type === 'error' ? 'danger' : type}`;
  alertContainer.style.display = 'block';
  
  if (type !== 'error' && type !== 'danger') {
    setTimeout(() => {
      alertContainer.style.display = 'none';
    }, 5000);
  }
}
