const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/admin-auth');
const AuthService = require('../services/auth');
const bcrypt = require('bcrypt');

// This is a factory function that takes a database connection and returns a router
module.exports = function(dbConnection) {
    const authService = new AuthService(dbConnection);
    
    // Public admin endpoints (no authentication required)
    
    // POST /api/admin/login - Admin login endpoint
    router.post('/login', async (req, res) => {
        try {
            const { email, password } = req.body;
            
            if (!email || !password) {
                return res.status(400).json({ message: 'Email and password required' });
            }
            
            console.log(`Admin login attempt for email: ${email}`);
            
            // Get user with matching email
            const [users] = await dbConnection.execute(
                'SELECT UserID, Username, Email, PasswordHash, Role FROM User WHERE Email = ?',
                [email]
            );
            
            if (users.length === 0) {
                console.log('Admin auth failed: Email not found');
                return res.status(401).json({ message: 'Invalid email or password' });
            }
            
            const user = users[0];
            
            // Verify password
            const isMatch = await bcrypt.compare(password, user.PasswordHash);
            
            if (!isMatch) {
                console.log('Admin auth failed: Password incorrect');
                return res.status(401).json({ message: 'Invalid email or password' });
            }
            
            // Check if user has Admin role
            if (user.Role !== 'Admin') {
                console.log('Admin auth failed: User is not an admin');
                return res.status(403).json({ message: 'Access denied - Admin privileges required' });
            }
            
            // Generate JWT token
            const token = authService.generateToken(user);
            
            // Success response
            res.json({
                token,
                user: {
                    id: user.UserID,
                    username: user.Username,
                    email: user.Email,
                    role: user.Role
                }
            });
            
            console.log('Admin login successful for user:', user.Username);
        } catch (error) {
            console.error('Admin login error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });
    
    // Protected admin endpoints (authentication required)
    
    // Apply admin auth middleware to all routes below this
    router.use(adminAuth(dbConnection));
    
    // GET /api/admin/status - Check admin status
    router.get('/status', async (req, res) => {
        try {
            res.json({
                message: 'Admin authentication successful',
                user: {
                    id: req.user.id,
                    username: req.user.username,
                    role: req.user.role
                }
            });
        } catch (err) {
            console.error('Admin status error:', err);
            res.status(500).json({ message: 'Server error' });
        }
    });
    
    // GET /api/admin/stats - Get site statistics
    router.get('/stats', async (req, res) => {
        try {
            // Get user count
            const [userCount] = await dbConnection.execute('SELECT COUNT(*) as count FROM User');
            
            // Get whitelist count
            let whitelistCount = [{ count: 0 }];
            try {
                [whitelistCount] = await dbConnection.execute('SELECT COUNT(*) as count FROM Whitelist');
            } catch (err) {
                console.log('Whitelist table may not exist:', err.message);
            }
            
            // Get blacklist count
            let blacklistCount = [{ count: 0 }];
            try {
                [blacklistCount] = await dbConnection.execute('SELECT COUNT(*) as count FROM Blacklist');
            } catch (err) {
                console.log('Blacklist table may not exist:', err.message);
            }
            
            // Get scan count (if scan table exists)
            let scanCount = [{ count: 0 }];
            try {
                [scanCount] = await dbConnection.execute('SELECT COUNT(*) as count FROM URLHistory');
            } catch (err) {
                console.log('URLHistory table may not exist:', err.message);
            }
            
            res.json({
                usersCount: userCount[0].count || 0,
                whitelistCount: whitelistCount[0].count || 0,
                blacklistCount: blacklistCount[0].count || 0,
                totalScans: scanCount[0].count || 0
            });
        } catch (error) {
            console.error('Error getting admin stats:', error);
            res.status(500).json({ message: 'Error retrieving statistics' });
        }
    });
    
    // GET /api/admin/activity - Get recent activity
    router.get('/activity', async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 10;
            
            // Check if ActivityLog table exists
            let activities = [];
            try {
                [activities] = await dbConnection.execute(
                    'SELECT * FROM ActivityLog ORDER BY Timestamp DESC LIMIT ?',
                    [limit]
                );
            } catch (err) {
                console.log('ActivityLog table may not exist:', err.message);
                
                // Return empty activities array
                return res.json({ activities: [] });
            }
            
            res.json({ activities });
        } catch (error) {
            console.error('Error getting activity logs:', error);
            res.status(500).json({ message: 'Error retrieving activity logs' });
        }
    });

    return router;
};
