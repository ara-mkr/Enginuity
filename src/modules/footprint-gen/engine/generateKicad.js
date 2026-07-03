import { DENSITY_MULTIPLIERS } from '../../../config/packages'

const f = (n) => parseFloat(n.toFixed(4))
const fs = (n) => n.toFixed(4)

// ── Pad generators ────────────────────────────────────────────────────────────

function smtPad(num, x, y, pw, ph, rotate = 0) {
  const shape = num === 1 ? 'rect' : 'roundrect'
  const rr = num === 1 ? '' : '\n    (roundrect_rratio 0.25)'
  const rot = rotate !== 0 ? ` ${rotate}` : ''
  return `  (pad "${num}" smd ${shape} (at ${fs(x)} ${fs(y)}${rot})
    (size ${fs(pw)} ${fs(ph)}) (layers "F.Cu" "F.Paste" "F.Mask")${rr})`
}

function thruPad(num, x, y, padDia, drillDia, square = false) {
  const shape = square ? 'rect' : 'circle'
  return `  (pad "${num}" thru_hole ${shape} (at ${fs(x)} ${fs(y)})
    (size ${fs(padDia)} ${fs(padDia)}) (drill ${fs(drillDia)}) (layers "*.Cu" "*.Mask"))`
}

// ── Chip (0402, 0603, etc.) ───────────────────────────────────────────────────

function generateChip(cfg, dm) {
  const pw = f(cfg.land.l * dm.l)
  const ph = f(cfg.land.w * dm.w)
  const x1 = f(-cfg.land.pitch / 2)
  const x2 = f(cfg.land.pitch / 2)
  return [smtPad(1, x1, 0, pw, ph), smtPad(2, x2, 0, pw, ph)].join('\n')
}

function chipCourtyard(cfg) {
  const cx = f(cfg.land.pitch / 2 + cfg.land.l / 2 + cfg.courtyard)
  const cy = f(cfg.land.w / 2 + cfg.courtyard)
  return courtyard(cx, cy)
}

function chipSilk(cfg) {
  const bx = f(cfg.body.l / 2)
  const by = f(cfg.body.w / 2)
  const gap = f(cfg.land.w / 2 + 0.05)
  return [
    line(-bx, gap, -bx, by + 0.10, 'F.SilkS', 0.12),
    line(-bx, -(by + 0.10), -bx, -gap, 'F.SilkS', 0.12),
    line(bx, gap, bx, by + 0.10, 'F.SilkS', 0.12),
    line(bx, -(by + 0.10), bx, -gap, 'F.SilkS', 0.12),
  ].join('\n')
}

function chipFab(cfg) {
  const bx = f(cfg.body.l / 2)
  const by = f(cfg.body.w / 2)
  return rect(-bx, -by, bx, by, 'F.Fab', 0.10)
}

// ── Dual-row (SOIC, SSOP, TSSOP) ─────────────────────────────────────────────

function generateDualRow(cfg, dm) {
  const { pins, pitch, land, rowSpacing } = cfg
  const pps = pins / 2
  const pw = f(land.l * dm.l)
  const ph = f(land.w * dm.w)
  const xL = f(-rowSpacing / 2)
  const xR = f(rowSpacing / 2)
  const lines = []
  for (let i = 0; i < pps; i++) {
    const y = f(-(((pps - 1) * pitch) / 2) + i * pitch)
    lines.push(smtPad(i + 1, xL, y, pw, ph))
    lines.push(smtPad(pins - i, xR, -y, pw, ph))
  }
  return lines.join('\n')
}

function dualRowCourtyard(cfg) {
  const cx = f(cfg.rowSpacing / 2 + cfg.land.l / 2 + cfg.courtyard)
  const pps = cfg.pins / 2
  const cy = f(((pps - 1) * cfg.pitch) / 2 + cfg.land.w / 2 + cfg.courtyard)
  return courtyard(cx, cy)
}

function dualRowSilk(cfg, packageName) {
  const { pins, pitch, body, land, rowSpacing } = cfg
  const pps = pins / 2
  const halfH = f(((pps - 1) * pitch) / 2 + land.w / 2 + 0.30)
  const halfW = f(body.w / 2 + 0.10)
  const bh = f(body.l / 2)
  const notchX = f(-halfW)
  const notchR = 0.30

  return [
    line(-halfW, -halfH, halfW, -halfH, 'F.SilkS'),
    line(halfW, -halfH, halfW, halfH, 'F.SilkS'),
    line(halfW, halfH, -halfW, halfH, 'F.SilkS'),
    line(-halfW, halfH, -halfW, -bh + notchR, 'F.SilkS'),
    arc(notchX + notchR, -bh, notchR, 180, 270, 'F.SilkS'),
  ].join('\n')
}

function dualRowFab(cfg) {
  const { pins, pitch, body, rowSpacing } = cfg
  const pps = pins / 2
  const hw = f(rowSpacing / 2 + 0.15)
  const hh = f(((pps - 1) * pitch) / 2 + 0.30)
  return rect(-hw, -hh, hw, hh, 'F.Fab', 0.10)
}

// ── SOT-23 family ─────────────────────────────────────────────────────────────

function generateSOT(cfg, dm) {
  const { pins, pitch, land, pinLayout } = cfg
  const pw = f(land.l * dm.l)
  const ph = f(land.w * dm.w)
  const pads = []

  if (pinLayout === 'sot23-3') {
    // Pin 1: bottom-left, Pin 2: bottom-right (base), Pin 3: top-center (collector/drain)
    pads.push(smtPad(1, -f(pitch / 2), f(1.30), pw, ph))
    pads.push(smtPad(2, f(pitch / 2), f(1.30), pw, ph))
    pads.push(smtPad(3, 0, -f(1.30), pw, ph))
  } else if (pinLayout === 'sot23-5' || pinLayout === 'sot23-6') {
    // Left side: 3 pins, right side: 2 or 3 pins
    const leftPins = pins === 5 ? 3 : 3
    const rightPins = pins - leftPins
    const leftX = -f(cfg.body.l / 2 - land.l / 2 + 0.30)
    const rightX = f(cfg.body.l / 2 - land.l / 2 + 0.30)
    for (let i = 0; i < leftPins; i++) {
      const y = f(-(leftPins - 1) * pitch / 2 + i * pitch)
      pads.push(smtPad(leftPins - i, leftX, y, pw, ph))
    }
    for (let i = 0; i < rightPins; i++) {
      const y = f(-(rightPins - 1) * pitch / 2 + i * pitch)
      pads.push(smtPad(leftPins + i + 1, rightX, -y, pw, ph))
    }
  }
  return pads.join('\n')
}

function sotCourtyard(cfg) {
  const cx = f(cfg.body.l / 2 + cfg.courtyard + 0.30)
  const cy = f(cfg.body.w / 2 + cfg.courtyard + cfg.land.l / 2)
  return courtyard(cx, cy)
}

// ── SOT-223 ───────────────────────────────────────────────────────────────────

function generateSOT223(cfg, dm) {
  const { pitch, land, tabLand } = cfg
  const pw = f(land.l * dm.l)
  const ph = f(land.w * dm.w)
  const x1 = f(-pitch)
  const x2 = 0
  const x3 = f(pitch)
  const yFront = f(cfg.body.w / 2 + land.l / 2)
  const yBack = f(-(cfg.body.w / 2 + tabLand.w / 2 - 0.50))

  return [
    smtPad(1, x1, yFront, pw, ph),
    smtPad(2, x2, yFront, pw, ph),
    smtPad(3, x3, yFront, pw, ph),
    `  (pad "4" smd rect (at 0 ${fs(yBack)})\n    (size ${fs(tabLand.l * dm.l)} ${fs(tabLand.w * dm.w)}) (layers "F.Cu" "F.Paste" "F.Mask"))`,
  ].join('\n')
}

// ── QFP ───────────────────────────────────────────────────────────────────────

function generateQFP(cfg, dm) {
  const { pins, pitch, land, body } = cfg
  const pps = pins / 4
  const pw = f(land.l * dm.l)
  const ph = f(land.w * dm.w)
  const halfBody = f(body.l / 2)
  const landOffset = f(halfBody + pw / 2 + 0.15)
  const lines = []
  let padNum = 1

  // Bottom (pin 1 starts bottom-left, going left)
  for (let i = 0; i < pps; i++) {
    const x = f(-(((pps - 1) * pitch) / 2) + i * pitch)
    lines.push(smtPad(padNum++, x, landOffset, pw, ph))
  }
  // Right
  for (let i = 0; i < pps; i++) {
    const y = f((((pps - 1) * pitch) / 2) - i * pitch)
    lines.push(smtPad(padNum++, landOffset, y, ph, pw))
  }
  // Top
  for (let i = 0; i < pps; i++) {
    const x = f((((pps - 1) * pitch) / 2) - i * pitch)
    lines.push(smtPad(padNum++, x, -landOffset, pw, ph))
  }
  // Left
  for (let i = 0; i < pps; i++) {
    const y = f(-(((pps - 1) * pitch) / 2) + i * pitch)
    lines.push(smtPad(padNum++, -landOffset, y, ph, pw))
  }
  return lines.join('\n')
}

function qfpCourtyard(cfg) {
  const { pins, pitch, body, land, courtyard: cy } = cfg
  const pps = pins / 4
  const halfSpan = f(((pps - 1) * pitch) / 2 + land.w / 2 + cy)
  const halfBody = f(body.l / 2 + land.l + cy)
  const r = Math.max(halfSpan, halfBody)
  return courtyard(r, r)
}

function qfpSilk(cfg) {
  const b = f(cfg.body.l / 2)
  const notchR = 0.50
  return [
    line(-b, -b + notchR, b, -b, 'F.SilkS'),
    line(b, -b, b, b, 'F.SilkS'),
    line(b, b, -b, b, 'F.SilkS'),
    line(-b, b, -b, -b + notchR, 'F.SilkS'),
    arc(-b + notchR, -b, notchR, 180, 270, 'F.SilkS'),
  ].join('\n')
}

// ── QFN ───────────────────────────────────────────────────────────────────────

function generateQFN(cfg, dm) {
  const { pins, pitch, land, body } = cfg
  const pps = pins / 4
  const pw = f(land.l * dm.l)
  const ph = f(land.w * dm.w)
  const edgeOffset = f(body.l / 2 + pw / 2 - 0.05)
  const lines = []
  let padNum = 1

  // Bottom
  for (let i = 0; i < pps; i++) {
    const x = f(-(((pps - 1) * pitch) / 2) + i * pitch)
    lines.push(smtPad(padNum++, x, edgeOffset, pw, ph))
  }
  // Right
  for (let i = 0; i < pps; i++) {
    const y = f((((pps - 1) * pitch) / 2) - i * pitch)
    lines.push(smtPad(padNum++, edgeOffset, y, ph, pw))
  }
  // Top
  for (let i = 0; i < pps; i++) {
    const x = f((((pps - 1) * pitch) / 2) - i * pitch)
    lines.push(smtPad(padNum++, x, -edgeOffset, pw, ph))
  }
  // Left
  for (let i = 0; i < pps; i++) {
    const y = f(-(((pps - 1) * pitch) / 2) + i * pitch)
    lines.push(smtPad(padNum++, -edgeOffset, y, ph, pw))
  }
  return lines.join('\n')
}

function generateThermalPad(cfg) {
  const { thermalPad, pins } = cfg
  if (!thermalPad) return ''
  const lines = [`  (pad "${pins + 1}" smd rect (at 0 0)
    (size ${fs(thermalPad.l)} ${fs(thermalPad.w)}) (layers "F.Cu" "F.Paste" "F.Mask"))`]

  const viaGrid = Math.max(2, Math.floor(thermalPad.l / 0.65))
  const step = thermalPad.l / (viaGrid + 1)
  for (let r = 0; r < viaGrid; r++) {
    for (let c = 0; c < viaGrid; c++) {
      const vx = f(-thermalPad.l / 2 + step * (c + 1))
      const vy = f(-thermalPad.w / 2 + step * (r + 1))
      lines.push(`  (pad "" thru_hole circle (at ${fs(vx)} ${fs(vy)})
    (size 0.40 0.40) (drill 0.20) (layers "*.Cu" "*.Mask"))`)
    }
  }
  return lines.join('\n')
}

function qfnCourtyard(cfg) {
  const { body, land, courtyard: cy } = cfg
  const r = f(body.l / 2 + land.l + cy + 0.10)
  return courtyard(r, r)
}

function qfnSilk(cfg) {
  const b = f(cfg.body.l / 2 - 0.30)
  const notchR = 0.30
  return [
    line(-b + notchR, -b, b, -b, 'F.SilkS', 0.12),
    line(b, -b, b, b, 'F.SilkS', 0.12),
    line(b, b, -b, b, 'F.SilkS', 0.12),
    line(-b, b, -b, -b + notchR, 'F.SilkS', 0.12),
    `  (fp_arc (start ${fs(-b)} ${fs(-b)}) (mid ${fs(-b + notchR * 0.293)} ${fs(-b + notchR * 0.293 - notchR)}) (end ${fs(-b + notchR)} ${fs(-b)}) (layer "F.SilkS") (width 0.12))`,
  ].join('\n')
}

// ── DIP ───────────────────────────────────────────────────────────────────────

function generateDIP(cfg) {
  const { pins, pitch, rowSpacing, drillDia, padDia } = cfg
  const pps = pins / 2
  const lines = []
  for (let i = 0; i < pps; i++) {
    const y = f(-(((pps - 1) * pitch) / 2) + i * pitch)
    lines.push(thruPad(i + 1, f(-rowSpacing / 2), y, padDia, drillDia, i === 0))
    lines.push(thruPad(pins - i, f(rowSpacing / 2), -y, padDia, drillDia))
  }
  return lines.join('\n')
}

function dipCourtyard(cfg) {
  const { pins, pitch, rowSpacing, padDia, courtyard: cy } = cfg
  const pps = pins / 2
  const cx = f(rowSpacing / 2 + padDia / 2 + cy)
  const ccy = f(((pps - 1) * pitch) / 2 + padDia / 2 + cy)
  return courtyard(cx, ccy)
}

function dipSilk(cfg) {
  const { pins, pitch, rowSpacing, padDia } = cfg
  const pps = pins / 2
  const hw = f(rowSpacing / 2 + padDia / 2 + 0.30)
  const hh = f(((pps - 1) * pitch) / 2 + padDia / 2 + 0.30)
  const notchR = 0.60
  return [
    line(-hw + notchR, -hh, hw, -hh, 'F.SilkS'),
    line(hw, -hh, hw, hh, 'F.SilkS'),
    line(hw, hh, -hw, hh, 'F.SilkS'),
    line(-hw, hh, -hw, -hh + notchR, 'F.SilkS'),
    arc(-hw + notchR, -hh, notchR, 180, 270, 'F.SilkS'),
  ].join('\n')
}

// ── TO packages ───────────────────────────────────────────────────────────────

function generateTO(cfg) {
  const { pins, pitch, drillDia, padDia } = cfg
  const pps = pins
  const lines = []
  for (let i = 0; i < pps; i++) {
    const x = f(-(((pps - 1) * pitch) / 2) + i * pitch)
    lines.push(thruPad(i + 1, x, 0, padDia, drillDia, i === 0))
  }
  return lines.join('\n')
}

// ── BGA ───────────────────────────────────────────────────────────────────────

function generateBGA(cfg) {
  const { rows, cols, pitch, padDia } = cfg
  const lines = []
  const letters = 'ABCDEFGHJKLMNPRTUVWY'
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = f(-(cols - 1) * pitch / 2 + c * pitch)
      const y = f(-(rows - 1) * pitch / 2 + r * pitch)
      const label = `${letters[r]}${c + 1}`
      lines.push(`  (pad "${label}" smd circle (at ${fs(x)} ${fs(y)})
    (size ${fs(padDia)} ${fs(padDia)}) (layers "F.Cu" "F.Paste" "F.Mask"))`)
    }
  }
  return lines.join('\n')
}

function bgaCourtyard(cfg) {
  const { rows, cols, pitch, courtyard: cy } = cfg
  const cx = f((cols - 1) * pitch / 2 + cy + 0.60)
  const ccy = f((rows - 1) * pitch / 2 + cy + 0.60)
  return courtyard(cx, ccy)
}

// ── SMD Power (TO-263, TO-252) ────────────────────────────────────────────────

function generateSMDPower(cfg, dm) {
  const { pins, pitch, land, tabLand } = cfg
  const pw = f(land.l * dm.l)
  const ph = f(land.w * dm.w)
  const yFront = f(cfg.body.w / 2 - land.l / 2 + 0.50)
  const lines = []
  for (let i = 0; i < pins - 1; i++) {
    const x = f(-(((pins - 2) * pitch) / 2) + i * pitch)
    lines.push(smtPad(i + 1, x, yFront, pw, ph))
  }
  lines.push(`  (pad "${pins}" smd rect (at 0 ${fs(-f(cfg.body.w / 2 - tabLand.w / 2))})
    (size ${fs(tabLand.l * dm.l)} ${fs(tabLand.w * dm.w)}) (layers "F.Cu" "F.Paste" "F.Mask"))`)
  return lines.join('\n')
}

// ── Layer helpers ─────────────────────────────────────────────────────────────

function line(x1, y1, x2, y2, layer = 'F.SilkS', width = 0.12) {
  return `  (fp_line (start ${fs(x1)} ${fs(y1)}) (end ${fs(x2)} ${fs(y2)}) (layer "${layer}") (width ${width}))`
}

function rect(x1, y1, x2, y2, layer = 'F.SilkS', width = 0.12) {
  return [
    line(x1, y1, x2, y1, layer, width),
    line(x2, y1, x2, y2, layer, width),
    line(x2, y2, x1, y2, layer, width),
    line(x1, y2, x1, y1, layer, width),
  ].join('\n')
}

function courtyard(cx, cy) {
  return rect(-cx, -cy, cx, cy, 'F.Courtyard', 0.05)
}

function arc(cx, cy, r, startAngle, endAngle, layer = 'F.SilkS', width = 0.12) {
  const startRad = (startAngle * Math.PI) / 180
  const endRad = (endAngle * Math.PI) / 180
  const sx = f(cx + r * Math.cos(startRad))
  const sy = f(cy + r * Math.sin(startRad))
  const ex = f(cx + r * Math.cos(endRad))
  const ey = f(cy + r * Math.sin(endRad))
  const midAngle = (startAngle + endAngle) / 2
  const midRad = (midAngle * Math.PI) / 180
  const mx = f(cx + r * Math.cos(midRad))
  const my = f(cy + r * Math.sin(midRad))
  return `  (fp_arc (start ${fs(sx)} ${fs(sy)}) (mid ${fs(mx)} ${fs(my)}) (end ${fs(ex)} ${fs(ey)}) (layer "${layer}") (width ${width}))`
}

function refAndValue(packageName) {
  return `  (fp_text reference "REF**" (at 0 -3.00) (layer "F.SilkS") (effects (font (size 1 1) (thickness 0.15))))
  (fp_text value "${packageName}" (at 0 3.00) (layer "F.Fab") (effects (font (size 1 1) (thickness 0.15))))`
}

// ── Main entry ────────────────────────────────────────────────────────────────

export function generateKicadMod(packageName, config, options = {}) {
  const { density = 'nominal' } = options
  const dm = DENSITY_MULTIPLIERS[density]
  const timestamp = new Date().toISOString()

  let pads = ''
  let layers = ''

  switch (config.type) {
    case 'chip':
      pads = generateChip(config, dm)
      layers = [chipCourtyard(config), chipSilk(config), chipFab(config)].join('\n')
      break
    case 'soic':
    case 'ssop':
      pads = generateDualRow(config, dm)
      layers = [dualRowCourtyard(config), dualRowSilk(config, packageName), dualRowFab(config)].join('\n')
      break
    case 'sot':
      pads = generateSOT(config, dm)
      layers = sotCourtyard(config)
      break
    case 'sot223':
      pads = generateSOT223(config, dm)
      layers = courtyard(
        f(config.body.l / 2 + config.courtyard),
        f(config.body.w / 2 + config.land.l / 2 + config.courtyard)
      )
      break
    case 'sot89':
      pads = generateSOT(config, dm)
      layers = sotCourtyard(config)
      break
    case 'qfp':
      pads = generateQFP(config, dm)
      layers = [qfpCourtyard(config), qfpSilk(config)].join('\n')
      break
    case 'qfn':
      pads = generateQFN(config, dm) + '\n' + generateThermalPad(config)
      layers = [qfnCourtyard(config), qfnSilk(config)].join('\n')
      break
    case 'dip':
      pads = generateDIP(config)
      layers = [dipCourtyard(config), dipSilk(config)].join('\n')
      break
    case 'to':
    case 'to220':
      pads = generateTO(config)
      layers = courtyard(
        f(config.pins * config.pitch / 2 + config.padDia / 2 + config.courtyard),
        f(config.padDia / 2 + config.courtyard)
      )
      break
    case 'smd_power':
      pads = generateSMDPower(config, dm)
      layers = courtyard(
        f(config.body.l / 2 + config.courtyard),
        f(config.body.w / 2 + config.courtyard)
      )
      break
    case 'bga':
      pads = generateBGA(config)
      layers = bgaCourtyard(config)
      break
    default:
      pads = generateChip(config, dm)
      layers = chipCourtyard(config)
  }

  return `(footprint "${packageName}" (version 20230101)
  (generator "enginguity-footprint-gen")
  (layer "F.Cu")
  (descr "${config.category} ${packageName} IPC-7351 ${density}")
  (tags "${packageName} ${config.category} ${config.type}")
  (attr smd)
${refAndValue(packageName)}
${pads}
${layers}
)`
}
