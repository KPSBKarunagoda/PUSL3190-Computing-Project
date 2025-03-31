const express = require('express');
const router = express.Router();
const AuthService = require('../services/auth');
const bcrypt = require('bcrypt'); // Add this import for bcrypt

module.exports = function(dbConnection) {
    const authService = new AuthService(dbConnection);
    const authMiddleware = require('../middleware/auth')(dbConnection);
    
    // Login route
    router.post('/login', async (req, res) => {
        try {
            // Get email/username and password
            const { email, password } = req.body;
            
            console.log('Login attempt with email:', email ? email.substring(0, 2) + '***' : 'null');
            
            if (!email || !password) {
                return res.status(400).json({ message: 'Email and password are required' });
            }
            
            // Authenticate user using email
            const user = await authService.authenticateByEmail(email, password);
            
            if (!user) {
                console.log('Authentication failed for user');
                return res.status(401).json({ message: 'Invalid credentials' });
            }
            
            console.log('User authenticated successfully, role:', user.Role);
            
            // Generate token
            const token = authService.generateToken(user);
            
            // Return user info (excluding sensitive data) and token
            res.json({
                token,
                user: {
                    id: user.UserID,
                    username: user.Username,
                    role: user.Role
                }
            });
        } catch (error) {
            console.error('Login error details:', error);
            res.status(500).json({ message: 'Server error during login' });
        }
    });
    
    // Admin login route - completely separated from regular login
    router.post('/admin-login', async (req, res) => {
        try {
            // Get admin credentials from request body
            const { username, email, password } = req.body;
            
            // Check what credential was provided (username or email)
            let user = null;
            
            if (!password) {
                return res.status(400).json({ message: 'Password is required' });
            }
            
            // Try to authenticate with email if provided
            if (email) {
                console.log('Admin login attempt with email:', email);
                user = await authService.authenticateByEmail(email, password);
            } 
            // Otherwise try with username if provided
            else if (username) {
                console.log('Admin login attempt with username:', username);
                user = await authService.authenticateUser(username, password);
            } else {
                return res.status(400).json({ message: 'Username or email is required' });
            }
            
            // Check if authentication succeeded
            if (!user) {
                console.log('Admin authentication failed: Invalid credentials');
                return res.status(401).json({ message: 'Invalid credentials' });
            }
            
            // Check if user has admin role
            if (user.Role !== 'Admin') {
                console.log('Admin access denied: User role is', user.Role);
                return res.status(403).json({ message: 'Access denied: Admin privileges required' });
            }
            
            console.log('Admin authenticated successfully');
            
            // Generate token with admin role explicitly included
            const token = authService.generateToken(user);
            
            res.json({ 
                token,
                user: {
                    id: user.UserID,
                    username: user.Username,
                    email: user.Email,
                    role: user.Role
                }
            });
        } catch (error) {
            console.error('Admin login error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });
    
    // Get current user info
    router.get('/user', authMiddleware, async (req, res) => {
        try {
            const user = await authService.getUserById(req.user.id);
            
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            
            res.json({ 
                id: user.UserID,
                username: user.Username,
                role: user.Role
            });
        } catch (error) {
            console.error('Get user error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });
    
    // Register new user - explicitly log registration
    console.log('Setting up registration route at /api/auth/register');
    router.post('/register', async (req, res) => {
        try {
            // Log sanitized request data (WITHOUT password)
            const { name, email, password } = req.body;
            console.log('Registration request received:', { 
                name, 
                email: email.substring(0, 3) + '***' + email.substring(email.indexOf('@')) 
                // Don't log the password at all
            });
            
            // Validate required fields
            if (!name || !email || !password) {
                return res.status(400).json({ message: 'Name, email and password are required' });
            }
            
            // Name validation - ensure it's a string
            if (typeof name !== 'string' || name.trim().length === 0) {
                return res.status(400).json({ message: 'Valid name is required' });
            }
            
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ message: 'Invalid email format' });
            }
            
            // Validate password strength
            if (password.length < 8) {
                return res.status(400).json({ message: 'Password must be at least 8 characters long' });
            }
            
            // Check if user already exists
            const userExists = await authService.getUserByEmail(email);
            if (userExists) {
                return res.status(400).json({ message: 'User with this email already exists' });
            }
            
            // Create the user
            const user = await authService.createUser(name, email, password);
            
            // Log minimal user info without sensitive data
            console.log('User created:', { 
                id: user.UserID,
                role: user.Role
                // Don't log username or email - these are PII
            });
            
            // Generate token for auto-login
            const token = authService.generateToken(user);
            
            res.status(201).json({ 
                message: 'User registered successfully',
                token
            });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ message: 'Server error during registration: ' + error.message });
        }
    });
    
    return router;
};