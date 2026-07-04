// Translates the schematic into the solver engine's flat netlist format and a
// human-readable SPICE-style listing, surfacing topology problems as typed
// issues instead of letting a broken circuit reach the matrix builder.

import type { Netlist as EngineNetlist, Component as EngineComponent } from '../../circuit-sim/engine/types'
import type { Circuit, ComponentInstance } from '../types'
import { getDef } from '../componentDefs'
import { formatEngNotation } from './engNotation'
import { detectNodes, type NodeDetectionResult } from './nodeDetection'
import { UnionFind } from './unionFind'

export interface NetlistIssue {
  severity: 'error' | 'warning'
  message: string
  componentId?: string
}

export interface NetlistBuild {
  /** Null when errors make the circuit unsolvable. */
  engineNetlist: EngineNetlist | null
  /** SPICE-style text lines for the Netlist Preview panel. */
  lines: string[]
  issues: NetlistIssue[]
  detection: NodeDetectionResult
}

/** Maps a schematic component to engine netlist entries. Ground maps to none. */
function toEngineComponent(
  comp: ComponentInstance,
  nodeOfPin: Map<string, number>,
): EngineComponent | null {
  const node = (pin: string) => nodeOfPin.get(`${comp.id}:${pin}`) ?? -1
  switch (comp.type) {
    case 'resistor':
      return { id: comp.refdes, type: 'resistor', nodes: [node('a'), node('b')], value: comp.params.resistance }
    case 'capacitor':
      return { id: comp.refdes, type: 'capacitor', nodes: [node('a'), node('b')], value: comp.params.capacitance }
    case 'capacitor-polarized':
      return { id: comp.refdes, type: 'capacitor', nodes: [node('pos'), node('neg')], value: comp.params.capacitance }
    case 'inductor':
      return { id: comp.refdes, type: 'inductor', nodes: [node('a'), node('b')], value: comp.params.inductance }
    case 'vsource-dc':
      return { id: comp.refdes, type: 'vsource', nodes: [node('pos'), node('neg')], value: comp.params.voltage }
    case 'vsource-ac':
      // DC operating point sees the source at its DC offset; the waveform
      // drives transient steps and marks the source as the AC stimulus.
      return {
        id: comp.refdes,
        type: 'vsource',
        nodes: [node('pos'), node('neg')],
        value: comp.params.offset ?? 0,
        waveform: {
          kind: 'sine',
          amplitude: comp.params.amplitude ?? 0,
          frequency: comp.params.frequency ?? 0,
          phaseDeg: comp.params.phase ?? 0,
          offset: comp.params.offset ?? 0,
        },
      }
    case 'vsource-pulse':
      // The DC operating point sees the pulse at its t=0 level (V1).
      return {
        id: comp.refdes,
        type: 'vsource',
        nodes: [node('pos'), node('neg')],
        value: comp.params.v1 ?? 0,
        waveform: {
          kind: 'pulse',
          v1: comp.params.v1 ?? 0,
          v2: comp.params.v2 ?? 0,
          delay: comp.params.delay ?? 0,
          rise: comp.params.rise ?? 0,
          fall: comp.params.fall ?? 0,
          width: comp.params.width ?? 0,
          period: comp.params.period ?? 0,
        },
      }
    case 'isource-dc':
      return { id: comp.refdes, type: 'isource', nodes: [node('pos'), node('neg')], value: comp.params.current }
    case 'ground':
      return null
  }
}

function spiceLine(comp: ComponentInstance, nodeOfPin: Map<string, number>): string | null {
  const def = getDef(comp.type)
  if (comp.type === 'ground') return null
  const nodeNames = def.pins
    .map((p) => nodeOfPin.get(`${comp.id}:${p.name}`))
    .map((n) => (n === undefined ? '?' : String(n)))
  const params = def.params
    .map((p) => `${formatEngNotation(comp.params[p.key] ?? p.defaultValue)}${p.unit === '°' ? '°' : p.unit}`)
    .join(' ')
  return `${comp.refdes} ${nodeNames.join(' ')} ${params}`.trim()
}

export function buildNetlist(circuit: Pick<Circuit, 'components' | 'wires'>): NetlistBuild {
  const detection = detectNodes(circuit)
  const issues: NetlistIssue[] = []
  const components = Object.values(circuit.components)
  const nonGround = components.filter((c) => c.type !== 'ground')

  // Floating pins — flag exactly which pin.
  for (const pin of detection.floatingPins) {
    issues.push({
      severity: 'error',
      componentId: pin.componentId,
      message: `${pin.refdes} pin '${pin.pinName}' is not connected to anything.`,
    })
  }

  // Ground reference.
  if (!detection.hasGround && components.length > 0) {
    issues.push({
      severity: 'error',
      message: 'No ground reference — add a Ground symbol so the solver has a 0V node.',
    })
  }

  // Invalid parameter values that slipped past the Inspector (e.g. imported data).
  for (const comp of nonGround) {
    const def = getDef(comp.type)
    for (const p of def.params) {
      const v = comp.params[p.key]
      if (v === undefined || Number.isNaN(v)) {
        issues.push({ severity: 'error', componentId: comp.id, message: `${comp.refdes}: ${p.label} is missing.` })
      } else if (p.min !== undefined && v < p.min) {
        issues.push({
          severity: 'error',
          componentId: comp.id,
          message: `${comp.refdes}: ${p.label} cannot be negative.`,
        })
      } else if (p.zeroInvalid && v === 0) {
        issues.push({
          severity: 'error',
          componentId: comp.id,
          message: `${comp.refdes}: ${p.label} of 0 is not physical — use a small nonzero value.`,
        })
      }
    }
  }

  // Disconnected islands with no path to ground. Components sharing any
  // electrical node are one island; ground symbols pull their island to node 0.
  if (detection.hasGround && nonGround.length > 0) {
    const islandUF = new UnionFind()
    const compOfNode = new Map<number, string>()
    for (const comp of components) {
      islandUF.add(comp.id)
      const def = getDef(comp.type)
      for (const pin of def.pins) {
        const nodeId = detection.nodeOfPin.get(`${comp.id}:${pin.name}`)
        if (nodeId === undefined) continue
        const seen = compOfNode.get(nodeId)
        if (seen) islandUF.union(seen, comp.id)
        else compOfNode.set(nodeId, comp.id)
      }
    }
    const groundedRoots = new Set(
      components.filter((c) => c.type === 'ground').map((c) => islandUF.find(c.id)),
    )
    const strandedByRoot = new Map<string, string[]>()
    for (const comp of nonGround) {
      const root = islandUF.find(comp.id)
      if (!groundedRoots.has(root)) {
        const list = strandedByRoot.get(root)
        if (list) list.push(comp.refdes)
        else strandedByRoot.set(root, [comp.refdes])
      }
    }
    for (const refs of strandedByRoot.values()) {
      issues.push({
        severity: 'error',
        message: `Disconnected subcircuit (${refs.join(', ')}) has no path to ground — give it its own reference.`,
      })
    }
  }

  // Dangling nodes: a node touched by exactly one component terminal can't
  // carry current; warn (it will make the DC matrix singular for most devices).
  for (const node of detection.nodes) {
    if (node.id !== 0 && node.pins.length === 1 && node.wireIds.length > 0) {
      const pin = node.pins[0]
      issues.push({
        severity: 'warning',
        componentId: pin.componentId,
        message: `Node N${node.id} only reaches ${pin.refdes} pin '${pin.pinName}' — wire dead-ends.`,
      })
    }
  }

  const lines = nonGround
    .slice()
    .sort((a, b) => a.refdes.localeCompare(b.refdes, undefined, { numeric: true }))
    .map((c) => spiceLine(c, detection.nodeOfPin))
    .filter((l): l is string => l !== null)

  const blocked = issues.some((i) => i.severity === 'error') || nonGround.length === 0
  const engineNetlist: EngineNetlist | null = blocked
    ? null
    : {
        components: nonGround
          .map((c) => toEngineComponent(c, detection.nodeOfPin))
          .filter((c): c is EngineComponent => c !== null),
      }

  return { engineNetlist, lines, issues, detection }
}
