const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const readline = require('readline');

// Database configuration
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'Sanuth123',
    database: 'phishing_detector',
    port: 3306
};

// Create interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to prompt user for input
function prompt(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

// Main function to create admin user
async function createAdminUser() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected successfully.');

        // Check if the User table exists
        const [tables] = await connection.execute("SHOW TABLES LIKE 'User'");
        
        if (tables.length === 0) {
            console.log('Creating User table...');
            await connection.execute(`
                CREATE TABLE User (
                    UserID INT PRIMARY KEY AUTO_INCREMENT,
                    Username VARCHAR(255) NOT NULL,
                    Email VARCHAR(255) NOT NULL UNIQUE,
                    PasswordHash VARCHAR(255) NOT NULL,
                    Role ENUM('Admin', 'User') DEFAULT 'User',
                    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);
            console.log('User table created.');
        }

        // Get admin email
        const email = await prompt('Enter admin email: ');
        
        // Check if email already exists
        const [existingUsers] = await connection.execute(
            'SELECT * FROM User WHERE Email = ?',
            [email]
        );
        
        if (existingUsers.length > 0) {
            const user = existingUsers[0];
            if (user.Role === 'Admin') {
                console.log(`\nUser with email ${email} already exists as an admin.`);
                
                // Ask if user wants to update password
                const updatePassword = await prompt('Do you want to update the password? (y/n): ');
                
                if (updatePassword.toLowerCase() === 'y') {
                    // Get and update password
                    const username = user.Username;
                    const password = await prompt('Enter new password: ');
                    
                    // Hash password
                    const salt = await bcrypt.genSalt(10);
                    const passwordHash = await bcrypt.hash(password, salt);
                    
                    // Update user
                    await connection.execute(
                        'UPDATE User SET PasswordHash = ? WHERE UserID = ?',
                        [passwordHash, user.UserID]
                    );
                    
                    console.log(`\nPassword updated successfully for admin user: ${username} (${email})`);
                } else {
                    console.log('Password update canceled.');
                }
                
                return;
            } else {
                // User exists but is not an admin
                const makeAdmin = await prompt('This email exists but is not an admin. Make this user an admin? (y/n): ');
                
                if (makeAdmin.toLowerCase() === 'y') {
                    await connection.execute(
                        'UPDATE User SET Role = "Admin" WHERE UserID = ?',
                        [existingUsers[0].UserID]
                    );
                    console.log(`\nUser ${existingUsers[0].Username} (${email}) has been promoted to Admin.`);
                    return;
                } else {
                    console.log('Admin creation canceled.');
                    return;
                }
            }
        }
        
        // Get admin details for new user
        const username = await prompt('Enter admin username: ');
        const password = await prompt('Enter admin password: ');
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        // Insert new admin user
        const [result] = await connection.execute(
            'INSERT INTO User (Username, Email, PasswordHash, Role) VALUES (?, ?, ?, "Admin")',
            [username, email, passwordHash]
        );
        
        console.log(`\nAdmin user created successfully with ID: ${result.insertId}`);
        console.log(`Username: ${username}`);
        console.log(`Email: ${email}`);
    } catch (error) {
        console.error('Error creating admin user:', error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('Database connection closed.');
        }
        rl.close();
    }
}

// Run the script
createAdminUser().catch(console.error);
