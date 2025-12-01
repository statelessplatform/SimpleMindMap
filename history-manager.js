// History Manager Module
// Undo/Redo functionality for mind map state
(function (window) {
    'use strict';

    class HistoryManager {
        constructor(maxStates = 50) {
            this.maxStates = maxStates;
            this.states = [];
            this.currentIndex = -1;
            this.enabled = true;
        }

        /**
         * Save current state
         * @param {Object} networkData - Network data with nodes and edges
         */
        saveState(networkData) {
            if (!this.enabled || !networkData) return;

            console.log('HistoryManager: saveState called. Current index:', this.currentIndex);

            // Clone data
            const state = {
                nodes: networkData.nodes.get ? networkData.nodes.get() : networkData.nodes,
                edges: networkData.edges.get ? networkData.edges.get() : networkData.edges,
                timestamp: Date.now()
            };

            // Remove any states after current index (if we undid and then made changes)
            this.states = this.states.slice(0, this.currentIndex + 1);

            // Add new state
            this.states.push(state);

            // Limit history size
            if (this.states.length > this.maxStates) {
                this.states.shift();
            } else {
                this.currentIndex++;
            }
            console.log('HistoryManager: State saved. New index:', this.currentIndex, 'Total states:', this.states.length);
        }

        /**
         * Undo to previous state
         * @returns {Object|null} Previous state or null if nothing to undo
         */
        undo() {
            if (!this.canUndo()) return null;

            this.currentIndex--;
            return this.states[this.currentIndex];
        }

        /**
         * Redo to next state
         * @returns {Object|null} Next state or null if nothing to redo
         */
        redo() {
            if (!this.canRedo()) return null;

            this.currentIndex++;
            return this.states[this.currentIndex];
        }

        /**
         * Check if undo is possible
         * @returns {boolean}
         */
        canUndo() {
            return this.currentIndex > 0;
        }

        /**
         * Check if redo is possible
         * @returns {boolean}
         */
        canRedo() {
            return this.currentIndex < this.states.length - 1;
        }

        /**
         * Get current state count
         * @returns {number}
         */
        getStateCount() {
            return this.states.length;
        }

        /**
         * Clear all history
         */
        clear() {
            this.states = [];
            this.currentIndex = -1;
        }

        /**
         * Enable or disable history tracking
         * @param {boolean} enabled
         */
        setEnabled(enabled) {
            this.enabled = enabled;
        }

        /**
         * Get current state index
         * @returns {number}
         */
        getCurrentIndex() {
            return this.currentIndex;
        }
    }

    // Export to window
    window.HistoryManager = HistoryManager;

})(window);
