/**
 * PhishGuard Admin Authentication Handler
 * 
 * Handles login form, session management, and auth protection
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check if on login page by looking for login form
  const loginForm = document.getElementById('login-form');
  
  if (loginForm) {
    // We're on the login page
    setupLoginPage();
  } else {
    // We're on another admin page, check auth
    checkAdminAuthentication();
  }
  
  // Toggle password visibility on login form
  const togglePasswordBtns = document.querySelectorAll('.toggle-password');
  togglePasswordBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const input = this.closest('.input-group').querySelector('input');
      if (input) {
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        
        const icon = this.querySelector('i');
        if (icon) {
          icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
        }
      }
    });
  });
});

function setupLoginPage() {
  // Get UI elements
  const loginForm = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const alertContainer = document.getElementById('auth-alert');
  
  // Pre-check if already authenticated
  if (Auth.isAuthenticated()) {
    // Validate existing token
    verifyExistingToken()
      .then(isValid => {
        if (isValid) {
          console.log('Already authenticated, redirecting to dashboard');
          window.location.replace('dashboard.html');
        } else {
          // Token invalid, stay on login page
          console.log('Existing token invalid');
        }
      })
      .catch(error => {
        console.error('Error verifying token:', error);
      });
  }
  
  // Handle login form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Clear previous alerts
    if (alertContainer) {
      alertContainer.textContent = '';
      alertContainer.classList.remove('show');
    }
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
      showAuthAlert('Please enter both email and password', 'danger');
      return;
    }
    
    // Disable submit button & show loading state
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    DOM.buttonState(submitBtn, true, null, 'Signing in...');
    
    // Attempt login
    try {
      const response = await authAPI.login(email, password);
      
      // Save auth data and redirect
      localStorage.setItem('phishguardToken', response.token);
      localStorage.setItem('phishguardAdmin', JSON.stringify({
        id: response.user.id,
        username: response.user.username,
        role: response.user.role
      }));
      
      // Clear password field
      passwordInput.value = '';
      
      // Show success message briefly before redirect
      showAuthAlert('Login successful, redirecting...', 'success');
      
      // Redirect to dashboard
      setTimeout(() => {
        window.location.replace('dashboard.html');
      }, 500);
      
    } catch (error) {
      console.error('Login error:', error);
      showAuthAlert(error.message || 'Login failed', 'danger');
      
      // Re-enable the button
      DOM.buttonState(submitBtn, false);
    }
  });
}

async function checkAdminAuthentication() {
  if (!Auth.isAuthenticated()) {
    // Not logged in, redirect to login page
    window.location.replace('index.html?error=' + encodeURIComponent('Authentication required'));
    return false;
  }
  
  try {
    // Verify token validity
    const isValid = await verifyExistingToken();
    if (!isValid) {
      throw new Error('Session expired');
    }
    return true;
  } catch (error) {
    console.error('Authentication check failed:', error);
    
    // Clear invalid credentials and redirect
    Auth.logout();
    return false;
  }
}

async function verifyExistingToken() {
  try {
    // Check if we have auth stored
    const token = Auth.getToken();
    if (!token) return false;
    
    // Verify with server
    const response = await authAPI.checkAuth();
    return !!response.user;
  } catch (error) {
    console.error('Token verification failed:', error);
    return false;
  }
}

function showAuthAlert(message, type = 'info') {
  const alertContainer = document.getElementById('auth-alert');
  if (!alertContainer) return;
  
  alertContainer.textContent = message;
  alertContainer.className = `alert alert-${type} show`;
  
  if (type === 'success' || type === 'info') {
    setTimeout(() => {
      alertContainer.classList.remove('show');
    }, 5000);
  }
}
