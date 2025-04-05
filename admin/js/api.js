/**
 * PhishGuard Admin API Service
 * 
 * Handles all API communication with the backend
 */

// Base API URL
const API_BASE_URL = 'http://localhost:3000/api';

/**
 * Makes an authenticated API request
 * 
 * @param {string} endpoint - API endpoint path (without the base URL)
 * @param {object} options - Fetch options (method, body, etc.)
 * @returns {Promise<any>} - Promise resolving to the API response
 */
async function apiRequest(endpoint, options = {}) {
  try {
    // Ensure headers exist
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers || {}
    };
    
    // Add authentication token if available - USING CONSISTENT TOKEN KEY
    const token = localStorage.getItem('phishguard_admin_token');
    if (token) {
      headers['x-auth-token'] = token;
    }
    
    // Create request URL
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Log the request for debugging
    console.log(`API Request: ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    // Handle HTTP errors
    if (!response.ok) {
      // Try to parse error message from response
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: `HTTP Error: ${response.status}` };
      }
      
      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        // Clear token and redirect to login
        localStorage.removeItem('phishguard_admin_token');
        window.location.href = '/admin/index.html?error=' + encodeURIComponent(errorData.message || 'Authentication failed');
        throw new Error('Session expired. Please log in again.');
      }
      
      throw new Error(errorData.message || `Request failed with status ${response.status}`);
    }
    
    // Return JSON response
    return await response.json();
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
}

/**
 * Authentication APIs
 */
const authAPI = {
  // Login with email and password
  login: async (email, password) => {
    try {
      console.log(`Attempting admin login for: ${email}`);
      
      // VERIFY THE ADMIN ENDPOINT
      const loginUrl = `${API_BASE_URL}/admin/login`;
      console.log(`Login URL: ${loginUrl}`);
      
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      console.log(`Login response status: ${response.status}`);
      
      // Get response text for detailed debugging
      const responseText = await response.text();
      console.log(`Login response text: ${responseText}`);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse login response as JSON:', parseError);
        throw new Error('Invalid server response format');
      }
      
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }
      
      // Validate admin role
      if (!data.user || data.user.role !== 'Admin') {
        throw new Error('You do not have administrator privileges');
      }
      
      console.log('Login successful, user:', data.user);
      
      // Store token and basic user info - USING CONSISTENT TOKEN KEYS
      localStorage.setItem('phishguard_admin_token', data.token);
      localStorage.setItem('phishguard_admin', JSON.stringify({
        id: data.user.id,
        username: data.user.username,
        role: data.user.role
      }));
      
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },
  
  // Check authentication status
  checkAuth: async () => {
    try {
      return await apiRequest('/admin/status');
    } catch (error) {
      // Will be caught by apiRequest if unauthorized
      throw error;
    }
  },
  
  // Logout
  logout: () => {
    // CHECKED: Already using correct admin keys
    localStorage.removeItem('phishguard_admin_token');
    localStorage.removeItem('phishguard_admin');
    window.location.href = '/admin/index.html?message=loggedOut';
  }
};

/**
 * Dashboard APIs
 */
const dashboardAPI = {
  // Get system statistics
  getStats: async () => {
    try {
      return await apiRequest('/admin/stats');
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  },
  
  // Get recent activity
  getActivity: async (limit = 10) => {
    try {
      return await apiRequest(`/admin/activity?limit=${limit}`);
    } catch (error) {
      console.error('Error fetching activity:', error);
      // Return empty array on failure
      return { activities: [] };
    }
  }
};

/**
 * Whitelist/Blacklist APIs
 */
const listsAPI = {
  // Get whitelisted domains
  getWhitelist: async () => {
    try {
      return await apiRequest('/lists/whitelist');
    } catch (error) {
      console.error('Error fetching whitelist:', error);
      throw error;
    }
  },
  
  // Add domain to whitelist
  addToWhitelist: async (domain) => {
    try {
      return await apiRequest('/lists/whitelist', {
        method: 'POST',
        body: JSON.stringify({ domain })
      });
    } catch (error) {
      console.error('Error adding to whitelist:', error);
      throw error;
    }
  },
  
  // Remove domain from whitelist
  removeFromWhitelist: async (domain) => {
    try {
      return await apiRequest(`/lists/whitelist/${encodeURIComponent(domain)}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Error removing from whitelist:', error);
      throw error;
    }
  },
  
  // Get blacklisted domains
  getBlacklist: async () => {
    try {
      return await apiRequest('/lists/blacklist');
    } catch (error) {
      console.error('Error fetching blacklist:', error);
      throw error;
    }
  },
  
  // Add domain to blacklist
  addToBlacklist: async (domain) => {
    try {
      return await apiRequest('/lists/blacklist', {
        method: 'POST',
        body: JSON.stringify({ domain })
      });
    } catch (error) {
      console.error('Error adding to blacklist:', error);
      throw error;
    }
  },
  
  // Remove domain from blacklist
  removeFromBlacklist: async (domain) => {
    try {
      return await apiRequest(`/lists/blacklist/${encodeURIComponent(domain)}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Error removing from blacklist:', error);
      throw error;
    }
  }
};

/**
 * User Management APIs
 */
const usersAPI = {
  // Get all users
  getUsers: async () => {
    try {
      return await apiRequest('/admin/users');
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },
  
  // Get specific user
  getUser: async (userId) => {
    try {
      return await apiRequest(`/admin/users/${userId}`);
    } catch (error) {
      console.error('Error fetching user:', error);
      throw error;
    }
  },
  
  // Create new user
  createUser: async (userData) => {
    try {
      return await apiRequest('/admin/users', {
        method: 'POST',
        body: JSON.stringify(userData)
      });
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },
  
  // Update existing user
  updateUser: async (userId, userData) => {
    try {
      return await apiRequest(`/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(userData)
      });
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },
  
  // Delete user
  deleteUser: async (userId) => {
    try {
      return await apiRequest(`/admin/users/${userId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },
  
  // Get user statistics
  getStats: async () => {
    try {
      return await apiRequest('/admin/user-stats');
    } catch (error) {
      console.error('Error fetching user stats:', error);
      return {
        totalUsers: 0,
        activeUsers: 0,
        adminUsers: 0,
        newUsers: 0
      };
    }
  }
};

// Export all APIs
window.authAPI = authAPI;
window.dashboardAPI = dashboardAPI;
window.listsAPI = listsAPI;
window.usersAPI = usersAPI;
