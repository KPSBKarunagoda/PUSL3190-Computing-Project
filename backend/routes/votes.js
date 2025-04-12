const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const adminAuthMiddleware = require('../middleware/admin-auth');
const jwt = require('jsonwebtoken');

module.exports = function(dbConnection) {
    const auth = authMiddleware(dbConnection);
    const adminAuth = adminAuthMiddleware(dbConnection);
    
    // Public test endpoint
    router.get('/test', (req, res) => {
        res.json({ message: 'Votes API is working' });
    });

    // POST /api/votes - Submit a vote
    router.post('/', auth, async (req, res) => {
        try {
            const { url, voteType, predictionShown, predictionScore } = req.body;
            const userId = req.user.id;
            
            if (!url || !voteType) {
                return res.status(400).json({ message: 'URL and vote type are required' });
            }
            
            // Validate vote type
            if (!['Positive', 'Negative'].includes(voteType)) {
                return res.status(400).json({ message: 'Vote type must be "Positive" or "Negative"' });
            }
            
            try {
                // First check if the table exists
                const [tables] = await dbConnection.query(`
                    SHOW TABLES LIKE 'Votes'
                `);
                
                // Create table if it doesn't exist - remove FeedbackType column
                if (tables.length === 0) {
                    await dbConnection.query(`
                        CREATE TABLE Votes (
                            VoteID INT PRIMARY KEY AUTO_INCREMENT,
                            UserID INT NOT NULL,
                            URL VARCHAR(255) NOT NULL,
                            VoteType ENUM('Positive', 'Negative') NOT NULL,
                            PredictionShown VARCHAR(50) NULL,
                            PredictionScore FLOAT NULL,
                            Timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (UserID) REFERENCES User(UserID),
                            UNIQUE KEY unique_user_url (UserID, URL)
                        )
                    `);
                    console.log('Votes table created successfully with prediction columns');
                } else {
                    // Check if we need to modify the existing table
                    try {
                        // Check if FeedbackType column exists and remove it if present
                        const [feedbackColumn] = await dbConnection.query(`
                            SHOW COLUMNS FROM Votes LIKE 'FeedbackType'
                        `);
                        
                        if (feedbackColumn.length > 0) {
                            // Drop the FeedbackType column if it exists
                            await dbConnection.query(`
                                ALTER TABLE Votes 
                                DROP COLUMN FeedbackType
                            `);
                            console.log('Removed FeedbackType column from Votes table');
                        }
                        
                        // Check if PredictionShown column exists
                        const [columnsPrediction] = await dbConnection.query(`
                            SHOW COLUMNS FROM Votes LIKE 'PredictionShown'
                        `);
                        
                        if (columnsPrediction.length === 0) {
                            // Add the new columns
                            await dbConnection.query(`
                                ALTER TABLE Votes 
                                ADD COLUMN PredictionShown VARCHAR(50) NULL,
                                ADD COLUMN PredictionScore FLOAT NULL
                            `);
                            console.log('Added prediction data columns to Votes table');
                        }
                    } catch (alterErr) {
                        console.error('Error updating votes table schema:', alterErr);
                    }
                }
            } catch (err) {
                console.error('Error checking/creating votes table:', err);
            }
            
            try {
                // Check if user has already voted for this URL
                const [existingVote] = await dbConnection.execute(`
                    SELECT VoteID FROM Votes WHERE UserID = ? AND URL = ?
                `, [userId, url]);
                
                if (existingVote.length > 0) {
                    // User already voted - update their vote without FeedbackType
                    await dbConnection.execute(`
                        UPDATE Votes
                        SET VoteType = ?, 
                            PredictionShown = ?,
                            PredictionScore = ?,
                            Timestamp = CURRENT_TIMESTAMP
                        WHERE UserID = ? AND URL = ?
                    `, [
                        voteType, 
                        predictionShown || null, 
                        predictionScore !== undefined && predictionScore !== null ? predictionScore : null, 
                        userId, 
                        url
                    ]);
                    console.log(`Updated vote for user ${userId} on URL ${url} to ${voteType}`);
                } else {
                    // New vote - insert without FeedbackType
                    await dbConnection.execute(`
                        INSERT INTO Votes (UserID, URL, VoteType, PredictionShown, PredictionScore)
                        VALUES (?, ?, ?, ?, ?)
                    `, [
                        userId, 
                        url, 
                        voteType, 
                        predictionShown || null, 
                        predictionScore !== undefined && predictionScore !== null ? predictionScore : null
                    ]);
                    console.log(`New vote added for user ${userId} on URL ${url}: ${voteType}`);
                }
            } catch (queryError) {
                console.error('Error executing vote query:', queryError);
                throw queryError;
            }
            
            // Get current vote counts
            const [positiveCounts] = await dbConnection.execute(`
                SELECT COUNT(*) AS count FROM Votes WHERE URL = ? AND VoteType = 'Positive'
            `, [url]);
            
            const [negativeCounts] = await dbConnection.execute(`
                SELECT COUNT(*) AS count FROM Votes WHERE URL = ? AND VoteType = 'Negative'
            `, [url]);
            
            // Verify the user has exactly one vote
            const [userVoteCheck] = await dbConnection.execute(`
                SELECT COUNT(*) AS count FROM Votes WHERE UserID = ? AND URL = ?
            `, [userId, url]);
            
            console.log(`User ${userId} has ${userVoteCheck[0].count} votes for URL ${url}`);
            
            res.status(200).json({
                message: 'Vote recorded successfully',
                counts: {
                    positive: positiveCounts[0].count,
                    negative: negativeCounts[0].count
                },
                userVote: voteType
            });
        } catch (error) {
            console.error('Error recording vote:', error);
            res.status(500).json({ message: 'Failed to record vote' });
        }
    });
    
    // GET /api/votes/counts - Get vote counts for a URL
    router.get('/counts', async (req, res) => {
        try {
            const { url } = req.query;
            
            if (!url) {
                return res.status(400).json({ message: 'URL parameter is required' });
            }
            
            // Check if user has voted
            let userVote = null;
            
            if (req.headers['x-auth-token']) {
                try {
                    const decoded = jwt.verify(req.headers['x-auth-token'], process.env.JWT_SECRET || 'phishguard_secure_jwt_secret_key');
                    if (decoded && decoded.user && decoded.user.id) {
                        const [userVotes] = await dbConnection.execute(`
                            SELECT VoteType FROM Votes WHERE UserID = ? AND URL = ?
                        `, [decoded.user.id, url]);
                        
                        if (userVotes.length > 0) {
                            userVote = userVotes[0].VoteType;
                        }
                    }
                } catch (err) {
                    console.error('JWT verification error:', err);
                    // Continue without user vote info
                }
            }
            
            try {
                // First check if the table exists
                const [tables] = await dbConnection.query(`
                    SHOW TABLES LIKE 'Votes'
                `);
                
                // If table doesn't exist, return zeros
                if (tables.length === 0) {
                    return res.json({
                        counts: { positive: 0, negative: 0 },
                        userVote
                    });
                }
                
                // Get vote counts
                const [positiveCounts] = await dbConnection.execute(`
                    SELECT COUNT(*) AS count FROM Votes WHERE URL = ? AND VoteType = 'Positive'
                `, [url]);
                
                const [negativeCounts] = await dbConnection.execute(`
                    SELECT COUNT(*) AS count FROM Votes WHERE URL = ? AND VoteType = 'Negative'
                `, [url]);
                
                res.json({
                    counts: {
                        positive: positiveCounts[0].count,
                        negative: negativeCounts[0].count
                    },
                    userVote
                });
            } catch (err) {
                console.error('Error fetching vote counts:', err);
                res.json({
                    counts: { positive: 0, negative: 0 },
                    userVote
                });
            }
        } catch (error) {
            console.error('Error getting vote counts:', error);
            res.status(500).json({ message: 'Failed to get vote counts' });
        }
    });

    // User endpoints - require regular auth
    
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
            // Query all votes with user info
            const [rows] = await dbConnection.execute(`
                SELECT v.VoteID, v.URL, v.VoteType, v.Timestamp,
                       u.Username, u.Email
                FROM Votes v
                JOIN User u ON v.UserID = u.UserID
                ORDER BY v.Timestamp DESC
                LIMIT 1000
            `);
            
            res.json(rows);
        } catch (error) {
            console.error('Error fetching votes:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });

    // GET /api/admin/votes/stats - Get vote stats (admin only)
    router.get('/stats', adminAuth, async (req, res) => {
        try {
            // Get overall vote statistics
            const [totalVotes] = await dbConnection.execute('SELECT COUNT(*) as total FROM Votes');
            const [positiveVotes] = await dbConnection.execute("SELECT COUNT(*) as count FROM Votes WHERE VoteType = 'Positive'");
            const [negativeVotes] = await dbConnection.execute("SELECT COUNT(*) as count FROM Votes WHERE VoteType = 'Negative'");
            const [uniqueUrls] = await dbConnection.execute('SELECT COUNT(DISTINCT URL) as count FROM Votes');
            const [uniqueUsers] = await dbConnection.execute('SELECT COUNT(DISTINCT UserID) as count FROM Votes');
            
            // Get recent voting activity (last 30 days)
            const [recentActivity] = await dbConnection.execute(`
                SELECT DATE(Timestamp) as date, COUNT(*) as count 
                FROM Votes 
                WHERE Timestamp > DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(Timestamp)
                ORDER BY date DESC
            `);
            
            // Format to match frontend expectations
            const response = {
                total: totalVotes[0].total || 0,
                positiveCount: positiveVotes[0].count || 0,
                negativeCount: negativeVotes[0].count || 0,
                urlsVoted: uniqueUrls[0].count || 0,
                uniqueVoters: uniqueUsers[0].count || 0,
                recentActivity: recentActivity.map(item => ({
                    date: item.date,
                    count: item.count
                }))
            };
            
            console.log('Vote stats response:', response);
            res.json(response);
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
            
            // Get votes for the specified URL
            const [votes] = await dbConnection.execute(`
                SELECT v.VoteID, v.UserID, v.VoteType, v.Timestamp,
                       u.Username, u.Email
                FROM Votes v
                JOIN User u ON v.UserID = u.UserID
                WHERE v.URL = ?
                ORDER BY v.Timestamp DESC
            `, [url]);
            
            // Get summary counts
            const [positiveCounts] = await dbConnection.execute(`
                SELECT COUNT(*) AS count FROM Votes WHERE URL = ? AND VoteType = 'Positive'
            `, [url]);
            
            const [negativeCounts] = await dbConnection.execute(`
                SELECT COUNT(*) AS count FROM Votes WHERE URL = ? AND VoteType = 'Negative'
            `, [url]);
            
            res.json({
                votes,
                summary: {
                    url,
                    positiveCount: positiveCounts[0].count,
                    negativeCount: negativeCounts[0].count,
                    totalVotes: votes.length
                }
            });
        } catch (error) {
            console.error('Error fetching URL votes:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });

    return router;
};
