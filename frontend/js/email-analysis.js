// Email Analysis script
document.addEventListener('DOMContentLoaded', () => {
  // Initialize any additional email analysis functionality here
});

/**
 * Cleans and formats AI analysis response to ensure consistent HTML formatting
 * @param {string} analysisText - Raw text from AI response
 * @return {string} - Cleaned and formatted HTML
 */
function formatAIResponse(analysisText) {
  if (!analysisText) return '';
  
  // Trim whitespace from beginning and end
  let formatted = analysisText.trim();
  
  // Replace any markdown formatting with proper HTML
  formatted = formatted
    // Replace any remaining markdown-style bold with HTML
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    // Replace any markdown-style italics with HTML
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    // Replace markdown-style code with HTML
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Replace markdown-style headers if any exist
    .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
    .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
    .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
    // Replace b tags with strong tags for consistency
    .replace(/<b>(.*?)<\/b>/g, '<strong>$1</strong>')
    // Replace i tags with em tags for consistency
    .replace(/<i>(.*?)<\/i>/g, '<em>$1</em>')
    // Remove any excess newlines at beginning
    .replace(/^(\s*\n\s*)+/, '')
    // Fix multiple consecutive newlines
    .replace(/\n{3,}/g, '\n\n');
    
  // Fix spacing issues by normalizing whitespace between sections
  // 1. Remove excessive blank lines between sections and list items
  formatted = formatted.replace(/(<\/h[2-6]>)\s*\n+\s*/g, '$1\n');
  formatted = formatted.replace(/(<\/p>)\s*\n+\s*/g, '$1\n');
  formatted = formatted.replace(/(<\/ul>|<\/ol>)\s*\n+\s*/g, '$1\n');
  
  // 2. Fix list items with too much spacing
  formatted = formatted.replace(/<\/li>\s*\n+\s*<li>/g, '</li>\n<li>');
  
  // 3. Ensure consistent spacing between sections
  formatted = formatted.replace(/(<\/h[2-6]>)\s*(<[^h])/g, '$1\n$2');
  formatted = formatted.replace(/(<\/[^h][^>]*>)\s*(<h[2-6])/g, '$1\n\n$2');
  
  // 4. Fix extra whitespace in list markup
  formatted = formatted.replace(/<ul>\s+/g, '<ul>\n  ');
  formatted = formatted.replace(/<ol>\s+/g, '<ol>\n  ');
  formatted = formatted.replace(/\s+<\/ul>/g, '\n</ul>');
  formatted = formatted.replace(/\s+<\/ol>/g, '\n</ol>');
  
  // 5. Ensure proper spacing in nested HTML elements
  formatted = formatted.replace(/>(\s*\n+\s*)</g, '>\n<');
  
  // Add styling to important keywords
  formatted = formatted
    .replace(/\b(phishing|scam|attack|fraud|malicious)\b/gi, '<span class="risk-high">$1</span>')
    .replace(/\b(suspicious|unusual|potentially|questionable)\b/gi, '<span class="risk-medium">$1</span>')
    .replace(/\b(legitimate|safe|genuine|authentic)\b/gi, '<span class="risk-low">$1</span>');
    
  // Handle brackets used for placeholders that might have been left in
  formatted = formatted
    .replace(/\[phishing\/suspicious\/legitimate\]/g, '<em>phishing</em>')
    .replace(/\[brief explanation of main reasons\]/g, 'multiple security issues were detected')
    .replace(/\[.*?\]/g, ''); // Remove any remaining brackets
  
  // Ensure content starts with a proper heading if it's missing
  if (!formatted.trim().startsWith('<h2>')) {
    formatted = '<h2>Email Security Analysis</h2>\n' + formatted;
  }
  
  // Fix some specific formatting issues with nested elements
  formatted = formatted
    // Remove blank list items 
    .replace(/<li>\s*<\/li>/g, '')
    // Fix paragraphs inside list items
    .replace(/<li>\s*<p>(.*?)<\/p>\s*<\/li>/g, '<li>$1</li>')
    // Make sure there's no extra spacing at start of paragraphs
    .replace(/<p>\s+/g, '<p>')
    // Ensure proper spacing after headings
    .replace(/<\/h([2-6])>\s*</g, '</h$1>\n<')
    // Clean up any remaining excessive spacing
    .replace(/\n{3,}/g, '\n\n');
  
  // Wrap the content in a div with styling for better presentation
  return `<div class="ai-analysis-content">${formatted}</div>`;
}
