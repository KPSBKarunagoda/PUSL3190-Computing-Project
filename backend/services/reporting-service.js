/**
 * Service for managing website reports
 */
class ReportingService {
    /**
     * Create a new ReportingService instance
     * @param {object} db - Database connection
     */
    constructor(db) {
        this.db = db;
    }

    /**
     * Create necessary tables for reporting system
     * @returns {Promise<void>}
     */
    async createReportingTables() {
        try {
            // Check if Reports table exists
            const [checkTable] = await this.db.execute(`
                SELECT TABLE_NAME 
                FROM information_schema.TABLES 
                WHERE TABLE_NAME = 'Reports' AND TABLE_SCHEMA = DATABASE()
            `);

            // If Reports table doesn't exist, create it
            if (checkTable.length === 0) {
                console.log('Creating Reports table...');
                await this.db.execute(`
                    CREATE TABLE Reports (
                        ReportID INT PRIMARY KEY AUTO_INCREMENT,
                        UserID INT NOT NULL,
                        URL VARCHAR(255) NOT NULL,
                        ReportDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        Status ENUM('Pending', 'Resolved') DEFAULT 'Pending',
                        FOREIGN KEY (UserID) REFERENCES User(UserID),
                        Description TEXT,
                        Reason VARCHAR(50)
                    )
                `);
                console.log('Reports table created successfully');
            } else {
                console.log('Reports table already exists');
            }
        } catch (error) {
            console.error('Error creating reports tables:', error.message);
            throw error;
        }
    }

    /**
     * Get report statistics
     * @returns {Promise<object>} Report statistics
     */
    async getReportStats() {
        try {
            // Get total reports count
            const [totalReports] = await this.db.execute('SELECT COUNT(*) as count FROM Reports');
            
            // Get pending reports count
            const [pendingReports] = await this.db.execute(
                "SELECT COUNT(*) as count FROM Reports WHERE Status = 'Pending'"
            );
            
            // Get resolved reports count
            const [resolvedReports] = await this.db.execute(
                "SELECT COUNT(*) as count FROM Reports WHERE Status = 'Resolved'"
            );
            
            // Get top reported domains
            const [topDomains] = await this.db.execute(`
                SELECT 
                    SUBSTRING_INDEX(SUBSTRING_INDEX(URL, '://', -1), '/', 1) as domain,
                    COUNT(*) as count
                FROM Reports
                GROUP BY domain
                ORDER BY count DESC
                LIMIT 5
            `);
            
            return {
                total: totalReports[0].count || 0,
                pending: pendingReports[0].count || 0,
                resolved: resolvedReports[0].count || 0,
                topReportedDomains: topDomains
            };
        } catch (error) {
            console.error('Error getting report stats:', error);
            throw error;
        }
    }

    /**
     * Get a specific report by ID
     * @param {number} reportId - Report ID to retrieve
     * @returns {Promise<object|null>} Report data or null if not found
     */
    async getReportById(reportId) {
        try {
            const [reports] = await this.db.execute(`
                SELECT r.*, u.Username as ReporterName
                FROM Reports r
                JOIN User u ON r.UserID = u.UserID
                WHERE r.ReportID = ?
            `, [reportId]);
            
            return reports.length > 0 ? reports[0] : null;
        } catch (error) {
            console.error('Error getting report by ID:', error);
            throw error;
        }
    }

    /**
     * Update the status of a report
     * @param {number} reportId - Report ID to update
     * @param {string} status - New status ('Pending' or 'Resolved')
     * @returns {Promise<boolean>} True if updated, false if not found
     */
    async updateReportStatus(reportId, status) {
        try {
            const [result] = await this.db.execute(
                'UPDATE Reports SET Status = ? WHERE ReportID = ?',
                [status, reportId]
            );
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating report status:', error);
            throw error;
        }
    }
}

module.exports = ReportingService;
