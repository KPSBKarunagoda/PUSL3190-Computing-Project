/**
 * PhishGuard Admin - User Management
 * Handles user management functionality
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Only initialize on users page
  if (!window.location.pathname.includes('users.html')) {
    return;
  }
  
  console.log('Initializing user management...');
  
  // State for pagination and user data
  const state = {
    page: 1,
    perPage: 10,
    totalItems: 0,
    searchQuery: '',
    users: [],
    selectedUser: null
  };
  
  // Initialize DOM elements
  const elements = {
    loader: DOM.get('users-loader'),
    table: DOM.get('users-table'),
    tableBody: DOM.get('users-body'),
    emptyState: DOM.get('no-users'),
    searchBox: DOM.get('user-search'),
    refreshBtn: DOM.get('refresh-users'),
    addUserBtn: DOM.get('add-user-btn'),
    exportBtn: DOM.get('export-users'),
    reportBtn: DOM.get('user-report'),
    prevButton: DOM.get('prev-page'),
    nextButton: DOM.get('next-page'),
    rangeInfo: DOM.get('users-range'),
    totalInfo: DOM.get('users-total'),
    totalUsers: DOM.get('total-users'),
    activeUsers: DOM.get('active-users'),
    adminUsers: DOM.get('admin-users'),
    newUsers: DOM.get('new-users'),
    userModal: document.getElementById('user-modal'),
    userForm: DOM.get('user-form'),
    userModalTitle: DOM.get('user-modal-title'),
    saveUserBtn: DOM.get('save-user-btn'),
    cancelUserBtn: DOM.get('cancel-user-btn'),
    deleteUserBtn: DOM.get('delete-user-btn'),
    confirmationModal: document.getElementById('confirmation-modal'),
    modalTitle: DOM.get('modal-title'),
    modalMessage: DOM.get('modal-message'),
    modalConfirm: DOM.get('modal-confirm'),
    modalCancel: DOM.get('modal-cancel'),
    modalClose: document.querySelector('.modal-close')
  };
  
  // Set up event handlers
  elements.refreshBtn?.addEventListener('click', () => loadUsers());
  elements.addUserBtn?.addEventListener('click', () => openUserModal());
  elements.searchBox?.addEventListener('input', handleSearch);
  elements.prevButton?.addEventListener('click', () => changePage(-1));
  elements.nextButton?.addEventListener('click', () => changePage(1));
  elements.exportBtn?.addEventListener('click', exportUserList);
  elements.reportBtn?.addEventListener('click', generateUserReport);
  elements.saveUserBtn?.addEventListener('click', saveUser);
  elements.cancelUserBtn?.addEventListener('click', closeUserModal);
  elements.deleteUserBtn?.addEventListener('click', () => confirmDeleteUser());
  
  // Close modal on click outside
  if (elements.userModal) {
    elements.userModal.addEventListener('click', (e) => {
      if (e.target === elements.userModal) {
        closeUserModal();
      }
    });
    
    document.querySelector('.modal-close')?.addEventListener('click', closeUserModal);
  }
  
  // Close confirmation modal on click outside
  if (elements.confirmationModal) {
    elements.confirmationModal.addEventListener('click', (e) => {
      if (e.target === elements.confirmationModal) {
        closeConfirmationModal();
      }
    });
    
    elements.confirmationModal.querySelector('.modal-close')?.addEventListener('click', closeConfirmationModal);
    elements.modalCancel?.addEventListener('click', closeConfirmationModal);
  }
  
  // Toggle password visibility
  document.querySelector('.toggle-password')?.addEventListener('click', function() {
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      
      const icon = this.querySelector('i');
      if (icon) {
        icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
      }
    }
  });
  
  // Load initial data
  try {
    await loadStats();
    await loadUsers();
  } catch (error) {
    console.error('Error initializing user management:', error);
    DOM.showAlert('Failed to initialize user management: ' + error.message, 'danger');
  }
  
  // Load user statistics
  async function loadStats() {
    try {
      const stats = await usersAPI.getStats();
      
      if (elements.totalUsers) elements.totalUsers.textContent = stats.totalUsers || 0;
      if (elements.activeUsers) elements.activeUsers.textContent = stats.activeUsers || 0;
      if (elements.adminUsers) elements.adminUsers.textContent = stats.adminUsers || 0;
      if (elements.newUsers) elements.newUsers.textContent = stats.newUsers || 0;
    } catch (error) {
      console.error('Error loading user stats:', error);
      // Set defaults on error
      if (elements.totalUsers) elements.totalUsers.textContent = '0';
      if (elements.activeUsers) elements.activeUsers.textContent = '0';
      if (elements.adminUsers) elements.adminUsers.textContent = '0';
      if (elements.newUsers) elements.newUsers.textContent = '0';
    }
  }
  
  // Load users from API
  async function loadUsers() {
    showLoading(true);
    
    try {
      // Fetch users
      const users = await usersAPI.getUsers();
      console.log(`Loaded ${users.length} users`);
      
      // Store in state
      state.users = users;
      state.totalItems = users.length;
      state.page = 1; // Reset to first page
      
      // Update UI
      renderUsers();
      updatePagination();
    } catch (error) {
      console.error('Error loading users:', error);
      showError('Failed to load users data');
    } finally {
      showLoading(false);
    }
  }
  
  // Render users table
  function renderUsers() {
    if (!elements.tableBody) return;
    
    elements.tableBody.innerHTML = '';
    
    // Apply search filter if any
    let users = state.users;
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      users = users.filter(user => 
        (user.username && user.username.toLowerCase().includes(query)) || 
        (user.email && user.email.toLowerCase().includes(query))
      );
    }
    
    // If no users, show empty state
    if (users.length === 0) {
      showEmpty(true);
      return;
    }
    
    // Calculate pagination
    const startIndex = (state.page - 1) * state.perPage;
    const endIndex = Math.min(startIndex + state.perPage, users.length);
    const paginatedUsers = users.slice(startIndex, endIndex);
    
    // Update pagination info
    if (elements.rangeInfo) {
      elements.rangeInfo.textContent = users.length > 0 
        ? `${startIndex + 1}-${endIndex}` 
        : '0-0';
    }
    
    if (elements.totalInfo) {
      elements.totalInfo.textContent = users.length;
    }
    
    // Create table rows
    paginatedUsers.forEach(user => {
      const row = document.createElement('tr');
      
      const id = user.id || user.UserID || 'unknown';
      const username = user.username || user.Username || 'unknown';
      const email = user.email || user.Email || 'unknown';
      const role = user.role || user.Role || 'User';
      const status = user.status || 'active';
      const created = user.created || user.CreatedAt || new Date();
      
      // Create status class based on status value
      const statusClass = status.toLowerCase() === 'active' ? 'success' : 
                          status.toLowerCase() === 'inactive' ? 'warning' : 'danger';
      
      row.innerHTML = `
        <td>${id}</td>
        <td>${username}</td>
        <td>${email}</td>
        <td>${role}</td>
        <td><span class="badge badge-${statusClass}">${status}</span></td>
        <td>${DateTime.formatDate(created)}</td>
        <td class="actions">
          <button class="btn btn-sm btn-icon edit-user" data-id="${id}" title="Edit user">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-icon delete-user" data-id="${id}" data-username="${username}" title="Delete user">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      
      // Add event listeners to actions
      const editBtn = row.querySelector('.edit-user');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          const userToEdit = state.users.find(u => u.id === id || u.UserID === id);
          if (userToEdit) openUserModal(userToEdit);
        });
      }
      
      const deleteBtn = row.querySelector('.delete-user');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          const userToDelete = state.users.find(u => u.id === id || u.UserID === id);
          if (userToDelete) confirmDeleteUser(userToDelete);
        });
      }
      
      elements.tableBody.appendChild(row);
    });
    
    // Show table, hide empty state
    showEmpty(false);
  }
  
  // Open user modal for add/edit
  function openUserModal(user = null) {
    if (!elements.userModal || !elements.userForm) return;
    
    // Reset form
    elements.userForm.reset();
    
    // Set up modal for add or edit
    if (user) {
      // Edit existing user
      elements.userModalTitle.textContent = 'Edit User';
      elements.userForm.elements['username'].value = user.username || '';
      elements.userForm.elements['email'].value = user.email || '';
      elements.userForm.elements['role'].value = user.role || 'User';
      elements.userForm.elements['status'].value = user.status || 'active';
      
      // Password optional for edits
      document.getElementById('password-fields').style.display = 'block';
      elements.userForm.elements['password'].required = false;
      
      // Store selected user in state
      state.selectedUser = user;
      
      // Show delete button for existing users
      elements.deleteUserBtn.style.display = 'block';
    } else {
      // Add new user
      elements.userModalTitle.textContent = 'Add New User';
      
      // Password required for new users
      document.getElementById('password-fields').style.display = 'block';
      elements.userForm.elements['password'].required = true;
      
      // Clear selected user
      state.selectedUser = null;
      
      // Hide delete button for new users
      elements.deleteUserBtn.style.display = 'none';
    }
    
    // Show modal
    elements.userModal.classList.add('show');
  }
  
  // Close user modal
  function closeUserModal() {
    if (elements.userModal) {
      elements.userModal.classList.remove('show');
    }
  }
  
  // Close confirmation modal
  function closeConfirmationModal() {
    if (elements.confirmationModal) {
      elements.confirmationModal.classList.remove('show');
    }
  }
  
  // Save user (add or edit)
  async function saveUser() {
    if (!elements.userForm) return;
    
    // Validate form
    if (!Forms.validate(elements.userForm)) {
      DOM.showAlert('Please fill in all required fields', 'warning');
      return;
    }
    
    // Get form data
    const userData = {
      username: elements.userForm.elements['username'].value,
      email: elements.userForm.elements['email'].value,
      role: elements.userForm.elements['role'].value,
      status: elements.userForm.elements['status'].value,
      password: elements.userForm.elements['password'].value
    };
    
    try {
      // Show loading state
      DOM.buttonState(elements.saveUserBtn, true);
      
      if (state.selectedUser) {
        // Update existing user
        const userId = state.selectedUser.id || state.selectedUser.UserID;
        
        // If password is empty, don't send it (keep existing password)
        if (!userData.password) {
          delete userData.password;
        }
        
        await usersAPI.updateUser(userId, userData);
        DOM.showAlert(`User "${userData.username}" updated successfully`, 'success');
      } else {
        // Add new user
        if (!userData.password) {
          DOM.showAlert('Password is required for new users', 'warning');
          DOM.buttonState(elements.saveUserBtn, false);
          return;
        }
        
        await usersAPI.createUser(userData);
        DOM.showAlert(`User "${userData.username}" created successfully`, 'success');
      }
      
      // Reload data
      await loadUsers();
      await loadStats();
      
      // Close modal
      closeUserModal();
    } catch (error) {
      console.error('Error saving user:', error);
      DOM.showAlert('Failed to save user: ' + error.message, 'danger');
    } finally {
      DOM.buttonState(elements.saveUserBtn, false);
    }
  }
  
  // Confirm user deletion
  function confirmDeleteUser(user) {
    if (!elements.confirmationModal) return;
    
    const targetUser = user || state.selectedUser;
    if (!targetUser) return;
    
    // Set up modal
    elements.modalTitle.textContent = 'Confirm User Deletion';
    elements.modalMessage.textContent = `Are you sure you want to delete user "${targetUser.username}"? This action cannot be undone.`;
    
    // Set up confirm action
    elements.modalConfirm.onclick = () => {
      deleteUser(targetUser.id || targetUser.UserID);
      closeConfirmationModal();
    };
    
    // Show modal
    elements.confirmationModal.classList.add('show');
  }
  
  // Delete user
  async function deleteUser(userId) {
    try {
      DOM.showAlert('Deleting user...', 'info');
      
      await usersAPI.deleteUser(userId);
      
      // Success
      DOM.showAlert('User deleted successfully', 'success');
      
      // Reload data
      await loadUsers();
      await loadStats();
      
      // Close modals
      closeUserModal();
    } catch (error) {
      console.error('Error deleting user:', error);
      DOM.showAlert('Failed to delete user: ' + error.message, 'danger');
    }
  }
  
  // Export user list to CSV
  function exportUserList() {
    if (!state.users.length) {
      DOM.showAlert('No users to export', 'warning');
      return;
    }
    
    try {
      // Prepare CSV content
      let csvContent = 'ID,Username,Email,Role,Status,Created\n';
      
      state.users.forEach(user => {
        const id = user.id || user.UserID || '';
        const username = user.username || user.Username || '';
        const email = user.email || user.Email || '';
        const role = user.role || user.Role || '';
        const status = user.status || 'active';
        const created = user.created || user.CreatedAt || '';
        
        csvContent += `"${id}","${username}","${email}","${role}","${status}","${created}"\n`;
      });
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      link.href = url;
      link.setAttribute('download', `phishguard-users-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      
      // Trigger download and cleanup
      link.click();
      document.body.removeChild(link);
      
      DOM.showAlert('User list exported successfully', 'success');
    } catch (error) {
      console.error('Export error:', error);
      DOM.showAlert('Failed to export user list', 'danger');
    }
  }
  
  // Generate user report
  function generateUserReport() {
    // This would typically generate a more detailed PDF or report
    DOM.showAlert('Generating user activity report...', 'info');
    setTimeout(() => {
      DOM.showAlert('User report functionality will be available in the next update.', 'info');
    }, 2000);
  }
  
  // Handle search input
  function handleSearch(e) {
    state.searchQuery = e.target.value.trim();
    state.page = 1; // Reset to first page
    renderUsers();
    updatePagination();
  }
  
  // Change pagination page
  function changePage(delta) {
    const newPage = state.page + delta;
    
    // Calculate max pages
    const filteredItems = state.searchQuery
      ? state.users.filter(user => 
          (user.username && user.username.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
          (user.email && user.email.toLowerCase().includes(state.searchQuery.toLowerCase()))
        )
      : state.users;
    
    const maxPages = Math.ceil(filteredItems.length / state.perPage);
    
    // Validate page bounds
    if (newPage < 1 || newPage > maxPages) return;
    
    state.page = newPage;
    renderUsers();
    updatePagination();
  }
  
  // Update pagination buttons
  function updatePagination() {
    if (!elements.prevButton || !elements.nextButton) return;
    
    // Calculate max pages
    const filteredItems = state.searchQuery
      ? state.users.filter(user => 
          (user.username && user.username.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
          (user.email && user.email.toLowerCase().includes(state.searchQuery.toLowerCase()))
        )
      : state.users;
    
    const maxPages = Math.ceil(filteredItems.length / state.perPage);
    
    // Update button states
    elements.prevButton.disabled = state.page <= 1;
    elements.nextButton.disabled = state.page >= maxPages;
  }
  
  // UI state helpers
  function showLoading(isLoading) {
    if (elements.loader) elements.loader.style.display = isLoading ? 'flex' : 'none';
    if (elements.table) elements.table.style.display = isLoading ? 'none' : 'table';
    if (elements.emptyState) elements.emptyState.style.display = 'none';
  }
  
  function showEmpty(isEmpty) {
    if (elements.table) elements.table.style.display = isEmpty ? 'none' : 'table';
    if (elements.emptyState) elements.emptyState.style.display = isEmpty ? 'flex' : 'none';
  }
  
  function showError(message) {
    showEmpty(true);
    if (elements.emptyState) {
      elements.emptyState.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <p>${message}</p>
      `;
    }
  }
});
