/**
 * PhishGuard Admin - Common Utilities
 * Shared functions and utilities for all admin pages
 */

// Global DOM manipulation helpers
const DOM = {
  // Find element by ID with error protection
  get: (id) => {
    const element = document.getElementById(id);
    if (!element) console.warn(`Element #${id} not found`);
    return element;
  },
  
  // Create and show alerts
  showAlert: (message, type = 'info', containerId = 'system-alert') => {
    const container = document.getElementById(containerId);
    if (!container) return false;
    
    // Clear existing alerts
    container.innerHTML = '';
    container.className = `alert alert-${type} show`;
    
    // Add message
    container.textContent = message;
    
    // Auto-hide after 5 seconds for success/info messages
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        container.classList.remove('show');
      }, 5000);
    }
    
    return true;
  },
  
  // Hide alert
  hideAlert: (containerId = 'system-alert') => {
    const container = document.getElementById(containerId);
    if (container) container.classList.remove('show');
  },
  
  // Toggle element visibility
  toggle: (element, show) => {
    if (typeof element === 'string') element = document.getElementById(element);
    if (element) element.style.display = show ? 'block' : 'none';
  },
  
  // Enable/disable button with loading state
  buttonState: (button, isLoading, text = null, loadingText = 'Processing...') => {
    if (typeof button === 'string') button = document.getElementById(button);
    if (!button) return;
    
    if (isLoading) {
      button.disabled = true;
      if (!button._originalText) button._originalText = button.textContent;
      button.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> ${loadingText}`;
    } else {
      button.disabled = false;
      button.textContent = text || button._originalText || 'Submit';
      delete button._originalText;
    }
  }
};

// Date and time formatting utilities
const DateTime = {
  formatDate: (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  },
  
  formatDateTime: (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },
  
  timeAgo: (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return interval + 'y ago';
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + 'mo ago';
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + 'd ago';
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + 'h ago';
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + 'm ago';
    
    return Math.floor(seconds) + 's ago';
  }
};

// Simple form handling
const Forms = {
  serialize: (form) => {
    const formData = new FormData(form);
    const data = {};
    
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }
    
    return data;
  },
  
  validate: (form) => {
    const inputs = form.querySelectorAll('[required]');
    let isValid = true;
    
    inputs.forEach(input => {
      if (!input.value.trim()) {
        input.classList.add('error');
        isValid = false;
      } else {
        input.classList.remove('error');
      }
    });
    
    return isValid;
  }
};

// String utilities
const Strings = {
  truncate: (str, length = 30) => {
    if (!str || str.length <= length) return str;
    return str.substring(0, length) + '...';
  },
  
  sanitize: (str) => {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },
  
  isValidURL: (str) => {
    try {
      new URL(str);
      return true;
    } catch (e) {
      return false;
    }
  },
  
  extractDomain: (url) => {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch (e) {
      return url;
    }
  }
};

// Authentication utilities
const Auth = {
  isAuthenticated: () => {
    return localStorage.getItem('phishguard_admin_token') !== null;
  },
  
  getToken: () => {
    return localStorage.getItem('phishguard_admin_token');
  },
  
  checkAuth: async () => {
    try {
      const token = Auth.getToken();
      if (!token) {
        return false;
      }
      
      const response = await fetch(`${API_BASE_URL}/admin/status`, {
        headers: {
          'x-auth-token': token
        }
      });
      
      if (!response.ok) {
        console.warn('Auth check failed:', response.status);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Auth check error:', error);
      return false;
    }
  },
  
  getUserInfo: () => {
    const userJson = localStorage.getItem('phishguard_admin');
    if (!userJson) return null;
    
    try {
      return JSON.parse(userJson);
    } catch (e) {
      console.error('Error parsing user data:', e);
      localStorage.removeItem('phishguard_admin');
      return null;
    }
  },
  
  logout: () => {
    localStorage.removeItem('phishguard_admin_token');
    localStorage.removeItem('phishguard_admin');
    window.location.href = 'index.html?message=loggedOut';
  },
  
  requireAuth: () => {
    if (!Auth.isAuthenticated()) {
      window.location.href = 'index.html?error=' + encodeURIComponent('Authentication required');
      return false;
    }
    return true;
  }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Set up logout buttons
  document.querySelectorAll('#logout-btn').forEach(btn => {
    btn.addEventListener('click', Auth.logout);
  });
  
  // Set sidebar toggle behavior
  const sidebarToggle = document.getElementById('sidebar-toggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      const sidebar = DOM.get('sidebar');
      if (sidebar) {
        sidebar.classList.toggle('collapsed');
      }
    });
  }
  
  // Set current user display
  const currentUserEl = document.getElementById('current-user');
  if (currentUserEl) {
    const userInfo = Auth.getUserInfo();
    if (userInfo) {
      currentUserEl.textContent = userInfo.username || 'Admin';
    }
  }
  
  // Check for authentication on restricted pages
  const isLoginPage = window.location.pathname.endsWith('index.html') || 
                     window.location.pathname.endsWith('/admin/');
  
  if (!isLoginPage) {
    const token = Auth.getToken();
    if (!token) {
      window.location.href = 'index.html?error=' + encodeURIComponent('Please login to access the admin panel');
    }
  }
  
  // Check for error or success messages in URL
  const urlParams = new URLSearchParams(window.location.search);
  const errorMsg = urlParams.get('error');
  const successMsg = urlParams.get('success');
  
  if (errorMsg) {
    DOM.showAlert(errorMsg, 'danger');
  } else if (successMsg) {
    DOM.showAlert(successMsg, 'success');
  }
});

// Export utility objects
window.DOM = DOM;
window.DateTime = DateTime;
window.Forms = Forms;
window.Strings = Strings;
window.Auth = Auth;
