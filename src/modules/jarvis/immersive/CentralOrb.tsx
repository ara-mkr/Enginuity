import { useEffect, useRef } from 'react'
import type { JarvisVisualState } from './useOrbState'

interface Particle {
  angle: number
  radius: number
  baseRadius: number
  speed: number
  size: number
  baseOpacity: number
  tiltY: number
  phase: number
  isBright: boolean
}

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => {
    const radius = 40 + Math.random() * 120
    return {
      angle: Math.random() * Math.PI * 2,
      radius,
      baseRadius: radius,
      speed: (0.002 + Math.random() * 0.006) * (Math.random() > 0.5 ? 1 : -1),
      size: 0.8 + Math.random() * 2.5,
      baseOpacity: 0.4 + Math.random() * 0.6,
      tiltY: 0.6 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      isBright: Math.random() > 0.75,
    }
  })
}

interface Props {
  state: JarvisVisualState
  size?: number
}

export function CentralOrb({ state, size = 600 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const CX = size / 2
    const CY = size / 2

    let particles = createParticles(120)
    let frame = 0
    let rafId = 0
    let lastTime = performance.now()
    let frameCount = 0
    let fps = 60
    let speakIntensity = 0

    function getSpeedMultiplier(s: JarvisVisualState) {
      if (s === 'speaking') return 3.5
      if (s === 'processing') return 2.5
      if (s === 'listening') return 1.8
      return 1
    }

    function targetIntensity(s: JarvisVisualState) {
      if (s === 'speaking') return 1
      if (s === 'processing') return 0.5
      if (s === 'listening') return 0.2
      return 0
    }

    function drawRings(f: number) {
      if (!ctx) return

      // Outer decorative ring
      ctx.beginPath()
      ctx.arc(CX, CY, 250, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0, 120, 200, 0.25)'
      ctx.lineWidth = 0.5
      ctx.stroke()

      // Main tick ring
      ctx.beginPath()
      ctx.arc(CX, CY, 220, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0, 180, 240, 0.7)'
      ctx.lineWidth = 1
      ctx.stroke()

      // 72 tick marks
      for (let i = 0; i < 72; i++) {
        const angle = (i / 72) * Math.PI * 2 - Math.PI / 2
        const isMajor = i % 9 === 0
        const isMid = i % 3 === 0
        const innerR = isMajor ? 205 : isMid ? 210 : 213
        const outerR = 220
        const x1 = CX + Math.cos(angle) * innerR
        const y1 = CY + Math.sin(angle) * innerR
        const x2 = CX + Math.cos(angle) * outerR
        const y2 = CY + Math.sin(angle) * outerR

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.strokeStyle = isMajor
          ? 'rgba(0, 220, 255, 0.9)'
          : isMid
          ? 'rgba(0, 190, 240, 0.6)'
          : 'rgba(0, 160, 210, 0.35)'
        ctx.lineWidth = isMajor ? 1.5 : 0.8
        ctx.stroke()
      }

      // Cardinal labels
      const labels = ['000', '090', '180', '270']
      ctx.font = '9px "Geist Mono", monospace'
      ctx.fillStyle = 'rgba(0, 210, 255, 0.8)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      labels.forEach((label, i) => {
        const angle = (i / 4) * Math.PI * 2 - Math.PI / 2
        const x = CX + Math.cos(angle) * 238
        const y = CY + Math.sin(angle) * 238
        ctx.fillText(label, x, y)
      })

      // Rotating dashed ring (195)
      ctx.save()
      ctx.translate(CX, CY)
      ctx.rotate(f * 0.003)
      ctx.beginPath()
      ctx.arc(0, 0, 195, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0, 160, 230, 0.5)'
      ctx.lineWidth = 0.8
      ctx.setLineDash([6, 10])
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()

      // Counter-rotating ring (170)
      ctx.save()
      ctx.translate(CX, CY)
      ctx.rotate(-f * 0.005)
      ctx.beginPath()
      ctx.arc(0, 0, 170, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0, 180, 255, 0.4)'
      ctx.lineWidth = 0.6
      ctx.setLineDash([3, 14])
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()

      // Solid inner ring (145)
      ctx.beginPath()
      ctx.arc(CX, CY, 145, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.65)'
      ctx.lineWidth = 1.2
      ctx.stroke()

      // 36 small ticks on inner ring
      for (let i = 0; i < 36; i++) {
        const angle = (i / 36) * Math.PI * 2
        const isMajor = i % 9 === 0
        const innerR = isMajor ? 138 : 141
        const x1 = CX + Math.cos(angle) * innerR
        const y1 = CY + Math.sin(angle) * innerR
        const x2 = CX + Math.cos(angle) * 145
        const y2 = CY + Math.sin(angle) * 145
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.strokeStyle = isMajor
          ? 'rgba(0, 200, 255, 0.8)'
          : 'rgba(0, 160, 220, 0.4)'
        ctx.lineWidth = isMajor ? 1.2 : 0.6
        ctx.stroke()
      }
    }

    function drawParticle(p: Particle, s: JarvisVisualState) {
      if (!ctx) return
      const x = CX + Math.cos(p.angle) * p.radius
      const y = CY + Math.sin(p.angle) * p.radius * p.tiltY
      const depthFactor = (Math.sin(p.angle) + 1) / 2
      const opacity = p.baseOpacity * (0.3 + depthFactor * 0.7)
      const brightBoost = s === 'speaking' ? 1 + speakIntensity * 0.8 : 1

      if (p.isBright) {
        ctx.shadowColor = '#00d4ff'
        ctx.shadowBlur = 6
        ctx.beginPath()
        ctx.arc(x, y, p.size * 1.4, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(120, 220, 255, ${Math.min(1, opacity * brightBoost)})`
        ctx.fill()
        ctx.shadowBlur = 0
      } else {
        ctx.beginPath()
        ctx.arc(x, y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0, 190, 255, ${Math.min(1, opacity * brightBoost)})`
        ctx.fill()
      }

      if (p.size > 1.5) {
        ctx.beginPath()
        ctx.arc(x, y, p.size * 2.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0, 160, 255, ${opacity * 0.12 * brightBoost})`
        ctx.fill()
      }
    }

    function drawCore(f: number, s: JarvisVisualState) {
      if (!ctx) return
      const corePulse =
        s === 'speaking'
          ? 28 + Math.sin(f * 0.15) * 12 * speakIntensity
          : s === 'listening'
          ? 22 + Math.sin(f * 0.05) * 4
          : 20 + Math.sin(f * 0.02) * 2

      // Outer glow layers
      const glows = [
        { r: corePulse * 4, alpha: 0.04 },
        { r: corePulse * 2.5, alpha: 0.08 },
        { r: corePulse * 1.5, alpha: 0.15 },
      ]
      glows.forEach((g) => {
        const grad = ctx.createRadialGradient(CX, CY, 0, CX, CY, g.r)
        grad.addColorStop(0, `rgba(0, 200, 255, ${g.alpha})`)
        grad.addColorStop(1, 'rgba(0, 100, 200, 0)')
        ctx.beginPath()
        ctx.arc(CX, CY, g.r, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()
      })

      // Core gradient
      const coreGrad = ctx.createRadialGradient(
        CX,
        CY,
        0,
        CX,
        CY,
        corePulse,
      )
      coreGrad.addColorStop(0, 'rgba(180, 240, 255, 0.95)')
      coreGrad.addColorStop(0.4, 'rgba(0, 200, 255, 0.85)')
      coreGrad.addColorStop(0.8, 'rgba(0, 100, 200, 0.6)')
      coreGrad.addColorStop(1, 'rgba(0, 60, 160, 0.3)')

      ctx.shadowColor = '#00d4ff'
      ctx.shadowBlur = 20
      ctx.beginPath()
      ctx.arc(CX, CY, corePulse, 0, Math.PI * 2)
      ctx.fillStyle = coreGrad
      ctx.fill()
      ctx.shadowBlur = 0

      // Inner highlight
      ctx.beginPath()
      ctx.arc(CX, CY, corePulse * 0.3, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.fill()

      // Cross hairs
      ctx.strokeStyle = 'rgba(0, 220, 255, 0.7)'
      ctx.lineWidth = 0.8
      const chLen = corePulse + 12
      ctx.beginPath()
      ctx.moveTo(CX - chLen, CY)
      ctx.lineTo(CX + chLen, CY)
      ctx.moveTo(CX, CY - chLen)
      ctx.lineTo(CX, CY + chLen)
      ctx.stroke()

      // Center dot
      ctx.beginPath()
      ctx.arc(CX, CY, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
    }

    function drawSpeechBars(f: number) {
      if (!ctx) return
      if (speakIntensity < 0.05) return
      const NUM_BARS = 48
      const INNER_R = 80
      for (let i = 0; i < NUM_BARS; i++) {
        const angle = (i / NUM_BARS) * Math.PI * 2
        const wave1 = Math.sin(f * 0.12 + i * 0.4) * 0.5 + 0.5
        const wave2 = Math.sin(f * 0.07 + i * 0.8 + 1.2) * 0.5 + 0.5
        const wave3 = Math.sin(f * 0.05 + i * 0.2 + 2.4) * 0.5 + 0.5
        const amplitude = ((wave1 + wave2 + wave3) / 3) * speakIntensity
        const barLength = amplitude * 55 + 3
        const x1 = CX + Math.cos(angle) * INNER_R
        const y1 = CY + Math.sin(angle) * INNER_R
        const x2 = CX + Math.cos(angle) * (INNER_R + barLength)
        const y2 = CY + Math.sin(angle) * (INNER_R + barLength)
        const alpha = 0.3 + amplitude * 0.7
        const blue = Math.round(180 + amplitude * 75)
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.strokeStyle = `rgba(0, ${blue}, 255, ${alpha})`
        ctx.lineWidth = 1.5
        ctx.lineCap = 'round'
        ctx.stroke()
      }
    }

    function drawProcessingPulse(f: number, s: JarvisVisualState) {
      if (!ctx) return
      if (s !== 'processing') return
      const pulseProgress = (f * 0.015) % 1
      const pulseR = pulseProgress * 200
      const pulseAlpha = (1 - pulseProgress) * 0.5
      ctx.beginPath()
      ctx.arc(CX, CY, pulseR, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(0, 200, 255, ${pulseAlpha})`
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    function animate() {
      rafId = requestAnimationFrame(animate)
      frame++

      // FPS tracking + adaptive degradation
      const now = performance.now()
      frameCount++
      if (now - lastTime >= 1000) {
        fps = frameCount
        frameCount = 0
        lastTime = now
        if (fps < 30 && particles.length > 60) {
          particles = particles.slice(0, 60)
        }
      }

      if (!ctx) return
      ctx.clearRect(0, 0, size, size)
      const s = stateRef.current

      // Smooth interpolation
      const target = targetIntensity(s)
      speakIntensity += (target - speakIntensity) * 0.05

      const sm = getSpeedMultiplier(s)
      particles.forEach((p) => {
        p.angle += p.speed * sm
        const breath = Math.sin(frame * 0.015 + p.phase) * 8
        if (s === 'processing') {
          p.radius = Math.max(20, p.radius - 0.15)
          if (p.radius <= 20) {
            p.radius = 160 + Math.random() * 30
            p.baseRadius = p.radius
          }
        } else if (s === 'speaking') {
          const speechPulse = Math.sin(frame * 0.08 + p.phase) * 15
          p.radius = p.baseRadius + breath + speechPulse
        } else {
          p.radius = p.baseRadius + breath * 0.3
        }
      })

      drawRings(frame)
      particles.forEach((p) => drawParticle(p, s))
      drawSpeechBars(frame)
      drawProcessingPulse(frame, s)
      drawCore(frame, s)
    }

    animate()
    return () => cancelAnimationFrame(rafId)
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
        display: 'block',
      }}
    />
  )
}
