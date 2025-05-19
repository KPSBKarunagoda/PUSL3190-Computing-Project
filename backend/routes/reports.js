const express = require('express');
const router = express.Router();
const ReportingService = require('../services/reporting-service');
const authMiddleware = require('../middleware/auth');
const adminAuthMiddleware = require('../middleware/admin-auth');

module.exports = function(dbConnection) {
    const reportingService = new ReportingService(dbConnection);
    const auth = authMiddleware(dbConnection);
    const adminAuth = adminAuthMiddleware(dbConnection);
    
    // Initialize tables on startup
    reportingService.createReportingTables().catch(console.error);

    // Public test endpoint
    router.get('/test', (req, res) => {
        res.json({ message: 'Reports API is working' });
    });

    // User endpoints - require regular auth
    
    // POST /api/reports/check - Check if a URL has already been reported by this user
    router.post('/check', auth, async (req, res) => {
        try {
            const { url } = req.body;
            const userId = req.user.id;
            
            if (!url) {
                return res.status(400).json({ message: 'URL is required' });
            }
            
            // Check for existing report from this user for this URL
            const [existingReports] = await dbConnection.execute(
                'SELECT ReportID FROM Reports WHERE UserID = ? AND URL = ?',
                [userId, url]
            );
            
            if (existingReports.length > 0) {
                return res.json({ 
                    alreadyReported: true
                });
            }
            
            res.json({ alreadyReported: false });
        } catch (error) {
            console.error('Error checking report status:', error);
            res.status(500).json({ message: 'Server error', error: error.message });
        }
    });
    
    // POST /api/reports - Create a new report
    router.post('/', auth, async (req, res) => {
        try {
            const { url, reason, description } = req.body;
            const userId = req.user.id; // Extracted from auth token
            
            // Validate inputs
            if (!url) {
                return res.status(400).json({ message: 'URL is required' });
            }
            
            if (!reason) {
                return res.status(400).json({ message: 'Reason is required' });
            }
            
            // Check if user has already reported this URL
            const [existingReports] = await dbConnection.execute(
                'SELECT ReportID FROM Reports WHERE UserID = ? AND URL = ?',
                [userId, url]
            );
            
            if (existingReports.length > 0) {
                return res.status(409).json({ 
                    message: 'You have already reported this URL',
                    alreadyReported: true
                });
            }
            
            // Log the report submission
            console.log(`User ${userId} is reporting URL: ${url} for reason: ${reason}`);
            
            // Insert into the database
            const [result] = await dbConnection.execute(
                'INSERT INTO Reports (UserID, URL, Reason, Description, Status) VALUES (?, ?, ?, ?, ?)',
                [userId, url, reason, description || null, 'Pending']
            );
            
            // Add to activity log if available - using correct column names or skip if fails
            try {
                // First check if ActivityLog table exists and get its structure
                const [activityColumns] = await dbConnection.execute(`
                    SELECT COLUMN_NAME 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = 'ActivityLog' AND TABLE_SCHEMA = DATABASE()
                `);
                
                // If table exists, try to determine correct column names
                if (activityColumns.length > 0) {
                    // Map of column names we're looking for to possible alternatives
                    const columnMap = {
                        'ActivityType': ['ActivityType', 'Type', 'Action', 'ActionType'],
                        'Details': ['Details', 'Description', 'Message', 'Content']
                    };
                    
                    // Get actual column names from database
                    const actualColumns = activityColumns.map(col => col.COLUMN_NAME);
                    
                    // Find matching column names
                    const typeColumn = columnMap.ActivityType.find(col => 
                        actualColumns.includes(col)) || 'Action';
                    const detailsColumn = columnMap.Details.find(col => 
                        actualColumns.includes(col)) || 'Details';
                    
                    // Create dynamic query with correct column names
                    await dbConnection.execute(
                        `INSERT INTO ActivityLog (UserID, ${typeColumn}, ${detailsColumn}) VALUES (?, ?, ?)`,
                        [userId, 'report_submission', `Reported URL: ${url}`]
                    );
                    console.log('Activity logged successfully');
                }
            } catch (error) {
                // Improved error handling - don't let activity log failure affect the main functionality
                console.log('Activity log entry skipped:', error.message);
            }
            
            res.status(201).json({ 
                success: true,
                message: 'Report submitted successfully'
            });
            
        } catch (error) {
            console.error('Error submitting report:', error);
            res.status(500).json({ message: 'Server error', error: error.message });
        }
    });

    // GET /api/reports/user - Get reports by current user
    router.get('/user', auth, async (req, res) => {
        try {
            // Query reports for current user ID
            const [rows] = await dbConnection.execute(
                'SELECT * FROM Reports WHERE UserID = ? ORDER BY ReportDate DESC',
                [req.user.id]
            );
            
            res.json(rows);
        } catch (error) {
            console.error('Error fetching user reports:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });

    // DELETE /api/reports/:id - Delete user's own report
    router.delete('/:id', auth, async (req, res) => {
        try {
            const reportId = req.params.id;
            const userId = req.user.id;
            
            // First check if the report exists and belongs to this user
            const [reports] = await dbConnection.execute(
                'SELECT * FROM Reports WHERE ReportID = ? AND UserID = ?',
                [reportId, userId]
            );
            
            if (reports.length === 0) {
                return res.status(404).json({ 
                    message: 'Report not found or you do not have permission to delete it' 
                });
            }
            
            // Delete the report
            await dbConnection.execute(
                'DELETE FROM Reports WHERE ReportID = ? AND UserID = ?',
                [reportId, userId]
            );
            
            // Log the deletion in activity log if available
            try {
                await dbConnection.execute(
                    `INSERT INTO ActivityLog (UserID, Action, Details) VALUES (?, ?, ?)`,
                    [userId, 'delete_report', `Deleted report for URL: ${reports[0].URL}`]
                );
            } catch (logError) {
                // Just log the error but don't fail the request
                console.log('Activity log entry skipped:', logError.message);
            }
            
            res.json({ 
                success: true, 
                message: 'Report deleted successfully' 
            });
            
        } catch (error) {
            console.error('Error deleting report:', error);
            res.status(500).json({ message: 'Server error', error: error.message });
        }
    });

    // Admin endpoints - require admin auth
    
    // GET /api/reports - Get all reports (admin only)
    router.get('/', auth, async (req, res) => {
        try {
            // Check if user is admin
            if (req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Access denied' });
            }
            
            // Get all reports with username of reporter
            const [reports] = await dbConnection.execute(`
                SELECT r.*, u.Username as ReporterName 
                FROM Reports r
                JOIN User u ON r.UserID = u.UserID
                ORDER BY r.ReportDate DESC
            `);
            
            res.json(reports);
            
        } catch (error) {
            console.error('Error retrieving reports:', error);
            res.status(500).json({ message: 'Server error', error: error.message });
        }
    });

    // GET /api/reports/stats - Get report stats (admin only)
    router.get('/stats', adminAuth, async (req, res) => {
        try {
            const stats = await reportingService.getReportStats();
            res.json(stats);
        } catch (error) {
            console.error('Error fetching report stats:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });

    // GET /api/reports/:id - Get specific report (admin only)
    router.get('/:id', adminAuth, async (req, res) => {
        try {
            const reportId = req.params.id;
            const report = await reportingService.getReportById(reportId);
            
            if (!report) {
                return res.status(404).json({ message: 'Report not found' });
            }
            
            res.json(report);
        } catch (error) {
            console.error('Error fetching report:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });

    // PUT /api/reports/:id - Update report status (admin only)
    router.put('/:id', adminAuth, async (req, res) => {
        try {
            const reportId = req.params.id;
            const { status } = req.body;
            
            if (!status || !['Pending', 'Resolved'].includes(status)) {
                return res.status(400).json({ message: 'Valid status (Pending or Resolved) is required' });
            }
            
            const success = await reportingService.updateReportStatus(reportId, status);
            
            if (!success) {
                return res.status(404).json({ message: 'Report not found' });
            }
            
            res.json({ message: 'Report updated successfully' });
        } catch (error) {
            console.error('Error updating report:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });

    return router;
};
