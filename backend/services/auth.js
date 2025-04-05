const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class AuthService {
    constructor(connection) {
        this.connection = connection;
        
        // Use JWT secret from environment variables
        this.jwtSecret = process.env.JWT_SECRET || 'phishguard_secure_jwt_secret_key';
        
        // Check if using default secret and warn
        if (!process.env.JWT_SECRET) {
            console.warn('WARNING: Using default JWT secret. Set JWT_SECRET in .env file for production.');
        }
        
        // Expiry from environment or default
        this.jwtExpiry = process.env.JWT_EXPIRY || '1h'; 
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

    async authenticateByEmail(email, password) {
        try {
            // Find user by email
            const [users] = await this.connection.execute(
                'SELECT UserID, Username, Email, PasswordHash, Role FROM User WHERE Email = ?',
                [email]
            );

            console.log(`Found ${users.length} user(s) with matching email`);
            
            if (users.length === 0) return null;

            const user = users[0];
            console.log('Comparing password hash');
            const passwordMatch = await bcrypt.compare(password, user.PasswordHash);
            
            console.log('Password match result:', passwordMatch);
            
            return passwordMatch ? user : null;
        } catch (error) {
            console.error('Email authentication error detail:', error);
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

    async getAdminInfo() {
        const [adminInfo] = await this.connection.execute(
            'SELECT UserID, Username, Email FROM User WHERE Role = "Admin"'
        );
        return adminInfo[0];
    }

    generateToken(user) {
        // Only include essential claims in the token
        const payload = {
            user: {
                id: user.UserID,
                role: user.Role
                // Don't include username in token
            }
        };
        
        // Add more security options
        return jwt.sign(payload, this.jwtSecret, { 
            expiresIn: this.jwtExpiry,
            algorithm: 'HS256',
            issuer: 'phishguard-api' 
        });
    }
    
    verifyToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            throw new Error('Invalid token');
        }
    }
    
    async getUserByEmail(email) {
        const [users] = await this.connection.execute(
            'SELECT UserID, Username, Email FROM User WHERE Email = ?',
            [email]
        );
        return users.length > 0 ? users[0] : null;
    }
    
    async createUser(name, email, password) {
        // Server-side password strength validation
        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }
        
        // Check for common password patterns
        if (/^password|123456|admin|qwerty|letmein/i.test(password)) {
            throw new Error('Password is too common and easily guessable');
        }
        
        const hashedPassword = await this.hashPassword(password);
        
        // Don't log sensitive PII information
        // Remove these debug log lines:
        // console.log('Raw name input:', name);
        // console.log('Raw email input:', email);
        
        // Generate username from name, fallback to email if name is invalid
        let username = '';
        if (name && typeof name === 'string') {
            // This line removes spaces and special characters
            username = name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
            
            // If username is empty after sanitization, fall back to email username
            if (!username) {
                username = email.split('@')[0].replace(/[^a-z0-9]/g, '');
            }
        } else {
            // Fallback to email-based username
            username = email.split('@')[0].replace(/[^a-z0-9]/g, '');
        }
        
        // Ensure username isn't empty
        if (!username) {
            username = 'user' + Date.now();
        }
        
        // Only log non-sensitive info or mask sensitive data
        console.log('Creating user with masked data:', { 
            usernameLength: username.length,
            emailDomain: email.substring(email.indexOf('@'))
        });
        
        try {
            // Insert the new user with 'User' role - modified to match actual DB schema
            const [result] = await this.connection.execute(
                'INSERT INTO User (Username, Email, PasswordHash, Role) VALUES (?, ?, ?, ?)',
                [username, email, hashedPassword, 'User']
            );
            
            // Sanitize logged information - don't log the full result object
            console.log('User created with ID:', result.insertId);
            
            // Return the created user object
            return {
                UserID: result.insertId,
                Username: username,
                Email: email,
                Role: 'User'
            };
        } catch (error) {
            console.error('Error in createUser:', error);
            throw error;
        }
    }
}

module.exports = AuthService;