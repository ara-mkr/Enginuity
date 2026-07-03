import { DENSITY_MULTIPLIERS } from '../../../config/packages'

// ── Layer colors (KiCad standard) ─────────────────────────────────────────────

export const LAYER_COLORS = {
  cu:        '#ff8888',
  paste:     'rgba(255,136,136,0.35)',
  mask:      'rgba(255,136,136,0.15)',
  silk:      '#cccccc',
  fab:       '#888888',
  courtyard: '#ffff00',
}

const f = (n) => parseFloat(n.toFixed(4))

// ── Pad shape helpers ─────────────────────────────────────────────────────────

function smtRect(cx, cy, pw, ph, isPin1, color, pasteColor) {
  const rx = isPin1 ? 0 : Math.min(pw, ph) * 0.1
  return [
    `<rect x="${f(cx - pw/2)}" y="${f(cy - ph/2)}" width="${pw}" height="${ph}" rx="${rx}" fill="${color}" stroke="none" opacity="0.9"/>`,
    `<rect x="${f(cx - pw/2)}" y="${f(cy - ph/2)}" width="${pw}" height="${ph}" rx="${rx}" fill="${pasteColor}" stroke="none"/>`,
  ].join('\n')
}

function thruHoleRect(cx, cy, padDia, drillDia, isPin1) {
  return [
    `<rect x="${f(cx - padDia/2)}" y="${f(cy - padDia/2)}" width="${padDia}" height="${padDia}" fill="${LAYER_COLORS.cu}" stroke="none" opacity="0.9"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${f(drillDia/2)}" fill="#080810" stroke="none"/>`,
  ].join('\n')
}

function thruHoleCircle(cx, cy, padDia, drillDia) {
  return [
    `<circle cx="${cx}" cy="${cy}" r="${f(padDia/2)}" fill="${LAYER_COLORS.cu}" stroke="none" opacity="0.9"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${f(drillDia/2)}" fill="#080810" stroke="none"/>`,
  ].join('\n')
}

// ── Pad generators mirrored from generateKicad ────────────────────────────────

function chipPads(cfg, dm, layers) {
  const pw = f(cfg.land.l * dm.l)
  const ph = f(cfg.land.w * dm.w)
  const x1 = f(-cfg.land.pitch / 2)
  const x2 = f(cfg.land.pitch / 2)
  const items = []
  if (layers.cu) {
    items.push(smtRect(x1, 0, pw, ph, true, LAYER_COLORS.cu, LAYER_COLORS.paste))
    items.push(smtRect(x2, 0, pw, ph, false, LAYER_COLORS.cu, LAYER_COLORS.paste))
  }
  return items
}

function chipSilk(cfg, layers) {
  if (!layers.silk) return []
  const bx = f(cfg.body.l / 2)
  const by = f(cfg.body.w / 2)
  const gap = f(cfg.land.w / 2 + 0.05)
  return [
    `<line x1="${-bx}" y1="${gap}" x2="${-bx}" y2="${by+0.10}" stroke="${LAYER_COLORS.silk}" stroke-width="0.12"/>`,
    `<line x1="${-bx}" y1="${-(by+0.10)}" x2="${-bx}" y2="${-gap}" stroke="${LAYER_COLORS.silk}" stroke-width="0.12"/>`,
    `<line x1="${bx}" y1="${gap}" x2="${bx}" y2="${by+0.10}" stroke="${LAYER_COLORS.silk}" stroke-width="0.12"/>`,
    `<line x1="${bx}" y1="${-(by+0.10)}" x2="${bx}" y2="${-gap}" stroke="${LAYER_COLORS.silk}" stroke-width="0.12"/>`,
  ]
}

function chipFab(cfg, layers) {
  if (!layers.fab) return []
  const bx = f(cfg.body.l / 2)
  const by = f(cfg.body.w / 2)
  return [`<rect x="${-bx}" y="${-by}" width="${cfg.body.l}" height="${cfg.body.w}" fill="none" stroke="${LAYER_COLORS.fab}" stroke-width="0.10"/>`]
}

function chipCourtyard(cfg, layers) {
  if (!layers.courtyard) return []
  const cx = f(cfg.land.pitch / 2 + cfg.land.l / 2 + cfg.courtyard)
  const cy = f(cfg.land.w / 2 + cfg.courtyard)
  return [`<rect x="${-cx}" y="${-cy}" width="${cx*2}" height="${cy*2}" fill="none" stroke="${LAYER_COLORS.courtyard}" stroke-width="0.05" stroke-dasharray="0.2 0.1"/>`]
}

function dualRowPads(cfg, dm, layers) {
  const { pins, pitch, land, rowSpacing } = cfg
  const pps = pins / 2
  const pw = f(land.l * dm.l)
  const ph = f(land.w * dm.w)
  const xL = f(-rowSpacing / 2)
  const xR = f(rowSpacing / 2)
  const items = []
  if (!layers.cu) return items
  for (let i = 0; i < pps; i++) {
    const y = f(-(((pps - 1) * pitch) / 2) + i * pitch)
    items.push(...smtRect(xL, y, pw, ph, i === 0, LAYER_COLORS.cu, LAYER_COLORS.paste).split('\n'))
    items.push(...smtRect(xR, -y, pw, ph, false, LAYER_COLORS.cu, LAYER_COLORS.paste).split('\n'))
  }
  return items
}

function dualRowSilk(cfg, layers) {
  if (!layers.silk) return []
  const { pins, pitch, land, body, rowSpacing } = cfg
  const pps = pins / 2
  const halfH = f(((pps - 1) * pitch) / 2 + land.w / 2 + 0.30)
  const halfW = f(body.w / 2 + 0.10)
  return [
    `<polyline points="${-halfW},${-halfH} ${halfW},${-halfH} ${halfW},${halfH} ${-halfW},${halfH}" fill="none" stroke="${LAYER_COLORS.silk}" stroke-width="0.12"/>`,
    `<line x1="${-halfW}" y1="${-halfH}" x2="${-halfW}" y2="${halfH}" stroke="${LAYER_COLORS.silk}" stroke-width="0.12"/>`,
    `<circle cx="${f(-rowSpacing/2 - land.l/2 - 0.20)}" cy="${f(-(((pps-1)*pitch)/2))}" r="0.15" fill="${LAYER_COLORS.silk}"/>`,
  ]
}

function dualRowCourtyard(cfg, layers) {
  if (!layers.courtyard) return []
  const { pins, pitch, land, rowSpacing, courtyard: cy } = cfg
  const pps = pins / 2
  const cx = f(rowSpacing / 2 + land.l / 2 + cy)
  const ccy = f(((pps - 1) * pitch) / 2 + land.w / 2 + cy)
  return [`<rect x="${-cx}" y="${-ccy}" width="${cx*2}" height="${ccy*2}" fill="none" stroke="${LAYER_COLORS.courtyard}" stroke-width="0.05" stroke-dasharray="0.2 0.1"/>`]
}

function qfpPads(cfg, dm, layers) {
  if (!layers.cu) return []
  const { pins, pitch, land, body } = cfg
  const pps = pins / 4
  const pw = f(land.l * dm.l)
  const ph = f(land.w * dm.w)
  const halfBody = f(body.l / 2)
  const landOffset = f(halfBody + pw / 2 + 0.15)
  const items = []
  let padNum = 1

  for (let i = 0; i < pps; i++) {
    const x = f(-(((pps - 1) * pitch) / 2) + i * pitch)
    items.push(...smtRect(x, landOffset, pw, ph, padNum === 1, LAYER_COLORS.cu, LAYER_COLORS.paste).split('\n'))
    padNum++
  }
  for (let i = 0; i < pps; i++) {
    const y = f((((pps - 1) * pitch) / 2) - i * pitch)
    items.push(...smtRect(landOffset, y, ph, pw, false, LAYER_COLORS.cu, LAYER_COLORS.paste).split('\n'))
    padNum++
  }
  for (let i = 0; i < pps; i++) {
    const x = f((((pps - 1) * pitch) / 2) - i * pitch)
    items.push(...smtRect(x, -landOffset, pw, ph, false, LAYER_COLORS.cu, LAYER_COLORS.paste).split('\n'))
    padNum++
  }
  for (let i = 0; i < pps; i++) {
    const y = f(-(((pps - 1) * pitch) / 2) + i * pitch)
    items.push(...smtRect(-landOffset, y, ph, pw, false, LAYER_COLORS.cu, LAYER_COLORS.paste).split('\n'))
    padNum++
  }
  return items
}

function qfpBody(cfg, layers) {
  const b = f(cfg.body.l / 2)
  const items = []
  if (layers.fab) {
    items.push(`<rect x="${-b}" y="${-b}" width="${cfg.body.l}" height="${cfg.body.l}" fill="none" stroke="${LAYER_COLORS.fab}" stroke-width="0.10"/>`)
  }
  if (layers.silk) {
    items.push(`<rect x="${-b}" y="${-b}" width="${cfg.body.l}" height="${cfg.body.l}" fill="none" stroke="${LAYER_COLORS.silk}" stroke-width="0.12"/>`)
    items.push(`<circle cx="${f(-b + 0.60)}" cy="${f(-b + 0.60)}" r="0.20" fill="${LAYER_COLORS.silk}"/>`)
  }
  return items
}

function qfnPads(cfg, dm, layers) {
  if (!layers.cu) return []
  const { pins, pitch, land, body } = cfg
  const pps = pins / 4
  const pw = f(land.l * dm.l)
  const ph = f(land.w * dm.w)
  const edgeOffset = f(body.l / 2 + pw / 2 - 0.05)
  const items = []
  let padNum = 1

  for (let i = 0; i < pps; i++) {
    const x = f(-(((pps - 1) * pitch) / 2) + i * pitch)
    items.push(...smtRect(x, edgeOffset, pw, ph, padNum === 1, LAYER_COLORS.cu, LAYER_COLORS.paste).split('\n'))
    padNum++
  }
  for (let i = 0; i < pps; i++) {
    const y = f((((pps - 1) * pitch) / 2) - i * pitch)
    items.push(...smtRect(edgeOffset, y, ph, pw, false, LAYER_COLORS.cu, LAYER_COLORS.paste).split('\n'))
    padNum++
  }
  for (let i = 0; i < pps; i++) {
    const x = f((((pps - 1) * pitch) / 2) - i * pitch)
    items.push(...smtRect(x, -edgeOffset, pw, ph, false, LAYER_COLORS.cu, LAYER_COLORS.paste).split('\n'))
    padNum++
  }
  for (let i = 0; i < pps; i++) {
    const y = f(-(((pps - 1) * pitch) / 2) + i * pitch)
    items.push(...smtRect(-edgeOffset, y, ph, pw, false, LAYER_COLORS.cu, LAYER_COLORS.paste).split('\n'))
    padNum++
  }
  // Thermal pad
  if (cfg.thermalPad && layers.cu) {
    const { thermalPad } = cfg
    items.push(`<rect x="${f(-thermalPad.l/2)}" y="${f(-thermalPad.w/2)}" width="${thermalPad.l}" height="${thermalPad.w}" fill="${LAYER_COLORS.paste}" stroke="${LAYER_COLORS.cu}" stroke-width="0.05"/>`)
  }
  return items
}

function dipPads(cfg, layers) {
  if (!layers.cu) return []
  const { pins, pitch, rowSpacing, drillDia, padDia } = cfg
  const pps = pins / 2
  const items = []
  for (let i = 0; i < pps; i++) {
    const y = f(-(((pps - 1) * pitch) / 2) + i * pitch)
    if (i === 0) {
      items.push(thruHoleRect(-rowSpacing / 2, y, padDia, drillDia, true))
    } else {
      items.push(thruHoleCircle(-rowSpacing / 2, y, padDia, drillDia))
    }
    items.push(thruHoleCircle(rowSpacing / 2, -y, padDia, drillDia))
  }
  return items
}

function bgaPads(cfg, layers) {
  if (!layers.cu) return []
  const { rows, cols, pitch, padDia } = cfg
  const items = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = f(-(cols - 1) * pitch / 2 + c * pitch)
      const y = f(-(rows - 1) * pitch / 2 + r * pitch)
      items.push(`<circle cx="${x}" cy="${y}" r="${f(padDia/2)}" fill="${LAYER_COLORS.cu}" opacity="0.9"/>`)
    }
  }
  return items
}

// ── Bounding box calculator ───────────────────────────────────────────────────

export function getBounds(cfg) {
  const { type, land, body, rowSpacing, pins, pitch, courtyard: cy, thermalPad, rows, cols } = cfg
  let hw = 1, hh = 1

  if (type === 'chip') {
    hw = land.pitch / 2 + land.l / 2 + cy + 0.30
    hh = land.w / 2 + cy + 0.30
  } else if (type === 'soic' || type === 'ssop') {
    const pps = pins / 2
    hw = rowSpacing / 2 + land.l / 2 + cy + 0.50
    hh = ((pps - 1) * pitch) / 2 + land.w / 2 + cy + 0.50
  } else if (type === 'qfp') {
    const halfBody = body.l / 2
    const landOff = halfBody + land.l / 2 + 0.15
    const pps = pins / 4
    const halfSpan = ((pps - 1) * pitch) / 2 + land.w / 2
    hw = hh = Math.max(landOff + land.l / 2 + cy, halfSpan) + 0.80
  } else if (type === 'qfn') {
    hw = hh = body.l / 2 + land.l + cy + 0.50
  } else if (type === 'dip') {
    const pps = pins / 2
    hw = rowSpacing / 2 + cfg.padDia / 2 + cy + 0.50
    hh = ((pps - 1) * pitch) / 2 + cfg.padDia / 2 + cy + 0.50
  } else if (type === 'bga') {
    hw = hh = (cols - 1) * pitch / 2 + cy + 0.80
  } else if (type === 'sot') {
    hw = body.l / 2 + land.l / 2 + cy + 0.50
    hh = body.w / 2 + land.l + cy + 0.80
  } else {
    hw = (body?.l || 5) / 2 + cy + 0.80
    hh = (body?.w || 5) / 2 + cy + 0.80
  }

  return { hw: hw + 0.20, hh: hh + 0.20 }
}

// ── Main SVG builder ──────────────────────────────────────────────────────────

export function buildPreviewSVG(packageName, config, visibleLayers, density = 'nominal') {
  const dm = DENSITY_MULTIPLIERS[density]
  const { hw, hh } = getBounds(config)
  const W = 400
  const H = 380
  const scale = Math.min((W - 40) / (hw * 2), (H - 40) / (hh * 2))
  const cx = W / 2
  const cy = H / 2

  const layers = {
    cu: visibleLayers.cu !== false,
    paste: visibleLayers.paste === true,
    mask: visibleLayers.mask === true,
    silk: visibleLayers.silk !== false,
    fab: visibleLayers.fab === true,
    courtyard: visibleLayers.courtyard !== false,
  }

  // Grid lines (0.5mm)
  const gridLines = []
  const gridStep = 0.5
  for (let gx = -hw; gx <= hw; gx += gridStep) {
    const sx = f(cx + gx * scale)
    gridLines.push(`<line x1="${sx}" y1="0" x2="${sx}" y2="${H}" stroke="var(--border)" stroke-width="0.5" opacity="0.4"/>`)
  }
  for (let gy = -hh; gy <= hh; gy += gridStep) {
    const sy = f(cy + gy * scale)
    gridLines.push(`<line x1="0" y1="${sy}" x2="${W}" y2="${sy}" stroke="var(--border)" stroke-width="0.5" opacity="0.4"/>`)
  }

  // Content group
  let elements = []
  const { type } = config

  // Courtyard first (background)
  if (type === 'chip') elements.push(...chipCourtyard(config, layers))
  else if (type === 'soic' || type === 'ssop') elements.push(...dualRowCourtyard(config, layers))
  else if (type === 'qfp' || type === 'qfn') {
    if (layers.courtyard) {
      const r = type === 'qfp'
        ? f(config.body.l / 2 + config.land.l * 1.5 + config.courtyard + 0.20)
        : f(config.body.l / 2 + config.land.l + config.courtyard + 0.10)
      elements.push(`<rect x="${-r}" y="${-r}" width="${r*2}" height="${r*2}" fill="none" stroke="${LAYER_COLORS.courtyard}" stroke-width="${f(0.05)}" stroke-dasharray="0.2 0.1"/>`)
    }
  }

  // Fab body
  if (type === 'chip') elements.push(...chipFab(config, layers))
  else if (type === 'soic' || type === 'ssop') {
    if (layers.fab) {
      const { pins, pitch, body, rowSpacing, land } = config
      const pps = pins / 2
      const hw2 = f(rowSpacing / 2 + 0.15)
      const hh2 = f(((pps - 1) * pitch) / 2 + 0.30)
      elements.push(`<rect x="${-hw2}" y="${-hh2}" width="${hw2*2}" height="${hh2*2}" fill="none" stroke="${LAYER_COLORS.fab}" stroke-width="0.10"/>`)
    }
  } else if (type === 'qfp') {
    elements.push(...qfpBody(config, layers))
  } else if (type === 'qfn') {
    if (layers.fab) {
      const b = f(config.body.l / 2)
      elements.push(`<rect x="${-b}" y="${-b}" width="${config.body.l}" height="${config.body.l}" fill="none" stroke="${LAYER_COLORS.fab}" stroke-width="0.10"/>`)
    }
  }

  // Pads
  switch (type) {
    case 'chip':
      elements.push(...chipPads(config, dm, layers))
      elements.push(...chipSilk(config, layers))
      break
    case 'soic': case 'ssop':
      elements.push(...dualRowPads(config, dm, layers))
      elements.push(...dualRowSilk(config, layers))
      break
    case 'sot': case 'sot89':
      elements.push(...qfpPads({ ...config, body: { l: config.body.l, w: config.body.l }, pins: 4, land: config.land, courtyard: config.courtyard }, dm, layers))
      break
    case 'qfp':
      elements.push(...qfpPads(config, dm, layers))
      break
    case 'qfn':
      elements.push(...qfnPads(config, dm, layers))
      break
    case 'dip':
      elements.push(...dipPads(config, layers))
      if (layers.silk) {
        const { pins, pitch, rowSpacing, padDia } = config
        const pps = pins / 2
        const hw3 = f(rowSpacing / 2 + padDia / 2 + 0.30)
        const hh3 = f(((pps - 1) * pitch) / 2 + padDia / 2 + 0.30)
        elements.push(`<rect x="${-hw3}" y="${-hh3}" width="${hw3*2}" height="${hh3*2}" fill="none" stroke="${LAYER_COLORS.silk}" stroke-width="0.12"/>`)
      }
      break
    case 'bga':
      elements.push(...bgaPads(config, layers))
      break
  }

  // Cross-hair origin
  elements.push(`<line x1="-0.30" y1="0" x2="0.30" y2="0" stroke="rgba(255,255,255,0.15)" stroke-width="0.05"/>`)
  elements.push(`<line x1="0" y1="-0.30" x2="0" y2="0.30" stroke="rgba(255,255,255,0.15)" stroke-width="0.05"/>`)

  const content = elements.join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="var(--bg-2, #0e0e1a)"/>
  ${gridLines.join('\n  ')}
  <g transform="translate(${cx},${cy}) scale(${f(scale)},${f(scale)})">
    ${content}
  </g>
  <text x="8" y="${H - 8}" font-family="monospace" font-size="10" fill="rgba(255,255,255,0.3)">${packageName} · scale 1:1 · mm</text>
</svg>`
}
