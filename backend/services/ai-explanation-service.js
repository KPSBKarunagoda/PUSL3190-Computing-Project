/**
 * AI Explanation Service - Stub version
 * This is a minimal version that does nothing, kept for backward compatibility
 */
class AIExplanationService {
  constructor() {
    console.log('AIExplanationService stub initialized');
    this.cache = new Map();
  }

  generateExplanation() {
    return Promise.resolve("AI explanation feature is disabled");
  }
}

module.exports = AIExplanationService;
