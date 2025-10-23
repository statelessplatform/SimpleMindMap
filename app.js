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
    guideBtn: $('[data-action="guide"]'),
    guideModal: $('[data-modal="guide"]'),
    exportSVG: $('[data-action="exportSVG"]'),
    exportPNG: $('[data-action="exportPNG"]'),
    fit: $('[data-action="fit"]'),
    network: $('#network'),
    overlay: $('.canvas-overlay'),
    layout: $('[data-option="layout"]'),
    autoGroup: $('[data-option="autoGroup"]'),
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

  // ======= BUILD NETWORK WITH SUBTASKS =======
  function buildNetworkData(hierarchy, autoGroup) {
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

    // Process hierarchical tasks
    function processTask(task, parentId, level, parentGroup) {
      const taskId = `task_${nodeId++}`;
      const group = autoGroup ? detectKeyword(task.text) : (parentGroup || 'Other');
      const color = GROUP_COLORS[group] || GROUP_COLORS['Other'];

      // Determine node style based on hierarchy
      const hasChildren = task.children && task.children.length > 0;
      const nodeConfig = {
        id: taskId,
        label: task.text.length > 40 ? task.text.substring(0, 37) + '...' : task.text,
        title: task.text, // Tooltip
        level: level,
        color: color,
        font: { 
          size: hasChildren ? 20 : 16, 
          face: 'Inter',
          bold: hasChildren
        },
        shape: hasChildren ? 'dot' : 'box',
        size: hasChildren ? 28 : undefined,
        margin: hasChildren ? undefined : 10,
        borderWidth: 2
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

    // Store data
    networkData = data;

    // Configure layout
    let layoutConfig = {};

    if (layoutType === 'hierarchical') {
      layoutConfig = {
        hierarchical: {
          direction: 'UD',
          sortMethod: 'directed',
          nodeSpacing: 150,
          levelSeparation: 200,
          treeSpacing: 250
        }
      };
    } else if (layoutType === 'radial') {
      layoutConfig = {
        hierarchical: {
          direction: 'UD',
          sortMethod: 'directed',
          nodeSpacing: 200,
          levelSeparation: 250
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
          iterations: 150
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
          enabled: true
        }
      },
      height: '550px',
      width: '100%'
    };

    // Create network
    network = new vis.Network(el.network, data, options);

    // Fit view after stabilization
    network.once('stabilizationIterationsDone', function() {
      network.fit({
        animation: {
          duration: 1000,
          easingFunction: 'easeInOutQuad'
        }
      });
    });
  }

  // ======= EVENT HANDLERS =======
  function handleGenerate() {
    const input = el.input.value.trim();

    if (!input) {
      showToast('Please enter at least one task.', 'error');
      return;
    }

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
        hideProgress();
        showToast('Failed to generate mind map.', 'error');
      }
    }, 100);
  }

  function handleClear() {
    el.input.value = '';

    if (network) {
      network.destroy();
      network = null;
    }

    el.overlay.setAttribute('data-state', 'empty');
    el.fit.disabled = true;
    el.exportSVG.disabled = true;
    el.exportPNG.disabled = true;

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

      canvas.toBlob(function(blob) {
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

    // Hide progress
    hideProgress();

    // Attach event listeners
    el.generate.addEventListener('click', handleGenerate);
    el.clear.addEventListener('click', handleClear);
    el.theme.addEventListener('click', handleTheme);
    el.fit.addEventListener('click', handleFit);
    el.exportSVG.addEventListener('click', handleExportSVG);
    el.exportPNG.addEventListener('click', handleExportPNG);
    el.layout.addEventListener('change', handleLayoutChange);
    el.autoGroup.addEventListener('change', handleAutoGroupChange);

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
  }

  // ======= START APP =======
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
