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
    
    // Try to fetch users from API
    let users = [];
    try {
      users = await usersAPI.getUsers();
    } catch (apiError) {
      console.warn('API error, using sample data:', apiError);
      // Use sample data if API fails
      users = generateSampleUserData();
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API delay
    }
    
    console.log(`Loaded ${users.length} users`);
    
    // Store users in state for export functionality
    window.state.allUsers = users;
    
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
  
  // Set up Export User List button
  const exportUsersBtn = document.getElementById('export-users');
  if (exportUsersBtn) {
    exportUsersBtn.addEventListener('click', exportUsersList);
  }
  
  // Set up modal close buttons
  document.querySelectorAll('.modal-close, #cancel-user-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      hideModal('user-modal');
    });
  });
  
  // Set up form submission
  const userForm = document.getElementById('user-form');
  const saveUserBtn = document.getElementById('save-user-btn');
  
  if (saveUserBtn && userForm) {
    saveUserBtn.addEventListener('click', handleSaveUser);
  }
  
  // Set up delete user button in modal
  const deleteUserBtn = document.getElementById('delete-user-btn');
  if (deleteUserBtn) {
    deleteUserBtn.addEventListener('click', () => {
      const userId = userForm.dataset.userId;
      if (userId) {
        if (confirm('Are you sure you want to delete this user?')) {
          deleteUser(userId);
          hideModal('user-modal');
        }
      }
    });
  }
  
  // Toggle password visibility for both password fields
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const passwordField = btn.closest('.input-group').querySelector('input');
      if (passwordField) {
        const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordField.setAttribute('type', type);
        btn.querySelector('i').className = 
          type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
      }
    });
  });
  
  // Setup search functionality
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
    
    // Add search button click handler
    const searchButton = document.querySelector('.search-button');
    if (searchButton) {
      searchButton.addEventListener('click', () => {
        const query = searchInput.value.trim().toLowerCase();
        searchUsers(query);
      });
    }
  }
}

/**
 * Export users list as CSV file
 */
function exportUsersList() {
  try {
    // Show loading state on button
    const exportBtn = document.getElementById('export-users');
    const originalText = exportBtn.innerHTML;
    exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
    
    // Get current user data
    const users = [...state.allUsers] || [];
    
    if (!users.length) {
      showAlert('No users available to export', 'warning');
      exportBtn.innerHTML = originalText;
      return;
    }
    
    // Create CSV content with header
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Username,Email,Role,Status,Created\n";
    
    // Add each user as a row
    users.forEach(user => {
      // Format dates
      const createdDate = user.created ? new Date(user.created).toLocaleDateString() : 'N/A';
      
      // Format each field with proper CSV escaping
      const formatForCsv = (str) => {
        if (str === null || str === undefined) return '';
        return `"${String(str).replace(/"/g, '""')}"`;
      };
      
      // Build row with all fields
      const row = [
        formatForCsv(user.username),
        formatForCsv(user.email),
        formatForCsv(user.role),
        formatForCsv(user.status),
        formatForCsv(createdDate)
      ];
      
      csvContent += row.join(',') + '\n';
    });
    
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `phishguard_users_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    
    // Trigger download
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    
    // Reset button state
    exportBtn.innerHTML = originalText;
    
    // Show success notification
    showToast('User list exported successfully', 'success');
    
  } catch (error) {
    console.error('Error exporting user list:', error);
    showAlert('Failed to export user list: ' + error.message, 'error');
    
    // Reset button state
    const exportBtn = document.getElementById('export-users');
    if (exportBtn) {
      exportBtn.innerHTML = '<i class="fas fa-download"></i> Export User List';
    }
  }
}

// Create variable to store user data for export
// This will be populated during loadUsers() function
if (!window.state) window.state = {};
window.state.allUsers = [];

function setupActionButtons() {
  // Edit buttons
  document.querySelectorAll('.edit-user').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.dataset.id;
      showUserModal(userId);
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

// Modal functions
function showUserModal(userId = null) {
  const modal = document.getElementById('user-modal');
  const modalTitle = document.getElementById('user-modal-title');
  const form = document.getElementById('user-form');
  const deleteBtn = document.getElementById('delete-user-btn');
  const passwordFields = document.getElementById('password-fields');
  
  if (!modal || !form) {
    console.error('Modal elements not found');
    return;
  }
  
  // Reset form fields
  form.reset();
  
  // Always clean up any existing admin warning message
  const deleteContainer = deleteBtn ? deleteBtn.closest('.delete-user-container') || deleteBtn.parentNode : null;
  if (deleteContainer) {
    const existingNote = deleteContainer.querySelector('.text-danger');
    if (existingNote) existingNote.remove();
  }
  
  // Set to add or edit mode
  if (userId) {
    // Edit mode
    modalTitle.textContent = 'Edit User';
    form.dataset.userId = userId;
    
    // Show delete button in edit mode
    if (deleteBtn) deleteBtn.style.display = 'block';
    
    // Hide password fields in edit mode
    if (passwordFields) {
      passwordFields.style.display = 'none';
    }
    
    // Fetch user data and populate form
    fetchUserData(userId).then(user => {
      if (user) {
        document.getElementById('username').value = user.username || '';
        document.getElementById('email').value = user.email || '';
        document.getElementById('role').value = user.role || 'User';
        document.getElementById('status').value = user.status || 'active';
        
        // Make username and email read-only in edit mode
        document.getElementById('username').readOnly = true;
        document.getElementById('email').readOnly = true;
        
        // Check if the user is an admin and disable delete button if true
        if (user.role === 'Admin' && deleteBtn) {
          deleteBtn.disabled = true;
          deleteBtn.classList.add('btn-disabled');
          deleteBtn.setAttribute('title', 'Admin users cannot be deleted');
          
          // Add warning message for admin users only
          const deleteNote = document.createElement('div');
          deleteNote.className = 'form-help text-danger';
          deleteNote.innerHTML = '<i class="fas fa-info-circle"></i> Admin users cannot be deleted.';
          deleteContainer.appendChild(deleteNote);
        } else if (deleteBtn) {
          // If not an admin, ensure the button is enabled
          deleteBtn.disabled = false;
          deleteBtn.classList.remove('btn-disabled');
          deleteBtn.setAttribute('title', 'Delete this user');
        }
      }
    });
  } else {
    // Add mode
    modalTitle.textContent = 'Add New User';
    delete form.dataset.userId;
    
    // Hide delete button in add mode
    if (deleteBtn) {
      deleteBtn.style.display = 'none';
      deleteBtn.disabled = false; // Reset the disabled state
      deleteBtn.classList.remove('btn-disabled'); // Remove the disabled styling
    }
    
    // Show password fields in add mode
    if (passwordFields) {
      passwordFields.style.display = 'block';
    }
    
    // Make username and email editable in add mode
    document.getElementById('username').readOnly = false;
    document.getElementById('email').readOnly = false;
  }
  
  // Show the modal
  modal.classList.add('show');
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
  }
}

// Form submission
async function handleSaveUser(e) {
  e.preventDefault();
  
  const form = document.getElementById('user-form');
  const saveBtn = document.getElementById('save-user-btn');
  
  if (!form) return;
  
  const isEditMode = !!form.dataset.userId;
  
  // Get form data
  const userData = {
    username: document.getElementById('username').value.trim(),
    email: document.getElementById('email').value.trim(),
    role: document.getElementById('role').value,
    status: document.getElementById('status').value
  };
  
  // Only include password for new users
  if (!isEditMode) {
    userData.password = document.getElementById('password').value;
    // Get confirmation password but don't include it in userData
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // Check if passwords match
    if (userData.password !== confirmPassword) {
      showAlert('Passwords do not match', 'warning');
      return;
    }
  }
  
  // Validate form data
  const validationResult = validateUserData(userData, isEditMode);
  if (!validationResult.valid) {
    showAlert(validationResult.message, 'warning');
    return;
  }
  
  // Show loading state
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  }
  
  try {
    if (isEditMode) {
      // Update existing user
      await updateUser(form.dataset.userId, userData);
      showAlert(`User ${userData.username} updated successfully`, 'success');
      showToast(`User ${userData.username} updated`, 'success');
    } else {
      // Create new user
      await createUser(userData);
      showAlert(`User ${userData.username} created successfully`, 'success');
      showToast(`User ${userData.username} created`, 'success');
    }
    
    // Hide modal and refresh user list
    hideModal('user-modal');
    
    // Reload data
    await Promise.all([
      loadUserStats(),
      loadUsers()
    ]);
  } catch (error) {
    console.error('Error saving user:', error);
    showAlert('Failed to save user: ' + error.message, 'error');
  } finally {
    // Reset button
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = 'Save User';
    }
  }
}

// API and validation functions
async function fetchUserData(userId) {
  try {
    if (typeof usersAPI !== 'undefined' && typeof usersAPI.getUser === 'function') {
      return await usersAPI.getUser(userId);
    } else {
      console.warn('usersAPI.getUser not available, using sample data');
      return {
        id: userId,
        username: 'User ' + userId,
        email: 'user' + userId + '@example.com',
        role: Math.random() > 0.8 ? 'Admin' : 'User',
        status: 'active'
      };
    }
  } catch (error) {
    console.error('Error fetching user data:', error);
    showAlert('Failed to load user data', 'error');
    return null;
  }
}

async function createUser(userData) {
  if (typeof usersAPI !== 'undefined' && typeof usersAPI.createUser === 'function') {
    return await usersAPI.createUser(userData);
  } else {
    console.warn('usersAPI.createUser not available, simulating API call');
    await new Promise(resolve => setTimeout(resolve, 800));
    console.log('User would be created:', userData);
    return { id: Date.now(), ...userData };
  }
}

async function updateUser(userId, userData) {
  if (typeof usersAPI !== 'undefined' && typeof usersAPI.updateUser === 'function') {
    return await usersAPI.updateUser(userId, userData);
  } else {
    console.warn('usersAPI.updateUser not available, simulating API call');
    await new Promise(resolve => setTimeout(resolve, 800));
    console.log(`User ${userId} would be updated:`, userData);
    return { id: userId, ...userData };
  }
}

function validateUserData(data, isEditMode = false) {
  // Username is not required in edit mode since it's read-only
  if (!isEditMode && !data.username) {
    return { valid: false, message: 'Username is required' };
  }
  
  // Email is not required in edit mode since it's read-only
  if (!isEditMode && !data.email) {
    return { valid: false, message: 'Email is required' };
  }
  
  // Validate email format for new users
  if (!isEditMode && !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).test(data.email)) {
    return { valid: false, message: 'Please enter a valid email address' };
  }
  
  // Check password for new users only
  if (!isEditMode && !data.password) {
    return { valid: false, message: 'Password is required for new users' };
  }
  
  // If password is provided for new users, validate it
  if (!isEditMode && data.password) {
    // Basic password validation - at least 8 characters
    if (data.password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters long' };
    }
  }
  
  return { valid: true };
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
