# Offline Mind Map & Workflow Generator

A modern, offline-first web application that transforms a flat list of tasks or ideas into a structured, interactive mind map with full **hierarchical subtask support**—directly in your browser!

## Features

- **Hierarchical Task Input**: Enter tasks with unlimited nesting using simple indentation
- **Subtask Support**: Use 2 spaces or 1 tab to create subtasks under parent tasks
- **Auto-grouping**: Keywords (design, code, test, deploy, document) automatically organize tasks
- **Drag & Rearrange**: Intuitively reshape your mind map with mouse/touch
- **Multiple Layouts**: Switch between hierarchical, radial, and force-directed diagrams
- **Visual Export**: Download as SVG (vector) or PNG (image)
- **User Guide**: Built-in modal with examples and instructions
- **Theme Toggle**: Light/Dark modes for comfortable viewing
- **Accessible & Private**: WCAG AA accessible, 100% offline, no data collection

## How To Use

### Basic Tasks

Enter one task per line:
```
Design homepage
Code backend API
Test features
Deploy application
```

### Hierarchical Tasks with Subtasks

Use **2 spaces** or **1 tab** for each indentation level:

```
Design homepage
  Create wireframe
  Design mockup
    Choose color palette
    Select typography
  Get stakeholder feedback
Code backend API
  Set up database
    Design schema
    Create migrations
  Create REST endpoints
    User authentication
    Data CRUD operations
  Write API documentation
Test features
  Unit testing
  Integration testing
  User acceptance testing
Deploy application
  Configure server
  Set up CI/CD pipeline
  Monitor performance
```

### Indentation Rules

- **2 spaces = 1 level** of nesting
- **Tab key = 1 level** of nesting
- **Unlimited depth** - nest as deep as needed
- **Parent tasks** appear as **bold circles** (dots)
- **Subtasks** appear as **boxes**
- **Auto-grouping** detects keywords even in nested tasks

### Visual Indicators

| Element | Appearance | Meaning |
|---------|------------|---------|
| Bold Circle | Large dot | Parent task with subtasks |
| Box | Rectangle | Leaf task (no subtasks) |
| Thicker line | 3px width | Parent-to-child connection |
| Thinner line | 2px width | Child-to-grandchild connection |

## Examples

### Project Planning Example
```
Build SaaS Application
  Planning Phase
    Market research
    Competitor analysis
    Define MVP features
  Design Phase
    Create user personas
    Design wireframes
    Build prototypes
  Development Phase
    Set up infrastructure
    Build frontend
    Build backend
  Testing Phase
  Launch Phase
```

### Study Plan Example
```
Learn Data Science
  Mathematics Foundation
    Linear algebra
    Statistics
      Descriptive statistics
      Inferential statistics
    Calculus
  Programming Skills
    Python basics
    Libraries
      NumPy
      Pandas
      Matplotlib
  Machine Learning
    Supervised learning
    Unsupervised learning
```

## Technology

- **UI Framework**: Minimalist, color-psychology-based design
- **Visualization**: [vis.js](https://visjs.org/) network library
- **Typography**: Inter font (Google Fonts)
- **Security**: Full CSP-ready, input sanitization
- **Accessibility**: WCAG AA compliant, semantic markup
- **Performance**: <100ms interaction feedback

## Color Psychology

Design based on proven color psychology principles:

- **Blue** (Trust & Professionalism) - Focus states, primary interactions
- **Orange/Yellow** (Optimism & Joy) - Action buttons, positive feedback
- **Green** (Growth & Harmony) - Success states, progress indicators
- **Black/White** (Elegance & Honesty) - Text, backgrounds, premium feel

## Project Structure

```
mind-map-generator/
├── index.html          # Main HTML with semantic structure
├── styles.css          # Color-psychology-based CSS
├── app.js              # Hierarchical task parser & visualizer
├── README.md           # This file
└── updated-for-obfus-and-minification-UIUX.json  # UI/UX guidelines
```

## Run Locally

1. Download all files to a folder
2. Open `index.html` in any modern browser
3. **No server required** - works 100% offline!

## Keyboard Shortcuts

- **Scroll Wheel**: Zoom in/out
- **Click + Drag**: Pan the canvas
- **Click Node + Drag**: Move individual nodes
- **Escape**: Close modal dialogs

## Browser Compatibility

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Opera 76+

## Customization

### Add Custom Keywords

Edit `KEYWORD_GROUPS` in `app.js`:

```javascript
const KEYWORD_GROUPS = {
  'Design': ['design', 'ui', 'ux', 'mockup'],
  'Development': ['code', 'develop', 'build'],
  'YourCategory': ['keyword1', 'keyword2']
};
```

### Change Colors

Edit `GROUP_COLORS` in `app.js`:

```javascript
const GROUP_COLORS = {
  'Design': '#8ecae6',
  'YourCategory': '#YOUR_HEX_COLOR'
};
```

### Adjust Indentation Sensitivity

By default, **2 spaces = 1 level**. To change:

Edit `getIndentLevel()` in `app.js`:
```javascript
return Math.floor(spaces.length / 4); // 4 spaces = 1 level
```

## Troubleshooting

**Q: My subtasks aren't showing up**  
A: Ensure you're using exactly 2 spaces (or 1 tab) per level. Copy-paste issues can introduce extra spaces.

**Q: Auto-grouping doesn't work with subtasks**  
A: Auto-grouping detects keywords in both parent and child tasks. Subtasks inherit parent's group color.

**Q: Canvas is too small**  
A: Use the "Fit View" button or scroll to zoom. Canvas height is 550px (configurable in CSS).

**Q: Export doesn't include all nodes**  
A: Click "Fit View" before exporting to ensure all nodes are visible in the viewport.

## License

MIT License - Feel free to use, modify, and distribute.

## Credits

- Built with [vis.js](https://visjs.org/)
- Design inspired by Apple's Human Interface Guidelines
- Color psychology based on UX research
- Hierarchical Task Analysis principles from HCI research

---

**Made with ❤️ for productivity enthusiasts**
