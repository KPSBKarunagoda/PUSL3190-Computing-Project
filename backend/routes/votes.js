const express = require('express');
const router = express.Router();
const ReportingService = require('../services/reporting-service');
const authMiddleware = require('../middleware/auth');
const adminAuthMiddleware = require('../middleware/admin-auth');

module.exports = function(dbConnection) {
    const reportingService = new ReportingService(dbConnection);
    const auth = authMiddleware(dbConnection);
    const adminAuth = adminAuthMiddleware(dbConnection);
    
    // Public test endpoint
    router.get('/test', (req, res) => {
        res.json({ message: 'Votes API is working' });
    });

    // User endpoints - require regular auth
    
    // POST /api/votes - Submit a vote
    router.post('/', auth, async (req, res) => {
        try {
            const { url, voteType } = req.body;
            
            if (!url) {
                return res.status(400).json({ message: 'URL is required' });
            }
            
            if (!voteType || !['Safe', 'Phishing'].includes(voteType)) {
                return res.status(400).json({ message: 'Valid vote type (Safe or Phishing) is required' });
            }
            
            // Check if user already voted for this URL
            const [existingVotes] = await dbConnection.execute(
                'SELECT * FROM Votes WHERE UserID = ? AND URL = ?',
                [req.user.id, url]
            );
            
            if (existingVotes.length > 0) {
                // Update existing vote
                await dbConnection.execute(
                    'UPDATE Votes SET VoteType = ?, Timestamp = NOW() WHERE UserID = ? AND URL = ?',
                    [voteType, req.user.id, url]
                );
                return res.json({ message: 'Vote updated successfully' });
            }
            
            // Create new vote
            const voteId = await reportingService.createVote(req.user.id, url, voteType);
            
            res.status(201).json({ 
                message: 'Vote submitted successfully', 
                voteId 
            });
        } catch (error) {
            console.error('Error submitting vote:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });

    // GET /api/votes/user - Get votes by current user
    router.get('/user', auth, async (req, res) => {
        try {
            // Query votes for current user ID
            const [rows] = await dbConnection.execute(
                'SELECT * FROM Votes WHERE UserID = ? ORDER BY Timestamp DESC',
                [req.user.id]
            );
            
            res.json(rows);
        } catch (error) {
            console.error('Error fetching user votes:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });

    // Admin endpoints - require admin auth
    
    // GET /api/votes - Get all vote summaries (admin only)
    router.get('/', adminAuth, async (req, res) => {
        try {
            const votes = await reportingService.getVotes();
            res.json(votes);
        } catch (error) {
            console.error('Error fetching votes:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });

    // GET /api/votes/stats - Get vote stats (admin only)
    router.get('/stats', adminAuth, async (req, res) => {
        try {
            const stats = await reportingService.getVoteStats();
            res.json(stats);
        } catch (error) {
            console.error('Error fetching vote stats:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });

    // GET /api/votes/url - Get votes for specific URL (admin only)
    router.get('/url', adminAuth, async (req, res) => {
        try {
            const { url } = req.query;
            
            if (!url) {
                return res.status(400).json({ message: 'URL parameter is required' });
            }
            
            const voteData = await reportingService.getVotesByUrl(url);
            res.json(voteData);
        } catch (error) {
            console.error('Error fetching URL votes:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });

    return router;
};
