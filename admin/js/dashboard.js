/**
 * PhishGuard Admin Dashboard Controller
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Make sure Auth is defined - add fallback if not
    if (typeof Auth === 'undefined') {
      console.warn('Auth object not found, creating fallback');
      
      // Create fallback Auth object
      window.Auth = {
        isAuthenticated() {
          return !!localStorage.getItem('phishguard_admin_token');
        },
        getUser() {
          try {
            const adminJson = localStorage.getItem('phishguard_admin');
            return adminJson ? JSON.parse(adminJson) : null;
          } catch (e) {
            return null;
          }
        },
        logout() {
          localStorage.removeItem('phishguard_admin_token');
          localStorage.removeItem('phishguard_admin');
          window.location.href = 'index.html?action=logout';
        }
      };
    }
    
    // Verify authentication
    if (!Auth.isAuthenticated()) {
      console.log('Not authenticated, redirecting to login page');
      window.location.href = 'index.html';
      return;
    }
    
    // Get admin info
    const admin = Auth.getUser();
    if (admin) {
      // Update UI with admin name
      const usernameElement = document.getElementById('admin-username');
      if (usernameElement) {
        usernameElement.textContent = admin.username || 'Admin';
      }
    }
    
    // Initialize dashboard components
    initSidebarToggle();
    await loadSystemStats();
    
    // Add additional initializations here
  } catch (error) {
    console.error('Dashboard initialization error:', error);
    
    // Try to continue with basic functionality even if there's an error
    initSidebarToggle();
    try {
      await loadSystemStats();
    } catch (e) {
      console.error('Failed to load statistics:', e);
    }
  }
});

function initSidebarToggle() {
  const toggleBtn = document.getElementById('sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      document.querySelector('main').classList.toggle('expanded');
    });
  }
}

async function loadSystemStats() {
  try {
    // Find all stat value elements
    const statElements = document.querySelectorAll('.stat-card .stat-value');
    
    // Show loading spinners
    statElements.forEach(element => {
      element.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    });
    
    // Fetch stats from API
    const stats = await dashboardAPI.getStats();
    console.log('Dashboard stats loaded:', stats);
    
    // Map stat type to data key
    const statKeyMap = {
      'users': 'usersCount',
      'whitelist': 'whitelistCount',
      'blacklist': 'blacklistCount',
      'scans': 'totalScans'
    };
    
    // Update each stat element based on its data attribute or id
    statElements.forEach(element => {
      // Try to determine which stat this element represents
      let statType = null;
      
      // Try getting stat type from data attribute
      if (element.dataset.statType) {
        statType = element.dataset.statType;
      }
      // Try getting from parent card's id
      else if (element.closest('.stat-card') && element.closest('.stat-card').id) {
        const cardId = element.closest('.stat-card').id;
        Object.keys(statKeyMap).forEach(key => {
          if (cardId.includes(key)) {
            statType = key;
          }
        });
      }
      // Try getting from the element's ID
      else if (element.id) {
        Object.keys(statKeyMap).forEach(key => {
          if (element.id.includes(key)) {
            statType = key;
          }
        });
      }
      
      // Update element if we found its type and corresponding data exists
      if (statType && statKeyMap[statType] && stats[statKeyMap[statType]] !== undefined) {
        element.textContent = stats[statKeyMap[statType]].toLocaleString();
      } else {
        element.textContent = '0';
      }
    });
    
    console.log('UI updated with stats');
  } catch (error) {
    console.error('Error loading system statistics:', error);
    
    // Show error in stats containers
    const statElements = document.querySelectorAll('.stat-card .stat-value');
    statElements.forEach(element => {
      element.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error';
    });
  }
}

// Add event listener for logout button (as a backup to the common.js handler)
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Use direct logout implementation as fallback
      localStorage.removeItem('phishguard_admin_token');
      localStorage.removeItem('phishguard_admin');
      window.location.href = 'index.html?action=logout';
    });
  }
});
