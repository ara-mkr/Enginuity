// ── KiCad Schematic (.kicad_sch) parser ──────────────────────────────────────

export function parseKiCadSchematic(text) {
  const components = []
  const nets = []
  const powerNets = new Set()

  // Extract symbols (components)
  const symbolBlocks = text.split(/\(symbol\s+/).slice(1)
  for (const block of symbolBlocks) {
    // Skip library symbol definitions (they start with a quoted lib name, not (lib_id
    if (block.match(/^"[A-Z]/)) continue

    const libIdMatch = block.match(/\(lib_id\s+"([^"]+)"/)
    const refMatch = block.match(/\(property\s+"Reference"\s+"([^"]+)"/)
    const valueMatch = block.match(/\(property\s+"Value"\s+"([^"]+)"/)
    const footprintMatch = block.match(/\(property\s+"Footprint"\s+"([^"]*)"/)

    if (!refMatch) continue
    const ref = refMatch[1]
    if (ref === '~' || ref.startsWith('~')) continue

    const libId = libIdMatch?.[1] || ''
    const value = valueMatch?.[1] || ''
    const footprint = footprintMatch?.[1] || ''

    // Detect power symbols
    if (libId.toLowerCase().includes('power') ||
        /^(VCC|VDD|GND|VSS|\+3V|\+5V|\+12V|-12V|PWR_FLAG)/i.test(value)) {
      powerNets.add(value)
    }

    components.push({ reference: ref, value, footprint, libId })
  }

  // Extract wires for net info
  const wireMatches = [...text.matchAll(/\(wire\s+\(pts\s+\(xy\s+([\d.-]+)\s+([\d.-]+)\)\s+\(xy\s+([\d.-]+)\s+([\d.-]+)\)\)/g)]
  const wires = wireMatches.map(m => ({
    x1: parseFloat(m[1]), y1: parseFloat(m[2]),
    x2: parseFloat(m[3]), y2: parseFloat(m[4])
  }))

  // Extract net labels
  const netLabelMatches = [...text.matchAll(/\(net_label\s+\(at\s+[\d.-]+\s+[\d.-]+[^)]*\)\s+\(fields_autoplaced\s*\)\s+\(effects[^)]+\)\s+\(uuid[^)]+\)\s+\(property\s+"Value"\s+"([^"]+)"/g)]
  const labelMatches2 = [...text.matchAll(/\(label\s+"([^"]+)"/g)]
  const labelMatches3 = [...text.matchAll(/\(net_label[^)]*\(property\s+"Value"\s+"([^"]+)"/g)]

  const netNames = new Set([
    ...labelMatches2.map(m => m[1]),
    ...labelMatches3.map(m => m[1]),
    ...netLabelMatches.map(m => m[1]),
  ])

  netNames.forEach(name => {
    nets.push({ name, pins: [] })
  })

  return {
    components,
    nets,
    powerNets: [...powerNets],
    wires,
    boardWidth: null,
    boardHeight: null,
  }
}

// ── KiCad PCB (.kicad_pcb) parser ────────────────────────────────────────────

export function parseKiCadPCB(text) {
  const components = []
  const trackWidths = new Set()
  const viaSizes = new Set()
  const nets = new Map()
  let boardWidth = null
  let boardHeight = null

  // Extract footprints
  const footprintBlocks = text.split(/\(footprint\s+/).slice(1)
  for (const block of footprintBlocks) {
    const pkgMatch = block.match(/^"([^"]+)"/)
    const refMatch = block.match(/\(property\s+"Reference"\s+"([^"]+)"/) ||
                     block.match(/\(fp_text\s+reference\s+"([^"]+)"/)
    const valueMatch = block.match(/\(property\s+"Value"\s+"([^"]+)"/) ||
                       block.match(/\(fp_text\s+value\s+"([^"]+)"/)
    if (!refMatch) continue
    components.push({
      reference: refMatch[1],
      value: valueMatch?.[1] || '',
      footprint: pkgMatch?.[1]?.split(':').pop() || ''
    })
  }

  // Extract track widths
  const trackMatches = [...text.matchAll(/\(segment[^)]*\(width\s+([\d.]+)\)/g)]
  trackMatches.forEach(m => trackWidths.add(parseFloat(m[1])))

  // Extract via sizes
  const viaMatches = [...text.matchAll(/\(via[^)]*\(size\s+([\d.]+)\)/g)]
  viaMatches.forEach(m => viaSizes.add(parseFloat(m[1])))

  // Extract net names
  const netMatches = [...text.matchAll(/\(net\s+(\d+)\s+"([^"]*)"\)/g)]
  netMatches.forEach(m => nets.set(m[1], m[2]))

  // Try to extract board outline from Edge.Cuts layer
  const edgeMatches = [...text.matchAll(/\(gr_line[^)]*\(layer\s+"?Edge\.Cuts"?\)[^)]*\(start\s+([\d.-]+)\s+([\d.-]+)\)[^)]*\(end\s+([\d.-]+)\s+([\d.-]+)\)/g)]
  if (edgeMatches.length > 0) {
    const xs = edgeMatches.flatMap(m => [parseFloat(m[1]), parseFloat(m[3])])
    const ys = edgeMatches.flatMap(m => [parseFloat(m[2]), parseFloat(m[4])])
    boardWidth = parseFloat((Math.max(...xs) - Math.min(...xs)).toFixed(1))
    boardHeight = parseFloat((Math.max(...ys) - Math.min(...ys)).toFixed(1))
  }

  return {
    components,
    nets: [...nets.entries()].map(([, name]) => ({ name, pins: [] })),
    powerNets: [...nets.values()].filter(n => /GND|VCC|VDD|PWR|3V3|5V/i.test(n)),
    trackWidths: [...trackWidths].sort((a, b) => a - b),
    viaSizes: [...viaSizes].sort((a, b) => a - b),
    boardWidth,
    boardHeight,
  }
}

// ── EasyEDA JSON parser ───────────────────────────────────────────────────────

export function parseEasyEDAJson(text) {
  try {
    const data = JSON.parse(text)
    const components = []
    const powerNets = new Set()

    // EasyEDA schematic JSON has various structures
    const schematics = data.schematics || (data.head ? [data] : [])
    for (const sch of schematics) {
      const shapes = sch.dataStr?.canvas?.split('\n') || []
      for (const shape of shapes) {
        if (shape.startsWith('LIB~')) {
          const parts = shape.split('~')
          components.push({ reference: parts[7] || '', value: parts[6] || '', footprint: '' })
        }
      }
    }

    return { components, nets: [], powerNets: [], boardWidth: null, boardHeight: null }
  } catch {
    return { components: [], nets: [], powerNets: [], boardWidth: null, boardHeight: null }
  }
}

// ── Build AI context string ───────────────────────────────────────────────────

export function buildSchematicContext(parsed, filename) {
  const ext = filename?.split('.').pop()?.toLowerCase() || ''
  const lines = [
    `SCHEMATIC SUMMARY (${filename || 'unknown'}):`,
    `Components (${parsed.components.length} total):`,
    ...parsed.components.slice(0, 80).map(c =>
      `  ${c.reference}: ${c.value}${c.footprint ? ` (${c.footprint})` : ''}`
    ),
    parsed.components.length > 80
      ? `  ... and ${parsed.components.length - 80} more components`
      : '',
    '',
    `Power nets detected: ${parsed.powerNets.length > 0 ? parsed.powerNets.join(', ') : 'none identified'}`,
    '',
  ]

  if (parsed.nets?.length > 0) {
    lines.push(`Net labels (${parsed.nets.length} total):`)
    parsed.nets.slice(0, 30).forEach(n => lines.push(`  ${n.name}`))
    if (parsed.nets.length > 30) lines.push(`  ... and ${parsed.nets.length - 30} more`)
    lines.push('')
  }

  if (parsed.trackWidths?.length > 0) {
    lines.push(`Track widths: ${parsed.trackWidths.map(w => `${w}mm`).join(', ')}`)
  }

  if (parsed.boardWidth) {
    lines.push(`Board dimensions: ${parsed.boardWidth} × ${parsed.boardHeight} mm`)
  }

  return lines.filter(l => l !== undefined).join('\n')
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export function parseFile(file, text) {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''

  if (ext === 'kicad_sch') return { parsed: parseKiCadSchematic(text), isImage: false }
  if (ext === 'kicad_pcb') return { parsed: parseKiCadPCB(text), isImage: false }
  if (ext === 'json') return { parsed: parseEasyEDAJson(text), isImage: false }

  // For .sch (Eagle), .brd, .svg, treat as raw text
  if (['sch', 'brd', 'svg'].includes(ext)) {
    return {
      parsed: {
        components: [],
        nets: [],
        powerNets: [],
        rawText: text.slice(0, 6000),
        boardWidth: null, boardHeight: null
      },
      isImage: false,
      rawText: text.slice(0, 8000)
    }
  }

  // Image files
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    return { parsed: null, isImage: true }
  }

  return { parsed: null, isImage: false, rawText: text.slice(0, 8000) }
}
