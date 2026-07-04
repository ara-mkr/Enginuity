// Probe resolution against union-find detection, and the store-level
// guarantee that probes are instrumentation: placing/moving one never
// invalidates (stales) an existing solve.

import { describe, expect, it } from 'vitest'
import { buildNetlist } from '../core/netlist'
import { currentKeyFor, resolveProbes } from '../core/probes'
import { useSimulationStore } from '../store/circuitStore'
import type { Probe } from '../types'
import { asRecord, makeComponent, makeWire } from './helpers'

let probeCounter = 0
function makeProbe(kind: Probe['kind'], x: number, y: number, label?: string): Probe {
  probeCounter++
  return { id: `probe-${probeCounter}`, kind, position: { x, y }, label: label ?? `${kind === 'voltage' ? 'VP' : 'IP'}${probeCounter}` }
}

/** V1 5V → R1 → R2 → GND divider (same geometry as runAnalysis tests). */
function divider() {
  const V1 = makeComponent('vsource-dc', 'V1', { x: 0, y: 0 }, 0, { voltage: 5 })
  const R1 = makeComponent('resistor', 'R1', { x: 100, y: -60 }, 0, { resistance: 4700 })
  const R2 = makeComponent('resistor', 'R2', { x: 100, y: 0 }, 90, { resistance: 4700 })
  const GND = makeComponent('ground', 'GND', { x: 0, y: 30 })
  const wires = [
    makeWire([{ x: 0, y: -30 }, { x: 0, y: -60 }, { x: 70, y: -60 }]),
    makeWire([{ x: 130, y: -60 }, { x: 130, y: -30 }, { x: 100, y: -30 }]),
    makeWire([{ x: 100, y: 30 }, { x: 0, y: 30 }]),
  ]
  return { components: asRecord([V1, R1, R2, GND]), wires }
}

describe('resolveProbes', () => {
  it('binds a voltage probe to the node under a pin, mid-wire point, or vertex', () => {
    const circuit = divider()
    const probes = [
      makeProbe('voltage', 100, -30), // R2 top pin / wire end
      makeProbe('voltage', 30, -60), // interior of the V+ rail wire
      makeProbe('voltage', 50, 30), // interior of the ground return wire
    ]
    const detection = buildNetlist(circuit).detection
    const [atPin, midWire, onGroundRun] = resolveProbes({ ...circuit, probes }, detection)

    expect(atPin.nodeId).not.toBeNull()
    expect(midWire.nodeId).not.toBeNull()
    // The pin probe sits on the R1–R2 midpoint node; the mid-wire probe on the source rail.
    expect(atPin.nodeId).not.toBe(midWire.nodeId)
    expect(onGroundRun.nodeId).toBe(0)
  })

  it('reports a dangling voltage probe as unbound instead of guessing', () => {
    const circuit = divider()
    const probes = [makeProbe('voltage', 400, 400)]
    const detection = buildNetlist(circuit).detection
    const [dangling] = resolveProbes({ ...circuit, probes }, detection)
    expect(dangling.nodeId).toBeNull()
  })

  it('binds a current probe to the component body it was dropped on', () => {
    const circuit = divider()
    const probes = [
      makeProbe('current', 100, -60), // R1 body center
      makeProbe('current', 0, 0), // V1 body center
      makeProbe('current', 400, 400), // nothing
    ]
    const detection = buildNetlist(circuit).detection
    const [onR1, onV1, dangling] = resolveProbes({ ...circuit, probes }, detection)
    expect(onR1.component?.refdes).toBe('R1')
    expect(onV1.component?.refdes).toBe('V1')
    expect(dangling.component).toBeNull()
  })

  it('never binds a current probe to a ground symbol', () => {
    const circuit = divider()
    const probes = [makeProbe('current', 0, 30)] // exactly on the GND symbol
    const detection = buildNetlist(circuit).detection
    const [probe] = resolveProbes({ ...circuit, probes }, detection)
    expect(probe.component?.type ?? null).not.toBe('ground')
  })

  it('reads BJT collector current under the split-current key', () => {
    const q = makeComponent('bjt-npn', 'Q1', { x: 0, y: 0 })
    const r = makeComponent('resistor', 'R1', { x: 100, y: 0 })
    expect(currentKeyFor(q)).toBe('Q1 Ic')
    expect(currentKeyFor(r)).toBe('R1')
  })
})

describe('circuitStore — probes are instrumentation', () => {
  it('addProbe/moveProbe/removeProbe never bump updatedAt (results stay fresh)', () => {
    const store = useSimulationStore.getState()
    const circuitId = store.createCircuit('probe-staleness')
    useSimulationStore.getState().addComponent('resistor', { x: 0, y: 0 })

    const before = useSimulationStore.getState().circuits[circuitId].updatedAt

    const probeId = useSimulationStore.getState().addProbe('voltage', { x: 0, y: 0 })
    useSimulationStore.getState().moveProbe(probeId, { x: 10, y: 10 })
    useSimulationStore.getState().removeProbe(probeId)

    expect(useSimulationStore.getState().circuits[circuitId].updatedAt).toBe(before)
    useSimulationStore.getState().deleteCircuit(circuitId)
  })

  it('probe placement participates in undo history', () => {
    const store = useSimulationStore.getState()
    const circuitId = store.createCircuit('probe-undo')

    useSimulationStore.getState().addProbe('voltage', { x: 0, y: 0 })
    expect(useSimulationStore.getState().circuits[circuitId].probes.length).toBe(1)

    useSimulationStore.getState().undo()
    expect(useSimulationStore.getState().circuits[circuitId].probes.length).toBe(0)

    useSimulationStore.getState().redo()
    expect(useSimulationStore.getState().circuits[circuitId].probes.length).toBe(1)
    useSimulationStore.getState().deleteCircuit(circuitId)
  })

  it('labels probes VP1, VP2… / IP1… independently per kind', () => {
    const store = useSimulationStore.getState()
    const circuitId = store.createCircuit('probe-labels')

    useSimulationStore.getState().addProbe('voltage', { x: 0, y: 0 })
    useSimulationStore.getState().addProbe('voltage', { x: 10, y: 0 })
    useSimulationStore.getState().addProbe('current', { x: 20, y: 0 })

    const labels = useSimulationStore.getState().circuits[circuitId].probes.map((p) => p.label)
    expect(labels).toEqual(['VP1', 'VP2', 'IP1'])
    useSimulationStore.getState().deleteCircuit(circuitId)
  })
})
