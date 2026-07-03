import { useEffect, useState } from 'react'
import type { JarvisVisualState } from './useOrbState'

interface Props {
  state: JarvisVisualState
  lastResponse: string
  interimTranscript: string
}

export function SubtitleSystem({ state, lastResponse, interimTranscript }: Props) {
  const [visibleResponse, setVisibleResponse] = useState('')
  const [responseOpacity, setResponseOpacity] = useState(0)

  useEffect(() => {
    if (lastResponse) {
      setVisibleResponse(lastResponse)
      setResponseOpacity(1)
      const t = setTimeout(() => setResponseOpacity(0), 3500)
      return () => clearTimeout(t)
    }
  }, [lastResponse])

  const sleepingHint = state === 'sleeping' && !visibleResponse
  const showInterim = interimTranscript && interimTranscript.length > 0

  return (
    <>
      {/* User interim transcript — above Jarvis transcript */}
      {showInterim && (
        <div
          style={{
            position: 'absolute',
            bottom: 140,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 640,
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: 10,
            fontFamily: '"Geist Mono", monospace',
            fontWeight: 400,
            fontSize: 11,
            color: 'rgba(0, 160, 220, 0.6)',
            fontStyle: 'italic',
            transition: 'opacity 200ms ease',
          }}
        >
          <span style={{ color: 'rgba(0, 200, 255, 0.7)' }}>› </span>
          {interimTranscript}
        </div>
      )}

      {/* Jarvis transcript — bottom of screen */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 640,
          textAlign: 'center',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        {/* Separator line */}
        <div
          style={{
            width: 200,
            height: 1,
            margin: '0 auto 10px auto',
            background:
              'linear-gradient(to right, transparent, rgba(0,180,255,0.4), transparent)',
          }}
        />

        {sleepingHint ? (
          <div
            style={{
              fontFamily: '"Geist Mono", monospace',
              fontSize: 11,
              color: 'rgba(0, 190, 240, 0.85)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            Say "Hey Jarvis" to begin
          </div>
        ) : (
          <div
            style={{
              fontFamily: '"Geist", "DM Sans", sans-serif',
              fontWeight: 400,
              fontSize: 15,
              color: 'rgba(0, 220, 255, 0.95)',
              lineHeight: 1.7,
              letterSpacing: '0.02em',
              textShadow: '0 0 15px rgba(0, 180, 255, 0.6)',
              opacity: responseOpacity,
              transition: 'opacity 500ms ease',
              minHeight: '1.7em',
            }}
          >
            {visibleResponse}
          </div>
        )}
      </div>
    </>
  )
}
