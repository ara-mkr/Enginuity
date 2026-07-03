// Empty-canvas easter egg, following the OhmaOwl convention from
// <UISettingsPanel /> — same owl geometry, but dozing (lidded eyes) until the
// first component wakes the canvas. Muted tones only, no glow.

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
        <svg width="44" height="44" viewBox="0 0 20 20" fill="currentColor" style={{ display: 'block' }}>
          {/* Body */}
          <ellipse cx="10" cy="13" rx="5.5" ry="6" />
          {/* Head */}
          <circle cx="10" cy="6.5" r="4.5" />
          {/* Eye whites */}
          <circle cx="8" cy="6" r="1.8" fill="var(--color-bg)" />
          <circle cx="12" cy="6" r="1.8" fill="var(--color-bg)" />
          {/* Dozing lids instead of pupils */}
          <path d="M6.8 6.2 Q8 7 9.2 6.2" stroke="currentColor" strokeWidth="0.7" fill="none" strokeLinecap="round" />
          <path d="M10.8 6.2 Q12 7 13.2 6.2" stroke="currentColor" strokeWidth="0.7" fill="none" strokeLinecap="round" />
          {/* Beak */}
          <path d="M9.2 8.2 L10 9.4 L10.8 8.2 Z" fill="var(--color-warning, #d4933d)" />
          {/* Ear tufts */}
          <path d="M6.5 3 L7 1 L8 3.5Z" />
          <path d="M13.5 3 L13 1 L12 3.5Z" />
          {/* Wings */}
          <path d="M4.5 14 Q2.5 11 4.5 9" stroke="var(--color-bg)" strokeWidth="1" fill="none" />
          <path d="M15.5 14 Q17.5 11 15.5 9" stroke="var(--color-bg)" strokeWidth="1" fill="none" />
        </svg>
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
