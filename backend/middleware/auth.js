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
            
            // Check if admin role
            if (req.user.role !== 'Admin') {
                return res.status(403).json({ message: 'Access denied: Admin privileges required' });
            }
            
            next();
        } catch (err) {
            res.status(401).json({ message: 'Token is not valid' });
        }
    };
};