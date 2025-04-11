/**
 * PhishGuard Admin Votes Management
 * Updated to use Positive/Negative terminology for user-facing content
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

/**
 * Helper function to safely escape HTML special characters
 * Must be defined before it's used in the loadVoteData function
 */
function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
    data.push(['URL', 'Positive Votes', 'Negative Votes', 'Positive Percentage', 'Negative Percentage', 'Score', 'Last Vote']);
    
    // Data rows
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].style.display === 'none') continue; // Skip hidden rows
      
      const url = rows[i].querySelector('.url-cell').getAttribute('title');
      const ratioText = rows[i].querySelector('.ratio-text').textContent;
      const score = rows[i].querySelector('.score-value')?.textContent || 'N/A';
      const lastVote = rows[i].cells[4].textContent; // Updated index since we added Score column
      
      // Need to get the vote counts from our stored summaries instead of the table
      const urlData = document.voteSummaries.find(v => v.url === url);
      const positiveVotes = urlData ? urlData.safeVotes : 0;
      const negativeVotes = urlData ? urlData.phishingVotes : 0;
      
      // Extract percentages from ratio text
      const positivePercentage = ratioText.match(/(\d+)% Positive/)[1];
      const negativePercentage = ratioText.match(/(\d+)% Negative/)[1];
      
      data.push([url, positiveVotes, negativeVotes, positivePercentage, negativePercentage, score, lastVote]);
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
    document.getElementById('positive-votes').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    document.getElementById('negative-votes').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
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
    document.getElementById('positive-votes').textContent = stats.safeCount || 0;
    document.getElementById('negative-votes').textContent = stats.phishingCount || 0;
    
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
    document.getElementById('positive-votes').textContent = '0';
    document.getElementById('negative-votes').textContent = '0';
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
      document.getElementById('most-negative-url').textContent = '-';
      document.getElementById('most-positive-url').textContent = '-';
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
        const positiveVotes = parseInt(vote.safeVotes || 0);
        const negativeVotes = parseInt(vote.phishingVotes || 0);
        const totalVotes = positiveVotes + negativeVotes;
        const positivePercentage = totalVotes > 0 ? Math.round((positiveVotes / totalVotes) * 100) : 0;
        const negativePercentage = 100 - positivePercentage;
        
        // Determine ratio class
        let ratioClass = 'ratio-neutral';
        if (positivePercentage > 70) ratioClass = 'ratio-positive';
        else if (negativePercentage > 70) ratioClass = 'ratio-negative';
        else if (Math.abs(positivePercentage - negativePercentage) < 20) ratioClass = 'ratio-contested';
        
        // Get score value (default to N/A if not available)
        const score = vote.score || 'N/A';
        
        // Determine score class for styling
        let scoreClass = 'score-medium';
        if (score !== 'N/A') {
          const scoreValue = parseFloat(score);
          if (scoreValue >= 0.7) scoreClass = 'score-high';
          else if (scoreValue <= 0.3) scoreClass = 'score-low';
        }
        
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
            <div class="vote-ratio ${ratioClass}">
              <div class="ratio-text">
                <span style="color: ${positivePercentage >= negativePercentage ? '#4CAF50' : 'inherit'};">${positivePercentage}% Positive</span>
                 / 
                <span style="color: ${negativePercentage > positivePercentage ? '#F72585' : 'inherit'};">${negativePercentage}% Negative</span>
              </div>
            </div>
          </td>
          <td>
            <span class="score-value ${scoreClass}">${score}</span>
          </td>
          <td>
            <span class="prediction-badge ${vote.prediction ? (vote.prediction === 'Safe' ? 'badge-success' : vote.prediction === 'Phishing' ? 'badge-danger' : 'badge-secondary') : 'badge-secondary'}">
              ${vote.prediction ? (vote.prediction === 'Safe' ? 'Positive' : vote.prediction === 'Phishing' ? 'Negative' : vote.prediction) : 'No prediction'}
            </span>
          </td>
          <td>${formattedDate}</td>
          <td>
            <div class="actions" style="display: flex; justify-content: center;">
              <a href="javascript:void(0)" class="view-details" data-url="${escapeHtml(urlDisplay)}" style="color: #3D85C6; cursor: pointer;" title="View details">
                <i class="fas fa-eye"></i>
              </a>
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

function setupVoteTableActions() {
  // Only need view details buttons now
  document.querySelectorAll('.view-details').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      if (url) {
        showVoteDetails(url);
      }
    });
  });
}

/**
 * Process raw votes from database into summarized format by URL
 * @param {Array} rawVotes Raw vote data from the database
 * @returns {Array} Processed vote summaries grouped by URL
 */
function processRawVotes(rawVotes) {
  // Create a map to group votes by URL
  const votesByUrl = new Map();
  
  // Process each vote
  rawVotes.forEach(vote => {
    const url = vote.URL || vote.url;
    const voteType = vote.VoteType || vote.voteType;
    const timestamp = vote.Timestamp || vote.timestamp;
    if (!url) return; // Skip votes without URL
    
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
    }
    
    // Track timestamps
    if (timestamp) {
      const voteTime = new Date(timestamp);
      if (!isNaN(voteTime.getTime())) {
        if (!summary.firstVote || voteTime < new Date(summary.firstVote)) {
          summary.firstVote = timestamp;
        }
        if (!summary.lastVote || voteTime > new Date(summary.lastVote)) {
          summary.lastVote = timestamp;
        }
      }
    }
    
    // Add to vote list
    summary.votes.push({
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
  
  return voteArray;
}

/**
 * Filter vote data based on selected criteria
 */
function filterVoteData(voteSummaries, filter) {
  return voteSummaries.filter(vote => {
    const safeVotes = parseInt(vote.safeVotes || 0);
    const phishingVotes = parseInt(vote.phishingVotes || 0);
    const totalVotes = safeVotes + phishingVotes;
    if (totalVotes === 0) return false;
    const safePercentage = Math.round((safeVotes / totalVotes) * 100);
    const phishingPercentage = 100 - safePercentage;
    switch (filter) {
      case 'positive-majority':
        return safePercentage > 60;
      case 'negative-majority':
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
    
    // Find most reported as negative (phishing)
    const mostNegative = [...voteSummaries]
      .filter(v => (v.phishingVotes || 0) > 0)
      .sort((a, b) => (b.phishingVotes || 0) - (a.phishingVotes || 0))[0];
    
    // Find most reported as positive (safe)
    const mostPositive = [...voteSummaries]
      .filter(v => (v.safeVotes || 0) > 0)
      .sort((a, b) => (b.safeVotes || 0) - (a.safeVotes || 0))[0];
    
    // Update UI elements
    document.getElementById('most-voted-url').textContent = formatUrl(mostVoted?.url || '-');
    document.getElementById('most-contested-url').textContent = formatUrl(mostContested?.url || '-');
    document.getElementById('most-negative-url').textContent = formatUrl(mostNegative?.url || '-');
    document.getElementById('most-positive-url').textContent = formatUrl(mostPositive?.url || '-');
  } catch (error) {
    console.error('Error updating vote analytics:', error);
  }
}

async function showVoteDetails(url) {
  try {
    console.log('Showing vote details for:', url);
    
    // Find vote summary in our processed data
    const voteSummaries = document.voteSummaries;
    let voteSummary = null;
    
    if (voteSummaries && Array.isArray(voteSummaries)) {
      voteSummary = voteSummaries.find(v => v.url === url);
    }
    
    if (!voteSummary) {
      console.error('Vote summary not found for URL:', url);
      showAlert('Failed to load vote details', 'error');
      return;
    }
    
    // Calculate percentages
    const totalVotes = (voteSummary.safeVotes || 0) + (voteSummary.phishingVotes || 0);
    const positivePercent = totalVotes > 0 ? Math.round((voteSummary.safeVotes / totalVotes) * 100) : 50;
    const negativePercent = 100 - positivePercent;
    
    // Determine accuracy status based on extension prediction
    const prediction = voteSummary.prediction || 'No prediction';
    let accuracyClass = 'neutral';
    let accuracyText = 'No prediction data available';
    if (voteSummary.prediction) {
      if (voteSummary.prediction === 'Safe' && positivePercent >= 60) {
        accuracyClass = 'success';
        accuracyText = `Prediction was correct with ${positivePercent}% user agreement`;
      } else if (voteSummary.prediction === 'Phishing' && negativePercent >= 60) {
        accuracyClass = 'success';
        accuracyText = `Prediction was correct with ${negativePercent}% user agreement`;
      } else if ((voteSummary.prediction === 'Safe' && positivePercent < 40) || 
                (voteSummary.prediction === 'Phishing' && negativePercent < 40)) {
        accuracyClass = 'danger';
        accuracyText = 'Prediction differs from majority user opinion';
      } else {
        accuracyClass = 'warning';
        accuracyText = 'User opinion is mixed on this prediction';
      }
    }
    
    // Convert prediction display names
    const displayPrediction = 
      prediction === 'Safe' ? 'Positive' : 
      prediction === 'Phishing' ? 'Negative' : 
      prediction;
    
    // Get score
    const score = voteSummary.score || 'N/A';
    let scoreClass = 'score-medium';
    if (score !== 'N/A') {
      const scoreValue = parseFloat(score);
      if (scoreValue >= 0.7) scoreClass = 'score-high';
      else if (scoreValue <= 0.3) scoreClass = 'score-low';
    }
    
    // Update the modal with enhanced content using new terminology
    const modalContent = `
      <div class="url-details">
        <h4>URL Information</h4>
        <p id="vote-url" class="vote-url">${escapeHtml(url)}</p>
        <div class="prediction-section">
          <h4>Extension Prediction</h4>
          <div class="prediction-result">
            <span class="prediction-badge ${prediction === 'Safe' ? 'badge-success' : prediction === 'Phishing' ? 'badge-danger' : 'badge-warning'}">
              ${displayPrediction}
            </span>
            <p class="accuracy-text ${accuracyClass}">${accuracyText}</p>
            <div class="score-display" style="margin-top: 10px;">
              <span class="detail-label">Risk Score:</span>
              <span class="score-value ${scoreClass}">${score}</span>
              <span class="help-text" style="margin-left: 5px;">(Higher values indicate more trustworthy sites)</span>
            </div>
          </div>
        </div>
        <div class="vote-summary">
          <h4>User Votes</h4>
          <div class="vote-chart">
            <div class="vote-labels">
              <div class="safe-label">
                <i class="fas fa-check-circle"></i> Positive
                <span id="safe-percent">${positivePercent}%</span>
              </div>
              <div class="phishing-label">
                <i class="fas fa-ban"></i> Negative
                <span id="phishing-percent">${negativePercent}%</span>
              </div>
            </div>
          </div>
          <div class="vote-details">
            <div class="vote-detail-item">
              <span class="detail-label">Total Votes:</span>
              <span id="detail-total-votes" class="detail-value">${totalVotes}</span>
            </div>
            <div class="vote-detail-item">
              <span class="detail-label">Positive Votes:</span>
              <span id="detail-safe-votes" class="detail-value">${voteSummary.safeVotes || 0}</span>
            </div>
            <div class="vote-detail-item">
              <span class="detail-label">Negative Votes:</span>
              <span id="detail-phishing-votes" class="detail-value">${voteSummary.phishingVotes || 0}</span>
            </div>
            <div class="vote-detail-item">
              <span class="detail-label">First Vote:</span>
              <span id="detail-first-vote" class="detail-value">${formatDate(voteSummary.firstVote)}</span>
            </div>
            <div class="vote-detail-item">
              <span class="detail-label">Last Vote:</span>
              <span id="detail-last-vote" class="detail-value">${formatDate(voteSummary.lastVote)}</span>
            </div>
          </div>
        </div>
        <div class="action-buttons">
          <button id="whitelist-url" class="btn btn-success">
            <i class="fas fa-check-circle"></i> Add to Whitelist
          </button>
          <button id="blacklist-voted-url" class="btn btn-danger">
            <i class="fas fa-ban"></i> Add to Blacklist
          </button>
        </div>
      </div>
    `;
    
    // Update the modal content - complete replacement to avoid styling conflicts
    const modalBody = document.querySelector('#vote-modal .modal-body');
    if (modalBody) {
      modalBody.innerHTML = modalContent;
    }
    
    // Show modal
    const modal = document.getElementById('vote-modal');
    if (modal) {
      modal.classList.add('show');
    }
    
    // Add event listeners to buttons
    document.getElementById('whitelist-url')?.addEventListener('click', () => {
      addToWhitelist(url);
    });
    document.getElementById('blacklist-voted-url')?.addEventListener('click', () => {
      addToBlacklist(url);
    });
    
  } catch (error) {
    console.error('Error showing vote details:', error);
    showAlert('Failed to load vote details: ' + error.message, 'error');
  }
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
  }
}

function formatUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname + parsed.pathname;
  } catch (error) {
    return url;
  }
}

function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById('system-alert');
  if (alertContainer) {
    alertContainer.textContent = message;
    alertContainer.className = `alert alert-${type}`;
    alertContainer.style.display = 'block';
    setTimeout(() => {
      alertContainer.style.display = 'none';
    }, 3000);
  }
}

function formatDate(date) {
  if (!date) return 'Unknown';
  try {
    const parsedDate = new Date(date);
    return parsedDate.toLocaleDateString() + ' ' + parsedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    return 'Unknown';
  }
}