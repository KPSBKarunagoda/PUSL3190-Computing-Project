/**
 * Dedicated voting system module for PhishGuard
 * Handles all vote-related functionality in a centralized way
 */

class VotingSystem {
  constructor(elements) {
    this.elements = elements;
    this.currentPrediction = null; // Store the current prediction
    this.currentScore = null;      // Store the prediction score
    this.currentUrl = null;
    this.isVoting = false;
    this.currentVoteState = null;
    this.setupListeners();
    
    // Debug current prediction data
    console.log('VotingSystem initialized with prediction:', this.currentPrediction, 'score:', this.currentScore);
  }

  // Set the current prediction so we know what feedback means
  setPrediction(prediction, score) {
    console.log('setPrediction called with:', prediction, score);
    this.currentPrediction = prediction;
    this.currentScore = score;
    
    // Update the UI to show what we're getting feedback on
    if (this.elements.predictionResult) {
      this.elements.predictionResult.textContent = prediction;
      this.elements.predictionResult.className = 'prediction-badge ' + 
        (prediction === 'Safe' ? 'badge-success' : prediction === 'Phishing' ? 'badge-danger' : 'badge-warning');
    }
    
    console.log('Updated VotingSystem prediction data:', this.currentPrediction, this.currentScore);
  }

  /**
   * Set up the vote button event listeners - reverted to previous safe/phishing approach
   */
  setupListeners() {
    if (!this.elements.voteUp || !this.elements.voteDown) return;
    
    // Change back to Safe/Phishing to match the original behavior
    this.elements.voteUp.addEventListener('click', () => this.handleVote('Safe'));
    this.elements.voteDown.addEventListener('click', () => this.handleVote('Phishing'));
    
    // Listen for auth state changes from background script
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'authStateChanged') {
        console.log('Auth state changed, resetting vote UI');
        this.resetVoteUI();
      }
      
      // Handle vote responses
      if (message.action === 'voteRecorded') {
        this.handleVoteSuccess(message);
      }
      
      if (message.action === 'voteRejected') {
        this.handleVoteError(message);
      }
      
      if (message.action === 'voteCounts') {
        this.updateVoteCounts(message);
      }
    });
  }

  /**
   * Initialize the voting component with the current URL
   * @param {string} url Current page URL
   */
  async init(url) {
    console.log('Initializing voting for:', url);
    this.currentUrl = url;
    this.resetVoteUI();
    
    try {
      // Get auth state first
      const authState = await this.getAuthState();
      console.log('Auth state during voting init:', authState.isLoggedIn);
      
      // IMPROVEMENT: Get vote counts directly from server first for immediate display
      await this.fetchVoteCountsDirectly(url);
      
      // As a fallback, check local storage
      await this.loadStoredVotes(url, authState.isLoggedIn);
      
    } catch (error) {
      console.error('Error initializing voting:', error);
    }
  }
  
  /**
   * Directly fetch vote counts from the server
   * @param {string} url Current URL
   */
  async fetchVoteCountsDirectly(url) {
    return new Promise((resolve) => {
      console.log('Directly requesting vote counts for immediate display');
      
      chrome.runtime.sendMessage(
        { 
          action: 'getVoteCountsImmediate', 
          url: url 
        },
        response => {
          if (response && response.success) {
            console.log('Got immediate vote counts:', response);
            
            // Update UI with fresh data
            const voteData = {
              safe: response.counts?.safe || 0,
              phishing: response.counts?.phishing || 0,
              userVote: response.userVote || null
            };
            
            // Get auth state and update UI
            this.getAuthState().then(authState => {
              this.updateUIFromData(voteData, authState.isLoggedIn);
              
              // Save to storage
              chrome.storage.local.get(['voteCounts'], (data) => {
                const voteCounts = data.voteCounts || {};
                voteCounts[url] = {
                  ...voteData,
                  lastUpdated: Date.now()
                };
                chrome.storage.local.set({ 
                  voteCounts,
                  voteLastChecked: Date.now()
                });
              });
            });
          } else {
            console.log('No immediate vote data available');
          }
          resolve();
        }
      );
      
      // Don't wait forever for a response
      setTimeout(resolve, 2000);
    });
  }
  
  /**
   * Load stored votes from cache - updated to handle the original UI model
   * @param {string} url Current URL
   * @param {boolean} isLoggedIn Whether user is logged in
   */
  async loadStoredVotes(url, isLoggedIn) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['voteCounts'], (data) => {
        if (data.voteCounts && data.voteCounts[url]) {
          const voteData = data.voteCounts[url];
          console.log('Found stored vote data:', voteData);
          
          // Always show the vote counts
          if (this.elements.upvotes) {
            this.elements.upvotes.textContent = voteData.safe || 0;
          }
          
          if (this.elements.downvotes) {
            this.elements.downvotes.textContent = voteData.phishing || 0;
          }
          
          // Only highlight the user's vote if they are logged in
          if (isLoggedIn && voteData.userVote) {
            this.currentVoteState = voteData.userVote;
            
            // Reset both buttons first
            this.elements.voteUp.classList.remove('active');
            this.elements.voteDown.classList.remove('active');
            
            // Then highlight the appropriate button
            if (voteData.userVote === 'Safe') {
              this.elements.voteUp.classList.add('active');
            } else if (voteData.userVote === 'Phishing') {
              this.elements.voteDown.classList.add('active');
            }
          } else {
            // Ensure buttons aren't highlighted when not logged in
            this.elements.voteUp.classList.remove('active');
            this.elements.voteDown.classList.remove('active');
            this.currentVoteState = null;
          }
        }
        resolve();
      });
    });
  }
  
  /**
   * Request fresh votes if needed
   * @param {string} url Current URL
   */
  async requestFreshVotes(url) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['voteLastChecked'], (data) => {
        const lastChecked = data.voteLastChecked || 0;
        const now = Date.now();
        const MIN_CHECK_INTERVAL = 30000; // 30 seconds
        
        if (now - lastChecked > MIN_CHECK_INTERVAL) {
          console.log('Requesting fresh vote counts');
          chrome.storage.local.set({ voteLastChecked: now });
          
          chrome.runtime.sendMessage({
            action: 'getVoteCountsNoResponse',
            url: url
          });
        } else {
          console.log('Skipping vote count request - too soon since last check');
        }
        resolve();
      });
    });
  }
  
  /**
   * Get the current authentication state - Simplified version
   * @returns {Promise} Authentication state object
   */
  getAuthState() {
    return new Promise((resolve) => {
      // Just check local storage directly to avoid race conditions
      chrome.storage.local.get(['isLoggedIn', 'authToken', 'userData'], (data) => {
        resolve({
          isLoggedIn: !!data.isLoggedIn && !!data.authToken,
          token: data.authToken,
          userData: data.userData
        });
      });
    });
  }
  
  /**
   * Update UI from vote data - improved to handle Safe/Phishing consistently
   */
  updateUIFromData(voteData, isLoggedIn) {
    console.log('Updating vote UI with data:', voteData, 'isLoggedIn:', isLoggedIn);
    
    // Always update vote counts - IMPROVED: handle undefined/null cases better
    if (this.elements.upvotes) {
      const safeCount = typeof voteData.safe === 'number' ? voteData.safe : 0;
      this.elements.upvotes.textContent = safeCount;
    }
    
    if (this.elements.downvotes) {
      const phishingCount = typeof voteData.phishing === 'number' ? voteData.phishing : 0;
      this.elements.downvotes.textContent = phishingCount;
    }
    
    // Only show active state for user's vote if logged in
    if (isLoggedIn && voteData.userVote) {
      this.currentVoteState = voteData.userVote;
      
      // Make sure to reset both buttons first
      this.elements.voteUp.classList.remove('active');
      this.elements.voteDown.classList.remove('active');
      
      // Then add the active class to the appropriate button
      if (voteData.userVote === 'Safe') {
        this.elements.voteUp.classList.add('active');
        console.log('Setting SAFE button active');
      } else if (voteData.userVote === 'Phishing') {
        this.elements.voteDown.classList.add('active');
        console.log('Setting PHISHING button active');
      }
    } else {
      // Reset active state if not logged in
      this.elements.voteUp.classList.remove('active');
      this.elements.voteDown.classList.remove('active');
      this.currentVoteState = null;
    }
  }
  
  /**
   * Handle voting action - simplified without feedbackType
   * @param {string} voteType 'Safe' or 'Phishing'
   */
  async handleVote(voteType) {
    if (!this.currentUrl) {
      console.error('Cannot vote without URL context');
      return;
    }
    
    // Prevent rapid clicking
    if (this.isVoting) return;
    this.isVoting = true;
    
    try {
      // Check auth state
      const authState = await this.getAuthState();
      
      if (!authState.isLoggedIn) {
        this.showLoginRequiredMessage();
        this.isVoting = false;
        return;
      }
      
      // Check if this is the same as the current vote
      if (this.currentVoteState === voteType) {
        console.log(`Already voted ${voteType}, ignoring`);
        this.isVoting = false;
        return;
      }
      
      // Get current vote counts
      const safeCount = parseInt(this.elements.upvotes.textContent || '0');
      const phishingCount = parseInt(this.elements.downvotes.textContent || '0');
      
      // Calculate new counts
      let newCounts = {
        safe: safeCount,
        phishing: phishingCount
      };
      
      if (voteType === 'Safe') {
        newCounts.safe++;
        // If changing vote from phishing to safe
        if (this.currentVoteState === 'Phishing') {
          newCounts.phishing = Math.max(0, phishingCount - 1);
        }
      } else {
        newCounts.phishing++;
        // If changing vote from safe to phishing
        if (this.currentVoteState === 'Safe') {
          newCounts.safe = Math.max(0, safeCount - 1);
        }
      }
      
      // Update UI optimistically
      this.elements.upvotes.textContent = newCounts.safe;
      this.elements.downvotes.textContent = newCounts.phishing;
      
      if (voteType === 'Safe') {
        this.elements.voteUp.classList.add('active');
        this.elements.voteDown.classList.remove('active');
      } else {
        this.elements.voteDown.classList.add('active');
        this.elements.voteUp.classList.remove('active');
      }
      
      // Show feedback message
      const message = voteType === 'Safe' 
        ? 'Thank you for your feedback! You marked this site as safe.'
        : 'Thank you for your feedback! You marked this site as suspicious.';
      
      this.showMessage(message);
      
      // Store optimistic update
      this.currentVoteState = voteType;
      chrome.storage.local.get(['voteCounts'], (data) => {
        const voteCounts = data.voteCounts || {};
        voteCounts[this.currentUrl] = {
          safe: newCounts.safe,
          phishing: newCounts.phishing,
          userVote: voteType,
          lastUpdated: Date.now()
        };
        chrome.storage.local.set({ voteCounts });
      });
      
      // Log the current prediction data before voting
      console.log('Before voting - prediction:', this.currentPrediction, 'score:', this.currentScore);
      
      // Default values if somehow missing
      const predictionToSend = this.currentPrediction || 'Unknown';
      const scoreToSend = this.currentScore !== null ? this.currentScore : 0;
      
      // Map UI vote types to backend vote types
      const backendVoteType = voteType === 'Safe' ? 'Positive' : 'Negative';
      
      // Send vote to background script without feedbackType
      console.log(`Sending vote ${voteType} (backend: ${backendVoteType}) with prediction ${predictionToSend} and score ${scoreToSend}`);
      
      chrome.runtime.sendMessage({
        action: 'voteNoResponse',
        url: this.currentUrl,
        voteType: backendVoteType, // Send Positive/Negative to backend
        predictionShown: predictionToSend,
        predictionScore: scoreToSend,
        uiVoteType: voteType // Include original UI vote type
      });
    } catch (error) {
      console.error('Error handling vote:', error);
      this.showMessage('Error submitting your vote. Please try again.', true);
    } finally {
      // Re-enable voting after delay
      setTimeout(() => {
        this.isVoting = false;
      }, 1000);
    }
  }
  
  /**
   * Handle successful vote
   */
  handleVoteSuccess(message) {
    if (message.url !== this.currentUrl) return;
    
    // Use UI vote type if available, otherwise use the original vote type
    const voteType = message.uiVoteType || message.voteType;
    
    if (voteType) {
      this.currentVoteState = voteType;
      
      // Update UI if needed
      this.elements.voteUp.classList.toggle('active', voteType === 'Safe');
      this.elements.voteDown.classList.toggle('active', voteType === 'Phishing');
    }
    
    console.log('Vote confirmed by server');
  }
  
  /**
   * Handle vote error
   * @param {Object} message Vote error message
   */
  handleVoteError(message) {
    // Handle errors from background script
    if (message.reason === 'authentication') {
      this.showLoginRequiredMessage();
      this.resetVoteUI();
    } else {
      this.showMessage('Failed to record your vote. Please try again.', true);
    }
  }
  
  /**
   * Update vote counts from server data
   */
  updateVoteCounts(message) {
    if (message.url !== this.currentUrl) return;
    
    console.log('Received server vote counts:', message);
    
    this.getAuthState().then(authState => {
      // Update vote counts
      if (this.elements.upvotes) {
        this.elements.upvotes.textContent = message.counts?.safe || 0;
      }
      
      if (this.elements.downvotes) {
        this.elements.downvotes.textContent = message.counts?.phishing || 0;
      }
      
      // Only update user vote UI if logged in
      if (authState.isLoggedIn && message.userVote) {
        // Convert from backend vote type if needed
        let uiVoteType = message.userVote;
        
        // Handle potential mappings from backend
        if (message.userVote === 'Positive') uiVoteType = 'Safe';
        if (message.userVote === 'Negative') uiVoteType = 'Phishing';
        
        this.currentVoteState = uiVoteType;
        
        // Reset button states
        this.elements.voteUp.classList.remove('active');
        this.elements.voteDown.classList.remove('active');
        
        // Set the appropriate active state
        if (uiVoteType === 'Safe') {
          this.elements.voteUp.classList.add('active');
        } else if (uiVoteType === 'Phishing') {
          this.elements.voteDown.classList.add('active');
        }
      } else if (!authState.isLoggedIn) {
        // Clear button states if not logged in
        this.elements.voteUp.classList.remove('active');
        this.elements.voteDown.classList.remove('active');
        this.currentVoteState = null;
      }
    });
  }
  
  /**
   * Reset the voting UI completely
   */
  resetVoteUI() {
    // Reset vote buttons
    this.elements.voteUp.classList.remove('active');
    this.elements.voteDown.classList.remove('active');
    this.currentVoteState = null;
  }
  
  /**
   * Show login required message
   */
  showLoginRequiredMessage() {
    // Find the voting section instead of popup content
    const votingSection = document.querySelector('.voting-section') || 
                          document.querySelector('.vote-buttons-container') || 
                          this.elements.voteUp.closest('.card-section');
    
    // Create a container for the message that respects boundaries
    const messageContainer = document.createElement('div');
    messageContainer.style.cssText = 'width: 100%; position: relative; overflow: hidden;';
    
    // Remove any existing messages
    const existingMessages = document.querySelectorAll('.login-required-message');
    existingMessages.forEach(el => el.remove());
    
    // Create message with improved compact design and enhanced button
    const messageElement = document.createElement('div');
    messageElement.className = 'login-required-message notification-message';
    messageElement.innerHTML = `
      <div class="message-content">
        <i class="fas fa-lock message-icon"></i>
        <div class="login-message-text">
          <p><strong>Login Required</strong></p>
        </div>
      </div>
      <button class="login-now-btn">
        <span class="login-btn-text">Log in</span>
        <i class="fas fa-arrow-right login-btn-icon"></i>
      </button>
    `;
    
    // Add message to container
    messageContainer.appendChild(messageElement);
    
    // Insert container above the voting section
    if (votingSection) {
      votingSection.parentNode.insertBefore(messageContainer, votingSection);
    } else {
      // Fallback to the result container
      const resultContainer = this.elements.resultContainer;
      if (resultContainer) {
        resultContainer.insertAdjacentElement('afterbegin', messageContainer);
      }
    }
    
    // Add click handler
    const loginButton = messageElement.querySelector('.login-now-btn');
    if (loginButton) {
      loginButton.addEventListener('click', () => {
        chrome.tabs.create({ url: 'http://localhost:3000/login.html' });
      });
    }
    
    // Animate in and auto-remove with improved timing
    setTimeout(() => messageElement.classList.add('visible'), 10);
    setTimeout(() => {
      messageElement.classList.remove('visible');
      setTimeout(() => {
        messageContainer.remove();
      }, 500);
    }, 6000);
  }
  
  /**
   * Show message to user
   * @param {string} message Message text
   * @param {boolean} isError Whether this is an error message
   */
  showMessage(message, isError = false) {
    const { resultContainer } = this.elements;
    if (!resultContainer) return;
    
    // Create notification element
    const messageElement = document.createElement('div');
    messageElement.className = `notification-message ${isError ? 'error-message' : ''}`;
    messageElement.innerHTML = `
      <div class="message-content">
        <i class="fas fa-${isError ? 'exclamation-circle' : 'check-circle'} message-icon"></i>
        <p>${message}</p>
      </div>
    `;
    
    // Add to DOM
    if (resultContainer.firstChild) {
      resultContainer.insertBefore(messageElement, resultContainer.firstChild);
    } else {
      resultContainer.appendChild(messageElement);
    }
    
    // Animate in and auto-remove
    setTimeout(() => messageElement.classList.add('visible'), 10);
    setTimeout(() => messageElement.classList.remove('visible'), 4000);
    setTimeout(() => messageElement.remove(), 4500);
  }
}

// Export the voting system
window.VotingSystem = VotingSystem;
