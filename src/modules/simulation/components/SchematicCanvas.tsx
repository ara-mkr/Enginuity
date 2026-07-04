// Infinite pan/zoom schematic canvas (SVG). Owns all pointer/keyboard
// interaction: placement ghosts, orthogonal wire drawing with pin snapping,
// component dragging, selection, and full-electrical-node highlighting driven
// by the union-find detection result. Viewport changes render from local state
// and flush to the persisted store on a short debounce so pan/zoom doesn't
// hammer localStorage.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Circuit, Point, Probe, Viewport } from '../types'
import { GRID } from '../types'
import type { NodeDetectionResult } from '../core/nodeDetection'
import { getDef } from '../componentDefs'
import { formatEngNotation } from '../core/engNotation'
import {
  distToOrthoSegment,
  orthoRoute,
  pinWorldPosition,
  snapPoint,
} from '../core/geometry'
import { currentKeyFor, type ResolvedProbe } from '../core/probes'
import { useSimulationStore } from '../store/circuitStore'
import type { Selection, Tool } from '../editorState'
import { SELECT_TOOL, VOLTAGE_PROBE_TOOL, WIRE_TOOL } from '../editorState'
import { SchematicComponent } from './SchematicComponent'
import { WireView } from './WireView'
import { OhmaDormant } from './OhmaDormant'

interface Props {
  circuit: Circuit
  detection: NodeDetectionResult
  /** Probe → node/component bindings, recomputed with detection every render. */
  resolvedProbes: ResolvedProbe[]
  tool: Tool
  onToolChange: (t: Tool) => void
  selection: Selection | null
  onSelectionChange: (s: Selection | null) => void
  /** Fresh DC operating-point voltages to overlay per node; null hides the overlay. */
  dcVoltages?: Record<number, number> | null
  /** Fresh DC component currents (refdes-keyed) for current-probe badges. */
  dcCurrents?: Record<string, number> | null
}

const MIN_ZOOM = 0.2
const MAX_ZOOM = 4
const PIN_SNAP_RADIUS = 12 // screen px

interface PinTarget {
  componentId: string
  pinName: string
  position: Point
}

export function SchematicCanvas({
  circuit,
  detection,
  resolvedProbes,
  tool,
  onToolChange,
  selection,
  onSelectionChange,
  dcVoltages,
  dcCurrents,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })

  const setViewportStore = useSimulationStore((s) => s.setViewport)
  const addComponent = useSimulationStore((s) => s.addComponent)
  const moveComponent = useSimulationStore((s) => s.moveComponent)
  const rotateComponent = useSimulationStore((s) => s.rotateComponent)
  const removeComponent = useSimulationStore((s) => s.removeComponent)
  const addWire = useSimulationStore((s) => s.addWire)
  const removeWire = useSimulationStore((s) => s.removeWire)
  const addProbe = useSimulationStore((s) => s.addProbe)
  const moveProbe = useSimulationStore((s) => s.moveProbe)
  const removeProbe = useSimulationStore((s) => s.removeProbe)
  const beginGesture = useSimulationStore((s) => s.beginGesture)
  const undo = useSimulationStore((s) => s.undo)
  const redo = useSimulationStore((s) => s.redo)

  // ── Viewport: local for rendering, debounced flush to the store ────────────
  const [viewport, setViewport] = useState<Viewport>(circuit.viewport)
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Re-adopt the stored viewport when switching circuits (render-time reset).
  const [viewportCircuitId, setViewportCircuitId] = useState(circuit.id)
  if (circuit.id !== viewportCircuitId) {
    setViewportCircuitId(circuit.id)
    setViewport(circuit.viewport)
  }
  const updateViewport = useCallback(
    (vp: Viewport) => {
      setViewport(vp)
      if (flushTimer.current) clearTimeout(flushTimer.current)
      flushTimer.current = setTimeout(() => setViewportStore(vp), 300)
    },
    [setViewportStore],
  )

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const obs = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    obs.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => obs.disconnect()
  }, [])

  const toWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = svgRef.current!.getBoundingClientRect()
      return {
        x: (clientX - rect.left - viewport.x) / viewport.zoom,
        y: (clientY - rect.top - viewport.y) / viewport.zoom,
      }
    },
    [viewport],
  )

  // ── Interaction state ───────────────────────────────────────────────────────
  const panRef = useRef<{ startX: number; startY: number; vx: number; vy: number; moved: boolean } | null>(null)
  const dragRef = useRef<{ kind: 'component' | 'probe'; id: string; dx: number; dy: number; started: boolean } | null>(null)
  const [wireDraft, setWireDraft] = useState<Point[]>([])
  const [cursor, setCursor] = useState<Point | null>(null)

  const allPins = useMemo<PinTarget[]>(() => {
    const out: PinTarget[] = []
    for (const comp of Object.values(circuit.components)) {
      for (const pin of getDef(comp.type).pins) {
        out.push({
          componentId: comp.id,
          pinName: pin.name,
          position: pinWorldPosition(comp.position, comp.rotation, pin.offset),
        })
      }
    }
    return out
  }, [circuit.components])

  /** Nearest pin within snap radius (screen px) of a world point. */
  const findPinNear = useCallback(
    (world: Point): PinTarget | null => {
      const rWorld = PIN_SNAP_RADIUS / viewport.zoom
      let best: PinTarget | null = null
      let bestDist = rWorld
      for (const pin of allPins) {
        const d = Math.hypot(pin.position.x - world.x, pin.position.y - world.y)
        if (d <= bestDist) {
          best = pin
          bestDist = d
        }
      }
      return best
    },
    [allPins, viewport.zoom],
  )

  const touchesExistingWire = useCallback(
    (p: Point): boolean => {
      for (const w of circuit.wires) {
        for (let i = 0; i < w.points.length - 1; i++) {
          if (distToOrthoSegment(p, w.points[i], w.points[i + 1]) < 0.5) return true
        }
      }
      return false
    },
    [circuit.wires],
  )

  /** Snap target for wire drawing / placement: pin first, then grid. */
  const snapTarget = useCallback(
    (world: Point): { point: Point; pin: PinTarget | null } => {
      const pin = findPinNear(world)
      if (pin) return { point: pin.position, pin }
      return { point: snapPoint(world), pin: null }
    },
    [findPinNear],
  )

  const finishWire = useCallback(
    (points: Point[]) => {
      if (points.length >= 2) addWire(points)
      setWireDraft([])
    },
    [addWire],
  )

  const handleWireClick = useCallback(
    (world: Point) => {
      const { point, pin } = snapTarget(world)
      if (wireDraft.length === 0) {
        setWireDraft([point])
        return
      }
      const last = wireDraft[wireDraft.length - 1]
      const extension = orthoRoute(last, point)
      if (extension.length === 0) return
      const next = [...wireDraft, ...extension]
      // Terminate when landing on a pin or an existing wire (T-junction).
      if (pin || touchesExistingWire(point)) finishWire(next)
      else setWireDraft(next)
    },
    [wireDraft, snapTarget, touchesExistingWire, finishWire],
  )

  // ── Pointer handlers ────────────────────────────────────────────────────────
  const onComponentPointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      if (tool.kind !== 'select' || e.button !== 0) return
      e.stopPropagation()
      onSelectionChange({ kind: 'component', id })
      const world = toWorld(e.clientX, e.clientY)
      const comp = circuit.components[id]
      dragRef.current = { kind: 'component', id, dx: world.x - comp.position.x, dy: world.y - comp.position.y, started: false }
      svgRef.current?.setPointerCapture(e.pointerId)
    },
    [tool.kind, circuit.components, toWorld, onSelectionChange],
  )

  const onProbePointerDown = useCallback(
    (e: React.PointerEvent, probe: Probe) => {
      if (tool.kind !== 'select' || e.button !== 0) return
      e.stopPropagation()
      onSelectionChange({ kind: 'probe', id: probe.id })
      const world = toWorld(e.clientX, e.clientY)
      dragRef.current = { kind: 'probe', id: probe.id, dx: world.x - probe.position.x, dy: world.y - probe.position.y, started: false }
      svgRef.current?.setPointerCapture(e.pointerId)
    },
    [tool.kind, toWorld, onSelectionChange],
  )

  const onWirePointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      if (tool.kind !== 'select' || e.button !== 0) return
      e.stopPropagation()
      onSelectionChange({ kind: 'wire', id })
    },
    [tool.kind, onSelectionChange],
  )

  const onBackgroundPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const world = toWorld(e.clientX, e.clientY)
      // Middle button always pans; right button cancels the active tool.
      if (e.button === 1 || (e.button === 0 && tool.kind === 'select')) {
        panRef.current = { startX: e.clientX, startY: e.clientY, vx: viewport.x, vy: viewport.y, moved: false }
        svgRef.current?.setPointerCapture(e.pointerId)
        return
      }
      if (e.button === 2) {
        if (wireDraft.length) setWireDraft([])
        else onToolChange(SELECT_TOOL)
        return
      }
      if (e.button !== 0) return
      if (tool.kind === 'place') {
        addComponent(tool.type, snapPoint(world))
        return
      }
      if (tool.kind === 'probe') {
        // Voltage probes snap to pins first (that's what you're aiming at);
        // current probes land on the grid over a component body.
        const point = tool.probe === 'voltage' ? snapTarget(world).point : snapPoint(world)
        addProbe(tool.probe, point)
        return
      }
      if (tool.kind === 'wire') {
        handleWireClick(world)
      }
    },
    [tool, toWorld, viewport, wireDraft.length, addComponent, addProbe, snapTarget, handleWireClick, onToolChange],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const world = toWorld(e.clientX, e.clientY)
      setCursor(world)
      if (panRef.current) {
        const p = panRef.current
        const dx = e.clientX - p.startX
        const dy = e.clientY - p.startY
        if (Math.abs(dx) + Math.abs(dy) > 2) p.moved = true
        updateViewport({ x: p.vx + dx, y: p.vy + dy, zoom: viewport.zoom })
        return
      }
      if (dragRef.current) {
        const d = dragRef.current
        if (!d.started) {
          beginGesture()
          d.started = true
        }
        const snapped = snapPoint({ x: world.x - d.dx, y: world.y - d.dy })
        if (d.kind === 'component') moveComponent(d.id, snapped)
        else moveProbe(d.id, snapped)
      }
    },
    [toWorld, updateViewport, viewport.zoom, moveComponent, moveProbe, beginGesture],
  )

  const onPointerUp = useCallback(() => {
    if (panRef.current && !panRef.current.moved) {
      // Click on empty background without dragging clears the selection.
      onSelectionChange(null)
    }
    panRef.current = null
    dragRef.current = null
  }, [onSelectionChange])

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (tool.kind !== 'wire' || wireDraft.length === 0) return
      const world = toWorld(e.clientX, e.clientY)
      const { point } = snapTarget(world)
      const last = wireDraft[wireDraft.length - 1]
      finishWire([...wireDraft, ...orthoRoute(last, point)])
    },
    [tool.kind, wireDraft, toWorld, snapTarget, finishWire],
  )

  // Non-passive wheel zoom toward the cursor (same approach as Jarvis canvas).
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      setViewport((vp) => {
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, vp.zoom * factor))
        const next = {
          x: mx - (mx - vp.x) * (zoom / vp.zoom),
          y: my - (my - vp.y) * (zoom / vp.zoom),
          zoom,
        }
        if (flushTimer.current) clearTimeout(flushTimer.current)
        flushTimer.current = setTimeout(() => setViewportStore(next), 300)
        return next
      })
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [setViewportStore])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      switch (e.key) {
        case 'Escape':
          if (wireDraft.length) setWireDraft([])
          else if (tool.kind !== 'select') onToolChange(SELECT_TOOL)
          else onSelectionChange(null)
          break
        case 'Enter':
          if (tool.kind === 'wire' && wireDraft.length >= 2) finishWire(wireDraft)
          break
        case 'w':
        case 'W':
          onToolChange(WIRE_TOOL)
          break
        case 'p':
        case 'P':
          onToolChange(VOLTAGE_PROBE_TOOL)
          break
        case 'r':
        case 'R':
          if (selection?.kind === 'component') rotateComponent(selection.id)
          break
        case 'Delete':
        case 'Backspace':
          if (selection?.kind === 'component') {
            removeComponent(selection.id)
            onSelectionChange(null)
          } else if (selection?.kind === 'wire') {
            removeWire(selection.id)
            onSelectionChange(null)
          } else if (selection?.kind === 'probe') {
            removeProbe(selection.id)
            onSelectionChange(null)
          }
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    tool.kind, wireDraft, selection, undo, redo, finishWire,
    onToolChange, onSelectionChange, rotateComponent, removeComponent, removeWire, removeProbe,
  ])

  // Leaving the wire tool always drops any in-progress draft (render-time reset).
  if (tool.kind !== 'wire' && wireDraft.length > 0) setWireDraft([])

  // ── Node highlight: selecting a wire lights up its whole electrical node ────
  const highlightNodeId = selection?.kind === 'wire' ? detection.nodeOfWire.get(selection.id) : undefined
  const highlightedWires = useMemo(() => {
    if (highlightNodeId === undefined) return new Set<string>()
    const ids = new Set<string>()
    for (const [wireId, nodeId] of detection.nodeOfWire) {
      if (nodeId === highlightNodeId) ids.add(wireId)
    }
    return ids
  }, [highlightNodeId, detection.nodeOfWire])
  const highlightedPins = useMemo(() => {
    if (highlightNodeId === undefined) return new Set<string>()
    const ids = new Set<string>()
    for (const [pinId, nodeId] of detection.nodeOfPin) {
      if (nodeId === highlightNodeId) ids.add(pinId)
    }
    return ids
  }, [highlightNodeId, detection.nodeOfPin])

  // ── Render helpers ──────────────────────────────────────────────────────────
  const worldLeft = -viewport.x / viewport.zoom
  const worldTop = -viewport.y / viewport.zoom
  const worldW = size.w / viewport.zoom
  const worldH = size.h / viewport.zoom
  const showGrid = viewport.zoom >= 0.45

  const snapped = cursor ? snapTarget(cursor) : null
  const wirePreview =
    tool.kind === 'wire' && wireDraft.length > 0 && snapped
      ? [...wireDraft, ...orthoRoute(wireDraft[wireDraft.length - 1], snapped.point)]
      : null

  const isEmpty = Object.keys(circuit.components).length === 0 && circuit.wires.length === 0
  const interactive = tool.kind === 'select'

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden', background: 'var(--color-bg)' }}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{
          display: 'block',
          cursor: tool.kind === 'select' ? 'default' : 'crosshair',
          userSelect: 'none',
          touchAction: 'none',
        }}
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <pattern
            id="sim-grid-dots"
            width={GRID * 2}
            height={GRID * 2}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={0} cy={0} r={0.7} fill="var(--color-border)" />
          </pattern>
        </defs>

        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
          {showGrid && (
            <rect
              x={worldLeft}
              y={worldTop}
              width={worldW}
              height={worldH}
              fill="url(#sim-grid-dots)"
              pointerEvents="none"
            />
          )}

          <g pointerEvents={interactive ? 'auto' : 'none'}>
            {circuit.wires.map((w) => (
              <WireView
                key={w.id}
                wire={w}
                selected={selection?.kind === 'wire' && selection.id === w.id}
                highlighted={highlightedWires.has(w.id)}
                onPointerDown={onWirePointerDown}
              />
            ))}

            {Object.values(circuit.components).map((c) => (
              <SchematicComponent
                key={c.id}
                component={c}
                selected={selection?.kind === 'component' && selection.id === c.id}
                highlightedPins={highlightedPins}
                showPins={tool.kind === 'wire'}
                onPointerDown={onComponentPointerDown}
              />
            ))}
          </g>

          {/* Junction dots — only where 3+ branches electrically meet */}
          {detection.junctions.map((p) => (
            <circle
              key={`${p.x},${p.y}`}
              cx={p.x}
              cy={p.y}
              r={2.8}
              fill="var(--color-text-secondary)"
              pointerEvents="none"
            />
          ))}

          {/* Probes — drawn above components so the tip is always visible */}
          <g pointerEvents={interactive ? 'auto' : 'none'}>
            {resolvedProbes.map((rp) => (
              <ProbeView
                key={rp.probe.id}
                resolved={rp}
                selected={selection?.kind === 'probe' && selection.id === rp.probe.id}
                dcVoltages={dcVoltages}
                dcCurrents={dcCurrents}
                onPointerDown={onProbePointerDown}
              />
            ))}
          </g>

          {/* DC operating-point voltage badges, one per electrical node */}
          {dcVoltages &&
            detection.nodes.map((node) => {
              if (node.id === 0 || node.points.length === 0) return null
              const v = dcVoltages[node.id]
              if (v === undefined) return null
              // Anchor at the node's topmost point so the badge floats above the conductor.
              const anchor = node.points.reduce((best, p) =>
                p.y < best.y || (p.y === best.y && p.x < best.x) ? p : best,
              )
              return (
                <text
                  key={`v${node.id}`}
                  x={anchor.x}
                  y={anchor.y - 8}
                  textAnchor="middle"
                  fontSize={10}
                  fontFamily="var(--font-family-mono, 'Geist Mono', monospace)"
                  fill="var(--color-accent)"
                  stroke="var(--color-bg)"
                  strokeWidth={3}
                  paintOrder="stroke"
                  pointerEvents="none"
                >
                  {formatEngNotation(v, 'V')}
                </text>
              )
            })}

          {/* Wire-in-progress preview */}
          {wirePreview && wirePreview.length >= 2 && (
            <path
              d={wirePreview.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={1.6}
              strokeDasharray="4 3"
              pointerEvents="none"
            />
          )}

          {/* Pin snap indicator while wiring */}
          {tool.kind === 'wire' && snapped?.pin && (
            <circle
              cx={snapped.point.x}
              cy={snapped.point.y}
              r={5}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={1.2}
              pointerEvents="none"
            />
          )}

          {/* Placement ghost */}
          {tool.kind === 'place' && snapped && (
            <g
              transform={`translate(${snapped.point.x} ${snapped.point.y})`}
              color="var(--color-accent)"
              opacity={0.5}
              pointerEvents="none"
            >
              {getDef(tool.type).symbol}
            </g>
          )}

          {/* Probe placement ghost */}
          {tool.kind === 'probe' && cursor && (
            <g opacity={0.5} pointerEvents="none">
              <ProbeGlyph
                position={tool.probe === 'voltage' && snapped ? snapped.point : snapPoint(cursor)}
                kind={tool.probe}
                color={tool.probe === 'voltage' ? 'var(--color-accent)' : 'var(--color-warning)'}
                dashed={false}
              />
            </g>
          )}
        </g>
      </svg>

      {isEmpty && <OhmaDormant />}
    </div>
  )
}

// ─── Probe rendering ──────────────────────────────────────────────────────────

/** Scope-probe glyph: tip dot, angled needle, round handle with V/A marking. */
function ProbeGlyph({
  position,
  kind,
  color,
  dashed,
}: {
  position: Point
  kind: 'voltage' | 'current'
  color: string
  dashed: boolean
}) {
  const { x, y } = position
  return (
    <g stroke={color} fill="none" strokeWidth={1.4} strokeLinecap="round">
      <circle cx={x} cy={y} r={2.6} fill={color} stroke="none" />
      <path d={`M ${x + 2} ${y - 2} L ${x + 12} ${y - 12}`} strokeDasharray={dashed ? '3 2' : undefined} />
      <circle cx={x + 16} cy={y - 16} r={5.5} fill="var(--color-surface)" />
      <text
        x={x + 16}
        y={y - 13.4}
        textAnchor="middle"
        stroke="none"
        fill={color}
        fontSize={7.5}
        fontFamily="var(--font-family-mono, 'Geist Mono', monospace)"
      >
        {kind === 'voltage' ? 'V' : 'A'}
      </text>
    </g>
  )
}

function ProbeView({
  resolved,
  selected,
  dcVoltages,
  dcCurrents,
  onPointerDown,
}: {
  resolved: ResolvedProbe
  selected: boolean
  dcVoltages?: Record<number, number> | null
  dcCurrents?: Record<string, number> | null
  onPointerDown: (e: React.PointerEvent, probe: Probe) => void
}) {
  const { probe, nodeId, component } = resolved
  const attached = probe.kind === 'voltage' ? nodeId !== null : component !== null
  const baseColor = probe.kind === 'voltage' ? 'var(--color-accent)' : 'var(--color-warning)'
  const color = attached ? baseColor : 'var(--color-text-muted)'
  const { x, y } = probe.position

  // Fresh DC numbers turn the label into a live readout.
  let reading: string | null = null
  if (attached && probe.kind === 'voltage' && dcVoltages && nodeId !== null && dcVoltages[nodeId] !== undefined) {
    reading = formatEngNotation(dcVoltages[nodeId], 'V')
  }
  if (attached && probe.kind === 'current' && dcCurrents && component) {
    const i = dcCurrents[currentKeyFor(component)]
    if (i !== undefined) reading = formatEngNotation(i, 'A')
  }

  return (
    <g onPointerDown={(e) => onPointerDown(e, probe)} style={{ cursor: 'move' }} data-probe-id={probe.id}>
      {/* Hit area around the whole glyph */}
      <rect x={x - 6} y={y - 26} width={32} height={32} fill="transparent" stroke="none" />
      {selected && (
        <rect
          x={x - 8}
          y={y - 28}
          width={36}
          height={36}
          rx={3}
          fill="none"
          stroke="var(--color-accent)"
          strokeOpacity={0.45}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}
      <ProbeGlyph position={probe.position} kind={probe.kind} color={color} dashed={!attached} />
      <text
        x={x + 25}
        y={y - 18}
        fontSize={10}
        fontFamily="var(--font-family-mono, 'Geist Mono', monospace)"
        fill={color}
        stroke="var(--color-bg)"
        strokeWidth={3}
        paintOrder="stroke"
        style={{ userSelect: 'none' }}
      >
        {probe.label}
        {reading ? ` ${reading}` : attached ? '' : ' ⌀'}
      </text>
    </g>
  )
}
