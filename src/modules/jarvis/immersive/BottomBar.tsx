import { Mic, Camera } from 'lucide-react'
import type { JarvisVisualState } from './useOrbState'

interface Props {
  state: JarvisVisualState
  cameraActive: boolean
  waveformBars: number[]
  onToggleMic: () => void
  onToggleCamera: () => void
  modelName: string
  canvasItemCount: number
  sessionStart: number
}

export function BottomBar({
  state,
  cameraActive,
  waveformBars,
  onToggleMic,
  onToggleCamera,
  modelName,
  canvasItemCount,
  sessionStart,
}: Props) {
  const stateText =
    state === 'listening' ? 'LISTENING…' : state === 'processing' ? 'PROCESSING…' : state === 'speaking' ? 'RESPONDING…' : ''
  // Parent (ImmersiveContainer) re-renders this every second via its own
  // clock-tick state, so reading the live time here just keeps the status
  // readout in sync with that tick rather than introducing new impurity.
  // eslint-disable-next-line react-hooks/purity
  const sessionMins = Math.floor((Date.now() - sessionStart) / 60000)
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false })
  const readout = `SYS · ${ts} · ${state === 'sleeping' ? 'VOICE_STANDBY' : 'VOICE_ACTIVE'} · ORB_NOMINAL · CANVAS_ITEMS_${canvasItemCount} · MODEL_${(
    modelName || 'AUTO'
  ).toUpperCase()} · SESSION_${sessionMins}M`

  const isListening = state === 'listening' || state === 'speaking' || state === 'processing'

  return (
    <>
      {/* scrolling readout strip */}
      <div
        style={{
          position: 'absolute',
          bottom: 56,
          left: 0,
          right: 0,
          height: 16,
          overflow: 'hidden',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 20,
        }}
      >
        <div
          style={{
            display: 'inline-block',
            fontFamily: '"Geist Mono", monospace',
            fontSize: 8,
            color: 'rgba(0,120,200,0.65)',
            letterSpacing: '0.1em',
            animation: 'jarvis-scroll-left 30s linear infinite',
            paddingLeft: '100vw',
          }}
        >
          {readout}  ·  {readout}  ·  {readout}
        </div>
      </div>

      {/* bottom control bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 56,
          borderTop: '1px solid rgba(0,160,230,0.45)',
          background: 'rgba(2,12,30,0.92)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 32px',
          gap: 20,
          zIndex: 20,
        }}
      >
        {/* mic button */}
        <button
          onClick={onToggleMic}
          title="Toggle voice (Space)"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: isListening ? 'rgba(0,212,255,0.18)' : 'transparent',
            border: `1px solid ${isListening ? '#00d4ff' : 'rgba(0,160,230,0.5)'}`,
            color: isListening ? '#00d4ff' : 'rgba(0,160,210,0.65)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 200ms ease',
            boxShadow: isListening ? '0 0 8px rgba(0,212,255,0.3)' : 'none',
          }}
        >
          <Mic size={18} />
        </button>

        {/* camera button */}
        <button
          onClick={onToggleCamera}
          title="Toggle camera (V)"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: cameraActive ? 'rgba(0,212,255,0.18)' : 'transparent',
            border: `1px solid ${cameraActive ? '#00d4ff' : 'rgba(0,160,230,0.5)'}`,
            color: cameraActive ? '#00d4ff' : 'rgba(0,160,210,0.65)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 200ms ease',
          }}
        >
          <Camera size={18} />
        </button>

        {/* center: waveform */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 3 }}>
          {waveformBars.map((h, i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: `${Math.max(4, h * 2)}px`,
                background: isListening ? '#00d4ff' : 'rgba(0,130,200,0.6)',
                borderRadius: 2,
                boxShadow: isListening ? '0 0 4px #00a8ff' : 'none',
                transition: 'height 60ms ease',
              }}
            />
          ))}
        </div>

        {/* right: state */}
        <div
          style={{
            fontFamily: '"Geist Mono", monospace',
            fontSize: state === 'sleeping' ? 9 : 10,
            color: state === 'sleeping' ? 'rgba(0,190,240,0.85)' : 'rgba(0,220,255,0.98)',
            letterSpacing: state === 'sleeping' ? '0.1em' : '0.15em',
            textShadow: state === 'sleeping' ? 'none' : '0 0 8px rgba(0,180,255,0.4)',
            minWidth: 130,
            textAlign: 'right',
          }}
        >
          {state === 'sleeping' ? 'CLICK MIC TO BEGIN' : stateText}
        </div>
      </div>
    </>
  )
}
