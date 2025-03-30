const AuthService = require('../services/auth');

module.exports = function(dbConnection) {
    const authService = new AuthService(dbConnection);
    
    return function(req, res, next) {
        // Get token from header
        const token = req.header('x-auth-token');
        
        // Check if no token
        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        
        try {
            // Verify token
            const decoded = authService.verifyToken(token);
            req.user = decoded.user;
            
            // Allow both Admin and User roles
            if (!['Admin', 'User'].includes(req.user.role)) {
                return res.status(403).json({ message: 'Invalid user role' });
            }
            
            next();
        } catch (err) {
            res.status(401).json({ message: 'Authentication failed' });
        }
    };
};
