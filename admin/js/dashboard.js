// Function to load dashboard data
async function loadDashboardData() {
  try {
    // Load whitelist
    const whitelist = await getWhitelist();
    displayList(whitelist, 'whitelist', removeFromWhitelist);
    
    // Load blacklist
    const blacklist = await getBlacklist();
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
        displayList(newList, listId, removeCallback);
      } catch (err) {
        alert(`Failed to remove domain: ${err.message}`);
      }
    });
    
    listItem.appendChild(removeButton);
    listElement.appendChild(listItem);
  });
}

// Set up event listeners for adding domains
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
});