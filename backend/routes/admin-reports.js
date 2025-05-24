/**
 * Admin Reports API Router
 * 
 * This module implements secure admin-only routes for managing user-submitted phishing reports.
 * All routes are protected by admin authentication middleware to ensure only authorized
 * administrators can access these endpoints.
 * 
 * Features:
 * - Retrieval of all user-submitted reports with reporter information
 * - Statistical analysis of report data (total, pending, resolved, daily counts)
 * - Individual report management by ID
 * - Status updates for reports (marking as Pending or Resolved)
 * 
 * Security:
 * - All routes enforce admin-level permissions
 * - Uses LEFT JOIN to safely handle cases where user data might be missing
 * - Implements parameterized queries to prevent SQL injection
 * 
 * Endpoints:
 * - GET /api/admin/reports - List all reports with reporter details
 * - GET /api/admin/reports/stats - Get statistical overview of reporting activity
 * - GET /api/admin/reports/:id - Get detailed information about a specific report
 * - PUT /api/admin/reports/:id - Update a report's status (resolution workflow)
 */
const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/admin-auth');
//
module.exports = function(dbConnection) {
    // Apply admin authentication middleware to all routes
    router.use(adminAuth(dbConnection));

    // GET /api/admin/reports - Get all reports with admin privileges
    router.get('/', async (req, res) => {
        try {
            const [reports] = await dbConnection.execute(`
                SELECT r.*, u.Username as ReporterName
                FROM Reports r
                LEFT JOIN User u ON r.UserID = u.UserID
                ORDER BY r.ReportDate DESC
            `);
            
            res.json(reports);
        } catch (error) {
            console.error('Error fetching reports:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });

    // GET /api/admin/reports/stats - Get report statistics
    router.get('/stats', async (req, res) => {
        try {
            // Get total count
            const [totalResult] = await dbConnection.execute('SELECT COUNT(*) as total FROM Reports');
            
            // Get counts by status
            const [statusCounts] = await dbConnection.execute(`
                SELECT 
                    SUM(CASE WHEN Status = 'Pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN Status = 'Resolved' THEN 1 ELSE 0 END) as resolved
                FROM Reports
            `);
            
            // Get today's count
            const [todayResult] = await dbConnection.execute(`
                SELECT COUNT(*) as todayCount 
                FROM Reports 
                WHERE DATE(ReportDate) = CURDATE()
            `);
            
            res.json({
                total: totalResult[0].total || 0,
                pending: statusCounts[0].pending || 0,
                resolved: statusCounts[0].resolved || 0,
                todayCount: todayResult[0].todayCount || 0
            });
        } catch (error) {
            console.error('Error fetching report stats:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });

    // GET /api/admin/reports/:id - Get a specific report
    router.get('/:id', async (req, res) => {
        try {
            const [reports] = await dbConnection.execute(`
                SELECT r.*, u.Username as ReporterName
                FROM Reports r
                LEFT JOIN User u ON r.UserID = u.UserID
                WHERE r.ReportID = ?
            `, [req.params.id]);
            
            if (reports.length === 0) {
                return res.status(404).json({ message: 'Report not found' });
            }
            
            res.json(reports[0]);
        } catch (error) {
            console.error('Error fetching report:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });

    // PUT /api/admin/reports/:id - Update a report (e.g., change status)
    router.put('/:id', async (req, res) => {
        try {
            const { status } = req.body;
            
            if (!status) {
                return res.status(400).json({ message: 'Status is required' });
            }
            
            const [result] = await dbConnection.execute(
                'UPDATE Reports SET Status = ? WHERE ReportID = ?',
                [status, req.params.id]
            );
            
            if (result.affectedRows === 0) {
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
