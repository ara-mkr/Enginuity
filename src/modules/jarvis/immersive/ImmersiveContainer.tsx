import { useEffect, useState } from 'react'
import { CentralOrb } from './CentralOrb'
import { ImmersiveBackground } from './ImmersiveBackground'
import { SubtitleSystem } from './SubtitleSystem'
import { StatusPanel } from './StatusPanel'
import { ActivityLog } from './ActivityLog'
import { BottomBar } from './BottomBar'
import { getVideoElement } from '../camera/cameraEngine'
import type { JarvisVisualState } from './useOrbState'
import type { LogEntry, CanvasItem } from '../types'

interface Props {
  visible: boolean
  state: JarvisVisualState
  log: LogEntry[]
  interimTranscript: string
  isConnected: boolean
  activeModel: string
  provider: string
  canvasItems: CanvasItem[]
  cameraActive: boolean
  cameraVideoRef?: React.RefObject<HTMLVideoElement>
  waveformBars: number[]
  onExit: () => void
  onToggleMic: () => void
  onToggleCamera: () => void
  onToggleMute: () => void
  renderCanvas?: () => React.ReactNode
}

export function ImmersiveContainer({
  visible,
  state,
  log,
  interimTranscript,
  activeModel,
  provider,
  canvasItems,
  cameraActive,
  cameraVideoRef,
  waveformBars,
  onExit,
  onToggleMic,
  onToggleCamera,
  onToggleMute,
  renderCanvas,
}: Props) {
  const [now, setNow] = useState(new Date())
  const [canvasMode, setCanvasMode] = useState(false)
  const [opacity, setOpacity] = useState(0)
  const [scanIn, setScanIn] = useState(false)
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [sessionStart] = useState(() => Date.now())

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // The inset <video> only mounts once cameraActive flips true, which happens
  // in the same tick the engine fires its onStream callback — so the ref is
  // still null when that callback tries to attach the stream. Pull the live
  // stream from the engine singleton here instead, once the element exists.
  useEffect(() => {
    if (!cameraActive || !cameraVideoRef?.current) return
    const engineVideo = getVideoElement()
    if (!engineVideo?.srcObject) return
    cameraVideoRef.current.srcObject = engineVideo.srcObject
    cameraVideoRef.current.play().catch(() => {})
  }, [cameraActive, cameraVideoRef])

  // Mount-in animation
  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- kicking off a one-time mount-in scan animation
      setScanIn(true)
      const t1 = setTimeout(() => setOpacity(1), 200)
      const t2 = setTimeout(() => setScanIn(false), 450)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    } else {
      setOpacity(0)
    }
  }, [visible])

  // Clock tick
  useEffect(() => {
    if (!visible) return
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [visible])

  // Keyboard shortcuts
  useEffect(() => {
    if (!visible) return
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onExit()
      } else if (e.key === ' ' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault()
        onToggleMic()
      } else if (e.key.toLowerCase() === 'c') {
        setCanvasMode((m) => !m)
      } else if (e.key.toLowerCase() === 'v') {
        onToggleCamera()
      } else if (e.key.toLowerCase() === 'm') {
        onToggleMute()
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [visible, onExit, onToggleMic, onToggleCamera, onToggleMute])

  if (!visible && opacity === 0) return null

  const log_jarvis = [...log].reverse().find((l) => l.role === 'jarvis')
  const lastResponse = log_jarvis?.text || ''

  const dot =
    state === 'sleeping'
      ? 'rgba(0,140,210,0.8)'
      : state === 'processing'
      ? '#00d4ff'
      : '#00ccff'
  const statusText =
    state === 'sleeping'
      ? 'STANDBY'
      : state === 'listening'
      ? 'LISTENING'
      : state === 'processing'
      ? 'PROCESSING'
      : 'RESPONDING'

  const timeStr =
    now.toLocaleTimeString('en-US', { hour12: false }) +
    ' · ' +
    now
      .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      .toUpperCase()
      .replace(/\s/g, ' ')

  // Orb is centered in the content box (viewport minus 48px top bar and 72px
  // bottom bar); the transcripts occupy the bottom ~190px of that box
  // (SubtitleSystem: interim at bottom 140, response at bottom 80). Clamp the
  // orb diameter so its ring stays clear of the subtitle band and inside the
  // orb column at short or narrow viewports.
  const contentH = viewport.h - 120
  const orbColumnW = canvasMode ? viewport.w * 0.55 : viewport.w
  const orbSize = Math.max(220, Math.min(canvasMode ? 360 : 600, contentH - 380, orbColumnW - 48))

  return (
    <>
      {/* enter scan line */}
      {scanIn && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            background:
              'linear-gradient(to bottom, transparent 0%, rgba(0,160,255,0.18) 50%, transparent 100%)',
            animation: 'jarvis-scan-enter 400ms ease forwards',
            pointerEvents: 'none',
          }}
        />
      )}

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: '#020810',
          overflow: 'hidden',
          opacity,
          transition: 'opacity 300ms ease',
          fontFamily: '"DM Sans", sans-serif',
        }}
      >
        <ImmersiveBackground />

        {/* TOP BAR */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 48,
            borderBottom: '1px solid rgba(0,160,230,0.45)',
            background: 'rgba(2,15,35,0.9)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
            gap: 16,
            zIndex: 20,
          }}
        >
          <span
            style={{
              fontFamily: '"Geist Mono", monospace',
              fontWeight: 500,
              fontSize: 13,
              color: '#00d4ff',
              letterSpacing: '0.2em',
              textShadow: '0 0 10px rgba(0, 212, 255, 0.4)',
            }}
          >
            J.A.R.V.I.S
          </span>
          <div style={{ width: 1, height: 16, background: 'rgba(0,160,230,0.45)' }} />

          {/* status indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: dot,
                boxShadow: state !== 'sleeping' ? `0 0 6px ${dot}` : 'none',
                animation:
                  state === 'listening' || state === 'speaking'
                    ? 'jarvis-pulse-blue 2s ease infinite'
                    : 'none',
              }}
            />
            <span
              style={{
                fontFamily: '"Geist Mono", monospace',
                fontSize: 10,
                color: 'rgba(0,210,255,0.9)',
                letterSpacing: '0.15em',
              }}
            >
              {statusText}
            </span>
          </div>

          {/* center: time */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <span
              style={{
                fontFamily: '"Geist Mono", monospace',
                fontSize: 11,
                color: 'rgba(0,200,245,0.9)',
                letterSpacing: '0.1em',
              }}
            >
              {timeStr}
            </span>
          </div>

          {/* right cluster */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CanvasToggle on={canvasMode} onToggle={() => setCanvasMode((m) => !m)} />
            <div style={{ width: 1, height: 16, background: 'rgba(0,160,230,0.45)' }} />
            <button
              onClick={onExit}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: '"Geist Mono", monospace',
                fontSize: 10,
                color: 'rgba(0,190,240,0.9)',
                letterSpacing: '0.2em',
                padding: '4px 8px',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(0,220,255,1)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(0,190,240,0.9)')}
            >
              EXIT
            </button>
          </div>
        </div>

        {/* Main content area — splits horizontally when canvasMode is on */}
        <div style={{ position: 'absolute', inset: 0, paddingTop: 48, paddingBottom: 72, display: 'flex' }}>
          <div
            style={{
              position: 'relative',
              width: canvasMode ? '55%' : '100%',
              height: '100%',
              transition: 'width 300ms ease',
            }}
          >
            {/* Central orb */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                zIndex: 5,
              }}
            >
              <CentralOrb state={state} size={orbSize} />
            </div>

            <SubtitleSystem state={state} lastResponse={lastResponse} interimTranscript={interimTranscript} />

            {!canvasMode && (
              <>
                <StatusPanel
                  voiceActive={state !== 'sleeping'}
                  cameraActive={cameraActive}
                  model={activeModel}
                  provider={provider}
                  canvasVisible={canvasMode}
                />
                <ActivityLog log={log} canvasItemCount={canvasItems.length} />
              </>
            )}

            {/* Camera inset */}
            {cameraActive && cameraVideoRef && (
              <>
                {/* Circular Camera container */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 28,
                    left: 240,
                    width: 150,
                    height: 150,
                    transform: 'none',
                    border: '2px solid rgba(0,180,240,0.65)',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: '#000a14',
                    boxShadow: '0 0 15px rgba(0,180,240,0.4)',
                    animation: 'jarvis-fade-in 300ms ease',
                    zIndex: 5,
                  }}
                >
                  <video
                    ref={cameraVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 8,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'rgba(2,15,35,0.75)',
                      padding: '2px 6px',
                      borderRadius: 10,
                      border: '1px solid rgba(0,180,240,0.3)',
                    }}
                  >
                    <div
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: '#00a8ff',
                        animation: 'jarvis-pulse-blue 2s ease infinite',
                      }}
                    />
                    <span
                      style={{
                        fontFamily: '"Geist Mono", monospace',
                        fontSize: 7,
                        color: 'rgba(0,210,255,0.9)',
                        letterSpacing: '0.1em',
                      }}
                    >
                      CAM_ON
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {canvasMode && (
            <div
              style={{
                width: '45%',
                height: '100%',
                borderLeft: '1px solid rgba(0,140,210,0.3)',
                position: 'relative',
                background: '#111111',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  left: 12,
                  fontFamily: '"Geist Mono", monospace',
                  fontSize: 10,
                  color: 'rgba(0,120,180,0.45)',
                  letterSpacing: '0.2em',
                  zIndex: 1,
                }}
              >
                CANVAS
              </div>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  minWidth: 0,
                  minHeight: 0,
                }}
              >
                {renderCanvas?.()}
              </div>
            </div>
          )}
        </div>

        <BottomBar
          state={state}
          cameraActive={cameraActive}
          waveformBars={waveformBars}
          onToggleMic={onToggleMic}
          onToggleCamera={onToggleCamera}
          modelName={activeModel}
          canvasItemCount={canvasItems.length}
          sessionStart={sessionStart}
        />

        <style>{`
          @keyframes jarvis-pulse-blue {
            0%, 100% { opacity: 1; box-shadow: 0 0 4px #00a0ff }
            50% { opacity: 0.4; box-shadow: 0 0 8px #00a0ff }
          }
          @keyframes jarvis-scan-enter {
            from { transform: translateY(-100%) }
            to { transform: translateY(100%) }
          }
          @keyframes jarvis-ambient-scan {
            from { top: 0% }
            to { top: 100% }
          }
          @keyframes jarvis-scroll-left {
            from { transform: translateX(0) }
            to { transform: translateX(-100%) }
          }
          @keyframes jarvis-fade-in {
            from { opacity: 0 }
            to { opacity: 1 }
          }
        `}</style>
      </div>
    </>
  )
}

function CanvasToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          fontFamily: '"Geist Mono", monospace',
          fontSize: 10,
          color: 'rgba(0,190,240,0.9)',
          letterSpacing: '0.15em',
        }}
      >
        CANVAS
      </span>
      <button
        onClick={onToggle}
        style={{
          width: 28,
          height: 16,
          borderRadius: 8,
          background: on ? 'rgba(0,168,255,0.2)' : 'rgba(0,60,120,0.5)',
          border: '1px solid rgba(0,140,210,0.4)',
          position: 'relative',
          cursor: 'pointer',
          padding: 0,
          transition: 'all 200ms ease',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 1,
            left: on ? 13 : 1,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: on ? '#00a8ff' : 'rgba(0,80,140,0.6)',
            transition: 'left 200ms ease',
            boxShadow: on ? '0 0 6px rgba(0,168,255,0.6)' : 'none',
          }}
        />
      </button>
    </div>
  )
}
