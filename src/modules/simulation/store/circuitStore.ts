// Persistent store for the Simulation Tab, following the same
// zustand + persist + hybridStorage pattern as engine/persistenceEngine.js
// (see the createJSONStorage note there — hybridStorage speaks the plain
// string contract, so it must be wrapped). Circuits are keyed by id; undo
// history is deliberately kept out of the persisted slice, and heavy waveform
// buffers will go straight to IndexedDB keyed by runId in later phases.

import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { hybridStorage } from '../../../utils/electronBridge'

// hybridStorage mixes sync/async signatures; adapt it to zustand's contract.
const storage: StateStorage = {
  getItem: (name) => hybridStorage.getItem(name),
  setItem: (name, value) => hybridStorage.setItem(name, value),
  removeItem: (name) => hybridStorage.removeItem(name),
}
import type {
  AnalysisMode,
  Circuit,
  ComponentInstance,
  Point,
  Probe,
  Rotation,
  SchematicComponentType,
  SimulationSettings,
  Viewport,
  Wire,
} from '../types'
import { defaultSimulationSettings } from '../types'
import { getDef } from '../componentDefs'
import { normalizePolyline } from '../core/geometry'

interface Snapshot {
  components: Record<string, ComponentInstance>
  wires: Wire[]
  probes: Probe[]
}

interface HistoryStack {
  past: Snapshot[]
  future: Snapshot[]
}

const HISTORY_LIMIT = 100

function takeSnapshot(c: Circuit): Snapshot {
  return {
    components: structuredClone(c.components),
    wires: structuredClone(c.wires),
    probes: structuredClone(c.probes),
  }
}

function newCircuit(name: string): Circuit {
  return {
    id: crypto.randomUUID(),
    name,
    components: {},
    wires: [],
    probes: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    simulationSettings: defaultSimulationSettings(),
    lastRunId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function nextRefdes(components: Record<string, ComponentInstance>, type: SchematicComponentType): string {
  const prefix = getDef(type).refdesPrefix
  if (type === 'ground') return 'GND'
  let max = 0
  for (const c of Object.values(components)) {
    if (!c.refdes.startsWith(prefix)) continue
    const n = parseInt(c.refdes.slice(prefix.length), 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  return `${prefix}${max + 1}`
}

export interface SimulationStoreState {
  circuits: Record<string, Circuit>
  activeCircuitId: string | null
  /** Per-circuit undo/redo stacks. Session-only — excluded from persistence. */
  history: Record<string, HistoryStack>

  ensureCircuit: () => string
  createCircuit: (name?: string) => string
  deleteCircuit: (id: string) => void
  renameCircuit: (id: string, name: string) => void
  setActiveCircuit: (id: string) => void

  /** Push an undo snapshot before a mutation gesture (drag start, param edit…). */
  beginGesture: () => void
  undo: () => void
  redo: () => void

  addComponent: (type: SchematicComponentType, position: Point) => string
  moveComponent: (id: string, position: Point) => void
  rotateComponent: (id: string) => void
  setComponentParam: (id: string, key: string, value: number) => void
  removeComponent: (id: string) => void

  addWire: (points: Point[]) => void
  removeWire: (id: string) => void

  setViewport: (viewport: Viewport) => void
  setAnalysisMode: (mode: AnalysisMode) => void
  updateSimulationSettings: (patch: Partial<SimulationSettings>) => void
}

function mutateActive(
  state: SimulationStoreState,
  fn: (c: Circuit) => void,
): Partial<SimulationStoreState> {
  const id = state.activeCircuitId
  if (!id || !state.circuits[id]) return {}
  const circuit = structuredClone(state.circuits[id])
  fn(circuit)
  circuit.updatedAt = Date.now()
  return { circuits: { ...state.circuits, [id]: circuit } }
}

export const useSimulationStore = create<SimulationStoreState>()(
  persist(
    (set, get) => ({
      circuits: {},
      activeCircuitId: null,
      history: {},

      ensureCircuit: () => {
        const state = get()
        if (state.activeCircuitId && state.circuits[state.activeCircuitId]) {
          return state.activeCircuitId
        }
        const existing = Object.values(state.circuits).sort((a, b) => b.updatedAt - a.updatedAt)[0]
        if (existing) {
          set({ activeCircuitId: existing.id })
          return existing.id
        }
        return get().createCircuit()
      },

      createCircuit: (name) => {
        const count = Object.keys(get().circuits).length
        const circuit = newCircuit(name || `Circuit ${count + 1}`)
        set((s) => ({
          circuits: { ...s.circuits, [circuit.id]: circuit },
          activeCircuitId: circuit.id,
        }))
        return circuit.id
      },

      deleteCircuit: (id) =>
        set((s) => {
          const circuits = { ...s.circuits }
          delete circuits[id]
          const history = { ...s.history }
          delete history[id]
          const activeCircuitId =
            s.activeCircuitId === id
              ? Object.values(circuits).sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null
              : s.activeCircuitId
          return { circuits, history, activeCircuitId }
        }),

      renameCircuit: (id, name) =>
        set((s) => {
          const c = s.circuits[id]
          if (!c) return {}
          return { circuits: { ...s.circuits, [id]: { ...c, name, updatedAt: Date.now() } } }
        }),

      setActiveCircuit: (id) => set((s) => (s.circuits[id] ? { activeCircuitId: id } : {})),

      beginGesture: () =>
        set((s) => {
          const id = s.activeCircuitId
          if (!id || !s.circuits[id]) return {}
          const stack = s.history[id] ?? { past: [], future: [] }
          return {
            history: {
              ...s.history,
              [id]: {
                past: [...stack.past, takeSnapshot(s.circuits[id])].slice(-HISTORY_LIMIT),
                future: [],
              },
            },
          }
        }),

      undo: () =>
        set((s) => {
          const id = s.activeCircuitId
          if (!id || !s.circuits[id]) return {}
          const stack = s.history[id]
          if (!stack || stack.past.length === 0) return {}
          const previous = stack.past[stack.past.length - 1]
          const current = takeSnapshot(s.circuits[id])
          return {
            circuits: {
              ...s.circuits,
              [id]: { ...s.circuits[id], ...structuredClone(previous), updatedAt: Date.now() },
            },
            history: {
              ...s.history,
              [id]: {
                past: stack.past.slice(0, -1),
                future: [...stack.future, current].slice(-HISTORY_LIMIT),
              },
            },
          }
        }),

      redo: () =>
        set((s) => {
          const id = s.activeCircuitId
          if (!id || !s.circuits[id]) return {}
          const stack = s.history[id]
          if (!stack || stack.future.length === 0) return {}
          const next = stack.future[stack.future.length - 1]
          const current = takeSnapshot(s.circuits[id])
          return {
            circuits: {
              ...s.circuits,
              [id]: { ...s.circuits[id], ...structuredClone(next), updatedAt: Date.now() },
            },
            history: {
              ...s.history,
              [id]: {
                past: [...stack.past, current].slice(-HISTORY_LIMIT),
                future: stack.future.slice(0, -1),
              },
            },
          }
        }),

      addComponent: (type, position) => {
        get().beginGesture()
        const id = crypto.randomUUID()
        set((s) =>
          mutateActive(s, (c) => {
            const def = getDef(type)
            const params: Record<string, number> = {}
            for (const p of def.params) params[p.key] = p.defaultValue
            c.components[id] = {
              id,
              type,
              refdes: nextRefdes(c.components, type),
              position,
              rotation: 0,
              params,
            }
          }),
        )
        return id
      },

      // No history push — the canvas calls beginGesture() once at drag start.
      // Shallow-copied (not via mutateActive) because it fires per mousemove.
      moveComponent: (id, position) =>
        set((s) => {
          const cid = s.activeCircuitId
          const circuit = cid ? s.circuits[cid] : null
          const comp = circuit?.components[id]
          if (!circuit || !comp) return {}
          return {
            circuits: {
              ...s.circuits,
              [cid!]: {
                ...circuit,
                components: { ...circuit.components, [id]: { ...comp, position } },
                updatedAt: Date.now(),
              },
            },
          }
        }),

      rotateComponent: (id) => {
        get().beginGesture()
        set((s) =>
          mutateActive(s, (c) => {
            const comp = c.components[id]
            if (comp) comp.rotation = (((comp.rotation + 90) % 360) as Rotation)
          }),
        )
      },

      setComponentParam: (id, key, value) => {
        get().beginGesture()
        set((s) =>
          mutateActive(s, (c) => {
            const comp = c.components[id]
            if (comp) comp.params[key] = value
          }),
        )
      },

      removeComponent: (id) => {
        get().beginGesture()
        set((s) =>
          mutateActive(s, (c) => {
            delete c.components[id]
          }),
        )
      },

      addWire: (points) => {
        const normalized = normalizePolyline(points)
        if (normalized.length < 2) return
        get().beginGesture()
        set((s) =>
          mutateActive(s, (c) => {
            c.wires.push({ id: crypto.randomUUID(), points: normalized })
          }),
        )
      },

      removeWire: (id) => {
        get().beginGesture()
        set((s) =>
          mutateActive(s, (c) => {
            c.wires = c.wires.filter((w) => w.id !== id)
          }),
        )
      },

      // Shallow-copied — fires on every pan/zoom event.
      setViewport: (viewport) =>
        set((s) => {
          const cid = s.activeCircuitId
          const circuit = cid ? s.circuits[cid] : null
          if (!circuit) return {}
          return { circuits: { ...s.circuits, [cid!]: { ...circuit, viewport } } }
        }),

      setAnalysisMode: (mode) =>
        set((s) =>
          mutateActive(s, (c) => {
            c.simulationSettings.mode = mode
          }),
        ),

      updateSimulationSettings: (patch) =>
        set((s) =>
          mutateActive(s, (c) => {
            c.simulationSettings = { ...c.simulationSettings, ...patch }
          }),
        ),
    }),
    {
      name: 'enginguity-simulation',
      version: 1,
      storage: createJSONStorage(() => storage),
      // History stacks are session-only; everything else in a circuit is light
      // (components/wires/viewport). Waveform buffers never enter this store.
      partialize: (state) => ({
        circuits: state.circuits,
        activeCircuitId: state.activeCircuitId,
      }),
    },
  ),
)
