import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Clock, BookOpen,
  Edit2, Plus, Download, Upload, Trash2, ChevronDown,
  GripVertical, HelpCircle, Search,
  MoreHorizontal, ArrowUp, ArrowDown, X as XIcon,
} from 'lucide-react'
import { useInstalledTools } from '../hooks/useInstalledTools'
import { iconForCustomTool } from '../config/toolRegistry'
import { AISettings } from './AISettings'
import { TutorialModal } from './TutorialModal'
import { onDraftUpdate, getObservationCount } from '../modules/live-docs/docWatcher'
import { FileHistory } from './FileHistory/index'
import { OpenRouterSetup } from './OpenRouterSetup'
import { UsageDashboard } from './UsageDashboard'
import { useWorkspace } from '../context/WorkspaceContext'
import { useFocusMode } from '../context/FocusModeContext'
import sidebarLogo from '../assets/sidebar-logo.png'
import {
  listProjects,
  getCurrentProjectId,
  getCurrentProjectName,
  createProject,
  switchProject,
  renameProject,
  deleteProject,
  exportProject,
  importProject
} from '../utils/projectManager'

const NAV_ORDER_KEY = 'enginguity_nav_order'

function loadStoredNavOrder(): string[] {
  try {
    const stored = localStorage.getItem(NAV_ORDER_KEY)
    if (stored) return JSON.parse(stored) as string[]
  } catch { /* ignore */ }
  return []
}

function menuItemStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    background: 'transparent',
    border: 'none',
    borderRadius: 4,
    color: disabled ? 'var(--text-dim)' : 'var(--text-muted)',
    fontSize: 12,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    cursor: disabled ? 'not-allowed' : 'pointer',
    textAlign: 'left',
    width: '100%',
    opacity: disabled ? 0.5 : 1,
  }
}

export function Sidebar() {
  const { layoutMode, setLayoutMode, openWindow, windows, restoreWindow, bringToFront } = useWorkspace()
  const { leftSidebarRevealed } = useFocusMode()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)
  const [aiSettingsOpen, setAISettingsOpen] = useState(false)

  // Installed tools come from the registry + user's marketplace selections
  const { installedTools, uninstall } = useInstalledTools()

  // Normalize each tool to { to, icon, label, pinned } for the nav rendering below.
  const navTools = useMemo(
    () => installedTools.map((t) => ({
      to: t.to,
      label: t.label,
      icon: t.kind === 'builtin' ? t.icon : iconForCustomTool(t.icon),
      pinned: t.kind === 'builtin' && !!t.pinned,
      id: t.id,
    })),
    [installedTools]
  )

  // Drag-to-reorder state
  const [navOrder, setNavOrder] = useState<string[]>(loadStoredNavOrder)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)
  const [dropAbove, setDropAbove] = useState(true)
  const dragNode = useRef<HTMLDivElement | null>(null)

  // Pinned items (Home, Tool Marketplace) always render first regardless of
  // stored order so they can't be buried at the bottom of a long sidebar.
  // Within pinned and within unpinned, stored order applies; newly-installed
  // tools land at the end of their group.
  const orderedItems = useMemo(() => {
    const byTo = new Map(navTools.map(t => [t.to, t]))
    const pinned = navTools.filter(t => t.pinned)
    const unpinned = navTools.filter(t => !t.pinned)
    const known = new Set<string>()
    const orderedUnpinned = navOrder
      .map(to => byTo.get(to))
      .filter((t): t is typeof navTools[number] => !!t && !t.pinned)
      .map(t => { known.add(t.to); return t })
    const extras = unpinned.filter(t => !known.has(t.to))
    return [...pinned, ...orderedUnpinned, ...extras]
  }, [navTools, navOrder])

  const saveOrder = useCallback((order: string[]) => {
    localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(order))
  }, [])

  const onDragStart = (e: React.DragEvent, idx: number) => {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    // ghost image fix — use current target
    dragNode.current = e.currentTarget as HTMLDivElement
  }

  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragIdx === null || dragIdx === idx) { setDropIdx(null); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const above = e.clientY < rect.top + rect.height / 2
    setDropIdx(idx)
    setDropAbove(above)
  }

  const onDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const above = e.clientY < rect.top + rect.height / 2
    // Reorder over the currently-rendered list, not the (possibly stale) stored order.
    const next = orderedItems.map(t => t.to)
    const [moved] = next.splice(dragIdx, 1)
    const target = dragIdx < idx ? idx - 1 : idx
    const insertAt = above ? target : target + 1
    next.splice(insertAt, 0, moved)
    setNavOrder(next)
    saveOrder(next)
    setDragIdx(null)
    setDropIdx(null)
  }

  const onDragEnd = () => {
    setDragIdx(null)
    setDropIdx(null)
  }

  // ── Per-item 3-dot menu ─────────────────────────────────────────────────────
  const [openMenuTo, setOpenMenuTo] = useState<string | null>(null)
  useEffect(() => {
    if (!openMenuTo) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-nav-menu]')) setOpenMenuTo(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMenuTo])

  const moveItem = useCallback((to: string, direction: -1 | 1) => {
    const list = orderedItems.map(t => t.to)
    const idx = list.indexOf(to)
    if (idx === -1) return
    const item = orderedItems[idx]
    if (item.pinned) return
    const target = idx + direction
    const swap = orderedItems[target]
    if (!swap || swap.pinned) return
    const next = [...list]
    next.splice(idx, 1)
    next.splice(target, 0, to)
    setNavOrder(next)
    saveOrder(next)
  }, [orderedItems, saveOrder])

  const handleRemove = useCallback((id: string, to: string) => {
    uninstall(id)
    setOpenMenuTo(null)
    const next = navOrder.filter(t => t !== to)
    setNavOrder(next)
    saveOrder(next)
  }, [uninstall, navOrder, saveOrder])

  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [docObsCount, setDocObsCount] = useState(() => { try { return getObservationCount() } catch { return 0 } })
  const [docPulse, setDocPulse] = useState(false)
  useEffect(() => {
    try {
      const unsub = onDraftUpdate(() => {
        try { setDocObsCount(getObservationCount()) } catch { /* ignore */ }
        setDocPulse(true)
        setTimeout(() => setDocPulse(false), 2000)
      })
      return () => { unsub() }
    } catch { /* ignore */ }
  }, [])

  // Project Switcher States
  const [projDropdownOpen, setProjDropdownOpen] = useState(false)
  const [newProjName, setNewProjName] = useState('')
  const [renamingProjId, setRenamingProjId] = useState<string | null>(null)
  const [renameInputVal, setRenameInputVal] = useState('')
  const projDropdownRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!projDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (!projDropdownRef.current?.contains(e.target as Node)) {
        setProjDropdownOpen(false)
        setRenamingProjId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [projDropdownOpen])

  const handleCreate = () => {
    if (!newProjName.trim()) return
    const newId = createProject(newProjName)
    setNewProjName('')
    switchProject(newId)
  }

  const handleExport = (id: string) => {
    try {
      const json = exportProject(id)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const list = listProjects()
      const p = list.find(item => item.id === id)
      const cleanName = (p ? p.name : 'project').toLowerCase().replace(/[^a-z0-9]+/g, '_')
      a.download = `${cleanName}.enginguity`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Failed to export project: ' + (err as Error).message)
    }
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const importedId = importProject(text)
        switchProject(importedId)
      } catch (err) {
        alert('Failed to import project: ' + (err as Error).message)
      }
    }
    reader.readAsText(file)
  }

  return (
    <aside
      className={`flex flex-col shrink-0 h-full border-r sidebar-left ${leftSidebarRevealed ? 'revealed' : ''}`}
      style={{
        width: 'var(--sidebar-width)',
        background: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >


      {/* Logo */}
      <NavLink to="/" style={{ borderBottom: '1px solid var(--border)', overflow: 'visible', height: 72, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
        <img src={sidebarLogo} alt="Enginuity" style={{ width: '130%', height: 'auto', display: 'block', marginLeft: '2%' }} />
      </NavLink>

      {/* Project Switcher */}
      <div ref={projDropdownRef} style={{ borderBottom: '1px solid var(--border)', padding: '8px 12px', position: 'relative' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, paddingLeft: 4 }}>
          Workspace
        </div>
        <button
          onClick={() => setProjDropdownOpen(!projDropdownOpen)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 8px',
            borderRadius: 6,
            background: projDropdownOpen ? 'var(--surface-2)' : 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            cursor: 'pointer',
            textAlign: 'left',
            outline: 'none',
            justifyContent: 'space-between',
            boxSizing: 'border-box'
          }}
          onMouseEnter={(e) => {
            if (!projDropdownOpen) e.currentTarget.style.background = 'var(--surface-2)'
          }}
          onMouseLeave={(e) => {
            if (!projDropdownOpen) e.currentTarget.style.background = 'transparent'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, flex: 1 }}>
              <BookOpen size={13} style={{ color: '#b8d4f0', flexShrink: 0, verticalAlign: 'middle', marginRight: 2 }} /> {getCurrentProjectName()}
            </span>
          </div>
          <ChevronDown size={12} style={{ color: 'var(--text-muted)', transform: projDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
        </button>

        {projDropdownOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 12,
            right: 12,
            background: 'var(--surface)',
            border: '1px solid var(--border-bright)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 100,
            marginTop: 4,
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            boxSizing: 'border-box'
          }}>
            <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {listProjects().map((p) => {
                const isActive = p.id === getCurrentProjectId()
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px', borderRadius: 4 }}>
                    {renamingProjId === p.id ? (
                      <input
                        value={renameInputVal}
                        onChange={(e) => setRenameInputVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            renameProject(p.id, renameInputVal)
                            setRenamingProjId(null)
                            setNewProjName(prev => prev)
                          }
                        }}
                        style={{
                          flex: 1,
                          fontSize: 12,
                          background: 'var(--bg-2)',
                          border: '1px solid var(--border)',
                          borderRadius: 3,
                          padding: '2px 4px',
                          color: 'var(--text)',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => {
                          if (!isActive) switchProject(p.id)
                        }}
                        style={{
                          flex: 1,
                          textAlign: 'left',
                          background: 'none',
                          border: 'none',
                          color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                          fontSize: 12,
                          cursor: isActive ? 'default' : 'pointer',
                          padding: '4px 6px',
                          borderRadius: 4,
                          fontWeight: isActive ? 600 : 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'var(--surface-2)'
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'none'
                        }}
                      >
                        {isActive ? '• ' : ''}{p.name}
                      </button>
                    )}

                    <div style={{ display: 'flex', gap: 2, marginLeft: 4, flexShrink: 0 }}>
                      <button
                        title="Rename"
                        data-tooltip="Rename project"
                        onClick={() => {
                          setRenamingProjId(p.id)
                          setRenameInputVal(p.name)
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2 }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
                      >
                        <Edit2 size={10} />
                      </button>
                      <button
                        title="Export Template"
                        data-tooltip="Export as template"
                        onClick={() => handleExport(p.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2 }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
                      >
                        <Download size={10} />
                      </button>
                      {listProjects().length > 1 && (
                        <button
                          title="Delete"
                          data-tooltip="Delete project"
                          onClick={() => {
                            if (confirm(`Delete project "${p.name}"? This cannot be undone.`)) {
                              deleteProject(p.id)
                            }
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2 }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#b08080'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* New project form */}
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  placeholder="New project name..."
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate()
                  }}
                  style={{
                    flex: 1,
                    fontSize: 11,
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: '4px 6px',
                    color: 'var(--text)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    minWidth: 0
                  }}
                />
                <button
                  onClick={handleCreate}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    background: 'transparent',
                    border: '1px solid var(--accent)',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    fontSize: 11,
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-glow)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  Create
                </button>
              </div>

              {/* Import template */}
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '5px 8px',
                  borderRadius: 4,
                  background: 'transparent',
                  border: '1px dashed var(--border)',
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  cursor: 'pointer',
                  marginTop: 2,
                  boxSizing: 'border-box'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-bright)'
                  e.currentTarget.style.color = 'var(--text)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text-muted)'
                }}
              >
                <Upload size={10} /> Import Template (.enginguity)
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".enginguity,.json"
                onChange={handleImport}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Search Button */}
      <div style={{ padding: '8px 12px 0px' }}>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('enginguity_open_command_palette'))}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            borderRadius: 6,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            textAlign: 'left',
            outline: 'none',
            fontSize: 12,
            fontFamily: "'DM Sans', sans-serif",
            boxSizing: 'border-box'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text)'
            e.currentTarget.style.borderColor = 'var(--border-bright)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)'
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          <Search size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>Search commands...</span>
          <span style={{
            fontSize: 9,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            padding: '1px 4px',
            fontFamily: 'monospace',
            color: 'var(--text-dim)',
            flexShrink: 0
          }}>⌘K</span>
        </button>
      </div>

      {/* Workspace Mode Selector */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', paddingLeft: 4 }}>
          Layout Mode
        </div>
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: 2, borderRadius: 6, border: '1px solid var(--border)' }}>
          <button
            onClick={() => setLayoutMode('single')}
            style={{
              flex: 1,
              padding: '6px 0',
              borderRadius: 4,
              border: 'none',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              background: layoutMode === 'single' ? 'var(--surface-2)' : 'transparent',
              color: layoutMode === 'single' ? 'var(--text)' : 'var(--text-muted)',
              transition: 'all 0.15s ease'
            }}
          >
            Tabbed
          </button>
          <button
            onClick={() => setLayoutMode('workspace')}
            style={{
              flex: 1,
              padding: '6px 0',
              borderRadius: 4,
              border: 'none',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              background: layoutMode === 'workspace' ? 'var(--surface-2)' : 'transparent',
              color: layoutMode === 'workspace' ? 'var(--text)' : 'var(--text-muted)',
              transition: 'all 0.15s ease'
            }}
          >
            Workspace
          </button>
        </div>
      </div>

      {/* Nav section label */}
      <div style={{ padding: '20px 0 6px 12px' }}>
        <span className="label">Modules</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col flex-1 overflow-y-auto" style={{ padding: '0 8px', gap: 0 }}>
        {orderedItems.map(({ to, icon: Icon, label, pinned, id }, idx) => {
          const showLineAbove = dropIdx === idx && dropAbove && dragIdx !== idx
          const showLineBelow = dropIdx === idx && !dropAbove && dragIdx !== idx
          const isDragging = dragIdx === idx
          return (
            <div
              key={to}
              draggable
              onDragStart={e => onDragStart(e, idx)}
              onDragOver={e => onDragOver(e, idx)}
              onDrop={e => onDrop(e, idx)}
              onDragEnd={onDragEnd}
              style={{ position: 'relative' }}
            >
              {/* Drop indicator above */}
              {showLineAbove && (
                <div style={{ position: 'absolute', top: 0, left: 8, right: 8, height: 2, background: 'var(--accent)', borderRadius: 2, zIndex: 10, pointerEvents: 'none' }} />
              )}

              <NavLink
                to={to}
                end={to === '/'}
                onClick={(e) => {
                  if (layoutMode === 'workspace') {
                    if (to === '/') {
                      setLayoutMode('single')
                      return
                    }
                    e.preventDefault()
                    const type = to.replace('/', '')
                    const existing = windows.find((w) => w.type === type)
                    if (existing) {
                      if (existing.isMinimized) {
                        restoreWindow(existing.id)
                      } else {
                        bringToFront(existing.id)
                      }
                    } else {
                      openWindow(type)
                    }
                  }
                }}
                style={{ textDecoration: 'none', display: 'block' }}
              >
                {({ isActive }) => {
                  const isWindowOpen = layoutMode === 'workspace' && windows.some((w) => w.type === to.replace('/', '') && !w.isMinimized)
                  const isEffectiveActive = layoutMode === 'workspace' ? isWindowOpen : isActive
                  return (
                    <div
                      className="flex items-center gap-2 rounded-md"
                      style={{
                        height: 34,
                        padding: '0 8px 0 12px',
                        background: isEffectiveActive ? 'var(--surface-2)' : 'transparent',
                        borderLeft: isEffectiveActive ? '2px solid var(--accent)' : '2px solid transparent',
                        color: isEffectiveActive ? 'var(--text)' : 'var(--text-muted)',
                        transition: 'background 120ms ease, color 120ms ease',
                        opacity: isDragging ? 0.35 : 1,
                        cursor: 'grab',
                        userSelect: 'none',
                        marginBottom: 2,
                      }}
                      onMouseEnter={e => {
                        if (!isEffectiveActive) {
                          e.currentTarget.style.background = 'var(--surface-2)'
                          e.currentTarget.style.color = 'var(--text)'
                        }
                        const grip = e.currentTarget.querySelector('.grip-handle') as HTMLElement | null
                        if (grip) grip.style.opacity = '1'
                      }}
                      onMouseLeave={e => {
                        if (!isEffectiveActive) {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'var(--text-muted)'
                        }
                        const grip = e.currentTarget.querySelector('.grip-handle') as HTMLElement | null
                        if (grip) grip.style.opacity = '0'
                      }}
                    >
                      <Icon size={15} className="shrink-0" style={{ color: 'currentColor', flexShrink: 0 }} />
                      <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, fontWeight: 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {label}
                      </span>
                      {to === '/live-docs' && (
                        <span
                          title={`${docObsCount} observations collected`}
                          style={{
                            width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginRight: 4,
                            background: docPulse ? 'var(--accent)' : 'var(--border-bright)',
                            transition: 'background 0.3s',
                            animation: 'livepulse 2.5s ease-in-out infinite',
                          }}
                        />
                      )}
                      
                      {layoutMode === 'workspace' && to !== '/' && (
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            openWindow(to.replace('/', ''))
                          }}
                          title="Open new session"
                          data-tooltip="Open in new panel"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-dim)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2px 4px',
                            borderRadius: 4,
                            marginLeft: 4,
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
                        >
                          <Plus size={12} />
                        </button>
                      )}

                      {/* 3-dot menu — appears on hover; opens persistent menu on click */}
                      <div
                        data-nav-menu
                        className="grip-handle"
                        style={{
                          position: 'relative',
                          flexShrink: 0,
                          opacity: openMenuTo === to ? 1 : 0,
                          transition: 'opacity 120ms',
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setOpenMenuTo(openMenuTo === to ? null : to)
                          }}
                          title="Tool options"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-dim)',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            borderRadius: 4,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
                        >
                          <MoreHorizontal size={13} />
                        </button>

                        {openMenuTo === to && (
                          <div
                            data-nav-menu
                            onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                            style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              marginTop: 4,
                              minWidth: 150,
                              background: 'var(--surface)',
                              border: '1px solid var(--border-bright)',
                              borderRadius: 6,
                              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                              padding: 4,
                              zIndex: 50,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 1,
                            }}
                          >
                            <button
                              disabled={pinned || idx === 0 || (orderedItems[idx - 1]?.pinned)}
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveItem(to, -1); setOpenMenuTo(null) }}
                              style={menuItemStyle(pinned || idx === 0 || (orderedItems[idx - 1]?.pinned ?? false))}
                            >
                              <ArrowUp size={12} /> Move up
                            </button>
                            <button
                              disabled={pinned || idx === orderedItems.length - 1}
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveItem(to, 1); setOpenMenuTo(null) }}
                              style={menuItemStyle(pinned || idx === orderedItems.length - 1)}
                            >
                              <ArrowDown size={12} /> Move down
                            </button>
                            <div style={{ height: 1, background: 'var(--border)', margin: '2px 4px' }} />
                            <button
                              disabled={pinned}
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemove(id, to) }}
                              style={{ ...menuItemStyle(pinned), color: pinned ? 'var(--text-dim)' : '#e08080' }}
                              title={pinned ? 'This tool is pinned and cannot be removed' : 'Remove from sidebar'}
                            >
                              <XIcon size={12} /> Remove
                            </button>
                          </div>
                        )}
                      </div>

                      <GripVertical
                        size={12}
                        className="grip-handle"
                        style={{ flexShrink: 0, color: 'var(--text-dim)', opacity: 0, transition: 'opacity 120ms', cursor: 'grab' }}
                      />
                    </div>
                  )
                }}
              </NavLink>

              {/* Drop indicator below */}
              {showLineBelow && (
                <div style={{ position: 'absolute', bottom: 0, left: 8, right: 8, height: 2, background: 'var(--accent)', borderRadius: 2, zIndex: 10, pointerEvents: 'none' }} />
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t flex flex-col" style={{ borderColor: 'var(--border)' }}>
        {/* Watch Tutorial */}
        <button
          onClick={() => setTutorialOpen(true)}
          className="flex items-center gap-2 rounded-md"
          style={{
            margin: '8px 8px 0',
            padding: '0 12px',
            height: 34,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'background 120ms ease, color 120ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface-2)'
            e.currentTarget.style.color = 'var(--text)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-muted)'
          }}
        >
          <HelpCircle size={14} className="shrink-0" />
          <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13 }}>
            Watch Tutorial
          </span>
        </button>

        {/* File history */}
        <button
          onClick={() => setHistoryOpen(true)}
          className="flex items-center gap-2 rounded-md"
          style={{
            margin: '8px 8px 0',
            padding: '0 12px',
            height: 34,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'background 120ms ease, color 120ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface-2)'
            e.currentTarget.style.color = 'var(--text)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-muted)'
          }}
        >
          <Clock size={14} className="shrink-0" />
          <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13 }}>
            File History
          </span>
        </button>

      </div>

      <style>{`@keyframes livepulse { 0%,100%{opacity:.5} 50%{opacity:1} }`}</style>
      {historyOpen && <FileHistory onClose={() => setHistoryOpen(false)} />}
      {setupOpen && <OpenRouterSetup onClose={() => setSetupOpen(false)} />}
      {usageOpen && <UsageDashboard onClose={() => setUsageOpen(false)} />}
      {aiSettingsOpen && <AISettings onClose={() => setAISettingsOpen(false)} />}
      {tutorialOpen && <TutorialModal onClose={() => setTutorialOpen(false)} />}
    </aside>
  )
}
