import { useRef, useState, useEffect, useCallback } from 'react'

// ── Divider ──────────────────────────────────────────────────────────────────

function Divider({ direction, onMouseDown, onTouchStart, onDoubleClick, nearMin }) {
  const [hovered, setHovered] = useState(false)
  const isH = direction === 'horizontal'

  return (
    <div
      className="panel-divider"
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        [isH ? 'width' : 'height']: 9,
        [isH ? 'height' : 'width']: '100%',
        flexShrink: 0,
        cursor: isH ? 'col-resize' : 'row-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 10,
        background: 'transparent',
      }}
    >
      {/* Visible 1px line */}
      <div style={{
        [isH ? 'width' : 'height']: 1,
        [isH ? 'height' : 'width']: '100%',
        background: hovered ? 'var(--accent)' : 'var(--border)',
        transition: 'background 120ms ease',
        position: 'relative',
        flexShrink: 0,
      }}>
        {/* Drag handle — 3 dots, shown on hover */}
        {hovered && (
          <div style={{
            position: 'absolute',
            [isH ? 'top' : 'left']: '50%',
            [isH ? 'left' : 'top']: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--surface-2, #111111)',
            border: '1px solid var(--accent)',
            borderRadius: 3,
            padding: isH ? '5px 3px' : '3px 5px',
            display: 'flex',
            flexDirection: isH ? 'column' : 'row',
            gap: 2,
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 2, height: 2,
                borderRadius: '50%',
                background: 'var(--accent)',
                opacity: 0.85,
              }} />
            ))}
          </div>
        )}

        {/* Near-minimum expand hint */}
        {nearMin && !hovered && (
          <div style={{
            position: 'absolute',
            [isH ? 'top' : 'left']: '50%',
            [isH ? 'left' : 'top']: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 10,
            color: 'var(--text-dim)',
            pointerEvents: 'none',
            lineHeight: 1,
          }}>
            {isH ? '›' : '↓'}
          </div>
        )}
      </div>
    </div>
  )
}

// ── ResizablePanel ────────────────────────────────────────────────────────────

export default function ResizablePanel({
  direction = 'horizontal',
  initialSplit = 0.5,
  minFirst = 120,
  minSecond = 120,
  storageKey = null,
  children,
}) {
  const containerRef = useRef(null)
  const isDragging = useRef(false)
  const startPos = useRef(0)
  const startSplit = useRef(0)

  // Mobile: flip horizontal → vertical, wider hit area
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const actualDirection = isMobile && direction === 'horizontal' ? 'vertical' : direction
  const isH = actualDirection === 'horizontal'

  const getInitialSplit = () => {
    if (storageKey) {
      const stored = localStorage.getItem(`enginguity_panel_${storageKey}`)
      if (stored !== null) {
        const v = parseFloat(stored)
        if (!isNaN(v)) return v
      }
    }
    return isMobile && direction === 'horizontal' ? 0.4 : initialSplit
  }

  const [split, setSplit] = useState(getInitialSplit)

  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(`enginguity_panel_${storageKey}`, String(split))
    }
  }, [split, storageKey])

  // Clamp split given current container size
  const clampSplit = useCallback((raw) => {
    if (!containerRef.current) return raw
    const rect = containerRef.current.getBoundingClientRect()
    const size = isH ? rect.width : rect.height
    if (size === 0) return raw
    const lo = minFirst / size
    const hi = 1 - minSecond / size
    return Math.max(lo, Math.min(hi, raw))
  }, [isH, minFirst, minSecond])

  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    isDragging.current = true
    startPos.current = isH ? e.clientX : e.clientY
    startSplit.current = split
    document.body.style.cursor = isH ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }, [split, isH])

  const onTouchStart = useCallback((e) => {
    const touch = e.touches[0]
    isDragging.current = true
    startPos.current = isH ? touch.clientX : touch.clientY
    startSplit.current = split
  }, [split, isH])

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const size = isH ? rect.width : rect.height
      if (size === 0) return
      const pos = isH ? e.clientX : e.clientY
      const delta = pos - startPos.current
      setSplit(clampSplit(startSplit.current + delta / size))
    }

    const onMouseUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    const onTouchMove = (e) => {
      if (!isDragging.current || !containerRef.current) return
      e.preventDefault()
      const touch = e.touches[0]
      const rect = containerRef.current.getBoundingClientRect()
      const size = isH ? rect.width : rect.height
      const origin = isH ? rect.left : rect.top
      const pos = isH ? touch.clientX : touch.clientY
      setSplit(clampSplit((pos - origin) / size))
    }

    const onTouchEnd = () => {
      isDragging.current = false
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [isH, clampSplit])

  const onDoubleClick = useCallback(() => {
    const target = isMobile && direction === 'horizontal' ? 0.4 : initialSplit
    setSplit(target)
    if (storageKey) localStorage.removeItem(`enginguity_panel_${storageKey}`)
  }, [initialSplit, storageKey, isMobile, direction])

  // Near-min detection for collapse hint
  const nearMin = (() => {
    if (!containerRef.current) return false
    const rect = containerRef.current.getBoundingClientRect()
    const size = isH ? rect.width : rect.height
    if (size === 0) return false
    return split * size <= minFirst + 20
  })()

  const firstPct = `${split * 100}%`

  const firstStyle = isH
    ? { width: firstPct, height: '100%', minWidth: minFirst, flexShrink: 0, overflow: 'hidden', position: 'relative' }
    : { height: firstPct, width: '100%', minHeight: minFirst, flexShrink: 0, overflow: 'hidden', position: 'relative' }

  const secondStyle = isH
    ? { flex: 1, height: '100%', minWidth: minSecond, overflow: 'hidden', position: 'relative' }
    : { flex: 1, width: '100%', minHeight: minSecond, overflow: 'hidden', position: 'relative' }

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: isH ? 'row' : 'column',
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div style={firstStyle}>
        {children[0]}
      </div>

      <Divider
        direction={actualDirection}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onDoubleClick={onDoubleClick}
        nearMin={nearMin}
      />

      <div style={secondStyle}>
        {children[1]}
      </div>
    </div>
  )
}
