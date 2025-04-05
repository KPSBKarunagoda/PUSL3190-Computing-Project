/**
 * PhishGuard Admin - Whitelist Management
 * Handles whitelist functionality
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Only initialize on whitelist page
  if (!window.location.pathname.includes('whitelist.html')) {
    return;
  }
  
  console.log('Initializing whitelist management...');
  
  // State for pagination
  const state = {
    page: 1,
    perPage: 10,
    totalItems: 0,
    searchQuery: '',
    items: []
  };
  
  // Initialize DOM elements
  const elements = {
    loader: DOM.get('whitelist-loader'),
    table: DOM.get('whitelist-table'),
    tableBody: DOM.get('whitelist-body'),
    emptyState: DOM.get('no-whitelist'),
    searchBox: DOM.get('whitelist-search'),
    refreshBtn: DOM.get('refresh-whitelist'),
    addForm: DOM.get('add-whitelist-form'),
    domainInput: DOM.get('domain-input'),
    prevButton: DOM.get('prev-page'),
    nextButton: DOM.get('next-page'),
    rangeInfo: DOM.get('whitelist-range'),
    totalInfo: DOM.get('whitelist-total'),
    exportButton: DOM.get('export-whitelist'),
    importFile: DOM.get('import-file'),
    modal: document.getElementById('confirmation-modal'),
    modalTitle: DOM.get('modal-title'),
    modalMessage: DOM.get('modal-message'),
    modalConfirm: DOM.get('modal-confirm'),
    modalCancel: DOM.get('modal-cancel'),
    modalClose: document.querySelector('.modal-close')
  };
  
  // Set up event handlers
  elements.refreshBtn?.addEventListener('click', () => loadWhitelist());
  elements.addForm?.addEventListener('submit', handleAddDomain);
  elements.prevButton?.addEventListener('click', () => changePage(-1));
  elements.nextButton?.addEventListener('click', () => changePage(1));
  elements.searchBox?.addEventListener('input', handleSearch);
  elements.exportButton?.addEventListener('click', exportWhitelist);
  elements.importFile?.addEventListener('change', importWhitelist);
  elements.modalClose?.addEventListener('click', () => closeModal());
  elements.modalCancel?.addEventListener('click', () => closeModal());
  
  // Load initial data
  try {
    await loadWhitelist();
  } catch (error) {
    console.error('Error initializing whitelist:', error);
    DOM.showAlert('Failed to load whitelist: ' + error.message, 'danger');
  }
  
  // Load whitelist data from API
  async function loadWhitelist() {
    showLoading(true);
    
    try {
      // Fetch whitelist
      const whitelist = await listsAPI.getWhitelist();
      console.log(`Loaded ${whitelist.length} whitelist entries`);
      
      // Store in state
      state.items = whitelist;
      state.totalItems = whitelist.length;
      state.page = 1; // Reset to first page
      
      // Update UI
      renderWhitelist();
      updatePagination();
    } catch (error) {
      console.error('Error loading whitelist:', error);
      showError('Failed to load whitelist data');
    } finally {
      showLoading(false);
    }
  }
  
  // Render whitelist to table
  function renderWhitelist() {
    if (!elements.tableBody) return;
    
    elements.tableBody.innerHTML = '';
    
    // Apply search filter if any
    let items = state.items;
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      items = items.filter(item => 
        (item.domain && item.domain.toLowerCase().includes(query)) || 
        (item.addedBy && item.addedBy.toLowerCase().includes(query))
      );
    }
    
    // If no items, show empty state
    if (items.length === 0) {
      showEmpty(true);
      return;
    }
    
    // Calculate pagination
    const startIndex = (state.page - 1) * state.perPage;
    const endIndex = Math.min(startIndex + state.perPage, items.length);
    const paginatedItems = items.slice(startIndex, endIndex);
    
    // Update pagination info
    if (elements.rangeInfo) {
      elements.rangeInfo.textContent = items.length > 0 
        ? `${startIndex + 1}-${endIndex}` 
        : '0-0';
    }
    
    if (elements.totalInfo) {
      elements.totalInfo.textContent = items.length;
    }
    
    // Create table rows
    paginatedItems.forEach(item => {
      const row = document.createElement('tr');
      
      const domain = item.domain || item.url || 'unknown';
      const addedBy = item.addedBy || 'System';
      const dateAdded = item.added || item.date || new Date();
      
      row.innerHTML = `
        <td title="${domain}">${Strings.truncate(domain, 30)}</td>
        <td>${addedBy}</td>
        <td>${DateTime.formatDate(dateAdded)}</td>
        <td class="actions">
          <button class="btn btn-sm btn-icon delete-domain" data-domain="${domain}" title="Remove from whitelist">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      
      // Add event listener to delete button
      const deleteBtn = row.querySelector('.delete-domain');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => confirmDeleteDomain(domain));
      }
      
      elements.tableBody.appendChild(row);
    });
    
    // Show table, hide empty state
    showEmpty(false);
  }
  
  // Add new domain to whitelist
  async function handleAddDomain(e) {
    e.preventDefault();
    
    const domain = elements.domainInput?.value.trim();
    if (!domain) {
      DOM.showAlert('Please enter a domain to add', 'warning');
      return;
    }
    
    // Basic domain validation
    if (!isValidDomain(domain)) {
      DOM.showAlert('Please enter a valid domain', 'warning');
      return;
    }
    
    try {
      // Show loading state
      const submitButton = elements.addForm.querySelector('button[type="submit"]');
      DOM.buttonState(submitButton, true);
      
      // Call API
      await listsAPI.addToWhitelist(domain);
      
      // Success
      DOM.showAlert(`Domain "${domain}" added to whitelist successfully`, 'success');
      
      // Clear input
      if (elements.domainInput) elements.domainInput.value = '';
      
      // Reload data
      await loadWhitelist();
    } catch (error) {
      console.error('Error adding to whitelist:', error);
      DOM.showAlert('Failed to add domain: ' + error.message, 'danger');
    } finally {
      // Restore button
      const submitButton = elements.addForm.querySelector('button[type="submit"]');
      DOM.buttonState(submitButton, false);
    }
  }
  
  // Confirm domain deletion
  function confirmDeleteDomain(domain) {
    if (!elements.modal || !elements.modalMessage) return;
    
    // Set up modal
    elements.modalTitle.textContent = 'Confirm Removal';
    elements.modalMessage.textContent = `Are you sure you want to remove "${domain}" from the whitelist?`;
    
    // Set up confirm action
    elements.modalConfirm.onclick = () => {
      deleteDomain(domain);
      closeModal();
    };
    
    // Show modal
    elements.modal.classList.add('show');
  }
  
  // Delete domain from whitelist
  async function deleteDomain(domain) {
    try {
      await listsAPI.removeFromWhitelist(domain);
      
      // Success
      DOM.showAlert(`Domain "${domain}" removed from whitelist`, 'success');
      
      // Reload data
      await loadWhitelist();
    } catch (error) {
      console.error('Error removing from whitelist:', error);
      DOM.showAlert('Failed to remove domain: ' + error.message, 'danger');
    }
  }
  
  // Handle search input
  function handleSearch(e) {
    state.searchQuery = e.target.value.trim();
    state.page = 1; // Reset to first page
    renderWhitelist();
    updatePagination();
  }
  
  // Change pagination page
  function changePage(delta) {
    const newPage = state.page + delta;
    
    // Calculate max pages
    const filteredItems = state.searchQuery
      ? state.items.filter(item => 
          (item.domain && item.domain.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
          (item.addedBy && item.addedBy.toLowerCase().includes(state.searchQuery.toLowerCase()))
        )
      : state.items;
    
    const maxPages = Math.ceil(filteredItems.length / state.perPage);
    
    // Validate page bounds
    if (newPage < 1 || newPage > maxPages) return;
    
    state.page = newPage;
    renderWhitelist();
    updatePagination();
  }
  
  // Update pagination buttons
  function updatePagination() {
    if (!elements.prevButton || !elements.nextButton) return;
    
    // Calculate max pages
    const filteredItems = state.searchQuery
      ? state.items.filter(item => 
          (item.domain && item.domain.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
          (item.addedBy && item.addedBy.toLowerCase().includes(state.searchQuery.toLowerCase()))
        )
      : state.items;
    
    const maxPages = Math.ceil(filteredItems.length / state.perPage);
    
    // Update button states
    elements.prevButton.disabled = state.page <= 1;
    elements.nextButton.disabled = state.page >= maxPages;
  }
  
  // Export whitelist to CSV
  function exportWhitelist() {
    // Prepare CSV content
    let csvContent = 'Domain,Added By,Date Added\n';
    
    state.items.forEach(item => {
      const domain = item.domain || item.url || '';
      const addedBy = item.addedBy || 'System';
      const dateAdded = item.added || item.date || new Date();
      
      csvContent += `"${domain}","${addedBy}","${new Date(dateAdded).toISOString()}"\n`;
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.setAttribute('download', `phishguard-whitelist-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    
    // Trigger download and cleanup
    link.click();
    document.body.removeChild(link);
    
    DOM.showAlert('Whitelist exported successfully', 'success');
  }
  
  // Import whitelist from file
  async function importWhitelist(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const content = event.target.result;
        const domains = parseImportFile(content);
        
        if (domains.length === 0) {
          DOM.showAlert('No valid domains found in import file', 'warning');
          return;
        }
        
        // Confirm import
        if (!confirm(`Import ${domains.length} domains to whitelist?`)) {
          return;
        }
        
        // Show loading state
        DOM.showAlert(`Importing ${domains.length} domains...`, 'info');
        
        // Import domains one by one
        let successCount = 0;
        let errorCount = 0;
        
        for (const domain of domains) {
          try {
            await listsAPI.addToWhitelist(domain);
            successCount++;
          } catch (error) {
            console.error(`Error importing domain ${domain}:`, error);
            errorCount++;
          }
        }
        
        // Show results
        DOM.showAlert(`Import complete: ${successCount} added, ${errorCount} failed`, successCount > 0 ? 'success' : 'warning');
        
        // Reset file input
        e.target.value = '';
        
        // Reload whitelist
        await loadWhitelist();
      } catch (error) {
        console.error('Import error:', error);
        DOM.showAlert('Import failed: ' + error.message, 'danger');
      }
    };
    
    reader.onerror = () => {
      DOM.showAlert('Failed to read file', 'danger');
    };
    
    reader.readAsText(file);
  }
  
  // Parse import file (CSV or TXT)
  function parseImportFile(content) {
    // Try CSV format first
    if (content.includes(',')) {
      try {
        // Simple CSV parsing - split by lines then get first column
        const lines = content.split('\n');
        return lines
          .slice(1) // Skip header row
          .map(line => line.split(',')[0]?.trim()) // Get first column
          .filter(domain => domain && isValidDomain(domain)); // Filter valid domains
      } catch (e) {
        console.error('CSV parsing failed, trying plain text', e);
      }
    }
    
    // Fall back to plain text format (one domain per line)
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(domain => domain && isValidDomain(domain));
  }
  
  // Close modal dialog
  function closeModal() {
    if (elements.modal) elements.modal.classList.remove('show');
  }
  
  // UI state helpers
  function showLoading(isLoading) {
    if (elements.loader) elements.loader.style.display = isLoading ? 'flex' : 'none';
    if (elements.table) elements.table.style.display = isLoading ? 'none' : 'table';
    if (elements.emptyState) elements.emptyState.style.display = 'none';
  }
  
  function showEmpty(isEmpty) {
    if (elements.table) elements.table.style.display = isEmpty ? 'none' : 'table';
    if (elements.emptyState) elements.emptyState.style.display = isEmpty ? 'flex' : 'none';
  }
  
  function showError(message) {
    showEmpty(true);
    if (elements.emptyState) {
      elements.emptyState.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <p>${message}</p>
      `;
    }
  }
  
  // Basic domain validation
  function isValidDomain(domain) {
    // Simple basic check
    return domain && 
           domain.length > 1 && 
           domain.includes('.') && 
           !domain.startsWith('http') && 
           !domain.includes('://') &&
           !domain.includes(' ');
  }
});
