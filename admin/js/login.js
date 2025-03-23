document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const loginContainer = document.getElementById('login-container');
  const dashboardContainer = document.getElementById('dashboard-container');
  const currentUserEl = document.getElementById('current-user');
  
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
      await login(username, password);
      showDashboard();
    } catch (err) {
      loginError.textContent = err.message || 'Login failed. Please check your credentials.';
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
      currentUserEl.textContent = userInfo.username;
      
      // Show dashboard container, hide login
      loginContainer.style.display = 'none';
      dashboardContainer.style.display = 'block';
      
      // Load dashboard data
      loadDashboardData();
    } catch (err) {
      console.error('Error showing dashboard:', err);
      
      if (err.message.includes('Token')) {
        // Session expired, show login again
        showLogin();
        loginError.textContent = 'Your session has expired. Please log in again.';
      } else {
        loginError.textContent = err.message || 'An error occurred';
      }
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