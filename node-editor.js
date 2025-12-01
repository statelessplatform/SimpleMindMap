// Node Editor Module
// Inline editing of node labels with double-click
(function (window) {
    'use strict';

    const NodeEditor = {
        network: null,
        networkData: null,
        editingNodeId: null,
        editorElement: null,
        onNodeUpdate: null,

        /**
         * Initialize node editor
         * @param {Object} network - vis.js network instance
         * @param {Object} networkData - network data
         * @param {Function} callback - callback when node is updated
         */
        init: function (network, networkData, callback) {
            this.network = network;
            this.networkData = networkData;
            this.onNodeUpdate = callback || null;

            // Listen for double-click on nodes
            this.network.on('doubleClick', (params) => {
                if (params.nodes.length > 0) {
                    this.startEditing(params.nodes[0]);
                }
            });
        },

        /**
         * Start editing a node
         * @param {string} nodeId - ID of node to edit
         */
        startEditing: function (nodeId) {
            if (this.editingNodeId) return;

            const node = this.networkData.nodes.get(nodeId);
            if (!node) return;

            this.editingNodeId = nodeId;

            // Get node position on canvas
            const canvasPos = this.network.getPositions([nodeId])[nodeId];
            const DOMPos = this.network.canvasToDOM(canvasPos);

            // Create editor element - use textarea for multi-line support
            this.editorElement = document.createElement('textarea');
            this.editorElement.value = node.originalText || node.title || node.label.replace(/\n/g, ' ');
            this.editorElement.classList.add('node-editor-input');

            // Position editor
            const networkContainer = this.network.body.container;
            this.editorElement.style.position = 'absolute';
            this.editorElement.style.left = DOMPos.x + 'px';
            this.editorElement.style.top = DOMPos.y + 'px';
            this.editorElement.style.transform = 'translate(-50%, -50%)';
            this.editorElement.style.zIndex = '1000';

            // Style editor
            this.editorElement.style.padding = '8px 12px';
            this.editorElement.style.fontSize = '16px';
            this.editorElement.style.fontFamily = 'Inter, sans-serif';
            this.editorElement.style.border = '2px solid #2563EB';
            this.editorElement.style.borderRadius = '8px';
            this.editorElement.style.backgroundColor = '#ffffff';
            this.editorElement.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            this.editorElement.style.outline = 'none';
            this.editorElement.style.minWidth = '150px';
            this.editorElement.style.maxWidth = '300px';
            this.editorElement.style.minHeight = '40px';
            this.editorElement.style.resize = 'vertical';

            // Dark mode support
            if (document.body.classList.contains('dark')) {
                this.editorElement.style.backgroundColor = '#1F2937';
                this.editorElement.style.color = '#F9FAFB';
            }

            // Add to container
            networkContainer.appendChild(this.editorElement);

            // Focus and select all
            this.editorElement.focus();
            this.editorElement.select();

            // Event listeners
            this.editorElement.addEventListener('blur', () => this.finishEditing(true));
            this.editorElement.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    this.finishEditing(true);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.finishEditing(false);
                }
            });
        },

        /**
         * Finish editing and update node
         * @param {boolean} save - whether to save changes
         */
        finishEditing: function (save) {
            if (!this.editingNodeId || !this.editorElement) return;

            if (save) {
                const newLabel = this.editorElement.value.trim();

                if (newLabel) {
                    const node = this.networkData.nodes.get(this.editingNodeId);
                    const hasChildren = this.networkData.edges.get({
                        filter: (edge) => edge.from === this.editingNodeId
                    }).length > 0;

                    // Format label for display
                    let displayLabel = newLabel;
                    if (!hasChildren) {
                        // For end nodes, support multi-line (up to 3 lines)
                        const words = newLabel.split(' ');
                        const maxCharsPerLine = 20;
                        const lines = [];
                        let currentLine = '';

                        for (const word of words) {
                            if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
                                currentLine = (currentLine + ' ' + word).trim();
                            } else {
                                if (currentLine) lines.push(currentLine);
                                currentLine = word;
                            }
                            if (lines.length >= 2) break;
                        }
                        if (currentLine && lines.length < 3) lines.push(currentLine);

                        displayLabel = lines.slice(0, 3).join('\n');

                        if (words.length > lines.join(' ').split(' ').length) {
                            const lastLine = lines[lines.length - 1];
                            lines[lines.length - 1] = lastLine.substring(0, Math.max(0, lastLine.length - 3)) + '...';
                            displayLabel = lines.join('\n');
                        }
                    } else {
                        // For parent nodes, single line with truncation
                        displayLabel = newLabel.length > 40 ? newLabel.substring(0, 37) + '...' : newLabel;
                    }

                    // Update node with both display label and original text
                    this.networkData.nodes.update({
                        id: this.editingNodeId,
                        label: displayLabel,
                        title: newLabel, // Full text in tooltip
                        originalText: newLabel // Store for reconstruction
                    });

                    // Callback
                    if (this.onNodeUpdate) {
                        this.onNodeUpdate(this.editingNodeId, newLabel);
                    }
                }
            }

            // Remove editor
            if (this.editorElement && this.editorElement.parentNode) {
                this.editorElement.parentNode.removeChild(this.editorElement);
            }

            this.editorElement = null;
            this.editingNodeId = null;
        },

        /**
         * Programmatically trigger editing for a node
         * @param {string} nodeId
         */
        editNode: function (nodeId) {
            this.startEditing(nodeId);
        },

        /**
         * Clean up and destroy editor
         */
        destroy: function () {
            this.finishEditing(false);
            this.network = null;
            this.networkData = null;
        }
    };

    // Export to window
    window.NodeEditor = NodeEditor;

})(window);
