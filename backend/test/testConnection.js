const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'Sanuth123',  // Your MySQL password
    port: 3306,
    connectTimeout: 10000
};

async function testConnection() {
    let connection;
    try {
        // Clear any previous output
        console.clear();
        console.log('='.repeat(50));
        console.log('🔄 Testing MySQL connection...\n');

        // Attempt connection
        connection = await mysql.createConnection(dbConfig);
        
        // Test the connection and get server info
        const [versionRows] = await connection.execute('SELECT VERSION() as version');
        const [variables] = await connection.execute('SHOW VARIABLES LIKE "max_connections"');
        
        console.log('✅ Successfully connected to MySQL!');
        console.log(`ℹ️ MySQL Version: ${versionRows[0].version}`);
        console.log(`📊 Max Connections: ${variables[0].Value}`);
        console.log(`🔌 Connected as: ${dbConfig.user}@${dbConfig.host}`);
        return true;

    } catch (error) {
        console.error('\n❌ Connection failed!');
        console.error(`Error: ${error.message}`);
        return false;

    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔒 Connection closed');
        }
        console.log('='.repeat(50));
    }
}

// Run the test
testConnection()
    .then(success => {
        console.log(`\n${success ? '✅ Test PASSED' : '❌ Test FAILED'}`);
        process.exit(success ? 0 : 1);
    });