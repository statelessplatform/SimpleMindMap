// Keyboard Controller Module
// Handles keyboard shortcuts for mind map navigation and editing
(function (window) {
    'use strict';

    const KeyboardController = {
        network: null,
        networkData: null,
        selectedNodeId: null,
        enabled: false,
        onNodeAdd: null,
        onNodeDelete: null,
        onNodeEdit: null,

        /**
         * Initialize keyboard shortcuts
         * @param {Object} network - vis.js network instance
         * @param {Object} networkData - network data with nodes and edges
         * @param {Object} callbacks - callback functions
         */
        init: function (network, networkData, callbacks = {}) {
            this.network = network;
            this.networkData = networkData;
            this.onNodeAdd = callbacks.onNodeAdd || null;
            this.onNodeDelete = callbacks.onNodeDelete || null;
            this.onNodeEdit = callbacks.onNodeEdit || null;
            this.enabled = true;

            // Listen for network selection events
            this.network.on('selectNode', (params) => {
                this.selectedNodeId = params.nodes[0];
            });

            this.network.on('deselectNode', () => {
                this.selectedNodeId = null;
            });

            // Attach keyboard listeners
            document.addEventListener('keydown', this.handleKeyPress.bind(this));
        },

        /**
         * Handle keyboard events
         * @param {KeyboardEvent} event
         */
        handleKeyPress: function (event) {
            if (!this.enabled || !this.network) return;

            // Ignore if typing in input fields
            if (event.target.tagName === 'TEXTAREA' || event.target.tagName === 'INPUT') {
                return;
            }

            const key = event.key;
            const ctrl = event.ctrlKey || event.metaKey;
            const shift = event.shiftKey;

            // Tab: Add child node
            if (key === 'Tab' && this.selectedNodeId && !ctrl) {
                event.preventDefault();
                this.addChildNode();
                return;
            }

            // Enter: Add sibling node
            if (key === 'Enter' && this.selectedNodeId && !ctrl) {
                event.preventDefault();
                this.addSiblingNode();
                return;
            }

            // Delete/Backspace: Delete selected node
            if ((key === 'Delete' || key === 'Backspace') && this.selectedNodeId && !ctrl) {
                event.preventDefault();
                this.deleteNode();
                return;
            }

            // F2: Edit node label
            if (key === 'F2' && this.selectedNodeId) {
                event.preventDefault();
                if (this.onNodeEdit) {
                    this.onNodeEdit(this.selectedNodeId);
                }
                return;
            }

            // Arrow keys: Navigate nodes
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key) && this.selectedNodeId) {
                event.preventDefault();
                this.navigateWithArrows(key);
                return;
            }

            // ?: Show keyboard shortcuts help
            if (key === '?' && !ctrl && !shift) {
                this.showShortcutsHelp();
                return;
            }
        },

        /**
         * Add a child node to the selected node
         */
        addChildNode: function () {
            if (!this.selectedNodeId || this.selectedNodeId === 'root') return;

            const newNodeId = `task_${Date.now()}`;
            const selectedNode = this.networkData.nodes.get(this.selectedNodeId);

            if (!selectedNode) return;

            // Create new child node
            const newNode = {
                id: newNodeId,
                label: 'New Task',
                level: selectedNode.level + 1,
                shape: 'box',
                margin: 10,
                borderWidth: 2,
                color: selectedNode.color || '#adb5bd'
            };

            // Add node
            this.networkData.nodes.add(newNode);

            // Add edge from selected node to new node
            this.networkData.edges.add({
                from: this.selectedNodeId,
                to: newNodeId,
                width: 2
            });

            // Update parent node to dot shape if it was a box
            if (selectedNode.shape === 'box') {
                this.networkData.nodes.update({
                    id: this.selectedNodeId,
                    shape: 'dot',
                    size: 28,
                    font: { ...selectedNode.font, bold: true, size: 20 },
                    margin: undefined
                });
            }

            // Select new node
            this.network.selectNodes([newNodeId]);
            this.selectedNodeId = newNodeId;

            // Trigger edit mode
            if (this.onNodeEdit) {
                setTimeout(() => this.onNodeEdit(newNodeId), 100);
            }

            // Notify callback
            if (this.onNodeAdd) {
                this.onNodeAdd(newNode);
            }
        },

        /**
         * Add a sibling node to the selected node
         */
        addSiblingNode: function () {
            if (!this.selectedNodeId || this.selectedNodeId === 'root') return;

            // Find parent of selected node
            const edgesToSelected = this.networkData.edges.get({
                filter: (edge) => edge.to === this.selectedNodeId
            });

            if (edgesToSelected.length === 0) return;

            const parentId = edgesToSelected[0].from;
            const selectedNode = this.networkData.nodes.get(this.selectedNodeId);

            const newNodeId = `task_${Date.now()}`;

            // Create sibling node (same level as selected)
            const newNode = {
                id: newNodeId,
                label: 'New Task',
                level: selectedNode.level,
                shape: 'box',
                margin: 10,
                borderWidth: 2,
                color: selectedNode.color || '#adb5bd'
            };

            // Add node
            this.networkData.nodes.add(newNode);

            // Add edge from parent to new node
            this.networkData.edges.add({
                from: parentId,
                to: newNodeId,
                width: selectedNode.level === 1 ? 3 : 2
            });

            // Select new node
            this.network.selectNodes([newNodeId]);
            this.selectedNodeId = newNodeId;

            // Trigger edit mode
            if (this.onNodeEdit) {
                setTimeout(() => this.onNodeEdit(newNodeId), 100);
            }

            // Notify callback
            if (this.onNodeAdd) {
                this.onNodeAdd(newNode);
            }
        },

        /**
         * Delete the selected node and its children
         */
        deleteNode: function () {
            if (!this.selectedNodeId || this.selectedNodeId === 'root') return;

            // Find all descendant nodes recursively
            const nodesToDelete = this.getAllDescendants(this.selectedNodeId);
            nodesToDelete.push(this.selectedNodeId);

            // Find parent and siblings
            const parentEdge = this.networkData.edges.get({
                filter: (edge) => edge.to === this.selectedNodeId
            })[0];

            // Delete nodes and edges
            this.networkData.nodes.remove(nodesToDelete);

            // If parent has no more children, change it back to box
            if (parentEdge) {
                const parentId = parentEdge.from;
                const parentChildren = this.networkData.edges.get({
                    filter: (edge) => edge.from === parentId
                });

                if (parentChildren.length === 0 && parentId !== 'root') {
                    const parentNode = this.networkData.nodes.get(parentId);
                    this.networkData.nodes.update({
                        id: parentId,
                        shape: 'box',
                        size: undefined,
                        font: { ...parentNode.font, bold: false, size: 16 },
                        margin: 10
                    });
                }
            }

            this.selectedNodeId = null;

            // Notify callback
            if (this.onNodeDelete) {
                this.onNodeDelete(nodesToDelete);
            }
        },

        /**
         * Get all descendant node IDs
         * @param {string} nodeId
         * @returns {Array} Array of descendant node IDs
         */
        getAllDescendants: function (nodeId) {
            const descendants = [];
            const children = this.networkData.edges.get({
                filter: (edge) => edge.from === nodeId
            });

            children.forEach(edge => {
                descendants.push(edge.to);
                descendants.push(...this.getAllDescendants(edge.to));
            });

            return descendants;
        },

        /**
         * Navigate through nodes using arrow keys
         * @param {string} direction - ArrowUp, ArrowDown, ArrowLeft, ArrowRight
         */
        navigateWithArrows: function (direction) {
            if (!this.selectedNodeId) return;

            const edges = this.networkData.edges.get();
            let targetNodeId = null;

            if (direction === 'ArrowUp' || direction === 'ArrowLeft') {
                // Navigate to parent
                const parentEdge = edges.find(edge => edge.to === this.selectedNodeId);
                if (parentEdge) {
                    targetNodeId = parentEdge.from;
                }
            } else if (direction === 'ArrowDown' || direction === 'ArrowRight') {
                // Navigate to first child
                const childEdges = edges.filter(edge => edge.from === this.selectedNodeId);
                if (childEdges.length > 0) {
                    targetNodeId = childEdges[0].to;
                } else {
                    // Or navigate to next sibling
                    const parentEdge = edges.find(edge => edge.to === this.selectedNodeId);
                    if (parentEdge) {
                        const siblings = edges.filter(edge => edge.from === parentEdge.from);
                        const currentIndex = siblings.findIndex(edge => edge.to === this.selectedNodeId);
                        if (currentIndex < siblings.length - 1) {
                            targetNodeId = siblings[currentIndex + 1].to;
                        }
                    }
                }
            }

            if (targetNodeId) {
                this.network.selectNodes([targetNodeId]);
                this.network.focus(targetNodeId, {
                    animation: {
                        duration: 300,
                        easingFunction: 'easeInOutQuad'
                    }
                });
                this.selectedNodeId = targetNodeId;
            }
        },

        /**
         * Show keyboard shortcuts help overlay
         */
        showShortcutsHelp: function () {
            const helpHTML = `
        <div class="keyboard-help-overlay" id="keyboardHelpOverlay">
          <div class="keyboard-help-modal">
            <div class="keyboard-help-header">
              <h2>⌨️ Keyboard Shortcuts</h2>
              <button class="keyboard-help-close" onclick="document.getElementById('keyboardHelpOverlay').remove()">×</button>
            </div>
            <div class="keyboard-help-body">
              <div class="shortcut-group">
                <h3>Navigation</h3>
                <div class="shortcut-item">
                  <kbd>↑</kbd> <kbd>←</kbd> <span>Move to parent node</span>
                </div>
                <div class="shortcut-item">
                  <kbd>↓</kbd> <kbd>→</kbd> <span>Move to child/sibling node</span>
                </div>
              </div>
              <div class="shortcut-group">
                <h3>Editing</h3>
                <div class="shortcut-item">
                  <kbd>Tab</kbd> <span>Add child node</span>
                </div>
                <div class="shortcut-item">
                  <kbd>Enter</kbd> <span>Add sibling node</span>
                </div>
                <div class="shortcut-item">
                  <kbd>F2</kbd> <span>Edit node label</span>
                </div>
                <div class="shortcut-item">
                  <kbd>Delete</kbd> <span>Delete node</span>
                </div>
              </div>
              <div class="shortcut-group">
                <h3>Help</h3>
                <div class="shortcut-item">
                  <kbd>?</kbd> <span>Show this help</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

            // Remove existing help if present
            const existingHelp = document.getElementById('keyboardHelpOverlay');
            if (existingHelp) {
                existingHelp.remove();
                return;
            }

            // Add to body
            document.body.insertAdjacentHTML('beforeend', helpHTML);

            // Close on outside click
            setTimeout(() => {
                const overlay = document.getElementById('keyboardHelpOverlay');
                if (overlay) {
                    overlay.addEventListener('click', (e) => {
                        if (e.target.classList.contains('keyboard-help-overlay')) {
                            overlay.remove();
                        }
                    });
                }
            }, 100);
        },

        /**
         * Enable or disable keyboard shortcuts
         * @param {boolean} enabled
         */
        setEnabled: function (enabled) {
            this.enabled = enabled;
        },

        /**
         * Clean up and destroy controller
         */
        destroy: function () {
            this.enabled = false;
            this.network = null;
            this.networkData = null;
            this.selectedNodeId = null;
        }
    };

    // Export to window
    window.KeyboardController = KeyboardController;

})(window);
