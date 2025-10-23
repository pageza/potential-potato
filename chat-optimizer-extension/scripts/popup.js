/**
 * Popup Script - Handles UI for extension popup
 */

let port;
let currentConfig = {};
let currentStats = {};

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  // Connect to background script
  port = chrome.runtime.connect({ name: 'popup' });

  // Set up message listener
  port.onMessage.addListener((message) => {
    if (message.type === 'stats') {
      updateStats(message.data);
    } else if (message.type === 'config') {
      updateConfigUI(message.data);
    } else if (message.type === 'configUpdated') {
      showNotification('Settings saved!');
    } else if (message.type === 'statsReset') {
      showNotification('Statistics reset!');
      loadStats();
    }
  });

  // Load initial data
  loadConfig();
  loadStats();

  // Set up event listeners
  setupEventListeners();

  // Auto-refresh stats
  setInterval(loadStats, 2000);
});

function loadConfig() {
  port.postMessage({ type: 'getConfig' });
}

function loadStats() {
  port.postMessage({ type: 'getStats' });
}

function setupEventListeners() {
  // Enable toggle
  const enabledToggle = document.getElementById('enabled');
  enabledToggle.addEventListener('change', (e) => {
    currentConfig.enabled = e.target.checked;
    saveConfig();
    updateStatus(e.target.checked);
  });

  // Max messages slider
  const maxMessages = document.getElementById('maxMessages');
  const maxMessagesValue = document.getElementById('maxMessagesValue');
  maxMessages.addEventListener('input', (e) => {
    maxMessagesValue.textContent = e.target.value;
    currentConfig.maxMessages = parseInt(e.target.value);
    debounce(saveConfig, 500)();
  });

  // Buffer size slider
  const bufferSize = document.getElementById('bufferSize');
  const bufferSizeValue = document.getElementById('bufferSizeValue');
  bufferSize.addEventListener('input', (e) => {
    bufferSizeValue.textContent = e.target.value;
    currentConfig.bufferSize = parseInt(e.target.value);
    debounce(saveConfig, 500)();
  });

  // Debug toggle
  const debugToggle = document.getElementById('debug');
  debugToggle.addEventListener('change', (e) => {
    currentConfig.debug = e.target.checked;
    saveConfig();
  });

  // Reset stats button
  const resetButton = document.getElementById('resetStats');
  resetButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all statistics?')) {
      port.postMessage({ type: 'resetStats' });
    }
  });
}

function updateConfigUI(config) {
  currentConfig = config;

  // Update UI elements
  document.getElementById('enabled').checked = config.enabled || false;
  document.getElementById('maxMessages').value = config.maxMessages || 1000;
  document.getElementById('maxMessagesValue').textContent = config.maxMessages || 1000;
  document.getElementById('bufferSize').value = config.bufferSize || 5;
  document.getElementById('bufferSizeValue').textContent = config.bufferSize || 5;
  document.getElementById('debug').checked = config.debug || false;

  updateStatus(config.enabled);
}

function updateStats(stats) {
  currentStats = stats;

  // Update stat displays
  document.getElementById('memoryReduced').textContent = `${stats.totalMemoryReduced || 0}%`;
  document.getElementById('messagesSaved').textContent = formatNumber(stats.totalMessagesOptimized || 0);
  document.getElementById('containersOptimized').textContent = Object.keys(stats.platformStats || {}).length;
  document.getElementById('sessions').textContent = stats.sessionsOptimized || 0;
}

function updateStatus(enabled) {
  const statusEl = document.getElementById('status');
  if (enabled) {
    statusEl.className = 'status enabled';
    statusEl.textContent = '✓ Optimization Active';
  } else {
    statusEl.className = 'status disabled';
    statusEl.textContent = '✕ Optimization Disabled';
  }
}

function saveConfig() {
  port.postMessage({
    type: 'updateConfig',
    data: currentConfig,
  });
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function showNotification(message) {
  // Simple notification (you could make this fancier)
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: #10a37f;
    color: white;
    padding: 10px 20px;
    border-radius: 6px;
    font-size: 12px;
    z-index: 10000;
    animation: slideDown 0.3s ease;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 2000);
}

// Utility: Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
