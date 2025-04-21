require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// This is a simple test script to verify your Gemini API setup works correctly

async function testGeminiAPI() {
  console.log('Starting Gemini API test...');
  console.log('----------------------------------');
  
  // Check if API key is available
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ ERROR: GEMINI_API_KEY not found in environment variables');
    console.log('Make sure you have added the key to your .env file');
    return false;
  }
  
  console.log('✅ GEMINI_API_KEY found in environment');
  
  // Check model configuration
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
  console.log(`📋 Using model: ${model}`);
  
  try {
    // Initialize the API client
    console.log('📡 Initializing Gemini client...');
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Get the model
    const genModel = genAI.getGenerativeModel({ model });
    
    // Prepare a simple prompt
    const prompt = "You are a cybersecurity specialist. Please provide 3 tips for identifying phishing websites.";
    console.log(`📝 Testing with prompt: "${prompt}"`);
    
    // Configure generation parameters
    const generationConfig = {
      temperature: 0.7,
      maxOutputTokens: 200,
      topK: 40,
      topP: 0.95,
    };
    
    console.log('⏳ Sending request to Gemini API...');
    
    // Set timeout for API call
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timed out after 20 seconds')), 20000)
    );
    
    // Request generation from the API
    const contentPromise = genModel.generateContent(prompt, generationConfig);
    const result = await Promise.race([contentPromise, timeoutPromise]);
    
    // Process response
    const response = result.response;
    const text = response.text();
    
    console.log('✅ SUCCESS! Received response from Gemini API');
    console.log('----------------------------------');
    console.log('📄 RESPONSE TEXT:');
    console.log(text);
    console.log('----------------------------------');
    
    return true;
    
  } catch (error) {
    console.error('❌ ERROR: Gemini API test failed');
    console.error('----------------------------------');
    console.error('Error details:', error.message);
    
    if (error.message.includes('INVALID_ARGUMENT')) {
      console.error('This is likely due to an invalid API key or model name');
    } else if (error.message.includes('PERMISSION_DENIED')) {
      console.error('Permission denied - verify your API key has correct permissions');
    } else if (error.message.includes('UNAUTHENTICATED')) {
      console.error('Authentication failed - your API key is likely invalid');
    } else if (error.message.includes('timed out')) {
      console.error('Request timed out - check your internet connection or firewall settings');
    }
    
    console.error('----------------------------------');
    console.error('💡 TROUBLESHOOTING TIPS:');
    console.error('1. Verify your API key is correct and active');
    console.error('2. Confirm your model name is valid (gemini-pro, gemini-1.5-pro)');
    console.error('3. Check your network connection and firewall settings');
    console.error('4. Make sure you\'re not exceeding API rate limits (2 RPM for free tier)');
    
    return false;
  }
}

// Run the test and report overall result
testGeminiAPI()
  .then(success => {
    console.log('----------------------------------');
    if (success) {
      console.log('✅ TEST PASSED: Your Gemini API setup is working correctly!');
      console.log('If you\'re still having issues in your application, the problem is likely in your implementation.');
    } else {
      console.log('❌ TEST FAILED: Please fix the issues above before continuing.');
    }
  });
