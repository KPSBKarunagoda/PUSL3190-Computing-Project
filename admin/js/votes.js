/**
 * PhishGuard Admin Votes Management
 * Updated to use consistent terminology (Positive/Negative)
 */

// Define functions 
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
  
  // Set up modal close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      hideModal('vote-modal');
    });
  });
  
  // Modal action buttons
  document.getElementById('whitelist-url')?.addEventListener('click', () => {
    const url = document.getElementById('vote-url').textContent;
    if (url && validateUrl(url)) {
      addToWhitelist(url);
    } else {
      showAlert('Invalid URL cannot be added to whitelist', 'warning');
    }
  });
  
  document.getElementById('blacklist-voted-url')?.addEventListener('click', () => {
    const url = document.getElementById('vote-url').textContent;
    if (url && validateUrl(url)) {
      addToBlacklist(url);
    } else {
      showAlert('Invalid URL cannot be added to blacklist', 'warning');
    }
  });
}

// Validate URL function for security
function validateUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    console.error("Invalid URL:", url, e);
    return false;
  }
}

// Add missing function definitions
function searchVotes(query) {
  console.log('Searching votes for:', query);
  const tableBody = document.getElementById('votes-table-body');
  if (!tableBody) return;
  
  const sanitizedQuery = escapeHtml(query).toLowerCase();
  const rows = tableBody.getElementsByTagName('tr');
  let visibleCount = 0;
  let totalCount = rows.length;
  
  for (let i = 0; i < rows.length; i++) {
    const url = rows[i].querySelector('.url-cell')?.textContent?.toLowerCase() || '';
    
    if (url.includes(sanitizedQuery)) {
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
      const positiveVotes = urlData ? urlData.positiveVotes : 0;
      const negativeVotes = urlData ? urlData.negativeVotes : 0;
      
      // Extract percentages from ratio text
      const positivePercentMatch = ratioText.match(/(\d+)% Positive/);
      const negativePercentMatch = ratioText.match(/(\d+)% Negative/);
      
      const positivePercentage = positivePercentMatch ? positivePercentMatch[1] : '0';
      const negativePercentage = negativePercentMatch ? negativePercentMatch[1] : '0';
      
      data.push([url, positiveVotes, negativeVotes, positivePercentage, negativePercentage, score, lastVote]);
    }
    
    // Convert to CSV with header encoding for Excel compatibility
    const csvContent = "\uFEFF" + data.map(row => 
      row.map(cell => 
        typeof cell === 'string' ? `"${cell.replace(/"/g, '""')}"` : cell
      ).join(',')
    ).join('\n');
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
    showAlert('Failed to export vote data', 'error');
  }
}

function addToWhitelist(url) {
  // Hide modal first
  hideModal('vote-modal');
  
  // Confirmation dialog with sanitized URL display
  const displayUrl = formatUrl(url);
  if (confirm(`Are you sure you want to add "${displayUrl}" to the whitelist?`)) {
    try {
      // Make API call to add URL to whitelist with auth token
      const token = Auth.getToken();
      if (!token) {
        showAlert('Authentication required', 'error');
        return;
      }
      
      listsAPI.addToWhitelist(url, token).then(() => {
        showAlert(`Added ${displayUrl} to whitelist`, 'success');
      }).catch(error => {
        console.error('Error adding to whitelist:', error);
        showAlert('Failed to add URL to whitelist', 'error');
      });
    } catch (error) {
      console.error('Error adding to whitelist:', error);
      showAlert('Failed to add URL to whitelist', 'error');
    }
  }
}

function addToBlacklist(url) {
  // Hide modal first
  hideModal('vote-modal');
  
  // Confirmation dialog with sanitized URL display
  const displayUrl = formatUrl(url);
  if (confirm(`Are you sure you want to add "${displayUrl}" to the blacklist?`)) {
    try {
      // Make API call to add URL to blacklist with auth token
      const token = Auth.getToken();
      if (!token) {
        showAlert('Authentication required', 'error');
        return;
      }
      
      listsAPI.addToBlacklist(url, token).then(() => {
        showAlert(`Added ${displayUrl} to blacklist`, 'success');
      }).catch(error => {
        console.error('Error adding to blacklist:', error);
        showAlert('Failed to add URL to blacklist', 'error');
      });
    } catch (error) {
      console.error('Error adding to blacklist:', error);
      showAlert('Failed to add URL to blacklist', 'error');
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
    
    // Initialize with data from API
    await Promise.all([
      loadVoteStats(),
      loadVoteData()
    ]);
    
    console.log('Votes management initialized successfully');
  } catch (error) {
    console.error('Votes management initialization error:', error);
    showAlert('Failed to initialize votes management', 'error');
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
    
    // Fetch vote statistics from API with auth token
    const token = Auth.getToken();
    if (!token) {
      throw new Error('Authentication required');
    }
    
    let stats;
    try {
      stats = await votesAPI.getStats(token);
      console.log('Vote stats received:', stats);
    } catch (apiError) {
      console.error('API error in vote stats:', apiError);
      throw apiError;
    }
    
    // Update statistics in the UI - use "positiveCount" and "negativeCount" from API
    document.getElementById('total-votes').textContent = stats.total || 0;
    document.getElementById('positive-votes').textContent = stats.positiveCount || 0;
    document.getElementById('negative-votes').textContent = stats.negativeCount || 0;
    
    // Calculate today's vote count with better date handling
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    console.log('Looking for today\'s votes with date:', today);
    
    let todayVotes = 0;
    
    // First try from recentActivity if available
    if (stats.recentActivity && Array.isArray(stats.recentActivity)) {
      console.log('Recent activity data:', stats.recentActivity);
      
      // handling different possible date formats
      const todayEntry = stats.recentActivity.find(item => {
        // Handle different date formats that might come from the API
        const itemDate = item.date ? item.date.split('T')[0] : null;
        return itemDate === today;
      });
      
      if (todayEntry && typeof todayEntry.count === 'number') {
        todayVotes = todayEntry.count;
        console.log('Found today\'s votes in recent activity:', todayVotes);
      } else {
        console.log('No entry found for today in recent activity, fetching raw votes');
        
        // Fallback: Calculate from raw votes
        try {
          const rawVotes = await votesAPI.getVotes(token);
          
          if (Array.isArray(rawVotes)) {
            // Count votes from today
            todayVotes = rawVotes.filter(vote => {
              const voteDate = new Date(vote.Timestamp || vote.timestamp);
              if (isNaN(voteDate)) return false;
              
              const voteDateStr = voteDate.toISOString().split('T')[0];
              return voteDateStr === today;
            }).length;
            
            console.log('Calculated today\'s votes from raw data:', todayVotes);
          }
        } catch (error) {
          console.error('Error fetching raw votes for today\'s count:', error);
        }
      }
    } else {
      console.log('No recent activity data available, calculating from raw votes');
      
      // If recentActivity is not available, fetch raw votes and calculate
      try {
        const rawVotes = await votesAPI.getVotes(token);
        
        if (Array.isArray(rawVotes)) {
          // Count votes from today
          todayVotes = rawVotes.filter(vote => {
            const voteDate = new Date(vote.Timestamp || vote.timestamp);
            if (isNaN(voteDate)) return false;
            
            const voteDateStr = voteDate.toISOString().split('T')[0];
            return voteDateStr === today;
          }).length;
          
          console.log('Calculated today\'s votes from raw data:', todayVotes);
        }
      } catch (error) {
        console.error('Error fetching raw votes for today\'s count:', error);
      }
    }
    
    // Update the UI with today's vote count
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
    
    // Get auth token
    const token = Auth.getToken();
    if (!token) {
      throw new Error('Authentication required');
    }
    
    // Fetch raw votes from the database through API
    const rawVotes = await votesAPI.getVotes(token);
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
        const positiveVotes = parseInt(vote.positiveVotes || 0);
        const negativeVotes = parseInt(vote.negativeVotes || 0);
        const totalVotes = positiveVotes + negativeVotes;
        const positivePercentage = totalVotes > 0 ? Math.round((positiveVotes / totalVotes) * 100) : 0;
        const negativePercentage = 100 - positivePercentage;
        
        // Determine ratio class
        let ratioClass = 'ratio-neutral';
        if (positivePercentage > 70) ratioClass = 'ratio-positive';
        else if (negativePercentage > 70) ratioClass = 'ratio-negative';
        else if (Math.abs(positivePercentage - negativePercentage) < 20) ratioClass = 'ratio-contested';
        
        // Get score value properly - handle 0 as a valid value
        const score = vote.score !== null && vote.score !== undefined ? vote.score : 'N/A';
        
        // Determine score class based on prediction instead of value
        let scoreClass = 'score-medium'; // default/neutral
        if (vote.prediction === 'Phishing') {
          scoreClass = 'score-low'; // red color for phishing prediction
        } else if (vote.prediction === 'Safe') {
          scoreClass = 'score-high'; // green color for safe prediction
        }
        
        // Determine prediction display - use original prediction value
        let predictionDisplay = 'No prediction';
        let predictionClass = 'badge-secondary';
        
        if (vote.prediction) {
          // Show original prediction value (not mapped)
          predictionDisplay = vote.prediction;
          
          if (vote.prediction === 'Safe') {
            predictionClass = 'badge-success';
          } else if (vote.prediction === 'Phishing') {
            predictionClass = 'badge-danger';
          } else {
            predictionClass = 'badge-warning';
          }
        }
        
        // Create row with proper sanitization
        const row = document.createElement('tr');
        const urlDisplay = vote.url ? vote.url : 'Unknown URL';
        
        // Use innerHTML but with sanitized content
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
            <span class="prediction-badge ${predictionClass}">
              ${escapeHtml(predictionDisplay)}
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
      if (url && validateUrl(url)) {
        showVoteDetails(url);
      } else {
        showAlert('Invalid URL data', 'warning');
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
    
    // Extract prediction and score data
    const predictionShown = vote.PredictionShown || vote.predictionShown || null;
    const predictionScore = vote.PredictionScore !== undefined ? vote.PredictionScore : 
                           vote.predictionScore !== undefined ? vote.predictionScore : null;
    
    if (!url) return; // Skip votes without URL
    
    // Get or create summary for this URL
    let summary = votesByUrl.get(url);
    if (!summary) {
      summary = {
        url: url,
        positiveVotes: 0,
        negativeVotes: 0,
        prediction: predictionShown,
        score: predictionScore,
        lastVote: null,
        firstVote: null,
        votes: []
      };
      votesByUrl.set(url, summary);
    }
    
    // Count votes by type - use Positive/Negative terminology
    if (voteType === 'Positive' || voteType === 'Safe') {
      summary.positiveVotes++;
    } else if (voteType === 'Negative' || voteType === 'Phishing') {
      summary.negativeVotes++;
    }
    
    // Update prediction and score if not already set
    if (!summary.prediction && predictionShown) {
      summary.prediction = predictionShown;
    }
    
    if (summary.score === null && predictionScore !== null && predictionScore !== undefined) {
      summary.score = predictionScore;
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
      timestamp: timestamp,
      prediction: predictionShown,
      score: predictionScore
    });
  });
  
  // Convert map to array and sort by total votes (descending)
  const voteArray = Array.from(votesByUrl.values());
  voteArray.sort((a, b) => {
    const totalA = a.positiveVotes + a.negativeVotes;
    const totalB = b.positiveVotes + b.negativeVotes;
    return totalB - totalA;
  });
  
  // Format scores for display - handle 0 properly
  voteArray.forEach(vote => {
    if (vote.score !== null && vote.score !== undefined) {
      // Format to one decimal place
      vote.score = parseFloat(vote.score).toFixed(1);
    }
  });
  
  console.log('Processed vote summaries with prediction data:', voteArray);
  return voteArray;
}

/**
 * Filter vote data based on selected criteria
 */
function filterVoteData(voteSummaries, filter) {
  return voteSummaries.filter(vote => {
    const positiveVotes = parseInt(vote.positiveVotes || 0);
    const negativeVotes = parseInt(vote.negativeVotes || 0);
    const totalVotes = positiveVotes + negativeVotes;
    if (totalVotes === 0) return false;
    const positivePercentage = Math.round((positiveVotes / totalVotes) * 100);
    const negativePercentage = 100 - positivePercentage;
    switch (filter) {
      case 'positive-majority':
        return positivePercentage > 60;
      case 'negative-majority':
        return negativePercentage > 60;
      case 'contested':
        return Math.abs(positivePercentage - negativePercentage) < 20;
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
      const totalA = (a.positiveVotes || 0) + (a.negativeVotes || 0);
      const totalB = (b.positiveVotes || 0) + (b.negativeVotes || 0);
      return totalB - totalA;
    })[0];
    
    // Find most contested URL (closest to 50/50)
    const mostContested = [...voteSummaries].sort((a, b) => {
      const totalA = (a.positiveVotes || 0) + (a.negativeVotes || 0);
      const totalB = (b.positiveVotes || 0) + (b.negativeVotes || 0);
      if (totalA === 0) return 1;
      if (totalB === 0) return -1;
      const positivePercentA = (a.positiveVotes || 0) / totalA;
      const positivePercentB = (b.positiveVotes || 0) / totalB;
      return Math.abs(positivePercentA - 0.5) - Math.abs(positivePercentB - 0.5);
    })[0];
    
    // Find most reported as negative
    const mostNegative = [...voteSummaries]
      .filter(v => (v.negativeVotes || 0) > 0)
      .sort((a, b) => (b.negativeVotes || 0) - (a.negativeVotes || 0))[0];
    
    // Find most reported as positive
    const mostPositive = [...voteSummaries]
      .filter(v => (v.positiveVotes || 0) > 0)
      .sort((a, b) => (b.positiveVotes || 0) - (a.positiveVotes || 0))[0];
    
    // Update UI elements with safe URL display
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
    const totalVotes = (voteSummary.positiveVotes || 0) + (voteSummary.negativeVotes || 0);
    const positivePercent = totalVotes > 0 ? Math.round((voteSummary.positiveVotes / totalVotes) * 100) : 50;
    const negativePercent = 100 - positivePercent;
    
    // Determine accuracy status based on extension prediction
    const prediction = voteSummary.prediction || 'No prediction';
    let accuracyClass = 'neutral';
    let accuracyText = 'No prediction data available';
    if (voteSummary.prediction) {
      // Use terminology mapping for consistency
      const predictionMapped = voteSummary.prediction === 'Safe' ? 'Positive' : 
                               voteSummary.prediction === 'Phishing' ? 'Negative' : 
                               voteSummary.prediction;
      
      if ((predictionMapped === 'Positive' && positivePercent >= 60) ||
          (predictionMapped === 'Negative' && negativePercent >= 60)) {
        accuracyClass = 'success';
        accuracyText = `Prediction was correct with ${
          predictionMapped === 'Positive' ? positivePercent : negativePercent
        }% user agreement`;
      } else if ((predictionMapped === 'Positive' && positivePercent < 40) || 
                (predictionMapped === 'Negative' && negativePercent < 40)) {
        accuracyClass = 'danger';
        accuracyText = 'Prediction differs from majority user opinion';
      } else {
        accuracyClass = 'warning';
        accuracyText = 'User opinion is mixed on this prediction';
      }
    }
    
    // Convert prediction display names - keep original prediction value
    let displayPrediction = 'No prediction';
    let predictionClass = 'badge-secondary';
    
    if (voteSummary.prediction) {
      // Show original prediction
      displayPrediction = voteSummary.prediction;
      
      if (voteSummary.prediction === 'Safe') {
        predictionClass = 'badge-success';
      } else if (voteSummary.prediction === 'Phishing') {
        predictionClass = 'badge-danger';
      } else {
        predictionClass = 'badge-warning';
      }
    }
    
    // Get score with proper formatting (handle 0)
    const score = voteSummary.score !== null && voteSummary.score !== undefined ? voteSummary.score : 'N/A';
    
    // Set score class based on prediction rather than value
    let scoreClass = 'score-medium'; // default/neutral
    if (voteSummary.prediction === 'Phishing') {
      scoreClass = 'score-low'; // red color for phishing prediction
    } else if (voteSummary.prediction === 'Safe') {
      scoreClass = 'score-high'; // green color for safe prediction
    }
    
    // Update the modal with enhanced content using consistent terminology
    const modalContent = `
      <div class="url-details">
        <h4>URL Information</h4>
        <p id="vote-url" class="vote-url">${escapeHtml(url)}</p>
        <div class="prediction-section">
          <h4>Extension Prediction</h4>
          <div class="prediction-result">
            <span class="prediction-badge ${predictionClass}">
              ${escapeHtml(displayPrediction)}
            </span>
            <p class="accuracy-text ${accuracyClass}">${escapeHtml(accuracyText)}</p>
            <div class="score-display" style="margin-top: 10px;">
              <span class="detail-label">Risk Score:</span>
              <span class="score-value ${scoreClass}">${score}</span>
              <span class="help-text" style="margin-left: 5px;">(Higher values indicate higher risk level)</span>
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
              <span id="detail-safe-votes" class="detail-value">${voteSummary.positiveVotes || 0}</span>
            </div>
            <div class="vote-detail-item">
              <span class="detail-label">Negative Votes:</span>
              <span id="detail-phishing-votes" class="detail-value">${voteSummary.negativeVotes || 0}</span>
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
      if (validateUrl(url)) {
        addToWhitelist(url);
      } else {
        showAlert('Invalid URL cannot be added to whitelist', 'warning');
      }
    });
    
    document.getElementById('blacklist-voted-url')?.addEventListener('click', () => {
      if (validateUrl(url)) {
        addToBlacklist(url);
      } else {
        showAlert('Invalid URL cannot be added to blacklist', 'warning');
      }
    });
    
  } catch (error) {
    console.error('Error showing vote details:', error);
    showAlert('Failed to load vote details', 'error');
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
    if (!url || url === '-') return url;
    
    const parsed = new URL(url);
    return parsed.hostname + parsed.pathname;
  } catch (error) {
    console.warn('URL parsing error:', error);
    // Return url but truncate if it's too long
    return url.length > 50 ? url.substring(0, 47) + '...' : url;
  }
}

function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById('system-alert');
  if (alertContainer) {
    // Sanitize message
    const sanitizedMessage = escapeHtml(message);
    alertContainer.textContent = sanitizedMessage;
    alertContainer.className = `alert alert-${type}`;
    alertContainer.style.display = 'block';
    
    // Auto-hide non-error alerts
    if (type !== 'error' && type !== 'danger') {
      setTimeout(() => {
        alertContainer.style.display = 'none';
      }, 5000);
    }
  }
}

function formatDate(date) {
  if (!date) return 'Unknown';
  try {
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) return 'Invalid Date';
    return parsedDate.toLocaleDateString() + ' ' + parsedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Error';
  }
}