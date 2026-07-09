// Empty-canvas easter egg, following the OhmaOwl convention from
// <UISettingsPanel /> — the real Ohma mascot, muted until the first
// component wakes the canvas.

import ohmaMascot from '../../../assets/ohma-mascot.png'

export function OhmaDormant() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        pointerEvents: 'none',
        color: 'var(--color-text-muted)',
      }}
    >
      <span title="Ohma is dozing 🦉" style={{ display: 'inline-flex', opacity: 0.55 }}>
        <img src={ohmaMascot} alt="Ohma" width={44} height={44} style={{ display: 'block' }} />
      </span>
      <div
        style={{
          fontFamily: "var(--font-family-ui, 'Geist', sans-serif)",
          fontSize: 12.5,
          letterSpacing: '0.01em',
          opacity: 0.8,
        }}
      >
        Ohma is dozing — place a component to wake the canvas.
      </div>
      <div
        style={{
          fontFamily: "var(--font-family-mono, 'Geist Mono', monospace)",
          fontSize: 10.5,
          color: 'var(--color-text-muted)',
          opacity: 0.7,
        }}
      >
        W wire · R rotate · Del delete · scroll zoom · drag pan
      </div>
    </div>
  )
}
