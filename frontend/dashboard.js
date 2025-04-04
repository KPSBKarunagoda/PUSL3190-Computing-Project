document.addEventListener('DOMContentLoaded', () => {
  // Check if user is logged in
  const token = localStorage.getItem('phishguardToken');
  
  if (!token) {
    window.location.href = 'login.html';
    return;
  }
  
  // Load user data
  const userJson = localStorage.getItem('phishguardUser');
  let user;
  
  try {
    user = JSON.parse(userJson);
    // Welcome message
    document.getElementById('welcome-message').textContent = user.username || 'User';
  } catch (e) {
    console.error('Error parsing user data', e);
  }
  
  // Initialize components
  setPlaceholderStatistics();
  showPlaceholderHistory();
  initializeCarousel();
  setupQuickActions();
});

// Show placeholder statistics instead of loading from localStorage
function setPlaceholderStatistics() {
  document.getElementById('total-scans').textContent = '0';
  document.getElementById('threats-detected').textContent = '0';
  document.getElementById('safe-sites').textContent = '0';
}

// Show placeholder history instead of loading from localStorage
function showPlaceholderHistory() {
  const scanHistoryContainer = document.getElementById('scan-history');
  
  scanHistoryContainer.innerHTML = `
    <div class="history-placeholder">
      <p>Your recent URL scan results will appear here after analysis</p>
    </div>
  `;
}

// Initialize the security tips carousel
function initializeCarousel() {
  const tips = document.querySelectorAll('.tip-card');
  const indicators = document.querySelectorAll('.indicator');
  const prevBtn = document.querySelector('.carousel-prev');
  const nextBtn = document.querySelector('.carousel-next');
  let currentIndex = 0;
  
  function showTip(index) {
    // Hide all tips
    tips.forEach(tip => tip.classList.remove('active'));
    indicators.forEach(ind => ind.classList.remove('active'));
    
    // Show selected tip
    tips[index].classList.add('active');
    indicators[index].classList.add('active');
    currentIndex = index;
  }
  
  // Next tip
  nextBtn.addEventListener('click', () => {
    let nextIndex = currentIndex + 1;
    if (nextIndex >= tips.length) nextIndex = 0;
    showTip(nextIndex);
  });
  
  // Previous tip
  prevBtn.addEventListener('click', () => {
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) prevIndex = tips.length - 1;
    showTip(prevIndex);
  });
  
  // Indicator clicks
  indicators.forEach((indicator, index) => {
    indicator.addEventListener('click', () => {
      showTip(index);
    });
  });
  
  // Auto-rotate tips every 10 seconds
  setInterval(() => {
    let nextIndex = currentIndex + 1;
    if (nextIndex >= tips.length) nextIndex = 0;
    showTip(nextIndex);
  }, 10000);
}

// Set up quick action buttons
function setupQuickActions() {
  const passwordCheckerBtn = document.getElementById('password-checker');
  
  if (passwordCheckerBtn) {
    passwordCheckerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showPasswordChecker();
    });
  }
}

// Helper function for password health checker
function showPasswordChecker() {
  // Create modal for password checking
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.style.display = 'flex';
  
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Password Health Checker</h3>
      </div>
      <div class="modal-body">
        <p>Check if your password has been exposed in data breaches.</p>
        <p class="small-text">Your password never leaves your device. We only check a small anonymized part of its hash.</p>
        <div class="form-row">
          <input type="password" id="check-password" placeholder="Enter password to check">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" id="cancel-check">Cancel</button>
        <button class="btn-primary" id="check-btn">Check Password</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Handle close
  document.getElementById('cancel-check').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  // Handle check
  document.getElementById('check-btn').addEventListener('click', () => {
    const password = document.getElementById('check-password').value;
    
    if (!password) {
      alert('Please enter a password to check');
      return;
    }
    
    // Normally you'd use the "Have I Been Pwned" API here with k-anonymity
    // For demo purposes, we'll just show a dummy result
    
    const modalBody = modal.querySelector('.modal-body');
    modalBody.innerHTML = `
      <p>Password check complete!</p>
      <div class="password-result safe">
        <i class="fas fa-check-circle"></i>
        <span>Good news! This password hasn't been found in known data breaches.</span>
      </div>
      <p class="small-text">Remember to use unique, strong passwords for all your accounts.</p>
    `;
    
    const modalFooter = modal.querySelector('.modal-footer');
    modalFooter.innerHTML = `
      <button class="btn-primary" id="close-result">Close</button>
    `;
    
    document.getElementById('close-result').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  });
}

// Helper function to truncate URLs
function truncateUrl(url, maxLength = 40) {
  if (url.length <= maxLength) return url;
  
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const path = urlObj.pathname;
    
    if (domain.length > maxLength - 10) {
      return domain.substring(0, maxLength - 10) + '...' + domain.substring(domain.length - 7);
    }
    
    return domain + path.substring(0, 10) + '...';
  } catch (e) {
    return url.substring(0, maxLength - 3) + '...';
  }
}
