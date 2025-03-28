// Function to load dashboard data
async function loadDashboardData() {
  try {
    // Load whitelist
    const whitelist = await getWhitelist();
    originalWhitelist = whitelist;
    displayList(whitelist, 'whitelist', removeFromWhitelist);
    
    // Load blacklist
    const blacklist = await getBlacklist();
    originalBlacklist = blacklist;
    displayList(blacklist, 'blacklist', removeFromBlacklist);
  } catch (err) {
    console.error('Error loading dashboard data:', err);
    if (err.message.includes('Token')) {
      // Handle expired token
      removeToken();
      window.location.reload();
    } else {
      alert(`Error loading data: ${err.message}`);
    }
  }
}

// Original data storage
let originalWhitelist = [];
let originalBlacklist = [];

// Function to display a list (whitelist or blacklist)
function displayList(list, listId, removeCallback) {
  const listElement = document.getElementById(listId);
  listElement.innerHTML = '';
  
  if (list.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.textContent = 'No domains in this list';
    emptyItem.className = 'empty-list';
    listElement.appendChild(emptyItem);
    return;
  }
  
  list.forEach(domain => {
    const listItem = document.createElement('li');
    listItem.dataset.domain = domain.toLowerCase();
    
    const domainText = document.createElement('span');
    domainText.textContent = domain;
    listItem.appendChild(domainText);
    
    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.className = 'remove-btn';
    removeButton.addEventListener('click', async () => {
      try {
        await removeCallback(domain);
        // Reload the list
        const newList = listId === 'whitelist' ? await getWhitelist() : await getBlacklist();
        
        // Update the original data
        if (listId === 'whitelist') {
          originalWhitelist = newList;
        } else {
          originalBlacklist = newList;
        }
        
        displayList(newList, listId, removeCallback);
      } catch (err) {
        alert(`Failed to remove domain: ${err.message}`);
      }
    });
    
    listItem.appendChild(removeButton);
    listElement.appendChild(listItem);
  });
}

// Function to filter lists based on search input
function filterList(listId, searchText) {
  const listElement = document.getElementById(listId);
  const listItems = listElement.querySelectorAll('li');
  let visibleCount = 0;
  
  // If no items or only the empty/loading item
  if (listItems.length <= 1 && listItems[0].classList.contains('empty-list') || 
      listItems[0].classList.contains('loading')) {
    return;
  }
  
  // Remove any existing "no results" message
  const existingNoResults = listElement.querySelector('.no-results');
  if (existingNoResults) {
    existingNoResults.remove();
  }
  
  // Filter the items
  listItems.forEach(item => {
    if (!item.dataset.domain) return; // Skip items without domain data
    
    const domain = item.dataset.domain;
    if (searchText === '' || domain.includes(searchText.toLowerCase())) {
      item.style.display = '';
      visibleCount++;
    } else {
      item.style.display = 'none';
    }
  });
  
  // Show "no results" message if needed
  if (visibleCount === 0 && searchText !== '') {
    const noResults = document.createElement('li');
    noResults.textContent = `No domains matching "${searchText}"`;
    noResults.className = 'no-results';
    listElement.appendChild(noResults);
  }
}

// Set up event listeners for adding domains and searching
document.addEventListener('DOMContentLoaded', () => {
  // Add to whitelist
  document.getElementById('add-whitelist').addEventListener('click', async () => {
    const domainInput = document.getElementById('whitelist-domain');
    const domain = domainInput.value.trim();
    
    if (!domain) {
      alert('Please enter a domain');
      return;
    }
    
    try {
      await addToWhitelist(domain);
      domainInput.value = '';
      // Reload whitelist
      const whitelist = await getWhitelist();
      originalWhitelist = whitelist;
      displayList(whitelist, 'whitelist', removeFromWhitelist);
    } catch (err) {
      alert(`Failed to add domain: ${err.message}`);
    }
  });
  
  // Add to blacklist
  document.getElementById('add-blacklist').addEventListener('click', async () => {
    const domainInput = document.getElementById('blacklist-domain');
    const domain = domainInput.value.trim();
    
    if (!domain) {
      alert('Please enter a domain');
      return;
    }
    
    try {
      await addToBlacklist(domain);
      domainInput.value = '';
      // Reload blacklist
      const blacklist = await getBlacklist();
      originalBlacklist = blacklist;
      displayList(blacklist, 'blacklist', removeFromBlacklist);
    } catch (err) {
      alert(`Failed to add domain: ${err.message}`);
    }
  });
  
  // Add enter key support
  document.getElementById('whitelist-domain').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('add-whitelist').click();
    }
  });
  
  document.getElementById('blacklist-domain').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('add-blacklist').click();
    }
  });

  // Initial load of data
  loadDashboardData().then(() => {
    // Store original data
    getWhitelist().then(whitelist => {
      originalWhitelist = whitelist;
    });
    
    getBlacklist().then(blacklist => {
      originalBlacklist = blacklist;
    });
  });

  // Search functionality for whitelist
  const whitelistSearch = document.getElementById('whitelist-search');
  const whitelistSearchBtn = whitelistSearch.nextElementSibling;
  
  whitelistSearch.addEventListener('input', () => {
    filterList('whitelist', whitelistSearch.value);
  });
  
  whitelistSearchBtn.addEventListener('click', () => {
    filterList('whitelist', whitelistSearch.value);
  });
  
  // Search functionality for blacklist
  const blacklistSearch = document.getElementById('blacklist-search');
  const blacklistSearchBtn = blacklistSearch.nextElementSibling;
  
  blacklistSearch.addEventListener('input', () => {
    filterList('blacklist', blacklistSearch.value);
  });
  
  blacklistSearchBtn.addEventListener('click', () => {
    filterList('blacklist', blacklistSearch.value);
  });
  
  // Search toggle functionality
  setupSearchToggle('whitelist');
  setupSearchToggle('blacklist');
  
  // Search input event listeners
  setupSearchInput('whitelist');
  setupSearchInput('blacklist');
  
  // Clear search when pressing Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (document.activeElement === whitelistSearch) {
        whitelistSearch.value = '';
        filterList('whitelist', '');
      } else if (document.activeElement === blacklistSearch) {
        blacklistSearch.value = '';
        filterList('blacklist', '');
      }
    }
  });
  
  // Add enter key support for search boxes
  whitelistSearch.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      filterList('whitelist', whitelistSearch.value);
    }
  });
  
  blacklistSearch.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      filterList('blacklist', blacklistSearch.value);
    }
  });
});

// Function to setup search toggle behavior
function setupSearchToggle(listId) {
  const toggleBtn = document.getElementById(`${listId}-search-toggle`);
  const searchContainer = document.getElementById(`${listId}-search-container`);
  const searchInput = document.getElementById(`${listId}-search`);
  
  toggleBtn.addEventListener('click', () => {
    // Toggle active state on button
    toggleBtn.classList.toggle('active');
    
    // Toggle search container visibility
    searchContainer.classList.toggle('hidden');
    
    // Focus on input when opening
    if (!searchContainer.classList.contains('hidden')) {
      searchInput.focus();
    } else {
      // Clear search when hiding
      searchInput.value = '';
      filterList(listId, '');
    }
  });
  
  // Add event listener to clear button
  const clearBtn = searchContainer.querySelector('.search-clear');
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    filterList(listId, '');
    searchInput.focus();
  });
}

// Function to setup search input behavior
function setupSearchInput(listId) {
  const searchInput = document.getElementById(`${listId}-search`);
  
  // Real-time filtering as user types
  searchInput.addEventListener('input', () => {
    filterList(listId, searchInput.value);
  });
  
  // Enter key handling
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      filterList(listId, searchInput.value);
    }
  });
  
  // Escape key handling for search box
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // If search box is empty, close it
      if (searchInput.value === '') {
        document.getElementById(`${listId}-search-toggle`).click();
      } else {
        // Otherwise just clear the search
        searchInput.value = '';
        filterList(listId, '');
      }
      e.preventDefault();
    }
  });
}