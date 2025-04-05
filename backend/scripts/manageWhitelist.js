const mysql = require('mysql2/promise');
const readline = require('readline');
const url = require('url');
const AuthService = require('../services/auth');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'phishing_detector',
    port: parseInt(process.env.DB_PORT || '3306')
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function addToWhitelist(connection, urlString, userId) {
    try {
        const parsedUrl = new URL(urlString);
        const domain = parsedUrl.hostname;

        const [existing] = await connection.execute(
            'SELECT * FROM Whitelist WHERE URL = ? OR Domain = ?',
            [urlString, domain]
        );

        if (existing.length > 0) {
            throw new Error('URL or domain already whitelisted');
        }

        await connection.execute(
            'INSERT INTO Whitelist (URL, Domain, AddedBy) VALUES (?, ?, ?)',
            [urlString, domain, userId]
        );
        console.log(`✅ Successfully added ${urlString} to whitelist`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to add URL: ${error.message}`);
        return false;
    }
}

async function listWhitelist(connection) {
    const [rows] = await connection.execute(`
        SELECT w.*, u.Username, u.Email
        FROM Whitelist w 
        JOIN User u ON w.AddedBy = u.UserID 
        ORDER BY w.AddedDate DESC
    `);
    
    if (rows.length === 0) {
        console.log('\n📝 Whitelist is empty');
        return;
    }

    console.log('\n📋 Current Whitelist:');
    rows.forEach(row => {
        console.log('\n-------------------');
        console.log(`🔗 URL: ${row.URL}`);
        console.log(`🌐 Domain: ${row.Domain}`);
        console.log(`👤 Added By: ${row.Username} (${row.Email})`);
        console.log(`📅 Added: ${row.AddedDate.toLocaleString()}`);
    });
}

async function main() {
    let connection;
    let currentUser = null;

    try {
        connection = await mysql.createConnection(dbConfig);
        const authService = new AuthService(connection);
        
        // Ensure admin exists
        await authService.createInitialAdmin();

        // Authentication loop
        while (!currentUser) {
            console.clear();
            console.log('='.repeat(50));
            console.log('🔐 Login Required\n');

            const username = await new Promise(resolve => {
                rl.question('Username: ', resolve);
            });

            const password = await new Promise(resolve => {
                rl.question('Password: ', resolve);
            });

            currentUser = await authService.authenticateUser(username, password);

            if (!currentUser) {
                console.log('\n❌ Invalid credentials');
                await new Promise(resolve => {
                    rl.question('\nPress Enter to try again...', resolve);
                });
            }
        }

        // Main menu loop
        while (true) {
            console.clear();
            console.log('='.repeat(50));
            console.log(`🛡️  Whitelist Management (Logged in as: ${currentUser.Username})\n`);
            console.log('1. Add URL to whitelist');
            console.log('2. View whitelist');
            console.log('3. Logout');
            
            const answer = await new Promise(resolve => {
                rl.question('\nChoose an option (1-3): ', resolve);
            });

            switch (answer) {
                case '1':
                    if (currentUser.Role !== 'Admin') {
                        console.log('\n❌ Access denied: Admin privileges required');
                    } else {
                        const urlToAdd = await new Promise(resolve => {
                            rl.question('Enter URL (e.g., https://www.google.com): ', resolve);
                        });
                        await addToWhitelist(connection, urlToAdd, currentUser.UserID);
                    }
                    await new Promise(resolve => {
                        rl.question('\nPress Enter to continue...', resolve);
                    });
                    break;

                case '2':
                    await listWhitelist(connection);
                    await new Promise(resolve => {
                        rl.question('\nPress Enter to continue...', resolve);
                    });
                    break;

                case '3':
                    console.log('\n👋 Goodbye!');
                    rl.close();
                    return;

                default:
                    console.log('\n❌ Invalid option');
                    await new Promise(resolve => {
                        rl.question('\nPress Enter to continue...', resolve);
                    });
            }
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) await connection.end();
        rl.close();
    }
}

main().catch(console.error);