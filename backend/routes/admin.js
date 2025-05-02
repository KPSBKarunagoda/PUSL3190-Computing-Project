const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/admin-auth');
const AuthService = require('../services/auth');
const bcrypt = require('bcrypt');

// This is a factory function that takes a database connection and returns a router
module.exports = function(dbConnection) {
    const authService = new AuthService(dbConnection);
    
    // TEST ENDPOINT - Add this first to check if admin router works
    router.get('/test', (req, res) => {
        console.log('Admin test endpoint accessed');
        res.json({ status: 'Admin router is working' });
    });
    
    // Public admin endpoints (no authentication required)
    
    // POST /api/admin/login - Admin login endpoint
    router.post('/login', async (req, res) => {
        try {
            const { email, password } = req.body;
            
            console.log(`Admin login attempt for email: ${email}`);
            
            if (!email || !password) {
                console.log('Admin login failed: Email or password missing');
                return res.status(400).json({ message: 'Email and password required' });
            }
            
            // Get user with matching email
            const [users] = await dbConnection.execute(
                'SELECT UserID, Username, Email, PasswordHash, Role FROM User WHERE Email = ?',
                [email]
            );
            
            console.log(`Found ${users.length} users matching email`);
            
            if (users.length === 0) {
                console.log('Admin auth failed: Email not found');
                return res.status(401).json({ message: 'Invalid email or password' });
            }
            
            const user = users[0];
            
            console.log(`User found: ${user.Username}, Role: ${user.Role}`);
            console.log('Password hash exists:', !!user.PasswordHash);
            
            // Verify password
            let isMatch = false;
            try {
                // Add extra protection against null hash
                if (!user.PasswordHash) {
                    console.log('Password hash is null/empty');
                    return res.status(401).json({ message: 'Invalid email or password' });
                }
                
                isMatch = await bcrypt.compare(password, user.PasswordHash);
                console.log('Password verification result:', isMatch ? 'match' : 'no match');
            } catch (err) {
                console.error('Password comparison error:', err);
                return res.status(500).json({ message: 'Authentication error' });
            }
            
            if (!isMatch) {
                console.log('Admin auth failed: Password incorrect');
                return res.status(401).json({ message: 'Invalid email or password' });
            }
            
            // Check if user has Admin role
            if (user.Role !== 'Admin') {
                console.log('Admin access denied: User role is', user.Role);
                return res.status(403).json({ message: 'Access denied - Admin privileges required' });
            }
            
            console.log('Admin authentication successful');
            
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
            res.status(500).json({ message: 'Server error during login' });
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

    // GET /api/admin/user-stats - Get user statistics
    router.get('/user-stats', async (req, res) => {
        console.log('User stats endpoint accessed');
        try {
            // Get total users count
            const [totalUsers] = await dbConnection.execute('SELECT COUNT(*) as count FROM User');
            
            // Get active users count
            let activeUsers;
            try {
                const [columns] = await dbConnection.execute("SHOW COLUMNS FROM User LIKE 'Active'");
                if (columns.length > 0) {
                    [activeUsers] = await dbConnection.execute(
                        'SELECT COUNT(*) as count FROM User WHERE Active = 1 OR Active IS NULL'
                    );
                } else {
                    // If Active column doesn't exist, count all users as active
                    activeUsers = totalUsers;
                }
            } catch (err) {
                console.log('Error checking Active column:', err.message);
                // Default to all users being active if error
                activeUsers = totalUsers;
            }
            
            // Get admin users count
            const [adminUsers] = await dbConnection.execute(
                "SELECT COUNT(*) as count FROM User WHERE Role = 'Admin'"
            );
            
            // Get new users in last 30 days
            const [newUsers] = await dbConnection.execute(
                'SELECT COUNT(*) as count FROM User WHERE RegistrationDate > DATE_SUB(NOW(), INTERVAL 30 DAY)'
            );
            
            const stats = {
                totalUsers: totalUsers[0].count || 0,
                activeUsers: activeUsers[0].count || 0,
                adminUsers: adminUsers[0].count || 0,
                newUsers: newUsers[0].count || 0
            };
            
            console.log('Returning user stats:', stats);
            res.json(stats);
        } catch (err) {
            console.error('Error getting user stats:', err);
            res.status(500).json({ 
                message: 'Error getting user statistics',
                totalUsers: 0,
                activeUsers: 0,
                adminUsers: 0,
                newUsers: 0
            });
        }
    });

    // GET /api/admin/users - Get all users
    router.get('/users', async (req, res) => {
        console.log('Get all users endpoint accessed');
        try {
            let query = `
                SELECT 
                    UserID as id, 
                    Username as username, 
                    Email as email, 
                    Role as role, 
                    RegistrationDate as created
            `;
            
            // Check if Active column exists
            try {
                const [columns] = await dbConnection.execute("SHOW COLUMNS FROM User LIKE 'Active'");
                if (columns.length > 0) {
                    query += `, CASE WHEN Active = 1 THEN 'active' ELSE 'inactive' END as status`;
                } else {
                    query += `, 'active' as status`;
                }
            } catch (err) {
                console.log('Error checking Active column:', err.message);
                query += `, 'active' as status`;
            }
            
            query += ` FROM User ORDER BY RegistrationDate DESC`;
            
            const [users] = await dbConnection.execute(query);
            
            console.log(`Returning ${users.length} users`);
            res.json(users);
        } catch (err) {
            console.error('Error getting users:', err);
            res.status(500).json({ message: 'Server error', details: err.message });
        }
    });

    // GET /api/admin/users/:id - Get specific user
    router.get('/users/:id', async (req, res) => {
        try {
            const userId = req.params.id;
            
            let query = `
                SELECT 
                    UserID as id, 
                    Username as username, 
                    Email as email, 
                    Role as role, 
                    RegistrationDate as created
            `;
            
            // Check if Active column exists
            try {
                const [columns] = await dbConnection.execute("SHOW COLUMNS FROM User LIKE 'Active'");
                if (columns.length > 0) {
                    query += `, CASE WHEN Active = 1 THEN 'active' ELSE 'inactive' END as status`;
                } else {
                    query += `, 'active' as status`;
                }
            } catch (err) {
                query += `, 'active' as status`;
            }
            
            query += ` FROM User WHERE UserID = ?`;
            
            const [users] = await dbConnection.execute(query, [userId]);
            
            if (users.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }
            
            res.json(users[0]);
        } catch (err) {
            console.error('Error getting user:', err);
            res.status(500).json({ message: 'Server error', details: err.message });
        }
    });

    // POST /api/admin/users - Create new user
    router.post('/users', async (req, res) => {
        try {
            const { username, email, password, role, status } = req.body;
            
            // Validation
            if (!username || !email) {
                return res.status(400).json({ message: 'Username and email are required' });
            }
            
            // Check if user already exists
            const [existingUsers] = await dbConnection.execute(
                'SELECT UserID FROM User WHERE Email = ? OR Username = ?',
                [email, username]
            );
            
            if (existingUsers.length > 0) {
                return res.status(400).json({ message: 'User with this email or username already exists' });
            }
            
            // Set default role if not provided
            const userRole = role || 'User';
            
            // Check if PasswordHash column exists
            const [passwordHashColumn] = await dbConnection.execute(
                "SHOW COLUMNS FROM User LIKE 'PasswordHash'"
            );
            
            let result;
            
            if (passwordHashColumn.length > 0) {
                // If password is provided, hash it
                let hashedPassword = null;
                if (password) {
                    const salt = await bcrypt.genSalt(10);
                    hashedPassword = await bcrypt.hash(password, salt);
                }
                
                // Check if Active column exists
                const [activeColumn] = await dbConnection.execute(
                    "SHOW COLUMNS FROM User LIKE 'Active'"
                );
                
                if (activeColumn.length > 0) {
                    // Set active status based on status value
                    const active = status === 'active' ? 1 : 0;
                    
                    [result] = await dbConnection.execute(
                        'INSERT INTO User (Username, Email, PasswordHash, Role, Active) VALUES (?, ?, ?, ?, ?)',
                        [username, email, hashedPassword, userRole, active]
                    );
                } else {
                    [result] = await dbConnection.execute(
                        'INSERT INTO User (Username, Email, PasswordHash, Role) VALUES (?, ?, ?, ?)',
                        [username, email, hashedPassword, userRole]
                    );
                }
            } else {
                // No PasswordHash column, just insert basic user info
                [result] = await dbConnection.execute(
                    'INSERT INTO User (Username, Email, Role) VALUES (?, ?, ?)',
                    [username, email, userRole]
                );
            }
            
            res.status(201).json({
                message: 'User created successfully',
                id: result.insertId,
                username,
                email,
                role: userRole,
                status: status || 'active'
            });
        } catch (err) {
            console.error('Error creating user:', err);
            res.status(500).json({ message: 'Server error', details: err.message });
        }
    });

    // PUT /api/admin/users/:id - Update existing user
    router.put('/users/:id', async (req, res) => {
        try {
            const userId = req.params.id;
            const { username, email, password, role, status } = req.body;
            
            // Check if user exists
            const [existingUsers] = await dbConnection.execute(
                'SELECT * FROM User WHERE UserID = ?',
                [userId]
            );
            
            if (existingUsers.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }
            
            // Check if Active column exists
            const [activeColumn] = await dbConnection.execute(
                "SHOW COLUMNS FROM User LIKE 'Active'"
            );
            
            let active = 1;
            if (activeColumn.length > 0 && status) {
                active = status === 'active' ? 1 : 0;
            }
            
            // Check if PasswordHash column exists
            const [passwordHashColumn] = await dbConnection.execute(
                "SHOW COLUMNS FROM User LIKE 'PasswordHash'"
            );
            
            if (passwordHashColumn.length > 0 && password) {
                // If password is provided, hash it and update
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(password, salt);
                
                if (activeColumn.length > 0) {
                    await dbConnection.execute(
                        'UPDATE User SET Username = ?, Email = ?, PasswordHash = ?, Role = ?, Active = ? WHERE UserID = ?',
                        [username, email, hashedPassword, role, active, userId]
                    );
                } else {
                    await dbConnection.execute(
                        'UPDATE User SET Username = ?, Email = ?, PasswordHash = ?, Role = ? WHERE UserID = ?',
                        [username, email, hashedPassword, role, userId]
                    );
                }
            } else {
                // Update without password
                if (activeColumn.length > 0) {
                    await dbConnection.execute(
                        'UPDATE User SET Username = ?, Email = ?, Role = ?, Active = ? WHERE UserID = ?',
                        [username, email, role, active, userId]
                    );
                } else {
                    await dbConnection.execute(
                        'UPDATE User SET Username = ?, Email = ?, Role = ? WHERE UserID = ?',
                        [username, email, role, userId]
                    );
                }
            }
            
            res.json({
                message: 'User updated successfully',
                id: userId,
                username,
                email,
                role,
                status: active === 1 ? 'active' : 'inactive'
            });
        } catch (err) {
            console.error('Error updating user:', err);
            res.status(500).json({ message: 'Server error', details: err.message });
        }
    });

    // DELETE /api/admin/users/:id - Delete user
    router.delete('/users/:id', async (req, res) => {
        try {
            const userId = req.params.id;
            
            // Check if user exists
            const [existingUsers] = await dbConnection.execute(
                'SELECT Role FROM User WHERE UserID = ?',
                [userId]
            );
            
            if (existingUsers.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }
            
            // Check if trying to delete the last admin
            if (existingUsers[0].Role === 'Admin') {
                const [adminCount] = await dbConnection.execute(
                    "SELECT COUNT(*) as count FROM User WHERE Role = 'Admin'"
                );
                
                if (adminCount[0].count <= 1) {
                    return res.status(400).json({ message: 'Cannot delete the last admin user' });
                }
            }
            
            // Delete the user
            await dbConnection.execute('DELETE FROM User WHERE UserID = ?', [userId]);
            
            res.json({ message: 'User deleted successfully' });
        } catch (err) {
            console.error('Error deleting user:', err);
            res.status(500).json({ message: 'Server error', details: err.message });
        }
    });

    // GET /api/admin/analytics/activity - Get activity analytics data
    router.get('/analytics/activity', async (req, res) => {
        try {
            console.log("Activity analytics API endpoint accessed");
            
            // Default to 30 days if not specified
            const days = parseInt(req.query.days) || 30;
            
            console.log(`Fetching activity analytics for the past ${days} days`);
            
            // Create date for X days ago
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            startDate.setHours(0, 0, 0, 0);
            
            // Format date for MySQL query
            const formattedDate = startDate.toISOString().slice(0, 19).replace('T', ' ');
            
            console.log(`Start date for query: ${formattedDate}`);
            
            // First check if UserActivity table exists to avoid errors
            let tableExists = false;
            try {
                const [tables] = await dbConnection.execute("SHOW TABLES LIKE 'UserActivity'");
                tableExists = tables.length > 0;
            } catch (err) {
                console.error("Error checking for UserActivity table:", err.message);
            }
            
            if (!tableExists) {
                return res.json({
                    labels: [],
                    counts: [],
                    totalActivities: 0,
                    highRiskCount: 0,
                    mediumRiskCount: 0,
                    lowRiskCount: 0,
                    message: "UserActivity table does not exist"
                });
            }
            
            // Get daily activity counts
            const dailyActivityQuery = `
                SELECT 
                    DATE(Timestamp) as date,
                    COUNT(*) as count
                FROM UserActivity
                WHERE Timestamp >= ?
                GROUP BY DATE(Timestamp)
                ORDER BY date ASC
            `;
            
            console.log("Running daily activity query");
            const [dailyActivity] = await dbConnection.execute(dailyActivityQuery, [formattedDate]);
            
            // Get risk category counts
            const riskCountsQuery = `
                SELECT 
                    CASE 
                        WHEN Risk >= 70 THEN 'high'
                        WHEN Risk >= 40 THEN 'medium'
                        ELSE 'low'
                    END as riskCategory,
                    COUNT(*) as count
                FROM UserActivity
                WHERE Timestamp >= ?
                GROUP BY riskCategory
            `;
            
            console.log("Running risk counts query");
            const [riskCounts] = await dbConnection.execute(riskCountsQuery, [formattedDate]);
            
            // Format data for chart
            const labels = [];
            const counts = [];
            
            // Create a map of date -> count for faster lookup
            const activityMap = {};
            dailyActivity.forEach(day => {
                // Format date as MM/DD
                const date = new Date(day.date);
                const formattedDate = `${date.getMonth() + 1}/${date.getDate()}`;
                
                activityMap[formattedDate] = parseInt(day.count);
            });
            
            // Fill in all days in range (including days with no activity)
            for (let i = 0; i < days; i++) {
                const date = new Date();
                date.setDate(date.getDate() - days + i + 1);
                const formattedDate = `${date.getMonth() + 1}/${date.getDate()}`;
                
                labels.push(formattedDate);
                counts.push(activityMap[formattedDate] || 0);
            }
            
            // Get risk category totals
            let highRiskCount = 0;
            let mediumRiskCount = 0;
            let lowRiskCount = 0;
            
            riskCounts.forEach(category => {
                if (category.riskCategory === 'high') highRiskCount = parseInt(category.count);
                else if (category.riskCategory === 'medium') mediumRiskCount = parseInt(category.count);
                else if (category.riskCategory === 'low') lowRiskCount = parseInt(category.count);
            });
            
            const totalActivities = highRiskCount + mediumRiskCount + lowRiskCount;
            
            console.log(`Analytics data prepared: ${labels.length} days, ${totalActivities} activities`);
            
            res.json({
                labels,
                counts,
                totalActivities,
                highRiskCount,
                mediumRiskCount,
                lowRiskCount
            });
        } catch (error) {
            console.error('Error fetching activity analytics:', error);
            res.status(500).json({ 
                message: 'Error fetching activity analytics', 
                error: error.message,
                // Send empty data structure for client fallback
                labels: [],
                counts: [],
                totalActivities: 0,
                highRiskCount: 0,
                mediumRiskCount: 0,
                lowRiskCount: 0
            });
        }
    });
    
    // Log all registered routes for debugging
    console.log('Admin router routes:');
    router.stack.forEach((r) => {
        if (r.route && r.route.path) {
            const methods = Object.keys(r.route.methods).map(m => m.toUpperCase()).join(',');
            console.log(`${methods} /api/admin${r.route.path}`);
        }
    });

    return router;
};
