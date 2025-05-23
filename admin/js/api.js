/**
 * PhishGuard Admin API Service
 * 
 * Handles all API communication with the backend
 */

// Base API URL with explicit protocol, host and port
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
    
    // Add authentication token if available
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
    
    // Log response status for debugging
    console.log(`API Response status: ${response.status} for ${url}`);
    
    // Get response text first for debugging
    const responseText = await response.text();
    console.log(`API Response text: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
    
    // Parse response as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('JSON parse error:', e);
      throw new Error('Invalid response format from server');
    }
    
    // Handle HTTP errors
    if (!response.ok) {
      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        console.log('Auth error detected, logging out');
        localStorage.removeItem('phishguard_admin_token');
        localStorage.removeItem('phishguard_admin');
        window.location.href = '/admin/index.html?error=' + encodeURIComponent(data.message || 'Authentication failed');
        throw new Error('Session expired. Please log in again.');
      }
      
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }
    
    // Return parsed JSON response
    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
}

/* Authentication APIs*/

const authAPI = {
  // Login with email and password 
  login: async (email, password) => {
    try {
      console.log(`Attempting admin login for email: ${email}`);
      
      const response = await fetch(`${API_BASE_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      // Parse the response directly
      const data = await response.json();
      
      // Check for errors
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }
      
      // Validate admin role
      if (!data.user || data.user.role !== 'Admin') {
        throw new Error('You do not have administrator privileges');
      }
      
      // Store token and basic user info
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
      throw error;
    }
  },
  
  // Logout
  logout: () => {
    localStorage.removeItem('phishguard_admin_token');
    localStorage.removeItem('phishguard_admin');
    window.location.href = '/admin/index.html?message=loggedOut';
  }
};

/* Dashboard APIs*/
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
      return { activities: [] };
    }
  }
};

/* Whitelist/Blacklist APIs*/

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
      console.log('API: Adding to whitelist:', domain);
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
  
  // Get blacklist statistics
  getBlacklistStats: async (timeframe = 'week') => {
    try {
      return await apiRequest(`/lists/blacklist/stats?timeframe=${timeframe}`);
    } catch (error) {
      console.error('Error fetching blacklist stats:', error);
      // Return default structure for error handling
      return {
        labels: [],
        counts: [],
        totalCount: 0,
        recentAdditions: 0,
        error: error.message
      };
    }
  },
  
  // Add domain to blacklist
  addToBlacklist: async (domain, token = null, riskLevel = 100, isSystem = false) => {
    try {
      console.log('API: Adding to blacklist:', domain, 'with risk level:', riskLevel);
      
      // If token is provided, use direct fetch method for external components
      if (token) {
        return await listsAPI.addUrlToBlacklist(domain, token, riskLevel, isSystem);
      }
      
      // Otherwise use standard apiRequest
      return await apiRequest('/lists/blacklist', {
        method: 'POST',
        body: JSON.stringify({ 
          url: domain, // Send as URL
          riskLevel: riskLevel, // Include risk level
          is_system: isSystem // Add is_system flag
        })
      });
    } catch (error) {
      console.error('Error adding to blacklist:', error);
      throw error;
    }
  },
  
  // Remove domain from blacklist
  removeFromBlacklist: async (url) => {
    try {
      // Validate URL parameter
      if (!url || typeof url !== 'string') {
        throw new Error('URL parameter is required for deletion');
      }
      
      // Trim whitespace
      const trimmedUrl = url.trim();
      if (!trimmedUrl) {
        throw new Error('URL cannot be empty');
      }
      
      console.log(`Removing URL from blacklist: ${trimmedUrl}`);
      
      // URL encode the parameter
      const encodedUrl = encodeURIComponent(trimmedUrl);
      
      return await apiRequest(`/lists/blacklist/${encodedUrl}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Error removing from blacklist:', error);
      throw error;
    }
  },
  
  // Add URL to whitelist with specific token 
  addUrlToWhitelist: async (url, token) => {
    if (!token) {
      // Try to get token from Auth if available
      token = Auth?.getToken() || localStorage.getItem('phishguard_admin_token');
      if (!token) {
        throw new Error('Authentication required');
      }
    }
    
    try {
      const response = await fetch('http://localhost:3000/api/lists/whitelist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to add to whitelist: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API error in addUrlToWhitelist:', error);
      throw error;
    }
  },
  
  // Add URL to blacklist with specific token (for external components)
  addUrlToBlacklist: async (url, token, riskLevel = 100, isSystem = false) => {
    if (!token) {
      // Try to get token from Auth if available
      token = Auth?.getToken() || localStorage.getItem('phishguard_admin_token');
      if (!token) {
        throw new Error('Authentication required');
      }
    }
    
    try {
      // Send the complete URL as the primary identifier
      const response = await fetch('http://localhost:3000/api/lists/blacklist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify({ 
          url: url,  // Send the full URL as the primary field
          riskLevel: riskLevel, // Include risk level
          is_system: isSystem // Add is_system flag
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to add to blacklist: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API error in addUrlToBlacklist:', error);
      throw error;
    }
  },
  
  // Add function to get key findings for a blacklisted URL
  getKeyFindings: async (blacklistId) => {
    try {
      return await apiRequest('/education/key-findings', {
        method: 'POST',
        body: JSON.stringify({
          analysisResult: { blacklist_id: blacklistId }
        })
      });
    } catch (error) {
      console.error('Error fetching key findings:', error);
      throw error;
    }
  }
};

/** User Management APIs*/
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

/* Votes API*/
const votesAPI = {
  /**
   * Get raw votes directly from database
   * @returns {Promise<Array>} Raw vote data from database
   */
  async getVotes() {
    try {
      console.log('Fetching votes from API...');
      const response = await apiRequest('/votes');
      console.log(`Received ${Array.isArray(response) ? response.length : 0} votes from API`);
      return response || [];
    } catch (error) {
      console.error('Error fetching votes:', error);
      throw error;
    }
  },
  
  /**
   * Get vote statistics
   * @returns {Promise<Object>} Vote stats including counts and trends
   */
  async getStats() {
    try {
      const response = await apiRequest('/votes/stats');
      return response || {
        total: 0,
        safeCount: 0,
        phishingCount: 0,
        recentActivity: []
      };
    } catch (error) {
      console.error('Error fetching vote stats:', error);
      throw error;
    }
  },
  
  /**
   * Get vote details for a specific URL
   * @param {string} url The URL to get vote details for
   * @returns {Promise<Object>} Vote details including all individual votes
   */
  async getVoteDetails(url) {
    try {
      return await apiRequest(`/votes/url?url=${encodeURIComponent(url)}`);
    } catch (error) {
      console.error('Error fetching vote details:', error);
      throw error;
    }
  },
  
  /**
   * Get vote statistics with token
   * @param {string} token Authentication token
   * @returns {Promise<Object>} Vote stats including counts and trends
   */
  async getStats(token) {
    if (!token) {
      throw new Error('Authentication required');
    }
    
    try {
      const response = await fetch('http://localhost:3000/api/votes/stats', {
        headers: {
          'x-auth-token': token
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch vote stats: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Map data to consistent naming convention
      return {
        total: data.total || 0,
        positiveCount: data.positiveCount || 0,
        negativeCount: data.negativeCount || 0,
        urlsVoted: data.urlsVoted || 0,
        uniqueVoters: data.uniqueVoters || 0,
        recentActivity: data.recentActivity || []
      };
    } catch (error) {
      console.error('API error in getStats:', error);
      throw error;
    }
  },
  
  /**
   * Get all votes for admin view
   * @param {string} token Authentication token
   * @returns {Promise<Array>} Raw vote data from database
   */
  async getVotes(token) {
    if (!token) {
      throw new Error('Authentication required');
    }
    
    try {
      const response = await fetch('http://localhost:3000/api/votes', {
        headers: {
          'x-auth-token': token
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch votes: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API error in getVotes:', error);
      throw error;
    }
  },
  
  /**
   * Get votes for specific URL
   * @param {string} url The URL to get vote details for
   * @param {string} token Authentication token
   * @returns {Promise<Object>} Vote details including all individual votes
   */
  async getVotesByUrl(url, token) {
    if (!token) {
      throw new Error('Authentication required');
    }
    
    if (!url) {
      throw new Error('URL is required');
    }
    
    try {
      const response = await fetch(`http://localhost:3000/api/votes/url?url=${encodeURIComponent(url)}`, {
        headers: {
          'x-auth-token': token
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch votes by URL: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API error in getVotesByUrl:', error);
      throw error;
    }
  },
  
  /**
   * Add URL to whitelist
   * @param {string} url URL to whitelist
   */
  async addToWhitelist(url) {
    try {
      const domain = extractDomain(url);
      return await apiRequest('/lists/whitelist', {
        method: 'POST',
        body: JSON.stringify({ domain })
      });
    } catch (error) {
      console.error('Error adding to whitelist:', error);
      throw error;
    }
  },
  
  /**
   * Add URL to blacklist
   * @param {string} url URL to blacklist
   */
  async addToBlacklist(url) {
    try {
      const domain = extractDomain(url);
      return await apiRequest('/lists/blacklist', {
        method: 'POST',
        body: JSON.stringify({ domain })
      });
    } catch (error) {
      console.error('Error adding to blacklist:', error);
      throw error;
    }
  }
};

/* Analytics APIs*/
const analyticsAPI = {
  // Get activity analytics data
  getActivityAnalytics: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      // Add parameters to query string
      if (params.days) queryParams.append('days', params.days);
      
      const queryString = queryParams.toString();
      const endpoint = `/admin/analytics/activity${queryString ? `?${queryString}` : ''}`;
      
      console.log(`Fetching analytics data with params:`, params);
      return await apiRequest(endpoint);
    } catch (error) {
      console.error('Error fetching activity analytics:', error);
      // Return empty structure instead of throwing to improve error handling
      return {
        labels: [],
        counts: [],
        totalActivities: 0,
        highRiskCount: 0,
        mediumRiskCount: 0,
        lowRiskCount: 0,
        error: error.message
      };
    }
  }
};

/* Contact API*/
const api = {
  // Generic fetch with auth
  async fetch(endpoint, options = {}) {
    const token = localStorage.getItem('phishguard_admin_token');
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      }
    };
    
    const fetchOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...(options.headers || {})
      }
    };
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  },
  
  // Contact API
  contact: {
    // Get all submissions
    async getAll() {
      return await api.fetch('/contact-us');
    },
    
    // Mark as read
    async markAsRead(id) {
      return await api.fetch(`/contact-us/${id}/read`, {
        method: 'PUT'
      });
    },
    
    // Update status
    async updateStatus(id, status) {
      return await api.fetch(`/contact-us/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
    },
    
    // Save notes
    async saveNotes(id, notes) {
      return await api.fetch(`/contact-us/${id}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ admin_notes: notes })
      });
    },
    
    // Delete submission
    async delete(id) {
      return await api.fetch(`/contact-us/${id}`, {
        method: 'DELETE'
      });
    }
  }
};

/*Helper function to extract domain from URL*/
function extractDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch (e) {
    // If URL parsing fails, return the original string
    return url;
  }
}

// Export all APIs
window.authAPI = authAPI;
window.dashboardAPI = dashboardAPI;
window.listsAPI = listsAPI;
window.usersAPI = usersAPI;
window.votesAPI = votesAPI;
window.analyticsAPI = analyticsAPI;
window.api = api;
