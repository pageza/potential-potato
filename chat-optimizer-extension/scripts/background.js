/**
 * Background Service Worker
 * Handles stats collection and coordinates between tabs
 */

// Global stats across all tabs
let globalStats = {
  totalMessagesOptimized: 0,
  totalMemoryReduced: 0,
  sessionsOptimized: 0,
  platformStats: {},
};

// Default configuration
const defaultConfig = {
  enabled: true,
  bufferSize: 5,
  maxMessages: 1000,
  pruneThreshold: 500,
  debug: false,
};

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Chat Optimizer installed');

  // Set default config
  const { config } = await chrome.storage.sync.get(['config']);
  if (!config) {
    await chrome.storage.sync.set({ config: defaultConfig });
  }

  // Initialize stats
  await chrome.storage.local.set({ globalStats });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'stats') {
    handleStatsUpdate(message.data, sender.tab);
  }

  return true;
});

async function handleStatsUpdate(stats, tab) {
  // Update global stats
  globalStats.totalMessagesOptimized += stats.totalMessagesSaved || 0;
  globalStats.totalMemoryReduced = stats.memoryReduced || 0;

  // Track per-platform stats
  const platform = stats.platform || 'Unknown';
  if (!globalStats.platformStats[platform]) {
    globalStats.platformStats[platform] = {
      sessions: 0,
      messagesOptimized: 0,
      avgMemoryReduction: 0,
    };
  }

  globalStats.platformStats[platform].sessions++;
  globalStats.platformStats[platform].messagesOptimized += stats.totalMessagesSaved || 0;
  globalStats.platformStats[platform].avgMemoryReduction = stats.memoryReduced || 0;

  // Save to storage
  await chrome.storage.local.set({ globalStats });

  // Update badge with memory reduction percentage
  if (stats.memoryReduced > 0) {
    chrome.action.setBadgeText({
      text: `${stats.memoryReduced}%`,
      tabId: tab?.id,
    });

    chrome.action.setBadgeBackgroundColor({
      color: '#10a37f',
      tabId: tab?.id,
    });
  }
}

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // Check if it's a chat site
    const url = new URL(tab.url);
    const chatSites = [
      'chat.openai.com',
      'chatgpt.com',
      'claude.ai',
      'gemini.google.com',
      'poe.com',
      'perplexity.ai',
    ];

    if (chatSites.some(site => url.hostname.includes(site))) {
      globalStats.sessionsOptimized++;
    }
  }
});

// API for popup to get stats
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    port.onMessage.addListener(async (message) => {
      if (message.type === 'getStats') {
        const { globalStats } = await chrome.storage.local.get(['globalStats']);
        port.postMessage({
          type: 'stats',
          data: globalStats || {},
        });
      }

      if (message.type === 'getConfig') {
        const { config } = await chrome.storage.sync.get(['config']);
        port.postMessage({
          type: 'config',
          data: config || defaultConfig,
        });
      }

      if (message.type === 'updateConfig') {
        await chrome.storage.sync.set({ config: message.data });
        port.postMessage({
          type: 'configUpdated',
        });
      }

      if (message.type === 'resetStats') {
        globalStats = {
          totalMessagesOptimized: 0,
          totalMemoryReduced: 0,
          sessionsOptimized: 0,
          platformStats: {},
        };
        await chrome.storage.local.set({ globalStats });
        port.postMessage({
          type: 'statsReset',
        });
      }
    });
  }
});
