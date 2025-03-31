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

// Login function
const login = async (username, password) => {
  try {
    console.log('Attempting admin login with:', username);
    
    const response = await fetch(`${API_BASE_URL}/auth/admin-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        email: username, // Use the username parameter as email
        password 
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
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
  try {
    const response = await fetch(`${API_BASE_URL}/auth/user`, {
      headers: {
        'x-auth-token': getToken()
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get user info');
    }
    
    return data;
  } catch (err) {
    console.error('Get user info error:', err);
    throw err;
  }
};

// Get whitelist
const getWhitelist = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/lists/whitelist`, {
      headers: {
        'x-auth-token': getToken()
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get whitelist');
    }
    
    return data;
  } catch (err) {
    console.error('Get whitelist error:', err);
    throw err;
  }
};

// Add to whitelist
const addToWhitelist = async (domain) => {
  try {
    const response = await fetch(`${API_BASE_URL}/lists/whitelist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': getToken()
      },
      body: JSON.stringify({ domain })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to add to whitelist');
    }
    
    return data;
  } catch (err) {
    console.error('Add to whitelist error:', err);
    throw err;
  }
};

// Remove from whitelist
const removeFromWhitelist = async (domain) => {
  try {
    const response = await fetch(`${API_BASE_URL}/lists/whitelist/${encodeURIComponent(domain)}`, {
      method: 'DELETE',
      headers: {
        'x-auth-token': getToken()
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to remove from whitelist');
    }
    
    return data;
  } catch (err) {
    console.error('Remove from whitelist error:', err);
    throw err;
  }
};

// Get blacklist
const getBlacklist = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/lists/blacklist`, {
      headers: {
        'x-auth-token': getToken()
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get blacklist');
    }
    
    return data;
  } catch (err) {
    console.error('Get blacklist error:', err);
    throw err;
  }
};

// Add to blacklist
const addToBlacklist = async (domain) => {
  try {
    const response = await fetch(`${API_BASE_URL}/lists/blacklist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': getToken()
      },
      body: JSON.stringify({ domain })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to add to blacklist');
    }
    
    return data;
  } catch (err) {
    console.error('Add to blacklist error:', err);
    throw err;
  }
};

// Remove from blacklist
const removeFromBlacklist = async (domain) => {
  try {
    const response = await fetch(`${API_BASE_URL}/lists/blacklist/${encodeURIComponent(domain)}`, {
      method: 'DELETE',
      headers: {
        'x-auth-token': getToken()
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to remove from blacklist');
    }
    
    return data;
  } catch (err) {
    console.error('Remove from blacklist error:', err);
    throw err;
  }
};