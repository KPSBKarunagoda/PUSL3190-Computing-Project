class ListService {
    constructor(dbConnection) {
        this.dbConnection = dbConnection;
    }

    /**
     * Create whitelist and blacklist tables if they don't exist
     */
    async createListTables() {
        try {
            // Create Whitelist table if not exists
            await this.dbConnection.execute(`
                CREATE TABLE IF NOT EXISTS Whitelist (
                    WhitelistID INT AUTO_INCREMENT PRIMARY KEY,
                    Domain VARCHAR(255) UNIQUE NOT NULL,
                    URL VARCHAR(512),
                    AddedDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    AddedBy INT,
                    FOREIGN KEY (AddedBy) REFERENCES User(UserID)
                )
            `);
            
            // Create Blacklist table if not exists
            await this.dbConnection.execute(`
                CREATE TABLE IF NOT EXISTS Blacklist (
                    BlacklistID INT AUTO_INCREMENT PRIMARY KEY,
                    Domain VARCHAR(255) UNIQUE NOT NULL,
                    URL VARCHAR(512),
                    AddedDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    AddedBy INT,
                    FOREIGN KEY (AddedBy) REFERENCES User(UserID)
                )
            `);
            
            console.log('✅ Whitelist and Blacklist tables created successfully');
            return true;
        } catch (error) {
            console.error('❌ Error creating list tables:', error.message);
            throw error;
        }
    }

    /**
     * Get all whitelisted domains
     */
    async getWhitelist() {
        try {
            // Return full whitelist entries with user information
            const [rows] = await this.dbConnection.execute(`
                SELECT w.WhitelistID, w.URL, w.Domain, w.AddedDate, w.AddedBy,
                       u.Username as addedByUser
                FROM Whitelist w
                LEFT JOIN User u ON w.AddedBy = u.UserID
                ORDER BY w.AddedDate DESC
            `);
            
            // Log the actual data structure being returned
            console.log('Whitelist data from DB:', rows);
            return rows;
        } catch (error) {
            console.error('Error getting whitelist:', error);
            throw error;
        }
    }

    /**
     * Add a domain to whitelist
     */
    async addToWhitelist(domain, userId) {
        try {
            await this.dbConnection.execute(
                'INSERT INTO Whitelist (Domain, AddedBy, AddedDate) VALUES (?, ?, NOW())',
                [domain, userId]
            );
            return { success: true, domain };
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('Domain already exists in whitelist');
            }
            throw error;
        }
    }

    /**
     * Remove a domain from whitelist
     */
    async removeFromWhitelist(domain) {
        try {
            // First check if domain exists
            const [existing] = await this.dbConnection.execute(
                'SELECT * FROM Whitelist WHERE Domain = ?',
                [domain]
            );
            
            if (existing.length === 0) {
                throw new Error('Domain not found in whitelist');
            }
            
            // Remove from whitelist
            await this.dbConnection.execute(
                'DELETE FROM Whitelist WHERE Domain = ?',
                [domain]
            );
            
            return true;
        } catch (error) {
            console.error('Error removing from whitelist:', error);
            throw error;
        }
    }

    /**
     * Get all blacklisted domains
     */
    async getBlacklist() {
        try {
            // Return full blacklist entries with user information
            const [rows] = await this.dbConnection.execute(`
                SELECT b.BlacklistID, b.URL, b.Domain, b.AddedDate, b.AddedBy,
                       u.Username as addedByUser
                FROM Blacklist b
                LEFT JOIN User u ON b.AddedBy = u.UserID
                ORDER BY b.AddedDate DESC
            `);
            
            console.log('Blacklist data from DB:', rows);
            return rows;
        } catch (error) {
            console.error('Error getting blacklist:', error);
            throw error;
        }
    }

    /**
     * Add a domain to blacklist
     */
    async addToBlacklist(domain, userId) {
        try {
            await this.dbConnection.execute(
                'INSERT INTO Blacklist (Domain, AddedBy, AddedDate) VALUES (?, ?, NOW())',
                [domain, userId]
            );
            return { success: true, domain };
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('Domain already exists in blacklist');
            }
            throw error;
        }
    }

    /**
     * Remove a domain from blacklist
     */
    async removeFromBlacklist(domain) {
        try {
            const [result] = await this.dbConnection.execute(
                'DELETE FROM Blacklist WHERE Domain = ?',
                [domain]
            );
            
            if (result.affectedRows === 0) {
                throw new Error('Domain not found in blacklist');
            }
            
            return { success: true, domain };
        } catch (error) {
            console.error('Error removing from blacklist:', error);
            throw error;
        }
    }

    /**
     * Get blacklist statistics
     */
    async getBlacklistStats(timeframe = 'week') {
        try {
            let dateFormat;
            let daysToLookBack;
            let groupingQuery;
            
            // Configure the time period to analyze
            switch(timeframe) {
                case 'day':
                    dateFormat = '%Y-%m-%d %H:00:00';
                    daysToLookBack = 1;
                    groupingQuery = 'HOUR(AddedDate)';
                    break;
                case 'year':
                    dateFormat = '%Y-%m-01';
                    daysToLookBack = 365;
                    groupingQuery = 'YEAR(AddedDate), MONTH(AddedDate)';
                    break;
                case 'month':
                    dateFormat = '%Y-%m-%d';
                    daysToLookBack = 30;
                    groupingQuery = 'DATE(AddedDate)';
                    break;
                case 'week':
                default:
                    dateFormat = '%Y-%m-%d';
                    daysToLookBack = 7;
                    groupingQuery = 'DATE(AddedDate)';
                    break;
            }
            
            // Get additions to blacklist for the specified period
            const [rows] = await this.dbConnection.execute(`
                SELECT 
                    DATE_FORMAT(AddedDate, ?) as period,
                    COUNT(*) as count
                FROM Blacklist 
                WHERE AddedDate >= DATE_SUB(NOW(), INTERVAL ? DAY)
                GROUP BY ${groupingQuery}
                ORDER BY AddedDate ASC
            `, [dateFormat, daysToLookBack]);
            
            // Get total count
            const [totalResult] = await this.dbConnection.execute('SELECT COUNT(*) as total FROM Blacklist');
            const totalCount = totalResult[0].total;
            
            // Get recent additions (last 24 hours)
            const [recentResult] = await this.dbConnection.execute(`
                SELECT COUNT(*) as recent 
                FROM Blacklist 
                WHERE AddedDate >= DATE_SUB(NOW(), INTERVAL 1 DAY)
            `);
            const recentAdditions = recentResult[0].recent;
            
            // Format the result for chart display
            const labels = rows.map(row => row.period);
            const counts = rows.map(row => row.count);
            
            return {
                labels,
                counts,
                totalCount,
                recentAdditions
            };
        } catch (error) {
            console.error('Error getting blacklist stats:', error);
            throw error;
        }
    }
}

module.exports = ListService;