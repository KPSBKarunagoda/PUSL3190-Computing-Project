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
    
    // POST /api/reports - Create a new report
    router.post('/', auth, async (req, res) => {
        try {
            const { url } = req.body;
            if (!url) {
                return res.status(400).json({ message: 'URL is required' });
            }
            
            // Create report
            const reportId = await reportingService.createReport(req.user.id, url);
            
            res.status(201).json({ 
                message: 'Report submitted successfully', 
                reportId 
            });
        } catch (error) {
            console.error('Error creating report:', error);
            res.status(500).json({ message: 'Server error' });
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

    // Admin endpoints - require admin auth
    
    // GET /api/reports - Get all reports (admin only)
    router.get('/', adminAuth, async (req, res) => {
        try {
            const reports = await reportingService.getReports();
            res.json(reports);
        } catch (error) {
            console.error('Error fetching reports:', error);
            res.status(500).json({ message: 'Server error' });
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
