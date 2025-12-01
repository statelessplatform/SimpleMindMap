// Production-ready Mind Map Generator with Subtask Support
(function () {
  'use strict';

  // ======= DOM SELECTORS =======
  const $ = (q, c = document) => c.querySelector(q);
  const $$ = (q, c = document) => Array.from(c.querySelectorAll(q));

  const el = {
    input: $('[data-input="tasks"]'),
    generate: $('[data-action="generate"]'),
    clear: $('[data-action="clear"]'),
    theme: $('[data-action="theme"]'),
    install: $('[data-action="install"]'),
    guideBtn: $('[data-action="guide"]'),
    guideModal: $('[data-modal="guide"]'),
    exportSVG: $('[data-action="exportSVG"]'),
    exportPNG: $('[data-action="exportPNG"]'),
    exportJSON: $('[data-action="exportJSON"]'),
    exportText: $('[data-action="exportText"]'),
    exportFreeMind: $('[data-action="exportFreeMind"]'),
    shareLink: $('[data-action="shareLink"]'),
    importBtn: $('[data-action="import"]'),
    fileImport: $('#fileImport'),
    fit: $('[data-action="fit"]'),
    network: $('#network'),
    overlay: $('.canvas-overlay'),
    layout: $('[data-option="layout"]'),
    autoGroup: $('[data-option="autoGroup"]'),
    fontFamily: $('[data-option="fontFamily"]'),
    fontSize: $('[data-option="fontSize"]'),
    fontBold: $('[data-option="fontBold"]'),
    fontItalic: $('[data-option="fontItalic"]'),
    progress: $('.progress-indicator'),
    toast: $('.toast-container')
  };

  // ======= CONSTANTS =======
  const KEYWORD_GROUPS = {
    'Design': ['design', 'ui', 'ux', 'mockup', 'prototype', 'wireframe', 'sketch'],
    'Development': ['code', 'develop', 'build', 'implement', 'program', 'create', 'api'],
    'Testing': ['test', 'qa', 'verify', 'validate', 'debug', 'check'],
    'Documentation': ['document', 'write', 'readme', 'guide', 'manual', 'tutorial'],
    'Deployment': ['deploy', 'release', 'publish', 'launch', 'production']
  };

  const GROUP_COLORS = {
    'Design': '#8ecae6',
    'Development': '#219ebc',
    'Testing': '#b5179e',
    'Documentation': '#f4a261',
    'Deployment': '#4CAF50',
    'Other': '#adb5bd'
  };

  let network = null;
  let networkData = null;
  let currentInputText = ''; // Store current input for URL sync
  let keyboardController = null;
  let isUpdatingFromNetwork = false; // Flag to prevent circular updates
  let nodeEditor = null;

  // ======= UTILITY FUNCTIONS =======
  function showProgress() {
    el.progress.setAttribute('data-state', 'visible');
  }

  function hideProgress() {
    el.progress.setAttribute('data-state', 'hidden');
  }

  function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${type === 'error' ? '⚠️' : '✅'}</span>
      <span class="toast-message">${sanitize(msg)}</span>
    `;
    el.toast.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  // ======= INDENTATION DETECTION =======
  function getIndentLevel(line) {
    // Count leading spaces or tabs (tab = 4 spaces)
    const match = line.match(/^(\s*)/);
    if (!match) return 0;
    const spaces = match[1].replace(/\t/g, '    ');
    return Math.floor(spaces.length / 2); // 2 spaces = 1 level
  }

  // ======= HIERARCHICAL TASK PARSING =======
  function parseHierarchicalTasks(input, autoGroup) {
    const lines = input.split(/\r?\n/).filter(Boolean);
    const hierarchy = [];
    const stack = [{ level: -1, children: hierarchy }];

    for (const rawLine of lines) {
      const level = getIndentLevel(rawLine);
      const text = rawLine.trim();

      if (!text) continue;

      const task = {
        text: text,
        level: level,
        children: []
      };

      // Find parent at correct level
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      // Add to parent's children
      stack[stack.length - 1].children.push(task);
      stack.push(task);
    }

    return hierarchy;
  }

  // ======= KEYWORD DETECTION =======
  function detectKeyword(text) {
    const lower = text.toLowerCase();
    for (const [group, keywords] of Object.entries(KEYWORD_GROUPS)) {
      if (keywords.some(kw => lower.includes(kw))) {
        return group;
      }
    }
    return 'Other';
  }

  // ======= GET FONT SETTINGS =======
  function getFontSettings() {
    return {
      family: el.fontFamily ? el.fontFamily.value : 'Inter',
      size: el.fontSize ? parseInt(el.fontSize.value) : 16,
      bold: el.fontBold ? el.fontBold.checked : false,
      italic: el.fontItalic ? el.fontItalic.checked : false
    };
  }

  // ======= BUILD NETWORK WITH SUBTASKS =======
  function buildNetworkData(hierarchy, autoGroup) {
    const nodes = [];
    const edges = [];
    let nodeId = 0;
    const fontSettings = getFontSettings();

    // Root node
    nodes.push({
      id: 'root',
      label: 'Mind Map',
      title: 'Mind Map',
      originalText: 'Mind Map',
      level: 0,
      color: '#F59E0B',
      font: {
        size: 28,
        face: fontSettings.family,
        bold: true
      },
      shape: 'dot',
      size: 40
    });

    // Process hierarchical tasks
    function processTask(task, parentId, level, parentGroup) {
      const taskId = `task_${nodeId++}`;
      const group = autoGroup ? detectKeyword(task.text) : (parentGroup || 'Other');
      const color = GROUP_COLORS[group] || GROUP_COLORS['Other'];

      // Determine node style based on hierarchy
      const hasChildren = task.children && task.children.length > 0;

      // For end nodes (no children), support multi-line text (up to 3 lines)
      let displayLabel = task.text;
      if (!hasChildren) {
        // Split text into words and create up to 3 lines
        const words = task.text.split(' ');
        const maxCharsPerLine = 20; // Fixed line length
        const lines = [];
        let currentLine = '';

        for (const word of words) {
          if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
            currentLine = (currentLine + ' ' + word).trim();
          } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
          }
          if (lines.length >= 2) break; // Max 3 lines (2 complete + current)
        }
        if (currentLine && lines.length < 3) lines.push(currentLine);

        // Join with newline for multi-line display
        displayLabel = lines.slice(0, 3).join('\n');

        // If text was truncated, add ellipsis
        if (words.length > lines.join(' ').split(' ').length) {
          const lastLine = lines[lines.length - 1];
          lines[lines.length - 1] = lastLine.substring(0, Math.max(0, lastLine.length - 3)) + '...';
          displayLabel = lines.join('\n');
        }
      } else {
        // For parent nodes, keep single line with truncation
        displayLabel = task.text.length > 40 ? task.text.substring(0, 37) + '...' : task.text;
      }

      // Build font configuration with user settings
      const fontConfig = {
        size: hasChildren ? (fontSettings.size + 4) : fontSettings.size,
        face: fontSettings.family,
        bold: hasChildren || fontSettings.bold,
        multi: !hasChildren ? 'html' : false
      };

      // Add italic if selected (for vis.js, this needs to be in the label)
      if (fontSettings.italic) {
        let styledLabel = `<i>${displayLabel}</i>`;
        if (!hasChildren) {
          fontConfig.multi = 'html';
          displayLabel = styledLabel;
        }
      }

      const nodeConfig = {
        id: taskId,
        label: displayLabel,
        title: task.text, // Full tooltip
        originalText: task.text, // Store original text for reconstruction
        level: level,
        color: color,
        font: fontConfig,
        shape: hasChildren ? 'dot' : 'box',
        size: hasChildren ? 28 : undefined,
        margin: hasChildren ? undefined : 10,
        borderWidth: 2,
        widthConstraint: !hasChildren ? { maximum: 200 } : undefined
      };

      nodes.push(nodeConfig);

      // Create edge from parent
      edges.push({
        from: parentId,
        to: taskId,
        width: level === 1 ? 3 : 2,
        color: { color: hasChildren ? '#666' : '#999' }
      });

      // Process children (subtasks)
      if (hasChildren) {
        for (const child of task.children) {
          processTask(child, taskId, level + 1, group);
        }
      }
    }

    // Process all top-level tasks
    for (const task of hierarchy) {
      processTask(task, 'root', 1, null);
    }

    return {
      nodes: new vis.DataSet(nodes),
      edges: new vis.DataSet(edges)
    };
  }

  // ======= DRAW NETWORK =======
  function drawNetwork(data, layoutType) {
    // Destroy existing network
    if (network) {
      network.destroy();
    }

    // Hide overlay
    el.overlay.setAttribute('data-state', 'hidden');

    // Enable buttons
    el.fit.disabled = false;
    el.exportSVG.disabled = false;
    el.exportPNG.disabled = false;
    el.exportJSON.disabled = false;
    el.exportText.disabled = false;
    el.exportFreeMind.disabled = false;
    el.shareLink.disabled = false;

    // Store data
    networkData = data;

    // Configure layout
    let layoutConfig = {};

    if (layoutType === 'hierarchical') {
      layoutConfig = {
        hierarchical: {
          direction: 'UD',
          sortMethod: 'directed',
          nodeSpacing: 250,
          levelSeparation: 300,
          treeSpacing: 350,
          blockShifting: true,
          edgeMinimization: true,
          parentCentralization: true
        }
      };
    } else if (layoutType === 'radial') {
      layoutConfig = {
        hierarchical: {
          direction: 'UD',
          sortMethod: 'directed',
          nodeSpacing: 300,
          levelSeparation: 350,
          blockShifting: true,
          edgeMinimization: true,
          parentCentralization: true
        }
      };
    }

    // Network options
    const options = {
      nodes: {
        borderWidth: 2,
        borderWidthSelected: 4,
        font: {
          color: '#212121',
          strokeWidth: 0
        }
      },
      edges: {
        color: { color: '#999999', highlight: '#F59E0B' },
        smooth: {
          type: 'cubicBezier',
          roundness: 0.5
        },
        arrows: {
          to: {
            enabled: false
          }
        }
      },
      layout: layoutConfig,
      physics: {
        enabled: layoutType === 'force',
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -50,
          centralGravity: 0.01,
          springLength: 200,
          springConstant: 0.08,
          damping: 0.4,
          avoidOverlap: 1
        },
        stabilization: {
          enabled: true,
          iterations: 1000, // Increased to ensure good layout before freezing
          updateInterval: 25
        }
      },
      interaction: {
        dragNodes: true,
        dragView: true,
        zoomView: true,
        hover: true,
        tooltipDelay: 100,
        navigationButtons: false,
        keyboard: {
          enabled: true,
          bindToWindow: false
        }
      },
      manipulation: {
        enabled: false
      },
      height: '550px',
      width: '100%'
    };

    // Create network
    network = new vis.Network(el.network, data, options);

    // Initialize Phase 2 modules
    if (typeof KeyboardController !== 'undefined') {
      keyboardController = KeyboardController;
      keyboardController.init(network, networkData, {
        onNodeAdd: () => {
          // Node added
        },
        onNodeDelete: () => {
          // Node deleted
        },
        onNodeEdit: (nodeId) => {
          if (nodeEditor) {
            nodeEditor.editNode(nodeId);
          }
        }
      });
    }

    if (typeof NodeEditor !== 'undefined') {
      nodeEditor = NodeEditor;
      nodeEditor.init(network, networkData, (nodeId, newLabel) => {
        // Node edited - sync back to textarea
        syncNetworkToTextarea();
      });
    }

    // Listen for node additions/deletions from keyboard controller
    network.on('afterDrawing', () => {
      // Sync any changes back to textarea after drawing
      if (!isUpdatingFromNetwork) {
        syncNetworkToTextarea();
      }
    });

    // Disable physics after stabilization for ALL layouts
    // This allows free node movement (vertical & horizontal) without spring-back
    network.once('stabilizationIterationsDone', function () {
      network.setOptions({
        physics: {
          enabled: false
        }
      });

      // Fit view with animation
      network.fit({
        animation: {
          duration: 1000,
          easingFunction: 'easeInOutQuad'
        }
      });
    });
  }

  // ======= PHASE 2: HELPER FUNCTIONS =======

  /**
   * Sync network data back to textarea
   * Reconstructs the hierarchical text from the network structure
   */
  function syncNetworkToTextarea() {
    if (!networkData || isUpdatingFromNetwork) return;

    try {
      const nodes = networkData.nodes.get();
      const edges = networkData.edges.get();

      // Build hierarchy from network data
      const hierarchy = buildHierarchyFromNetwork(nodes, edges);

      // Convert hierarchy to text
      const text = hierarchyToText(hierarchy).trim();

      // Update textarea without triggering regeneration
      isUpdatingFromNetwork = true;
      el.input.value = text;
      currentInputText = text;
      isUpdatingFromNetwork = false;
    } catch (error) {
      console.error('Error syncing network to textarea:', error);
      isUpdatingFromNetwork = false;
    }
  }

  /**
   * Build hierarchy from network nodes and edges
   */
  function buildHierarchyFromNetwork(nodes, edges) {
    const nodeMap = {};
    nodes.forEach(node => {
      nodeMap[node.id] = {
        id: node.id,
        text: node.originalText || node.title || node.label.replace(/\n/g, ' '),
        children: [],
        level: node.level || 0
      };
    });

    // Build parent-child relationships
    edges.forEach(edge => {
      const parent = nodeMap[edge.from];
      const child = nodeMap[edge.to];
      if (parent && child && child.id !== 'root') {
        parent.children.push(child);
      }
    });

    // Sort children at each level to maintain consistent order
    // This ensures the hierarchy is reconstructed in the same order as displayed
    Object.values(nodeMap).forEach(node => {
      if (node.children.length > 0) {
        node.children.sort((a, b) => {
          // Sort by level first, then by id to maintain consistent order
          if (a.level !== b.level) {
            return a.level - b.level;
          }
          return a.id.localeCompare(b.id);
        });
      }
    });

    // Return root's children (skip the root node itself)
    return nodeMap['root'] ? nodeMap['root'].children : [];
  }

  /**
   * Convert hierarchy to indented text format
   */
  function hierarchyToText(hierarchy, indent = 0) {
    let text = '';
    const indentStr = '  '.repeat(indent);

    hierarchy.forEach(node => {
      text += indentStr + node.text + '\n';
      if (node.children && node.children.length > 0) {
        text += hierarchyToText(node.children, indent + 1);
      }
    });

    return text;
  }

  /**
   * Handle textarea input changes and regenerate mind map
   */
  function handleTextareaChange() {
    if (isUpdatingFromNetwork || !networkData) return;

    // Debounce the regeneration
    clearTimeout(handleTextareaChange.timeout);
    handleTextareaChange.timeout = setTimeout(() => {
      const input = el.input.value.trim();
      if (input && input !== currentInputText) {
        regenerateMindMap();
      }
    }, 1000); // Wait 1 second after user stops typing
  }

  /**
   * Regenerate mind map from current textarea content
   */
  function regenerateMindMap() {
    const input = el.input.value.trim();
    if (!input) return;

    try {
      currentInputText = input;
      const autoGroup = el.autoGroup.checked;
      const hierarchy = parseHierarchicalTasks(input, autoGroup);
      const data = buildNetworkData(hierarchy, autoGroup);
      const layout = el.layout.value;

      isUpdatingFromNetwork = true;
      drawNetwork(data, layout);
      isUpdatingFromNetwork = false;
    } catch (error) {
      console.error('Error regenerating mind map:', error);
      isUpdatingFromNetwork = false;
    }
  }

  /**
   * Update node styles without regenerating the network
   * Preserves node positions
   */
  function updateNodeStyles() {
    if (!networkData) return;

    const fontSettings = getFontSettings();
    const allNodes = networkData.nodes.get();
    const updates = [];

    allNodes.forEach(node => {
      if (node.id === 'root') {
        updates.push({
          id: node.id,
          font: {
            size: 28,
            face: fontSettings.family,
            bold: true
          }
        });
        return;
      }

      const hasChildren = node.shape === 'dot';
      const text = node.originalText || node.title; // Fallback to title if originalText missing

      // Reconstruct display label
      let displayLabel = text;
      if (!hasChildren) {
        // Split text into words and create up to 3 lines
        const words = text.split(' ');
        const maxCharsPerLine = 20; // Fixed line length
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
        displayLabel = text.length > 40 ? text.substring(0, 37) + '...' : text;
      }

      // Build font config
      const fontConfig = {
        size: hasChildren ? (fontSettings.size + 4) : fontSettings.size,
        face: fontSettings.family,
        bold: hasChildren || fontSettings.bold,
        multi: !hasChildren ? 'html' : false
      };

      // Add italic if selected
      if (fontSettings.italic) {
        let styledLabel = `<i>${displayLabel}</i>`;
        if (!hasChildren) {
          fontConfig.multi = 'html';
          displayLabel = styledLabel;
        }
      }

      updates.push({
        id: node.id,
        label: displayLabel,
        font: fontConfig
      });
    });

    networkData.nodes.update(updates);
  }


  // ======= EVENT HANDLERS =======
  function handleGenerate() {
    const input = el.input.value.trim();

    if (!input) {
      showToast('Please enter at least one task.', 'error');
      return;
    }

    // Store input text for export/share
    currentInputText = input;

    showProgress();

    setTimeout(() => {
      try {
        const autoGroup = el.autoGroup.checked;
        const hierarchy = parseHierarchicalTasks(input, autoGroup);
        const data = buildNetworkData(hierarchy, autoGroup);
        const layout = el.layout.value;

        drawNetwork(data, layout);
        hideProgress();
        showToast('Mind map generated successfully!');
      } catch (err) {
        console.error('Generation error:', err);
        showToast('Failed to generate mind map.', 'error');
      }
    }, 100);
  }

  function handleClear() {
    el.input.value = '';
    currentInputText = '';

    if (network) {
      network.destroy();
      network = null;
    }

    networkData = null;

    el.overlay.setAttribute('data-state', 'empty');
    el.fit.disabled = true;
    el.exportSVG.disabled = true;
    el.exportPNG.disabled = true;
    el.exportJSON.disabled = true;
    el.exportText.disabled = true;
    el.exportFreeMind.disabled = true;
    el.shareLink.disabled = true;

    // Clear URL state
    if (typeof URLState !== 'undefined') {
      URLState.clearURL();
    }

    showToast('Cleared successfully.');
  }

  function handleTheme() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    el.theme.textContent = isDark ? '☀️' : '🌙';
    showToast(isDark ? 'Dark theme enabled.' : 'Light theme enabled.');
  }

  function handleFit() {
    if (network) {
      network.fit({
        animation: {
          duration: 500,
          easingFunction: 'easeInOutQuad'
        }
      });
    }
  }

  function handleExportSVG() {
    if (!network) return;

    try {
      const canvas = el.network.querySelector('canvas');
      if (!canvas) throw new Error('Canvas not found');

      const img = canvas.toDataURL('image/png');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
        <image href="${img}" width="${canvas.width}" height="${canvas.height}"/>
      </svg>`;

      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mind-map.svg';
      a.click();
      URL.revokeObjectURL(url);

      showToast('Exported as SVG.');
    } catch (err) {
      console.error('SVG export error:', err);
      showToast('SVG export failed.', 'error');
    }
  }

  function handleExportPNG() {
    if (!network) return;

    try {
      const canvas = el.network.querySelector('canvas');
      if (!canvas) throw new Error('Canvas not found');

      canvas.toBlob(function (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mind-map.png';
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');

      showToast('Exported as PNG.');
    } catch (err) {
      console.error('PNG export error:', err);
      showToast('PNG export failed.', 'error');
    }
  }

  function handleLayoutChange() {
    if (!networkData) return;

    const layout = el.layout.value;
    drawNetwork(networkData, layout);
  }

  function handleAutoGroupChange() {
    if (!el.input.value.trim()) return;

    const autoGroup = el.autoGroup.checked;
    const hierarchy = parseHierarchicalTasks(el.input.value, autoGroup);
    const data = buildNetworkData(hierarchy, autoGroup);
    const layout = el.layout.value;

    drawNetwork(data, layout);
  }

  // ======= PWA INSTALL HANDLER =======
  let deferredPrompt;

  function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      deferredPrompt = null;
      el.install.hidden = true;
    });
  }

  // ======= IMPORT/EXPORT/SHARE HANDLERS =======
  function handleShareLink() {
    if (!networkData || typeof URLState === 'undefined') {
      showToast('Cannot create share link.', 'error');
      return;
    }

    try {
      const dataToShare = {
        nodes: networkData.nodes,
        edges: networkData.edges,
        layout: el.layout.value,
        autoGroup: el.autoGroup.checked,
        inputText: currentInputText
      };

      const shareURL = URLState.getShareableURL(dataToShare);

      if (!shareURL) {
        showToast('Failed to generate share link.', 'error');
        return;
      }

      // Check URL size
      const urlSize = URLState.estimateURLSize(dataToShare);
      if (urlSize > 2000) {
        showToast(`Warning: URL is large (${urlSize} chars). May not work in all browsers.`, 'error');
      }

      // Copy to clipboard
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareURL).then(() => {
          showToast('Share link copied to clipboard!');
        }).catch(() => {
          // Fallback: show link in prompt
          prompt('Share this link:', shareURL);
        });
      } else {
        // Fallback: show link in prompt
        prompt('Share this link:', shareURL);
      }

      // Update URL without reload
      URLState.updateURL(dataToShare);
    } catch (error) {
      console.error('Share link error:', error);
      showToast('Failed to create share link.', 'error');
    }
  }

  function handleExportJSON() {
    if (!networkData || typeof ImportExport === 'undefined') return;

    try {
      const jsonData = ImportExport.exportToJSON({
        nodes: networkData.nodes,
        edges: networkData.edges,
        metadata: {
          layout: el.layout.value,
          autoGroup: el.autoGroup.checked,
          inputText: currentInputText
        }
      });

      ImportExport.downloadFile(jsonData, 'mindmap.json', 'application/json');
      showToast('Exported as JSON.');
    } catch (error) {
      console.error('JSON export error:', error);
      showToast('JSON export failed.', 'error');
    }
  }

  function handleExportText() {
    if (!networkData || typeof ImportExport === 'undefined') return;

    try {
      const textData = ImportExport.exportToPlainText({
        nodes: networkData.nodes,
        edges: networkData.edges
      });

      ImportExport.downloadFile(textData, 'mindmap.txt', 'text/plain');
      showToast('Exported as Text.');
    } catch (error) {
      console.error('Text export error:', error);
      showToast('Text export failed.', 'error');
    }
  }

  function handleExportFreeMind() {
    if (!networkData || typeof ImportExport === 'undefined') return;

    try {
      const mmData = ImportExport.exportToFreeMind({
        nodes: networkData.nodes,
        edges: networkData.edges
      });

      ImportExport.downloadFile(mmData, 'mindmap.mm', 'application/xml');
      showToast('Exported as FreeMind .mm file.');
    } catch (error) {
      console.error('FreeMind export error:', error);
      showToast('FreeMind export failed.', 'error');
    }
  }

  function handleImport() {
    if (!el.fileImport) return;
    el.fileImport.click();
  }

  async function handleFileImport(event) {
    if (typeof ImportExport === 'undefined') {
      showToast('Import module not loaded.', 'error');
      return;
    }

    const file = event.target.files[0];
    if (!file) return;

    showProgress();

    try {
      const content = await ImportExport.readFile(file);
      const fileName = file.name.toLowerCase();

      let importedData = null;

      if (fileName.endsWith('.json')) {
        importedData = ImportExport.importFromJSON(content);
      } else if (fileName.endsWith('.mm')) {
        importedData = ImportExport.importFromFreeMind(content);
      } else if (fileName.endsWith('.txt')) {
        importedData = ImportExport.importFromText(content);
      } else {
        showToast('Unsupported file format. Use .json, .mm, or .txt', 'error');
        hideProgress();
        return;
      }

      if (!importedData) {
        showToast('Failed to import file.', 'error');
        hideProgress();
        return;
      }

      // Update input text if available
      if (importedData.metadata && importedData.metadata.inputText) {
        el.input.value = importedData.metadata.inputText;
        currentInputText = importedData.metadata.inputText;
      }

      // Create network data
      const data = {
        nodes: new vis.DataSet(importedData.nodes),
        edges: new vis.DataSet(importedData.edges)
      };

      // Apply layout and autogrouping if available
      if (importedData.metadata) {
        if (importedData.metadata.layout) {
          el.layout.value = importedData.metadata.layout;
        }
        if (importedData.metadata.autoGroup !== undefined) {
          el.autoGroup.checked = importedData.metadata.autoGroup;
        }
      }

      drawNetwork(data, el.layout.value);
      hideProgress();
      showToast(`Imported from ${file.name}`);

      // Clear file input
      el.fileImport.value = '';
    } catch (error) {
      console.error('File import error:', error);
      hideProgress();
      showToast('Import failed.', 'error');
    }
  }

  // ======= INITIALIZE =======
  function init() {
    // Check if vis.js loaded
    if (typeof vis === 'undefined') {
      showToast('Failed to load visualization library.', 'error');
      return;
    }

    // Set initial theme icon
    el.theme.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';

    // Disable export buttons initially
    el.fit.disabled = true;
    el.exportSVG.disabled = true;
    el.exportPNG.disabled = true;
    el.exportJSON.disabled = true;
    el.exportText.disabled = true;
    el.exportFreeMind.disabled = true;
    el.shareLink.disabled = true;

    // Hide progress
    hideProgress();

    // Attach event listeners
    el.generate.addEventListener('click', handleGenerate);
    el.clear.addEventListener('click', handleClear);
    el.theme.addEventListener('click', handleTheme);
    el.fit.addEventListener('click', handleFit);
    el.exportSVG.addEventListener('click', handleExportSVG);
    el.exportPNG.addEventListener('click', handleExportPNG);
    el.exportJSON.addEventListener('click', handleExportJSON);
    el.exportText.addEventListener('click', handleExportText);
    el.exportFreeMind.addEventListener('click', handleExportFreeMind);
    el.shareLink.addEventListener('click', handleShareLink);
    el.importBtn.addEventListener('click', handleImport);
    el.fileImport.addEventListener('change', handleFileImport);
    el.layout.addEventListener('change', handleLayoutChange);
    el.autoGroup.addEventListener('change', handleAutoGroupChange);

    // Toolbar formatting controls
    // Handle toggle buttons (B, I, U)
    const toggleButtons = $$('.toolbar-toggle-btn');
    toggleButtons.forEach(btn => {
      btn.addEventListener('click', function () {
        this.classList.toggle('active');

        // Get the data-option attribute
        const option = this.getAttribute('data-option');

        // Update the corresponding checkbox state
        if (option === 'fontBold') {
          el.fontBold.checked = this.classList.contains('active');
        } else if (option === 'fontItalic') {
          el.fontItalic.checked = this.classList.contains('active');
        }

        // Regenerate if mind map exists
        if (networkData) {
          updateNodeStyles();
        }
      });
    });

    // Handle font family and size changes
    el.fontFamily.addEventListener('change', () => {
      if (networkData) {
        updateNodeStyles();
      }
    });

    el.fontSize.addEventListener('change', () => {
      if (networkData) {
        updateNodeStyles();
      }
    });

    // Enable live editing of textarea - regenerate mind map when text changes
    el.input.addEventListener('input', handleTextareaChange);

    // Guide modal handlers
    el.guideBtn.addEventListener('click', () => {
      el.guideModal.showModal();
    });

    $$('[data-action="closeGuide"]').forEach(btn => {
      btn.addEventListener('click', () => {
        el.guideModal.close();
      });
    });

    el.guideModal.addEventListener('click', (e) => {
      if (e.target === el.guideModal) {
        el.guideModal.close();
      }
    });

    // PWA Install Handlers
    el.install.addEventListener('click', handleInstall);

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      el.install.hidden = false;
    });

    window.addEventListener('appinstalled', () => {
      el.install.hidden = true;
      deferredPrompt = null;
      showToast('App installed successfully!');
    });

    // Auto-load from URL if available
    if (typeof URLState !== 'undefined' && URLState.hasURLState()) {
      try {
        showProgress();
        const urlData = URLState.decodeStateFromURL();

        if (urlData && urlData.nodes && urlData.edges) {
          // Restore input text if available
          if (urlData.metadata && urlData.metadata.inputText) {
            el.input.value = urlData.metadata.inputText;
            currentInputText = urlData.metadata.inputText;
          }

          // Restore layout and autogroup settings
          if (urlData.metadata) {
            if (urlData.metadata.layout) {
              el.layout.value = urlData.metadata.layout;
            }
            if (urlData.metadata.autoGroup !== undefined) {
              el.autoGroup.checked = urlData.metadata.autoGroup;
            }
          }

          // Create network data
          const data = {
            nodes: new vis.DataSet(urlData.nodes),
            edges: new vis.DataSet(urlData.edges)
          };

          // Draw network
          drawNetwork(data, el.layout.value);
          hideProgress();
          showToast('Mind map loaded from URL!');
        } else {
          hideProgress();
          showToast('Invalid URL data.', 'error');
          URLState.clearURL();
        }
      } catch (error) {
        console.error('URL load error:', error);
        hideProgress();
        showToast('Failed to load from URL.', 'error');
        URLState.clearURL();
      }
    }
  }

  // ======= START APP =======
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
