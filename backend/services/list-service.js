class ListService {
    constructor(connection) {
        this.connection = connection;
    }
    
    // WHITELIST METHODS
    async getWhitelist() {
        const [results] = await this.connection.execute(
            'SELECT Domain FROM Whitelist ORDER BY Domain'
        );
        return results.map(item => item.Domain);
    }
    
    async addToWhitelist(domain, userId) {
        try {
            await this.connection.execute(
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
    
    async removeFromWhitelist(domain) {
        const [result] = await this.connection.execute(
            'DELETE FROM Whitelist WHERE Domain = ?',
            [domain]
        );
        
        if (result.affectedRows === 0) {
            throw new Error('Domain not found in whitelist');
        }
        
        return { success: true, domain };
    }
    
    // BLACKLIST METHODS
    async getBlacklist() {
        const [results] = await this.connection.execute(
            'SELECT Domain FROM Blacklist ORDER BY Domain'
        );
        return results.map(item => item.Domain);
    }
    
    async addToBlacklist(domain, userId) {
        try {
            await this.connection.execute(
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
    
    async removeFromBlacklist(domain) {
        const [result] = await this.connection.execute(
            'DELETE FROM Blacklist WHERE Domain = ?',
            [domain]
        );
        
        if (result.affectedRows === 0) {
            throw new Error('Domain not found in blacklist');
        }
        
        return { success: true, domain };
    }
    
    // DATABASE SETUP
    async createListTables() {
        try {
            // Create Whitelist table if not exists
            await this.connection.execute(`
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
            await this.connection.execute(`
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
}

module.exports = ListService;