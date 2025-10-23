/**
 * Content Script - Detects and optimizes chat applications
 * Runs on chat websites and applies virtual scrolling
 */

class ChatOptimizer {
  constructor() {
    this.virtualScrollers = new Map();
    this.config = {
      enabled: true,
      bufferSize: 5,
      maxMessages: 1000,
      pruneThreshold: 500,
      debug: false,
    };

    this.stats = {
      containersOptimized: 0,
      totalMessagesSaved: 0,
      memoryReduced: 0,
    };

    // Platform-specific selectors for chat containers
    this.platformSelectors = {
      'chat.openai.com': {
        name: 'ChatGPT',
        selectors: [
          '[class*="react-scroll-to-bottom"]',
          '[role="presentation"]',
          'main > div > div > div',
        ],
        messageSelector: '[data-message-author-role]',
      },
      'chatgpt.com': {
        name: 'ChatGPT',
        selectors: [
          '[class*="react-scroll-to-bottom"]',
          '[role="presentation"]',
          'main > div > div > div',
        ],
        messageSelector: '[data-message-author-role]',
      },
      'claude.ai': {
        name: 'Claude',
        selectors: [
          '[class*="conversation"]',
          '[class*="messages"]',
          'main [role="log"]',
        ],
        messageSelector: '[class*="message"]',
      },
      'gemini.google.com': {
        name: 'Gemini',
        selectors: [
          '[class*="conversation-container"]',
          '[jsname]',
        ],
        messageSelector: '[class*="message"]',
      },
      'poe.com': {
        name: 'Poe',
        selectors: [
          '[class*="MessagesView"]',
          '[class*="Thread"]',
        ],
        messageSelector: '[class*="Message"]',
      },
      'perplexity.ai': {
        name: 'Perplexity',
        selectors: [
          '[class*="thread"]',
          'main [role="log"]',
        ],
        messageSelector: '[class*="message"]',
      },
    };

    this.init();
  }

  async init() {
    // Load config from storage
    await this.loadConfig();

    // Detect platform
    this.detectPlatform();

    // Wait for page to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.start());
    } else {
      this.start();
    }

    // Listen for config changes
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.config) {
        this.config = changes.config.newValue;
        this.applyConfigChanges();
      }
    });
  }

  async loadConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['config'], (result) => {
        if (result.config) {
          this.config = { ...this.config, ...result.config };
        }
        resolve();
      });
    });
  }

  detectPlatform() {
    const hostname = window.location.hostname;
    this.platform = this.platformSelectors[hostname];

    if (this.platform) {
      this.log(`Detected platform: ${this.platform.name}`);
    } else {
      this.log('Unknown platform, using generic detection');
      this.platform = {
        name: 'Unknown',
        selectors: [
          '[role="log"]',
          '[class*="message"]',
          '[class*="chat"]',
        ],
        messageSelector: 'div',
      };
    }
  }

  start() {
    this.log('Starting Chat Optimizer...');

    // Find chat containers
    this.findAndOptimizeContainers();

    // Watch for dynamically added containers
    this.setupGlobalObserver();

    // Send stats periodically
    setInterval(() => this.reportStats(), 5000);
  }

  findAndOptimizeContainers() {
    const selectors = this.platform.selectors;

    for (const selector of selectors) {
      try {
        const containers = document.querySelectorAll(selector);

        containers.forEach((container) => {
          if (this.shouldOptimize(container)) {
            this.optimizeContainer(container);
          }
        });
      } catch (e) {
        // Invalid selector, skip
        this.log('Invalid selector:', selector, e);
      }
    }
  }

  shouldOptimize(container) {
    // Check if already optimized
    if (this.virtualScrollers.has(container)) {
      return false;
    }

    // Check if it's a scroll container
    const style = window.getComputedStyle(container);
    const isScrollable = style.overflow === 'auto' ||
                        style.overflow === 'scroll' ||
                        style.overflowY === 'auto' ||
                        style.overflowY === 'scroll';

    if (!isScrollable) {
      return false;
    }

    // Check if it has many children
    const childCount = container.children.length;
    if (childCount < 20) {
      return false;  // Too few items
    }

    // Check if children look like messages
    const firstChild = container.firstElementChild;
    if (!firstChild) return false;

    const hasMessageLikeContent = this.looksLikeMessage(firstChild);

    this.log('Container evaluation:', {
      element: container,
      scrollable: isScrollable,
      childCount,
      looksLikeMessages: hasMessageLikeContent,
    });

    return hasMessageLikeContent;
  }

  looksLikeMessage(element) {
    // Heuristics to detect message-like elements
    const text = element.textContent;
    const hasText = text && text.trim().length > 10;
    const hasReasonableHeight = element.offsetHeight > 30 && element.offsetHeight < 5000;
    const notTooWide = element.offsetWidth < window.innerWidth;

    return hasText && hasReasonableHeight && notTooWide;
  }

  optimizeContainer(container) {
    if (!this.config.enabled) {
      return;
    }

    this.log('Optimizing container:', container);

    try {
      // Create virtual scroller
      const scroller = new VirtualScroller(container, {
        bufferSize: this.config.bufferSize,
        maxItems: this.config.maxMessages,
        pruneThreshold: this.config.pruneThreshold,
        debug: this.config.debug,
      });

      this.virtualScrollers.set(container, scroller);
      this.stats.containersOptimized++;

      // Add visual indicator (optional)
      if (this.config.debug) {
        this.addOptimizationBadge(container);
      }

      this.log('Container optimized successfully');
    } catch (error) {
      this.log('Error optimizing container:', error);
    }
  }

  addOptimizationBadge(container) {
    const badge = document.createElement('div');
    badge.textContent = '⚡ Optimized';
    badge.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #10a37f;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-family: system-ui, -apple-system, sans-serif;
    `;

    document.body.appendChild(badge);

    // Remove after 3 seconds
    setTimeout(() => badge.remove(), 3000);
  }

  setupGlobalObserver() {
    // Watch for new containers being added dynamically
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          // Debounce to avoid checking too often
          clearTimeout(this.checkTimeout);
          this.checkTimeout = setTimeout(() => {
            this.findAndOptimizeContainers();
          }, 1000);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  applyConfigChanges() {
    this.log('Config changed:', this.config);

    // Update all existing scrollers
    this.virtualScrollers.forEach((scroller) => {
      if (this.config.enabled) {
        scroller.enable();
      } else {
        scroller.disable();
      }

      // Update options
      scroller.options.bufferSize = this.config.bufferSize;
      scroller.options.maxItems = this.config.maxMessages;
      scroller.options.pruneThreshold = this.config.pruneThreshold;
      scroller.options.debug = this.config.debug;

      scroller.update();
    });
  }

  reportStats() {
    // Collect stats from all scrollers
    let totalMessages = 0;
    let totalRendered = 0;
    let totalPruned = 0;

    this.virtualScrollers.forEach((scroller) => {
      const stats = scroller.getStats();
      totalMessages += stats.totalItems;
      totalRendered += stats.renderedItems;
      totalPruned += stats.prunedItems;
    });

    this.stats.totalMessagesSaved = totalMessages - totalRendered;
    this.stats.memoryReduced = totalMessages > 0
      ? Math.round((1 - totalRendered / totalMessages) * 100)
      : 0;

    // Send to background script
    chrome.runtime.sendMessage({
      type: 'stats',
      data: {
        ...this.stats,
        totalMessages,
        totalRendered,
        totalPruned,
        platform: this.platform?.name || 'Unknown',
      },
    });
  }

  log(...args) {
    if (this.config.debug) {
      console.log('[ChatOptimizer]', ...args);
    }
  }
}

// Initialize when script loads
const optimizer = new ChatOptimizer();

// Expose globally for debugging
if (typeof window !== 'undefined') {
  window.chatOptimizer = optimizer;
}
