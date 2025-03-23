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
    
    return router;
};