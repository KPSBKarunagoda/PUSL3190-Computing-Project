/**
 * Common utilities for PhishGuard Admin Panel
 */

// DOM Utilities
const DOM = {
  /**
   * Get an element by selector
   * @param {string} selector - CSS selector
   * @param {Element} parent - Parent element to search within (defaults to document)
   * @returns {Element|null} - The found element or null
   */
  get: (selector, parent = document) => {
    return parent.querySelector(selector);
  },
  
  /**
   * Get all elements matching a selector
   * @param {string} selector - CSS selector
   * @param {Element} parent - Parent element to search within (defaults to document)
   * @returns {NodeList} - List of matching elements
   */
  getAll: (selector, parent = document) => {
    return parent.querySelectorAll(selector);
  },

  /**
   * Update button state (loading/normal)
   */
  buttonState: (button, isLoading, icon = null, loadingText = null) => {
    if (!button) return;
    
    const originalText = button.dataset.originalText || button.textContent;
    
    if (isLoading) {
      // Store original text if not already saved
      if (!button.dataset.originalText) {
        button.dataset.originalText = originalText;
      }
      
      button.disabled = true;
      button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText || 'Loading...'}`;
    } else {
      button.disabled = false;
      button.innerHTML = icon ? `<i class="${icon}"></i> ${originalText}` : originalText;
    }
  },
  
  /**
   * Show an alert message
   */
  showAlert: (message, type = 'info', selector = '.alert-container') => {
    const container = document.querySelector(selector);
    if (!container) return;
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    container.innerHTML = '';
    container.appendChild(alert);
    
    // Auto-dismiss success and info alerts after 5 seconds
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        alert.classList.add('fade-out');
        setTimeout(() => container.innerHTML = '', 300);
      }, 5000);
    }
  }
};

// Admin Authentication Utilities - ensure Auth is only declared once globally
if (typeof window.Auth === 'undefined') {
  window.Auth = {
    /**
     * Check if admin is logged in
     * @returns {boolean} - True if admin token exists
     */
    isAuthenticated() {
      return !!localStorage.getItem('phishguard_admin_token');
    },
    
    /**
     * Get admin token
     * @returns {string|null} - Admin token or null
     */
    getToken() {
      return localStorage.getItem('phishguard_admin_token');
    },
    
    /**
     * Get admin user data
     * @returns {object|null} - Admin user object or null
     */
    getUser() {
      try {
        const adminJson = localStorage.getItem('phishguard_admin');
        return adminJson ? JSON.parse(adminJson) : null;
      } catch (e) {
        console.error('Error parsing admin data', e);
        return null;
      }
    },
    
    /**
     * Logout admin
     */
    logout() {
      localStorage.removeItem('phishguard_admin_token');
      localStorage.removeItem('phishguard_admin');
      window.location.href = 'index.html?action=logout';
    }
  };
}

// Export utilities to global scope
window.DOM = DOM; // Auth is already attached to window above

// Run auth check on all admin pages except login page
document.addEventListener('DOMContentLoaded', () => {
  // Check if we're on the login page
  const isLoginPage = !!document.getElementById('login-form');
  
  if (!isLoginPage) {
    // Only add logout handler here if we're not on the login page
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
      });
    }
    
    // Verify admin is authenticated
    if (!Auth.isAuthenticated()) {
      // Not authenticated, redirect to login
      window.location.href = 'index.html?error=auth_required';
    }
  }
});
