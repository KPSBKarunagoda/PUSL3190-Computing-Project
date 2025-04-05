const jwt = require('jsonwebtoken');

module.exports = function(dbConnection) {
    return async function(req, res, next) {
        try {
            // Get token from header
            const token = req.header('x-auth-token');
            
            if (!token) {
                return res.status(401).json({ message: 'No token, authorization denied' });
            }
            
            console.log('Processing auth token');
            
            // Use the same secret as in the AuthService
            const jwtSecret = 'phishguard_secure_jwt_secret_key';
            
            // Verify token
            const decoded = jwt.verify(token, jwtSecret);
            console.log('Token verified, payload:', JSON.stringify(decoded));
            
            // Extract user ID from decoded token
            const userId = decoded.user.id;
            
            if (!userId) {
                console.error('Missing user ID in token');
                return res.status(401).json({ message: 'Invalid token structure' });
            }
            
            // Get user from database to confirm they exist
            const [users] = await dbConnection.execute(
                'SELECT UserID, Username, Email, Role FROM User WHERE UserID = ?',
                [userId]
            );
            
            if (users.length === 0) {
                console.error(`User with ID ${userId} not found in database`);
                return res.status(401).json({ message: 'Invalid token - user not found' });
            }
            
            console.log(`User authorized: ${users[0].Username} (${users[0].Role})`);
            
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