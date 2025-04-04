const express = require('express');
const router = express.Router();
let bcrypt;

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

    return router;
};
