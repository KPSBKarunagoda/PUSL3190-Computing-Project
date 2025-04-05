/**
 * PhishGuard configuration
 * Centralizes application configuration values
 */

const API_BASE_URL = 'http://localhost:3000';

// Export config for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        API_BASE_URL
    };
} else {
    // When in browser context
    window.PHISHGUARD_CONFIG = {
        API_BASE_URL
    };
}
