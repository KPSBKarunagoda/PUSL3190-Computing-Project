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
  loadUserStatistics();
  loadScanHistory();
  initializeCarousel();
  initializeSecurityScore();
});

// Load user statistics from API or use placeholders
async function loadUserStatistics() {
  const statCards = document.querySelectorAll('.stat-card');
  
  try {
    // Try to fetch actual statistics from API
    const token = localStorage.getItem('phishguardToken');
    const response = await fetch('http://localhost:3000/api/user/stats', {
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Update statistics with animation
      animateStatChange('total-scans', 0, data.totalScans || 0);
      animateStatChange('threats-detected', 0, data.threatsDetected || 0);
      animateStatChange('safe-sites', 0, data.safeSites || 0);
      
      // Mark task as completed if user has analyzed any URLs
      if (data.totalScans && data.totalScans > 0) {
        localStorage.setItem('completed_url_analysis', 'true');
        updateSecurityChecklistItem('urlAnalysis', true);
      }
    } else {
      // Fall back to placeholders if API fails
      setPlaceholderStatistics();
    }
  } catch (error) {
    console.error('Error loading statistics:', error);
    setPlaceholderStatistics();
  }
  
  // Add loaded class to show animation
  setTimeout(() => {
    statCards.forEach(card => card.classList.add('stat-loaded'));
  }, 200);
}

// Animate statistic value change
function animateStatChange(elementId, from, to) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  // Don't animate if the value is 0
  if (to === 0) {
    element.textContent = '0';
    return;
  }
  
  let current = from;
  const duration = 1500; // Animation duration in ms
  const interval = 20; // Update interval in ms
  const steps = duration / interval;
  const increment = (to - from) / steps;
  
  const timer = setInterval(() => {
    current += increment;
    if ((increment > 0 && current >= to) || (increment < 0 && current <= to)) {
      current = to;
      clearInterval(timer);
    }
    
    element.textContent = Math.round(current);
  }, interval);
}

// Show placeholder statistics instead of loading from localStorage
function setPlaceholderStatistics() {
  document.getElementById('total-scans').textContent = '0';
  document.getElementById('threats-detected').textContent = '0';
  document.getElementById('safe-sites').textContent = '0';
}

// Load scan history or show placeholder
async function loadScanHistory() {
  const scanHistoryContainer = document.getElementById('scan-history');
  if (!scanHistoryContainer) return;
  
  try {
    // Try to fetch actual scan history from API
    const token = localStorage.getItem('phishguardToken');
    const response = await fetch('http://localhost:3000/api/scans/recent', {
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      }
    });
    
    if (response.ok) {
      const scanData = await response.json();
      
      if (scanData && scanData.length > 0) {
        // We have scan data, display it
        scanHistoryContainer.innerHTML = '';
        
        scanData.forEach(scan => {
          // Determine status class based on result
          let statusClass = 'result-safe';
          if (scan.is_phishing) {
            statusClass = 'result-danger';
          } else if (scan.risk_score > 30) {
            statusClass = 'result-warning';
          }
          
          // Create history item
          const historyItem = document.createElement('div');
          historyItem.className = 'history-item';
          historyItem.innerHTML = `
            <div class="history-url" title="${escapeHtml(scan.url)}">${truncateUrl(scan.url)}</div>
            <div class="history-result ${statusClass}">${getStatusText(scan)}</div>
          `;
          
          scanHistoryContainer.appendChild(historyItem);
        });
        
        return;
      }
    }
    
    // If we get here, either API failed or returned no data
    showPlaceholderHistory();
    
  } catch (error) {
    console.error('Error loading scan history:', error);
    showPlaceholderHistory();
  }
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

// Initialize security score widget
function initializeSecurityScore() {
  const scoreElement = document.getElementById('security-score');
  const scoreProgress = document.getElementById('score-progress');
  if (!scoreElement || !scoreProgress) return;
  
  // Check for completed security tasks
  const completed = {
    passwordCheck: localStorage.getItem('completed_password_check') === 'true',
    urlAnalysis: localStorage.getItem('completed_url_analysis') === 'true',
    emailAnalysis: localStorage.getItem('completed_email_analysis') === 'true',
    education: localStorage.getItem('completed_education') === 'true'
  };
  
  // Calculate current score based on completed tasks
  const totalTasks = 4; // Updated to include email analysis
  let completedTasks = 0;
  
  if (completed.passwordCheck) completedTasks++;
  if (completed.urlAnalysis) completedTasks++;
  if (completed.emailAnalysis) completedTasks++;
  if (completed.education) completedTasks++;
  
  const score = Math.floor((completedTasks / totalTasks) * 100);
  
  // Update security checklist display
  updateSecurityChecklist(completed);
  
  // Animate score change
  animateSecurityScore(0, score);
  
  // Add click events to checklist items for easy navigation
  setupChecklistNavigation();
}

// Update security checklist based on completed tasks
function updateSecurityChecklist(completed) {
  const checklist = document.getElementById('security-checklist');
  if (!checklist) return;
  
  const items = checklist.querySelectorAll('.score-item');
  
  // Password health check
  updateChecklistItem(items[0], completed.passwordCheck);
  
  // URL analysis
  updateChecklistItem(items[1], completed.urlAnalysis);
  
  // Email analysis (new)
  updateChecklistItem(items[2], completed.emailAnalysis);
  
  // Security education
  updateChecklistItem(items[3], completed.education);
}

// Update individual checklist item
function updateChecklistItem(item, completed) {
  if (!item) return;
  
  const icon = item.querySelector('.score-item-icon');
  const status = item.querySelector('.score-item-status');
  
  if (completed) {
    icon.className = 'score-item-icon score-item-complete';
    status.textContent = 'Completed';
  } else {
    icon.className = 'score-item-icon score-item-incomplete';
    status.textContent = 'Pending';
  }
}

// Update specific checklist item by key
function updateSecurityChecklistItem(key, completed) {
  const checklist = document.getElementById('security-checklist');
  if (!checklist) return;
  
  const items = checklist.querySelectorAll('.score-item');
  let targetItem;
  
  switch(key) {
    case 'passwordCheck':
      targetItem = items[0];
      break;
    case 'urlAnalysis':
      targetItem = items[1];
      break;
    case 'emailAnalysis':
      targetItem = items[2];
      break;
    case 'education':
      targetItem = items[3];
      break;
  }
  
  if (targetItem) {
    updateChecklistItem(targetItem, completed);
    
    // Recalculate and update security score
    const completed = {
      passwordCheck: localStorage.getItem('completed_password_check') === 'true',
      urlAnalysis: localStorage.getItem('completed_url_analysis') === 'true',
      emailAnalysis: localStorage.getItem('completed_email_analysis') === 'true',
      education: localStorage.getItem('completed_education') === 'true'
    };
    
    const totalTasks = 4; // Updated to include email analysis
    let completedTasks = 0;
    
    if (completed.passwordCheck) completedTasks++;
    if (completed.urlAnalysis) completedTasks++;
    if (completed.emailAnalysis) completedTasks++; // Add this line
    if (completed.education) completedTasks++;
    
    const newScore = Math.floor((completedTasks / totalTasks) * 100);
    
    // Get current score from display
    const scoreElement = document.getElementById('security-score');
    let currentScore = 0;
    if (scoreElement) {
      currentScore = parseInt(scoreElement.textContent) || 0;
    }
    
    animateSecurityScore(currentScore, newScore);
  }
}

// Animate security score change
function animateSecurityScore(from, to) {
  const scoreElement = document.getElementById('security-score');
  const scoreProgress = document.getElementById('score-progress');
  if (!scoreElement || !scoreProgress) return;
  
  let current = from;
  const duration = 1500; // Animation duration in ms
  const interval = 20; // Update interval in ms
  const steps = duration / interval;
  const increment = (to - from) / steps;
  
  // Animate score number
  const timer = setInterval(() => {
    current += increment;
    if ((increment > 0 && current >= to) || (increment < 0 && current <= to)) {
      current = to;
      clearInterval(timer);
    }
    
    scoreElement.textContent = Math.round(current) + '%';
    
    // Animate circle progress
    const angle = 3.6 * Math.round(current); // 3.6 degrees per percentage
    scoreProgress.style.transform = `rotate(${angle}deg)`;
    
    // Change color based on score
    if (current < 30) {
      scoreProgress.style.borderTopColor = '#f44336';
      scoreProgress.style.borderRightColor = '#f44336';
      scoreElement.style.color = '#f44336';
    } else if (current < 70) {
      scoreProgress.style.borderTopColor = '#ff9800';
      scoreProgress.style.borderRightColor = '#ff9800';
      scoreElement.style.color = '#ff9800';
    } else {
      scoreProgress.style.borderTopColor = '#4caf50';
      scoreProgress.style.borderRightColor = '#4caf50';
      scoreElement.style.color = '#4caf50';
    }
  }, interval);
}

// Setup security checklist item navigation
function setupChecklistNavigation() {
  const checklist = document.getElementById('security-checklist');
  if (!checklist) return;
  
  const items = checklist.querySelectorAll('.score-item');
  
  // Password health check
  items[0].addEventListener('click', () => {
    window.location.href = 'password-health.html';
  });
  
  // URL analysis
  items[1].addEventListener('click', () => {
    window.location.href = 'analyze.html';
  });
  
  // Email analysis (new)
  items[2].addEventListener('click', () => {
    window.location.href = 'email-analysis.html';
  });
  
  // Security education
  items[3].addEventListener('click', () => {
    window.location.href = 'education.html';
    // Mark as completed when the user visits the education page
    localStorage.setItem('completed_education', 'true');
  });
}

// Helper function to get status text
function getStatusText(scan) {
  if (scan.is_phishing) {
    return 'Phishing';
  } else if (scan.risk_score > 60) {
    return 'High Risk';
  } else if (scan.risk_score > 30) {
    return 'Suspicious';
  } else {
    return 'Safe';
  }
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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