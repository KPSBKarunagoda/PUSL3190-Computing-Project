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
    
    // Remove from whitelist
    router.delete('/whitelist/:domain', async (req, res) => {
        try {
            const domain = req.params.domain;
            await listService.removeFromWhitelist(domain);
            res.json({ message: 'Domain removed from whitelist', domain });
        } catch (error) {
            console.error('Remove from whitelist error:', error);
            
            if (error.message.includes('not found')) {
                return res.status(404).json({ message: error.message });
            }
            
            res.status(500).json({ message: 'Server error' });
        }
    });
    
    // Get blacklist
    router.get('/blacklist', async (req, res) => {
        try {
            const blacklist = await listService.getBlacklist();
            res.json(blacklist);
        } catch (error) {
            console.error('Get blacklist error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });
    
    // Add to blacklist
    router.post('/blacklist', async (req, res) => {
        try {
            const { domain } = req.body;
            
            if (!domain) {
                return res.status(400).json({ message: 'Domain is required' });
            }
            
            const result = await listService.addToBlacklist(domain, req.user.id);
            res.json({ message: 'Domain added to blacklist', domain });
        } catch (error) {
            console.error('Add to blacklist error:', error);
            
            if (error.message.includes('already exists')) {
                return res.status(400).json({ message: error.message });
            }
            
            res.status(500).json({ message: 'Server error' });
        }
    });
    
    // Remove from blacklist
    router.delete('/blacklist/:domain', async (req, res) => {
        try {
            const domain = req.params.domain;
            await listService.removeFromBlacklist(domain);
            res.json({ message: 'Domain removed from blacklist', domain });
        } catch (error) {
            console.error('Remove from blacklist error:', error);
            
            if (error.message.includes('not found')) {
                return res.status(404).json({ message: error.message });
            }
            
            res.status(500).json({ message: 'Server error' });
        }
    });
    
    return router;
};