/**
 * VirtualScroller - Implements virtual scrolling for large lists
 * Only renders visible items + buffer, dramatically reducing DOM nodes
 */
class VirtualScroller {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      bufferSize: options.bufferSize || 5,  // Extra items above/below viewport
      itemHeight: options.itemHeight || null,  // Auto-detect if not provided
      maxItems: options.maxItems || 1000,  // Max items to keep in memory
      pruneThreshold: options.pruneThreshold || 500,  // Start pruning at this count
      enabled: true,
      debug: options.debug || false,
    };

    this.allItems = [];
    this.renderedItems = new Map();  // index -> element
    this.visibleRange = { start: 0, end: 0 };
    this.scrollOffset = 0;
    this.viewportHeight = 0;
    this.averageItemHeight = 0;
    this.isVirtualized = false;

    // Stats
    this.stats = {
      totalItems: 0,
      renderedItems: 0,
      prunedItems: 0,
      memoryBefore: 0,
      memoryAfter: 0,
    };

    this.initialize();
  }

  initialize() {
    if (!this.container) return;

    // Store reference to original items
    this.captureExistingItems();

    // Calculate initial measurements
    this.measureViewport();
    this.estimateItemHeight();

    // Set up observers
    this.setupMutationObserver();
    this.setupScrollObserver();
    this.setupResizeObserver();

    // Initial render
    this.update();

    this.log('VirtualScroller initialized', {
      container: this.container,
      itemCount: this.allItems.length,
      averageHeight: this.averageItemHeight,
    });
  }

  captureExistingItems() {
    // Store all existing items
    const items = Array.from(this.container.children);
    this.allItems = items.map((element, index) => ({
      index,
      element,
      height: null,  // Will be measured on demand
      rendered: true,
      placeholder: null,
    }));

    this.stats.totalItems = this.allItems.length;
  }

  estimateItemHeight() {
    // Sample some items to estimate average height
    const sampleSize = Math.min(10, this.allItems.length);
    let totalHeight = 0;
    let measured = 0;

    for (let i = 0; i < sampleSize; i++) {
      const item = this.allItems[i];
      if (item && item.element) {
        const height = item.element.offsetHeight;
        if (height > 0) {
          totalHeight += height;
          measured++;
          item.height = height;
        }
      }
    }

    this.averageItemHeight = measured > 0
      ? totalHeight / measured
      : this.options.itemHeight || 100;

    this.log('Estimated item height:', this.averageItemHeight);
  }

  measureViewport() {
    const rect = this.container.getBoundingClientRect();
    this.viewportHeight = rect.height || window.innerHeight;
    this.scrollOffset = this.container.scrollTop;
  }

  setupMutationObserver() {
    // Watch for new items being added
    this.mutationObserver = new MutationObserver((mutations) => {
      let needsUpdate = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // New items added
          if (mutation.addedNodes.length > 0) {
            needsUpdate = true;
            this.handleNewItems(Array.from(mutation.addedNodes));
          }
        }
      }

      if (needsUpdate) {
        this.update();
      }
    });

    this.mutationObserver.observe(this.container, {
      childList: true,
      subtree: false,
    });
  }

  setupScrollObserver() {
    let scrollTimeout;
    this.container.addEventListener('scroll', () => {
      this.scrollOffset = this.container.scrollTop;

      // Throttle updates
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.update();
      }, 16);  // ~60fps
    });
  }

  setupResizeObserver() {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.measureViewport();
        this.update();
      });

      this.resizeObserver.observe(this.container);
    }
  }

  handleNewItems(nodes) {
    // Add new items to our tracking
    nodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        this.allItems.push({
          index: this.allItems.length,
          element: node,
          height: node.offsetHeight || this.averageItemHeight,
          rendered: true,
          placeholder: null,
        });
      }
    });

    this.stats.totalItems = this.allItems.length;

    // Check if we need to prune
    if (this.allItems.length > this.options.pruneThreshold) {
      this.pruneOldItems();
    }
  }

  calculateVisibleRange() {
    if (this.allItems.length === 0 || this.averageItemHeight === 0) {
      return { start: 0, end: 0 };
    }

    // Calculate which items are visible
    const scrollTop = this.scrollOffset;
    const viewportHeight = this.viewportHeight;

    // Estimate based on average height
    const startIndex = Math.floor(scrollTop / this.averageItemHeight);
    const visibleCount = Math.ceil(viewportHeight / this.averageItemHeight);

    // Add buffer
    const bufferedStart = Math.max(0, startIndex - this.options.bufferSize);
    const bufferedEnd = Math.min(
      this.allItems.length,
      startIndex + visibleCount + this.options.bufferSize
    );

    return {
      start: bufferedStart,
      end: bufferedEnd,
    };
  }

  update() {
    if (!this.options.enabled || this.allItems.length === 0) {
      return;
    }

    // Only virtualize if we have enough items to warrant it
    if (this.allItems.length < 50) {
      this.log('Too few items, skipping virtualization');
      return;
    }

    this.measureViewport();
    const newRange = this.calculateVisibleRange();

    // Check if range changed
    if (
      newRange.start === this.visibleRange.start &&
      newRange.end === this.visibleRange.end
    ) {
      return;  // No change needed
    }

    this.log('Updating visible range:', newRange);

    // Temporarily disable mutation observer
    this.mutationObserver.disconnect();

    // Unrender items outside range
    for (let i = this.visibleRange.start; i < newRange.start; i++) {
      this.unrenderItem(i);
    }
    for (let i = newRange.end; i < this.visibleRange.end; i++) {
      this.unrenderItem(i);
    }

    // Render items in new range
    for (let i = newRange.start; i < newRange.end; i++) {
      this.renderItem(i);
    }

    this.visibleRange = newRange;
    this.stats.renderedItems = newRange.end - newRange.start;

    // Re-enable observer
    this.setupMutationObserver();

    this.log('Update complete', {
      visible: this.visibleRange,
      rendered: this.stats.renderedItems,
      total: this.stats.totalItems,
    });
  }

  renderItem(index) {
    const item = this.allItems[index];
    if (!item || item.rendered) return;

    // Replace placeholder with actual element
    if (item.placeholder && item.placeholder.parentNode) {
      item.placeholder.replaceWith(item.element);
      item.placeholder = null;
    }

    item.rendered = true;
    this.renderedItems.set(index, item.element);
  }

  unrenderItem(index) {
    const item = this.allItems[index];
    if (!item || !item.rendered) return;

    // Create lightweight placeholder
    const placeholder = document.createElement('div');
    const height = item.height || this.averageItemHeight;
    placeholder.style.height = `${height}px`;
    placeholder.style.minHeight = `${height}px`;
    placeholder.setAttribute('data-virtual-placeholder', index);

    // Replace element with placeholder
    if (item.element && item.element.parentNode) {
      item.element.replaceWith(placeholder);
      item.placeholder = placeholder;
    }

    item.rendered = false;
    this.renderedItems.delete(index);
  }

  pruneOldItems() {
    const itemsToRemove = this.allItems.length - this.options.maxItems;
    if (itemsToRemove <= 0) return;

    this.log(`Pruning ${itemsToRemove} old items`);

    // Remove oldest items (from the beginning)
    const removed = this.allItems.splice(0, itemsToRemove);

    // Remove from DOM
    removed.forEach((item) => {
      if (item.element && item.element.parentNode) {
        item.element.remove();
      }
      if (item.placeholder && item.placeholder.parentNode) {
        item.placeholder.remove();
      }
    });

    // Adjust scroll position to compensate
    const removedHeight = itemsToRemove * this.averageItemHeight;
    this.container.scrollTop = Math.max(0, this.container.scrollTop - removedHeight);

    // Re-index remaining items
    this.allItems.forEach((item, index) => {
      item.index = index;
    });

    this.stats.prunedItems += itemsToRemove;
    this.stats.totalItems = this.allItems.length;

    this.log('Pruning complete', {
      removed: itemsToRemove,
      remaining: this.allItems.length,
    });
  }

  getStats() {
    return {
      ...this.stats,
      renderedItems: this.renderedItems.size,
      visibleRange: this.visibleRange,
      memoryReduction: this.stats.totalItems > 0
        ? Math.round((1 - this.stats.renderedItems / this.stats.totalItems) * 100)
        : 0,
    };
  }

  enable() {
    this.options.enabled = true;
    this.update();
  }

  disable() {
    this.options.enabled = false;
    // Render all items
    for (let i = 0; i < this.allItems.length; i++) {
      this.renderItem(i);
    }
  }

  destroy() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.disable();
  }

  log(...args) {
    if (this.options.debug) {
      console.log('[VirtualScroller]', ...args);
    }
  }
}
