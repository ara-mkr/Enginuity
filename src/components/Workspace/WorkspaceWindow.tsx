import React, { useState, useEffect, useRef } from 'react'
import { X, Minus, Square, Minimize2, Columns, ChevronDown } from 'lucide-react'
import { useWorkspace, type WorkspaceWindow as WindowType } from '../../context/WorkspaceContext'
import { ProjectProvider } from '../../context/ProjectContext'
import { listProjects } from '../../utils/projectManager'
import { useFocusMode } from '../../context/FocusModeContext'


interface WorkspaceWindowProps {
  window: WindowType
  children: React.ReactNode
}

export const WorkspaceWindow: React.FC<WorkspaceWindowProps> = ({ window: win, children }) => {
  const {
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
    updateWindowPosition,
    updateWindowSize,
    setWindowProject,
    bringToFront,
    restoring,
  } = useWorkspace()

  const { isFocusMode } = useFocusMode()

  const [localPos, setLocalPos] = useState({ x: win.x, y: win.y })
  const [localSize, setLocalSize] = useState({ w: win.width, h: win.height })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [projSelectOpen, setProjSelectOpen] = useState(false)
  
  const windowRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef({ x: 0, y: 0 })
  const dragStartPos = useRef({ x: 0, y: 0 })
  const resizeStartSize = useRef({ w: 0, h: 0 })
  const projSelectRef = useRef<HTMLDivElement>(null)

  // Keep local state in sync with global state changes (like tiling/snapping)
  useEffect(() => {
    if (!isDragging) {
      setLocalPos({ x: win.x, y: win.y })
    }
  }, [win.x, win.y, isDragging])

  useEffect(() => {
    if (!isResizing) {
      setLocalSize({ w: win.width, h: win.height })
    }
  }, [win.width, win.height, isResizing])

  // Close project selector dropdown on click outside
  useEffect(() => {
    if (!projSelectOpen) return
    const handler = (e: MouseEvent) => {
      if (!projSelectRef.current?.contains(e.target as Node)) {
        setProjSelectOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [projSelectOpen])

  // Dragging logic
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    // Prevent dragging if clicking buttons or selectors
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.proj-select-container')) {
      return
    }
    
    e.preventDefault()
    bringToFront(win.id)
    
    if (win.isMaximized) return

    setIsDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY }
    dragStartPos.current = { x: localPos.x, y: localPos.y }
  }

  // Resizing logic
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    bringToFront(win.id)
    
    if (win.isMaximized) return

    setIsResizing(true)
    dragStart.current = { x: e.clientX, y: e.clientY }
    resizeStartSize.current = { w: localSize.w, h: localSize.h }
  }

  // Mouse move and up handlers for dragging/resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStart.current.x
        const dy = e.clientY - dragStart.current.y
        const nextX = Math.max(0, dragStartPos.current.x + dx)
        const nextY = Math.max(0, dragStartPos.current.y + dy)
        setLocalPos({ x: nextX, y: nextY })
      } else if (isResizing) {
        const dw = e.clientX - dragStart.current.x
        const dh = e.clientY - dragStart.current.y
        const nextW = Math.max(350, resizeStartSize.current.w + dw)
        const nextH = Math.max(250, resizeStartSize.current.h + dh)
        setLocalSize({ w: nextW, h: nextH })
      }
    }

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false)
        updateWindowPosition(win.id, localPos.x, localPos.y)
      } else if (isResizing) {
        setIsResizing(false)
        updateWindowSize(win.id, localSize.w, localSize.h)
      }
    }

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, localPos, localSize, win.id, updateWindowPosition, updateWindowSize])

  // Snap to half options
  const snapToHalf = (side: 'left' | 'right') => {
    const sidebarWidth = 260
    const w = Math.floor((window.innerWidth - sidebarWidth) / 2) - 10
    const h = window.innerHeight - 30
    const x = side === 'left' ? sidebarWidth + 5 : sidebarWidth + w + 10
    const y = 10
    
    updateWindowPosition(win.id, x, y)
    updateWindowSize(win.id, w, h)
    restoreWindow(win.id)
  }

  const projects = listProjects()
  const activeProjectName = projects.find(p => p.id === win.projectId)?.name || 'Default Project'

  return (
    <div
      ref={windowRef}
      onClick={() => bringToFront(win.id)}
      className={restoring ? 'window-restoring' : ''}
      style={{
        position: 'absolute',
        top: win.isMaximized ? 0 : localPos.y,
        left: win.isMaximized ? (isFocusMode ? 0 : 260) : localPos.x, // 260px is sidebar width
        width: win.isMaximized ? (isFocusMode ? '100%' : 'calc(100% - 260px)') : localSize.w,
        height: win.isMaximized ? '100%' : localSize.h,
        zIndex: win.zIndex,
        display: win.isMinimized ? 'none' : 'flex',
        flexDirection: 'column',
        background: 'rgba(12, 12, 18, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: win.isMaximized ? 0 : 10,
        boxShadow: win.isMaximized ? 'none' : '0 12px 40px rgba(0, 0, 0, 0.6)',
        overflow: 'hidden',
        transition: isDragging || isResizing ? 'none' : 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Title Bar / Header */}
      <div
        className="workspace-title-bar"
        onMouseDown={handleHeaderMouseDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: isFocusMode ? 20 : 38,
          padding: '0 12px',
          background: 'rgba(20, 20, 30, 0.9)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          cursor: win.isMaximized ? 'default' : 'grab',
          userSelect: 'none',
          flexShrink: 0,
          transition: 'height 150ms ease',
        }}
      >
        {/* Left Mac-style controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => closeWindow(win.id)}
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#ff5f56',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
            title="Close"
            data-tooltip="Close window"

          />
          {!isFocusMode && (
            <>
              <button
                onClick={() => minimizeWindow(win.id)}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: '#b09a50',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
                title="Minimize"
                data-tooltip="Minimize window"

              />
              <button
                onClick={() => win.isMaximized ? restoreWindow(win.id) : maximizeWindow(win.id)}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: '#27c93f',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
                title={win.isMaximized ? 'Restore' : 'Maximize'}
                data-tooltip={win.isMaximized ? 'Restore window' : 'Maximize window'}

              />
            </>
          )}
        </div>

        {/* Center Title */}
        {!isFocusMode && (
          <div
            className="window-title-text"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text)',
              opacity: 0.9,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '40%',
              textAlign: 'center',
            }}
          >
            {win.title}
          </div>
        )}

        {/* Right Action buttons (Project switch and Snapping) */}
        {!isFocusMode && (
          <div className="window-title-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Project switch dropdown */}
            <div ref={projSelectRef} className="proj-select-container" style={{ position: 'relative' }}>
              <button
                onClick={() => setProjSelectOpen(!projSelectOpen)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 4,
                  padding: '2px 8px',
                  height: 22,
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(0, 200, 255, 0.4)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
              >
                <span><span style={{ color: '#b8d4f0' }}>⊡</span> {activeProjectName}</span>
                <ChevronDown size={10} />
              </button>

              {projSelectOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    background: 'var(--surface)',
                    border: '1px solid var(--border-bright)',
                    borderRadius: 6,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                    zIndex: 200,
                    width: 180,
                    padding: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <div style={{ padding: '4px 6px', fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>
                    Target Project
                  </div>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setWindowProject(win.id, p.id)
                        setProjSelectOpen(false)
                      }}
                      style={{
                        background: p.id === win.projectId ? 'rgba(0, 200, 255, 0.1)' : 'transparent',
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px 8px',
                        fontSize: 11,
                        color: p.id === win.projectId ? 'var(--accent)' : 'var(--text-muted)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      onMouseEnter={(e) => {
                        if (p.id !== win.projectId) e.currentTarget.style.background = 'var(--surface-2)'
                      }}
                      onMouseLeave={(e) => {
                        if (p.id !== win.projectId) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <span style={{ color: '#b8d4f0' }}>⊡</span> {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Snap Split buttons */}
            {!win.isMaximized && (
              <>
                <button
                  onClick={() => snapToHalf('left')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    padding: 2,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Snap Left"
                  data-tooltip="Snap to left half"
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
                >
                  <Columns size={13} style={{ transform: 'rotate(180deg)' }} />
                </button>
                <button
                  onClick={() => snapToHalf('right')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    padding: 2,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Snap Right"
                  data-tooltip="Snap to right half"
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
                >
                  <Columns size={13} />
                </button>
              </>
            )}

            {/* Window control icons */}
            <button
              onClick={() => win.isMaximized ? restoreWindow(win.id) : maximizeWindow(win.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                alignItems: 'center',
              }}
              title={win.isMaximized ? 'Restore' : 'Maximize'}
              data-tooltip={win.isMaximized ? 'Restore window' : 'Maximize window'}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
            >
              {win.isMaximized ? <Minimize2 size={13} /> : <Square size={11} />}
            </button>
          </div>
        )}
      </div>

      {/* Content Area wrapped in local ProjectProvider */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <ProjectProvider projectId={win.projectId}>
          {children}
        </ProjectProvider>
      </div>

      {/* Resize Handle */}
      {!win.isMaximized && (
        <div
          onMouseDown={handleResizeMouseDown}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 14,
            height: 14,
            cursor: 'se-resize',
            zIndex: 100,
            background: 'linear-gradient(135deg, transparent 40%, rgba(255, 255, 255, 0.2) 40%, rgba(255, 255, 255, 0.2) 60%, transparent 60%, transparent 80%, rgba(255, 255, 255, 0.2) 80%)',
          }}
        />
      )}
    </div>
  )
}
