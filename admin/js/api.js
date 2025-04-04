const API_BASE_URL = 'http://localhost:3000/api';

// Store token in localStorage
const setToken = (token) => {
  localStorage.setItem('phishguardToken', token);
};

// Get token from localStorage
const getToken = () => {
  return localStorage.getItem('phishguardToken');
};

// Remove token from localStorage
const removeToken = () => {
  localStorage.removeItem('phishguardToken');
};

// Check if user is logged in
const isLoggedIn = () => {
  return getToken() !== null;
};

// Helper function to make authenticated API calls (reduces redundancy)
const apiRequest = async (endpoint, options = {}) => {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'x-auth-token': getToken(),
      ...options.headers
    };
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || `API request to ${endpoint} failed`);
    }
    
    return data;
  } catch (err) {
    console.error(`API error (${endpoint}):`, err);
    handleResponseError(err);
    throw err;
  }
};

// Login function
const login = async (username, password) => {
  try {
    console.log('Attempting admin login with:', username);
    
    const data = await apiRequest('/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // Override auth header
      body: JSON.stringify({ email: username, password })
    });
    
    // Verify that the user has admin role before storing the token
    if (data.user && data.user.role !== 'Admin') {
      throw new Error('You do not have administrator privileges');
    }
    
    setToken(data.token);
    return true;
  } catch (err) {
    console.error('Login error:', err);
    throw err;
  }
};

// Get user info
const getUserInfo = async () => {
  const data = await apiRequest('/auth/user');
  
  // Verify that the user has admin role
  if (data.role !== 'Admin') {
    // Log out the user if they're not an admin
    removeToken();
    throw new Error('You do not have administrator privileges');
  }
  
  return data;
};

// Get whitelist
const getWhitelist = async () => {
  return await apiRequest('/lists/whitelist');
};

// Add to whitelist
const addToWhitelist = async (domain) => {
  return await apiRequest('/lists/whitelist', {
    method: 'POST',
    body: JSON.stringify({ domain })
  });
};

// Remove from whitelist
const removeFromWhitelist = async (domain) => {
  return await apiRequest(`/lists/whitelist/${encodeURIComponent(domain)}`, {
    method: 'DELETE'
  });
};

// Get blacklist
const getBlacklist = async () => {
  return await apiRequest('/lists/blacklist');
};

// Add to blacklist
const addToBlacklist = async (domain) => {
  return await apiRequest('/lists/blacklist', {
    method: 'POST',
    body: JSON.stringify({ domain })
  });
};

// Remove from blacklist
const removeFromBlacklist = async (domain) => {
  return await apiRequest(`/lists/blacklist/${encodeURIComponent(domain)}`, {
    method: 'DELETE'
  });
};

// Helper function to handle common response errors
const handleResponseError = (error, redirectOnAuth = true) => {
  // Check if this is an authentication or authorization error
  if (error.message && (
      error.message.includes('Token is not valid') || 
      error.message.includes('No token') ||
      error.message.includes('Access denied') ||
      error.message.includes('privileges'))) {
    
    // Clear token
    removeToken();
    
    if (redirectOnAuth) {
      // Redirect to login page with error message
      window.location.href = '/admin/index.html?error=' + encodeURIComponent(error.message);
      return; // Stop execution after redirect
    }
  }
};