// URL State Management Module
// Handles encoding/decoding mind map state to/from URL hash
(function (window) {
  'use strict';

  const URLState = {
    /**
     * Encode mind map data to compressed URL hash
     * @param {Object} data - Mind map data with nodes and edges
     * @returns {string} Compressed URL hash
     */
    encodeStateToURL: function (data) {
      try {
        // Convert DataSet to plain arrays if needed
        const plainData = {
          nodes: data.nodes.get ? data.nodes.get() : data.nodes,
          edges: data.edges.get ? data.edges.get() : data.edges,
          metadata: {
            version: '1.0',
            created: new Date().toISOString(),
            layout: data.layout || 'hierarchical',
            autoGroup: data.autoGroup !== undefined ? data.autoGroup : true
          }
        };

        const jsonString = JSON.stringify(plainData);
        
        // Compress using lz-string
        if (typeof LZString !== 'undefined') {
          return LZString.compressToEncodedURIComponent(jsonString);
        } else {
          // Fallback to base64 if lz-string not available
          console.warn('lz-string not loaded, using base64 encoding');
          return btoa(encodeURIComponent(jsonString));
        }
      } catch (error) {
        console.error('Failed to encode state to URL:', error);
        return null;
      }
    },

    /**
     * Decode mind map data from URL hash
     * @returns {Object|null} Decoded mind map data or null if invalid
     */
    decodeStateFromURL: function () {
      try {
        const hash = window.location.hash.substring(1); // Remove '#'
        
        if (!hash) {
          return null;
        }

        let jsonString;
        
        // Try decompressing with lz-string first
        if (typeof LZString !== 'undefined') {
          jsonString = LZString.decompressFromEncodedURIComponent(hash);
        }
        
        // Fallback to base64 decode if lz-string fails
        if (!jsonString) {
          try {
            jsonString = decodeURIComponent(atob(hash));
          } catch (e) {
            console.error('Failed to decode URL hash:', e);
            return null;
          }
        }

        const data = JSON.parse(jsonString);
        
        // Validate data structure
        if (!data.nodes || !data.edges) {
          console.error('Invalid data structure in URL');
          return null;
        }

        return data;
      } catch (error) {
        console.error('Failed to decode state from URL:', error);
        return null;
      }
    },

    /**
     * Update browser URL with current state (without page reload)
     * @param {Object} data - Mind map data
     */
    updateURL: function (data) {
      const hash = this.encodeStateToURL(data);
      
      if (hash) {
        // Update URL without triggering page reload
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, null, '#' + hash);
        } else {
          window.location.hash = hash;
        }
      }
    },

    /**
     * Get shareable URL for current state
     * @param {Object} data - Mind map data
     * @returns {string} Full shareable URL
     */
    getShareableURL: function (data) {
      const hash = this.encodeStateToURL(data);
      
      if (hash) {
        const baseURL = window.location.origin + window.location.pathname;
        return baseURL + '#' + hash;
      }
      
      return null;
    },

    /**
     * Clear URL hash
     */
    clearURL: function () {
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, null, window.location.pathname);
      } else {
        window.location.hash = '';
      }
    },

    /**
     * Check if URL has state data
     * @returns {boolean}
     */
    hasURLState: function () {
      return window.location.hash.length > 1;
    },

    /**
     * Estimate compressed size of data
     * @param {Object} data - Mind map data
     * @returns {number} Estimated size in characters
     */
    estimateURLSize: function (data) {
      const hash = this.encodeStateToURL(data);
      return hash ? hash.length : 0;
    }
  };

  // Export to window
  window.URLState = URLState;

})(window);
