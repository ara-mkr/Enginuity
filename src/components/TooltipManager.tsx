import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const GAP = 6
const PADDING = 10 // min distance from viewport edge

interface TooltipState {
  text: string
  x: number
  y: number
  visible: boolean
}

export function TooltipManager() {
  const [tip, setTip] = useState<TooltipState>({ text: '', x: 0, y: 0, visible: false })
  const tooltipRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function show(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement | null
      if (!target) return

      const text = target.getAttribute('data-tooltip')
      if (!text) return

      if (hideTimer.current) clearTimeout(hideTimer.current)

      const rect = target.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight

      // Measure tooltip size (approximate before render, refine after)
      // Use character count to estimate width
      const estWidth = Math.min(text.length * 7.5 + 16, 260)
      const estHeight = 26

      // Try positions in priority order: top, bottom, right, left
      let x = rect.left + rect.width / 2 - estWidth / 2
      let y = rect.top - estHeight - GAP

      if (y < PADDING) {
        // Not enough room above — try below
        y = rect.bottom + GAP
      }
      if (y + estHeight > vh - PADDING) {
        // Not enough room below either — center vertically and go right
        y = rect.top + rect.height / 2 - estHeight / 2
        x = rect.right + GAP
        if (x + estWidth > vw - PADDING) {
          // Go left
          x = rect.left - estWidth - GAP
        }
      }

      // Clamp horizontally
      x = Math.max(PADDING, Math.min(x, vw - estWidth - PADDING))

      setTip({ text, x, y, visible: true })
    }

    function hide(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('[data-tooltip]')
      if (!target) return
      hideTimer.current = setTimeout(() => setTip(t => ({ ...t, visible: false })), 80)
    }

    document.addEventListener('mouseover', show)
    document.addEventListener('mouseout', hide)
    return () => {
      document.removeEventListener('mouseover', show)
      document.removeEventListener('mouseout', hide)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  // Reposition after render once we know the real size
  useEffect(() => {
    if (!tip.visible || !tooltipRef.current) return
    const el = tooltipRef.current
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    let { x, y } = tip
    x = Math.max(PADDING, Math.min(x, vw - rect.width - PADDING))
    y = Math.max(PADDING, Math.min(y, vh - rect.height - PADDING))

    if (x !== tip.x || y !== tip.y) {
      setTip(t => ({ ...t, x, y }))
    }
    // Intentionally excludes 'tip' (beyond visible/text) — this effect
    // clamps tip.x/tip.y, so depending on the full object would re-fire
    // itself in a loop every time it adjusts the position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tip.visible, tip.text])

  if (!tip.visible && !tip.text) return null

  return createPortal(
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        left: tip.x,
        top: tip.y,
        background: '#161616',
        color: '#b8d4f0',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        padding: '4px 8px',
        borderRadius: 4,
        border: '1px solid #2a2a2a',
        pointerEvents: 'none',
        zIndex: 99999,
        opacity: tip.visible ? 1 : 0,
        transition: 'opacity 100ms ease',
        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
      }}
    >
      {tip.text}
    </div>,
    document.body
  )
}
