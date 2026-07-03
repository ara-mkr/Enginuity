// ENGINGUITY Central Command Registry

let navigateFn = () => {};
let workspaceContext = null;

export const setNavigate = (fn) => {
  navigateFn = fn;
};

export const setWorkspace = (ctx) => {
  workspaceContext = ctx;
};

// Helper to handle workspace tab vs floating window activation
const navigateOrOpen = (path) => {
  if (workspaceContext && workspaceContext.layoutMode === 'workspace') {
    if (path === '/') {
      workspaceContext.setLayoutMode('single');
      navigateFn('/');
    } else {
      const type = path.replace('/', '');
      const existing = workspaceContext.windows.find((w) => w.type === type);
      if (existing) {
        if (existing.isMinimized) {
          workspaceContext.restoreWindow(existing.id);
        } else {
          workspaceContext.bringToFront(existing.id);
        }
      } else {
        workspaceContext.openWindow(type);
      }
    }
  } else {
    navigateFn(path);
  }
};

const dispatchEvent = (name, detail = {}) => {
  window.dispatchEvent(new CustomEvent(name, { detail }));
};

// Global commands proxy actions
export const toggleFocusMode = () => dispatchEvent('enginguity_toggle_focus_mode');
export const openLayoutManager = () => dispatchEvent('enginguity_open_layout_manager');
export const saveCurrentLayout = () => dispatchEvent('enginguity_save_layout');
export const toggleWorkspaceMode = () => {
  if (workspaceContext) {
    workspaceContext.toggleLayoutMode();
  }
};

export const playgroundEngine = {
  resetAll: () => dispatchEvent('enginguity_playground_reset'),
  shareSetup: () => dispatchEvent('enginguity_playground_share'),
  exportPython: () => dispatchEvent('enginguity_playground_export_python'),
};

export const notebookEngine = {
  newEntry: (type) => dispatchEvent('enginguity_notebook_new_entry', { type }),
};

export const bomEngine = {
  checkAvailability: () => dispatchEvent('enginguity_bom_check_availability'),
  exportCSV: () => dispatchEvent('enginguity_bom_export_csv'),
};

export const cadEngine = {
  resetCamera: () => dispatchEvent('enginguity_cad_reset_camera'),
  toggleWireframe: () => dispatchEvent('enginguity_cad_toggle_wireframe'),
  runAIAnalysis: () => dispatchEvent('enginguity_cad_run_ai_analysis'),
};

export const debugEngine = {
  run: () => dispatchEvent('enginguity_debug_run'),
  analyze: () => dispatchEvent('enginguity_debug_analyze'),
  connectSerial: () => dispatchEvent('enginguity_debug_connect_serial'),
};

export const openModelPicker = () => dispatchEvent('enginguity_open_model_picker');
export const openAPIKeyModal = () => dispatchEvent('enginguity_open_api_key_modal');
export const openThemeSettings = () => dispatchEvent('enginguity_open_theme_settings');
export const openShortcutsOverlay = () => dispatchEvent('enginguity_open_shortcuts_overlay');
export const globalUndo = () => dispatchEvent('enginguity_global_undo');
export const openVersionHistory = () => navigateOrOpen('/history');
export const openCrossModuleSearch = () => dispatchEvent('enginguity_open_cross_search');

export const openNotebook = () => navigateOrOpen('/notebook');
export const openBOM = () => navigateOrOpen('/bom');
export const wakeJarvis = () => {
  if (window.jarvis?.wakeUp) {
    window.jarvis.wakeUp();
  } else {
    navigateOrOpen('/jarvis');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('enginguity_wake_jarvis'));
    }, 500);
  }
};
export const analyzeCurrentFile = () => cadEngine.runAIAnalysis();


export const COMMANDS = [
  // NAVIGATION
  {
    id: 'nav_dashboard',
    name: 'Go to Dashboard',
    category: 'Navigation',
    icon: 'layout-dashboard',
    shortcut: null,
    action: () => navigateOrOpen('/dashboard'),
    keywords: ['home', 'dashboard', 'project', 'brain', 'landing'],
  },
  {
    id: 'nav_cad',
    name: 'Open CAD Viewer',
    category: 'Navigation',
    icon: 'cube',
    shortcut: null,
    action: () => navigateOrOpen('/cad-viewer'),
    keywords: ['cad', '3d', 'model', 'stl', '3mf', 'pcb', 'kicad', 'gbr'],
  },
  {
    id: 'nav_playground',
    name: 'Open Parameter Playground',
    category: 'Navigation',
    icon: 'sliders',
    shortcut: null,
    action: () => navigateOrOpen('/parameter-playground'),
    keywords: ['parameters', 'sliders', 'simulation', 'equations', 'playground'],
  },
  {
    id: 'nav_jarvis',
    name: 'Open Jarvis',
    category: 'Navigation',
    icon: 'mic',
    shortcut: null,
    action: () => navigateOrOpen('/jarvis'),
    keywords: ['jarvis', 'voice', 'canvas', 'assistant', 'ai', 'listen'],
  },
  {
    id: 'nav_asset_gen',
    name: 'Open Graphic Generator',
    category: 'Navigation',
    icon: 'sparkles',
    shortcut: null,
    action: () => navigateOrOpen('/asset-generator'),
    keywords: ['asset', 'image', 'generator', 'graphic', 'render', 'diagram'],
  },
  {
    id: 'nav_simulation',
    name: 'Open Simulation Assistant',
    category: 'Navigation',
    icon: 'flask',
    shortcut: null,
    action: () => navigateOrOpen('/simulation-assistant'),
    keywords: ['simulation', 'physics', 'calculator', 'solve', 'sim'],
  },
  {
    id: 'nav_ideas',
    name: 'Open Project Ideas',
    category: 'Navigation',
    icon: 'ideas', // custom mapping or fallback
    shortcut: null,
    action: () => navigateOrOpen('/ideas'),
    keywords: ['ideas', 'projects', 'brainstorming', 'concepts'],
  },
  {
    id: 'nav_debug',
    name: 'Open Debug Console',
    category: 'Navigation',
    icon: 'play',
    shortcut: null,
    action: () => navigateOrOpen('/debug-console'),
    keywords: ['debug', 'console', 'serial', 'terminal', 'python', 'logs'],
  },
  {
    id: 'nav_model_compare',
    name: 'Open Model Compare',
    category: 'Navigation',
    icon: 'cpu',
    shortcut: null,
    action: () => navigateOrOpen('/model-comparison'),
    keywords: ['model', 'comparison', 'benchmark', 'llm', 'bench'],
  },
  {
    id: 'nav_circuit_sim',
    name: 'Open Circuit Sim',
    category: 'Navigation',
    icon: 'grid',
    shortcut: null,
    action: () => navigateOrOpen('/circuit-sim'),
    keywords: ['circuit', 'schematic', 'spice', 'simulation', 'resistor'],
  },
  {
    id: 'nav_datasheet',
    name: 'Open Datasheet Intelligence',
    category: 'Navigation',
    icon: 'file-plus',
    shortcut: null,
    action: () => navigateOrOpen('/datasheet'),
    keywords: ['datasheet', 'pdf', 'pinout', 'specs', 'specs list'],
  },
  {
    id: 'nav_notebook',
    name: 'Open Engineering Notebook',
    category: 'Navigation',
    icon: 'keyboard',
    shortcut: null,
    action: () => navigateOrOpen('/notebook'),
    keywords: ['notebook', 'journal', 'log', 'diary', 'observations'],
  },
  {
    id: 'nav_bom',
    name: 'Open BOM Intelligence',
    category: 'Navigation',
    icon: 'package',
    shortcut: null,
    action: () => navigateOrOpen('/bom'),
    keywords: ['bom', 'bill of materials', 'parts', 'pricing', 'order'],
  },
  {
    id: 'nav_formula_lab',
    name: 'Open Formula Lab',
    category: 'Navigation',
    icon: 'flask',
    shortcut: null,
    action: () => navigateOrOpen('/formula-lab'),
    keywords: ['formula', 'math', 'calculator', 'derivation', 'lab'],
  },
  {
    id: 'nav_templates',
    name: 'Open Templates Gallery',
    category: 'Navigation',
    icon: 'layout',
    shortcut: null,
    action: () => navigateOrOpen('/templates'),
    keywords: ['templates', 'gallery', 'presets', 'starter'],
  },
  {
    id: 'nav_challenges',
    name: 'Open Challenges Mode',
    category: 'Navigation',
    icon: 'palette',
    shortcut: null,
    action: () => navigateOrOpen('/challenges'),
    keywords: ['challenges', 'games', 'tasks', 'quiz', 'puzzles'],
  },
  {
    id: 'nav_firmware_diff',
    name: 'Open Firmware Diff',
    category: 'Navigation',
    icon: 'rotate-ccw',
    shortcut: null,
    action: () => navigateOrOpen('/firmware-diff'),
    keywords: ['firmware', 'diff', 'hex', 'binary', 'compare'],
  },
  {
    id: 'nav_pcb_reviewer',
    name: 'Open PCB Reviewer',
    category: 'Navigation',
    icon: 'cube',
    shortcut: null,
    action: () => navigateOrOpen('/pcb-reviewer'),
    keywords: ['pcb', 'gerber', 'review', 'drc', 'design rules'],
  },
  {
    id: 'nav_footprint_gen',
    name: 'Open Footprint Generator',
    category: 'Navigation',
    icon: 'cpu',
    shortcut: null,
    action: () => navigateOrOpen('/footprint-gen'),
    keywords: ['footprint', 'pcb footprint', 'package', 'gen', 'kicad footprint'],
  },
  {
    id: 'nav_supply_chain',
    name: 'Open Supply Chain Monitor',
    category: 'Navigation',
    icon: 'package',
    shortcut: null,
    action: () => navigateOrOpen('/supply-chain'),
    keywords: ['supply chain', 'stock', 'shipping', 'distributor', 'parts'],
  },
  {
    id: 'nav_test_harness',
    name: 'Open Test Harness',
    category: 'Navigation',
    icon: 'play',
    shortcut: null,
    action: () => navigateOrOpen('/test-harness'),
    keywords: ['test', 'harness', 'scripts', 'test cases'],
  },
  {
    id: 'nav_compliance',
    name: 'Open Compliance Checker',
    category: 'Navigation',
    icon: 'save',
    shortcut: null,
    action: () => navigateOrOpen('/compliance'),
    keywords: ['compliance', 'ce', 'fcc', 'rohs', 'standards'],
  },
  {
    id: 'nav_drawing_board',
    name: 'Open Drawing Board',
    category: 'Navigation',
    icon: 'palette',
    shortcut: null,
    action: () => navigateOrOpen('/drawing-board'),
    keywords: ['whiteboard', 'canvas', 'drawing board', 'sketch', 'drawing', 'board', 'pencil'],
  },

  // WORKSPACE ACTIONS
  {
    id: 'workspace_focus',
    name: 'Toggle Focus Mode',
    category: 'Workspace',
    icon: 'maximize',
    shortcut: ['⌘', '⇧', 'F'],
    action: () => toggleFocusMode(),
    keywords: ['focus', 'fullscreen', 'distraction free'],
  },
  {
    id: 'workspace_layouts',
    name: 'Open Layout Manager',
    category: 'Workspace',
    icon: 'layout',
    shortcut: ['⌘', '⇧', 'L'],
    action: () => openLayoutManager(),
    keywords: ['layout', 'arrange', 'windows', 'workspace'],
  },
  {
    id: 'workspace_save_layout',
    name: 'Save Current Layout',
    category: 'Workspace',
    icon: 'save',
    shortcut: null,
    action: () => saveCurrentLayout(),
    keywords: ['save layout', 'save workspace'],
  },
  {
    id: 'workspace_mode',
    name: 'Toggle Workspace Mode',
    category: 'Workspace',
    icon: 'grid',
    shortcut: ['⌘', '⇧', 'W'],
    action: () => toggleWorkspaceMode(),
    keywords: ['workspace', 'windows', 'multi', 'tiles'],
  },

  // PARAMETER PLAYGROUND ACTIONS
  {
    id: 'playground_reset',
    name: 'Reset All Parameters',
    category: 'Parameter Playground',
    icon: 'rotate-ccw',
    shortcut: null,
    action: () => playgroundEngine.resetAll(),
    keywords: ['reset parameters', 'default values'],
    requiresModule: 'playground',
  },
  {
    id: 'playground_share',
    name: 'Share Parameter Setup',
    category: 'Parameter Playground',
    icon: 'share',
    shortcut: null,
    action: () => playgroundEngine.shareSetup(),
    keywords: ['share', 'copy link', 'playground link'],
  },
  {
    id: 'playground_export_python',
    name: 'Export Parameters as Python',
    category: 'Parameter Playground',
    icon: 'download',
    shortcut: null,
    action: () => playgroundEngine.exportPython(),
    keywords: ['export', 'python', 'script', 'download'],
  },

  // NOTEBOOK ACTIONS
  {
    id: 'notebook_new_note',
    name: 'New Notebook Note',
    category: 'Notebook',
    icon: 'file-plus',
    shortcut: ['⌘', 'N'],
    action: () => notebookEngine.newEntry('NOTE'),
    keywords: ['new note', 'add note', 'log', 'notebook'],
  },
  {
    id: 'notebook_new_problem',
    name: 'Log a Problem',
    category: 'Notebook',
    icon: 'alert-triangle',
    shortcut: null,
    action: () => notebookEngine.newEntry('PROBLEM'),
    keywords: ['problem', 'issue', 'bug', 'log problem'],
  },
  {
    id: 'notebook_new_experiment',
    name: 'Log an Experiment',
    category: 'Notebook',
    icon: 'flask',
    shortcut: null,
    action: () => notebookEngine.newEntry('EXPERIMENT'),
    keywords: ['experiment', 'test', 'result'],
  },

  // BOM ACTIONS
  {
    id: 'bom_check_availability',
    name: 'Check BOM Availability',
    category: 'BOM',
    icon: 'package',
    shortcut: null,
    action: () => bomEngine.checkAvailability(),
    keywords: ['bom', 'stock', 'availability', 'parts'],
  },
  {
    id: 'bom_export_csv',
    name: 'Export BOM as CSV',
    category: 'BOM',
    icon: 'download',
    shortcut: null,
    action: () => bomEngine.exportCSV(),
    keywords: ['export bom', 'csv', 'download parts'],
  },

  // CAD VIEWER ACTIONS
  {
    id: 'cad_reset_view',
    name: 'Reset CAD Camera',
    category: 'CAD Viewer',
    icon: 'focus',
    shortcut: ['R'],
    action: () => cadEngine.resetCamera(),
    keywords: ['reset view', 'camera', 'fit model', 'cad'],
  },
  {
    id: 'cad_wireframe',
    name: 'Toggle Wireframe',
    category: 'CAD Viewer',
    icon: 'box',
    shortcut: ['W'],
    action: () => cadEngine.toggleWireframe(),
    keywords: ['wireframe', 'cad', 'mesh'],
  },
  {
    id: 'cad_analyze',
    name: 'Run AI Analysis on Model',
    category: 'CAD Viewer',
    icon: 'cpu',
    shortcut: null,
    action: () => cadEngine.runAIAnalysis(),
    keywords: ['analyze model', 'ai cad', 'review model'],
  },

  // DEBUG CONSOLE ACTIONS
  {
    id: 'debug_run',
    name: 'Run Code',
    category: 'Debug Console',
    icon: 'play',
    shortcut: ['⌘', 'Enter'],
    action: () => debugEngine.run(),
    keywords: ['run', 'execute', 'python', 'javascript'],
    requiresModule: 'debug-console',
  },
  {
    id: 'debug_analyze',
    name: 'AI Code Analysis',
    category: 'Debug Console',
    icon: 'search',
    shortcut: null,
    action: () => debugEngine.analyze(),
    keywords: ['analyze code', 'review', 'debug', 'bugs'],
  },
  {
    id: 'debug_serial',
    name: 'Connect Serial Monitor',
    category: 'Debug Console',
    icon: 'radio',
    shortcut: null,
    action: () => debugEngine.connectSerial(),
    keywords: ['serial', 'connect', 'hardware', 'uart', 'arduino'],
  },

  // AI / MODEL ACTIONS
  {
    id: 'model_picker',
    name: 'Switch AI Model',
    category: 'AI',
    icon: 'cpu',
    shortcut: ['⌘', 'M'],
    action: () => openModelPicker(),
    keywords: ['model', 'claude', 'gpt', 'gemini', 'switch model'],
  },
  {
    id: 'connect_openrouter',
    name: 'Connect OpenRouter',
    category: 'AI',
    icon: 'key',
    shortcut: null,
    action: () => openAPIKeyModal(),
    keywords: ['api key', 'openrouter', 'connect', 'setup'],
  },

  // SETTINGS
  {
    id: 'settings_theme',
    name: 'Change Color Theme',
    category: 'Settings',
    icon: 'palette',
    shortcut: null,
    action: () => openThemeSettings(),
    keywords: ['theme', 'colors', 'dark', 'appearance'],
  },
  {
    id: 'settings_shortcuts',
    name: 'View All Keyboard Shortcuts',
    category: 'Settings',
    icon: 'keyboard',
    shortcut: ['?'],
    action: () => openShortcutsOverlay(),
    keywords: ['shortcuts', 'keyboard', 'hotkeys', 'keybindings'],
  },

  // GLOBAL UTILITIES
  {
    id: 'global_undo',
    name: 'Undo Last Action',
    category: 'Global',
    icon: 'rotate-ccw',
    shortcut: ['⌘', 'Z'],
    action: () => globalUndo(),
    keywords: ['undo', 'revert', 'back'],
  },
  {
    id: 'version_history',
    name: 'Open Version History',
    category: 'Global',
    icon: 'clock',
    shortcut: null,
    action: () => openVersionHistory(),
    keywords: ['history', 'versions', 'snapshots', 'undo'],
  },
  {
    id: 'cross_search',
    name: 'Search Everything',
    category: 'Global',
    icon: 'search',
    shortcut: ['⌘', 'F'],
    action: () => openCrossModuleSearch(),
    keywords: ['search', 'find', 'global search'],
  },
];
