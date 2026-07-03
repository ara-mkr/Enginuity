import { useRef, useEffect, useState } from 'react'

const GRID = 20
const COMP_W = 60
const COMP_H = 30

// ── Symbol drawers ────────────────────────────────────────────────────────────

function drawResistor(ctx, x, y, w, color, ieee = true) {
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x, y)
  if (ieee) {
    // Zigzag
    const seg = w / 8
    ctx.lineTo(x + seg, y)
    for (let i = 0; i < 6; i++) {
      ctx.lineTo(x + seg * (1.5 + i * 0.75), y + (i % 2 === 0 ? -8 : 8))
    }
    ctx.lineTo(x + w - seg, y)
    ctx.lineTo(x + w, y)
  } else {
    // IEC rectangle
    ctx.moveTo(x, y)
    ctx.lineTo(x + 10, y)
    ctx.rect(x + 10, y - 8, w - 20, 16)
    ctx.moveTo(x + w - 10, y)
    ctx.lineTo(x + w, y)
  }
  ctx.stroke()
}

function drawCapacitor(ctx, x, y, w, color) {
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  const mid = x + w / 2
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(mid - 6, y)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(mid + 6, y)
  ctx.lineTo(x + w, y)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(mid - 6, y - 12)
  ctx.lineTo(mid - 6, y + 12)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(mid + 6, y - 12)
  ctx.lineTo(mid + 6, y + 12)
  ctx.stroke()
}

function drawInductor(ctx, x, y, w, color) {
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  const humps = 4
  const humpW = (w - 20) / humps
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + 10, y)
  for (let i = 0; i < humps; i++) {
    const cx = x + 10 + i * humpW + humpW / 2
    ctx.arc(cx, y, humpW / 2, Math.PI, 0, false)
  }
  ctx.lineTo(x + w, y)
  ctx.stroke()
}

function drawVoltageSource(ctx, x, y, color) {
  const r = 18
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(x, y, r, 0, 2 * Math.PI)
  ctx.stroke()
  // + and -
  ctx.fillStyle = color
  ctx.font = '12px JetBrains Mono, monospace'
  ctx.textAlign = 'center'
  ctx.fillText('+', x, y - 5)
  ctx.fillText('−', x, y + 10)
  // leads
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.lineTo(x, y - r - 10)
  ctx.moveTo(x, y + r)
  ctx.lineTo(x, y + r + 10)
  ctx.stroke()
}

function drawGround(ctx, x, y, color) {
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, y + 10)
  const widths = [16, 10, 4]
  widths.forEach((w, i) => {
    ctx.moveTo(x - w / 2, y + 10 + i * 5)
    ctx.lineTo(x + w / 2, y + 10 + i * 5)
  })
  ctx.stroke()
}

// ── Main SchematicView ────────────────────────────────────────────────────────

export default function SchematicView({ components = [], selectedId, onSelect }) {
  const canvasRef = useRef(null)
  const [offset, setOffset] = useState({ x: 40, y: 100 })
  const [scale, setScale] = useState(1)
  const [dragging, setDragging] = useState(null)
  const accentColor = '#7ab4c4'
  const mutedColor = '#3a3c55'
  const textColor = '#e2e4f0'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { width, height } = canvas

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#080808'
    ctx.fillRect(0, 0, width, height)

    // Grid
    ctx.strokeStyle = '#1f1f35'
    ctx.lineWidth = 0.5
    for (let gx = offset.x % (GRID * scale); gx < width; gx += GRID * scale) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, height); ctx.stroke()
    }
    for (let gy = offset.y % (GRID * scale); gy < height; gy += GRID * scale) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width, gy); ctx.stroke()
    }

    ctx.save()
    ctx.translate(offset.x, offset.y)
    ctx.scale(scale, scale)

    // Auto-layout: place components left to right
    const spacing = 120
    components.forEach((comp, i) => {
      const x = i * spacing
      const y = 0
      const isSelected = comp.id === selectedId
      const color = isSelected ? '#b09470' : accentColor

      ctx.save()
      ctx.translate(x, y)

      const type = comp.type?.toUpperCase()
      if (type === 'R' || type === 'RES') {
        drawResistor(ctx, 0, 0, COMP_W + 20, color)
      } else if (type === 'C' || type === 'CAP') {
        drawCapacitor(ctx, 0, 0, COMP_W + 20, color)
      } else if (type === 'L' || type === 'IND') {
        drawInductor(ctx, 0, 0, COMP_W + 20, color)
      } else if (type === 'V' || type === 'VS') {
        drawVoltageSource(ctx, 40, 0, color)
        drawGround(ctx, 40, 30, mutedColor)
      } else if (type === 'I' || type === 'IS') {
        // Current source: circle with arrow
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(40, 0, 18, 0, 2 * Math.PI); ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(40, -10); ctx.lineTo(40, 10)
        ctx.moveTo(35, 5); ctx.lineTo(40, 10); ctx.lineTo(45, 5)
        ctx.stroke()
      } else {
        // Generic box
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        ctx.strokeRect(10, -15, COMP_W, 30)
        ctx.fillStyle = color
        ctx.font = '10px JetBrains Mono, monospace'
        ctx.textAlign = 'center'
        ctx.fillText(type ?? '?', 40, 5)
      }

      // Label
      ctx.fillStyle = isSelected ? '#b09470' : textColor
      ctx.font = `11px JetBrains Mono, monospace`
      ctx.textAlign = 'center'
      ctx.fillText(`${comp.id}`, 40, -24)
      ctx.fillStyle = mutedColor
      ctx.font = '10px JetBrains Mono, monospace'
      ctx.fillText(formatValue(comp.value, comp.unit), 40, -13)

      // Node dots
      if (comp.nodes) {
        comp.nodes.forEach((n, ni) => {
          ctx.fillStyle = n === '0' ? mutedColor : color
          ctx.beginPath()
          ctx.arc(ni === 0 ? 0 : COMP_W + 20, 0, 3, 0, 2 * Math.PI)
          ctx.fill()
        })
      }

      ctx.restore()
    })

    ctx.restore()
  }, [components, selectedId, offset, scale])

  const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale((s) => Math.max(0.3, Math.min(3, s * delta)))
  }

  const handleMouseDown = (e) => {
    setDragging({ x: e.clientX - offset.x, y: e.clientY - offset.y })

    // Hit test for component selection
    if (onSelect) {
      const rect = canvasRef.current.getBoundingClientRect()
      const mx = (e.clientX - rect.left - offset.x) / scale
      const my = (e.clientY - rect.top - offset.y) / scale
      const spacing = 120
      const i = Math.floor((mx + 30) / spacing)
      if (i >= 0 && i < components.length) {
        onSelect(components[i].id)
      }
    }
  }

  const handleMouseMove = (e) => {
    if (!dragging) return
    setOffset({ x: e.clientX - dragging.x, y: e.clientY - dragging.y })
  }

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={260}
      style={{ width: '100%', height: 260, cursor: dragging ? 'grabbing' : 'grab', display: 'block', borderRadius: 8 }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setDragging(null)}
      onMouseLeave={() => setDragging(null)}
    />
  )
}

function formatValue(val, unit) {
  if (!val) return ''
  const n = parseFloat(val)
  if (isNaN(n)) return val
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M${unit ?? ''}`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k${unit ?? ''}`
  if (n >= 1) return `${n.toFixed(2)}${unit ?? ''}`
  if (n >= 1e-3) return `${(n * 1e3).toFixed(1)}m${unit ?? ''}`
  if (n >= 1e-6) return `${(n * 1e6).toFixed(1)}µ${unit ?? ''}`
  if (n >= 1e-9) return `${(n * 1e9).toFixed(1)}n${unit ?? ''}`
  if (n >= 1e-12) return `${(n * 1e12).toFixed(1)}p${unit ?? ''}`
  return val
}
