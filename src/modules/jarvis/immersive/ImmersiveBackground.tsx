export function ImmersiveBackground() {
  return (
    <>
      {/* Layer 1: deep sea blue */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 50% 40%, #051428 0%, #030d1e 40%, #020810 75%, #010509 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Layer 2: perspective grid */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.45,
          pointerEvents: 'none',
        }}
        preserveAspectRatio="none"
        viewBox="0 0 1000 1000"
      >
        {/* horizontal floor lines */}
        {Array.from({ length: 14 }).map((_, i) => {
          const t = i / 13
          const y = 500 + Math.pow(t, 1.8) * 500
          const spread = 1000 - (1 - t) * 600
          const x1 = (1000 - spread) / 2
          const x2 = x1 + spread
          return (
            <line
              key={`h-${i}`}
              x1={x1}
              y1={y}
              x2={x2}
              y2={y}
              stroke="rgba(0,140,220,0.55)"
              strokeWidth="0.6"
            />
          )
        })}
        {/* converging vertical lines */}
        {Array.from({ length: 21 }).map((_, i) => {
          const t = i / 20
          const x = t * 1000
          return (
            <line
              key={`v-${i}`}
              x1={x}
              y1={1000}
              x2={500}
              y2={500}
              stroke="rgba(0,140,220,0.45)"
              strokeWidth="0.6"
            />
          )
        })}
      </svg>

      {/* Layer 3: ambient scan line */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 1,
          opacity: 0.9,
          background:
            'linear-gradient(to right, transparent 0%, rgba(0,200,255,0.6) 20%, rgba(0,230,255,0.95) 50%, rgba(0,200,255,0.6) 80%, transparent 100%)',
          boxShadow: '0 0 8px rgba(0,200,255,0.5)',
          animation: 'jarvis-ambient-scan 6s linear infinite',
          pointerEvents: 'none',
        }}
      />

      {/* Layer 4: corner HUD marks */}
      {[
        { top: 20, left: 20, borderTop: 1, borderLeft: 1 },
        { top: 20, right: 20, borderTop: 1, borderRight: 1 },
        { bottom: 20, left: 20, borderBottom: 1, borderLeft: 1 },
        { bottom: 20, right: 20, borderBottom: 1, borderRight: 1 },
      ].map((pos, i) => {
        const style: React.CSSProperties = {
          position: 'absolute',
          width: 40,
          height: 40,
          pointerEvents: 'none',
        }
        if (pos.top !== undefined) style.top = pos.top
        if (pos.bottom !== undefined) style.bottom = pos.bottom
        if (pos.left !== undefined) style.left = pos.left
        if (pos.right !== undefined) style.right = pos.right
        if (pos.borderTop) style.borderTop = '1px solid rgba(0,200,255,0.8)'
        if (pos.borderBottom) style.borderBottom = '1px solid rgba(0,200,255,0.8)'
        if (pos.borderLeft) style.borderLeft = '1px solid rgba(0,200,255,0.8)'
        if (pos.borderRight) style.borderRight = '1px solid rgba(0,200,255,0.8)'
        return <div key={i} style={style} />
      })}
    </>
  )
}
