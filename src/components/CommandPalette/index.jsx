import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  setNavigate,
  setWorkspace,
  COMMANDS,
  analyzeCurrentFile,
  openNotebook,
  openBOM,
  wakeJarvis,
} from '../../config/commands';
import {
  LayoutDashboard,
  Box,
  Sliders,
  Mic,
  Maximize2,
  Layout,
  Save,
  Grid,
  RotateCcw,
  Share2,
  Download,
  FilePlus,
  AlertTriangle,
  FlaskConical,
  Package,
  Camera,
  Layers,
  Cpu,
  Play,
  Search,
  Radio,
  Key,
  Palette,
  Keyboard,
  Clock,
  Undo2,
  CornerDownLeft,
} from 'lucide-react';

const ICON_MAP = {
  'layout-dashboard': LayoutDashboard,
  'cube': Box,
  'sliders': Sliders,
  'mic': Mic,
  'maximize': Maximize2,
  'layout': Layout,
  'save': Save,
  'grid': Grid,
  'rotate-ccw': RotateCcw,
  'share': Share2,
  'download': Download,
  'file-plus': FilePlus,
  'alert-triangle': AlertTriangle,
  'flask': FlaskConical,
  'package': Package,
  'focus': Camera,
  'box': Layers,
  'cpu': Cpu,
  'play': Play,
  'search': Search,
  'radio': Radio,
  'key': Key,
  'palette': Palette,
  'keyboard': Keyboard,
  'clock': Clock,
  'undo': Undo2,
};

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const workspace = useWorkspace();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState([]);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const overlayRef = useRef(null);
  const selectedItemRef = useRef(null);

  // Sync navigation and workspace helpers on mount/render
  useEffect(() => {
    setNavigate(navigate);
    setWorkspace(workspace);
  }, [navigate, workspace]);

  // Load recents and handle focus on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      try {
        const stored = JSON.parse(localStorage.getItem('enginguity_recent_commands') || '[]');
        setRecentIds(stored);
      } catch (e) {
        setRecentIds([]);
      }
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  // Scroll active item into view
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  // Auto-close on URL change
  useEffect(() => {
    onClose();
  }, [window.location.pathname]);

  // Build commands list including runtime dynamic ones
  const allCommands = useMemo(() => {
    const dynamics = [];

    // 1. CAD file check
    let cadFile = null;
    if (window.cadEngine?.filename) {
      cadFile = window.cadEngine.filename;
    } else {
      try {
        const history = JSON.parse(localStorage.getItem('enginguity_file_history') || '[]');
        const cadEntry = history.find((f) =>
          ['stl', '3mf', 'kicad_pcb', 'gbr', 'step', 'iges', 'obj'].includes(f.ext?.toLowerCase())
        );
        if (cadEntry) cadFile = cadEntry.name;
      } catch { /* corrupted/missing stored value — fall back to default */ }
    }
    if (cadFile) {
      dynamics.push({
        id: 'dynamic_cad_analyze',
        name: `Analyze ${cadFile}`,
        category: 'Current Context',
        icon: 'cpu',
        action: () => analyzeCurrentFile(),
        keywords: ['analyze', 'cad', 'review', cadFile.toLowerCase()],
      });
    }

    // 2. Open problems check
    let openProblems = 0;
    try {
      const entries = JSON.parse(localStorage.getItem('enginguity_notebook') || '[]');
      openProblems = entries.filter((e) => e.type === 'PROBLEM' && e.status !== 'solved').length;
    } catch { /* corrupted/missing stored value — fall back to default */ }
    if (openProblems > 0) {
      dynamics.push({
        id: 'dynamic_notebook_problems',
        name: `View Open Problems (${openProblems})`,
        category: 'Current Context',
        icon: 'alert-triangle',
        action: () => openNotebook(),
        keywords: ['view problems', 'issues', 'bugs', 'notebook'],
      });
    }

    // 3. BOM alerts check
    let bomAlerts = 0;
    try {
      const items = JSON.parse(localStorage.getItem('enginguity_boms') || '[]');
      bomAlerts = items.filter(
        (i) =>
          (i.warnings && i.warnings.length > 0) ||
          i.stockStatus === 'out_of_stock' ||
          i.stockStatus === 'limited'
      ).length;
    } catch { /* corrupted/missing stored value — fall back to default */ }
    if (bomAlerts > 0) {
      dynamics.push({
        id: 'dynamic_bom_alerts',
        name: `BOM Alerts (${bomAlerts} items)`,
        category: 'Current Context',
        icon: 'package',
        action: () => openBOM(),
        keywords: ['bom alerts', 'stock alerts', 'warnings'],
      });
    }

    // 4. Jarvis sleeping check
    const isJarvisSleeping = !window.jarvis || window.jarvis.wakeState === 'sleeping';
    if (isJarvisSleeping) {
      dynamics.push({
        id: 'dynamic_wake_jarvis',
        name: 'Wake Jarvis',
        category: 'Current Context',
        icon: 'mic',
        action: () => wakeJarvis(),
        keywords: ['wake jarvis', 'wake', 'assistant', 'activate'],
      });
    }

    return [...dynamics, ...COMMANDS];
  }, [open]);

  // Search, Group and Flatten results
  const { filteredRecent, groupedAll, flatResultsList } = useMemo(() => {
    if (!query.trim()) {
      const recent = recentIds
        .map((id) => allCommands.find((c) => c.id === id))
        .filter(Boolean);

      const groups = {};
      allCommands.forEach((cmd) => {
        if (!groups[cmd.category]) {
          groups[cmd.category] = [];
        }
        groups[cmd.category].push(cmd);
      });

      // Flatten list in display order for indexing
      const flatList = [];
      
      // Dynamic context first
      if (groups['Current Context']?.length > 0) {
        flatList.push(...groups['Current Context']);
      }
      
      // Recents next
      if (recent.length > 0) {
        flatList.push(...recent);
      }

      // Rest of categories sorted
      const sortedCategories = Object.keys(groups)
        .filter((cat) => cat !== 'Current Context')
        .sort((a, b) => a.localeCompare(b));

      sortedCategories.forEach((cat) => {
        flatList.push(...groups[cat]);
      });

      return {
        filteredRecent: recent,
        groupedAll: groups,
        flatResultsList: flatList,
      };
    }

    // Filter and score using specified fuzzy rules
    const lower = query.toLowerCase();
    const scored = allCommands
      .map((cmd) => {
        let score = 0;

        // Exact name match
        if (cmd.name.toLowerCase() === lower) score += 100;
        // Name starts with query
        if (cmd.name.toLowerCase().startsWith(lower)) score += 50;
        // Name contains query
        if (cmd.name.toLowerCase().includes(lower)) score += 30;
        // Keyword match
        if (cmd.keywords?.some((k) => k.toLowerCase().includes(lower))) score += 20;
        // Category match
        if (cmd.category.toLowerCase().includes(lower)) score += 10;
        // Partial word match in name
        const words = cmd.name.toLowerCase().split(' ');
        if (words.some((w) => w.startsWith(lower))) score += 15;

        return { cmd, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ cmd }) => cmd);

    return {
      filteredRecent: [],
      groupedAll: { Results: scored },
      flatResultsList: scored,
    };
  }, [query, allCommands, recentIds]);

  // Reset selected index if it exceeds results length
  useEffect(() => {
    setSelectedIndex((prev) => {
      if (flatResultsList.length === 0) return 0;
      if (prev >= flatResultsList.length) return flatResultsList.length - 1;
      return prev;
    });
  }, [flatResultsList]);

  const executeCommand = (cmd) => {
    if (!cmd) return;
    
    // Save to recents
    const filtered = recentIds.filter((id) => id !== cmd.id);
    const updated = [cmd.id, ...filtered].slice(0, 8);
    setRecentIds(updated);
    try {
      localStorage.setItem('enginguity_recent_commands', JSON.stringify(updated));
    } catch { /* storage unavailable (private mode/quota) — safe to skip */ }

    // Run action
    cmd.action();
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (flatResultsList.length === 0 ? 0 : (prev + 1) % flatResultsList.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (flatResultsList.length === 0 ? 0 : (prev - 1 + flatResultsList.length) % flatResultsList.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatResultsList[selectedIndex]) {
        executeCommand(flatResultsList[selectedIndex]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (flatResultsList.length === 0) return;
      const currentCategory = flatResultsList[selectedIndex]?.category || '';
      // Find first item of the next category group (with wrap-around)
      let nextIndex = selectedIndex;
      for (let i = 1; i <= flatResultsList.length; i++) {
        const idx = (selectedIndex + i) % flatResultsList.length;
        if (flatResultsList[idx].category !== currentCategory) {
          nextIndex = idx;
          break;
        }
      }
      setSelectedIndex(nextIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  if (!open) return null;

  // Render Category Items Helper
  const renderItems = (items) => {
    return items.map((cmd) => {
      const isItemFocused = flatResultsList[selectedIndex]?.id === cmd.id;
      const IconComp = ICON_MAP[cmd.icon] || Box;

      return (
        <div
          key={cmd.id}
          ref={isItemFocused ? selectedItemRef : null}
          onClick={() => executeCommand(cmd)}
          onMouseEnter={() => {
            const idx = flatResultsList.findIndex((x) => x.id === cmd.id);
            if (idx !== -1) setSelectedIndex(idx);
          }}
          style={{
            height: 44,
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderRadius: 6,
            cursor: 'pointer',
            background: isItemFocused ? 'var(--surface-2)' : 'transparent',
            transition: 'background 100ms ease',
          }}
        >
          {/* Icon */}
          <IconComp size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />

          {/* Name & Category description */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ font: 'Geist 400, 14px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cmd.name}
            </span>
            <span style={{ font: 'Geist 400, 10px', color: 'var(--text-dim)' }}>
              {cmd.category}
            </span>
          </div>

          {/* Keyboard Shortcut Hint */}
          {cmd.shortcut && (
            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
              {cmd.shortcut.map((key, i) => (
                <span
                  key={i}
                  style={{
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    padding: '1px 5px',
                    font: 'Geist Mono 400, 10px',
                    color: 'var(--text-dim)',
                  }}
                >
                  {key}
                </span>
              ))}
            </div>
          )}

          {/* Enter indicator when hovered/selected */}
          {isItemFocused && (
            <CornerDownLeft size={12} style={{ color: 'var(--accent)', opacity: 0.7, marginLeft: 4 }} />
          )}
        </div>
      );
    });
  };

  // Build sorted category layout
  const categoriesToRender = !query.trim()
    ? Object.keys(groupedAll)
        .filter((cat) => cat !== 'Current Context')
        .sort((a, b) => a.localeCompare(b))
    : ['Results'];

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(8, 8, 16, 0.8)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
      }}
    >
      <div
        style={{
          width: 560,
          background: 'var(--surface)',
          border: '1px solid var(--border-bright)',
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Search Input */}
        <div
          style={{
            height: 52,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Search size={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, modules, actions..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              font: 'Geist 400, 15px',
              color: 'var(--text)',
            }}
          />
          <div
            style={{
              font: 'Geist 400, 11px',
              color: 'var(--text-dim)',
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              padding: '2px 6px',
              userSelect: 'none',
            }}
          >
            esc
          </div>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          style={{
            maxHeight: 400,
            overflowY: 'auto',
            padding: 6,
          }}
        >
          {flatResultsList.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', font: 'Geist 400, 13px', color: 'var(--text-dim)' }}>
              No commands matching "{query}"
            </div>
          ) : (
            <>
              {/* Dynamic Context Header & Items */}
              {!query.trim() && groupedAll['Current Context']?.length > 0 && (
                <div>
                  <div
                    style={{
                      height: 28,
                      padding: '0 12px',
                      display: 'flex',
                      alignItems: 'center',
                      font: 'Geist 400, 10px',
                      color: 'var(--accent)',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                    }}
                  >
                    CURRENT CONTEXT
                  </div>
                  {renderItems(groupedAll['Current Context'])}
                </div>
              )}

              {/* Recents Header & Items */}
              {!query.trim() && filteredRecent.length > 0 && (
                <div>
                  <div
                    style={{
                      height: 28,
                      padding: '0 12px',
                      display: 'flex',
                      alignItems: 'center',
                      font: 'Geist 400, 10px',
                      color: 'var(--text-dim)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    RECENT
                  </div>
                  {renderItems(filteredRecent)}
                </div>
              )}

              {/* Grouped Categories */}
              {categoriesToRender.map((cat) => {
                const categoryItems = groupedAll[cat] || [];
                if (categoryItems.length === 0) return null;

                return (
                  <div key={cat}>
                    <div
                      style={{
                        height: 28,
                        padding: '0 12px',
                        display: 'flex',
                        alignItems: 'center',
                        font: 'Geist 400, 10px',
                        color: 'var(--text-dim)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {cat}
                    </div>
                    {renderItems(categoryItems)}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
