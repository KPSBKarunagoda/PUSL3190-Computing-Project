require('dotenv').config();
const GeminiAdapter = require('./services/providers/gemini-adapter');
const AIExplanationService = require('./services/ai-explanation-service');

// Sample email header analysis findings to test
const sampleContext = {
  email_subject: "Your Account Security Alert",
  risk_score: 75,
  findings: [
    {
      text: "SPF Authentication Failed",
      description: "The email failed Sender Policy Framework verification.",
      severity: "high"
    },
    {
      text: "Suspicious Mail Route",
      description: "The email passed through servers in unexpected regions.",
      severity: "medium"
    },
    {
      text: "Sender Domain Mismatch",
      description: "The sender domain doesn't match the From address display name.",
      severity: "high"
    }
  ],
  spf_result: "fail",
  dkim_result: "none",
  dmarc_result: "fail"
};

// Sample raw email headers
const sampleHeaders = `
Return-Path: <sender@suspicious-domain.com>
Received: from unknown (HELO mail-server.example.net) (192.168.1.1)
  by mail.recipient.com with ESMTP; 1 Jan 2023 12:00:00 -0500
From: "Bank Support" <support@legitimate-bank.com>
To: victim@example.com
Subject: Your Account Security Alert
Date: Sat, 1 Jan 2023 12:00:00 -0500
Message-ID: <1234567890@suspicious-domain.com>
MIME-Version: 1.0
Content-Type: text/html; charset="UTF-8"
Authentication-Results: mail.recipient.com;
  spf=fail (sender SPF record does not designate 192.168.1.1 as permitted sender) smtp.mailfrom=sender@suspicious-domain.com;
  dkim=none;
  dmarc=fail (p=reject dis=none) d=suspicious-domain.com
`;

async function testEmailAIAnalysis() {
  console.log('Starting Email AI Analysis test...');
  console.log('----------------------------------');
  
  // Check if API key is available
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ ERROR: GEMINI_API_KEY not found in environment variables');
    console.log('Make sure you have added the key to your .env file');
    return false;
  }
  
  console.log('✅ GEMINI_API_KEY found');
  console.log('📧 Testing AI email header analysis...');
  
  try {
    // Test with direct GeminiAdapter
    console.log('\n=== Testing with GeminiAdapter directly ===');
    const gemini = new GeminiAdapter();
    
    // Prepare the prompt
    const prompt = `
You are an expert email security analyst helping to determine if an email is potentially phishing or legitimate.
I will provide you with the email headers analysis findings and I need your expert interpretation.

Please analyze the following email header analysis data and provide:

1. An overall assessment of whether this email is likely phishing, suspicious, or legitimate
2. A detailed explanation of the key security indicators found in the headers
3. What these findings mean from a security perspective
4. Recommendations for the recipient on how to proceed with this email

Keep your analysis concise but thorough, using professional security terminology where appropriate.
Focus on patterns or anomalies that are strong indicators of either legitimacy or phishing attempts.
`;
    
    console.log('⏳ Sending request to Gemini API...');
    
    // Get AI analysis
    const analysis = await gemini.generateCompletion(prompt, sampleContext, {
      temperature: 0.2,
      maxTokens: 1024
    });
    
    console.log('✅ SUCCESS! Direct adapter test completed');
    console.log('----------------------------------');
    console.log('📄 AI ANALYSIS SAMPLE:');
    console.log(analysis.substring(0, 200) + '...');
    
    // Test with AIExplanationService
    console.log('\n=== Testing with AIExplanationService ===');
    const aiService = new AIExplanationService();
    
    console.log('⏳ Generating email analysis with service...');
    const serviceAnalysis = await aiService.generateEmailAnalysis(sampleHeaders, sampleContext);
    
    console.log('✅ SUCCESS! Service test completed');
    console.log('----------------------------------');
    console.log('📄 FULL AI ANALYSIS:');
    console.log(serviceAnalysis);
    console.log('----------------------------------');
    
    return true;
  } catch (error) {
    console.error('❌ ERROR: Email AI analysis test failed');
    console.error('Error details:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run the test
testEmailAIAnalysis()
  .then(success => {
    console.log('----------------------------------');
    if (success) {
      console.log('✅ TEST PASSED: Email AI analysis is working correctly');
    } else {
      console.log('❌ TEST FAILED: Please fix the issues above before continuing');
    }
  });
