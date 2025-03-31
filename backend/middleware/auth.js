const AuthService = require('../services/auth');

module.exports = function(dbConnection) {
    const authService = new AuthService(dbConnection);
    
    return function(req, res, next) {
        // Get token from header
        const token = req.header('x-auth-token');
        
        // Check if no token
        if (!token) {
            return res.status(401).json({ message: 'No token, authorization denied' });
        }
        
        try {
            // Verify token
            const decoded = authService.verifyToken(token);
            req.user = decoded.user;
            
            // Admin route check - Only runs for admin-specific routes
            if (req.baseUrl.includes('/admin') || req.path.includes('/admin')) {
                console.log('Admin route accessed, checking role:', req.user.role);
                if (req.user.role !== 'Admin') {
                    console.log('Admin access denied for user role:', req.user.role);
                    return res.status(403).json({ message: 'Access denied: Admin privileges required' });
                }
            }
            
            next();
        } catch (err) {
            console.error('Auth middleware error:', err);
            res.status(401).json({ message: 'Authentication failed' });
        }
    };
};