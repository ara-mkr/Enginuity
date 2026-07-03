import { RadarMini } from './RadarMini'

interface Props {
  voiceActive: boolean
  cameraActive: boolean
  model: string
  provider: string
  canvasVisible: boolean
}

const ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  height: 28,
  borderBottom: '1px solid rgba(0,100,180,0.25)',
  fontFamily: '"Geist Mono", monospace',
}

const LABEL: React.CSSProperties = {
  fontSize: 9,
  color: 'rgba(0,160,210,0.75)',
  letterSpacing: '0.2em',
}

const VALUE: React.CSSProperties = {
  fontSize: 10,
  color: 'rgba(0,220,255,0.98)',
  letterSpacing: '0.05em',
}

export function StatusPanel({ voiceActive, cameraActive, model, provider, canvasVisible }: Props) {
  const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
  return (
    <div
      style={{
        position: 'absolute',
        left: 32,
        top: 80,
        width: 200,
        maxWidth: 180,
        pointerEvents: 'none',
        background: 'rgba(0, 20, 50, 0.45)',
        border: '1px solid rgba(0, 150, 220, 0.35)',
        borderRadius: 6,
        padding: 14,
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 4,
      }}
    >
      <div
        style={{
          fontFamily: '"Geist Mono", monospace',
          fontSize: 9,
          color: 'rgba(0,200,255,0.9)',
          letterSpacing: '0.18em',
          borderBottom: '1px solid rgba(0,150,220,0.35)',
          paddingBottom: 8,
          marginBottom: 12,
        }}
      >
        SYS STATUS
      </div>

      <div style={ROW}>
        <span style={LABEL}>VOICE</span>
        <span style={VALUE}>{voiceActive ? 'ACTIVE' : 'STANDBY'}</span>
      </div>
      <div style={ROW}>
        <span style={LABEL}>CAMERA</span>
        <span style={VALUE}>{cameraActive ? 'ON' : 'OFF'}</span>
      </div>
      <div style={ROW}>
        <span style={LABEL}>MODEL</span>
        <span style={VALUE}>{truncate((model || 'AUTO').toUpperCase(), 12)}</span>
      </div>
      <div style={ROW}>
        <span style={LABEL}>PROVIDER</span>
        <span style={VALUE}>{provider.toUpperCase()}</span>
      </div>
      <div style={ROW}>
        <span style={LABEL}>CANVAS</span>
        <span style={VALUE}>{canvasVisible ? 'VISIBLE' : 'HIDDEN'}</span>
      </div>

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
        <RadarMini size={80} />
      </div>
    </div>
  )
}
