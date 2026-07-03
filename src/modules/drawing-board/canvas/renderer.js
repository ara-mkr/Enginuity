// src/modules/drawing-board/canvas/renderer.js

const imageCache = new Map()

const OHMA_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M50,15 C32,15 25,28 25,48 C25,68 35,85 50,85 C65,85 75,68 75,48 C75,28 68,15 50,15 Z" fill="none" stroke="#9ca3af" stroke-width="4" stroke-linejoin="round"/>
  <path d="M30,22 L18,12 L24,30" fill="none" stroke="#9ca3af" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M70,22 L82,12 L76,30" fill="none" stroke="#9ca3af" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="40" cy="42" r="10" fill="none" stroke="#9ca3af" stroke-width="4"/>
  <circle cx="40" cy="42" r="3" fill="#9ca3af"/>
  <circle cx="60" cy="42" r="10" fill="none" stroke="#9ca3af" stroke-width="4"/>
  <circle cx="60" cy="42" r="3" fill="#9ca3af"/>
  <polygon points="50,48 45,55 55,55" fill="#9ca3af"/>
  <path d="M25,52 C28,60 32,65 38,68" fill="none" stroke="#9ca3af" stroke-width="4" stroke-linecap="round"/>
  <path d="M75,52 C72,60 68,65 62,68" fill="none" stroke="#9ca3af" stroke-width="4" stroke-linecap="round"/>
  <path d="M45,64 C47,66 50,67 50,67 C50,67 53,66 55,64" fill="none" stroke="#9ca3af" stroke-width="3" stroke-linecap="round"/>
  <path d="M41,71 C45,74 50,75 50,75 C50,75 55,74 59,71" fill="none" stroke="#9ca3af" stroke-width="3" stroke-linecap="round"/>
</svg>`

let ohmaImg = null
function getOhmaImage() {
  if (ohmaImg) return ohmaImg
  ohmaImg = new Image()
  const svgBlob = new Blob([OHMA_SVG], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)
  ohmaImg.src = url
  return ohmaImg
}

export function drawMascotAndWatermark(ctx) {
  const img = getOhmaImage()
  if (!img.complete) {
    img.onload = () => {
      window.dispatchEvent(new CustomEvent('enginguity_drawingboard_redraw'))
    }
    return
  }
  
  ctx.save()
  // Draw SVG image at (0, 0) center in world coordinates
  const size = 120
  ctx.globalAlpha = 0.05
  ctx.drawImage(img, -size / 2, -size / 2 - 20, size, size)
  
  // Draw "Draw anything." text
  ctx.globalAlpha = 0.12
  ctx.fillStyle = '#9ca3af'
  ctx.font = '400 14px Geist, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('Draw anything.', 0, size / 2)
  ctx.restore()
}

export function drawGrid(ctx, width, height, transform) {
  if (transform.scale < 0.3) return
  
  ctx.save()
  ctx.fillStyle = '#2a2a2a'
  
  const spacing = 24
  
  // Calculate top-left and bottom-right in world coordinates
  const startX = Math.floor((-transform.x) / transform.scale / spacing) * spacing
  const startY = Math.floor((-transform.y) / transform.scale / spacing) * spacing
  const endX = startX + (width / transform.scale) + spacing * 2
  const endY = startY + (height / transform.scale) + spacing * 2
  
  for (let x = startX; x <= endX; x += spacing) {
    for (let y = startY; y <= endY; y += spacing) {
      ctx.beginPath()
      ctx.arc(x, y, 0.75, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

export function hexToRgba(hex, opacity) {
  if (!hex) return 'rgba(0,0,0,0)'
  if (hex.startsWith('rgba')) return hex
  
  hex = hex.replace('#', '')
  if (hex.length === 3) {
    hex = hex.replace(/(.)/g, '$1$1')
  }
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

export function darken(hex, percent) {
  if (!hex || hex === 'transparent' || hex.startsWith('rgba')) return '#d1d5db'
  hex = hex.replace('#', '')
  if (hex.length === 3) {
    hex = hex.replace(/(.)/g, '$1$1')
  }
  let r = parseInt(hex.substr(0, 2), 16)
  let g = parseInt(hex.substr(2, 2), 16)
  let b = parseInt(hex.substr(4, 2), 16)
  
  r = Math.max(0, Math.floor(r * (1 - percent / 100)))
  g = Math.max(0, Math.floor(g * (1 - percent / 100)))
  b = Math.max(0, Math.floor(b * (1 - percent / 100)))
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export function wrapText(ctx, text, maxWidth) {
  if (!text) return []
  const paragraphs = String(text).split('\n')
  const lines = []
  
  paragraphs.forEach(para => {
    const words = para.split(' ')
    let currentLine = ''
    
    words.forEach(word => {
      const testLine = currentLine ? currentLine + ' ' + word : word
      const metrics = ctx.measureText(testLine)
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    })
    if (currentLine) {
      lines.push(currentLine)
    }
  })
  
  return lines
}

export function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export function drawShapePath(ctx, shape) {
  const { x, y, width: w, height: h, cornerRadius = 0 } = shape
  
  switch (shape.shape) {
    case 'rect':
      if (cornerRadius > 0) {
        roundedRect(ctx, x, y, w, h, cornerRadius)
      } else {
        ctx.beginPath()
        ctx.rect(x, y, w, h)
        ctx.closePath()
      }
      break
    case 'circle': {
      const cx = x + w / 2
      const cy = y + h / 2
      const rx = Math.abs(w / 2)
      const ry = Math.abs(h / 2)
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.closePath()
      break
    }
    case 'triangle':
      ctx.beginPath()
      ctx.moveTo(x + w / 2, y)
      ctx.lineTo(x + w, y + h)
      ctx.lineTo(x, y + h)
      ctx.closePath()
      break
    case 'diamond':
      ctx.beginPath()
      ctx.moveTo(x + w / 2, y)
      ctx.lineTo(x + w, y + h / 2)
      ctx.lineTo(x + w / 2, y + h)
      ctx.lineTo(x, y + h / 2)
      ctx.closePath()
      break
    case 'star': {
      const cx = x + w / 2
      const cy = y + h / 2
      const spikes = 5
      const outerRadius = Math.min(Math.abs(w), Math.abs(h)) / 2
      const innerRadius = outerRadius * 0.4
      let rot = (Math.PI / 2) * 3
      let step = Math.PI / spikes
      
      ctx.beginPath()
      ctx.moveTo(cx, cy - outerRadius)
      for (let i = 0; i < spikes; i++) {
        let x1 = cx + Math.cos(rot) * outerRadius
        let y1 = cy + Math.sin(rot) * outerRadius
        ctx.lineTo(x1, y1)
        rot += step
        
        let x2 = cx + Math.cos(rot) * innerRadius
        let y2 = cy + Math.sin(rot) * innerRadius
        ctx.lineTo(x2, y2)
        rot += step
      }
      ctx.closePath()
      break
    }
    case 'hexagon': {
      const cx = x + w / 2
      const cy = y + h / 2
      const r = Math.min(Math.abs(w), Math.abs(h)) / 2
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i
        const vx = cx + Math.cos(angle) * r
        const vy = cy + Math.sin(angle) * r
        if (i === 0) ctx.moveTo(vx, vy)
        else ctx.lineTo(vx, vy)
      }
      ctx.closePath()
      break
    }
    case 'parallelogram': {
      const skew = w * 0.2
      ctx.beginPath()
      ctx.moveTo(x + skew, y)
      ctx.lineTo(x + w, y)
      ctx.lineTo(x + w - skew, y + h)
      ctx.lineTo(x, y + h)
      ctx.closePath()
      break
    }
    case 'cylinder': {
      const rx = Math.abs(w / 2)
      const ry = Math.min(Math.abs(h * 0.15), Math.abs(w * 0.2))
      const cx = x + w / 2
      ctx.beginPath()
      ctx.ellipse(cx, y + h - ry, rx, ry, 0, 0, Math.PI)
      ctx.lineTo(x + w, y + ry)
      ctx.ellipse(cx, y + ry, rx, ry, 0, 0, Math.PI * 2)
      ctx.lineTo(x, y + h - ry)
      ctx.closePath()
      break
    }
    default:
      ctx.beginPath()
      ctx.rect(x, y, w, h)
      ctx.closePath()
      break
  }
}

export function renderTextInShape(ctx, shape) {
  if (!shape.label) return
  ctx.save()
  
  ctx.font = `13px Geist, sans-serif`
  ctx.fillStyle = shape.strokeColor || '#e2e2e2'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  const cx = shape.x + shape.width / 2
  const cy = shape.y + shape.height / 2
  
  const lines = wrapText(ctx, shape.label, shape.width - 20)
  const lineHeight = 16
  const totalHeight = lines.length * lineHeight
  
  lines.forEach((line, i) => {
    const py = cy - (totalHeight / 2) + (i * lineHeight) + (lineHeight / 2)
    ctx.fillText(line, cx, py)
  })
  
  ctx.restore()
}

export function catmullRomPoint(p0, p1, p2, p3, t) {
  const t2 = t * t
  const t3 = t2 * t
  
  const f0 = -0.5 * t3 + t2 - 0.5 * t
  const f1 = 1.5 * t3 - 2.5 * t2 + 1.0
  const f2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t
  const f3 = 0.5 * t3 - 0.5 * t2
  
  return {
    x: p0.x * f0 + p1.x * f1 + p2.x * f2 + p3.x * f3,
    y: p0.y * f0 + p1.y * f1 + p2.y * f2 + p3.y * f3,
    pressure: (p0.pressure || 1) * f0 + (p1.pressure || 1) * f1 + (p2.pressure || 1) * f2 + (p3.pressure || 1) * f3
  }
}

export function drawSmoothStroke(ctx, points) {
  if (points.length < 2) return
  if (points.length === 2) {
    ctx.moveTo(points[0].x, points[0].y)
    ctx.lineTo(points[1].x, points[1].y)
    return
  }
  
  ctx.moveTo(points[0].x, points[0].y)
  
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2 >= points.length ? points.length - 1 : i + 2]
    
    for (let t = 0.1; t <= 1; t += 0.1) {
      const pt = catmullRomPoint(p0, p1, p2, p3, t)
      ctx.lineTo(pt.x, pt.y)
    }
  }
}

export function renderStroke(ctx, stroke, scale) {
  if (!stroke.points || stroke.points.length === 0) return
  
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = stroke.color
  
  const baseAlpha = stroke.opacity !== undefined ? stroke.opacity : 1
  const alpha = stroke.style === 'highlighter' ? 0.3 * baseAlpha : baseAlpha
  ctx.globalAlpha = alpha
  
  const baseWidth = stroke.width
  const hasPressure = stroke.points.some(p => p.pressure !== undefined && p.pressure !== 1)
  
  if (hasPressure) {
    let lastPt = stroke.points[0]
    for (let i = 1; i < stroke.points.length; i++) {
      const pt = stroke.points[i]
      const avgPressure = ((lastPt.pressure || 1) + (pt.pressure || 1)) / 2
      const pressureMultiplier = Math.max(0.5, Math.min(1.5, avgPressure))
      ctx.lineWidth = baseWidth * pressureMultiplier
      ctx.beginPath()
      ctx.moveTo(lastPt.x, lastPt.y)
      ctx.lineTo(pt.x, pt.y)
      ctx.stroke()
      lastPt = pt
    }
  } else {
    ctx.lineWidth = baseWidth
    ctx.beginPath()
    if (stroke.smoothing && stroke.points.length > 2) {
      drawSmoothStroke(ctx, stroke.points)
    } else {
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
      }
    }
    ctx.stroke()
  }
  
  ctx.restore()
}

export function renderShape(ctx, shape) {
  ctx.save()
  
  // Apply rotation if any
  if (shape.rotation) {
    ctx.save()
    const cx = shape.x + shape.width / 2
    const cy = shape.y + shape.height / 2
    ctx.translate(cx, cy)
    ctx.rotate((shape.rotation * Math.PI) / 180)
    ctx.translate(-cx, -cy)
  }
  
  // Fill
  if (shape.fillColor && shape.fillColor !== 'transparent') {
    ctx.fillStyle = hexToRgba(shape.fillColor, shape.fillOpacity !== undefined ? shape.fillOpacity : 1)
    drawShapePath(ctx, shape)
    ctx.fill()
  }
  
  // Stroke
  if (shape.strokeColor && shape.strokeWidth > 0) {
    ctx.strokeStyle = shape.strokeColor
    ctx.lineWidth = shape.strokeWidth
    drawShapePath(ctx, shape)
    ctx.stroke()
  }
  
  // Label inside shape
  if (shape.label) {
    renderTextInShape(ctx, shape)
  }
  
  if (shape.rotation) {
    ctx.restore()
  }
  
  ctx.restore()
}

export function renderText(ctx, text) {
  ctx.save()
  
  if (text.rotation) {
    ctx.save()
    const cx = text.x + text.width / 2
    const cy = text.y + (text.fontSize * 1.3 * wrapText(ctx, text.content, text.width).length) / 2
    ctx.translate(cx, cy)
    ctx.rotate((text.rotation * Math.PI) / 180)
    ctx.translate(-cx, -cy)
  }
  
  ctx.font = `${text.fontStyle || 'normal'} ${text.fontWeight || 'normal'} ${text.fontSize}px ${text.fontFamily || 'Geist, sans-serif'}`
  ctx.fillStyle = text.color || '#e2e2e2'
  ctx.textAlign = text.align || 'left'
  ctx.textBaseline = 'top'
  
  const lines = wrapText(ctx, text.content, text.width)
  lines.forEach((line, i) => {
    let tx = text.x
    if (text.align === 'center') tx = text.x + text.width / 2
    if (text.align === 'right') tx = text.x + text.width
    ctx.fillText(line, tx, text.y + i * text.fontSize * 1.3)
  })
  
  if (text.rotation) {
    ctx.restore()
  }
  
  ctx.restore()
}

export function renderImage(ctx, image) {
  let img = imageCache.get(image.id)
  
  if (!img) {
    img = new Image()
    img.src = image.src
    img.onload = () => {
      window.dispatchEvent(new CustomEvent('enginguity_drawingboard_redraw'))
    }
    imageCache.set(image.id, img)
  }
  
  if (!img.complete || img.naturalWidth === 0) return
  
  ctx.save()
  
  if (image.rotation) {
    ctx.save()
    const cx = image.x + image.width / 2
    const cy = image.y + image.height / 2
    ctx.translate(cx, cy)
    ctx.rotate((image.rotation * Math.PI) / 180)
    ctx.translate(-cx, -cy)
  }
  
  ctx.globalAlpha = (image.opacity !== undefined ? image.opacity : 100) / 100
  
  const grayscale = image.filters?.grayscale || 0
  const brightness = image.filters?.brightness !== undefined ? image.filters.brightness : 100
  const contrast = image.filters?.contrast !== undefined ? image.filters.contrast : 100
  
  if (grayscale > 0 || brightness !== 100 || contrast !== 100) {
    ctx.filter = `grayscale(${grayscale}%) brightness(${brightness}%) contrast(${contrast}%)`
  }
  
  const br = image.borderRadius || 0
  if (br > 0) {
    ctx.beginPath()
    roundedRect(ctx, image.x, image.y, image.width, image.height, br)
    ctx.clip()
  }
  
  ctx.drawImage(img, image.x, image.y, image.width, image.height)
  
  if (image.rotation) {
    ctx.restore()
  }
  
  ctx.restore()
}

export function drawStickyPath(ctx, x, y, w, h, radius, folded, foldSize) {
  const r = Math.min(radius, w / 2, h / 2)
  ctx.beginPath()
  
  if (folded) {
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - foldSize, y)
    ctx.lineTo(x + w, y + foldSize)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
  } else {
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
  }
  ctx.closePath()
}

export function renderSticky(ctx, sticky) {
  ctx.save()
  
  if (sticky.rotation) {
    ctx.save()
    const cx = sticky.x + sticky.width / 2
    const cy = sticky.y + sticky.height / 2
    ctx.translate(cx, cy)
    ctx.rotate((sticky.rotation * Math.PI) / 180)
    ctx.translate(-cx, -cy)
  }
  
  // Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.08)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 2
  
  // Background
  ctx.fillStyle = sticky.color || '#fef9c3'
  drawStickyPath(ctx, sticky.x, sticky.y, sticky.width, sticky.height, 6, sticky.foldCorner, 16)
  ctx.fill()
  
  // Turn off shadow for text and fold
  ctx.shadowColor = 'transparent'
  
  // Fold Corner Effect
  if (sticky.foldCorner) {
    const foldSize = 16
    ctx.fillStyle = darken(sticky.color || '#fef9c3', 20)
    ctx.beginPath()
    ctx.moveTo(sticky.x + sticky.width - foldSize, sticky.y)
    ctx.lineTo(sticky.x + sticky.width, sticky.y + foldSize)
    ctx.lineTo(sticky.x + sticky.width - foldSize, sticky.y + foldSize)
    ctx.closePath()
    ctx.fill()
  }
  
  // Text
  ctx.fillStyle = sticky.textColor || '#1f2937'
  const fontSize = sticky.fontSize || 14
  ctx.font = `${fontSize}px Geist, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  
  const lines = wrapText(ctx, sticky.content || '', sticky.width - 24)
  lines.forEach((line, i) => {
    ctx.fillText(line, sticky.x + 12, sticky.y + 16 + i * fontSize * 1.4)
  })
  
  if (sticky.rotation) {
    ctx.restore()
  }
  
  ctx.restore()
}

export function getAngle(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1)
}

export function drawArrowHead(ctx, x, y, angle, color, width) {
  ctx.save()
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineJoin = 'miter'
  
  ctx.translate(x, y)
  ctx.rotate(angle)
  
  const size = 6 + width * 2
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-size, -size / 2)
  ctx.lineTo(-size * 0.8, 0)
  ctx.lineTo(-size, size / 2)
  ctx.closePath()
  ctx.fill()
  
  ctx.restore()
}

export function renderArrow(ctx, arrow) {
  ctx.save()
  ctx.strokeStyle = arrow.color || '#94a3b8'
  ctx.lineWidth = arrow.width || 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  
  if (arrow.dashStyle === 'dashed') {
    ctx.setLineDash([8, 4])
  } else if (arrow.dashStyle === 'dotted') {
    ctx.setLineDash([2, 4])
  }
  
  let endAngle = 0
  let startAngle = 0
  
  if (arrow.style === 'straight') {
    ctx.beginPath()
    ctx.moveTo(arrow.startX, arrow.startY)
    ctx.lineTo(arrow.endX, arrow.endY)
    ctx.stroke()
    
    endAngle = Math.atan2(arrow.endY - arrow.startY, arrow.endX - arrow.startX)
    startAngle = Math.atan2(arrow.startY - arrow.endY, arrow.startX - arrow.endX)
  } else if (arrow.style === 'curved') {
    const cpX = (arrow.startX + arrow.endX) / 2
    const dx = arrow.endX - arrow.startX
    const dy = arrow.endY - arrow.startY
    const len = Math.sqrt(dx * dx + dy * dy)
    
    const px = len > 0 ? -dy / len : 0
    const py = len > 0 ? dx / len : 0
    const curveOffset = Math.min(len * 0.2, 50)
    const cpY = (arrow.startY + arrow.endY) / 2 + py * curveOffset
    const cpXFinal = cpX + px * curveOffset
    
    ctx.beginPath()
    ctx.moveTo(arrow.startX, arrow.startY)
    ctx.quadraticCurveTo(cpXFinal, cpY, arrow.endX, arrow.endY)
    ctx.stroke()
    
    endAngle = Math.atan2(arrow.endY - cpY, arrow.endX - cpXFinal)
    startAngle = Math.atan2(arrow.startY - cpY, arrow.startX - cpXFinal)
  } else if (arrow.style === 'elbow') {
    const midX = (arrow.startX + arrow.endX) / 2
    ctx.beginPath()
    ctx.moveTo(arrow.startX, arrow.startY)
    ctx.lineTo(midX, arrow.startY)
    ctx.lineTo(midX, arrow.endY)
    ctx.lineTo(arrow.endX, arrow.endY)
    ctx.stroke()
    
    endAngle = Math.atan2(arrow.endY - arrow.startY, arrow.endX - midX)
    startAngle = Math.atan2(0, arrow.startX - midX)
  }
  
  ctx.setLineDash([])
  
  // Arrowheads
  if (arrow.endArrow) {
    drawArrowHead(ctx, arrow.endX, arrow.endY, endAngle, arrow.color || '#94a3b8', arrow.width || 2)
  }
  if (arrow.startArrow) {
    drawArrowHead(ctx, arrow.startX, arrow.startY, startAngle, arrow.color || '#94a3b8', arrow.width || 2)
  }
  
  // Midpoint Label
  if (arrow.label) {
    let midX = (arrow.startX + arrow.endX) / 2
    let midY = (arrow.startY + arrow.endY) / 2
    
    if (arrow.style === 'curved') {
      const cpX = (arrow.startX + arrow.endX) / 2
      const dx = arrow.endX - arrow.startX
      const dy = arrow.endY - arrow.startY
      const len = Math.sqrt(dx * dx + dy * dy)
      const px = len > 0 ? -dy / len : 0
      const py = len > 0 ? dx / len : 0
      const curveOffset = Math.min(len * 0.2, 50)
      const cpY = (arrow.startY + arrow.endY) / 2 + py * curveOffset
      const cpXFinal = cpX + px * curveOffset
      
      midX = 0.25 * arrow.startX + 0.5 * cpXFinal + 0.25 * arrow.endX
      midY = 0.25 * arrow.startY + 0.5 * cpY + 0.25 * arrow.endY
    }
    
    ctx.font = '11px Geist, sans-serif'
    const textWidth = ctx.measureText(arrow.label).width
    
    ctx.fillStyle = '#141414'
    ctx.fillRect(midX - textWidth / 2 - 4, midY - 8, textWidth + 8, 16)
    ctx.strokeStyle = '#2a2a2a'
    ctx.lineWidth = 1
    ctx.strokeRect(midX - textWidth / 2 - 4, midY - 8, textWidth + 8, 16)

    ctx.fillStyle = arrow.color || '#94a3b8'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(arrow.label, midX, midY)
  }
  
  ctx.restore()
}

export function renderChecklist(ctx, checklist) {
  ctx.save()
  
  if (checklist.rotation) {
    ctx.save()
    const cx = checklist.x + checklist.width / 2
    const cy = checklist.y + checklist.height / 2
    ctx.translate(cx, cy)
    ctx.rotate((checklist.rotation * Math.PI) / 180)
    ctx.translate(-cx, -cy)
  }
  
  // Card Shadow & BG
  ctx.fillStyle = '#141414'
  ctx.strokeStyle = '#2a2a2a'
  ctx.lineWidth = 1
  
  ctx.shadowColor = 'rgba(0, 0, 0, 0.04)'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 1
  roundedRect(ctx, checklist.x, checklist.y, checklist.width, checklist.height, 8)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.stroke()
  
  let offsetY = checklist.y + 12
  
  // Title
  if (checklist.title) {
    ctx.font = 'bold 13px Geist, sans-serif'
    ctx.fillStyle = '#e2e2e2'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(checklist.title, checklist.x + 12, offsetY)
    offsetY += 24
    
    // Divider
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(checklist.x + 12, offsetY)
    ctx.lineTo(checklist.x + checklist.width - 12, offsetY)
    ctx.stroke()
    offsetY += 10
  }
  
  // Items
  const accentColor = checklist.color || '#3b82f6'
  checklist.items.forEach(item => {
    const checkX = checklist.x + 12
    const checkY = offsetY
    
    ctx.save()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = item.checked ? accentColor : '#d1d5db'
    roundedRect(ctx, checkX, checkY, 14, 14, 3)
    ctx.stroke()
    
    if (item.checked) {
      ctx.fillStyle = accentColor
      roundedRect(ctx, checkX, checkY, 14, 14, 3)
      ctx.fill()
      
      // Draw white checkmark
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.8
      ctx.beginPath()
      ctx.moveTo(checkX + 3, checkY + 7)
      ctx.lineTo(checkX + 6, checkY + 10)
      ctx.lineTo(checkX + 11, checkY + 4)
      ctx.stroke()
    }
    ctx.restore()
    
    // Text label
    ctx.font = '13px Geist, sans-serif'
    ctx.fillStyle = item.checked ? '#5a5a5a' : '#e2e2e2'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    
    // Wrap checklist item text
    const textWidth = checklist.width - 44
    const textLines = wrapText(ctx, item.text || '', textWidth)
    
    textLines.forEach((tLine, lineIdx) => {
      const lineY = offsetY + lineIdx * 16 - 1
      ctx.fillText(tLine, checkX + 22, lineY)
      
      if (item.checked) {
        // Draw strikethrough line
        const wText = ctx.measureText(tLine).width
        ctx.strokeStyle = '#9ca3af'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(checkX + 22, lineY + 7)
        ctx.lineTo(checkX + 22 + wText, lineY + 7)
        ctx.stroke()
      }
    })
    
    offsetY += Math.max(1, textLines.length) * 20 + 4
  })
  
  if (checklist.rotation) {
    ctx.restore()
  }
  
  ctx.restore()
}

export function renderFrame(ctx, frame) {
  ctx.save()
  
  // Frame Background tint
  if (frame.backgroundColor && frame.backgroundColor !== 'transparent') {
    ctx.fillStyle = frame.backgroundColor
    ctx.fillRect(frame.x, frame.y, frame.width, frame.height)
  }
  
  // Border
  if (frame.borderColor && frame.borderStyle !== 'none') {
    ctx.strokeStyle = frame.borderColor
    ctx.lineWidth = 1
    if (frame.borderStyle === 'dashed') {
      ctx.setLineDash([6, 4])
    }
    ctx.strokeRect(frame.x, frame.y, frame.width, frame.height)
    ctx.setLineDash([])
  }
  
  // Title Label
  if (frame.title) {
    ctx.fillStyle = '#6b7280'
    ctx.font = '400 12px Geist, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    ctx.fillText(frame.title, frame.x, frame.y - 4)
  }
  
  ctx.restore()
}

export function drawSelectionHandles(ctx, selection, elements, scale) {
  if (!selection || selection.length === 0) return
  
  const bounds = getSelectionBounds(selection, elements)
  if (!bounds) return
  
  ctx.save()
  
  // Draw bounding box
  ctx.strokeStyle = '#94a5ba'
  ctx.lineWidth = 1 / scale
  ctx.setLineDash([4 / scale, 4 / scale])
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
  ctx.setLineDash([])
  
  const isLocked = selection.length === 1 && elements.find(el => el.id === selection[0])?.locked
  if (isLocked) {
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 1.5 / scale
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
    ctx.restore()
    return
  }
  
  // Handles
  const size = 6 / scale
  const half = size / 2
  ctx.fillStyle = '#1e1e1e'
  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 1 / scale
  
  const drawHandle = (hx, hy) => {
    ctx.fillRect(hx - half, hy - half, size, size)
    ctx.strokeRect(hx - half, hy - half, size, size)
  }
  
  const { x, y, width: w, height: h } = bounds
  
  // 8 handles
  drawHandle(x, y)
  drawHandle(x + w, y)
  drawHandle(x, y + h)
  drawHandle(x + w, y + h)
  
  drawHandle(x + w / 2, y)
  drawHandle(x + w / 2, y + h)
  drawHandle(x, y + h / 2)
  drawHandle(x + w, y + h / 2)
  
  // Draw rotation handle (only for single select)
  if (selection.length === 1) {
    const rotLineLen = 20 / scale
    const rx = x + w / 2
    const ry = y - rotLineLen
    
    ctx.beginPath()
    ctx.moveTo(x + w / 2, y)
    ctx.lineTo(rx, ry)
    ctx.stroke()
    
    const rotRadius = 4 / scale
    ctx.beginPath()
    ctx.arc(rx, ry, rotRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  
  ctx.restore()
}

export function getSelectionBounds(selection, elements) {
  if (!selection || selection.length === 0) return null
  
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  
  selection.forEach(id => {
    const el = elements.find(e => e.id === id)
    if (!el) return
    
    if (el.type !== 'stroke' && el.type !== 'arrow') {
      minX = Math.min(minX, el.x)
      minY = Math.min(minY, el.y)
      maxX = Math.max(maxX, el.x + el.width)
      maxY = Math.max(maxY, el.y + el.height)
    } else if (el.type === 'stroke') {
      if (el.points && el.points.length > 0) {
        el.points.forEach(p => {
          minX = Math.min(minX, p.x)
          minY = Math.min(minY, p.y)
          maxX = Math.max(maxX, p.x)
          maxY = Math.max(maxY, p.y)
        })
      }
    } else if (el.type === 'arrow') {
      minX = Math.min(minX, el.startX, el.endX)
      minY = Math.min(minY, el.startY, el.endY)
      maxX = Math.max(maxX, el.startX, el.endX)
      maxY = Math.max(maxY, el.startY, el.endY)
    }
  })
  
  if (minX === Infinity) return null
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

export function renderElement(ctx, el, scale = 1) {
  switch (el.type) {
    case 'stroke':
      renderStroke(ctx, el, scale)
      break
    case 'shape':
      renderShape(ctx, el)
      break
    case 'text':
      renderText(ctx, el)
      break
    case 'image':
      renderImage(ctx, el)
      break
    case 'sticky':
      renderSticky(ctx, el)
      break
    case 'arrow':
      renderArrow(ctx, el)
      break
    case 'checklist':
      renderChecklist(ctx, el)
      break
    case 'frame':
      renderFrame(ctx, el)
      break
    default:
      break
  }
}

export function render(ctx, elements, transform, selection, width, height, gridVisible = true) {
  // Fill background explicitly (clearRect leaves transparent which can show white)
  ctx.fillStyle = '#0e0e0e'
  ctx.fillRect(0, 0, width, height)
  
  ctx.save()
  // Apply transformations
  ctx.setTransform(
    transform.scale, 0, 0, 
    transform.scale, 
    transform.x, transform.y
  )
  
  // Grid (rendered first)
  if (gridVisible) {
    drawGrid(ctx, width, height, transform)
  }
  
  // Mascot Ohma (only when elements list is empty)
  if (elements.length === 0) {
    drawMascotAndWatermark(ctx)
  }
  
  // Draw elements ordered by zIndex
  const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
  sorted.forEach(el => {
    renderElement(ctx, el, transform.scale)
  })
  
  // Draw selection handles
  if (selection && selection.length > 0) {
    drawSelectionHandles(ctx, selection, elements, transform.scale)
  }
  
  ctx.restore()
}

export function isPointInRotatedBox(px, py, el) {
  const cx = el.x + el.width / 2
  const cy = el.y + el.height / 2
  
  let x = px
  let y = py
  
  if (el.rotation) {
    const rad = (-el.rotation * Math.PI) / 180
    const dx = px - cx
    const dy = py - cy
    x = cx + dx * Math.cos(rad) - dy * Math.sin(rad)
    y = cy + dx * Math.sin(rad) + dy * Math.cos(rad)
  }
  
  const minX = Math.min(el.x, el.x + el.width)
  const maxX = Math.max(el.x, el.x + el.width)
  const minY = Math.min(el.y, el.y + el.height)
  const maxY = Math.max(el.y, el.y + el.height)
  
  return x >= minX && x <= maxX && y >= minY && y <= maxY
}

export function hitTestElement(px, py, elements) {
  const sorted = [...elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
  
  for (const el of sorted) {
    if (el.type === 'stroke') {
      const tolerance = 8
      if (el.points && el.points.length > 0) {
        const hit = el.points.some(p => Math.sqrt((p.x - px) ** 2 + (p.y - py) ** 2) <= tolerance)
        if (hit) return el
      }
    } else if (el.type === 'arrow') {
      const tolerance = 8
      const dx = el.endX - el.startX
      const dy = el.endY - el.startY
      const lenSq = dx * dx + dy * dy
      let t = 0
      if (lenSq > 0) {
        t = ((px - el.startX) * dx + (py - el.startY) * dy) / lenSq
        t = Math.max(0, Math.min(1, t))
      }
      const projX = el.startX + t * dx
      const projY = el.startY + t * dy
      const dist = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2)
      
      if (dist <= tolerance) {
        return el
      }
    } else {
      if (isPointInRotatedBox(px, py, el)) {
        return el
      }
    }
  }
  return null
}
