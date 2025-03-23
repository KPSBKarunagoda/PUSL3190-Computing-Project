const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class AuthService {
    constructor(connection) {
        this.connection = connection;
        this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key'; // Use environment variable in production
        this.jwtExpiry = '8h'; // Token expiry time
    }

    async hashPassword(plainPassword) {
        const saltRounds = 10;
        return await bcrypt.hash(plainPassword, saltRounds);
    }

    async authenticateUser(username, password) {
        try {
            const [users] = await this.connection.execute(
                'SELECT UserID, Username, PasswordHash, Role FROM User WHERE Username = ?',
                [username]
            );

            if (users.length === 0) return null;

            const user = users[0];
            const passwordMatch = await bcrypt.compare(password, user.PasswordHash);

            return passwordMatch ? user : null;
        } catch (error) {
            console.error('Authentication error:', error);
            return null;
        }
    }

    async getUserById(userId) {
        const [users] = await this.connection.execute(
            'SELECT UserID, Username, Role FROM User WHERE UserID = ?',
            [userId]
        );
        return users[0];
    }

    async createInitialAdmin() {
        try {
            const [admins] = await this.connection.execute(
                'SELECT * FROM User WHERE Role = "Admin"'
            );
            
            if (admins.length === 0) {
                const hashedPassword = await this.hashPassword('Sanuth321');
                await this.connection.execute(`
                    INSERT INTO User (Username, Email, PasswordHash, Role)
                    VALUES ('admin', 'sanuthkarunagoda@gmail.com', ?, 'Admin')
                `, [hashedPassword]);
                console.log('✅ Admin user created successfully');
                console.log('Default credentials:');
                console.log('Username: admin');
                console.log('Password: Sanuth321');
            }
            
            return await this.getAdminInfo();
        } catch (error) {
            console.error('❌ Error creating admin:', error.message);
            throw error;
        }
    }

    async getAdminInfo() {
        const [adminInfo] = await this.connection.execute(
            'SELECT UserID, Username, Email FROM User WHERE Role = "Admin"'
        );
        return adminInfo[0];
    }

    generateToken(user) {
        const payload = {
            user: {
                id: user.UserID,
                username: user.Username,
                role: user.Role
            }
        };
        
        return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiry });
    }
    
    verifyToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            throw new Error('Invalid token');
        }
    }
}

module.exports = AuthService;