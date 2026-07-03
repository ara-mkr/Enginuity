import type { Component, ComponentType, Netlist } from './types'

// ── Value parser ──────────────────────────────────────────────────────────────

const SCALE_FACTORS: Record<string, number> = {
  t: 1e12,
  g: 1e9,
  meg: 1e6,
  k: 1e3,
  mil: 25.4e-6,
  m: 1e-3,
  u: 1e-6,
  µ: 1e-6,
  n: 1e-9,
  p: 1e-12,
  f: 1e-15,
}

/**
 * Parses a SPICE value string ("1k", "100n", "2.2meg", "4.7uF") into a
 * number. Scale factor matching follows SPICE rules: the multi-letter
 * factors (meg, mil) are checked before their single-letter prefixes, and
 * any trailing unit letters after the factor are ignored ("100nF" → 1e-7).
 */
export function parseValue(str: string | number | null | undefined): number {
  if (str === null || str === undefined) return 0
  if (typeof str === 'number') return str

  const m = String(str)
    .trim()
    .match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-zµΩ]*)$/i)
  if (!m) return 0
  const num = parseFloat(m[1])
  if (isNaN(num)) return 0

  const suffix = m[2].toLowerCase()
  if (!suffix) return num
  for (const factor of ['meg', 'mil', 't', 'g', 'k', 'm', 'u', 'µ', 'n', 'p', 'f']) {
    if (suffix.startsWith(factor)) return num * SCALE_FACTORS[factor]
  }
  return num
}

// ── Parsed shapes ─────────────────────────────────────────────────────────────

/** UI-facing component row (schematic view, components table). */
export interface UIComponent {
  id: string
  type: string
  value: string
  unit?: string
  nodes: string[]
  description?: string
  dc?: string
}

export interface ParsedAnalysis {
  type: 'operating_point' | 'transient' | 'ac' | 'dc_sweep'
  params: Record<string, number | string>
}

export interface ParsedNetlist {
  /** UI shape, string node names preserved. */
  components: UIComponent[]
  /** Typed-engine netlist with numeric node ids. */
  netlist: Netlist
  /** Numeric node id → original node name. */
  nodeNames: Record<number, string>
  analysis: ParsedAnalysis
  /** Component id of the source carrying an AC spec (stimulus for .AC). */
  acSourceId: string | null
  warnings: string[]
}

const GROUND_NAMES = new Set(['0', 'gnd', 'ground'])

const UNIT_BY_TYPE: Record<string, string> = {
  R: 'Ω', C: 'F', L: 'H', V: 'V', I: 'A', D: '', Q: '', M: '',
}

const DESCRIPTION_BY_TYPE: Record<string, string> = {
  R: 'Resistor', C: 'Capacitor', L: 'Inductor', V: 'Voltage source',
  I: 'Current source', D: 'Diode', Q: 'BJT (NPN)', M: 'MOSFET (NMOS)',
}

/**
 * Parses SPICE netlist text into both the UI component list (string node
 * names) and the typed engine's Netlist (numeric node ids), plus the
 * analysis directive. Source specs like "DC 5 AC 1" are parsed as source
 * parameters — never mistaken for node names.
 */
export function parseCircuitNetlist(text: string): ParsedNetlist {
  const warnings: string[] = []
  const components: UIComponent[] = []
  const engineComponents: Component[] = []
  const nodeNumbers = new Map<string, number>()
  const nodeNames: Record<number, string> = { 0: '0' }
  let analysis: ParsedAnalysis = { type: 'operating_point', params: {} }
  let sawAnalysisDirective = false
  let acSourceId: string | null = null

  const nodeNumber = (name: string): number => {
    if (GROUND_NAMES.has(name.toLowerCase())) return 0
    let num = nodeNumbers.get(name)
    if (num === undefined) {
      num = nodeNumbers.size + 1
      nodeNumbers.set(name, num)
      nodeNames[num] = name
    }
    return num
  }

  // Join continuation lines (leading "+") onto their parent line.
  const rawLines = text.split('\n')
  const lines: string[] = []
  for (const raw of rawLines) {
    const line = raw.split(';')[0]
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('+') && lines.length > 0) {
      lines[lines.length - 1] += ' ' + trimmed.slice(1)
    } else {
      lines.push(trimmed)
    }
  }

  let ended = false
  for (const line of lines) {
    if (ended) break
    if (line.startsWith('*') || line.startsWith('$')) continue

    const parts = line.split(/\s+/)
    const upper = line.toUpperCase()

    // ── Dot directives ─────────────────────────────────────────────────
    if (line.startsWith('.')) {
      if (upper.startsWith('.TRAN')) {
        sawAnalysisDirective = true
        analysis = {
          type: 'transient',
          params: { tStep: parseValue(parts[1]), tStop: parseValue(parts[2]) },
        }
      } else if (upper.startsWith('.AC')) {
        sawAnalysisDirective = true
        const sweep = (parts[1] ?? 'DEC').toUpperCase()
        if (sweep !== 'DEC') {
          warnings.push(`.AC ${sweep} sweep is approximated as a DEC (log) sweep.`)
        }
        analysis = {
          type: 'ac',
          params: {
            sweep,
            numPoints: parseInt(parts[2], 10) || 20,
            fStart: parseValue(parts[3]),
            fStop: parseValue(parts[4]),
          },
        }
      } else if (upper.startsWith('.DC')) {
        sawAnalysisDirective = true
        analysis = {
          type: 'dc_sweep',
          params: {
            source: parts[1] ?? '',
            start: parseValue(parts[2]),
            stop: parseValue(parts[3]),
            step: parseValue(parts[4]),
          },
        }
      } else if (upper.startsWith('.OP')) {
        sawAnalysisDirective = true
        analysis = { type: 'operating_point', params: {} }
      } else if (upper.startsWith('.END')) {
        ended = true
      } else if (!upper.startsWith('.MODEL') && !upper.startsWith('.PRINT') && !upper.startsWith('.PROBE') && !upper.startsWith('.PLOT')) {
        warnings.push(`Unsupported directive skipped: ${parts[0]}`)
      }
      continue
    }

    // ── Component lines ────────────────────────────────────────────────
    const id = parts[0]
    const kind = id[0].toUpperCase()

    switch (kind) {
      case 'R':
      case 'C':
      case 'L': {
        if (parts.length < 4) {
          warnings.push(`Skipped malformed line: "${line}"`)
          continue
        }
        const [n1, n2, value] = [parts[1], parts[2], parts[3]]
        const numeric = parseValue(value)
        if (!(numeric > 0)) {
          warnings.push(`${id}: value "${value}" is not a positive number.`)
        }
        const type: ComponentType = kind === 'R' ? 'resistor' : kind === 'C' ? 'capacitor' : 'inductor'
        components.push({
          id, type: kind, value, unit: UNIT_BY_TYPE[kind],
          nodes: [n1, n2], description: DESCRIPTION_BY_TYPE[kind],
        })
        engineComponents.push({ id, type, nodes: [nodeNumber(n1), nodeNumber(n2)], value: numeric })
        break
      }

      case 'V':
      case 'I': {
        if (parts.length < 4) {
          warnings.push(`Skipped malformed line: "${line}"`)
          continue
        }
        const [n1, n2] = [parts[1], parts[2]]
        // Remaining tokens are the source spec: "[DC] <val> [AC <mag> [<phase>]]"
        // or a waveform spec (SIN/PULSE/PWL — unsupported, DC value used).
        const spec = parts.slice(3)
        let dcValue: number | null = null
        let hasAC = false
        for (let i = 0; i < spec.length; i++) {
          const tok = spec[i].toUpperCase()
          if (tok === 'DC') {
            dcValue = parseValue(spec[i + 1])
            i++
          } else if (tok === 'AC') {
            hasAC = true
            i++ // AC magnitude (treated as unit stimulus by the solver)
            if (spec[i + 1] !== undefined && /^[\d.+-]/.test(spec[i + 1])) i++ // optional phase
          } else if (/^(SIN|PULSE|PWL|EXP|SFFM)/.test(tok)) {
            warnings.push(`${id}: ${tok.split('(')[0]} waveform is not supported; the source is treated as DC.`)
            break
          } else if (dcValue === null && /^[+-]?[\d.]/.test(spec[i])) {
            dcValue = parseValue(spec[i])
          }
        }
        if (dcValue === null) dcValue = 0
        if (hasAC && acSourceId === null) acSourceId = id
        components.push({
          id, type: kind, value: String(dcValue), dc: String(dcValue),
          unit: UNIT_BY_TYPE[kind], nodes: [n1, n2],
          description: DESCRIPTION_BY_TYPE[kind],
        })
        engineComponents.push({
          id,
          type: kind === 'V' ? 'vsource' : 'isource',
          nodes: [nodeNumber(n1), nodeNumber(n2)],
          value: dcValue,
        })
        break
      }

      case 'D': {
        if (parts.length < 3) {
          warnings.push(`Skipped malformed line: "${line}"`)
          continue
        }
        const [anode, cathode] = [parts[1], parts[2]]
        components.push({
          id, type: 'D', value: parts[3] ?? 'default', unit: '',
          nodes: [anode, cathode], description: DESCRIPTION_BY_TYPE.D,
        })
        engineComponents.push({ id, type: 'diode', nodes: [nodeNumber(anode), nodeNumber(cathode)], value: 0 })
        break
      }

      case 'Q': {
        if (parts.length < 4) {
          warnings.push(`Skipped malformed line: "${line}"`)
          continue
        }
        const [nc, nb, ne] = [parts[1], parts[2], parts[3]]
        components.push({
          id, type: 'Q', value: parts[4] ?? 'default', unit: '',
          nodes: [nc, nb, ne], description: DESCRIPTION_BY_TYPE.Q,
        })
        engineComponents.push({
          id, type: 'bjt',
          nodes: [nodeNumber(nc), nodeNumber(nb), nodeNumber(ne)], value: 0,
        })
        break
      }

      case 'M': {
        if (parts.length < 4) {
          warnings.push(`Skipped malformed line: "${line}"`)
          continue
        }
        const [nd, ng, ns] = [parts[1], parts[2], parts[3]]
        components.push({
          id, type: 'M', value: parts[5] ?? parts[4] ?? 'default', unit: '',
          nodes: [nd, ng, ns], description: DESCRIPTION_BY_TYPE.M,
        })
        engineComponents.push({
          id, type: 'mosfet',
          nodes: [nodeNumber(nd), nodeNumber(ng), nodeNumber(ns)], value: 0,
        })
        break
      }

      default:
        warnings.push(`${id}: component type "${kind}" is not supported and was skipped.`)
    }
  }

  if (analysis.type === 'ac' && !acSourceId) {
    const firstSource = engineComponents.find((c) => c.type === 'vsource' || c.type === 'isource')
    if (firstSource) {
      acSourceId = firstSource.id
      warnings.push(`No source has an AC spec; using ${firstSource.id} as the AC stimulus.`)
    }
  }
  if (!sawAnalysisDirective && engineComponents.length > 0) {
    warnings.push('No analysis directive (.OP/.TRAN/.AC/.DC) found — defaulting to operating point.')
  }

  return {
    components,
    netlist: { components: engineComponents },
    nodeNames,
    analysis,
    acSourceId,
    warnings,
  }
}
