const express = require('express');
const router = express.Router();
const axios = require('axios');
const authMiddleware = require('../middleware/auth');

/**
 * Password checking router
 * This provides a secure proxy to the HaveIBeenPwned API 
 * to check for compromised passwords using k-anonymity pattern
 */
module.exports = function(dbConnection) {
    const auth = authMiddleware(dbConnection);
    
    // Apply auth middleware to secure the endpoint
    router.use(auth);

    // POST /api/check-password - Check if a password has been compromised
    router.post('/', async (req, res) => {
        try {
            const { hashPrefix } = req.body;
            console.log('----------------------------------');
            console.log('Password check request received:');
            console.log('Hash prefix:', hashPrefix);
            console.log('Authenticated user:', req.user.id);
            
            if (!hashPrefix || typeof hashPrefix !== 'string' || hashPrefix.length !== 5) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid hash prefix provided. Must be exactly 5 characters.' 
                });
            }
            
            // Log the request (never log actual password data)
            console.log(`Password check request for hash prefix: ${hashPrefix}`);
            
            // Call the HaveIBeenPwned API with the hash prefix
            try {
                const hibpResponse = await axios({
                    method: 'get',
                    url: `https://api.pwnedpasswords.com/range/${hashPrefix}`,
                    headers: {
                        'User-Agent': 'PhishGuard-PasswordHealthCheck',
                        'Add-Padding': 'true' // For additional k-anonymity
                    },
                    timeout: 10000 // 10 seconds timeout
                });
                
                if (hibpResponse.status !== 200) {
                    throw new Error(`API returned status code ${hibpResponse.status}`);
                }
                
                // Process the response data - split by newline and extract hash suffixes
                const responseData = hibpResponse.data;
                const results = responseData
                    .split('\r\n')
                    .map(line => {
                        const [hashSuffix] = line.split(':');
                        return hashSuffix;
                    });
                
                console.log(`Got response with ${results.length} hash suffixes`);
                console.log('----------------------------------');
                
                // Return the list of hash suffixes to the client for local comparison
                res.json({
                    success: true,
                    results,
                    count: results.length
                });
            } catch (apiError) {
                console.error('HaveIBeenPwned API error:', apiError.message);
                
                // Provide a meaningful error response
                res.status(500).json({
                    success: false,
                    message: 'Error checking password security status',
                    error: apiError.message
                });
            }
        } catch (error) {
            console.error('Password check error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error processing password check',
                error: error.message
            });
        }
    });

    return router;
};
