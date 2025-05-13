const express = require('express');
const router = express.Router();
const ListService = require('../services/list-service');

module.exports = function(dbConnection) {
    const listService = new ListService(dbConnection);
    const authMiddleware = require('../middleware/auth')(dbConnection);
    
    // Apply auth middleware to all routes
    router.use(authMiddleware);
    
    // Get whitelist
    router.get('/whitelist', async (req, res) => {
        try {
            const whitelist = await listService.getWhitelist();
            console.log('Sending whitelist data:', whitelist);
            res.json(whitelist);
        } catch (error) {
            console.error('Get whitelist error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });
    
    // Add to whitelist
    router.post('/whitelist', async (req, res) => {
        try {
            const { domain } = req.body;
            
            if (!domain) {
                return res.status(400).json({ message: 'Domain is required' });
            }
            
            const result = await listService.addToWhitelist(domain, req.user.id);
            res.json({ message: 'Domain added to whitelist', domain });
        } catch (error) {
            console.error('Add to whitelist error:', error);
            
            if (error.message.includes('already exists')) {
                return res.status(400).json({ message: error.message });
            }
            
            res.status(500).json({ message: 'Server error' });
        }
    });
    
    // Remove from whitelist - make sure this works correctly
    router.delete('/whitelist/:domain', async (req, res) => {
        try {
            const domain = req.params.domain;
            console.log(`Delete request for whitelist domain: ${domain}`);
            
            await listService.removeFromWhitelist(domain);
            res.json({ 
                message: 'Domain removed from whitelist', 
                domain 
            });
        } catch (error) {
            console.error('Remove from whitelist error:', error);
            
            if (error.message.includes('not found')) {
                return res.status(404).json({ message: error.message });
            }
            
            res.status(500).json({ message: 'Server error' });
        }
    });
    
    // Get blacklist
    router.get('/blacklist', authMiddleware, async (req, res) => {
        try {
            // Query with is_system field
            const [rows] = await dbConnection.execute(`
                SELECT b.*, u.Username 
                FROM Blacklist b
                LEFT JOIN User u ON b.AddedBy = u.UserID
                ORDER BY b.AddedDate DESC
            `);
            
            // Get usage statistics
            const [stats] = await dbConnection.execute(`
                SELECT COUNT(*) AS total,
                    SUM(CASE WHEN AddedDate >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) AS recent,
                    SUM(CASE WHEN is_system = 1 THEN 1 ELSE 0 END) AS system_added,
                    SUM(CASE WHEN is_system = 0 THEN 1 ELSE 0 END) AS manually_added
                FROM Blacklist
            `);
            
            return res.json({
                success: true,
                entries: rows,
                stats: stats[0] || { total: 0, recent: 0, system_added: 0, manually_added: 0 }
            });
        } catch (error) {
            console.error('Error fetching blacklist:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch blacklist'
            });
        }
    });
    
    // Add to blacklist
    router.post('/blacklist', authMiddleware, async (req, res) => {
        try {
            const { url, riskLevel, is_system } = req.body;
            
            if (!url) {
                return res.status(400).json({ success: false, message: 'URL is required' });
            }
            
            // Get the user ID from the authenticated request
            const userId = req.user.id;
            
            // Set default risk level if not provided
            const risk = riskLevel || 100;
            
            // Set is_system flag with default of false (manually added)
            const systemFlag = is_system ? 1 : 0;
            
            // Check if URL already exists in blacklist
            const [existingUrl] = await dbConnection.execute(
                'SELECT * FROM Blacklist WHERE URL = ?',
                [url]
            );
            
            if (existingUrl.length > 0) {
                return res.status(400).json({ success: false, message: 'URL is already blacklisted' });
            }
            
            // Add to blacklist with is_system flag
            const [result] = await dbConnection.execute(
                'INSERT INTO Blacklist (URL, RiskLevel, AddedDate, AddedBy, is_system) VALUES (?, ?, NOW(), ?, ?)',
                [url, risk, userId, systemFlag]
            );
            
            res.json({ 
                message: 'Added to blacklist successfully', 
                url,
                riskLevel: risk,
                is_system: systemFlag
            });
        } catch (error) {
            console.error('Add to blacklist error:', error);
            
            if (error.message.includes('already exists')) {
                return res.status(400).json({ message: error.message });
            }
            
            res.status(500).json({ message: 'Server error' });
        }
    });
    
    // Remove from blacklist
    router.delete('/blacklist/:url', async (req, res) => {
        try {
            // Get URL parameter and decode it
            const url = decodeURIComponent(req.params.url);
            
            if (!url) {
                return res.status(400).json({ message: 'URL parameter is required' });
            }
            
            console.log(`Delete request for blacklist URL: ${url}`);
            
            // Call service to remove URL
            await listService.removeFromBlacklist(url);
            
            res.json({ 
                message: 'URL removed from blacklist', 
                url 
            });
        } catch (error) {
            console.error('Remove from blacklist error:', error);
            
            if (error.message.includes('not found')) {
                return res.status(404).json({ message: error.message });
            }
            
            res.status(500).json({ message: 'Server error' });
        }
    });

    // Get blacklist statistics
    router.get('/blacklist/stats', async (req, res) => {
        try {
            const timeframe = req.query.timeframe || 'week';
            const stats = await listService.getBlacklistStats(timeframe);
            res.json(stats);
        } catch (error) {
            console.error('Get blacklist stats error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });
    
    return router;
};