const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const emailService = require('./email-service');
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
            'SELECT * FROM User WHERE Email = ?',
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

    async storeResetToken(userId, tokenHash) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);
        
        try {
            await this.connection.execute(
                'INSERT INTO PasswordReset (UserID, TokenHash, ExpiresAt) VALUES (?, ?, ?) ' +
                'ON DUPLICATE KEY UPDATE TokenHash = ?, ExpiresAt = ?',
                [userId, tokenHash, expiresAt, tokenHash, expiresAt]
            );
        } catch (error) {
            console.error('Error storing reset token:', error);
            throw error;
        }
    }

    async verifyResetToken(email, token) {
        try {
            // Get user and token info
            const [users] = await this.connection.execute(
                'SELECT u.UserID, pr.TokenHash, pr.ExpiresAt FROM User u ' +
                'JOIN PasswordReset pr ON u.UserID = pr.UserID ' +
                'WHERE u.Email = ? AND pr.ExpiresAt > NOW()',
                [email]
            );
            
            if (users.length === 0) return false;
            
            const user = users[0];
            
            // Verify token
            const isValid = await bcrypt.compare(token, user.TokenHash);
            return isValid;
        } catch (error) {
            console.error('Token verification error:', error);
            return false;
        }
    }

    async updatePassword(email, newPassword) {
        const hashedPassword = await this.hashPassword(newPassword);
        
        await this.connection.execute(
            'UPDATE User SET PasswordHash = ? WHERE Email = ?',
            [hashedPassword, email]
        );
    }

    async clearResetToken(email) {
        await this.connection.execute(
            'DELETE pr FROM PasswordReset pr ' +
            'JOIN User u ON pr.UserID = u.UserID ' +
            'WHERE u.Email = ?',
            [email]
        );
    }

    async sendPasswordResetEmail(email) {
        try {
            // Normalize email by converting to lowercase
            const normalizedEmail = email.toLowerCase().trim();
            
            // Check if user exists
            const user = await this.getUserByEmail(normalizedEmail);
            
            if (!user) {
                // If user doesn't exist, log it (but don't reveal to client)
                console.log(`Password reset attempted for non-existent email: ${normalizedEmail}`);
                
                // For security, we'll simulate successful response timing
                // to prevent timing attacks that could reveal if an email exists
                await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 500));
                
                // Return success: false, but don't throw an error
                // This ensures consistent API response regardless of email existence
                return { success: false, message: 'Request processed' };
            }
            
            // Rest of email sending logic for existing users
            // Generate a secure random token
            const resetToken = crypto.randomBytes(32).toString('hex');
            
            // Hash the token for database storage
            const hashedToken = await bcrypt.hash(resetToken, 10);
            
            // Store the token in the database
            await this.storeResetToken(user.UserID, hashedToken);
            
            // Create reset URL
            const resetUrl = `http://localhost:3000/reset-password.html?token=${resetToken}&email=${encodeURIComponent(normalizedEmail)}`;
            
            try {
                // Send the email only for existing users
                await emailService.sendPasswordResetEmail(normalizedEmail, {
                    username: user.Username || normalizedEmail.split('@')[0],
                    resetUrl: resetUrl
                });
                
                console.log(`Password reset email sent successfully to: ${normalizedEmail}`);
                return { success: true, message: 'Email sent successfully' };
            } catch (emailError) {
                // Email sending failed - log the error but don't expose details
                console.error(`Failed to send password reset email to ${normalizedEmail}:`, emailError);
                
                // In development, log the reset URL to console so testing can continue
                if (process.env.NODE_ENV !== 'production') {
                    console.log('=====================================');
                    console.log('EMAIL SENDING FAILED - Using fallback');
                    console.log('Password Reset URL:', resetUrl);
                    console.log('=====================================');
                    // Still return success since we've stored the token and provided a way to test
                    return { success: true, fallback: true };
                }
                
                throw new Error('Failed to send password reset email');
            }
        } catch (error) {
            console.error('Error in sendPasswordResetEmail:', error);
            throw error;
        }
    }
}

module.exports = AuthService;