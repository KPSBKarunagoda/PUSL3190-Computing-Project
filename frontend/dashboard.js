document.addEventListener('DOMContentLoaded', () => {
  // CHECKED: Already using correct user token keys
  // Check if user is logged in - USING USER-SPECIFIC TOKEN
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
    
    // ADDED: Ensure user is not an admin on the regular dashboard
    if (user && user.role === 'Admin') {
      console.warn('Admin user detected on regular dashboard');
      // Redirect to admin dashboard if needed
      // window.location.href = '/admin/dashboard.html';
      // return;
    }
    
    // Welcome message
    document.getElementById('welcome-message').textContent = user.username || 'User';
  } catch (e) {
    console.error('Error parsing user data', e);
  }
  
  // Initialize components
  setPlaceholderStatistics();
  showPlaceholderHistory();
  initializeCarousel();
  // We removed the setupQuickActions() since we now use direct links
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
