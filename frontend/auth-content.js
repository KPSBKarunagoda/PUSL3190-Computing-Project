/**
 * PhishGuard Authentication Content Script
 * Monitors web app localStorage for authentication changes and syncs to extension storage
 */

console.log('PhishGuard Auth: Content script loaded');

// Function to sync auth state from web app to extension storage
function syncAuthState() {
  try {
    const token = localStorage.getItem('phishguardToken');
    let userData = null;
    
    try {
      const userDataStr = localStorage.getItem('phishguardUser');
      if (userDataStr) {
        userData = JSON.parse(userDataStr);
      }
    } catch (e) {
      console.error('Error parsing user data:', e);
    }
    
    // Direct write to extension storage - this is the key insight
    if (token) {
      console.log('Auth token found, syncing to extension');
      chrome.storage.local.set({
        'isLoggedIn': true,
        'authToken': token,
        'userData': userData,
        'authTimestamp': Date.now()
      });
    } else {
      console.log('No auth token found, clearing extension state');
      chrome.storage.local.remove(['isLoggedIn', 'authToken', 'userData', 'authTimestamp']);
    }
  } catch (e) {
    console.error('Error in syncAuthState:', e);
  }
}

// Set up monitoring for localStorage changes
window.addEventListener('storage', (event) => {
  if (event.key === 'phishguardToken' || event.key === 'phishguardUser') {
    console.log(`Storage event detected for ${event.key}`);
    syncAuthState();
  }
});

// Override localStorage methods to catch direct changes
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
  // Call original implementation first
  originalSetItem.apply(this, arguments);
  
  // Then handle auth-related changes
  if (key === 'phishguardToken' || key === 'phishguardUser') {
    console.log(`localStorage.setItem called for ${key}`);
    syncAuthState();
  }
};

const originalRemoveItem = localStorage.removeItem;
localStorage.removeItem = function(key) {
  // Call original implementation first
  originalRemoveItem.apply(this, arguments);
  
  // Then handle auth-related changes
  if (key === 'phishguardToken' || key === 'phishguardUser') {
    console.log(`localStorage.removeItem called for ${key}`);
    syncAuthState();
  }
};

// Check URL for session_expired param and show appropriate message
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('reason') === 'session_expired') {
    // Show message that session expired
    const alertContainer = document.querySelector('.alert-container') || document.createElement('div');
    if (!alertContainer.classList.contains('alert-container')) {
      alertContainer.className = 'alert-container';
      document.body.insertBefore(alertContainer, document.body.firstChild);
    }
    
    const alertEl = document.createElement('div');
    alertEl.className = 'alert alert-warning';
    alertEl.textContent = 'Your session has expired. Please log in again.';
    alertContainer.appendChild(alertEl);
    
    // Remove the param from URL
    const newUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, newUrl);
  }
});

// Monitor login form submissions
document.addEventListener('submit', (e) => {
  const form = e.target;
  if (form.id === 'login-form' || 
      (form.querySelector('input[type="password"]') && form.querySelector('input[type="email"]'))) {
    console.log('Login form submitted');
    // Wait for login to complete
    setTimeout(syncAuthState, 1000);
  }
});

// Check on page load and periodically
syncAuthState();
setInterval(syncAuthState, 30000); // Every 30 seconds

// Also check for 401 responses to detect expired tokens
(function() {
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    
    // Check for expired token response
    if (response.status === 401) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        if (data.code === 'TOKEN_EXPIRED') {
          console.log('Token expired, logging out user');
          localStorage.removeItem('phishguardToken');
          localStorage.removeItem('phishguardUser');
          syncAuthState();
          
          // Redirect to login page with expired session message
          window.location.href = 'login.html?reason=session_expired';
        }
      } catch (e) {
        // If we can't parse the response as JSON, ignore
      }
    }
    
    return response;
  };
})();
