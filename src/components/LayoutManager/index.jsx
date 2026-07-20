import React, { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, Edit2, Copy, MoreVertical, Play } from 'lucide-react'
import { useWorkspace } from '../../context/WorkspaceContext'
import { layoutEngine } from '../../engine/layoutEngine'
import { TemplateSelectorModal } from './TemplateSelectorModal'

export { TemplateSelectorModal }

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return 'Never'
  const diff = Date.now() - ts
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  const days = Math.floor(diff / 86400000)
  return days === 1 ? '1 day ago' : `${days} days ago`
}

// ── Layout Manager Modal ──────────────────────────────────────────────────────
export const LayoutManagerModal = ({ isOpen, onClose, onNewWorkspace }) => {
  const { windows, applyLayoutState } = useWorkspace()
  const [savedLayouts, setSavedLayouts] = useState([])
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [activeMenuId, setActiveMenuId] = useState(null)
  const [editingLayoutId, setEditingLayoutId] = useState(null)
  const [editName, setEditName] = useState('')
  const [toastMessage, setToastMessage] = useState(null)
  const [errorLimit, setErrorLimit] = useState(false)

  const menuRef = useRef(null)
  const saveNameInputRef = useRef(null)

  // Fetch saved layouts
  const refreshLayouts = () => {
    setSavedLayouts(layoutEngine.getAll())
  }

  useEffect(() => {
    if (isOpen) {
      refreshLayouts()
      setErrorLimit(layoutEngine.getAll().length >= 20)
    }
  }, [isOpen])

  // Focus name input when save form opens
  useEffect(() => {
    if (showSaveForm) {
      saveNameInputRef.current?.focus()
    }
  }, [showSaveForm])

  // Close context menu on click outside
  useEffect(() => {
    if (!activeMenuId) return
    const handler = (e) => {
      if (!menuRef.current?.contains(e.target)) {
        setActiveMenuId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [activeMenuId])

  // Escape key to close modal
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 2500)
  }

  const handleSaveCurrent = (e) => {
    e.preventDefault()
    if (!newName.trim()) return

    if (savedLayouts.length >= 20) {
      showToast('Limit reached: max 20 saved layouts.')
      return
    }

    try {
      // Gather current window state
      const copilotOpen = localStorage.getItem('enginguity_copilot_open') !== 'false'
      const activeModule = 'workspace'
      
      const currentWindowState = {
        windows,
        sidebarCollapsed: false,
        copilotOpen,
        activeModule
      }

      layoutEngine.save(newName.trim(), newDesc.trim(), currentWindowState)
      setNewName('')
      setNewDesc('')
      setShowSaveForm(false)
      refreshLayouts()
      showToast('Layout saved successfully')
    } catch (err) {
      showToast('Failed to save layout')
    }
  }

  const handleApply = (layout) => {
    applyLayoutState(layout)
    onClose()
  }

  const handleDelete = (id, e) => {
    e.stopPropagation()
    layoutEngine.delete(id)
    refreshLayouts()
    setActiveMenuId(null)
    showToast('Layout deleted')
  }

  const handleRename = (id, newNameVal) => {
    if (!newNameVal.trim()) return
    const layouts = layoutEngine.getAll()
    const layout = layouts.find(l => l.id === id)
    if (layout) {
      layout.name = newNameVal.trim()
      localStorage.setItem('enginguity_saved_layouts', JSON.stringify(layouts))
      refreshLayouts()
    }
    setEditingLayoutId(null)
    setActiveMenuId(null)
    showToast('Layout renamed')
  }

  const handleDuplicate = (layout, e) => {
    e.stopPropagation()
    if (savedLayouts.length >= 20) {
      showToast('Limit reached: max 20 saved layouts.')
      return
    }

    try {
      const mockState = {
        windows: layout.windows,
        sidebarCollapsed: layout.sidebarCollapsed,
        copilotOpen: layout.copilotOpen,
        activeModule: layout.activeModule
      }
      layoutEngine.save(`${layout.name} (Copy)`, layout.description, mockState)
      refreshLayouts()
      setActiveMenuId(null)
      showToast('Layout duplicated')
    } catch (err) {
      showToast('Failed to duplicate layout')
    }
  }

  const presets = layoutEngine.getPresetLayouts()

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: 640,
          maxHeight: '90vh',
          background: 'var(--surface)',
          border: '1px solid var(--border-bright)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--text)', fontFamily: "'DM Sans Variable', 'DM Sans', sans-serif" }}>
            Layouts
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => {
                if (onNewWorkspace) {
                  onNewWorkspace()
                }
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 6,
                padding: '5px 12px',
                color: 'var(--text)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'}
            >
              <Plus size={13} />
              New Workspace
            </button>
            <button
              onClick={() => {
                if (errorLimit) {
                  showToast('Cannot save: Max limit of 20 layouts reached.')
                } else {
                  setShowSaveForm(!showSaveForm)
                }
              }}
              style={{
                background: 'rgba(0, 200, 255, 0.12)',
                border: '1px solid rgba(0, 200, 255, 0.3)',
                borderRadius: 6,
                padding: '5px 12px',
                color: 'var(--accent)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 200, 255, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0, 200, 255, 0.12)'}
            >
              <Plus size={13} />
              Save Current →
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2 }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Inline Save Form */}
        {showSaveForm && (
          <form
            onSubmit={handleSaveCurrent}
            style={{
              padding: '14px 20px',
              background: 'rgba(255,255,255,0.02)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={saveNameInputRef}
                type="text"
                placeholder="Layout name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                style={{
                  flex: 1,
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  color: 'var(--text)',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Optional description..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                style={{
                  flex: 1,
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  color: 'var(--text)',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowSaveForm(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '4px 12px',
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  background: 'var(--text)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 12px',
                  color: 'var(--bg)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Save Layout
              </button>
            </div>
          </form>
        )}

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 20 }}>
          {/* Presets Section */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '12px 20px 8px', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>
              Presets
            </div>
            <div
              style={{
                display: 'flex',
                gap: 12,
                padding: '0 20px 12px',
                overflowX: 'auto',
                scrollbarWidth: 'none', // Firefox
                msOverflowStyle: 'none', // IE 10+
              }}
            >
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => handleApply(preset)}
                  style={{
                    width: 160,
                    height: 100,
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'border-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-bright)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  {/* Thumbnail */}
                  <div style={{ height: 70, background: '#08080f', overflow: 'hidden', position: 'relative' }}>
                    {preset.thumbnail ? (
                      <img src={preset.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 9, color: 'var(--text-dim)' }}>
                        No Preview
                      </div>
                    )}
                  </div>
                  {/* Card Footer */}
                  <div style={{ height: 30, padding: '2px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {preset.name}
                    </span>
                    <span style={{ fontSize: 8, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {preset.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Saved Layouts Section */}
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '12px 20px 8px', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>
              Saved Layouts ({savedLayouts.length}/20)
            </div>
            
            {savedLayouts.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 20px', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500 }}>No saved layouts yet</span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Save your current arrangement to reuse it later</span>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, padding: '0 20px' }}>
                {savedLayouts.map((layout) => (
                  <div
                    key={layout.id}
                    onClick={() => handleApply(layout)}
                    style={{
                      height: 100,
                      background: 'var(--bg-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      transition: 'border-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-bright)'
                      const menuBtn = e.currentTarget.querySelector('.card-menu-trigger')
                      if (menuBtn) menuBtn.style.opacity = '1'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)'
                      const menuBtn = e.currentTarget.querySelector('.card-menu-trigger')
                      if (menuBtn) menuBtn.style.opacity = '0'
                    }}
                  >
                    {/* Thumbnail */}
                    <div style={{ height: 70, background: '#08080f', overflow: 'hidden', position: 'relative' }}>
                      {layout.thumbnail ? (
                        <img src={layout.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 9, color: 'var(--text-dim)' }}>
                          No Preview
                        </div>
                      )}

                      {/* Top right trigger */}
                      {editingLayoutId !== layout.id && (
                        <button
                          className="card-menu-trigger"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveMenuId(activeMenuId === layout.id ? null : layout.id)
                          }}
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            background: 'rgba(0,0,0,0.5)',
                            border: 'none',
                            borderRadius: '50%',
                            width: 20,
                            height: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#fff',
                            opacity: activeMenuId === layout.id ? 1 : 0,
                            transition: 'opacity 0.15s ease',
                            zIndex: 10,
                          }}
                        >
                          <MoreVertical size={11} />
                        </button>
                      )}

                      {/* Dropdown Menu */}
                      {activeMenuId === layout.id && (
                        <div
                          ref={menuRef}
                          style={{
                            position: 'absolute',
                            top: 26,
                            right: 4,
                            background: 'var(--surface)',
                            border: '1px solid var(--border-bright)',
                            borderRadius: 6,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            padding: 3,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            zIndex: 100,
                            width: 100,
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditName(layout.name)
                              setEditingLayoutId(layout.id)
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              borderRadius: 4,
                              padding: '4px 6px',
                              fontSize: 10,
                              color: 'var(--text-muted)',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <Edit2 size={9} />
                            Rename
                          </button>
                          <button
                            onClick={(e) => handleDuplicate(layout, e)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              borderRadius: 4,
                              padding: '4px 6px',
                              fontSize: 10,
                              color: 'var(--text-muted)',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <Copy size={9} />
                            Duplicate
                          </button>
                          <hr style={{ border: 'none', borderBottom: '1px solid var(--border)', margin: '2px 0' }} />
                          <button
                            onClick={(e) => handleDelete(layout.id, e)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              borderRadius: 4,
                              padding: '4px 6px',
                              fontSize: 10,
                              color: '#b08080',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 107, 107, 0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <Trash2 size={9} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div style={{ height: 30, padding: '2px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderTop: '1px solid var(--border)' }}>
                      {editingLayoutId === layout.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(layout.id, editName)
                            if (e.key === 'Escape') setEditingLayoutId(null)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          style={{
                            width: '100%',
                            fontSize: 9,
                            background: 'var(--bg)',
                            border: '1px solid var(--accent)',
                            borderRadius: 4,
                            padding: '1px 4px',
                            color: 'var(--text)',
                            outline: 'none',
                          }}
                        />
                      ) : (
                        <>
                          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {layout.name}
                          </span>
                          <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>
                            Used {timeAgo(layout.lastUsed)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--surface)',
            border: '1px solid var(--border-bright)',
            color: 'var(--text)',
            padding: '8px 18px',
            borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            fontSize: 12,
            zIndex: 100000,
            pointerEvents: 'none',
            fontFamily: "'DM Sans Variable', 'DM Sans', sans-serif",
          }}
        >
          {toastMessage}
        </div>
      )}
    </div>
  )
}

// ── Quick Layout Switcher Dropdown ───────────────────────────────────────────
export const QuickLayoutSwitcher = () => {
  const { activeLayoutId, applyLayoutState } = useWorkspace()
  const [isOpen, setIsOpen] = useState(false)
  const [layouts, setLayouts] = useState([])
  const containerRef = useRef(null)

  // Fetch layouts
  const loadLayouts = () => {
    setLayouts([...layoutEngine.getPresetLayouts(), ...layoutEngine.getAll()])
  }

  useEffect(() => {
    if (isOpen) {
      loadLayouts()
    }
  }, [isOpen, activeLayoutId])

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  // Find active layout name
  const allLayouts = [...layoutEngine.getPresetLayouts(), ...layoutEngine.getAll()]
  const activeLayout = allLayouts.find(l => l.id === activeLayoutId)
  const displayName = activeLayoutId ? (activeLayout ? activeLayout.name : 'Custom') : 'Unsaved'

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 4,
          padding: '4px 10px',
          color: activeLayoutId ? 'var(--accent)' : 'var(--text-muted)',
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 24,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
        }}
      >
        <span><span style={{ color: '#b8d4f0' }}>▭</span> {displayName}</span>
        <ChevronDown size={10} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.1s' }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: 'var(--surface)',
            border: '1px solid var(--border-bright)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 10000,
            width: 220,
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <div style={{ padding: '4px 8px', fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>
            Select Layout
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {layouts.map((l) => (
              <button
                key={l.id}
                onClick={() => {
                  applyLayoutState(l)
                  setIsOpen(false)
                }}
                style={{
                  background: l.id === activeLayoutId ? 'rgba(0, 200, 255, 0.08)' : 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  padding: '5px 8px',
                  fontSize: 11,
                  color: l.id === activeLayoutId ? 'var(--accent)' : 'var(--text-muted)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  if (l.id !== activeLayoutId) e.currentTarget.style.background = 'var(--surface-2)'
                }}
                onMouseLeave={(e) => {
                  if (l.id !== activeLayoutId) e.currentTarget.style.background = 'transparent'
                }}
              >
                {/* Visual strip thumbnail indicator */}
                <div style={{ display: 'flex', gap: 1, width: 14, height: 10 }}>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 1 }} />
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 1 }} />
                </div>
                <span>{l.name}</span>
                {l.preset && (
                  <span style={{ fontSize: 8, padding: '1px 3px', borderRadius: 3, background: 'rgba(255,255,255,0.06)', color: 'var(--text-dim)', marginLeft: 'auto' }}>
                    Preset
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ChevronDown({ size, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
