const crypto = require('crypto');

class ActivityService {
  constructor(dbConnection) {
    this.db = dbConnection;
  }

  /**
   * Hash a URL with user-specific salt for privacy
   * @param {string} url - The URL to hash
   * @param {number} userId - User ID to use as salt
   * @returns {string} - Hashed URL
   */
  hashUrl(url, userId) {
    // Normalize URL by removing trailing slashes and converting to lowercase
    const normalizedUrl = url.trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '');
    
    // Create a user-specific salt to prevent cross-user correlation
    const salt = `phishguard-user-${userId}-salt`;
    
    // Hash the URL with the user-specific salt
    return crypto.createHash('sha256')
      .update(normalizedUrl + salt)
      .digest('hex');
  }

  /**
   * Extract safe domain name from URL for display purposes
   * @param {string} url - Full URL
   * @returns {string} - Domain name or generic title
   */
  extractSafeTitle(url) {
    try {
      // Parse the URL
      const urlObj = new URL(url);
      // Return only the hostname (domain)
      return urlObj.hostname || 'Website Visit';
    } catch (e) {
      // If URL parsing fails, return generic title
      return 'Website Visit';
    }
  }

  /**
   * Record a URL scan activity for a user
   * @param {number} userId - The user ID
   * @param {string} url - The URL that was scanned
   * @param {string} title - Page title or URL description
   * @param {number} riskScore - Risk score from analysis
   * @returns {Promise<object>} - Result with status
   */
  async recordActivity(userId, url, title, riskScore) {
    console.log(`Recording activity for user ${userId}`);
    
    try {
      // Generate URL hash for privacy and deduplication
      const urlHash = this.hashUrl(url, userId);
      
      // Generate a privacy-safe title if none provided
      const safeTitle = title || this.extractSafeTitle(url);
      
      // Check if this URL has already been recorded for this user
      const [existing] = await this.db.execute(
        'SELECT ActivityID FROM UserActivity WHERE UserID = ? AND UrlHash = ?',
        [userId, urlHash]
      );
      
      let result;
      
      if (existing && existing.length > 0) {
        // Update existing record with new timestamp and data
        console.log(`Activity exists, updating record ${existing[0].ActivityID}`);
        await this.db.execute(
          'UPDATE UserActivity SET Title = ?, Risk = ?, Timestamp = CURRENT_TIMESTAMP WHERE ActivityID = ?',
          [safeTitle, riskScore || 0, existing[0].ActivityID]
        );
        result = { updated: true, id: existing[0].ActivityID };
      } else {
        // Insert new activity record
        console.log(`Creating new activity record for user ${userId}`);
        const [insertResult] = await this.db.execute(
          'INSERT INTO UserActivity (UserID, UrlHash, Title, Risk) VALUES (?, ?, ?, ?)',
          [userId, urlHash, safeTitle, riskScore || 0]
        );
        result = { created: true, id: insertResult.insertId };
      }
      
      console.log('Activity record operation result:', result);
      return result;
    } catch (error) {
      console.error('Error recording activity:', error);
      throw error;
    }
  }

  /**
   * Get recent activities for a user
   * @param {number} userId - The user ID
   * @param {number} limit - Maximum number of activities to return
   * @returns {Promise<Array>} - List of recent activities
   */
  async getUserActivities(userId, limit = 10) {
    try {
      console.log(`Getting activities for user ${userId}, limit: ${limit}`);
      const [activities] = await this.db.execute(
        `SELECT ActivityID, Title, Risk, Timestamp 
         FROM UserActivity 
         WHERE UserID = ? 
         ORDER BY Timestamp DESC 
         LIMIT ?`,
        [userId, limit]
      );
      
      console.log(`Found ${activities.length} activities for user ${userId}`);
      return activities;
    } catch (error) {
      console.error('Error fetching user activities:', error);
      throw error;
    }
  }

  /**
   * Clear user activity history
   * @param {number} userId - The user ID
   * @returns {Promise<boolean>} - Success status
   */
  async clearUserActivities(userId) {
    try {
      console.log(`Clearing activities for user ${userId}`);
      await this.db.execute(
        'DELETE FROM UserActivity WHERE UserID = ?',
        [userId]
      );
      
      console.log(`Activities cleared successfully for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error clearing user activities:', error);
      return false;
    }
  }
}

module.exports = ActivityService;
