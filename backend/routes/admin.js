const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/admin-auth');

// This is a factory function that takes a database connection and returns a router
module.exports = function(dbConnection) {
    // Apply admin auth middleware to all routes in this router
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

    // Add any other admin-specific endpoints here

    return router;
};
