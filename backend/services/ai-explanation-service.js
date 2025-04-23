const { GoogleGenerativeAI } = require("@google/generative-ai");
const GeminiAdapter = require('./providers/gemini-adapter');
const fs = require('fs');
const path = require('path');

class AIExplanationService {
  constructor() {
    this.geminiAdapter = new GeminiAdapter();
    this.promptTemplate = this._loadPromptTemplate();
  }

  _loadPromptTemplate() {
    try {
      // Try to load custom prompt template if it exists
      const promptPath = path.join(__dirname, '..', 'prompts', 'phishing-explanation.txt');
      if (fs.existsSync(promptPath)) {
        return fs.readFileSync(promptPath, 'utf8');
      } else {
        // Default prompt template
        return `
You are an expert cybersecurity analyst specializing in phishing detection. Analyze the given URL and explain why it is considered safe or risky.

Provide your analysis in this format:

# Phishing Risk Analysis

## Overview
[Provide a brief summary of the risk assessment]

## Key Risk Factors
[List the main factors that contribute to the risk score]

## Technical Details
[Explain technical indicators found in the analysis]

## Recommendations
[Provide actionable recommendations for the user]

Important: 
- Be educational but not alarmist
- Focus on the specific features detected in the URL
- Use clear language that non-technical users can understand
- Format your response using Markdown for readability
- DO NOT invent details not present in the analysis
`;
      }
    } catch (error) {
      console.error('Error loading prompt template:', error);
      return null;
    }
  }

  async generateExplanation(url, analysisResult, features) {
    if (!this.promptTemplate) {
      throw new Error('Prompt template not loaded');
    }

    try {
      const context = {
        url,
        result: analysisResult,
        features,
        timestamp: new Date().toISOString()
      };

      const explanation = await this.geminiAdapter.generateCompletion(
        this.promptTemplate, 
        context,
        {
          temperature: 0.3, // Lower temperature for more factual responses
          topP: 0.9,
          maxTokens: 1500
        }
      );

      return this._formatExplanation(explanation);
    } catch (error) {
      console.error('Error generating AI explanation:', error);
      throw new Error(`Failed to generate AI explanation: ${error.message}`);
    }
  }

  _formatExplanation(explanation) {
    // Convert markdown to basic HTML
    let formatted = explanation
      // Headers
      .replace(/^# (.*$)/gm, '<h2>$1</h2>')
      .replace(/^## (.*$)/gm, '<h3>$1</h3>')
      .replace(/^### (.*$)/gm, '<h4>$1</h4>')
      
      // Bold and italic
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      
      // Lists
      .replace(/^\- (.*)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)\n(?!<li>)/g, '$1</ul>\n')
      .replace(/(?<!<\/ul>\n)(<li>)/g, '<ul>$1')
      
      // Paragraphs
      .replace(/^\s*$/gm, '</p><p>')
      .replace(/<\/p><p>/g, '</p>\n<p>');
    
    // Wrap in paragraphs if not already
    if (!formatted.startsWith('<h2>') && !formatted.startsWith('<p>')) {
      formatted = `<p>${formatted}</p>`;
    }
    
    // Highlight important parts
    formatted = formatted.replace(
      /(?:IMPORTANT|NOTE|WARNING):([^<]+)/gi, 
      '<div class="highlight"><strong>$&</strong></div>'
    );
    
    return formatted;
  }
}

module.exports = AIExplanationService;
