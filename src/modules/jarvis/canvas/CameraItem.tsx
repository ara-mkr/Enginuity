import { useRef, useState, useEffect } from 'react'
import { getVideoElement } from '../camera/cameraEngine'
import type { CanvasItem } from '../types'

export function CameraItem({
  item,
  onCapture,
  onClose,
}: {
  item: CanvasItem
  onCapture: () => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    const engineVideo = getVideoElement()
    const videoEl = videoRef.current
    if (!engineVideo || !videoEl) return

    // Share the MediaStream from the engine's video element
    videoEl.srcObject = engineVideo.srcObject
    videoEl
      .play()
      .then(() => setIsLive(true))
      .catch(() => {
        // autoplay may need user gesture; muted streams usually succeed
      })

    return () => {
      videoEl.srcObject = null
    }
  }, [])

  const w = item.width || 320
  const h = item.height || 240

  return (
    <div
      style={{
        width: w,
        userSelect: 'none',
        fontFamily: "'DM Sans Variable', 'DM Sans', sans-serif",
      }}
    >
      {/* Title bar */}
      <div
        style={{
          height: 30,
          background: 'rgba(8,8,16,0.95)',
          border: '1px solid var(--border-bright)',
          borderBottom: 'none',
          borderRadius: '8px 8px 0 0',
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          gap: 8,
        }}
      >
        {/* Live dot */}
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: isLive ? '#ff4444' : '#383838',
            flexShrink: 0,
            animation: isLive ? 'pulse-presence 1.5s ease infinite' : 'none',
          }}
        />
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            flex: 1,
          }}
        >
          {isLive ? 'Camera · Live' : 'Camera · Starting…'}
        </span>

        {/* Capture button */}
        <button
          onClick={(e) => { e.stopPropagation(); onCapture() }}
          onMouseDown={(e) => e.stopPropagation()}
          title="Take photo (or say 'take a photo')"
          style={{
            background: 'transparent',
            border: '1px solid var(--border-bright)',
            color: 'var(--text-muted)',
            borderRadius: 4,
            width: 22,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          ◫
        </button>

        {/* Close */}
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            fontSize: 16,
            padding: '0 2px',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* Video feed */}
      <div
        style={{
          width: '100%',
          height: h,
          background: '#000',
          border: '1px solid var(--border-bright)',
          borderTop: 'none',
          borderBottom: 'none',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            transform: 'scaleX(-1)',
          }}
        />

        {!isLive && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.75)',
              color: 'var(--text-dim)',
              fontSize: 12,
            }}
          >
            Starting camera…
          </div>
        )}

        {/* Corner framing guides */}
        {isLive && (
          <>
            <div style={{ position: 'absolute', top: 8, left: 8, width: 16, height: 16, borderTop: '1.5px solid rgba(148,165,186,0.5)', borderLeft: '1.5px solid rgba(148,165,186,0.5)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderTop: '1.5px solid rgba(148,165,186,0.5)', borderRight: '1.5px solid rgba(148,165,186,0.5)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 8, left: 8, width: 16, height: 16, borderBottom: '1.5px solid rgba(148,165,186,0.5)', borderLeft: '1.5px solid rgba(148,165,186,0.5)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 8, right: 8, width: 16, height: 16, borderBottom: '1.5px solid rgba(148,165,186,0.5)', borderRight: '1.5px solid rgba(148,165,186,0.5)', pointerEvents: 'none' }} />
          </>
        )}
      </div>

      {/* Bottom hint bar */}
      <div
        style={{
          height: 24,
          background: 'rgba(8,8,16,0.95)',
          border: '1px solid var(--border-bright)',
          borderTop: '1px solid var(--border)',
          borderRadius: '0 0 8px 8px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
        }}
      >
        <span
          style={{
            fontSize: 9,
            color: 'var(--text-dim)',
            fontFamily: 'monospace',
          }}
        >
          Say "what do you see" or "take a photo"
        </span>
      </div>
    </div>
  )
}
