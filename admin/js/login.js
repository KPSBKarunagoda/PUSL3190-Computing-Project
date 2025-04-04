document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const loginContainer = document.getElementById('login-container');
  const dashboardContainer = document.getElementById('dashboard-container');
  const currentUserEl = document.getElementById('current-user');
  
  // Check for error parameter in URL (for redirects from other pages)
  const urlParams = new URLSearchParams(window.location.search);
  const errorMsg = urlParams.get('error');
  if (errorMsg) {
    loginError.textContent = errorMsg;
    loginError.style.display = 'block';
  }
  
  // Check if already logged in
  if (isLoggedIn()) {
    showDashboard();
  }
  
  // Handle login form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
      loginError.textContent = '';
      loginError.style.display = 'none';
      await login(username, password);
      
      // After successful login, verify admin status
      try {
        const userInfo = await getUserInfo();
        if (userInfo.role !== 'Admin') {
          throw new Error('You do not have administrator privileges');
        }
        showDashboard();
      } catch (adminErr) {
        // If verification fails, log out and show error
        removeToken();
        loginError.textContent = adminErr.message;
        loginError.style.display = 'block';
      }
    } catch (err) {
      loginError.textContent = err.message || 'Login failed. Please check your credentials.';
      loginError.style.display = 'block';
    }
  });
  
  // Handle logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    removeToken();
    showLogin();
  });
  
  // Show dashboard
  async function showDashboard() {
    try {
      // Get user info and update display
      const userInfo = await getUserInfo();
      
      // Double-check that we have admin role
      if (userInfo.role !== 'Admin') {
        throw new Error('You do not have administrator privileges');
      }
      
      currentUserEl.textContent = userInfo.username;
      
      // Show dashboard container, hide login
      loginContainer.style.display = 'none';
      dashboardContainer.style.display = 'block';
      
      // Load dashboard data
      loadDashboardData();
    } catch (err) {
      console.error('Error showing dashboard:', err);
      
      // Always show login in case of errors
      showLogin();
      
      if (err.message && (err.message.includes('Token') || err.message.includes('privileges'))) {
        loginError.textContent = err.message;
      } else {
        loginError.textContent = err.message || 'An error occurred';
      }
      
      loginError.style.display = 'block';
    }
  }
  
  // Show login
  function showLogin() {
    dashboardContainer.style.display = 'none';
    loginContainer.style.display = 'block';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
  }
});