/**
 * PhishGuard Admin Votes Management
 */

// Define functions first before they're called
function setupVoteActions() {
  // Set up search functionality
  const searchInput = document.getElementById('vote-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      searchVotes(query);
    });
    
    // Add keydown event for Escape key to clear search
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        searchVotes('');
      }
    });
  }
  
  // Set up vote type filter
  const voteFilter = document.getElementById('vote-filter');
  if (voteFilter) {
    voteFilter.addEventListener('change', () => {
      const filterValue = voteFilter.value;
      loadVoteData(filterValue);
    });
  }
  
  // Set up refresh button
  const refreshBtn = document.getElementById('refresh-votes');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      const spinner = refreshBtn.querySelector('i');
      spinner.classList.add('fa-spin');
      
      try {
        await Promise.all([
          loadVoteStats(),
          loadVoteData(document.getElementById('vote-filter').value)
        ]);
        showAlert('Vote data refreshed successfully', 'success');
      } catch (error) {
        console.error('Refresh error:', error);
        showAlert('Failed to refresh vote data', 'error');
      } finally {
        spinner.classList.remove('fa-spin');
      }
    });
  }
  
  // Set up export button
  const exportBtn = document.getElementById('export-votes');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportVoteData();
    });
  }
  
  // Set up trends button
  const trendsBtn = document.getElementById('view-vote-trends');
  if (trendsBtn) {
    trendsBtn.addEventListener('click', () => {
      showAlert('Voting trends feature will be available in a future update', 'info');
    });
  }
  
  // Set up modal close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      hideModal('vote-modal');
    });
  });
  
  // Modal action buttons
  document.getElementById('whitelist-url')?.addEventListener('click', () => {
    const url = document.getElementById('vote-url').textContent;
    addToWhitelist(url);
  });
  
  document.getElementById('blacklist-voted-url')?.addEventListener('click', () => {
    const url = document.getElementById('vote-url').textContent;
    addToBlacklist(url);
  });
}

// Add missing function definitions
function searchVotes(query) {
  console.log('Searching votes for:', query);
  const tableBody = document.getElementById('votes-table-body');
  if (!tableBody) return;
  
  const rows = tableBody.getElementsByTagName('tr');
  let visibleCount = 0;
  let totalCount = rows.length;
  
  for (let i = 0; i < rows.length; i++) {
    const url = rows[i].querySelector('.url-cell')?.textContent?.toLowerCase() || '';
    
    if (url.includes(query)) {
      rows[i].style.display = '';
      visibleCount++;
    } else {
      rows[i].style.display = 'none';
    }
  }
  
  // Update count display
  const totalElement = document.getElementById('votes-total');
  const rangeElement = document.getElementById('votes-range');
  
  if (totalElement) {
    if (query && visibleCount !== totalCount) {
      totalElement.textContent = `${visibleCount} of ${totalCount}`;
    } else {
      totalElement.textContent = totalCount;
    }
  }
  
  if (rangeElement) {
    if (query && visibleCount !== totalCount) {
      rangeElement.textContent = 'filtered';
    } else {
      rangeElement.textContent = `1-${Math.min(totalCount, 20)}`;
    }
  }
}

function exportVoteData() {
  try {
    // Get vote data from table
    const tableBody = document.getElementById('votes-table-body');
    if (!tableBody) {
      showAlert('No data to export', 'warning');
      return;
    }
    
    const rows = tableBody.getElementsByTagName('tr');
    if (rows.length === 0) {
      showAlert('No data to export', 'warning');
      return;
    }
    
    const data = [];
    
    // Header row
    data.push(['URL', 'Safe Votes', 'Phishing Votes', 'Safe Percentage', 'Phishing Percentage', 'Last Vote']);
    
    // Data rows
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].style.display === 'none') continue; // Skip hidden rows
      
      const url = rows[i].querySelector('.url-cell').getAttribute('title');
      const safeVotes = rows[i].querySelector('.safe-votes').textContent;
      const phishingVotes = rows[i].querySelector('.phishing-votes').textContent;
      const ratioText = rows[i].querySelector('.ratio-text').textContent;
      const lastVote = rows[i].cells[4].textContent;
      
      // Extract percentages from ratio text
      const safePercentage = ratioText.match(/(\d+)% Safe/)[1];
      const phishingPercentage = ratioText.match(/(\d+)% Phishing/)[1];
      
      data.push([url, safeVotes, phishingVotes, safePercentage, phishingPercentage, lastVote]);
    }
    
    // Convert to CSV
    const csv = data.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    // Create and trigger download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `phishguard_votes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showAlert('Vote data exported successfully', 'success');
  } catch (error) {
    console.error('Error exporting vote data:', error);
    showAlert('Failed to export vote data: ' + error.message, 'error');
  }
}

function addToWhitelist(url) {
  // Hide modal first
  hideModal('vote-modal');
  
  // Confirmation dialog
  if (confirm(`Are you sure you want to add "${formatUrl(url)}" to the whitelist?`)) {
    try {
      // Make API call to add URL to whitelist
      listsAPI.addToWhitelist(url).then(() => {
        showAlert(`Added ${formatUrl(url)} to whitelist`, 'success');
      }).catch(error => {
        console.error('Error adding to whitelist:', error);
        showAlert('Failed to add URL to whitelist: ' + error.message, 'error');
      });
    } catch (error) {
      console.error('Error adding to whitelist:', error);
      showAlert('Failed to add URL to whitelist: ' + error.message, 'error');
    }
  }
}

function addToBlacklist(url) {
  // Hide modal first
  hideModal('vote-modal');
  
  // Confirmation dialog
  if (confirm(`Are you sure you want to add "${formatUrl(url)}" to the blacklist?`)) {
    try {
      // Make API call to add URL to blacklist
      listsAPI.addToBlacklist(url).then(() => {
        showAlert(`Added ${formatUrl(url)} to blacklist`, 'success');
      }).catch(error => {
        console.error('Error adding to blacklist:', error);
        showAlert('Failed to add URL to blacklist: ' + error.message, 'error');
      });
    } catch (error) {
      console.error('Error adding to blacklist:', error);
      showAlert('Failed to add URL to blacklist: ' + error.message, 'error');
    }
  }
}

// Main initialization
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Initializing votes management...');
    
    // Verify admin authentication
    if (!Auth.isAuthenticated()) {
      window.location.href = 'index.html';
      return;
    }
    
    // Set up UI components and event listeners
    setupVoteActions();
    
    // Initialize with data from API - always use real data
    await Promise.all([
      loadVoteStats(),
      loadVoteData()
    ]);
    
    console.log('Votes management initialized successfully');
  } catch (error) {
    console.error('Votes management initialization error:', error);
    showAlert('Failed to initialize votes management: ' + error.message, 'error');
  }
});

async function loadVoteStats() {
  try {
    console.log('Loading vote statistics...');
    // Show loading indicators
    document.getElementById('total-votes').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    document.getElementById('safe-votes').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    document.getElementById('phishing-votes').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    document.getElementById('today-votes').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    // Fetch vote statistics from API
    let stats;
    try {
      stats = await votesAPI.getStats();
      console.log('Vote stats received:', stats);
    } catch (apiError) {
      console.error('API error in vote stats:', apiError);
      throw apiError;
    }
    
    // Update statistics in the UI
    document.getElementById('total-votes').textContent = stats.total || 0;
    document.getElementById('safe-votes').textContent = stats.safeCount || 0;
    document.getElementById('phishing-votes').textContent = stats.phishingCount || 0;
    
    // Calculate today's vote count from recent activity
    const today = new Date().toISOString().split('T')[0];
    const todayVotes = stats.recentActivity?.find(item => item.date === today)?.count || 0;
    document.getElementById('today-votes').textContent = todayVotes;
    
    console.log('Vote statistics updated successfully');
    return stats;
  } catch (error) {
    console.error('Failed to load vote statistics:', error);
    
    // Show error but continue to load other parts
    document.getElementById('total-votes').textContent = '0';
    document.getElementById('safe-votes').textContent = '0';
    document.getElementById('phishing-votes').textContent = '0';
    document.getElementById('today-votes').textContent = '0';
    
    showAlert('Failed to load vote statistics', 'error');
    return null;
  }
}

async function loadVoteData(filter = 'all') {
  try {
    console.log('Loading vote data with filter:', filter);
    // Show loading state
    const votesLoader = document.getElementById('votes-loader');
    const votesTable = document.getElementById('votes-table');
    const noVotes = document.getElementById('no-votes');
    
    if (votesLoader) votesLoader.style.display = 'flex';
    if (votesTable) votesTable.style.display = 'none';
    if (noVotes) noVotes.style.display = 'none';
    
    // Fetch raw votes from the database through API
    const rawVotes = await votesAPI.getVotes();
    console.log('Raw votes from database:', rawVotes);
    
    // Process votes if we have data, otherwise show no data message
    let voteSummaries = [];
    if (Array.isArray(rawVotes) && rawVotes.length > 0) {
      voteSummaries = processRawVotes(rawVotes);
      console.log('Processed vote summaries:', voteSummaries);
      
      // Store voteSummaries in document for access by other functions
      document.voteSummaries = voteSummaries;
    } else {
      console.warn('No votes data received from API');
    }
    
    // Hide loading state
    if (votesLoader) votesLoader.style.display = 'none';
    
    // Handle empty state
    if (!voteSummaries || voteSummaries.length === 0) {
      if (noVotes) noVotes.style.display = 'flex';
      
      // Reset analytics placeholders
      document.getElementById('most-voted-url').textContent = '-';
      document.getElementById('most-contested-url').textContent = '-';
      document.getElementById('most-phishing-url').textContent = '-';
      document.getElementById('most-safe-url').textContent = '-';
      return;
    }
    
    // Apply filtering if needed
    if (filter !== 'all') {
      voteSummaries = filterVoteData(voteSummaries, filter);
    }
    
    // Show table and populate with data
    if (votesTable) {
      votesTable.style.display = 'table';
      
      const tableBody = document.getElementById('votes-table-body');
      if (!tableBody) {
        console.error('votes-table-body element not found');
        return;
      }
      
      // Clear existing rows
      tableBody.innerHTML = '';
      
      // Update pagination info
      const totalElement = document.getElementById('votes-total');
      const rangeElement = document.getElementById('votes-range');
      
      if (totalElement) totalElement.textContent = voteSummaries.length;
      if (rangeElement) rangeElement.textContent = `1-${Math.min(voteSummaries.length, 20)}`;
      
      // Add votes to table
      voteSummaries.forEach(vote => {
        // Format last vote date
        let formattedDate = 'Unknown';
        try {
          if (vote.lastVote && !isNaN(new Date(vote.lastVote).getTime())) {
            const voteDate = new Date(vote.lastVote);
            formattedDate = voteDate.toLocaleDateString() + ' ' + 
                          voteDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
        } catch (e) {
          console.error('Date formatting error:', e);
        }
        
        // Calculate vote ratio
        const safeVotes = parseInt(vote.safeVotes || 0);
        const phishingVotes = parseInt(vote.phishingVotes || 0);
        const totalVotes = safeVotes + phishingVotes;
        const safePercentage = totalVotes > 0 ? Math.round((safeVotes / totalVotes) * 100) : 0;
        const phishingPercentage = 100 - safePercentage;
        
        // Determine ratio class
        let ratioClass = 'ratio-neutral';
        if (safePercentage > 70) ratioClass = 'ratio-safe';
        else if (phishingPercentage > 70) ratioClass = 'ratio-phishing';
        else if (Math.abs(safePercentage - phishingPercentage) < 20) ratioClass = 'ratio-contested';
        
        // Create row
        const row = document.createElement('tr');
        const urlDisplay = vote.url ? vote.url : 'Unknown URL';
        
        row.innerHTML = `
          <td>
            <div class="url-cell" title="${escapeHtml(urlDisplay)}">
              ${escapeHtml(formatUrl(urlDisplay))}
            </div>
          </td>
          <td>
            <span class="vote-count safe-votes">${safeVotes}</span>
          </td>
          <td>
            <span class="vote-count phishing-votes">${phishingVotes}</span>
          </td>
          <td>
            <div class="vote-ratio ${ratioClass}">
              <div class="ratio-bar">
                <div class="safe-bar" style="width: ${safePercentage}%"></div>
                <div class="phishing-bar" style="width: ${phishingPercentage}%"></div>
              </div>
              <div class="ratio-text">${safePercentage}% Safe / ${phishingPercentage}% Phishing</div>
            </div>
          </td>
          <td>${formattedDate}</td>
          <td>
            <div class="actions">
              <button class="btn btn-icon view-details" data-url="${escapeHtml(urlDisplay)}" title="View details">
                <i class="fas fa-eye"></i>
              </button>
              <button class="btn btn-icon add-whitelist" data-url="${escapeHtml(urlDisplay)}" title="Add to whitelist">
                <i class="fas fa-check-circle"></i>
              </button>
              <button class="btn btn-icon add-blacklist" data-url="${escapeHtml(urlDisplay)}" title="Add to blacklist">
                <i class="fas fa-ban"></i>
              </button>
            </div>
          </td>
        `;
        
        tableBody.appendChild(row);
      });
      
      // Add event listeners to action buttons
      setupVoteTableActions();
      
      // Update analytics with top URLs
      updateVoteAnalytics(voteSummaries);
    }
  } catch (error) {
    console.error('Failed to load vote data:', error);
    
    // Hide loader
    const votesLoader = document.getElementById('votes-loader');
    if (votesLoader) votesLoader.style.display = 'none';
    
    // Show no votes message
    const noVotes = document.getElementById('no-votes');
    if (noVotes) noVotes.style.display = 'flex';
    
    // Show error
    showAlert('Failed to load vote data: ' + error.message, 'error');
  }
}

/**
 * Process raw votes from database into summarized format by URL
 * @param {Array} rawVotes Raw vote data from the database
 * @returns {Array} Processed vote summaries grouped by URL
 */
function processRawVotes(rawVotes) {
  // Create a map to group votes by URL
  const votesByUrl = new Map();
  
  // Log the type of data we're receiving to help with debugging
  console.log('Raw votes data type:', typeof rawVotes);
  if (rawVotes.length > 0) {
    console.log('First vote example:', rawVotes[0]);
  }
  
  // Process each vote - with detailed logging
  rawVotes.forEach((vote, index) => {
    if (index < 3) {
      console.log(`Processing vote ${index}:`, vote);
    }
    
    // Handle database field names - looking for both standard and MySQL convention names
    const url = vote.URL || vote.url;
    const voteType = vote.VoteType || vote.voteType;
    const timestamp = vote.Timestamp || vote.timestamp;
    const voteId = vote.VoteID || vote.voteId || vote.id;
    const userId = vote.UserID || vote.userId || vote.user_id;
    
    if (!url) {
      console.warn('Vote without URL:', vote);
      return; // Skip votes without URL
    }
    
    // Get or create summary for this URL
    let summary = votesByUrl.get(url);
    if (!summary) {
      summary = {
        url: url,
        safeVotes: 0,
        phishingVotes: 0,
        lastVote: null,
        firstVote: null,
        votes: []
      };
      votesByUrl.set(url, summary);
    }
    
    // Count votes by type
    if (voteType === 'Safe') {
      summary.safeVotes++;
    } else if (voteType === 'Phishing') {
      summary.phishingVotes++;
    } else {
      console.warn(`Unknown vote type "${voteType}" for vote:`, vote);
    }
    
    // Track timestamps
    if (timestamp) {
      try {
        const voteTime = new Date(timestamp);
        if (!isNaN(voteTime.getTime())) {
          if (!summary.firstVote || voteTime < new Date(summary.firstVote)) {
            summary.firstVote = timestamp;
          }
          if (!summary.lastVote || voteTime > new Date(summary.lastVote)) {
            summary.lastVote = timestamp;
          }
        } else {
          console.warn(`Invalid timestamp "${timestamp}" for vote:`, vote);
        }
      } catch (e) {
        console.error('Error processing timestamp:', e, vote);
      }
    }
    
    // Add to vote list
    summary.votes.push({
      voteId: voteId,
      userId: userId,
      voteType: voteType,
      timestamp: timestamp
    });
  });
  
  // Convert map to array and sort by total votes (descending)
  const voteArray = Array.from(votesByUrl.values());
  voteArray.sort((a, b) => {
    const totalA = a.safeVotes + a.phishingVotes;
    const totalB = b.safeVotes + b.phishingVotes;
    return totalB - totalA;
  });
  
  console.log(`Processed ${rawVotes.length} votes into ${voteArray.length} URL summaries`);
  return voteArray;
}

/**
 * Filter vote data based on selected criteria
 */
function filterVoteData(voteSummaries, filter) {
  console.log('Filtering votes by:', filter);
  
  if (!voteSummaries || !Array.isArray(voteSummaries)) {
    return [];
  }
  
  return voteSummaries.filter(vote => {
    const safeVotes = parseInt(vote.safeVotes || 0);
    const phishingVotes = parseInt(vote.phishingVotes || 0);
    const totalVotes = safeVotes + phishingVotes;
    
    if (totalVotes === 0) return false;
    
    const safePercentage = Math.round((safeVotes / totalVotes) * 100);
    const phishingPercentage = 100 - safePercentage;
    
    switch (filter) {
      case 'safe-majority':
        return safePercentage > 60;
      case 'phishing-majority':
        return phishingPercentage > 60;
      case 'contested':
        return Math.abs(safePercentage - phishingPercentage) < 20;
      default:
        return true;
    }
  });
}

/**
 * Update vote analytics section with most interesting URLs
 */
function updateVoteAnalytics(voteSummaries) {
  if (!voteSummaries || voteSummaries.length === 0) return;
  
  try {
    // Find most voted URL
    const mostVoted = [...voteSummaries].sort((a, b) => {
      const totalA = (a.safeVotes || 0) + (a.phishingVotes || 0);
      const totalB = (b.safeVotes || 0) + (b.phishingVotes || 0);
      return totalB - totalA;
    })[0];
    
    // Find most contested URL (closest to 50/50)
    const mostContested = [...voteSummaries].sort((a, b) => {
      const totalA = (a.safeVotes || 0) + (a.phishingVotes || 0);
      const totalB = (b.safeVotes || 0) + (b.phishingVotes || 0);
      
      if (totalA === 0) return 1;
      if (totalB === 0) return -1;
      
      const safePercentA = (a.safeVotes || 0) / totalA;
      const safePercentB = (b.safeVotes || 0) / totalB;
      
      return Math.abs(safePercentA - 0.5) - Math.abs(safePercentB - 0.5);
    })[0];
    
    // Find most reported as phishing
    const mostPhishing = [...voteSummaries]
      .filter(v => (v.phishingVotes || 0) > 0)
      .sort((a, b) => (b.phishingVotes || 0) - (a.phishingVotes || 0))[0];
    
    // Find most reported as safe
    const mostSafe = [...voteSummaries]
      .filter(v => (v.safeVotes || 0) > 0)
      .sort((a, b) => (b.safeVotes || 0) - (a.safeVotes || 0))[0];
    
    // Update UI elements
    document.getElementById('most-voted-url').textContent = formatUrl(mostVoted?.url || '-');
    document.getElementById('most-contested-url').textContent = formatUrl(mostContested?.url || '-');
    document.getElementById('most-phishing-url').textContent = formatUrl(mostPhishing?.url || '-');
    document.getElementById('most-safe-url').textContent = formatUrl(mostSafe?.url || '-');
  } catch (error) {
    console.error('Error updating vote analytics:', error);
  }
}

function setupVoteTableActions() {
  // View details buttons
  document.querySelectorAll('.view-details').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      if (url) {
        showVoteDetails(url);
      }
    });
  });
  
  // Add to whitelist buttons
  document.querySelectorAll('.add-whitelist').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      if (url) {
        addToWhitelist(url);
      }
    });
  });
  
  // Add to blacklist buttons
  document.querySelectorAll('.add-blacklist').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      if (url) {
        addToBlacklist(url);
      }
    });
  });
}

async function showVoteDetails(url) {
  try {
    console.log('Showing vote details for:', url);
    
    // Find vote summary in our processed data
    const voteSummaries = document.voteSummaries;
    let voteSummary = null;
    
    if (voteSummaries && Array.isArray(voteSummaries)) {
      voteSummary = voteSummaries.find(v => v.url === url);
      console.log('Found vote summary:', voteSummary);
    }
    
    // If we don't have the vote summary in memory, try to fetch it from the active table row
    if (!voteSummary) {
      console.log('Vote summary not found in memory, fetching from table...');
      const tableRow = document.querySelector(`.view-details[data-url="${escapeHtml(url)}"]`)?.closest('tr');
      
      if (tableRow) {
        const safeVotes = parseInt(tableRow.querySelector('.safe-votes').textContent) || 0;
        const phishingVotes = parseInt(tableRow.querySelector('.phishing-votes').textContent) || 0;
        
        voteSummary = {
          url: url,
          safeVotes: safeVotes,
          phishingVotes: phishingVotes,
          lastVote: new Date().toISOString(), // Estimate
          firstVote: new Date().toISOString() // Estimate
        };
        console.log('Created vote summary from table:', voteSummary);
      } else {
        console.error('Could not find table row for URL:', url);
        showAlert('Failed to load vote details', 'error');
        return;
      }
    }
    
    // Update modal content with vote details
    document.getElementById('vote-modal-title').textContent = 'Vote Details';
    document.getElementById('vote-url').textContent = url;
    
    // Calculate percentages
    const totalVotes = (voteSummary.safeVotes || 0) + (voteSummary.phishingVotes || 0);
    const safePercent = totalVotes > 0 ? Math.round((voteSummary.safeVotes / totalVotes) * 100) : 50;
    const phishingPercent = 100 - safePercent;
    
    // Update percentages
    document.getElementById('safe-percent').textContent = safePercent + '%';
    document.getElementById('phishing-percent').textContent = phishingPercent + '%';
    
    // Update vote counts
    document.getElementById('detail-total-votes').textContent = totalVotes;
    document.getElementById('detail-safe-votes').textContent = voteSummary.safeVotes || 0;
    document.getElementById('detail-phishing-votes').textContent = voteSummary.phishingVotes || 0;
    
    // Format dates
    document.getElementById('detail-first-vote').textContent = formatDate(voteSummary.firstVote);
    document.getElementById('detail-last-vote').textContent = formatDate(voteSummary.lastVote);
    
    // Update chart bars
    document.getElementById('safe-bar').style.width = safePercent + '%';
    document.getElementById('phishing-bar').style.width = phishingPercent + '%';
    
    // Show modal
    const modal = document.getElementById('vote-modal');
    modal.classList.add('show');
    
    // Re-attach close button event listener to ensure it works
    const closeButton = modal.querySelector('.modal-close');
    if (closeButton) {
      // Remove any existing event listeners
      closeButton.replaceWith(closeButton.cloneNode(true));
      
      // Add fresh event listener
      modal.querySelector('.modal-close').addEventListener('click', () => {
        hideModal('vote-modal');
      });
    }
  } catch (error) {
    console.error('Error showing vote details:', error);
    showAlert('Failed to load vote details: ' + error.message, 'error');
  }
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    console.log('Hiding modal:', modalId);
    modal.classList.remove('show');
  }
}

// Helper function to format URLs for display
function formatUrl(url) {
  if (!url) return 'Unknown URL';
  
  try {
    // Try to parse URL and get hostname + pathname
    const parsed = new URL(url);
    // Truncate long paths
    const path = parsed.pathname.length > 20 ? parsed.pathname.substring(0, 20) + '...' : parsed.pathname;
    return parsed.hostname + path;
  } catch (e) {
    // Return original if parsing fails, but truncated if too long
    return url.length > 40 ? url.substring(0, 40) + '...' : url;
  }
}

// Helper function to format dates
function formatDate(dateString) {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleDateString() + ' ' + 
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '-';
  }
}

// Helper function to calculate percentages
function calculatePercentage(safe, phishing) {
  const total = (safe || 0) + (phishing || 0);
  if (total === 0) return 50; // Default to 50% if no votes
  
  return Math.round((safe || 0) / total * 100);
}

// Utility function to escape HTML
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Function to show an alert message
function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById('system-alert');
  if (!alertContainer) return;
  
  alertContainer.textContent = message;
  alertContainer.className = `alert alert-${type === 'error' ? 'danger' : type}`;
  alertContainer.style.display = 'block';
  
  if (type !== 'error' && type !== 'danger') {
    setTimeout(() => {
      alertContainer.style.display = 'none';
    }, 5000);
  }
}

// Add a direct modal close event listener at the document level
document.addEventListener('DOMContentLoaded', function() {
  const modalCloseButtons = document.querySelectorAll('.modal-close');
  modalCloseButtons.forEach(button => {
    button.addEventListener('click', function() {
      const modal = this.closest('.modal');
      if (modal) {
        modal.classList.remove('show');
      }
    });
  });
  
  // Also close on overlay click
  const modalOverlays = document.querySelectorAll('.modal-overlay');
  modalOverlays.forEach(overlay => {
    overlay.addEventListener('click', function() {
      const modal = this.closest('.modal');
      if (modal) {
        modal.classList.remove('show');
      }
    });
  });
});