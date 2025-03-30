const express = require('express');
const router = express.Router();
const AuthService = require('../services/auth');

module.exports = function(dbConnection) {
    const authService = new AuthService(dbConnection);
    const authMiddleware = require('../middleware/auth')(dbConnection);
    
    // Login route
    router.post('/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            
            if (!username || !password) {
                return res.status(400).json({ message: 'Username and password are required' });
            }
            
            // Authenticate user
            const user = await authService.authenticateUser(username, password);
            
            if (!user) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }
            
            // Check if user is admin
            if (user.Role !== 'Admin') {
                return res.status(403).json({ message: 'Access denied: Admin privileges required' });
            }
            
            // Generate token
            const token = authService.generateToken(user);
            
            res.json({ token });
        } catch (error) {
            console.error('Login error:', error);
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