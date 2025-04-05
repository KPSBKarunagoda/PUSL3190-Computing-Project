/**
 * PhishGuard Admin - Login Page
 * Handles admin authentication flow
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check if already authenticated - ADMIN-SPECIFIC TOKEN KEY
  const token = localStorage.getItem('phishguard_admin_token');
  if (token) {
    // Verify token validity before redirecting
    verifyToken(token)
      .then(isValid => {
        if (isValid) {
          window.location.replace('dashboard.html');
        }
      })
      .catch(console.error);
  }

  // Get login form elements
  const loginForm = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const alertContainer = document.getElementById('auth-alert');
  const submitButton = loginForm.querySelector('button[type="submit"]');

  // Add toggle password functionality
  const togglePassword = document.querySelector('.toggle-password');
  if (togglePassword) {
    togglePassword.addEventListener('click', function() {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      
      const icon = this.querySelector('i');
      if (icon) {
        icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
      }
    });
  }

  // Handle form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Hide any existing alerts
    hideAlert();

    // Get form values
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Basic validation
    if (!email || !password) {
      showAlert('Please enter both email and password', 'danger');
      return;
    }

    try {
      // Show loading state
      const btnText = submitButton.querySelector('.btn-text');
      const btnLoader = submitButton.querySelector('.btn-loader');
      
      submitButton.disabled = true;
      if (btnText) btnText.style.display = 'none';
      if (btnLoader) btnLoader.style.display = 'inline-block';

      // Call the login API - ADDED ADMIN-SPECIFIC ENDPOINT
      const response = await fetch('http://localhost:3000/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });
      
      // Parse the response
      const data = await response.json();
      
      // Check for error response
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }
      
      // Success - save token with ADMIN-SPECIFIC KEYS
      localStorage.setItem('phishguard_admin_token', data.token);
      localStorage.setItem('phishguard_admin', JSON.stringify({
        id: data.user.id,
        username: data.user.username,
        role: data.user.role
      }));
      
      // Show success message
      showAlert('Login successful! Redirecting...', 'success');
      
      // Redirect to dashboard
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1000);
      
    } catch (error) {
      console.error('Login failed:', error);
      
      // Show error message
      showAlert(error.message || 'Login failed. Please check your credentials.', 'danger');
      
      // Clear password field for security
      passwordInput.value = '';
    } finally {
      // Restore button state
      submitButton.disabled = false;
      const btnText = submitButton.querySelector('.btn-text');
      const btnLoader = submitButton.querySelector('.btn-loader');
      
      if (btnText) btnText.style.display = 'inline-block';
      if (btnLoader) btnLoader.style.display = 'none';
    }
  });

  // Check URL parameters for messages
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('error')) {
    showAlert(decodeURIComponent(urlParams.get('error')), 'danger');
  } else if (urlParams.has('message') && urlParams.get('message') === 'loggedOut') {
    showAlert('You have been logged out successfully.', 'info');
  }
});

// Show alert message
function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById('auth-alert');
  if (!alertContainer) return;
  
  alertContainer.textContent = message;
  alertContainer.className = `alert alert-${type} show`;
}

// Hide alert message
function hideAlert() {
  const alertContainer = document.getElementById('auth-alert');
  if (!alertContainer) return;
  
  alertContainer.classList.remove('show');
}

// Verify if token is still valid
async function verifyToken(token) {
  try {
    // Send request to check token validity - ADMIN SPECIFIC ENDPOINT
    const response = await fetch('http://localhost:3000/api/admin/status', {
      headers: {
        'x-auth-token': token
      }
    });
    
    return response.ok;
  } catch (error) {
    console.error('Token verification failed:', error);
    return false;
  }
}
