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
