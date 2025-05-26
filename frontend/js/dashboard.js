/**
 * PhishGuard User Dashboard Controller - Manages user dashboard statistics, activity history, timeframe filtering and security metrics visualization.
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('Dashboard.js loaded and running');
  
  
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
  initializeCarousel();
  initializeSecurityScore();
  
  // Initialize clear history button
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', clearUserActivity);
  }
  
  // Initialize current timeframe
  let currentTimeframe = 'month'; // Default to month view
  
  console.log('Setting up timeframe filters with default:', currentTimeframe);
  
  // Update the timeframe indicator with initial value
  updateTimeframeIndicator(currentTimeframe);
  
  // Set up filter button click handlers 
  setupFilterButtons(currentTimeframe);
  
  // Initialize activity and stats with default timeframe
  loadUserActivity(currentTimeframe);
  loadUserStatistics(currentTimeframe);
});

// function to centralize filter button setup
function setupFilterButtons(defaultTimeframe) {
  console.log('Setting up filter buttons with default timeframe:', defaultTimeframe);
  const filterButtons = document.querySelectorAll('.filter-btn');
  
  if (filterButtons.length === 0) {
    console.warn('No filter buttons found on page');
    return;
  }
  
  console.log('Found', filterButtons.length, 'filter buttons');
  
  // First remove existing button handlers by cloning and replacing
  filterButtons.forEach(button => {
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
  });
  
  // Make sure the correct button is active initially
  const freshButtons = document.querySelectorAll('.filter-btn');
  freshButtons.forEach(button => {
    const buttonTimeframe = button.getAttribute('data-timeframe');
    console.log('Setting up button for timeframe:', buttonTimeframe);
    
    // Mark the default timeframe button as active
    if (buttonTimeframe === defaultTimeframe) {
      button.classList.add('active');
      console.log('Marked button as active:', buttonTimeframe);
    } else {
      button.classList.remove('active');
    }
    
    // Add click event listener
    button.addEventListener('click', function() {
      console.log('Filter button clicked for timeframe:', buttonTimeframe);
      
      // Update active states
      freshButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      
      // Set current timeframe and update indicators
      const timeframe = buttonTimeframe;
      updateTimeframeIndicator(timeframe);
      
      // Load data for selected timeframe
      loadUserActivity(timeframe);
      loadUserStatistics(timeframe);
    });
  });
}

// function to update the timeframe indicator text
function updateTimeframeIndicator(timeframe) {
  console.log('Updating timeframe indicator to:', timeframe);
  const timeframeIndicator = document.getElementById('stats-timeframe');
  
  if (!timeframeIndicator) {
    console.error('stats-timeframe element not found!');
    return;
  }
  
  // Set loading state first
  timeframeIndicator.textContent = 'Loading...';
  
  // Update with proper timeframe text
  switch(timeframe) {
    case 'day':
      timeframeIndicator.textContent = 'Daily Stats';
      break;
    case 'week':
      timeframeIndicator.textContent = 'Weekly Stats';
      break;
    case 'month':
      timeframeIndicator.textContent = 'Monthly Stats';
      break;
    case 'all':
      timeframeIndicator.textContent = 'All-Time Stats';
      break;
    default:
      timeframeIndicator.textContent = 'Monthly Stats';
  }
  
  console.log('Timeframe indicator updated to:', timeframeIndicator.textContent);
}

// Load user statistics from API with timeframe parameter
async function loadUserStatistics(timeframe = 'month') {
  console.log('Loading user statistics for timeframe:', timeframe);
  try {
    const token = localStorage.getItem('phishguardToken');
    if (!token) {
      console.error('No auth token found');
      setPlaceholderStatistics();
      return;
    }
    
    // API call with explicit timeframe parameter
    const response = await fetch(`http://localhost:3000/api/user/stats?timeframe=${timeframe}`, {
      headers: {
        'x-auth-token': token
      }
    });
    
    if (!response.ok) {
      console.error('Failed to load statistics:', response.status, response.statusText);
      setPlaceholderStatistics();
      return;
    }
    
    const data = await response.json();
    console.log('Statistics loaded successfully:', data);
    
    // Get previous values for animation
    const previousTotalScans = parseInt(document.getElementById('total-scans').textContent) || 0;
    const previousThreatsDetected = parseInt(document.getElementById('threats-detected').textContent) || 0;
    const previousSafeSites = parseInt(document.getElementById('safe-sites').textContent) || 0;
    
    // Animate the changes
    animateStatChange('total-scans', previousTotalScans, data.totalScans || 0);
    animateStatChange('threats-detected', previousThreatsDetected, data.threatsDetected || 0);
    animateStatChange('safe-sites', previousSafeSites, data.safeSites || 0);
    
    // Add stat-loaded class to trigger animations
    setTimeout(() => {
      document.querySelectorAll('.stat-card').forEach(card => {
        card.classList.add('stat-loaded');
      });
    }, 100);
  } catch (error) {
    console.error('Error loading user statistics:', error);
    setPlaceholderStatistics();
    
    // Ensure timeframe indicator is updated even on error
    updateTimeframeIndicator(timeframe);
  }
}

// Load user activity data
async function loadUserActivity(timeframe = 'month') {
  console.log('Loading user activity for timeframe:', timeframe);
  const activityContainer = document.getElementById('scan-history');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  
  if (!activityContainer) {
    console.error('Scan history container not found!');
    return;
  }
  
  // Initially hide the clear button until we know there's activity
  if (clearHistoryBtn) {
    clearHistoryBtn.style.display = 'none';
  }
  
  try {
    // Show loading state
    activityContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading activity...</div>';
    
    const token = localStorage.getItem('phishguardToken');
    if (!token) {
      activityContainer.innerHTML = '<p class="no-data">Please log in to view your activity</p>';
      return;
    }
    
    // Make the API call with timeframe parameter
    const response = await fetch(`http://localhost:3000/api/user/activity?timeframe=${timeframe}`, {
      headers: {
        'x-auth-token': token
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const activities = await response.json();
    console.log(`Received ${activities.length} activities for timeframe: ${timeframe}`);
    
    if (!activities || activities.length === 0) {
      // Show appropriate message based on timeframe
      let message = 'No activity found.';
      switch(timeframe) {
        case 'day':
          message = 'No activity found for today.';
          break;
        case 'week':
          message = 'No activity found for this week.';
          break;
        case 'month':
          message = 'No activity found for this month.';
          break;
        case 'all':
          message = 'No activity found. Start analyzing URLs to build your history.';
          break;
      }
      
      activityContainer.innerHTML = `<p class="no-data">${message}</p>`;
      return;
    }
    
    // Clear container and add each activity
    activityContainer.innerHTML = '';
    
    activities.forEach(activity => {
      // Format date to a more readable format
      const date = new Date(activity.Timestamp);
      const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Determine risk level badge class
      let badgeClass = 'status-safe';
      if (activity.Risk >= 70) {
        badgeClass = 'status-danger';
      } else if (activity.Risk >= 40) {
        badgeClass = 'status-warning';
      }
      
      // Create activity item HTML
      const activityItem = document.createElement('div');
      activityItem.className = 'history-item';
      activityItem.innerHTML = `
        <div>
          <div class="history-title">${activity.Title}</div>
          <div class="history-time">${formattedDate}</div>
        </div>
        <div class="status-badge ${badgeClass}">
          ${activity.Risk < 40 ? 'Safe' : activity.Risk >= 70 ? 'High Risk' : 'Medium Risk'}
        </div>
      `;
      
      activityContainer.appendChild(activityItem);
    });
    
    // Show the clear history button if we have activity
    if (clearHistoryBtn) {
      clearHistoryBtn.style.display = 'flex';
    }
    
  } catch (error) {
    console.error('Error loading activity:', error);
    activityContainer.innerHTML = `
      <div class="error">
        <i class="fas fa-exclamation-circle"></i>
        Error loading activity. Please try again later.
      </div>
    `;
  }
}

// Show placeholder statistics instead of loading from localStorage
function setPlaceholderStatistics() {
  document.getElementById('total-scans').textContent = '0';
  document.getElementById('threats-detected').textContent = '0';
  document.getElementById('safe-sites').textContent = '0';
}

// Function to clear user activity
async function clearUserActivity() {
  const confirmed = confirm('Are you sure you want to clear all your activity history? This action cannot be undone.');
  if (!confirmed) return;
  
  try {
    const token = localStorage.getItem('phishguardToken');
    if (!token) return;
    
    const response = await fetch('http://localhost:3000/api/user/activity', {
      method: 'DELETE',
      headers: {
        'x-auth-token': token
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to clear activity history');
    }
    
    // Reload current activity view with current timeframe
    const activeButton = document.querySelector('.filter-btn.active');
    const currentTimeframe = activeButton ? activeButton.getAttribute('data-timeframe') : 'month';
    
    // Reload both activity and statistics
    loadUserActivity(currentTimeframe);
    loadUserStatistics(currentTimeframe);
    
    alert('Activity history has been cleared successfully.');
  } catch (error) {
    console.error('Error clearing activity history:', error);
    alert('Failed to clear activity history. Please try again later.');
  }
}

// Initialize security score features (in case they're needed)
function initializeSecurityScore() {
  // This function is kept empty as it's handled in the HTML inline script
  // left completeness and in case we want to move the code here later
}

// Initialize carousel if it exists on the page
function initializeCarousel() {
  const carousel = document.querySelector('.security-tips-carousel');
  if (!carousel) return;
  
  const cards = carousel.querySelectorAll('.tip-card');
  const indicators = carousel.querySelectorAll('.carousel-indicators .indicator');
  const prevBtn = carousel.querySelector('.carousel-prev');
  const nextBtn = carousel.querySelector('.carousel-next');
  
  let currentIndex = 0;
  
  function showCard(index) {
    cards.forEach(card => card.classList.remove('active'));
    indicators.forEach(indicator => indicator.classList.remove('active'));
    
    cards[index].classList.add('active');
    indicators[index].classList.add('active');
    currentIndex = index;
  }
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      let prevIndex = currentIndex - 1;
      if (prevIndex < 0) prevIndex = cards.length - 1;
      showCard(prevIndex);
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      let nextIndex = currentIndex + 1;
      if (nextIndex >= cards.length) nextIndex = 0;
      showCard(nextIndex);
    });
  }
  
  indicators.forEach((indicator, index) => {
    indicator.addEventListener('click', () => {
      showCard(index);
    });
  });
  
  // Auto-advance every 8 seconds
  setInterval(() => {
    let nextIndex = currentIndex + 1;
    if (nextIndex >= cards.length) nextIndex = 0;
    showCard(nextIndex);
  }, 8000);
}

// Simple stat value change animation
function animateStatChange(elementId, from, to) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  // Skip animation for small or zero values
  if (from === to || (from === 0 && to < 10)) {
    element.textContent = to;
    return;
  }
  
  const duration = 1000; // ms
  const frameRate = 60;
  const frames = duration / 1000 * frameRate;
  const increment = (to - from) / frames;
  let current = from;
  let frame = 0;
  
  const animate = () => {
    current += increment;
    frame++;
    
    if ((increment > 0 && current >= to) || 
        (increment < 0 && current <= to) || 
        frame >= frames) {
      element.textContent = to;
      return;
    }
    
    element.textContent = Math.round(current);
    requestAnimationFrame(animate);
  };
  
  animate();
}