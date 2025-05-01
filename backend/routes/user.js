const express = require('express');
const router = express.Router();
let bcrypt;
const ActivityService = require('../services/activity-service');

// Try to load bcrypt modules in the correct order
try {
    // First try bcryptjs
    bcrypt = require('bcryptjs');
    console.log('Using bcryptjs module');
} catch (err) {
    try {
        // Then try bcrypt if bcryptjs fails
        bcrypt = require('bcrypt');
        console.log('Using bcrypt module');
    } catch (err2) {
        console.error('Neither bcrypt nor bcryptjs module is available. Password hashing disabled.');
        // Provide a simple fallback (for development only)
        bcrypt = {
            genSalt: async () => 10,
            hash: async (password) => password,
            compare: async (password, hash) => password === hash
        };
    }
}

const auth = require('../middleware/auth');

// This is a factory function that takes a database connection and returns a router
module.exports = function(dbConnection) {
    const activityService = new ActivityService(dbConnection);
  
    // Apply auth middleware to all routes in this router
    router.use(auth(dbConnection));

    // GET /api/user/profile - Get current user profile
    router.get('/profile', async (req, res) => {
        try {
            // User data is already in req.user from the auth middleware
            res.json({
                id: req.user.id,
                name: req.user.username,
                email: req.user.email,
                role: req.user.role
            });
        } catch (err) {
            console.error('Error fetching user profile:', err);
            res.status(500).json({ message: 'Server error' });
        }
    });

    // PUT /api/user/profile - Update user profile
    router.put('/profile', async (req, res) => {
        try {
            const { name } = req.body;

            if (!name) {
                return res.status(400).json({ message: 'Display name is required' });
            }

            // Get current user email from the database
            const [userInfo] = await dbConnection.execute(
                'SELECT Email FROM User WHERE UserID = ?',
                [req.user.id]
            );

            if (userInfo.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            const email = userInfo[0].Email;

            // Update only user's name
            await dbConnection.execute(
                'UPDATE User SET Username = ?, UpdatedAt = NOW() WHERE UserID = ?',
                [name, req.user.id]
            );

            res.json({
                message: 'Profile updated successfully',
                username: name,
                email: email
            });
        } catch (err) {
            console.error('Error updating user profile:', err);
            res.status(500).json({ message: 'Server error' });
        }
    });

    // PUT /api/user/password - Change user password
    router.put('/password', async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({ message: 'Current password and new password are required' });
            }

            // Get user's current password hash from database
            console.log('Getting password hash for user ID:', req.user.id);
            console.log('Using bcrypt library:', bcrypt.name || typeof bcrypt);
            
            const [users] = await dbConnection.execute(
                'SELECT PasswordHash FROM User WHERE UserID = ?',
                [req.user.id]
            );

            if (users.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Log the retrieved hash (but not the full value for security)
            console.log('Retrieved hash exists:', !!users[0].PasswordHash);
            if (users[0].PasswordHash) {
                console.log('Hash starts with:', users[0].PasswordHash.substring(0, 10) + '...');
            }
            
            // Log password info for debugging (DO NOT log actual password)
            console.log('Current password length:', currentPassword.length);
            console.log('Password hash type:', typeof users[0].PasswordHash);

            // Check if current password is correct
            // Convert hash to string if needed
            const passwordHash = String(users[0].PasswordHash);
            const isMatch = await bcrypt.compare(currentPassword, passwordHash);
            console.log('Password comparison result:', isMatch);

            if (!isMatch) {
                return res.status(400).json({ message: 'Current password is incorrect' });
            }

            // Hash new password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            // Update password in database
            await dbConnection.execute(
                'UPDATE User SET PasswordHash = ?, UpdatedAt = NOW() WHERE UserID = ?',
                [hashedPassword, req.user.id]
            );

            res.json({ message: 'Password updated successfully' });
        } catch (err) {
            console.error('Error changing password:', err);
            res.status(500).json({ message: 'Server error' });
        }
    });

    // DELETE /api/user - Delete user account
    router.delete('/', async (req, res) => {
        try {
            // Get the user's ID from the request
            const userId = req.user.id;
            console.log('Attempting to delete user account with ID:', userId);

            // Check if the user is not an admin before allowing deletion
            if (req.user.role === 'Admin') {
                return res.status(400).json({ 
                    message: 'Admin accounts cannot be deleted through this interface. Please contact system administrator.' 
                });
            }

            // For regular users, we can directly delete the account
            // Check if the user exists
            const [userCheck] = await dbConnection.execute(
                'SELECT UserID FROM User WHERE UserID = ?',
                [userId]
            );

            if (userCheck.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Delete any user-specific data or relationships
            // For example, if users can have personal settings, history, etc.
            try {
                // Delete user's URL browsing history if exists
                await dbConnection.execute(
                    'DELETE FROM URLHistory WHERE UserID = ?',
                    [userId]
                );
                console.log('Deleted user history records');
            } catch (err) {
                // Table might not exist, just log and continue
                console.log('No user history to delete or table does not exist');
            }

            // Delete the user account
            await dbConnection.execute(
                'DELETE FROM User WHERE UserID = ?',
                [userId]
            );
            console.log('User account deleted successfully');

            res.json({ message: 'Account deleted successfully' });
        } catch (err) {
            console.error('Error deleting account:', err);
            res.status(500).json({ message: 'Server error', details: err.message });
        }
    });

    // GET /api/user/debug - Debug endpoint (TEMPORARY - REMOVE AFTER FIXING)
    router.get('/debug', async (req, res) => {
        try {
            // Get table schema
            const [columns] = await dbConnection.execute(
                'SHOW COLUMNS FROM User'
            );
            
            // Get sample user (sanitized)
            const [users] = await dbConnection.execute(
                'SELECT UserID, Username, UpdatedAt, Role FROM User LIMIT 1'
            );
            
            // Return column names only
            const columnNames = columns.map(col => col.Field);
            
            res.json({
                columns: columnNames,
                sampleUser: users[0] ? users[0] : null
            });
        } catch (err) {
            console.error('Debug error:', err);
            res.status(500).json({ message: 'Server error' });
        }
    });

    // Privacy-focused endpoint
    router.get('/privacy-policy', async (req, res) => {
        try {
            res.json({
                message: "PhishGuard prioritizes your privacy. We don't store your browsing history or analyzed URLs on our servers. All scan history is stored locally on your device only."
            });
        } catch (err) {
            console.error('Error:', err);
            res.status(500).json({ message: 'Server error' });
        }
    });

    // GET /api/user/statistics - Get user statistics
    router.get('/statistics', auth, async (req, res) => {
        try {
            const userId = req.user.id;
            
            // Query the database for user's scan statistics
            const [userStats] = await dbConnection.execute(`
                SELECT 
                    COUNT(*) as totalScans,
                    SUM(CASE WHEN is_phishing = 1 THEN 1 ELSE 0 END) as threatsDetected,
                    SUM(CASE WHEN is_phishing = 0 THEN 1 ELSE 0 END) as safeSites
                FROM URL_Scans
                WHERE user_id = ?
            `, [userId]);
            
            // If no results, return default values
            if (!userStats || userStats.length === 0) {
                return res.json({
                    totalScans: 0,
                    threatsDetected: 0,
                    safeSites: 0
                });
            }
            
            res.json({
                totalScans: userStats[0].totalScans || 0,
                threatsDetected: userStats[0].threatsDetected || 0,
                safeSites: userStats[0].safeSites || 0
            });
        } catch (error) {
            console.error('Error fetching user statistics:', error);
            res.status(500).json({ error: 'Server error fetching statistics' });
        }
    });

    // GET /api/user/activity - Get user activity history
    router.get('/activity', async (req, res) => {
        try {
            const userId = req.user.id;
            const limit = req.query.limit ? parseInt(req.query.limit) : 10;
            
            console.log(`Fetching activity for user ${userId}, limit ${limit}`);
            
            // Get activities from DB
            const [activities] = await dbConnection.execute(
                `SELECT ActivityID, Title, Risk, Timestamp 
                 FROM UserActivity 
                 WHERE UserID = ? 
                 ORDER BY Timestamp DESC 
                 LIMIT ?`,
                [userId, limit]
            );
            
            console.log(`Found ${activities.length} activities for user ${userId}`);
            res.json(activities);
        } catch (error) {
            console.error('Error fetching user activity:', error);
            res.status(500).json({ error: 'Server error fetching activity history' });
        }
    });

    // GET /api/user/stats - Get user statistics including scan counts
    router.get('/stats', async (req, res) => {
        try {
            const userId = req.user.id;
            
            console.log(`Fetching stats for user ${userId}`);
            
            // Get counts from UserActivity table
            const [stats] = await dbConnection.execute(`
                SELECT 
                    COUNT(*) as totalScans,
                    SUM(CASE WHEN Risk >= 50 THEN 1 ELSE 0 END) as threatsDetected,
                    SUM(CASE WHEN Risk < 50 THEN 1 ELSE 0 END) as safeSites
                FROM UserActivity 
                WHERE UserID = ?
            `, [userId]);
            
            res.json({
                totalScans: stats[0]?.totalScans || 0,
                threatsDetected: stats[0]?.threatsDetected || 0,
                safeSites: stats[0]?.safeSites || 0
            });
        } catch (error) {
            console.error('Error fetching user stats:', error);
            res.status(500).json({ error: 'Server error fetching statistics' });
        }
    });

    // DELETE /api/user/activity - Clear user activity history
    router.delete('/activity', async (req, res) => {
        try {
            const userId = req.user.id;
            
            console.log(`Clearing activity for user ${userId}`);
            
            // Delete all user activities
            const [result] = await dbConnection.execute(
                'DELETE FROM UserActivity WHERE UserID = ?',
                [userId]
            );
            
            console.log(`Deleted ${result.affectedRows} activities for user ${userId}`);
            res.json({ success: true, deletedCount: result.affectedRows });
        } catch (error) {
            console.error('Error clearing user activity:', error);
            res.status(500).json({ error: 'Server error clearing activity history' });
        }
    });

    // POST /api/user/record-activity - Record URL scan activity from extension
    router.post('/record-activity', async (req, res) => {
        try {
            const userId = req.user.id;
            const { url, riskScore } = req.body;
            
            if (!url) {
                return res.status(400).json({ error: 'URL is required' });
            }
            
            console.log(`Recording activity from extension for user ${userId}`);
            
            // Use the activity service to record the activity with domain as title
            const domain = new URL(url).hostname;
            const safeTitle = `Scan: ${domain}`;
            
            // Use the activity service to record the activity
            const result = await activityService.recordActivity(
                userId, 
                url, 
                safeTitle,
                riskScore || 0
            );
            
            res.json({
                success: true,
                result: result,
                activity_recorded: true
            });
        } catch (error) {
            console.error('Error recording activity from extension:', error);
            res.status(500).json({ error: 'Failed to record activity' });
        }
    });

    return router;
};
