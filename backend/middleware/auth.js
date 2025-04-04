const jwt = require('jsonwebtoken');

module.exports = function(dbConnection) {
    return async function(req, res, next) {
        // Get token from header
        const token = req.header('x-auth-token');
        
        if (!token) {
            return res.status(401).json({ message: 'No token, authorization denied' });
        }
        
        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'phishguard_jwt_secret');
            
            // Get user from database to confirm they exist
            const [users] = await dbConnection.execute(
                'SELECT UserID, Username, Email, Role FROM User WHERE UserID = ?',
                [decoded.user.id]
            );
            
            if (users.length === 0) {
                return res.status(401).json({ message: 'Invalid token - user not found' });
            }
            
            // Set user data in request object
            req.user = {
                id: users[0].UserID,
                username: users[0].Username,
                email: users[0].Email,
                role: users[0].Role
            };
            
            next();
        } catch (err) {
            console.error('Auth middleware error:', err);
            res.status(401).json({ message: 'Token is not valid' });
        }
    };
};