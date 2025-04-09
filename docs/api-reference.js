/**
 * PhishGuard API Reference
 * ------------------------
 * This file documents all API endpoints used in the PhishGuard application.
 * Note: This is a reference file only and is not executed.
 */

// Base URL
const API_BASE_URL = 'http://localhost:3000/api';

// User Authentication Endpoints
const AUTH_ENDPOINTS = {
  login: `${API_BASE_URL}/auth/login`,             // POST - User login
  register: `${API_BASE_URL}/auth/register`,       // POST - New user registration
  verify: `${API_BASE_URL}/auth/verify`,           // GET - Verify token
  status: `${API_BASE_URL}/auth/status`,           // GET - Check auth status
  logout: `${API_BASE_URL}/auth/logout`,           // POST - Logout user
};

// URL Analysis Endpoints
const ANALYSIS_ENDPOINTS = {
  analyze: `${API_BASE_URL}/analyze-url`,          // POST - Analyze URL for phishing
  scanHistory: `${API_BASE_URL}/user/history`,     // GET - Get scan history for user
  report: `${API_BASE_URL}/reports`,               // POST - Report a suspicious URL
};

// Voting Endpoints
const VOTE_ENDPOINTS = {
  submitVote: `${API_BASE_URL}/votes`,             // POST - Submit URL vote
  getCounts: `${API_BASE_URL}/votes/counts`,       // GET - Get vote counts for URL
  getUserVotes: `${API_BASE_URL}/votes/user`,      // GET - Get votes by current user
};

// Admin Endpoints
const ADMIN_ENDPOINTS = {
  login: `${API_BASE_URL}/admin/login`,            // POST - Admin login
  status: `${API_BASE_URL}/admin/status`,          // GET - Check admin auth status
  stats: `${API_BASE_URL}/admin/stats`,            // GET - Get system statistics
  activity: `${API_BASE_URL}/admin/activity`,      // GET - Get recent activity
  users: `${API_BASE_URL}/admin/users`,            // GET/POST - List/create users
  userDetail: `${API_BASE_URL}/admin/users/{id}`,  // GET/PUT/DELETE - User operations
  
  // Admin vote management
  allVotes: `${API_BASE_URL}/admin/votes`,         // GET - Get all vote data
  voteStats: `${API_BASE_URL}/admin/votes/stats`,  // GET - Get vote statistics 
  voteSummaries: `${API_BASE_URL}/admin/votes/summaries`, // GET - Get vote summaries
  voteDetails: `${API_BASE_URL}/admin/votes/details`, // GET - Get vote details for URL
  
  // Whitelist/Blacklist management
  whitelist: `${API_BASE_URL}/lists/whitelist`,    // GET/POST - Manage whitelist
  blacklist: `${API_BASE_URL}/lists/blacklist`,    // GET/POST - Manage blacklist
};

// API Usage Examples
const API_EXAMPLES = {
  analyzeUrl: `
    // Example: Analyze a URL
    fetch('${API_BASE_URL}/analyze-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: 'https://example.com',
        useSafeBrowsing: true
      })
    })
    .then(response => response.json())
    .then(data => console.log(data));
  `,
  
  submitVote: `
    // Example: Submit a vote
    fetch('${API_BASE_URL}/votes', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-auth-token': 'YOUR_AUTH_TOKEN'
      },
      body: JSON.stringify({ 
        url: 'https://example.com',
        voteType: 'Safe' // or 'Phishing'
      })
    })
    .then(response => response.json())
    .then(data => console.log(data));
  `,
  
  getVoteCounts: `
    // Example: Get vote counts for a URL
    fetch('${API_BASE_URL}/votes/counts?url=' + encodeURIComponent('https://example.com'), {
      headers: { 'x-auth-token': 'YOUR_AUTH_TOKEN' } // Optional - includes user's vote if authenticated
    })
    .then(response => response.json())
    .then(data => console.log(data));
  `
};
