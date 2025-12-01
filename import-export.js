// Import/Export Module
// Handles multi-format data import/export (JSON, Text, FreeMind)
(function (window) {
    'use strict';

    const ImportExport = {
        /**
         * Export mind map to JSON format
         * @param {Object} data - Mind map data with nodes and edges
         * @returns {string} JSON string
         */
        exportToJSON: function (data) {
            const exportData = {
                version: '1.0',
                format: 'mindmap-json',
                created: new Date().toISOString(),
                nodes: data.nodes.get ? data.nodes.get() : data.nodes,
                edges: data.edges.get ? data.edges.get() : data.edges,
                metadata: data.metadata || {}
            };

            return JSON.stringify(exportData, null, 2);
        },

        /**
         * Export mind map to plain text outline
         * @param {Object} data - Mind map data
         * @returns {string} Plain text with indentation
         */
        exportToPlainText: function (data) {
            const nodes = data.nodes.get ? data.nodes.get() : data.nodes;
            const edges = data.edges.get ? data.edges.get() : data.edges;

            // Build tree structure from nodes and edges
            const nodeMap = new Map();
            nodes.forEach(node => {
                nodeMap.set(node.id, { ...node, children: [] });
            });

            // Build parent-child relationships
            edges.forEach(edge => {
                const parent = nodeMap.get(edge.from);
                const child = nodeMap.get(edge.to);
                if (parent && child) {
                    parent.children.push(child);
                }
            });

            // Find root node (usually 'root')
            const rootNode = nodeMap.get('root');
            if (!rootNode) {
                return '# Mind Map Export\n\n(No data)';
            }

            let output = '# Mind Map Export\n\n';

            // Recursive function to build text outline
            function buildOutline(node, level) {
                if (node.id === 'root') {
                    // Skip root, process children directly
                    node.children.forEach(child => buildOutline(child, 0));
                    return;
                }

                const indent = '  '.repeat(level);
                output += indent + node.label + '\n';

                // Process children
                node.children.forEach(child => buildOutline(child, level + 1));
            }

            buildOutline(rootNode, 0);
            return output;
        },

        /**
         * Export mind map to FreeMind .mm XML format
         * @param {Object} data - Mind map data
         * @returns {string} FreeMind XML
         */
        exportToFreeMind: function (data) {
            const nodes = data.nodes.get ? data.nodes.get() : data.nodes;
            const edges = data.edges.get ? data.edges.get() : data.edges;

            // Build tree structure
            const nodeMap = new Map();
            nodes.forEach(node => {
                nodeMap.set(node.id, { ...node, children: [] });
            });

            edges.forEach(edge => {
                const parent = nodeMap.get(edge.from);
                const child = nodeMap.get(edge.to);
                if (parent && child) {
                    parent.children.push(child);
                }
            });

            const rootNode = nodeMap.get('root');
            if (!rootNode) {
                return '<map version="1.0.1"></map>';
            }

            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
            xml += '<map version="1.0.1">\n';

            // Recursive function to build FreeMind XML
            function buildNode(node, level) {
                const indent = '  '.repeat(level);
                const text = this.escapeXML(node.label || 'Node');

                if (node.children.length > 0) {
                    xml += `${indent}<node TEXT="${text}">\n`;
                    node.children.forEach(child => buildNode.call(this, child, level + 1));
                    xml += `${indent}</node>\n`;
                } else {
                    xml += `${indent}<node TEXT="${text}"/>\n`;
                }
            }

            // Start with root node
            const text = this.escapeXML(rootNode.label || 'Mind Map');
            xml += `  <node TEXT="${text}">\n`;
            rootNode.children.forEach(child => buildNode.call(this, child, 2));
            xml += '  </node>\n';
            xml += '</map>';

            return xml;
        },

        /**
         * Import mind map from JSON
         * @param {string} jsonString - JSON data
         * @returns {Object|null} Parsed data or null if invalid
         */
        importFromJSON: function (jsonString) {
            try {
                const data = JSON.parse(jsonString);

                // Validate structure
                if (!data.nodes || !data.edges) {
                    throw new Error('Invalid JSON structure: missing nodes or edges');
                }

                return {
                    nodes: data.nodes,
                    edges: data.edges,
                    metadata: data.metadata || {}
                };
            } catch (error) {
                console.error('JSON import failed:', error);
                return null;
            }
        },

        /**
         * Import mind map from plain text outline
         * @param {string} text - Plain text with indentation
         * @returns {Object|null} Generated nodes and edges
         */
        importFromText: function (text) {
            try {
                const lines = text.split(/\r?\n/).filter(line => {
                    const trimmed = line.trim();
                    return trimmed && !trimmed.startsWith('#');
                });

                if (lines.length === 0) {
                    return null;
                }

                const nodes = [];
                const edges = [];
                let nodeId = 0;

                // Root node
                nodes.push({
                    id: 'root',
                    label: 'Mind Map',
                    level: 0,
                    color: '#F59E0B',
                    font: { size: 28, face: 'Inter', bold: true },
                    shape: 'dot',
                    size: 40
                });

                const stack = [{ id: 'root', level: -1 }];

                lines.forEach(line => {
                    // Calculate indent level (2 spaces = 1 level)
                    const match = line.match(/^(\s*)/);
                    const spaces = match ? match[1].replace(/\t/g, '  ') : '';
                    const level = Math.floor(spaces.length / 2);
                    const text = line.trim();

                    if (!text) return;

                    const id = `task_${nodeId++}`;

                    // Pop stack to find correct parent
                    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
                        stack.pop();
                    }

                    const parent = stack[stack.length - 1];

                    nodes.push({
                        id: id,
                        label: text,
                        level: level + 1,
                        shape: 'box',
                        margin: 10,
                        borderWidth: 2
                    });

                    edges.push({
                        from: parent.id,
                        to: id,
                        width: level === 0 ? 3 : 2
                    });

                    stack.push({ id: id, level: level });
                });

                return { nodes, edges, metadata: {} };
            } catch (error) {
                console.error('Text import failed:', error);
                return null;
            }
        },

        /**
         * Import mind map from FreeMind .mm XML
         * @param {string} xmlString - FreeMind XML data
         * @returns {Object|null} Generated nodes and edges
         */
        importFromFreeMind: function (xmlString) {
            try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

                // Check for parsing errors
                const parserError = xmlDoc.querySelector('parsererror');
                if (parserError) {
                    throw new Error('XML parsing failed');
                }

                const nodes = [];
                const edges = [];
                let nodeId = 0;

                // Recursive function to parse nodes
                function parseNode(xmlNode, parentId, level) {
                    const text = xmlNode.getAttribute('TEXT') || 'Node';
                    const id = level === 0 ? 'root' : `task_${nodeId++}`;

                    if (level === 0) {
                        nodes.push({
                            id: 'root',
                            label: text,
                            level: 0,
                            color: '#F59E0B',
                            font: { size: 28, face: 'Inter', bold: true },
                            shape: 'dot',
                            size: 40
                        });
                    } else {
                        nodes.push({
                            id: id,
                            label: text,
                            level: level,
                            shape: 'box',
                            margin: 10,
                            borderWidth: 2
                        });

                        edges.push({
                            from: parentId,
                            to: id,
                            width: level === 1 ? 3 : 2
                        });
                    }

                    // Process child nodes
                    const childNodes = xmlNode.querySelectorAll(':scope > node');
                    childNodes.forEach(child => {
                        parseNode(child, id, level + 1);
                    });
                }

                const rootNode = xmlDoc.querySelector('map > node');
                if (rootNode) {
                    parseNode(rootNode, null, 0);
                }

                return { nodes, edges, metadata: {} };
            } catch (error) {
                console.error('FreeMind import failed:', error);
                return null;
            }
        },

        /**
         * Download data as file
         * @param {string} content - File content
         * @param {string} filename - File name
         * @param {string} mimeType - MIME type
         */
        downloadFile: function (content, filename, mimeType) {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        },

        /**
         * Escape XML special characters
         * @param {string} str - String to escape
         * @returns {string} Escaped string
         */
        escapeXML: function (str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        },

        /**
         * Read file content (for file upload)
         * @param {File} file - File object
         * @returns {Promise<string>} File content as string
         */
        readFile: function (file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsText(file);
            });
        }
    };

    // Export to window
    window.ImportExport = ImportExport;

})(window);
