// src/modules/drawing-board/DrawingBoard.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { BoardCanvas } from './canvas/BoardCanvas'
import { getSelectionBounds, render, roundedRect, darken, hexToRgba } from './canvas/renderer'
import { useCollaboration } from '../collaboration/useCollaboration'
import CollaborationBar from '../collaboration/CollaborationBar'
import CommentsPanel from '../collaboration/CommentsPanel'
import CursorOverlay from '../collaboration/CursorOverlay'
import { useOpenRouter } from '../../context/OpenRouterContext'
import { useAIProvider } from '../../hooks/useAIProvider'
import { useProbeContext } from '../../hooks/useProbeContext'
import { logEvent } from '../../engine/eventLog'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useEnginguityStore } from '../../engine/persistenceEngine'
import { blobStore } from '../../engine/blobStore'
import {
  MousePointer2, Hand, Pencil, Minus, ArrowUpRight, Highlighter,
  Square, Circle, Triangle, Layers, Type, StickyNote, ClipboardList,
  Image as ImageIcon, Undo2, Redo2, ChevronDown, ChevronRight, ChevronLeft,
  Lock, Unlock, Copy, Plus, Grid, Magnet,
  Sparkles, ArrowLeft
} from 'lucide-react'

// Color Presets
const PRESET_COLORS = [
  '#e2e2e2', '#94a3b8', '#6b7280', '#b08080',
  '#b09470', '#b09a60', '#7aaa8a', '#7a9ab8',
  '#9485b8', '#b07888', '#ffffff', '#5a5a5a'
]

const STICKY_COLORS = [
  { name: 'yellow', bg: '#fef9c3', text: '#854d0e' },
  { name: 'green', bg: '#dcfce7', text: '#166534' },
  { name: 'blue', bg: '#dbeafe', text: '#1e40af' },
  { name: 'pink', bg: '#fce7f3', text: '#9d174d' },
  { name: 'red', bg: '#ffe4e6', text: '#9f1239' },
  { name: 'purple', bg: '#f3e8ff', text: '#6b21a8' },
  { name: 'orange', bg: '#ffedd5', text: '#9a3412' }
]

// Boards whose element array serializes past this go to blobStore
// (IndexedDB) instead of the persisted store snapshot in localStorage.
const BOARD_BLOB_THRESHOLD = 50_000
const boardBlobId = (boardId) => `drawing-board-${boardId}`

// One-time migration from the legacy raw-localStorage keys into the global
// zustand store. Legacy keys are removed once copied.
function migrateLegacyBoards() {
  try {
    const legacyList = localStorage.getItem('enginguity_drawingboard_list')
    if (!legacyList) return
    const list = JSON.parse(legacyList) || []
    const { drawingBoards, saveDrawingBoard } = useEnginguityStore.getState()
    list.forEach((b, idx) => {
      const legacyKey = `enginguity_drawingboard_${b.id}`
      if (!(drawingBoards || {})[b.id]) {
        let data = {}
        try { data = JSON.parse(localStorage.getItem(legacyKey) || '{}') } catch { /* ignore */ }
        saveDrawingBoard(b.id, {
          name: b.name || data.name || 'Sketchboard',
          elements: data.elements || [],
          transform: data.transform || { x: 0, y: 0, scale: 1 },
          elementCount: (data.elements || []).length,
          createdAt: Date.now() + idx, // preserves the legacy list order
        })
      }
      localStorage.removeItem(legacyKey)
    })
    localStorage.removeItem('enginguity_drawingboard_list')
  } catch (err) {
    console.error('Drawing board legacy migration failed:', err)
  }
}

function loadBoardList() {
  migrateLegacyBoards()
  const boards = useEnginguityStore.getState().drawingBoards || {}
  const list = Object.entries(boards)
    .map(([id, b]) => ({
      id,
      name: b.name || 'Sketchboard',
      elementCount: b.elementCount ?? (b.elements?.length || 0),
      updatedAt: b.updatedAt || Date.now(),
      createdAt: b.createdAt || 0,
    }))
    .sort((a, b) => a.createdAt - b.createdAt)
  return list.length > 0
    ? list
    : [{ id: 'default', name: 'Main Sketchboard', elementCount: 0, updatedAt: Date.now() }]
}

export function DrawingBoard() {
  const navigate = useNavigate()
  const { isConnected: aiConnected, activeModelId } = useOpenRouter()
  const { makeRequest } = useAIProvider()
  const { layoutMode } = useWorkspace()
  const isWorkspace = layoutMode === 'workspace'

  // Board persistence state — boards live in the global zustand store.
  const saveDrawingBoard = useEnginguityStore((s) => s.saveDrawingBoard)
  const [boardList, setBoardList] = useState(loadBoardList)
  
  const [activeBoardId, setActiveBoardId] = useState(() => {
    return boardList[0]?.id || 'default'
  })

  // Canvas elements state
  const [elements, setElements] = useState([])
  const [selection, setSelection] = useState([])

  // Tools configurations
  const [activeTool, setActiveTool] = useState('select') // select, hand, pen, line, arrow, highlighter, rect, circle, triangle, diamond, cylinder, star, hexagon, parallelogram, text, sticky, checklist, frame, eraser
  const [activeColor, setActiveColor] = useState('#e2e2e2')
  const [activeWidth, setActiveWidth] = useState(2)
  const [activeFillColor, setActiveFillColor] = useState('transparent')
  const [activeFillOpacity, setActiveFillOpacity] = useState(0.4)
  const [activeOpacity, setActiveOpacity] = useState(1)
  const [activeTextStyle, setActiveTextStyle] = useState({ fontFamily: 'Geist, sans-serif', fontSize: 16, fontWeight: 'normal', fontStyle: 'normal', align: 'left' })
  const [activeDashStyle, setActiveDashStyle] = useState('solid')

  // UI States
  const [gridVisible, setGridVisible] = useState(true)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])
  const [transformState, setTransformState] = useState({ x: 0, y: 0, scale: 1 })
  const [boardDropdownOpen, setBoardDropdownOpen] = useState(false)
  const [editingBoardNameId, setEditingBoardNameId] = useState(null)
  const [boardRenameVal, setBoardRenameVal] = useState('')
  const [moreShapesOpen, setMoreShapesOpen] = useState(false)
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)
  
  // Floating properties UI Panels
  const [opacityPanelOpen, setOpacityPanelOpen] = useState(false)
  const [widthPanelOpen, setWidthPanelOpen] = useState(false)
  const [dashPanelOpen, setDashPanelOpen] = useState(false)
  
  // Context Menu
  const [contextMenu, setContextMenu] = useState(null) // { x, y, type: 'canvas' | 'element', elementId: null }
  
  // Clipboard copied buffer
  const [copiedElements, setCopiedElements] = useState(null)

  useProbeContext('drawing-board', {
    boardName: boardList.find((b) => b.id === activeBoardId)?.name ?? null,
    boardCount: boardList.length,
    elementCount: elements.length,
    selectedCount: selection.length,
    activeTool,
  })

  // AI Dialog state
  const [aiDialog, setAiDialog] = useState(null) // { type: 'jarvis' | 'vision' | 'mood', input: '', loading: false }

  // Collaboration connection
  const params = new URLSearchParams(window.location.search)
  const roomId = params.get('room')
  const collabName = params.get('collab_name') || 'Teammate'
  const collab = useCollaboration(roomId, collabName)

  // Room comments arrive via the sync listener below: the full list on join
  // (state_sync) and individual add/resolve/reply events after that.
  const [comments, setComments] = useState([])
  const [commentsOpen, setCommentsOpen] = useState(false)

  // Load board elements from the store (large boards resolve via blobStore)
  useEffect(() => {
    let cancelled = false
    const board = useEnginguityStore.getState().drawingBoards?.[activeBoardId]
    if (board?.elementsBlobId) {
      blobStore.get(board.elementsBlobId)
        .then((blob) => { if (!cancelled) setElements(blob?.elements || []) })
        .catch((err) => {
          console.error('Failed to load board elements from blobStore:', err)
          if (!cancelled) setElements([])
        })
    } else {
      setElements(board?.elements || [])
    }
    setSelection([])
    setUndoStack([])
    setRedoStack([])
    return () => { cancelled = true }
  }, [activeBoardId])

  // Save board elements to the store (debounced 500ms). Oversized element
  // arrays are offloaded to blobStore with only a reference persisted.
  const saveTimeout = useRef(null)
  useEffect(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)

    saveTimeout.current = setTimeout(() => {
      try {
        const existing = useEnginguityStore.getState().drawingBoards?.[activeBoardId]
        const base = {
          name: boardList.find(b => b.id === activeBoardId)?.name || 'Main Sketchboard',
          transform: transformState,
          elementCount: elements.length,
          createdAt: existing?.createdAt ?? Date.now(),
        }
        if (JSON.stringify(elements).length > BOARD_BLOB_THRESHOLD) {
          const blobId = boardBlobId(activeBoardId)
          blobStore.save(blobId, { category: 'drawing-board', elements })
            .then(() => saveDrawingBoard(activeBoardId, { ...base, elements: null, elementsBlobId: blobId }))
            .catch((err) => console.error('Failed to save board elements to blobStore:', err))
        } else {
          saveDrawingBoard(activeBoardId, { ...base, elements, elementsBlobId: null })
          if (existing?.elementsBlobId) blobStore.delete(existing.elementsBlobId).catch(() => {})
        }

        // Update list counts
        setBoardList(prev => prev.map(b =>
          b.id === activeBoardId ? { ...b, elementCount: elements.length, updatedAt: Date.now() } : b
        ))
      } catch (err) {
        console.error('Failed to save board elements:', err)
      }
    }, 500)

    return () => clearTimeout(saveTimeout.current)
  }, [elements, activeBoardId, transformState, boardList, saveDrawingBoard])

  // Collab Sync Listener
  useEffect(() => {
    if (collab.connected) {
      const unsub = collab.onStateUpdate((delta, isFullSync) => {
        // Comment events relayed by the server (broadcast to everyone,
        // including the author — the server owns ids and timestamps).
        if (delta?._commentEvent) {
          const { type, payload } = delta._commentEvent
          if (type === 'comment_add' && payload?.comment) {
            setComments((prev) => [...prev, payload.comment])
          } else if (type === 'comment_resolve' && payload?.commentId) {
            setComments((prev) =>
              prev.map((c) => (c.id === payload.commentId ? { ...c, resolved: true } : c))
            )
          } else if (type === 'comment_reply' && payload?.commentId) {
            const { commentId, ...reply } = payload
            setComments((prev) =>
              prev.map((c) =>
                c.id === commentId ? { ...c, replies: [...(c.replies || []), reply] } : c
              )
            )
          }
          return
        }
        if (isFullSync && Array.isArray(delta?.comments)) {
          setComments(delta.comments)
        }
        if (delta?.elements) {
          setElements(prev => {
            const next = [...prev]
            Object.entries(delta.elements).forEach(([id, data]) => {
              const idx = next.findIndex(item => item.id === id)
              if (data === null) {
                // Delete
                if (idx !== -1) next.splice(idx, 1)
              } else {
                // Update / Insert
                if (idx !== -1) next[idx] = data
                else next.push(data)
              }
            })
            return next
          })
        }
      })
      return unsub
    }
  }, [collab.connected])

  // Undo / Redo Actions
  const handleUndo = () => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setUndoStack(u => u.slice(0, -1))
    setRedoStack(r => [...r, elements])
    setElements(prev)
    setSelection([])
    if (collab.connected) {
      collab.sendStateUpdate({ elements: prev.reduce((acc, el) => ({ ...acc, [el.id]: el }), {}) })
    }
  }

  const handleRedo = () => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setRedoStack(r => r.slice(0, -1))
    setUndoStack(u => [...u, elements])
    setElements(next)
    setSelection([])
    if (collab.connected) {
      collab.sendStateUpdate({ elements: next.reduce((acc, el) => ({ ...acc, [el.id]: el }), {}) })
    }
  }

  // Keyboard listeners for delete, duplicate, undo, redo, copy, paste
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing inside text fields
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return

      const isCmd = e.metaKey || e.ctrlKey
      const isShift = e.shiftKey

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (selection.length > 0) {
          setUndoStack(prev => [...prev, elements])
          const toDelete = [...selection]
          setElements(prev => prev.filter(item => !toDelete.includes(item.id)))
          setSelection([])
          if (collab.connected) {
            collab.sendStateUpdate({ elements: toDelete.reduce((acc, id) => ({ ...acc, [id]: null }), {}) })
          }
        }
      }

      // Escape key to deselect
      if (e.key === 'Escape') {
        setSelection([])
      }

      // Undo / Redo
      if (isCmd && e.key === 'z') {
        e.preventDefault()
        if (isShift) handleRedo()
        else handleUndo()
      }

      // Copy
      if (isCmd && e.key === 'c') {
        e.preventDefault()
        if (selection.length > 0) {
          const copied = elements.filter(el => selection.includes(el.id))
          setCopiedElements(copied)
        }
      }

      // Paste
      if (isCmd && e.key === 'v') {
        e.preventDefault()
        if (copiedElements && copiedElements.length > 0) {
          setUndoStack(prev => [...prev, elements])
          const duplicates = copiedElements.map(el => {
            const newId = `${el.type}_${Math.random().toString(36).slice(2, 9)}`
            return {
              ...el,
              id: newId,
              x: el.x !== undefined ? el.x + 24 : el.x,
              y: el.y !== undefined ? el.y + 24 : el.y,
              startX: el.startX !== undefined ? el.startX + 24 : el.startX,
              startY: el.startY !== undefined ? el.startY + 24 : el.startY,
              endX: el.endX !== undefined ? el.endX + 24 : el.endX,
              endY: el.endY !== undefined ? el.endY + 24 : el.endY,
              points: el.points ? el.points.map(p => ({ ...p, x: p.x + 24, y: p.y + 24 })) : undefined,
              zIndex: elements.length + 1
            }
          })
          setElements(prev => [...prev, ...duplicates])
          setSelection(duplicates.map(d => d.id))
          if (collab.connected) {
            collab.sendStateUpdate({ elements: duplicates.reduce((acc, item) => ({ ...acc, [item.id]: item }), {}) })
          }
        }
      }

      // Duplicate Cmd+D
      if (isCmd && e.key === 'd') {
        e.preventDefault()
        if (selection.length > 0) {
          setUndoStack(prev => [...prev, elements])
          const duplicates = elements
            .filter(el => selection.includes(el.id))
            .map(el => {
              const newId = `${el.type}_${Math.random().toString(36).slice(2, 9)}`
              return {
                ...el,
                id: newId,
                x: el.x !== undefined ? el.x + 24 : el.x,
                y: el.y !== undefined ? el.y + 24 : el.y,
                startX: el.startX !== undefined ? el.startX + 24 : el.startX,
                startY: el.startY !== undefined ? el.startY + 24 : el.startY,
                endX: el.endX !== undefined ? el.endX + 24 : el.endX,
                endY: el.endY !== undefined ? el.endY + 24 : el.endY,
                points: el.points ? el.points.map(p => ({ ...p, x: p.x + 24, y: p.y + 24 })) : undefined,
                zIndex: elements.length + 1
              }
            })
          setElements(prev => [...prev, ...duplicates])
          setSelection(duplicates.map(d => d.id))
          if (collab.connected) {
            collab.sendStateUpdate({ elements: duplicates.reduce((acc, item) => ({ ...acc, [item.id]: item }), {}) })
          }
        }
      }

      // Grouping keys V, H, P, L, A, R, O, T, S, C, I, F, E
      const singleKeys = {
        'v': 'select', 'h': 'hand', 'p': 'pen', 'l': 'line', 'a': 'arrow',
        'r': 'rect', 'o': 'circle', 't': 'text', 's': 'sticky', 'c': 'checklist', 'f': 'frame', 'e': 'eraser'
      }
      if (singleKeys[e.key.toLowerCase()]) {
        setActiveTool(singleKeys[e.key.toLowerCase()])
      }

      // Brush resizing shortcuts [ and ]
      if (e.key === '[') {
        setActiveWidth(w => Math.max(1, w - 1))
      }
      if (e.key === ']') {
        setActiveWidth(w => Math.min(32, w + 1))
      }

      // Grid toggle 'g'
      if (e.key.toLowerCase() === 'g') {
        setGridVisible(v => !v)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [elements, selection, copiedElements, collab.connected])

  // Context Menu operations
  const handleContextMenu = (e) => {
    e.preventDefault()
    // Find if clicked on an element
    const rect = e.currentTarget.getBoundingClientRect()
    const clientX = e.clientX - rect.left
    const clientY = e.clientY - rect.top

    // Calculate world pos of click
    const wx = (clientX - transformState.x) / transformState.scale
    const wy = (clientY - transformState.y) / transformState.scale

    const hit = elements.find(el => {
      if (el.type === 'stroke') {
        return el.points.some(p => Math.sqrt((p.x - wx) ** 2 + (p.y - wy) ** 2) <= 12)
      } else if (el.type === 'arrow') {
        const dStart = Math.sqrt((el.startX - wx) ** 2 + (el.startY - wy) ** 2)
        const dEnd = Math.sqrt((el.endX - wx) ** 2 + (el.endY - wy) ** 2)
        return dStart <= 12 || dEnd <= 12
      } else {
        return isPointInRotatedBox(wx, wy, el)
      }
    })

    if (hit) {
      if (!selection.includes(hit.id)) {
        setSelection([hit.id])
      }
      setContextMenu({
        x: clientX,
        y: clientY,
        type: 'element',
        elementId: hit.id
      })
    } else {
      setContextMenu({
        x: clientX,
        y: clientY,
        type: 'canvas',
        elementId: null
      })
    }
  }

  // Clear context menu on click
  useEffect(() => {
    const closeMenu = () => setContextMenu(null)
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [])

  // Order sorting actions: Front, Back, Forward, Backward
  const changeZIndex = (action) => {
    if (selection.length === 0) return
    setUndoStack(prev => [...prev, elements])

    setElements(prev => {
      const sorted = [...prev].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
      
      selection.forEach(id => {
        const idx = sorted.findIndex(el => el.id === id)
        if (idx === -1) return

        if (action === 'front') {
          const [moved] = sorted.splice(idx, 1)
          moved.zIndex = sorted.length > 0 ? (sorted[sorted.length - 1].zIndex || 0) + 1 : 1
          sorted.push(moved)
        } else if (action === 'back') {
          const [moved] = sorted.splice(idx, 1)
          moved.zIndex = sorted.length > 0 ? (sorted[0].zIndex || 0) - 1 : -1
          sorted.unshift(moved)
        } else if (action === 'forward') {
          if (idx < sorted.length - 1) {
            const temp = sorted[idx].zIndex
            sorted[idx].zIndex = sorted[idx + 1].zIndex
            sorted[idx + 1].zIndex = temp
          }
        } else if (action === 'backward') {
          if (idx > 0) {
            const temp = sorted[idx].zIndex
            sorted[idx].zIndex = sorted[idx - 1].zIndex
            sorted[idx - 1].zIndex = temp
          }
        }
      })

      // Normalize zIndexes to standard integers
      return sorted.map((el, i) => ({ ...el, zIndex: i + 1 }))
    })
  }

  // Lock / Unlock Selected elements
  const toggleLockSelected = () => {
    if (selection.length === 0) return
    setElements(prev => prev.map(el => {
      if (!selection.includes(el.id)) return el
      return { ...el, locked: !el.locked }
    }))
  }

  // Element deletions
  const deleteSelected = () => {
    if (selection.length === 0) return
    setUndoStack(prev => [...prev, elements])
    const toDelete = [...selection]
    setElements(prev => prev.filter(el => !toDelete.includes(el.id)))
    setSelection([])
    if (collab.connected) {
      collab.sendStateUpdate({ elements: toDelete.reduce((acc, id) => ({ ...acc, [id]: null }), {}) })
    }
  }

  // Clear all board drawings
  const clearBoard = () => {
    if (confirm('Clear the entire sketchboard? This cannot be undone.')) {
      setUndoStack(prev => [...prev, elements])
      setElements([])
      setSelection([])
      if (collab.connected) {
        collab.sendStateUpdate({ elements: elements.reduce((acc, el) => ({ ...acc, [el.id]: null }), {}) })
      }
    }
  }

  // Multiple Boards Switcher Logic
  const createNewBoard = () => {
    const name = prompt('Enter name for the new board:', `Sketchboard ${boardList.length + 1}`)
    if (!name) return

    const newId = `board_${Math.random().toString(36).slice(2, 9)}`
    const newBoard = { id: newId, name, elementCount: 0, updatedAt: Date.now() }

    setBoardList([...boardList, newBoard])
    saveDrawingBoard(newId, {
      name,
      elements: [],
      transform: { x: 0, y: 0, scale: 1 },
      elementCount: 0,
      createdAt: Date.now(),
    })
    setActiveBoardId(newId)
    logEvent('BOARD_CREATED', { name, module: 'drawing-board' })
  }

  const renameBoard = (id, newName) => {
    if (!newName.trim()) return
    setBoardList(boardList.map(b => b.id === id ? { ...b, name: newName } : b))
    const existing = useEnginguityStore.getState().drawingBoards?.[id]
    if (existing) saveDrawingBoard(id, { ...existing, name: newName })
    setEditingBoardNameId(null)
  }

  // Export functions: PNG
  const exportAsPNG = (scale = 1, transparent = false) => {
    if (elements.length === 0) {
      alert('Drawing board is empty.')
      return
    }

    const bounds = getSelectionBounds(elements.map(e => e.id), elements)
    if (!bounds) return

    // Offscreen Canvas creation
    const offCanvas = document.createElement('canvas')
    const padding = 24
    offCanvas.width = bounds.width * scale + padding * 2
    offCanvas.height = bounds.height * scale + padding * 2

    const ctx = offCanvas.getContext('2d')

    if (!transparent) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, offCanvas.width, offCanvas.height)
    }

    // Apply offscreen transform: center on bounding box at specified scale
    ctx.save()
    ctx.setTransform(
      scale, 0, 0,
      scale,
      -bounds.x * scale + padding,
      -bounds.y * scale + padding
    )

    // Render sorted elements
    const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    sorted.forEach(el => {
      // In renderer we draw elements. We can duplicate the draw logic or call drawing subroutines
      // We will render elements locally by importing renderer methods
      ctx.save()
      
      if (el.type === 'stroke') {
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = el.color
        ctx.globalAlpha = el.style === 'highlighter' ? 0.3 * (el.opacity || 1) : (el.opacity || 1)
        ctx.lineWidth = el.width
        ctx.beginPath()
        
        if (el.smoothing && el.points.length > 2) {
          // Spline drawing
          ctx.moveTo(el.points[0].x, el.points[0].y)
          for (let i = 0; i < el.points.length - 1; i++) {
            const p0 = el.points[i === 0 ? 0 : i - 1]
            const p1 = el.points[i]
            const p2 = el.points[i + 1]
            const p3 = el.points[i + 2 >= el.points.length ? el.points.length - 1 : i + 2]
            for (let t = 0.1; t <= 1; t += 0.1) {
              const f0 = -0.5*t*t*t + t*t - 0.5*t
              const f1 = 1.5*t*t*t - 2.5*t*t + 1.0
              const f2 = -1.5*t*t*t + 2.0*t*t + 0.5*t
              const f3 = 0.5*t*t*t - 0.5*t*t
              ctx.lineTo(
                p0.x * f0 + p1.x * f1 + p2.x * f2 + p3.x * f3,
                p0.y * f0 + p1.y * f1 + p2.y * f2 + p3.y * f3
              )
            }
          }
        } else {
          ctx.moveTo(el.points[0].x, el.points[0].y)
          el.points.forEach(p => ctx.lineTo(p.x, p.y))
        }
        ctx.stroke()
      } else if (el.type === 'shape') {
        if (el.rotation) {
          ctx.save()
          const cx = el.x + el.width / 2
          const cy = el.y + el.height / 2
          ctx.translate(cx, cy)
          ctx.rotate((el.rotation * Math.PI) / 180)
          ctx.translate(-cx, -cy)
        }
        
        ctx.fillStyle = hexToRgba(el.fillColor, el.fillOpacity)
        ctx.strokeStyle = el.strokeColor
        ctx.lineWidth = el.strokeWidth
        
        // Custom draw shapes paths
        ctx.beginPath()
        if (el.shape === 'rect') {
          if (el.cornerRadius > 0) roundedRect(ctx, el.x, el.y, el.width, el.height, el.cornerRadius)
          else ctx.rect(el.x, el.y, el.width, el.height)
        } else if (el.shape === 'circle') {
          ctx.ellipse(el.x + el.width/2, el.y + el.height/2, Math.abs(el.width/2), Math.abs(el.height/2), 0, 0, Math.PI*2)
        } else if (el.shape === 'triangle') {
          ctx.moveTo(el.x + el.width/2, el.y)
          ctx.lineTo(el.x + el.width, el.y + el.height)
          ctx.lineTo(el.x, el.y + el.height)
        } else if (el.shape === 'diamond') {
          ctx.moveTo(el.x + el.width/2, el.y)
          ctx.lineTo(el.x + el.width, el.y + el.height/2)
          ctx.lineTo(el.x + el.width/2, el.y + el.height)
          ctx.lineTo(el.x, el.y + el.height/2)
        }
        ctx.closePath()
        if (el.fillColor !== 'transparent') ctx.fill()
        if (el.strokeWidth > 0) ctx.stroke()
        
        if (el.rotation) ctx.restore()
      } else if (el.type === 'text') {
        ctx.fillStyle = el.color || '#111111'
        ctx.font = `${el.fontStyle || 'normal'} ${el.fontWeight || 'normal'} ${el.fontSize}px Geist, sans-serif`
        ctx.fillText(el.content, el.x, el.y + el.fontSize)
      } else if (el.type === 'sticky') {
        ctx.fillStyle = el.color
        roundedRect(ctx, el.x, el.y, el.width, el.height, 6)
        ctx.fill()
        
        ctx.fillStyle = el.textColor
        ctx.font = '14px Geist, sans-serif'
        ctx.fillText(el.content, el.x + 12, el.y + 26)
      } else if (el.type === 'arrow') {
        ctx.strokeStyle = el.color
        ctx.lineWidth = el.width
        ctx.beginPath()
        ctx.moveTo(el.startX, el.startY)
        ctx.lineTo(el.endX, el.endY)
        ctx.stroke()
      }
      ctx.restore()
    })

    ctx.restore()

    offCanvas.toBlob(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `whiteboard_${activeBoardId}.png`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  // Export functions: SVG
  const exportAsSVG = () => {
    if (elements.length === 0) {
      alert('Drawing board is empty.')
      return
    }

    const bounds = getSelectionBounds(elements.map(e => e.id), elements)
    if (!bounds) return

    const padding = 20
    const svgWidth = bounds.width + padding * 2
    const svgHeight = bounds.height + padding * 2
    
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}" style="background:#ffffff">\n`
    svgContent += `  <g transform="translate(${-bounds.x + padding}, ${-bounds.y + padding})">\n`

    elements.forEach(el => {
      if (el.type === 'stroke') {
        let pathD = ''
        if (el.points.length > 0) {
          pathD += `M ${el.points[0].x} ${el.points[0].y} `
          for (let i = 1; i < el.points.length; i++) {
            pathD += `L ${el.points[i].x} ${el.points[i].y} `
          }
        }
        const opacity = el.style === 'highlighter' ? 0.3 * (el.opacity || 1) : (el.opacity || 1)
        svgContent += `    <path d="${pathD}" fill="none" stroke="${el.color}" stroke-width="${el.width}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" />\n`
      } else if (el.type === 'shape') {
        const transformAttr = el.rotation ? ` transform="rotate(${el.rotation} ${el.x + el.width/2} ${el.y + el.height/2})"` : ''
        if (el.shape === 'rect') {
          svgContent += `    <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${el.cornerRadius || 0}" fill="${el.fillColor}" fill-opacity="${el.fillOpacity || 1}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}"${transformAttr} />\n`
        } else if (el.shape === 'circle') {
          svgContent += `    <ellipse cx="${el.x + el.width/2}" cy="${el.y + el.height/2}" rx="${Math.abs(el.width/2)}" ry="${Math.abs(el.height/2)}" fill="${el.fillColor}" fill-opacity="${el.fillOpacity || 1}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}"${transformAttr} />\n`
        }
      } else if (el.type === 'text') {
        svgContent += `    <text x="${el.x}" y="${el.y + el.fontSize}" font-family="Geist, sans-serif" font-size="${el.fontSize}" fill="${el.color}">${el.content}</text>\n`
      } else if (el.type === 'sticky') {
        svgContent += `    <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="6" fill="${el.color}" />\n`
        svgContent += `    <text x="${el.x + 12}" y="${el.y + 26}" font-family="Geist, sans-serif" font-size="14" fill="${el.textColor}">${el.content}</text>\n`
      } else if (el.type === 'arrow') {
        svgContent += `    <line x1="${el.startX}" y1="${el.startY}" x2="${el.endX}" y2="${el.endY}" stroke="${el.color}" stroke-width="${el.width}" stroke-linecap="round" />\n`
      }
    })

    svgContent += `  </g>\n</svg>`

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `whiteboard_${activeBoardId}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Export functions: PDF (via Dynamic CDN jsPDF load)
  const exportAsPDF = async () => {
    if (elements.length === 0) {
      alert('Drawing board is empty.')
      return
    }

    const bounds = getSelectionBounds(elements.map(e => e.id), elements)
    if (!bounds) return

    // Dynamic jspdf load helper
    const loadJsPDF = () => {
      return new Promise((resolve, reject) => {
        if (window.jspdf) {
          resolve(window.jspdf)
          return
        }
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
        script.onload = () => resolve(window.jspdf)
        script.onerror = (err) => reject(err)
        document.body.appendChild(script)
      })
    }

    try {
      const jspdfModule = await loadJsPDF()
      const { jsPDF } = jspdfModule
      const doc = new jsPDF()

      // Render offscreen PNG first
      const offCanvas = document.createElement('canvas')
      const padding = 20
      offCanvas.width = bounds.width * 2 + padding * 2
      offCanvas.height = bounds.height * 2 + padding * 2
      const ctx = offCanvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, offCanvas.width, offCanvas.height)

      render(ctx, elements, { x: -bounds.x * 2 + padding, y: -bounds.y * 2 + padding, scale: 2 }, [], offCanvas.width, offCanvas.height, false)
      
      const imgData = offCanvas.toDataURL('image/png')
      
      const pdfW = 210 // A4 dimensions
      const pdfH = 297
      const aspect = offCanvas.width / offCanvas.height
      let imgW = pdfW - 20
      let imgH = imgW / aspect
      if (imgH > pdfH - 20) {
        imgH = pdfH - 20
        imgW = imgH * aspect
      }

      doc.addImage(imgData, 'PNG', 10, 10, imgW, imgH)
      doc.save(`whiteboard_${activeBoardId}.pdf`)
    } catch (err) {
      console.error('PDF export failed:', err)
      alert('PDF generation failed. Check your internet connection to retrieve the jsPDF export package.')
    }
  }

  // Copy PNG to Clipboard
  const copyPNGToClipboard = () => {
    if (elements.length === 0) return
    const bounds = getSelectionBounds(elements.map(e => e.id), elements)
    if (!bounds) return

    const offCanvas = document.createElement('canvas')
    const padding = 16
    offCanvas.width = bounds.width + padding * 2
    offCanvas.height = bounds.height + padding * 2
    const ctx = offCanvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, offCanvas.width, offCanvas.height)

    render(ctx, elements, { x: -bounds.x + padding, y: -bounds.y + padding, scale: 1 }, [], offCanvas.width, offCanvas.height, false)

    offCanvas.toBlob(blob => {
      try {
        navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ])
        alert('Drawing board copied to clipboard!')
      } catch (err) {
        console.error('Copy to clipboard failed:', err)
      }
    })
  }

  // AI Prompts: Jarvis Diagram builder
  const handleAiDiagramRequest = async () => {
    if (!aiDialog.input.trim()) return
    setAiDialog(prev => ({ ...prev, loading: true }))

    const promptText = `I need to generate a visual canvas diagram configuration.
User request: "${aiDialog.input}"

Respond ONLY with a valid JSON array containing visual shapes and sticky elements to add to the canvas.
Each element MUST use this format:
{
  "type": "shape" | "sticky" | "text",
  "shape": "rect" | "circle" | "triangle" | "diamond",
  "x": number,
  "y": number,
  "width": number,
  "height": number,
  "fillColor": string (e.g. hex #ffffff or presets),
  "strokeColor": string,
  "strokeWidth": number,
  "fillOpacity": number,
  "label": string (for shapes) or "content" (for stickies/text)
}
Keep layout clean, spread items out in x, y coordinates so they do not overlap. Minimum 3 elements. Output JSON ONLY. No markdown wrappers.`

    try {
      const response = await makeRequest([{ role: 'user', content: promptText }], 'You are a canvas layout planner. Output JSON arrays only.', { module: 'drawing-board' })
      
      // Attempt to strip markdown code blocks if AI outputted them
      let cleaned = response.trim()
      if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7)
      if (cleaned.startsWith('```')) cleaned = cleaned.substring(3)
      if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3)
      cleaned = cleaned.trim()

      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed)) {
        setUndoStack(prev => [...prev, elements])
        const newEls = parsed.map((item, idx) => {
          const id = `${item.type}_${Math.random().toString(36).slice(2, 9)}`
          return {
            id,
            type: item.type,
            shape: item.shape || 'rect',
            x: item.x || 100 * idx,
            y: item.y || 100 * idx,
            width: item.width || 120,
            height: item.height || 80,
            rotation: 0,
            fillColor: item.fillColor || '#eab308',
            strokeColor: item.strokeColor || '#374151',
            strokeWidth: item.strokeWidth || 2,
            fillOpacity: item.fillOpacity || 0.4,
            label: item.type === 'shape' ? (item.label || '') : undefined,
            content: item.type !== 'shape' ? (item.label || item.content || 'Content') : undefined,
            textColor: '#111111',
            fontSize: 14,
            zIndex: elements.length + idx + 1
          }
        })
        setElements(prev => [...prev, ...newEls])
        if (collab.connected) {
          collab.sendStateUpdate({ elements: newEls.reduce((acc, x) => ({ ...acc, [x.id]: x }), {}) })
        }
      }
      setAiDialog(null)
    } catch (err) {
      alert('AI diagram compilation failed. Please verify API response format.')
      console.error(err)
    } finally {
      setAiDialog(prev => prev ? { ...prev, loading: false } : null)
    }
  }

  // Helper properties check
  const singleSelected = selection.length === 1 ? elements.find(el => el.id === selection[0]) : null

  return (
    <div
      style={{
        position: isWorkspace ? 'absolute' : 'fixed',
        inset: 0,
        backgroundColor: '#111111',
        zIndex: 1, // overlays standard page content
        fontFamily: 'Geist, sans-serif',
      }}
      onContextMenu={handleContextMenu}
    >
      {/* Collaboration bar — session controls, presence avatars, comments
          toggle. The board root's zIndex:1 stacking context sits UNDER the
          app's fixed header (height 44, z 50), so route-mounted boards dock
          the bar just below it; workspace windows own their chrome. */}
      <div
        style={{
          position: isWorkspace ? 'absolute' : 'fixed',
          top: isWorkspace ? 0 : 44,
          left: 0,
          right: 0,
          zIndex: 100,
        }}
      >
        <CollaborationBar
          connected={collab.connected}
          users={collab.users}
          roomId={collab.roomId}
          localUser={collab.localUser}
          comments={comments}
          onStartSession={() => collab.startSession(collabName)}
          onLeave={() => {
            collab.leaveRoom()
            setComments([])
            setCommentsOpen(false)
          }}
          onOpenComments={() => setCommentsOpen((o) => !o)}
          commentsOpen={commentsOpen}
        />
      </div>

      {/* Dynamic Board Canvas Element */}
      <BoardCanvas
        elements={elements}
        setElements={setElements}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        activeColor={activeColor}
        activeWidth={activeWidth}
        activeFillColor={activeFillColor}
        activeFillOpacity={activeFillOpacity}
        activeOpacity={activeOpacity}
        activeTextStyle={activeTextStyle}
        activeDashStyle={activeDashStyle}
        selection={selection}
        setSelection={setSelection}
        gridVisible={gridVisible}
        snapEnabled={snapEnabled}
        undoStack={undoStack}
        setUndoStack={setUndoStack}
        redoStack={redoStack}
        setRedoStack={setRedoStack}
        transformState={transformState}
        setTransformState={setTransformState}
        boardId={activeBoardId}
        collabSession={collab}
      />

      {/* Left-side vertical toolbar */}
      <div
        style={{
          position: isWorkspace ? 'absolute' : 'fixed',
          left: toolbarCollapsed ? '-52px' : '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          transition: 'left 0.18s ease',
          zIndex: 100,
          backgroundColor: '#111111',
          border: '1px solid #1e1e1e',
          borderRadius: '10px',
          padding: '6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        {/* TOP: Back to app + collapse toggle */}
        <button
          title="Back to Enginguity"
          onClick={() => navigate('/')}
          style={{
            width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', color: '#94a3b8', background: 'transparent',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <ArrowLeft size={15} />
        </button>

        <div style={{ height: '1px', width: '24px', background: '#2a2a2a', margin: '2px 0' }} />

        {/* GROUP 1: SELECTION & PAN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <button
            title="Select (V)"
            onClick={() => setActiveTool('select')}
            style={{
              width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', color: '#94a3b8',
              background: activeTool === 'select' ? '#1e1e1e' : 'transparent',
            }}
          >
            <MousePointer2 size={16} />
          </button>
          <button
            title="Hand/Pan (H)"
            onClick={() => setActiveTool('hand')}
            style={{
              width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', color: '#94a3b8',
              background: activeTool === 'hand' ? '#1e1e1e' : 'transparent',
            }}
          >
            <Hand size={16} />
          </button>
        </div>

        <div style={{ height: '1px', width: '24px', background: '#2a2a2a', margin: '2px 0' }} />

        {/* GROUP 2: DRAWING */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <button
            title="Pen (P)"
            onClick={() => { setActiveTool('pen'); setActiveWidth(2); }}
            style={{
              width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', color: '#94a3b8',
              background: activeTool === 'pen' ? '#1e1e1e' : 'transparent',
            }}
          >
            <Pencil size={15} />
          </button>
          <button
            title="Highlighter"
            onClick={() => { setActiveTool('highlighter'); setActiveWidth(10); }}
            style={{
              width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', color: '#94a3b8',
              background: activeTool === 'highlighter' ? '#1e1e1e' : 'transparent',
            }}
          >
            <Highlighter size={15} />
          </button>
          <button
            title="Line (L)"
            onClick={() => setActiveTool('line')}
            style={{
              width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', color: '#94a3b8',
              background: activeTool === 'line' ? '#1e1e1e' : 'transparent',
            }}
          >
            <Minus size={15} />
          </button>
          <button
            title="Arrow (A)"
            onClick={() => setActiveTool('arrow')}
            style={{
              width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', color: '#94a3b8',
              background: activeTool === 'arrow' ? '#1e1e1e' : 'transparent',
            }}
          >
            <ArrowUpRight size={16} />
          </button>
        </div>

        <div style={{ height: '1px', width: '24px', background: '#2a2a2a', margin: '2px 0' }} />

        {/* GROUP 3: SHAPES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', position: 'relative' }}>
          <button
            title="Rectangle (R)"
            onClick={() => setActiveTool('rect')}
            style={{
              width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', color: '#94a3b8',
              background: activeTool === 'rect' ? '#1e1e1e' : 'transparent',
            }}
          >
            <Square size={14} />
          </button>
          <button
            title="Circle (O)"
            onClick={() => setActiveTool('circle')}
            style={{
              width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', color: '#94a3b8',
              background: activeTool === 'circle' ? '#1e1e1e' : 'transparent',
            }}
          >
            <Circle size={14} />
          </button>
          <button
            title="Triangle"
            onClick={() => setActiveTool('triangle')}
            style={{
              width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', color: '#94a3b8',
              background: activeTool === 'triangle' ? '#1e1e1e' : 'transparent',
            }}
          >
            <Triangle size={14} />
          </button>

          <button
            title="More Shapes"
            onClick={() => setMoreShapesOpen(!moreShapesOpen)}
            style={{
              width: '32px', height: '20px', borderRadius: '6px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', color: '#94a3b8', background: 'transparent',
            }}
          >
            <ChevronRight size={12} />
          </button>

          {moreShapesOpen && (
            <div
              style={{
                position: 'absolute', top: '0', left: '40px', background: '#111111',
                border: '1px solid #1e1e1e', borderRadius: '8px', padding: '6px',
                display: 'flex', flexDirection: 'column', gap: '2px', zIndex: 101,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: '110px',
              }}
            >
              {['diamond', 'star', 'hexagon', 'parallelogram', 'cylinder'].map(sName => (
                <button
                  key={sName}
                  onClick={() => { setActiveTool(sName); setMoreShapesOpen(false); }}
                  style={{
                    padding: '6px 8px', border: 'none', background: 'transparent',
                    textAlign: 'left', fontSize: '11px', cursor: 'pointer',
                    borderRadius: '4px', color: '#94a3b8',
                    fontWeight: activeTool === sName ? 'bold' : 'normal',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {sName.charAt(0).toUpperCase() + sName.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ height: '1px', width: '24px', background: '#2a2a2a', margin: '2px 0' }} />

        {/* GROUP 4: CONTENT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <button
            title="Text Tool (T)"
            onClick={() => setActiveTool('text')}
            style={{
              width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', color: '#94a3b8',
              background: activeTool === 'text' ? '#1e1e1e' : 'transparent',
            }}
          >
            <Type size={15} />
          </button>
          <button
            title="Sticky Note (S)"
            onClick={() => setActiveTool('sticky')}
            style={{
              width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', color: '#94a3b8',
              background: activeTool === 'sticky' ? '#1e1e1e' : 'transparent',
            }}
          >
            <StickyNote size={15} />
          </button>
          <button
            title="Checklist Card (C)"
            onClick={() => setActiveTool('checklist')}
            style={{
              width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', color: '#94a3b8',
              background: activeTool === 'checklist' ? '#1e1e1e' : 'transparent',
            }}
          >
            <ClipboardList size={15} />
          </button>
          <button
            title="Upload Image (I)"
            onClick={() => document.getElementById('image-upload-toolbar').click()}
            style={{
              width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', color: '#94a3b8', background: 'transparent',
            }}
          >
            <ImageIcon size={15} />
          </button>
          <input
            id="image-upload-toolbar"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = (ev) => {
                const img = new Image()
                img.src = ev.target.result
                img.onload = () => {
                  const aspect = img.naturalWidth / img.naturalHeight
                  const w = Math.min(450, img.naturalWidth)
                  const h = w / aspect

                  const newImg = {
                    id: `image_${Math.random().toString(36).slice(2, 9)}`,
                    type: 'image',
                    src: ev.target.result,
                    x: 200,
                    y: 200,
                    width: w,
                    height: h,
                    originalWidth: img.naturalWidth,
                    originalHeight: img.naturalHeight,
                    rotation: 0,
                    borderRadius: 0,
                    opacity: 100,
                    filters: { grayscale: 0, brightness: 100, contrast: 100 },
                    zIndex: elements.length + 1
                  }
                  setElements(prev => [...prev, newImg])
                  setSelection([newImg.id])
                }
              }
              reader.readAsDataURL(file)
            }}
          />
          <button
            title="Frame / Section Bounding Box (F)"
            onClick={() => setActiveTool('frame')}
            style={{
              width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', color: '#94a3b8',
              background: activeTool === 'frame' ? '#1e1e1e' : 'transparent',
            }}
          >
            <Layers size={15} />
          </button>
        </div>

        <div style={{ height: '1px', width: '24px', background: '#2a2a2a', margin: '2px 0' }} />

        {/* GROUP 5: UTILITIES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <button
            title="Undo"
            disabled={undoStack.length === 0}
            onClick={handleUndo}
            style={{
              width: '32px', height: '32px', borderRadius: '6px', cursor: undoStack.length > 0 ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', color: undoStack.length > 0 ? '#94a3b8' : '#333', background: 'transparent',
            }}
          >
            <Undo2 size={15} />
          </button>
          <button
            title="Redo"
            disabled={redoStack.length === 0}
            onClick={handleRedo}
            style={{
              width: '32px', height: '32px', borderRadius: '6px', cursor: redoStack.length > 0 ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', color: redoStack.length > 0 ? '#94a3b8' : '#333', background: 'transparent',
            }}
          >
            <Redo2 size={15} />
          </button>
        </div>

        <div style={{ height: '1px', width: '24px', background: '#2a2a2a', margin: '2px 0' }} />

        {/* BOARD SWITCHER */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setBoardDropdownOpen(!boardDropdownOpen)}
            title={boardList.find(b => b.id === activeBoardId)?.name || 'Board'}
            style={{
              width: '32px', height: '32px', border: '1px solid #1e1e1e', borderRadius: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: 'bold', color: '#4b5563', cursor: 'pointer',
              background: '#111111',
            }}
          >
            <ChevronDown size={14} />
          </button>

          {boardDropdownOpen && (
            <div
              style={{
                position: 'absolute', top: '0', left: '40px', background: '#111111',
                border: '1px solid #1e1e1e', borderRadius: '8px', padding: '6px',
                display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 1000,
                boxShadow: '0 6px 16px rgba(0,0,0,0.12)', minWidth: '180px',
              }}
            >
              <div style={{ padding: '2px 6px 6px', fontSize: '10px', color: '#5a5a5a', borderBottom: '1px solid #1e1e1e' }}>
                {boardList.find(b => b.id === activeBoardId)?.name || 'Board'}
              </div>
              <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {boardList.map(b => (
                  <div
                    key={b.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 6px', borderRadius: '4px', background: b.id === activeBoardId ? '#1e1e1e' : 'transparent',
                    }}
                  >
                    {editingBoardNameId === b.id ? (
                      <input
                        autoFocus
                        style={{
                          fontSize: '11px', border: '1px solid #3b82f6', outline: 'none',
                          padding: '2px 4px', borderRadius: '3px', width: '110px',
                        }}
                        value={boardRenameVal}
                        onChange={(e) => setBoardRenameVal(e.target.value)}
                        onBlur={() => renameBoard(b.id, boardRenameVal)}
                        onKeyDown={(e) => { if (e.key === 'Enter') renameBoard(b.id, boardRenameVal) }}
                      />
                    ) : (
                      <button
                        onClick={() => { setActiveBoardId(b.id); setBoardDropdownOpen(false); }}
                        style={{
                          border: 'none', background: 'transparent', textAlign: 'left',
                          fontSize: '11px', cursor: 'pointer', color: '#94a3b8',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          flex: 1, fontWeight: b.id === activeBoardId ? 'bold' : 'normal',
                        }}
                      >
                        {b.name}
                      </button>
                    )}

                    <button
                      onClick={() => { setEditingBoardNameId(b.id); setBoardRenameVal(b.name); }}
                      style={{ border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: '9px' }}
                    >
                      Rename
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ height: '1px', background: '#2a2a2a', margin: '4px 0' }} />
              <button
                onClick={() => { createNewBoard(); setBoardDropdownOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 8px',
                  background: 'transparent', border: 'none', width: '100%',
                  textAlign: 'left', fontSize: '11px', color: '#2563eb',
                  fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#1a1e24'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Plus size={12} />
                <span>New Board</span>
              </button>
            </div>
          )}
        </div>

        {/* AI Integration dialog button */}
        {aiConnected && (
          <>
            <div style={{ height: '1px', width: '24px', background: '#2a2a2a', margin: '2px 0' }} />
            <button
              title="Ask Jarvis to add content"
              onClick={() => setAiDialog({ type: 'jarvis', input: '', loading: false })}
              style={{
                width: '32px', height: '32px', background: 'transparent', border: '1px solid #1e3a5f',
                borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Sparkles size={13} color="#1d4ed8" className="animate-pulse" />
            </button>
          </>
        )}

        <div style={{ height: '1px', width: '24px', background: '#2a2a2a', margin: '2px 0' }} />

        {/* COLLAPSE TOGGLE */}
        <button
          title={toolbarCollapsed ? 'Show toolbar' : 'Hide toolbar'}
          onClick={() => setToolbarCollapsed(!toolbarCollapsed)}
          style={{
            width: '32px', height: '24px', borderRadius: '6px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', color: '#5a5a5a', background: 'transparent',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <ChevronLeft size={12} />
        </button>
      </div>

      {/* Re-open tab when toolbar is collapsed */}
      {toolbarCollapsed && (
        <button
          title="Show toolbar"
          onClick={() => setToolbarCollapsed(false)}
          style={{
            position: isWorkspace ? 'absolute' : 'fixed',
            left: '4px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 100,
            width: '20px',
            height: '48px',
            backgroundColor: '#111111',
            border: '1px solid #1e1e1e',
            borderRadius: '0 6px 6px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#5a5a5a',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = '#1a1a1a' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#5a5a5a'; e.currentTarget.style.background = '#111111' }}
        >
          <ChevronRight size={11} />
        </button>
      )}

      {/* Floating Properties Panels (top center, clearing the app header and collaboration bar) */}
      {selection.length > 0 && singleSelected && (
        <div
          style={{
            position: isWorkspace ? 'absolute' : 'fixed',
            top: isWorkspace ? '54px' : '98px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99,
            backgroundColor: '#111111',
            border: '1px solid #1e1e1e',
            borderRadius: '8px',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
          }}
        >
          {/* Colors picker */}
          <div style={{ display: 'flex', gap: '3px' }}>
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => {
                  setUndoStack(prev => [...prev, elements])
                  setElements(prev => prev.map(el => {
                    if (!selection.includes(el.id)) return el
                    if (el.type === 'stroke' || el.type === 'arrow') return { ...el, color: c }
                    if (el.type === 'shape') return { ...el, strokeColor: c }
                    if (el.type === 'text') return { ...el, color: c }
                    if (el.type === 'sticky') return { ...el, textColor: c }
                    return el
                  }))
                }}
                style={{
                  width: '16px', height: '16px', borderRadius: '50%', border: c === '#ffffff' ? '1px solid #d1d5db' : 'none',
                  background: c, cursor: 'pointer', padding: 0,
                }}
              />
            ))}
          </div>

          {/* Stroke Width Slider / Options */}
          {(singleSelected.type === 'stroke' || singleSelected.type === 'shape' || singleSelected.type === 'arrow') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', color: '#5a5a5a' }}>Width</span>
              <input
                type="range"
                min="1" max="16"
                style={{ width: '80px', height: '3px' }}
                value={singleSelected.width || singleSelected.strokeWidth || 2}
                onChange={(e) => {
                  const val = parseInt(e.target.value)
                  setElements(prev => prev.map(el => {
                    if (!selection.includes(el.id)) return el
                    if (el.type === 'stroke' || el.type === 'arrow') return { ...el, width: val }
                    if (el.type === 'shape') return { ...el, strokeWidth: val }
                    return el
                  }))
                }}
              />
            </div>
          )}

          {/* Shape Specific: Fill Color */}
          {singleSelected.type === 'shape' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid #e5e7eb', paddingLeft: '12px' }}>
              <span style={{ fontSize: '10px', color: '#5a5a5a' }}>Fill</span>
              <div style={{ display: 'flex', gap: '3px' }}>
                <button
                  title="No fill"
                  onClick={() => {
                    setElements(prev => prev.map(el => {
                      if (!selection.includes(el.id)) return el
                      return { ...el, fillColor: 'transparent' }
                    }))
                  }}
                  style={{
                    width: '16px', height: '16px', borderRadius: '50%', border: '1px solid #ef4444',
                    background: 'transparent', cursor: 'pointer', position: 'relative',
                  }}
                >
                  <span style={{ position: 'absolute', top: '6px', left: '0', width: '100%', height: '1px', background: '#ef4444', transform: 'rotate(45deg)' }} />
                </button>
                {PRESET_COLORS.filter(c => c !== '#ffffff').map(c => (
                  <button
                    key={c}
                    onClick={() => {
                      setElements(prev => prev.map(el => {
                        if (!selection.includes(el.id)) return el
                        return { ...el, fillColor: c }
                      }))
                    }}
                    style={{
                      width: '16px', height: '16px', borderRadius: '50%', border: 'none',
                      background: c, cursor: 'pointer', padding: 0,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Sticky Presets */}
          {singleSelected.type === 'sticky' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid #e5e7eb', paddingLeft: '12px' }}>
              <span style={{ fontSize: '10px', color: '#5a5a5a' }}>Paper</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {STICKY_COLORS.map(st => (
                  <button
                    key={st.name}
                    title={st.name}
                    onClick={() => {
                      setElements(prev => prev.map(el => {
                        if (!selection.includes(el.id)) return el
                        return { ...el, color: st.bg, textColor: st.text }
                      }))
                    }}
                    style={{
                      width: '16px', height: '16px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.1)',
                      background: st.bg, cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Lock / Unlock Toggle Button */}
          <button
            title={singleSelected.locked ? 'Unlock Element' : 'Lock Element'}
            onClick={toggleLockSelected}
            style={{
              padding: '4px 8px', border: '1px solid #1e1e1e', borderRadius: '4px',
              background: '#111111', cursor: 'pointer', color: '#4b5563', fontSize: '10px',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            {singleSelected.locked ? <Lock size={11} color="#ef4444" /> : <Unlock size={11} />}
            <span>{singleSelected.locked ? 'Locked' : 'Lock'}</span>
          </button>
        </div>
      )}

      {/* Right-click Context Menus */}
      {contextMenu && (
        <div
          style={{
            position: 'absolute', top: `${contextMenu.y}px`, left: `${contextMenu.x}px`,
            backgroundColor: '#111111', border: '1px solid #1e1e1e', borderRadius: '8px',
            padding: '4px', minWidth: '160px', zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'element' ? (
            <>
              <button
                onClick={() => { changeZIndex('front'); setContextMenu(null); }}
                style={{ padding: '6px 12px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '12px', cursor: 'pointer', color: '#94a3b8' }}
                onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Bring to Front
              </button>
              <button
                onClick={() => { changeZIndex('back'); setContextMenu(null); }}
                style={{ padding: '6px 12px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '12px', cursor: 'pointer', color: '#94a3b8' }}
                onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Send to Back
              </button>
              <button
                onClick={() => { toggleLockSelected(); setContextMenu(null); }}
                style={{ padding: '6px 12px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '12px', cursor: 'pointer', color: '#94a3b8' }}
                onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Lock/Unlock
              </button>
              <div style={{ height: '1px', background: '#2a2a2a', margin: '4px 0' }} />
              <button
                onClick={() => { deleteSelected(); setContextMenu(null); }}
                style={{ padding: '6px 12px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '12px', cursor: 'pointer', color: '#ef4444' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(160,80,80,0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setUndoStack(prev => [...prev, elements])
                  const canvasW = window.innerWidth
                  const canvasH = window.innerHeight
                  // client coordinates to world coordinates
                  const wx = (canvasW/2 - transformState.x)/transformState.scale
                  const wy = (canvasH/2 - transformState.y)/transformState.scale
                  
                  const colors = ['#fef9c3', '#dcfce7', '#dbeafe', '#fce7f3']
                  const color = colors[elements.filter(x => x.type === 'sticky').length % colors.length]
                  
                  const newSticky = {
                    id: `sticky_${Math.random().toString(36).slice(2, 9)}`,
                    type: 'sticky',
                    content: 'Write something...',
                    x: wx - 90,
                    y: wy - 90,
                    width: 180,
                    height: 180,
                    rotation: 0,
                    color,
                    textColor: '#1f2937',
                    fontSize: 14,
                    foldCorner: true,
                    zIndex: elements.length + 1
                  }
                  setElements(prev => [...prev, newSticky])
                  setSelection([newSticky.id])
                  setContextMenu(null)
                }}
                style={{ padding: '6px 12px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '12px', cursor: 'pointer', color: '#94a3b8' }}
                onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Insert Sticky Note
              </button>
              <button
                onClick={() => {
                  setUndoStack(prev => [...prev, elements])
                  const canvasW = window.innerWidth
                  const canvasH = window.innerHeight
                  const wx = (canvasW/2 - transformState.x)/transformState.scale
                  const wy = (canvasH/2 - transformState.y)/transformState.scale
                  
                  const newText = {
                    id: `text_${Math.random().toString(36).slice(2, 9)}`,
                    type: 'text',
                    content: 'Double click to edit',
                    x: wx - 75,
                    y: wy - 15,
                    width: 150,
                    height: 30,
                    rotation: 0,
                    fontSize: 16,
                    color: '#e2e2e2',
                    align: 'left',
                    zIndex: elements.length + 1
                  }
                  setElements(prev => [...prev, newText])
                  setSelection([newText.id])
                  setContextMenu(null)
                }}
                style={{ padding: '6px 12px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '12px', cursor: 'pointer', color: '#94a3b8' }}
                onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Insert Text
              </button>
              <div style={{ height: '1px', background: '#2a2a2a', margin: '4px 0' }} />
              <button
                onClick={() => { setSelection(elements.map(el => el.id)); setContextMenu(null); }}
                style={{ padding: '6px 12px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '12px', cursor: 'pointer', color: '#94a3b8' }}
                onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Select All
              </button>
              <button
                onClick={() => { clearBoard(); setContextMenu(null); }}
                style={{ padding: '6px 12px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '12px', cursor: 'pointer', color: '#ef4444' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(160,80,80,0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Clear Board
              </button>
              <div style={{ height: '1px', background: '#2a2a2a', margin: '4px 0' }} />
              
              {/* EXPORT SUBMENU */}
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    display: 'block', padding: '6px 12px', fontSize: '12px', color: '#94a3b8',
                    cursor: 'default', fontWeight: 'bold'
                  }}
                >
                  Export Board
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '8px', gap: '2px' }}>
                  <button
                    onClick={() => { exportAsPNG(2, false); setContextMenu(null); }}
                    style={{ padding: '4px 12px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '11px', cursor: 'pointer', color: '#4b5563' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    PNG (Image)
                  </button>
                  <button
                    onClick={() => { exportAsSVG(); setContextMenu(null); }}
                    style={{ padding: '4px 12px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '11px', cursor: 'pointer', color: '#4b5563' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    SVG (Vector)
                  </button>
                  <button
                    onClick={() => { exportAsPDF(); setContextMenu(null); }}
                    style={{ padding: '4px 12px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '11px', cursor: 'pointer', color: '#4b5563' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    PDF Document
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* AI Dialog overlay box */}
      {aiDialog && (
        <div
          style={{
            position: isWorkspace ? 'absolute' : 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setAiDialog(null)}
        >
          <div
            style={{
              backgroundColor: '#111111', border: '1px solid #1e1e1e', borderRadius: '12px',
              padding: '20px', width: '400px', display: 'flex', flexDirection: 'column', gap: '14px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)', pointerEvents: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} color="#2563eb" />
              <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#e2e2e2' }}>
                Ask Jarvis to Plan Board
              </span>
            </div>
            
            <textarea
              style={{
                width: '100%', height: '80px', border: '1px solid #d1d5db', borderRadius: '6px',
                padding: '8px', fontSize: '12px', outline: 'none', resize: 'none',
              }}
              placeholder="e.g. Help me plan a product launch moodboard with frames and checklist tasks..."
              value={aiDialog.input}
              onChange={e => {
                const val = e.target.value
                setAiDialog(prev => ({ ...prev, input: val }))
              }}
            />
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setAiDialog(null)}
                style={{
                  padding: '6px 12px', background: '#1a1a1a', border: '1px solid #d1d5db',
                  borderRadius: '6px', fontSize: '11px', cursor: 'pointer', color: '#4b5563',
                }}
              >
                Cancel
              </button>
              <button
                disabled={aiDialog.loading || !aiDialog.input.trim()}
                onClick={handleAiDiagramRequest}
                style={{
                  padding: '6px 12px', background: '#2563eb', border: 'none',
                  borderRadius: '6px', fontSize: '11px', cursor: 'pointer', color: '#ffffff',
                  fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                {aiDialog.loading ? 'Generating...' : 'Place elements'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minimal Bottom Status Bar */}
      <div
        style={{
          position: isWorkspace ? 'absolute' : 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '28px',
          backgroundColor: '#111111',
          borderTop: '1px solid #1e1e1e',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          zIndex: 100,
        }}
      >
        {/* LEFT COUNTS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 500 }}>
            {elements.length} elements
          </span>
          {selection.length > 0 && (
            <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold' }}>
              {selection.length} selected
            </span>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* CENTER POSITION */}
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#9ca3af',
          }}
        >
          x: {transformState.x}  y: {transformState.y}
        </div>

        <div style={{ flex: 1 }} />

        {/* RIGHT TOGGLES & ZOOM */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Grid Toggle */}
          <button
            title="Toggle Grid"
            onClick={() => setGridVisible(!gridVisible)}
            style={{
              border: 'none', background: 'transparent', padding: '2px', cursor: 'pointer',
              color: gridVisible ? '#3b82f6' : '#9ca3af', display: 'flex', alignItems: 'center',
            }}
          >
            <Grid size={13} />
          </button>
          
          {/* Snap Toggle */}
          <button
            title="Snap to Grid"
            onClick={() => setSnapEnabled(!snapEnabled)}
            style={{
              border: 'none', background: 'transparent', padding: '2px', cursor: 'pointer',
              color: snapEnabled ? '#3b82f6' : '#9ca3af', display: 'flex', alignItems: 'center',
            }}
          >
            <Magnet size={13} />
          </button>

          {/* Zoom reset */}
          <button
            title="Reset Zoom (100% / Cmd+0)"
            onClick={() => zoomToFit()}
            style={{
              fontFamily: 'monospace', fontSize: '10px', fontWeight: 'bold', color: '#94a3b8',
              border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
            }}
          >
            {Math.round(transformState.scale * 100)}%
          </button>
        </div>
      </div>

      {/* Comments drawer (fixed right, self-positioning below the app header) */}
      {commentsOpen && (
        <CommentsPanel
          comments={comments}
          localUser={collab.localUser}
          topOffset={isWorkspace ? 0 : 44}
          onClose={() => setCommentsOpen(false)}
          onAddComment={collab.addComment}
          onResolve={collab.resolveComment}
          onReply={collab.replyComment}
        />
      )}

      {/* Live remote cursors */}
      {collab.connected && (
        <CursorOverlay
          users={collab.users}
          localUserId={collab.localUser.id}
          sendCursorMove={collab.sendCursorMove}
        />
      )}
    </div>
  )
}
