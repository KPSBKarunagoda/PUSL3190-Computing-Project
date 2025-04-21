const axios = require('axios');

class OpenAIAdapter {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.apiBaseUrl = 'https://api.openai.com';
    this.defaultModel = 'gpt-3.5-turbo';
    this.defaultOptions = {
      max_tokens: 1000,
      temperature: 0.7,
      top_p: 0.95
    };
  }

  /**
   * Generate a completion using OpenAI API
   * @param {string} prompt - The system prompt/instruction
   * @param {Object} context - The context object with analysis data
   * @param {Object} options - Custom options to override defaults
   * @returns {Promise<string>} - The generated text
   */
  async generateCompletion(prompt, context, options = {}) {
    try {
      const requestOptions = { ...this.defaultOptions, ...options };
      
      const response = await axios.post(
        `${this.apiBaseUrl}/v1/chat/completions`, 
        {
          model: this.defaultModel,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: `URL Analysis Results: ${JSON.stringify(context, null, 2)}` }
          ],
          max_tokens: requestOptions.max_tokens,
          temperature: requestOptions.temperature,
          top_p: requestOptions.top_p
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      // Return the generated text content
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI API error:', error.response?.data || error.message);
      throw new Error(`OpenAI API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

module.exports = OpenAIAdapter;
