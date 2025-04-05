const jwt = require('jsonwebtoken');

module.exports = function(dbConnection) {
    return async function(req, res, next) {
        // Get token from header
        const token = req.header('x-auth-token');
        console.log('Admin auth middleware called for:', req.path);
        
        if (!token) {
            console.log('No token provided for:', req.path);
            return res.status(401).json({ message: 'No token, authorization denied' });
        }
        
        try {
            // Use the same secret as in the AuthService
            const jwtSecret = 'phishguard_secure_jwt_secret_key';
            
            // Verify token
            const decoded = jwt.verify(token, jwtSecret);
            console.log('Token verified for path:', req.path, 'user:', decoded.user.id);
            
            // Get user from database to confirm they exist
            const [users] = await dbConnection.execute(
                'SELECT UserID, Username, Email, Role FROM User WHERE UserID = ?',
                [decoded.user.id]
            );
            
            if (users.length === 0) {
                console.log('User not found for ID:', decoded.user.id);
                return res.status(401).json({ message: 'Invalid token - user not found' });
            }
            
            // STRICT CHECK: Verify admin role - reject if not admin
            if (users[0].Role !== 'Admin') {
                console.log('Non-admin tried to access admin route:', users[0].Role);
                return res.status(403).json({ message: 'Access denied - Admin privileges required' });
            }
            
            console.log('Admin authenticated successfully for:', req.path);
            
            // Set user data in request object
            req.user = {
                id: users[0].UserID,
                username: users[0].Username,
                email: users[0].Email,
                role: users[0].Role
            };
            
            next();
        } catch (err) {
            console.error('Admin auth middleware error for path:', req.path, err);
            res.status(401).json({ message: 'Token is not valid' });
        }
    };
};
