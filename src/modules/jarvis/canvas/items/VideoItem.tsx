import { useState, useRef, useEffect } from 'react'
import type { CanvasItem } from '../../types'

interface VideoItemProps {
  item: CanvasItem
  scale: number
  onMove: (id: string, x: number, y: number) => void
  onResize: (id: string, w: number, h: number) => void
  onRemove: (id: string) => void
}

const DEFAULT_W = 480
const DEFAULT_H = 300
const MIN_W = 240
const MAX_W = 960
const ASPECT = 9 / 16

export function VideoItem({ item, scale, onMove, onResize, onRemove }: VideoItemProps) {
  const [w, setW] = useState(item.width || DEFAULT_W)
  const [h, setH] = useState(item.height || DEFAULT_H)
  const [hovered, setHovered] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [prevSize, setPrevSize] = useState({ w: DEFAULT_W, h: DEFAULT_H })

  const dragRef = useRef<{ startMX: number; startMY: number; startX: number; startY: number } | null>(null)
  const resizeRef = useRef<{ startMX: number; startMY: number; startW: number; startH: number } | null>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragRef.current) {
        const dx = (e.clientX - dragRef.current.startMX) / scale
        const dy = (e.clientY - dragRef.current.startMY) / scale
        onMove(item.id, dragRef.current.startX + dx, dragRef.current.startY + dy)
      }
      if (resizeRef.current) {
        const dx = (e.clientX - resizeRef.current.startMX) / scale
        const newW = Math.max(MIN_W, Math.min(MAX_W, resizeRef.current.startW + dx))
        const newH = e.shiftKey
          ? Math.max(150, resizeRef.current.startH + (e.clientY - resizeRef.current.startMY) / scale)
          : newW * ASPECT
        setW(newW)
        setH(newH)
        onResize(item.id, newW, newH)
      }
    }
    const handleMouseUp = () => {
      dragRef.current = null
      resizeRef.current = null
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [item.id, scale, onMove, onResize])

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (expanded) {
      setW(prevSize.w)
      setH(prevSize.h)
      onResize(item.id, prevSize.w, prevSize.h)
      setExpanded(false)
    } else {
      setPrevSize({ w, h })
      setW(800)
      setH(450)
      onResize(item.id, 800, 450)
      setExpanded(true)
    }
  }

  const videoId: string = item.content?.videoId || ''
  const iframeSrc = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1&iv_load_policy=3`
    : ''

  return (
    <div
      data-item="true"
      style={{
        position: 'absolute',
        left: item.x,
        top: item.y,
        width: w,
        userSelect: 'none',
        transition: expanded ? 'width 200ms ease, height 200ms ease' : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top bar */}
      <div
        style={{
          height: 32,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          borderRadius: '8px 8px 0 0',
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          gap: 8,
          cursor: 'grab',
        }}
        onMouseDown={(e) => {
          e.stopPropagation()
          e.preventDefault()
          dragRef.current = { startMX: e.clientX, startMY: e.clientY, startX: item.x, startY: item.y }
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>▶</span>
        <span
          style={{
            flex: 1,
            fontSize: 12,
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.title || 'Video'}
        </span>
        <span
          title={expanded ? 'Minimize' : 'Expand'}
          style={{
            cursor: 'pointer',
            color: hovered ? 'var(--text)' : 'var(--text-dim)',
            fontSize: 14,
            padding: '0 3px',
            flexShrink: 0,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={toggleExpand}
        >
          {expanded ? '⊡' : '⤢'}
        </span>
        <span
          style={{
            cursor: 'pointer',
            color: hovered ? 'var(--text)' : 'var(--text-dim)',
            fontSize: 18,
            padding: '0 2px',
            lineHeight: 1,
            flexShrink: 0,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => onRemove(item.id)}
        >
          ×
        </span>
      </div>

      {/* Video area */}
      {videoId ? (
        <iframe
          src={iframeSrc}
          style={{
            width: '100%',
            height: h,
            border: '1px solid var(--border)',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            display: 'block',
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={item.title || 'Video'}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: h,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-dim)',
            fontSize: 13,
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <span>Video unavailable</span>
          {item.content?.youtubeSearchUrl && (
            <a
              href={item.content.youtubeSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                color: 'var(--accent)',
                textDecoration: 'none',
                border: '1px solid var(--border)',
                padding: '4px 10px',
                borderRadius: 4,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              Search YouTube →
            </a>
          )}
        </div>
      )}

      {/* Resize handle */}
      <div
        style={{
          position: 'absolute',
          bottom: 4,
          right: 4,
          width: 16,
          height: 16,
          cursor: 'se-resize',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 150ms ease',
        }}
        onMouseDown={(e) => {
          e.stopPropagation()
          e.preventDefault()
          resizeRef.current = { startMX: e.clientX, startMY: e.clientY, startW: w, startH: h }
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 14L14 4M8 14L14 8M12 14L14 12" stroke="var(--border-bright)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}
