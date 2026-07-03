// src/modules/drawing-board/canvas/BoardCanvas.jsx
import { useEffect, useRef, useState } from 'react'
import { render, getSelectionBounds, hitTestElement, isPointInRotatedBox, hexToRgba } from './renderer'

const MOCK_AVATARS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'
]

export function BoardCanvas({
  elements,
  setElements,
  activeTool,
  setActiveTool,
  activeColor,
  activeWidth,
  activeFillColor,
  activeFillOpacity,
  activeOpacity,
  activeTextStyle,
  activeDashStyle,
  selection,
  setSelection,
  gridVisible,
  snapEnabled,
  undoStack,
  setUndoStack,
  redoStack,
  setRedoStack,
  transformState, // { x, y, scale } React state for status bar
  setTransformState,
  boardId,
  collabSession, // { connected, users, sendStateUpdate, sendCursorMove }
}) {
  const containerRef = useRef(null)
  const bgCanvasRef = useRef(null)
  const fgCanvasRef = useRef(null)

  // Zoom / Pan transform ref (for smooth animation)
  const transform = useRef({ x: 0, y: 0, scale: 1 })

  // Interaction State
  const isInteracting = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const dragType = useRef(null) // 'draw', 'pan', 'move', 'resize', 'rotate', 'marquee', 'arrow_draw', 'shape_draw', 'frame_draw'
  const dragHandle = useRef(null) // tl, tr, etc.
  const activeStroke = useRef(null) // { id, points: [] }
  const activeArrow = useRef(null)
  const activeShape = useRef(null)
  const activeFrame = useRef(null)
  
  // Selection box initial offsets
  const dragElementOffsets = useRef({}) // { [id]: { dx, dy } }
  const initialBounds = useRef(null)
  const initialElements = useRef([]) // clone of elements at drag start for undo/redo

  // Editor states
  const [editingText, setEditingText] = useState(null) // { id, type, x, y, content, ... }
  const [editingChecklist, setEditingChecklist] = useState(null) // { id, x, y, ... }

  // Sync transform Ref with parent React state (throttled/on change)
  const updateTransformState = () => {
    if (setTransformState) {
      setTransformState({
        x: Math.round(transform.current.x),
        y: Math.round(transform.current.y),
        scale: transform.current.scale
      })
    }
  }

  // Redraw Canvas
  const redraw = () => {
    const bgCanvas = bgCanvasRef.current
    if (!bgCanvas) return
    const ctx = bgCanvas.getContext('2d')
    render(ctx, elements, transform.current, selection, bgCanvas.width, bgCanvas.height, gridVisible)
  }

  // Effect to trigger redraw on elements or settings change
  useEffect(() => {
    redraw()
  }, [elements, selection, gridVisible])

  // Custom redraw event listener for async image loads
  useEffect(() => {
    const handleRedraw = () => redraw()
    window.addEventListener('enginguity_drawingboard_redraw', handleRedraw)
    return () => window.removeEventListener('enginguity_drawingboard_redraw', handleRedraw)
  }, [elements, selection, gridVisible])

  // Canvas Resize
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current
      const bgCanvas = bgCanvasRef.current
      const fgCanvas = fgCanvasRef.current
      if (!container || !bgCanvas || !fgCanvas) return

      const w = container.clientWidth
      const h = container.clientHeight

      bgCanvas.width = w
      bgCanvas.height = h
      fgCanvas.width = w
      fgCanvas.height = h

      redraw()
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [elements, selection, gridVisible])

  // Helper coordinate conversions
  const clientToWorld = (cx, cy) => {
    return {
      x: (cx - transform.current.x) / transform.current.scale,
      y: (cy - transform.current.y) / transform.current.scale
    }
  }

  const worldToClient = (wx, wy) => {
    return {
      x: wx * transform.current.scale + transform.current.x,
      y: wy * transform.current.scale + transform.current.y
    }
  }

  // Center canvas or zoom to fit elements
  const zoomToFit = () => {
    if (elements.length === 0) {
      // Just center (0,0)
      const w = bgCanvasRef.current?.width || window.innerWidth
      const h = bgCanvasRef.current?.height || window.innerHeight
      transform.current = { x: w / 2, y: h / 2, scale: 1 }
      redraw()
      updateTransformState()
      return
    }

    const bounds = getSelectionBounds(elements.map(e => e.id), elements)
    if (!bounds) return

    const canvasW = bgCanvasRef.current?.width || window.innerWidth
    const canvasH = bgCanvasRef.current?.height || window.innerHeight

    const padding = 60
    const scaleX = (canvasW - padding * 2) / bounds.width
    const scaleY = (canvasH - padding * 2) / bounds.height
    const scale = Math.max(0.05, Math.min(2, Math.min(scaleX, scaleY)))

    const x = canvasW / 2 - (bounds.x + bounds.width / 2) * scale
    const y = canvasH / 2 - (bounds.y + bounds.height / 2) * scale

    transform.current = { x, y, scale }
    redraw()
    updateTransformState()
  }

  // Trigger zoomToFit on Board Load
  useEffect(() => {
    // Read from localStorage on mount (handled in main file, but fit screen if needed)
    zoomToFit()
  }, [boardId])

  // Zoom at cursor math
  const zoomAtPoint = (delta, pointX, pointY) => {
    const zoomFactor = delta > 0 ? 1.08 : 0.92
    const newScale = transform.current.scale * zoomFactor
    
    // Clamp scale 5% to 2000%
    const clampedScale = Math.max(0.05, Math.min(20, newScale))
    const actualFactor = clampedScale / transform.current.scale
    
    transform.current.x = pointX - actualFactor * (pointX - transform.current.x)
    transform.current.y = pointY - actualFactor * (pointY - transform.current.y)
    transform.current.scale = clampedScale
    
    redraw()
    updateTransformState()
  }

  // Undo push utility
  const pushToUndo = (currentElementsState = elements) => {
    setUndoStack(prev => [...prev, currentElementsState])
    setRedoStack([])
  }

  // Snapping logic
  const getSnapPoint = (wx, wy) => {
    if (!snapEnabled) return { x: wx, y: wy }
    return {
      x: Math.round(wx / 24) * 24,
      y: Math.round(wy / 24) * 24
    }
  }

  const getElementCenter = (el) => {
    if (el.type === 'stroke') {
      const bounds = getSelectionBounds([el.id], [el])
      if (!bounds) return { x: 0, y: 0 }
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
    }
    return { x: el.x + el.width / 2, y: el.y + el.height / 2 }
  }

  // Arrow Snap to Edge / Center
  const snapArrowEndpoint = (wx, wy, excludeArrowId) => {
    let bestDist = 12 // snap radius
    let snapPt = { x: wx, y: wy, elementId: null }

    elements.forEach(el => {
      if (el.id === excludeArrowId || el.type === 'arrow' || el.type === 'frame') return
      
      const center = getElementCenter(el)
      const dCenter = Math.sqrt((wx - center.x) ** 2 + (wy - center.y) ** 2)
      if (dCenter < bestDist) {
        bestDist = dCenter
        snapPt = { x: center.x, y: center.y, elementId: el.id }
      }

      if (el.type !== 'stroke') {
        const edges = [
          { x: el.x, y: el.y + el.height / 2 }, // left
          { x: el.x + el.width, y: el.y + el.height / 2 }, // right
          { x: el.x + el.width / 2, y: el.y }, // top
          { x: el.x + el.width / 2, y: el.y + el.height } // bottom
        ]

        edges.forEach(edge => {
          const d = Math.sqrt((wx - edge.x) ** 2 + (wy - edge.y) ** 2)
          if (d < bestDist) {
            bestDist = d
            snapPt = { x: edge.x, y: edge.y, elementId: el.id }
          }
        })
      }
    })

    return snapPt
  }

  // Helper: Get elements inside frame
  const getElementsInFrame = (frame, list) => {
    return list.filter(el => {
      if (el.id === frame.id || el.type === 'frame') return false
      const center = getElementCenter(el)
      return center.x >= frame.x && center.x <= frame.x + frame.width &&
             center.y >= frame.y && center.y <= frame.y + frame.height
    })
  }

  // Helper: Update arrow positions connected to moved elements
  const updateArrowConnections = (list, movedIds) => {
    return list.map(item => {
      if (item.type !== 'arrow') return item
      let startX = item.startX
      let startY = item.startY
      let endX = item.endX
      let endY = item.endY

      if (item.startElementId && movedIds.includes(item.startElementId)) {
        const target = list.find(x => x.id === item.startElementId)
        if (target) {
          const center = getElementCenter(target)
          startX = center.x
          startY = center.y
        }
      }
      if (item.endElementId && movedIds.includes(item.endElementId)) {
        const target = list.find(x => x.id === item.endElementId)
        if (target) {
          const center = getElementCenter(target)
          endX = center.x
          endY = center.y
        }
      }

      return { ...item, startX, startY, endX, endY }
    })
  }

  // Keyboard zoom and fit listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (editingText || editingChecklist) return

      const isCmd = e.metaKey || e.ctrlKey
      const isShift = e.shiftKey

      if (isCmd && e.key === '0') {
        e.preventDefault()
        zoomToFit()
      } else if (isCmd && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        zoomAtPoint(1, window.innerWidth / 2, window.innerHeight / 2)
      } else if (isCmd && e.key === '-') {
        e.preventDefault()
        zoomAtPoint(-1, window.innerWidth / 2, window.innerHeight / 2)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [elements, editingText, editingChecklist])

  // Draw smooth preview on foreground canvas during interaction
  const drawForegroundPreview = () => {
    const fgCanvas = fgCanvasRef.current
    if (!fgCanvas) return
    const ctx = fgCanvas.getContext('2d')
    ctx.clearRect(0, 0, fgCanvas.width, fgCanvas.height)

    ctx.save()
    ctx.setTransform(
      transform.current.scale, 0, 0, 
      transform.current.scale, 
      transform.current.x, transform.current.y
    )

    if (dragType.current === 'draw' && activeStroke.current) {
      ctx.strokeStyle = activeColor
      ctx.lineWidth = activeWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalAlpha = activeTool === 'highlighter' ? 0.3 : activeOpacity
      
      ctx.beginPath()
      const pts = activeStroke.current.points
      if (pts.length > 0) {
        ctx.moveTo(pts[0].x, pts[0].y)
        pts.forEach(p => ctx.lineTo(p.x, p.y))
      }
      ctx.stroke()
    } else if (dragType.current === 'arrow_draw' && activeArrow.current) {
      ctx.strokeStyle = activeColor
      ctx.lineWidth = activeWidth
      ctx.lineCap = 'round'
      
      const arrow = activeArrow.current
      if (activeDashStyle === 'dashed') ctx.setLineDash([8, 4])
      else if (activeDashStyle === 'dotted') ctx.setLineDash([2, 4])

      ctx.beginPath()
      ctx.moveTo(arrow.startX, arrow.startY)
      ctx.lineTo(arrow.endX, arrow.endY)
      ctx.stroke()
      ctx.setLineDash([])

      // End arrowhead
      const endAngle = Math.atan2(arrow.endY - arrow.startY, arrow.endX - arrow.startX)
      ctx.save()
      ctx.translate(arrow.endX, arrow.endY)
      ctx.rotate(endAngle)
      ctx.fillStyle = activeColor
      const size = 6 + activeWidth * 2
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(-size, -size / 2)
      ctx.lineTo(-size * 0.8, 0)
      ctx.lineTo(-size, size / 2)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    } else if (dragType.current === 'shape_draw' && activeShape.current) {
      ctx.fillStyle = hexToRgba(activeFillColor, activeFillOpacity)
      ctx.strokeStyle = activeColor
      ctx.lineWidth = activeWidth
      
      ctx.save()
      const shape = activeShape.current
      ctx.beginPath()
      // Inline drawing path for preview
      if (shape.shape === 'rect') ctx.rect(shape.x, shape.y, shape.width, shape.height)
      else if (shape.shape === 'circle') {
        ctx.ellipse(shape.x + shape.width / 2, shape.y + shape.height / 2, Math.abs(shape.width / 2), Math.abs(shape.height / 2), 0, 0, Math.PI * 2)
      } else if (shape.shape === 'triangle') {
        ctx.moveTo(shape.x + shape.width / 2, shape.y)
        ctx.lineTo(shape.x + shape.width, shape.y + shape.height)
        ctx.lineTo(shape.x, shape.y + shape.height)
      } else if (shape.shape === 'diamond') {
        ctx.moveTo(shape.x + shape.width / 2, shape.y)
        ctx.lineTo(shape.x + shape.width, shape.y + shape.height / 2)
        ctx.lineTo(shape.x + shape.width / 2, shape.y + shape.height)
        ctx.lineTo(shape.x, shape.y + shape.height / 2)
      }
      ctx.closePath()
      if (activeFillColor !== 'transparent') ctx.fill()
      if (activeWidth > 0) ctx.stroke()
      ctx.restore()
    } else if (dragType.current === 'frame_draw' && activeFrame.current) {
      ctx.strokeStyle = '#d1d5db'
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 4])
      const frame = activeFrame.current
      ctx.strokeRect(frame.x, frame.y, frame.width, frame.height)
      ctx.fillStyle = 'rgba(243, 244, 246, 0.2)'
      ctx.fillRect(frame.x, frame.y, frame.width, frame.height)
      ctx.setLineDash([])
    } else if (dragType.current === 'marquee') {
      // Drawing selection rectangle
      ctx.strokeStyle = '#94a5ba'
      ctx.lineWidth = 1
      ctx.fillStyle = 'rgba(148, 165, 186, 0.1)'
      const w = dragStart.current.x - currentWorld.current.x
      const h = dragStart.current.y - currentWorld.current.y
      ctx.fillRect(currentWorld.current.x, currentWorld.current.y, w, h)
      ctx.strokeRect(currentWorld.current.x, currentWorld.current.y, w, h)
    }

    ctx.restore()

    // Dimension label overlay for shape / frame drawing
    const labelEl = dragType.current === 'shape_draw' ? activeShape.current
      : dragType.current === 'frame_draw' ? activeFrame.current
      : null
    if (labelEl) {
      const pw = Math.round(Math.abs(labelEl.width))
      const ph = Math.round(Math.abs(labelEl.height))
      if (pw > 4 && ph > 4) {
        const screen = worldToClient(labelEl.x + labelEl.width, labelEl.y + labelEl.height)
        const label = `${pw} × ${ph}`
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.font = 'bold 11px "JetBrains Mono", monospace'
        const tw = ctx.measureText(label).width
        const lx = screen.x + 12
        const ly = screen.y + 6
        ctx.fillStyle = 'rgba(10, 10, 14, 0.88)'
        if (ctx.roundRect) ctx.roundRect(lx - 5, ly - 13, tw + 10, 19, 4)
        else ctx.rect(lx - 5, ly - 13, tw + 10, 19)
        ctx.fill()
        ctx.fillStyle = '#e2e2e2'
        ctx.fillText(label, lx, ly)
        ctx.restore()
      }
    }
  }

  // Pointer event coordinate helpers
  const currentWorld = useRef({ x: 0, y: 0 })

  const handlePointerDown = (e) => {
    // Focus checks
    if (editingText || editingChecklist) return

    // Middle button clicks force PAN
    const isMiddleClick = e.button === 1
    const isSpaceBar = e.shiftKey || activeTool === 'hand' // fallback or hand tool
    const isAltKey = e.altKey

    const world = clientToWorld(e.clientX, e.clientY)
    dragStart.current = world
    isInteracting.current = true
    initialElements.current = JSON.parse(JSON.stringify(elements))

    // Handle snaps
    const snap = getSnapPoint(world.x, world.y)

    // WebSocket cursor tracking
    if (collabSession?.connected) {
      collabSession.sendCursorMove({ x: world.x, y: world.y })
    }

    if (isMiddleClick || isSpaceBar) {
      dragType.current = 'pan'
      dragStart.current = { x: e.clientX, y: e.clientY }
      return
    }

    if (isAltKey && (activeTool === 'pen' || activeTool === 'highlighter')) {
      // Temp Eraser
      dragType.current = 'erase'
      handleEraserAction(world.x, world.y)
      return
    }

    if (activeTool === 'eraser') {
      dragType.current = 'erase'
      handleEraserAction(world.x, world.y)
      return
    }

    if (activeTool === 'select') {
      // 1. Check if clicked a handle of the active selection
      const bounds = getSelectionBounds(selection, elements)
      const clickedHandle = hitTestHandle(e.clientX, e.clientY, bounds, transform.current.scale)
      
      if (clickedHandle) {
        dragHandle.current = clickedHandle
        if (clickedHandle === 'rot') {
          dragType.current = 'rotate'
          initialBounds.current = bounds
        } else {
          dragType.current = 'resize'
          initialBounds.current = bounds
        }
        return
      }

      // 2. Check if clicked an element
      const hit = hitTestElement(world.x, world.y, elements)
      if (hit) {
        const isMulti = e.metaKey || e.ctrlKey
        if (isMulti) {
          // Add/Remove from selection
          if (selection.includes(hit.id)) {
            setSelection(prev => prev.filter(id => id !== hit.id))
          } else {
            setSelection(prev => [...prev, hit.id])
          }
        } else {
          // Select this element (if not already selected)
          if (!selection.includes(hit.id)) {
            setSelection([hit.id])
          }
        }

        // Prepare offsets for moving elements
        dragType.current = 'move'
        const currentSelection = selection.includes(hit.id) ? selection : [hit.id]
        
        dragElementOffsets.current = {}
        currentSelection.forEach(id => {
          const el = elements.find(item => item.id === id)
          if (el) {
            dragElementOffsets.current[id] = {
              x: el.x !== undefined ? el.x : 0,
              y: el.y !== undefined ? el.y : 0,
              startX: el.startX !== undefined ? el.startX : 0,
              startY: el.startY !== undefined ? el.startY : 0,
              endX: el.endX !== undefined ? el.endX : 0,
              endY: el.endY !== undefined ? el.endY : 0,
              points: el.points ? JSON.parse(JSON.stringify(el.points)) : null
            }
          }
        })
      } else {
        // Clicked empty canvas -> start marquee selection box
        setSelection([])
        dragType.current = 'marquee'
      }
      return
    }

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      dragType.current = 'draw'
      activeStroke.current = {
        id: `stroke_${Math.random().toString(36).slice(2, 9)}`,
        type: 'stroke',
        points: [{ x: world.x, y: world.y, pressure: e.pressure || 1 }],
        color: activeColor,
        width: activeWidth,
        opacity: activeOpacity,
        smoothing: true,
        style: activeTool,
        zIndex: elements.length + 1
      }
      return
    }

    if (activeTool === 'line' || activeTool === 'arrow') {
      dragType.current = 'arrow_draw'
      // Snap to nearby element
      const snapped = snapArrowEndpoint(world.x, world.y, null)
      activeArrow.current = {
        id: `arrow_${Math.random().toString(36).slice(2, 9)}`,
        type: 'arrow',
        startX: snapped.x,
        startY: snapped.y,
        endX: snapped.x,
        endY: snapped.y,
        startArrow: false,
        endArrow: activeTool === 'arrow',
        style: 'straight',
        color: activeColor,
        width: activeWidth,
        dashStyle: activeDashStyle,
        label: null,
        startElementId: snapped.elementId,
        endElementId: null,
        zIndex: elements.length + 1
      }
      return
    }

    const shapes = ['rect', 'circle', 'triangle', 'diamond']
    if (shapes.includes(activeTool)) {
      dragType.current = 'shape_draw'
      activeShape.current = {
        id: `shape_${Math.random().toString(36).slice(2, 9)}`,
        type: 'shape',
        shape: activeTool,
        x: snap.x,
        y: snap.y,
        width: 1,
        height: 1,
        rotation: 0,
        fillColor: activeFillColor,
        strokeColor: activeColor,
        strokeWidth: activeWidth,
        fillOpacity: activeFillOpacity,
        cornerRadius: activeTool === 'rect' ? 6 : 0,
        label: null,
        zIndex: elements.length + 1
      }
      return
    }

    if (activeTool === 'text') {
      createNewTextElement(snap.x, snap.y)
      return
    }

    if (activeTool === 'sticky') {
      createNewStickyNote(snap.x, snap.y)
      return
    }

    if (activeTool === 'checklist') {
      createNewChecklist(snap.x, snap.y)
      return
    }

    if (activeTool === 'frame') {
      dragType.current = 'frame_draw'
      activeFrame.current = {
        id: `frame_${Math.random().toString(36).slice(2, 9)}`,
        type: 'frame',
        title: 'New Section',
        x: world.x,
        y: world.y,
        width: 10,
        height: 10,
        rotation: 0,
        backgroundColor: 'rgba(243, 244, 246, 0.15)',
        borderColor: '#d1d5db',
        borderStyle: 'dashed',
        zIndex: elements.length + 1
      }
      return
    }
  }

  const handlePointerMove = (e) => {
    const world = clientToWorld(e.clientX, e.clientY)
    currentWorld.current = world

    // Sync remote cursors
    if (collabSession?.connected) {
      collabSession.sendCursorMove({ x: world.x, y: world.y })
    }

    // Trigger grid snapping
    const snap = getSnapPoint(world.x, world.y)

    if (!isInteracting.current) return

    if (dragType.current === 'pan') {
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      transform.current.x += dx
      transform.current.y += dy
      dragStart.current = { x: e.clientX, y: e.clientY }
      redraw()
      updateTransformState()
      return
    }

    if (dragType.current === 'erase') {
      handleEraserAction(world.x, world.y)
      return
    }

    if (dragType.current === 'draw' && activeStroke.current) {
      activeStroke.current.points.push({ x: world.x, y: world.y, pressure: e.pressure || 1 })
      drawForegroundPreview()
      return
    }

    if (dragType.current === 'arrow_draw' && activeArrow.current) {
      const snapEnd = snapArrowEndpoint(world.x, world.y, activeArrow.current.id)
      
      // Angle constraints if shift key is pressed
      let ex = snapEnd.x
      let ey = snapEnd.y
      if (e.shiftKey) {
        const dx = ex - activeArrow.current.startX
        const dy = ey - activeArrow.current.startY
        const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
        const dist = Math.sqrt(dx * dx + dy * dy)
        ex = activeArrow.current.startX + Math.cos(angle) * dist
        ey = activeArrow.current.startY + Math.sin(angle) * dist
      }

      activeArrow.current.endX = ex
      activeArrow.current.endY = ey
      activeArrow.current.endElementId = snapEnd.elementId
      drawForegroundPreview()
      return
    }

    if (dragType.current === 'shape_draw' && activeShape.current) {
      let sw = snap.x - activeShape.current.x
      let sh = snap.y - activeShape.current.y
      
      if (e.shiftKey) {
        const side = Math.max(Math.abs(sw), Math.abs(sh))
        sw = sw < 0 ? -side : side
        sh = sh < 0 ? -side : side
      }

      activeShape.current.width = sw
      activeShape.current.height = sh
      drawForegroundPreview()
      return
    }

    if (dragType.current === 'frame_draw' && activeFrame.current) {
      activeFrame.current.width = world.x - activeFrame.current.x
      activeFrame.current.height = world.y - activeFrame.current.y
      drawForegroundPreview()
      return
    }

    if (dragType.current === 'marquee') {
      drawForegroundPreview()
      return
    }

    if (dragType.current === 'move' && selection.length > 0) {
      const dx = world.x - dragStart.current.x
      const dy = world.y - dragStart.current.y

      // Snap frame displacements or general element moves
      let finalDx = dx
      let finalDy = dy
      if (snapEnabled) {
        finalDx = Math.round(dx / 24) * 24
        finalDy = Math.round(dy / 24) * 24
      }

      // Check frame children movement
      const movedIds = [...selection]
      selection.forEach(id => {
        const el = elements.find(x => x.id === id)
        if (el?.type === 'frame') {
          const kids = getElementsInFrame(el, elements)
          kids.forEach(k => {
            if (!movedIds.includes(k.id)) movedIds.push(k.id)
          })
        }
      })

      setElements(prev => {
        let list = prev.map(el => {
          if (!movedIds.includes(el.id)) return el
          if (el.locked) return el

          const offset = dragElementOffsets.current[el.id] || { x: el.x || 0, y: el.y || 0 }
          
          if (el.type === 'stroke') {
            const initialPts = dragElementOffsets.current[el.id]?.points || el.points
            const newPoints = initialPts.map(p => ({
              ...p,
              x: p.x + finalDx,
              y: p.y + finalDy
            }))
            return { ...el, points: newPoints }
          } else if (el.type === 'arrow') {
            const stX = (dragElementOffsets.current[el.id]?.startX ?? el.startX) + finalDx
            const stY = (dragElementOffsets.current[el.id]?.startY ?? el.startY) + finalDy
            const edX = (dragElementOffsets.current[el.id]?.endX ?? el.endX) + finalDx
            const edY = (dragElementOffsets.current[el.id]?.endY ?? el.endY) + finalDy
            return { ...el, startX: stX, startY: stY, endX: edX, endY: edY }
          } else {
            const stX = (dragElementOffsets.current[el.id]?.x ?? el.x) + finalDx
            const stY = (dragElementOffsets.current[el.id]?.y ?? el.y) + finalDy
            return { ...el, x: stX, y: stY }
          }
        })

        // Auto update arrow snappings
        list = updateArrowConnections(list, movedIds)
        return list
      })
      return
    }

    if (dragType.current === 'resize' && selection.length > 0 && initialBounds.current) {
      const handle = dragHandle.current
      const bounds = initialBounds.current

      const { anchorX, anchorY, scaleX, scaleY } = getScaleAnchor(bounds, handle, world, dragStart.current, e.shiftKey)

      setElements(prev => {
        let list = prev.map(el => {
          if (!selection.includes(el.id)) return el
          if (el.locked) return el

          if (el.type === 'stroke') {
            const newPoints = el.points.map(p => ({
              ...p,
              x: anchorX + (p.x - anchorX) * scaleX,
              y: anchorY + (p.y - anchorY) * scaleY
            }))
            return { ...el, points: newPoints }
          } else if (el.type === 'arrow') {
            return {
              ...el,
              startX: anchorX + (el.startX - anchorX) * scaleX,
              startY: anchorY + (el.startY - anchorY) * scaleY,
              endX: anchorX + (el.endX - anchorX) * scaleX,
              endY: anchorY + (el.endY - anchorY) * scaleY
            }
          } else {
            const newX = anchorX + (el.x - anchorX) * scaleX
            const newY = anchorY + (el.y - anchorY) * scaleY
            const newW = el.width * scaleX
            const newH = el.height * scaleY
            return { ...el, x: newX, y: newY, width: newW, height: newH }
          }
        })
        list = updateArrowConnections(list, selection)
        return list
      })
      return
    }

    if (dragType.current === 'rotate' && selection.length === 1 && initialBounds.current) {
      const bounds = initialBounds.current
      const center = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2
      }

      const angleRad = Math.atan2(world.y - center.y, world.x - center.x) + Math.PI / 2
      let angleDeg = (angleRad * 180) / Math.PI
      angleDeg = Math.round((angleDeg + 360) % 360)

      setElements(prev => prev.map(el => {
        if (el.id !== selection[0]) return el
        return { ...el, rotation: angleDeg }
      }))

      // Rotation indicator overlay logic can go here (drawn near cursor)
      const fgCanvas = fgCanvasRef.current
      if (fgCanvas) {
        const ctx = fgCanvas.getContext('2d')
        ctx.clearRect(0, 0, fgCanvas.width, fgCanvas.height)
        ctx.save()
        ctx.fillStyle = '#374151'
        ctx.font = '10px Geist, sans-serif'
        ctx.fillText(`${angleDeg}°`, e.clientX + 10, e.clientY - 10)
        ctx.restore()
      }
      return
    }
  }

  const handlePointerUp = (e) => {
    if (!isInteracting.current) return
    isInteracting.current = false

    const fgCanvas = fgCanvasRef.current
    if (fgCanvas) {
      const ctx = fgCanvas.getContext('2d')
      ctx.clearRect(0, 0, fgCanvas.width, fgCanvas.height)
    }

    const world = clientToWorld(e.clientX, e.clientY)

    // Commit actions
    if (dragType.current === 'draw' && activeStroke.current) {
      if (activeStroke.current.points.length > 1) {
        const newEl = activeStroke.current
        pushToUndo(initialElements.current)
        setElements(prev => [...prev, newEl])
        if (collabSession?.connected) {
          collabSession.sendStateUpdate({ elements: { [newEl.id]: newEl } })
        }
      }
      activeStroke.current = null
    } else if (dragType.current === 'arrow_draw' && activeArrow.current) {
      const snapEnd = snapArrowEndpoint(world.x, world.y, activeArrow.current.id)
      const finalArrow = {
        ...activeArrow.current,
        endX: snapEnd.x,
        endY: snapEnd.y,
        endElementId: snapEnd.elementId
      }
      pushToUndo(initialElements.current)
      setElements(prev => [...prev, finalArrow])
      if (collabSession?.connected) {
        collabSession.sendStateUpdate({ elements: { [finalArrow.id]: finalArrow } })
      }
      activeArrow.current = null
    } else if (dragType.current === 'shape_draw' && activeShape.current) {
      const finalShape = activeShape.current
      if (Math.abs(finalShape.width) > 2 && Math.abs(finalShape.height) > 2) {
        // Fix negative width/height coordinates
        if (finalShape.width < 0) {
          finalShape.x += finalShape.width
          finalShape.width = Math.abs(finalShape.width)
        }
        if (finalShape.height < 0) {
          finalShape.y += finalShape.height
          finalShape.height = Math.abs(finalShape.height)
        }

        pushToUndo(initialElements.current)
        setElements(prev => [...prev, finalShape])
        setSelection([finalShape.id])
        if (collabSession?.connected) {
          collabSession.sendStateUpdate({ elements: { [finalShape.id]: finalShape } })
        }
      }
      activeShape.current = null
    } else if (dragType.current === 'frame_draw' && activeFrame.current) {
      const finalFrame = activeFrame.current
      if (Math.abs(finalFrame.width) > 5 && Math.abs(finalFrame.height) > 5) {
        if (finalFrame.width < 0) {
          finalFrame.x += finalFrame.width
          finalFrame.width = Math.abs(finalFrame.width)
        }
        if (finalFrame.height < 0) {
          finalFrame.y += finalFrame.height
          finalFrame.height = Math.abs(finalFrame.height)
        }
        pushToUndo(initialElements.current)
        setElements(prev => [...prev, finalFrame])
        setSelection([finalFrame.id])
        if (collabSession?.connected) {
          collabSession.sendStateUpdate({ elements: { [finalFrame.id]: finalFrame } })
        }
      }
      activeFrame.current = null
    } else if (dragType.current === 'marquee') {
      const bounds = {
        x: Math.min(dragStart.current.x, world.x),
        y: Math.min(dragStart.current.y, world.y),
        width: Math.abs(dragStart.current.x - world.x),
        height: Math.abs(dragStart.current.y - world.y)
      }
      
      const newSelection = []
      elements.forEach(el => {
        if (el.type === 'stroke') {
          // Check if any point is inside
          const hasPt = el.points.some(p => p.x >= bounds.x && p.x <= bounds.x + bounds.width && p.y >= bounds.y && p.y <= bounds.y + bounds.height)
          if (hasPt) newSelection.push(el.id)
        } else if (el.type === 'arrow') {
          const inStart = el.startX >= bounds.x && el.startX <= bounds.x + bounds.width && el.startY >= bounds.y && el.startY <= bounds.y + bounds.height
          const inEnd = el.endX >= bounds.x && el.endX <= bounds.x + bounds.width && el.endY >= bounds.y && el.endY <= bounds.y + bounds.height
          if (inStart || inEnd) newSelection.push(el.id)
        } else {
          // Check center
          const cx = el.x + el.width / 2
          const cy = el.y + el.height / 2
          if (cx >= bounds.x && cx <= bounds.x + bounds.width && cy >= bounds.y && cy <= bounds.y + bounds.height) {
            newSelection.push(el.id)
          }
        }
      })
      setSelection(newSelection)
    } else if (dragType.current === 'move' || dragType.current === 'resize' || dragType.current === 'rotate') {
      // Finished moving/resizing/rotating -> push to undo
      pushToUndo(initialElements.current)
      
      if (collabSession?.connected) {
        // Sync all moved items
        const syncPayload = {}
        selection.forEach(id => {
          const el = elements.find(item => item.id === id)
          if (el) syncPayload[id] = el
        })
        collabSession.sendStateUpdate({ elements: syncPayload })
      }
    }

    dragType.current = null
    dragHandle.current = null
    redraw()
  }

  // Eraser brush implementation (intersection checks)
  const handleEraserAction = (wx, wy) => {
    const radius = 12 / transform.current.scale
    const toDelete = []

    elements.forEach(el => {
      if (el.locked) return

      if (el.type === 'stroke') {
        const hit = el.points.some(p => Math.sqrt((p.x - wx) ** 2 + (p.y - wy) ** 2) <= radius)
        if (hit) toDelete.push(el.id)
      } else if (el.type === 'arrow') {
        // Sample points along the arrow segments
        const dStart = Math.sqrt((el.startX - wx) ** 2 + (el.startY - wy) ** 2)
        const dEnd = Math.sqrt((el.endX - wx) ** 2 + (el.endY - wy) ** 2)
        if (dStart <= radius || dEnd <= radius) {
          toDelete.push(el.id)
        }
      } else {
        // Box elements -> check if center or cursor intersects box
        const hit = isPointInRotatedBox(wx, wy, el)
        if (hit) toDelete.push(el.id)
      }
    })

    if (toDelete.length > 0) {
      pushToUndo()
      setElements(prev => prev.filter(el => !toDelete.includes(el.id)))
      setSelection(prev => prev.filter(id => !toDelete.includes(id)))
      
      if (collabSession?.connected) {
        const deletePayload = {}
        toDelete.forEach(id => {
          deletePayload[id] = null
        })
        collabSession.sendStateUpdate({ elements: deletePayload })
      }
    }
  }

  // Wheel zoom listener
  const handleWheel = (e) => {
    e.preventDefault()
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top

    // Pinch zoom check (ctrlKey is true for trackpad pinch)
    if (e.ctrlKey) {
      zoomAtPoint(-e.deltaY * 0.05, cx, cy)
    } else {
      // Standard wheel zoom
      zoomAtPoint(-e.deltaY * 0.005, cx, cy)
    }
  }

  // Double click events (Label / Inline editor)
  const handleDoubleClick = (e) => {
    const world = clientToWorld(e.clientX, e.clientY)
    const hit = hitTestElement(world.x, world.y, elements)

    if (hit) {
      if (hit.type === 'text') {
        setEditingText(hit)
      } else if (hit.type === 'sticky') {
        setEditingText(hit)
      } else if (hit.type === 'shape') {
        // Open shapes inline label editor
        setEditingText(hit)
      } else if (hit.type === 'checklist') {
        setEditingChecklist(hit)
      } else if (hit.type === 'frame') {
        setEditingText(hit)
      }
    } else {
      // Double click empty canvas -> creates text element
      createNewTextElement(world.x, world.y)
    }
  }

  // Element Instantiation Helpers
  const createNewTextElement = (wx, wy) => {
    const newText = {
      id: `text_${Math.random().toString(36).slice(2, 9)}`,
      type: 'text',
      content: 'Text',
      x: wx,
      y: wy,
      width: 150,
      height: 30,
      rotation: 0,
      fontSize: 16,
      fontFamily: activeTextStyle.fontFamily || 'Geist, sans-serif',
      fontWeight: activeTextStyle.fontWeight || 'normal',
      fontStyle: activeTextStyle.fontStyle || 'normal',
      color: activeColor,
      align: activeTextStyle.align || 'left',
      zIndex: elements.length + 1
    }
    pushToUndo()
    setElements(prev => [...prev, newText])
    setEditingText(newText)
    if (collabSession?.connected) {
      collabSession.sendStateUpdate({ elements: { [newText.id]: newText } })
    }
  }

  const createNewStickyNote = (wx, wy) => {
    // Rotating default sticky colors
    const colors = ['#fef9c3', '#dcfce7', '#dbeafe', '#fce7f3', '#ffe4e6', '#f3e8ff', '#ffedd5']
    const color = colors[elements.filter(e => e.type === 'sticky').length % colors.length]
    
    const newSticky = {
      id: `sticky_${Math.random().toString(36).slice(2, 9)}`,
      type: 'sticky',
      content: 'Write something...',
      x: wx,
      y: wy,
      width: 180,
      height: 180,
      rotation: 0,
      color,
      textColor: '#e2e2e2',
      fontSize: 14,
      foldCorner: true,
      zIndex: elements.length + 1
    }
    pushToUndo()
    setElements(prev => [...prev, newSticky])
    setEditingText(newSticky)
    if (collabSession?.connected) {
      collabSession.sendStateUpdate({ elements: { [newSticky.id]: newSticky } })
    }
  }

  const createNewChecklist = (wx, wy) => {
    const newChecklist = {
      id: `checklist_${Math.random().toString(36).slice(2, 9)}`,
      type: 'checklist',
      title: 'Checklist',
      x: wx,
      y: wy,
      width: 220,
      height: 120,
      rotation: 0,
      items: [
        { id: 'item1', text: 'Item 1', checked: false },
        { id: 'item2', text: 'Item 2', checked: false },
        { id: 'item3', text: 'Item 3', checked: false }
      ],
      color: activeColor || '#3b82f6',
      zIndex: elements.length + 1
    }
    pushToUndo()
    setElements(prev => [...prev, newChecklist])
    setEditingChecklist(newChecklist)
    if (collabSession?.connected) {
      collabSession.sendStateUpdate({ elements: { [newChecklist.id]: newChecklist } })
    }
  }

  // drag-and-drop file listener
  const handleDrop = (e) => {
    e.preventDefault()
    const files = e.dataTransfer.files
    if (files.length === 0) return

    const file = files[0]
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const clientRect = bgCanvasRef.current.getBoundingClientRect()
        const world = clientToWorld(e.clientX - clientRect.left, e.clientY - clientRect.top)
        
        const img = new Image()
        img.src = event.target.result
        img.onload = () => {
          const aspect = img.naturalWidth / img.naturalHeight
          const w = Math.min(400, img.naturalWidth)
          const h = w / aspect

          const newImage = {
            id: `image_${Math.random().toString(36).slice(2, 9)}`,
            type: 'image',
            src: event.target.result,
            x: world.x - w / 2,
            y: world.y - h / 2,
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
          pushToUndo()
          setElements(prev => [...prev, newImage])
          setSelection([newImage.id])
          if (collabSession?.connected) {
            collabSession.sendStateUpdate({ elements: { [newImage.id]: newImage } })
          }
        }
      }
      reader.readAsDataURL(file)
    }
  }

  // clipboard pasting
  useEffect(() => {
    const handlePaste = (e) => {
      if (editingText || editingChecklist) return

      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile()
          const reader = new FileReader()
          reader.onload = (event) => {
            // Paste image at viewport center
            const canvasW = bgCanvasRef.current?.width || window.innerWidth
            const canvasH = bgCanvasRef.current?.height || window.innerHeight
            const world = clientToWorld(canvasW / 2, canvasH / 2)

            const img = new Image()
            img.src = event.target.result
            img.onload = () => {
              const aspect = img.naturalWidth / img.naturalHeight
              const w = Math.min(400, img.naturalWidth)
              const h = w / aspect

              const newImage = {
                id: `image_${Math.random().toString(36).slice(2, 9)}`,
                type: 'image',
                src: event.target.result,
                x: world.x - w / 2,
                y: world.y - h / 2,
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
              pushToUndo()
              setElements(prev => [...prev, newImage])
              setSelection([newImage.id])
              if (collabSession?.connected) {
                collabSession.sendStateUpdate({ elements: { [newImage.id]: newImage } })
              }
            }
          }
          reader.readAsDataURL(file)
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [elements, editingText, editingChecklist])

  // Custom hit test handle logic helper
  const hitTestHandle = (clientX, clientY, bounds, scale) => {
    if (!bounds) return null
    
    const screenBounds = {
      x: bounds.x * scale + transform.current.x,
      y: bounds.y * scale + transform.current.y,
      w: bounds.width * scale,
      h: bounds.height * scale
    }
    
    const handleSize = 8
    const handles = {
      tl: { x: screenBounds.x, y: screenBounds.y },
      tr: { x: screenBounds.x + screenBounds.w, y: screenBounds.y },
      bl: { x: screenBounds.x, y: screenBounds.y + screenBounds.h },
      br: { x: screenBounds.x + screenBounds.w, y: screenBounds.y + screenBounds.h },
      tm: { x: screenBounds.x + screenBounds.w / 2, y: screenBounds.y },
      bm: { x: screenBounds.x + screenBounds.w / 2, y: screenBounds.y + screenBounds.h },
      lm: { x: screenBounds.x, y: screenBounds.y + screenBounds.h / 2 },
      rm: { x: screenBounds.x + screenBounds.w, y: screenBounds.y + screenBounds.h / 2 },
      rot: { x: screenBounds.x + screenBounds.w / 2, y: screenBounds.y - 20 }
    }
    
    for (const [key, pt] of Object.entries(handles)) {
      const dx = clientX - pt.x
      const dy = clientY - pt.y
      if (Math.sqrt(dx * dx + dy * dy) <= handleSize) {
        return key
      }
    }
    return null
  }

  // Get scaling anchor and ratios based on active drag direction
  const getScaleAnchor = (bounds, handle, currentWorld, startWorld, shiftKey) => {
    const { x, y, width: w, height: h } = bounds
    let anchorX = x
    let anchorY = y
    let scaleX = 1
    let scaleY = 1
    
    const dx = currentWorld.x - startWorld.x
    const dy = currentWorld.y - startWorld.y
    
    switch (handle) {
      case 'br':
        anchorX = x
        anchorY = y
        scaleX = w > 0 ? (w + dx) / w : 1
        scaleY = h > 0 ? (h + dy) / h : 1
        break
      case 'tl':
        anchorX = x + w
        anchorY = y + h
        scaleX = w > 0 ? (w - dx) / w : 1
        scaleY = h > 0 ? (h - dy) / h : 1
        break
      case 'tr':
        anchorX = x
        anchorY = y + h
        scaleX = w > 0 ? (w + dx) / w : 1
        scaleY = h > 0 ? (h - dy) / h : 1
        break
      case 'bl':
        anchorX = x + w
        anchorY = y
        scaleX = w > 0 ? (w - dx) / w : 1
        scaleY = h > 0 ? (h + dy) / h : 1
        break
      case 'rm':
        anchorX = x
        anchorY = y
        scaleX = w > 0 ? (w + dx) / w : 1
        scaleY = 1
        break
      case 'lm':
        anchorX = x + w
        anchorY = y
        scaleX = w > 0 ? (w - dx) / w : 1
        scaleY = 1
        break
      case 'bm':
        anchorX = x
        anchorY = y
        scaleX = 1
        scaleY = h > 0 ? (h + dy) / h : 1
        break
      case 'tm':
        anchorX = x
        anchorY = y + h
        scaleX = 1
        scaleY = h > 0 ? (h - dy) / h : 1
        break
      default:
        break
    }
    
    if (shiftKey) {
      const s = Math.min(scaleX, scaleY)
      scaleX = s
      scaleY = s
    }
    
    return { anchorX, anchorY, scaleX, scaleY }
  }

  // Inline editor positions
  const getEditorStyle = (el) => {
    if (!el) return {}
    const client = worldToClient(el.x, el.y)
    
    let w = el.width * transform.current.scale
    let h = el.height * transform.current.scale
    
    if (el.type === 'shape' || el.type === 'frame') {
      // Center editor in shapes/frames
      const cx = el.x + el.width / 2
      const cy = el.y + el.height / 2
      const clientCenter = worldToClient(cx, cy)
      w = Math.max(120, el.width * transform.current.scale - 20)
      h = 40
      return {
        left: `${clientCenter.x - w / 2}px`,
        top: `${clientCenter.y - h / 2}px`,
        width: `${w}px`,
        height: `${h}px`,
        transform: `rotate(${el.rotation || 0}deg)`,
        fontSize: `${13 * transform.current.scale}px`,
      }
    }

    return {
      left: `${client.x}px`,
      top: `${client.y}px`,
      width: `${w}px`,
      height: `${h}px`,
      transform: `rotate(${el.rotation || 0}deg)`,
      fontSize: `${(el.fontSize || 14) * transform.current.scale}px`,
      color: el.textColor || el.color || '#e2e2e2',
      background: el.type === 'sticky' ? 'transparent' : 'transparent',
      fontFamily: el.fontFamily || 'Geist, sans-serif',
      fontWeight: el.fontWeight || 'normal',
      fontStyle: el.fontStyle || 'normal',
      textAlign: el.align || 'left',
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: '#0e0e0e',
        userSelect: 'none',
        outline: 'none',
      }}
      onWheel={handleWheel}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Background static canvas */}
      <canvas
        ref={bgCanvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          background: '#0e0e0e',
        }}
      />

      {/* Foreground drawing canvas */}
      <canvas
        ref={fgCanvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          cursor: activeTool === 'hand' ? 'grab' : activeTool === 'select' ? 'default' : 'crosshair',
        }}
      />

      {/* HTML Overlays (Text Editors, Collaboration Cursors) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        {/* Inline Text Area Editor */}
        {editingText && (
          <textarea
            autoFocus
            style={{
              position: 'absolute',
              border: '1px dashed #3b82f6',
              outline: 'none',
              padding: '6px',
              resize: 'none',
              boxSizing: 'border-box',
              pointerEvents: 'auto',
              lineHeight: '1.4',
              ...getEditorStyle(editingText),
            }}
            value={editingText.type === 'shape' ? (editingText.label || '') : (editingText.type === 'frame' ? (editingText.title || '') : (editingText.content || ''))}
            onChange={(e) => {
              const val = e.target.value
              setEditingText(prev => ({
                ...prev,
                label: prev.type === 'shape' ? val : undefined,
                title: prev.type === 'frame' ? val : undefined,
                content: (prev.type !== 'shape' && prev.type !== 'frame') ? val : undefined
              }))
              setElements(prev => prev.map(item => {
                if (item.id !== editingText.id) return item
                return {
                  ...item,
                  label: item.type === 'shape' ? val : undefined,
                  title: item.type === 'frame' ? val : undefined,
                  content: (item.type !== 'shape' && item.type !== 'frame') ? val : undefined
                }
              }))
            }}
            onBlur={() => {
              if (collabSession?.connected) {
                collabSession.sendStateUpdate({ elements: { [editingText.id]: editingText } })
              }
              setEditingText(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.currentTarget.blur()
              }
            }}
          />
        )}

        {/* Checklist edit overlay card */}
        {editingChecklist && (
          <div
            style={{
              position: 'absolute',
              ...getEditorStyle(editingChecklist),
              background: '#141414',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              padding: '12px',
              pointerEvents: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              zIndex: 1000,
            }}
          >
            <input
              style={{
                fontFamily: 'Geist, sans-serif',
                fontWeight: 'bold',
                fontSize: '13px',
                width: '100%',
                border: 'none',
                borderBottom: '1px solid #2a2a2a',
                paddingBottom: '4px',
                outline: 'none',
                marginBottom: '8px',
                color: '#e2e2e2',
                background: 'transparent',
              }}
              value={editingChecklist.title || ''}
              onChange={(e) => {
                const val = e.target.value
                setEditingChecklist(prev => ({ ...prev, title: val }))
                setElements(prev => prev.map(item => {
                  if (item.id !== editingChecklist.id) return item
                  return { ...item, title: val }
                }))
              }}
              placeholder="Checklist Title"
            />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
              {editingChecklist.items.map((item, idx) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => {
                      const checkedVal = e.target.checked
                      const newItems = editingChecklist.items.map(x => x.id === item.id ? { ...x, checked: checkedVal } : x)
                      setEditingChecklist(prev => ({ ...prev, items: newItems }))
                      setElements(prev => prev.map(ch => {
                        if (ch.id !== editingChecklist.id) return ch
                        return { ...ch, items: newItems }
                      }))
                    }}
                  />
                  <input
                    style={{
                      fontFamily: 'Geist, sans-serif',
                      fontSize: '12px',
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      color: item.checked ? '#5a5a5a' : '#e2e2e2',
                      background: 'transparent',
                      textDecoration: item.checked ? 'line-through' : 'none',
                    }}
                    value={item.text || ''}
                    onChange={(e) => {
                      const textVal = e.target.value
                      const newItems = editingChecklist.items.map(x => x.id === item.id ? { ...x, text: textVal } : x)
                      setEditingChecklist(prev => ({ ...prev, items: newItems }))
                      setElements(prev => prev.map(ch => {
                        if (ch.id !== editingChecklist.id) return ch
                        return { ...ch, items: newItems }
                      }))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        // Insert new checklist item
                        const newItem = { id: `item_${Math.random().toString(36).slice(2, 6)}`, text: '', checked: false }
                        const newItems = [...editingChecklist.items]
                        newItems.splice(idx + 1, 0, newItem)
                        setEditingChecklist(prev => ({ ...prev, items: newItems }))
                        setElements(prev => prev.map(ch => {
                          if (ch.id !== editingChecklist.id) return ch
                          return { ...ch, items: newItems }
                        }))
                      } else if (e.key === 'Backspace' && !item.text && editingChecklist.items.length > 1) {
                        e.preventDefault()
                        const newItems = editingChecklist.items.filter(x => x.id !== item.id)
                        setEditingChecklist(prev => ({ ...prev, items: newItems }))
                        setElements(prev => prev.map(ch => {
                          if (ch.id !== editingChecklist.id) return ch
                          return { ...ch, items: newItems }
                        }))
                      }
                    }}
                    placeholder="Item text..."
                  />
                </div>
              ))}
            </div>
            
            <button
              onClick={() => {
                if (collabSession?.connected) {
                  collabSession.sendStateUpdate({ elements: { [editingChecklist.id]: editingChecklist } })
                }
                setEditingChecklist(null)
              }}
              style={{
                width: '100%',
                marginTop: '10px',
                padding: '4px 0',
                background: '#1e1e1e',
                border: '1px solid #2a2a2a',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                fontFamily: 'Geist, sans-serif',
                fontWeight: 'bold',
                color: '#e2e2e2',
              }}
            >
              Done
            </button>
          </div>
        )}

        {/* Remote Cursors Overlay */}
        {collabSession?.connected && collabSession.users.map(u => {
          if (!u.cursor) return null
          
          // Project screen coordinates
          const screenPos = worldToClient(u.cursor.x, u.cursor.y)
          
          // Don't show cursor if offscreen
          const isOffscreen = screenPos.x < 0 || screenPos.x > window.innerWidth || screenPos.y < 0 || screenPos.y > window.innerHeight
          if (isOffscreen) return null

          return (
            <div
              key={u.id}
              style={{
                position: 'absolute',
                left: `${screenPos.x}px`,
                top: `${screenPos.y}px`,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transform: 'translate(-2px, -2px)',
                pointerEvents: 'none',
                zIndex: 9999,
              }}
            >
              {/* Dot cursor */}
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: u.color || '#3b82f6',
                  boxShadow: '0 0 6px rgba(0,0,0,0.2)',
                }}
              />
              
              {/* Name Tag */}
              <div
                style={{
                  background: u.color || '#3b82f6',
                  color: '#ffffff',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  fontFamily: 'Geist, sans-serif',
                  padding: '2px 5px',
                  borderRadius: '3px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                }}
              >
                {u.name}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
