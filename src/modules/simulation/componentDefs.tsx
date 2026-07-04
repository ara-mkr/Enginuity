// Registry of every schematic component the editor can place: pin geometry,
// editable parameters (with validation), refdes prefixes, and the SVG symbol.
// Symbols draw in a local frame centered on the component origin with pins on
// grid multiples; stroke color comes from the parent via currentColor so
// selection/theme states are handled by the renderer, not here.

import type { ReactNode } from 'react'
import type { Point, SchematicComponentType } from './types'

export interface PinDef {
  /** Stable pin name used in netlists and node maps ('a'/'b', 'pos'/'neg'). */
  name: string
  /** Local offset from the component origin, grid-aligned. */
  offset: Point
}

export interface ParamDef {
  key: string
  label: string
  unit: string
  defaultValue: number
  /** Inclusive minimum; values below it are rejected by the Inspector. */
  min?: number
  /** True when exactly zero is invalid even if min is 0 (0F cap, 0H inductor). */
  zeroInvalid?: boolean
}

export interface ComponentDef {
  type: SchematicComponentType
  label: string
  category: 'Passive' | 'Active' | 'Sources' | 'Reference'
  refdesPrefix: string
  pins: PinDef[]
  params: ParamDef[]
  /** Rough symbol extents in local units, for hit-testing and selection box. */
  bounds: { w: number; h: number }
  symbol: ReactNode
  /** Search keywords for the palette. */
  keywords: string[]
}

const STROKE = 1.6

// ─── Symbol fragments ─────────────────────────────────────────────────────────

const ResistorSymbol = (
  <g fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
    <path d="M -30 0 H -18" />
    <path d="M -18 0 L -14 -7 L -6 7 L 2 -7 L 10 7 L 14 -3.5 L 18 0" />
    <path d="M 18 0 H 30" />
  </g>
)

const CapacitorSymbol = (
  <g fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round">
    <path d="M -30 0 H -4" />
    <path d="M -4 -10 V 10" />
    <path d="M 4 -10 V 10" />
    <path d="M 4 0 H 30" />
  </g>
)

const CapacitorPolarizedSymbol = (
  <g fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round">
    <path d="M -30 0 H -4" />
    <path d="M -4 -10 V 10" />
    <path d="M 8 -10 A 14 14 0 0 0 8 10" />
    <path d="M 6 0 H 30" />
    {/* plus marker beside the positive (left) plate */}
    <path d="M -14 -12 v 6 M -17 -9 h 6" strokeWidth={1.2} />
  </g>
)

const InductorSymbol = (
  <g fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round">
    <path d="M -30 0 H -20" />
    <path d="M -20 0 A 5 6 0 0 1 -10 0 A 5 6 0 0 1 0 0 A 5 6 0 0 1 10 0 A 5 6 0 0 1 20 0" />
    <path d="M 20 0 H 30" />
  </g>
)

const VSourceDCSymbol = (
  <g fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round">
    <path d="M 0 -30 V -16" />
    <circle cx="0" cy="0" r="16" />
    <path d="M 0 -10 v 8 M -4 -6 h 8" strokeWidth={1.3} />
    <path d="M -4 7 h 8" strokeWidth={1.3} />
    <path d="M 0 16 V 30" />
  </g>
)

const VSourceACSymbol = (
  <g fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round">
    <path d="M 0 -30 V -16" />
    <circle cx="0" cy="0" r="16" />
    <path d="M -8 0 Q -4 -8 0 0 T 8 0" strokeWidth={1.3} />
    <path d="M 0 16 V 30" />
  </g>
)

const VSourcePulseSymbol = (
  <g fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
    <path d="M 0 -30 V -16" />
    <circle cx="0" cy="0" r="16" />
    <path d="M -9 5 h 4 v -10 h 5 v 10 h 5 v -10 h 4" strokeWidth={1.3} />
    <path d="M 0 16 V 30" />
  </g>
)

const ISourceDCSymbol = (
  <g fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
    <path d="M 0 -30 V -16" />
    <circle cx="0" cy="0" r="16" />
    <path d="M 0 9 V -9 M -4 -4 L 0 -9 L 4 -4" strokeWidth={1.3} />
    <path d="M 0 16 V 30" />
  </g>
)

const DiodeSymbol = (
  <g fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
    <path d="M -30 0 H -8" />
    <path d="M -8 -8 L 8 0 L -8 8 Z" />
    <path d="M 8 -8 V 8" />
    <path d="M 8 0 H 30" />
  </g>
)

const BJTNPNSymbol = (
  <g fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
    <path d="M -30 0 H -6" />
    <path d="M -6 -14 V 14" />
    <path d="M -6 -5 L 20 -16 V -30" />
    <path d="M -6 5 L 20 16 V 30" />
    {/* emitter arrow pointing outward = NPN */}
    <polygon points="16.7,14.6 9.3,14.2 11.3,9.6" fill="currentColor" stroke="none" />
  </g>
)

const MOSFETNMOSSymbol = (
  <g fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
    <path d="M -30 0 H -10" />
    <path d="M -10 -10 V 10" />
    <path d="M -4 -14 V 14" />
    <path d="M -4 -10 H 20 V -30" />
    <path d="M -4 10 H 20 V 30" />
    {/* source arrow pointing into the channel = N-channel */}
    <polygon points="0,10 7,6.6 7,13.4" fill="currentColor" stroke="none" />
  </g>
)

const OpAmpSymbol = (
  <g fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
    <path d="M -30 -10 H -16" />
    <path d="M -30 10 H -16" />
    <path d="M -16 -20 V 20 L 20 0 Z" />
    <path d="M 20 0 H 30" />
    {/* + on the top input, − on the bottom */}
    <path d="M -11 -13 v 6 M -14 -10 h 6" strokeWidth={1.2} />
    <path d="M -14 10 h 6" strokeWidth={1.2} />
  </g>
)

const Timer555Symbol = (
  <g fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
    <rect x={-30} y={-40} width={60} height={80} rx={4} />
    {/* pin stubs — top V+, bottom GND, left TR/DIS/TH, right OUT */}
    <path d="M 0 -40 V -50" />
    <path d="M 0 40 V 50" />
    <path d="M -30 -20 H -40" />
    <path d="M -30 0 H -40" />
    <path d="M -30 20 H -40" />
    <path d="M 30 0 H 40" />
    <text x={0} y={5} textAnchor="middle" fontSize={13} fill="currentColor" stroke="none">
      555
    </text>
    {/* pin labels */}
    <g fontSize={7} fill="currentColor" stroke="none">
      <text x={-27} y={-16} textAnchor="start">TR</text>
      <text x={-27} y={3} textAnchor="start">DIS</text>
      <text x={-27} y={23} textAnchor="start">TH</text>
      <text x={27} y={3} textAnchor="end">OUT</text>
      <text x={0} y={-31} textAnchor="middle">V+</text>
      <text x={0} y={35} textAnchor="middle">GND</text>
    </g>
  </g>
)

const GroundSymbol = (
  <g fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round">
    <path d="M 0 0 V 10" />
    <path d="M -12 10 H 12" />
    <path d="M -7 15 H 7" />
    <path d="M -2 20 H 2" />
  </g>
)

// ─── Registry ─────────────────────────────────────────────────────────────────

export const COMPONENT_DEFS: Record<SchematicComponentType, ComponentDef> = {
  resistor: {
    type: 'resistor',
    label: 'Resistor',
    category: 'Passive',
    refdesPrefix: 'R',
    pins: [
      { name: 'a', offset: { x: -30, y: 0 } },
      { name: 'b', offset: { x: 30, y: 0 } },
    ],
    params: [{ key: 'resistance', label: 'Resistance', unit: 'Ω', defaultValue: 1000, min: 0 }],
    bounds: { w: 60, h: 20 },
    symbol: ResistorSymbol,
    keywords: ['resistor', 'r', 'ohm'],
  },
  capacitor: {
    type: 'capacitor',
    label: 'Capacitor',
    category: 'Passive',
    refdesPrefix: 'C',
    pins: [
      { name: 'a', offset: { x: -30, y: 0 } },
      { name: 'b', offset: { x: 30, y: 0 } },
    ],
    params: [{ key: 'capacitance', label: 'Capacitance', unit: 'F', defaultValue: 1e-6, min: 0, zeroInvalid: true }],
    bounds: { w: 60, h: 24 },
    symbol: CapacitorSymbol,
    keywords: ['capacitor', 'cap', 'c', 'farad'],
  },
  'capacitor-polarized': {
    type: 'capacitor-polarized',
    label: 'Capacitor (polarized)',
    category: 'Passive',
    refdesPrefix: 'C',
    pins: [
      { name: 'pos', offset: { x: -30, y: 0 } },
      { name: 'neg', offset: { x: 30, y: 0 } },
    ],
    params: [{ key: 'capacitance', label: 'Capacitance', unit: 'F', defaultValue: 10e-6, min: 0, zeroInvalid: true }],
    bounds: { w: 60, h: 28 },
    symbol: CapacitorPolarizedSymbol,
    keywords: ['capacitor', 'electrolytic', 'polarized', 'cap'],
  },
  inductor: {
    type: 'inductor',
    label: 'Inductor',
    category: 'Passive',
    refdesPrefix: 'L',
    pins: [
      { name: 'a', offset: { x: -30, y: 0 } },
      { name: 'b', offset: { x: 30, y: 0 } },
    ],
    params: [{ key: 'inductance', label: 'Inductance', unit: 'H', defaultValue: 1e-3, min: 0, zeroInvalid: true }],
    bounds: { w: 60, h: 18 },
    symbol: InductorSymbol,
    keywords: ['inductor', 'coil', 'l', 'henry'],
  },
  diode: {
    type: 'diode',
    label: 'Diode',
    category: 'Active',
    refdesPrefix: 'D',
    pins: [
      { name: 'a', offset: { x: -30, y: 0 } },
      { name: 'k', offset: { x: 30, y: 0 } },
    ],
    params: [
      { key: 'saturationCurrent', label: 'Saturation current (Is)', unit: 'A', defaultValue: 1e-14, min: 0, zeroInvalid: true },
      { key: 'ideality', label: 'Ideality factor (n)', unit: '', defaultValue: 1, min: 0, zeroInvalid: true },
    ],
    bounds: { w: 60, h: 20 },
    symbol: DiodeSymbol,
    keywords: ['diode', 'd', 'rectifier', '1n4148', 'junction'],
  },
  'bjt-npn': {
    type: 'bjt-npn',
    label: 'BJT (NPN)',
    category: 'Active',
    refdesPrefix: 'Q',
    // Engine convention: collector, base, emitter.
    pins: [
      { name: 'c', offset: { x: 20, y: -30 } },
      { name: 'b', offset: { x: -30, y: 0 } },
      { name: 'e', offset: { x: 20, y: 30 } },
    ],
    params: [{ key: 'beta', label: 'Current gain (β)', unit: '', defaultValue: 100, min: 0, zeroInvalid: true }],
    bounds: { w: 56, h: 60 },
    symbol: BJTNPNSymbol,
    keywords: ['bjt', 'npn', 'transistor', 'q', '2n2222'],
  },
  'mosfet-nmos': {
    type: 'mosfet-nmos',
    label: 'MOSFET (NMOS)',
    category: 'Active',
    refdesPrefix: 'M',
    // Engine convention: drain, gate, source.
    pins: [
      { name: 'd', offset: { x: 20, y: -30 } },
      { name: 'g', offset: { x: -30, y: 0 } },
      { name: 's', offset: { x: 20, y: 30 } },
    ],
    params: [
      { key: 'k', label: 'Transconductance (k)', unit: 'A/V²', defaultValue: 0.001, min: 0, zeroInvalid: true },
      { key: 'vth', label: 'Threshold (Vth)', unit: 'V', defaultValue: 1 },
      { key: 'lambda', label: 'Channel modulation (λ)', unit: '1/V', defaultValue: 0.01, min: 0 },
    ],
    bounds: { w: 56, h: 60 },
    symbol: MOSFETNMOSSymbol,
    keywords: ['mosfet', 'nmos', 'fet', 'transistor', 'm'],
  },
  opamp: {
    type: 'opamp',
    label: 'Op-Amp (ideal)',
    category: 'Active',
    refdesPrefix: 'U',
    // in+ on top, in− on the bottom, single-ended output. Macro-expanded by
    // core/netlist.ts into Rin + VCVS + Rout — no supply rails, no saturation.
    pins: [
      { name: 'inp', offset: { x: -30, y: -10 } },
      { name: 'inn', offset: { x: -30, y: 10 } },
      { name: 'out', offset: { x: 30, y: 0 } },
    ],
    params: [
      { key: 'gain', label: 'Open-loop gain (A₀)', unit: 'V/V', defaultValue: 1e5, min: 0, zeroInvalid: true },
      { key: 'rin', label: 'Input resistance', unit: 'Ω', defaultValue: 10e6, min: 0, zeroInvalid: true },
      { key: 'rout', label: 'Output resistance', unit: 'Ω', defaultValue: 75, min: 0, zeroInvalid: true },
    ],
    bounds: { w: 60, h: 44 },
    symbol: OpAmpSymbol,
    keywords: ['opamp', 'op-amp', 'amplifier', 'u', '741', 'lm358'],
  },
  timer555: {
    type: 'timer555',
    label: '555 Timer',
    category: 'Active',
    refdesPrefix: 'U',
    // Engine node order: [vcc, gnd, trig, thr, dis, out]. Behavioral macro —
    // transient-only (no DC operating point, no small-signal AC model).
    pins: [
      { name: 'vcc', offset: { x: 0, y: -50 } },
      { name: 'gnd', offset: { x: 0, y: 50 } },
      { name: 'trig', offset: { x: -40, y: -20 } },
      { name: 'dis', offset: { x: -40, y: 0 } },
      { name: 'thr', offset: { x: -40, y: 20 } },
      { name: 'out', offset: { x: 40, y: 0 } },
    ],
    params: [],
    bounds: { w: 80, h: 100 },
    symbol: Timer555Symbol,
    keywords: ['555', 'timer', 'ne555', 'astable', 'monostable', 'oscillator', 'u'],
  },
  'vsource-dc': {
    type: 'vsource-dc',
    label: 'DC Voltage Source',
    category: 'Sources',
    refdesPrefix: 'V',
    pins: [
      { name: 'pos', offset: { x: 0, y: -30 } },
      { name: 'neg', offset: { x: 0, y: 30 } },
    ],
    params: [{ key: 'voltage', label: 'Voltage', unit: 'V', defaultValue: 5 }],
    bounds: { w: 36, h: 60 },
    symbol: VSourceDCSymbol,
    keywords: ['voltage', 'source', 'battery', 'dc', 'v'],
  },
  'vsource-ac': {
    type: 'vsource-ac',
    label: 'AC Voltage Source',
    category: 'Sources',
    refdesPrefix: 'V',
    pins: [
      { name: 'pos', offset: { x: 0, y: -30 } },
      { name: 'neg', offset: { x: 0, y: 30 } },
    ],
    params: [
      { key: 'amplitude', label: 'Amplitude', unit: 'V', defaultValue: 1, min: 0 },
      { key: 'frequency', label: 'Frequency', unit: 'Hz', defaultValue: 1000, min: 0, zeroInvalid: true },
      { key: 'phase', label: 'Phase', unit: '°', defaultValue: 0 },
      { key: 'offset', label: 'DC Offset', unit: 'V', defaultValue: 0 },
    ],
    bounds: { w: 36, h: 60 },
    symbol: VSourceACSymbol,
    keywords: ['voltage', 'source', 'ac', 'sine', 'sin', 'signal'],
  },
  'vsource-pulse': {
    type: 'vsource-pulse',
    label: 'Pulse Source',
    category: 'Sources',
    refdesPrefix: 'V',
    pins: [
      { name: 'pos', offset: { x: 0, y: -30 } },
      { name: 'neg', offset: { x: 0, y: 30 } },
    ],
    params: [
      { key: 'v1', label: 'V1 (low)', unit: 'V', defaultValue: 0 },
      { key: 'v2', label: 'V2 (high)', unit: 'V', defaultValue: 5 },
      { key: 'delay', label: 'Delay', unit: 's', defaultValue: 0, min: 0 },
      { key: 'rise', label: 'Rise', unit: 's', defaultValue: 1e-6, min: 0 },
      { key: 'fall', label: 'Fall', unit: 's', defaultValue: 1e-6, min: 0 },
      { key: 'width', label: 'Width', unit: 's', defaultValue: 5e-4, min: 0, zeroInvalid: true },
      { key: 'period', label: 'Period', unit: 's', defaultValue: 1e-3, min: 0, zeroInvalid: true },
    ],
    bounds: { w: 36, h: 60 },
    symbol: VSourcePulseSymbol,
    keywords: ['pulse', 'square', 'clock', 'source'],
  },
  'isource-dc': {
    type: 'isource-dc',
    label: 'DC Current Source',
    category: 'Sources',
    refdesPrefix: 'I',
    pins: [
      { name: 'pos', offset: { x: 0, y: -30 } },
      { name: 'neg', offset: { x: 0, y: 30 } },
    ],
    params: [{ key: 'current', label: 'Current', unit: 'A', defaultValue: 0.001 }],
    bounds: { w: 36, h: 60 },
    symbol: ISourceDCSymbol,
    keywords: ['current', 'source', 'dc', 'i'],
  },
  ground: {
    type: 'ground',
    label: 'Ground',
    category: 'Reference',
    refdesPrefix: 'GND',
    pins: [{ name: 'ref', offset: { x: 0, y: 0 } }],
    params: [],
    bounds: { w: 26, h: 42 },
    symbol: GroundSymbol,
    keywords: ['ground', 'gnd', 'reference', 'earth', '0'],
  },
}

export const PALETTE_ORDER: SchematicComponentType[] = [
  'resistor',
  'capacitor',
  'capacitor-polarized',
  'inductor',
  'diode',
  'bjt-npn',
  'mosfet-nmos',
  'opamp',
  'timer555',
  'vsource-dc',
  'vsource-ac',
  'vsource-pulse',
  'isource-dc',
  'ground',
]

export function getDef(type: SchematicComponentType): ComponentDef {
  return COMPONENT_DEFS[type]
}
