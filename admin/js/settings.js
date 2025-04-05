/**
 * PhishGuard Admin - Settings Management
 * Handles system settings configuration
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Only initialize on settings page
  if (!window.location.pathname.includes('settings.html')) {
    return;
  }
  
  console.log('Initializing settings management...');
  
  // Initialize DOM elements
  const elements = {
    settingsForm: DOM.get('settings-form'),
    saveSettingsBtn: DOM.get('save-settings-btn'),
    resetSettingsBtn: DOM.get('reset-settings-btn'),
    maintenanceBtn: DOM.get('run-maintenance-btn'),
    scanThreshold: DOM.get('scan-threshold'),
    thresholdValue: DOM.get('threshold-value'),
    safeBrowsingToggle: DOM.get('safe-browsing-toggle'),
    autoUpdateToggle: DOM.get('auto-update-toggle'),
    loggingLevelSelect: DOM.get('logging-level')
  };
  
  // Set up event listeners
  elements.settingsForm?.addEventListener('submit', saveSettings);
  elements.resetSettingsBtn?.addEventListener('click', resetSettings);
  elements.maintenanceBtn?.addEventListener('click', runMaintenance);
  
  // Update threshold display when slider changes
  if (elements.scanThreshold && elements.thresholdValue) {
    elements.scanThreshold.addEventListener('input', () => {
      elements.thresholdValue.textContent = elements.scanThreshold.value;
    });
  }
  
  // Load initial settings
  try {
    await loadSettings();
  } catch (error) {
    console.error('Error initializing settings:', error);
    DOM.showAlert('Failed to load settings: ' + error.message, 'danger');
  }
  
  // Load system settings
  async function loadSettings() {
    try {
      // Show loading state
      DOM.buttonState(elements.saveSettingsBtn, true, null, 'Loading...');
      
      // Get settings from API
      const settings = await fetch('api/admin/settings', {
        headers: { 'x-auth-token': Auth.getToken() }
      }).then(res => res.json());
      
      // Populate form fields
      if (elements.scanThreshold) {
        elements.scanThreshold.value = settings.scanThreshold || 70;
        elements.thresholdValue.textContent = elements.scanThreshold.value;
      }
      
      if (elements.safeBrowsingToggle) {
        elements.safeBrowsingToggle.checked = settings.safeBrowsingEnabled !== false;
      }
      
      if (elements.autoUpdateToggle) {
        elements.autoUpdateToggle.checked = settings.autoUpdate !== false;
      }
      
      if (elements.loggingLevelSelect) {
        elements.loggingLevelSelect.value = settings.loggingLevel || 'info';
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      DOM.showAlert('Failed to load settings: ' + error.message, 'danger');
    } finally {
      DOM.buttonState(elements.saveSettingsBtn, false);
    }
  }
  
  // Save settings
  async function saveSettings(e) {
    if (e) e.preventDefault();
    
    try {
      // Show loading state
      DOM.buttonState(elements.saveSettingsBtn, true, null, 'Saving...');
      
      // Get settings from form
      const settings = {
        scanThreshold: parseInt(elements.scanThreshold?.value || 70),
        safeBrowsingEnabled: elements.safeBrowsingToggle?.checked !== false,
        autoUpdate: elements.autoUpdateToggle?.checked !== false,
        loggingLevel: elements.loggingLevelSelect?.value || 'info'
      };
      
      // Save settings to API
      await fetch('api/admin/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-auth-token': Auth.getToken() 
        },
        body: JSON.stringify(settings)
      }).then(res => {
        if (!res.ok) throw new Error('Failed to save settings');
        return res.json();
      });
      
      DOM.showAlert('Settings saved successfully', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      DOM.showAlert('Failed to save settings: ' + error.message, 'danger');
    } finally {
      DOM.buttonState(elements.saveSettingsBtn, false);
    }
  }
  
  // Reset settings to defaults
  function resetSettings(e) {
    if (e) e.preventDefault();
    
    if (!confirm('Are you sure you want to reset all settings to default values?')) {
      return;
    }
    
    // Set default values
    if (elements.scanThreshold) {
      elements.scanThreshold.value = 70;
      elements.thresholdValue.textContent = '70';
    }
    
    if (elements.safeBrowsingToggle) {
      elements.safeBrowsingToggle.checked = true;
    }
    
    if (elements.autoUpdateToggle) {
      elements.autoUpdateToggle.checked = true;
    }
    
    if (elements.loggingLevelSelect) {
      elements.loggingLevelSelect.value = 'info';
    }
    
    // Save to server
    saveSettings();
  }
  
  // Run system maintenance
  async function runMaintenance() {
    if (!confirm('Are you sure you want to run system maintenance? This may take a few moments.')) {
      return;
    }
    
    try {
      // Show loading state
      DOM.buttonState(elements.maintenanceBtn, true, null, 'Running...');
      DOM.showAlert('Maintenance task started. Please wait...', 'info');
      
      // Call maintenance API
      const response = await fetch('api/admin/maintenance', {
        method: 'POST',
        headers: { 'x-auth-token': Auth.getToken() }
      });
      
      if (!response.ok) {
        throw new Error('Maintenance task failed');
      }
      
      const result = await response.json();
      
      // Show success message
      DOM.showAlert('Maintenance completed successfully: ' + (result.message || 'System optimized'), 'success');
    } catch (error) {
      console.error('Maintenance error:', error);
      DOM.showAlert('Maintenance error: ' + error.message, 'danger');
    } finally {
      DOM.buttonState(elements.maintenanceBtn, false);
    }
  }
});
