import { useEffect, useRef } from 'react'

export function RadarMini({ size = 80 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const r = size / 2 - 2
    let rafId = 0
    let frame = 0

    const dots = [
      { angle: 0.5, radius: r * 0.4 },
      { angle: 2.1, radius: r * 0.7 },
      { angle: 4.3, radius: r * 0.5 },
      { angle: 5.6, radius: r * 0.6 },
    ]

    function draw() {
      if (!ctx) return
      rafId = requestAnimationFrame(draw)
      frame++
      ctx.clearRect(0, 0, size, size)

      // bg circle
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,10,30,0.9)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,100,160,0.4)'
      ctx.lineWidth = 0.5
      ctx.stroke()

      // rings
      ;[r * 0.33, r * 0.66].forEach((rr) => {
        ctx.beginPath()
        ctx.arc(cx, cy, rr, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(0,80,140,0.3)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      })

      // cross
      ctx.beginPath()
      ctx.moveTo(cx - r, cy)
      ctx.lineTo(cx + r, cy)
      ctx.moveTo(cx, cy - r)
      ctx.lineTo(cx, cy + r)
      ctx.strokeStyle = 'rgba(0,80,140,0.3)'
      ctx.lineWidth = 0.5
      ctx.stroke()

      const sweepAngle = (frame / 180) * Math.PI * 2

      // trail
      const trailAngle = 1.2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, sweepAngle - trailAngle, sweepAngle)
      ctx.closePath()
      ctx.fillStyle = 'rgba(0,168,255,0.1)'
      ctx.fill()

      // sweep
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(sweepAngle) * r, cy + Math.sin(sweepAngle) * r)
      ctx.strokeStyle = 'rgba(0,212,255,0.7)'
      ctx.lineWidth = 1
      ctx.stroke()

      // dots
      dots.forEach((d) => {
        ctx.beginPath()
        ctx.arc(cx + Math.cos(d.angle) * d.radius, cy + Math.sin(d.angle) * d.radius, 2, 0, Math.PI * 2)
        ctx.fillStyle = '#00a8ff'
        ctx.fill()
      })
    }

    draw()
    return () => cancelAnimationFrame(rafId)
  }, [size])

  return <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block' }} />
}
