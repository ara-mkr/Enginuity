import type { PinDef } from './types'

const PIN_COLORS: Record<string, string> = {
  power: 'var(--accent)',
  ground: '#b08080',
  input: '#7aaa8a',
  output: '#b09470',
  bidirectional: '#9485b8',
  nc: 'var(--text-dim)',
}

function getPinColor(type: string): string {
  const t = type.toLowerCase()
  if (/vcc|vdd|vin|power|supply|pwr/.test(t)) return PIN_COLORS.power
  if (/gnd|vss|ground/.test(t)) return PIN_COLORS.ground
  if (/^in$|input/.test(t)) return PIN_COLORS.input
  if (/^out$|output/.test(t)) return PIN_COLORS.output
  if (/bidir|io|i\/o/.test(t)) return PIN_COLORS.bidirectional
  if (/^nc$|no.connect/.test(t)) return PIN_COLORS.nc
  return 'var(--text-muted)'
}

function detectPackageShape(packages: string[]): string {
  const pkg = (packages[0] ?? '').toUpperCase()
  if (/SOT-23|SOT23|TO-92/.test(pkg)) return 'sot23'
  if (/QFP|QFN|LQF|TQFP/.test(pkg)) return 'qfp'
  return 'dip'
}

function DIPDiagram({ pins }: { pins: PinDef[] }) {
  const half = Math.ceil(pins.length / 2)
  const leftPins = pins.slice(0, half)
  const rightPins = [...pins.slice(half)].reverse()

  const pinH = 32
  const bodyWidth = 120
  const pinWidth = 36
  const totalWidth = bodyWidth + pinWidth * 2 + 40
  const bodyH = Math.max(half, 1) * pinH + 16
  const totalH = bodyH + 24
  const bodyX = pinWidth + 20
  const bodyY = 12

  return (
    <svg width={totalWidth} height={totalH} style={{ overflow: 'visible', maxWidth: '100%' }}>
      {/* Body */}
      <rect
        x={bodyX} y={bodyY}
        width={bodyWidth} height={bodyH}
        rx={6}
        fill="var(--surface-2)"
        stroke="var(--border-bright)"
        strokeWidth={1.5}
      />
      {/* Notch */}
      <path
        d={`M ${bodyX + bodyWidth / 2 - 10} ${bodyY} A 10 10 0 0 1 ${bodyX + bodyWidth / 2 + 10} ${bodyY}`}
        fill="var(--bg)"
        stroke="var(--border-bright)"
        strokeWidth={1.5}
      />

      {/* Left pins */}
      {leftPins.map((p, i) => {
        const y = bodyY + 8 + i * pinH + pinH / 2
        const color = getPinColor(p.type)
        return (
          <g key={`l-${i}`}>
            <line x1={bodyX} y1={y} x2={bodyX - pinWidth} y2={y} stroke={color} strokeWidth={2} />
            <circle cx={bodyX - pinWidth} cy={y} r={4} fill={color} />
            <text x={bodyX - pinWidth - 6} y={y + 4} textAnchor="end"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fill: 'var(--text-muted)' }}>
              {p.pin}
            </text>
            <text x={bodyX + 8} y={y + 4}
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fill: color }}>
              {p.name.length > 10 ? p.name.slice(0, 10) + '…' : p.name}
            </text>
          </g>
        )
      })}

      {/* Right pins */}
      {rightPins.map((p, i) => {
        const y = bodyY + 8 + i * pinH + pinH / 2
        const color = getPinColor(p.type)
        const rx = bodyX + bodyWidth
        return (
          <g key={`r-${i}`}>
            <line x1={rx} y1={y} x2={rx + pinWidth} y2={y} stroke={color} strokeWidth={2} />
            <circle cx={rx + pinWidth} cy={y} r={4} fill={color} />
            <text x={rx + pinWidth + 6} y={y + 4} textAnchor="start"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fill: 'var(--text-muted)' }}>
              {p.pin}
            </text>
            <text x={rx - 8} y={y + 4} textAnchor="end"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fill: color }}>
              {p.name.length > 10 ? p.name.slice(0, 10) + '…' : p.name}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function SOT23Diagram({ pins }: { pins: PinDef[] }) {
  const p = pins.slice(0, 3)
  const positions = [
    { x: 40, y: 100 },
    { x: 160, y: 100 },
    { x: 100, y: 20 },
  ]
  return (
    <svg width={200} height={130}>
      <polygon points="60,90 140,90 100,30" fill="var(--surface-2)" stroke="var(--border-bright)" strokeWidth={1.5} />
      {p.map((pin, i) => {
        const pos = positions[i]
        const color = getPinColor(pin.type)
        return (
          <g key={i}>
            <circle cx={pos.x} cy={pos.y} r={6} fill={color} />
            <text x={pos.x} y={pos.y - 10} textAnchor="middle"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fill: color }}>
              {pin.name}
            </text>
            <text x={pos.x} y={pos.y + 20} textAnchor="middle"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fill: 'var(--text-muted)' }}>
              {pin.pin}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function QFPDiagram({ pins }: { pins: PinDef[] }) {
  const n = pins.length
  const perSide = Math.ceil(n / 4)
  const size = 160
  const pinLen = 24
  const pitch = size / (perSide + 1)
  const totalSize = size + pinLen * 2

  const sides = [
    pins.slice(0, perSide),
    pins.slice(perSide, perSide * 2),
    [...pins.slice(perSide * 2, perSide * 3)].reverse(),
    [...pins.slice(perSide * 3)].reverse(),
  ]

  return (
    <svg width={totalSize} height={totalSize}>
      <rect x={pinLen} y={pinLen} width={size} height={size}
        rx={4} fill="var(--surface-2)" stroke="var(--border-bright)" strokeWidth={1.5} />
      {/* Left */}
      {sides[3].map((p, i) => {
        const y = pinLen + pitch * (i + 1)
        const color = getPinColor(p.type)
        return (
          <g key={`L${i}`}>
            <line x1={0} y1={y} x2={pinLen} y2={y} stroke={color} strokeWidth={1.5} />
            <circle cx={0} cy={y} r={3} fill={color} />
            <text x={pinLen + 6} y={y + 3} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, fill: color }}>
              {p.name.slice(0, 8)}
            </text>
          </g>
        )
      })}
      {/* Right */}
      {sides[1].map((p, i) => {
        const y = pinLen + pitch * (i + 1)
        const color = getPinColor(p.type)
        return (
          <g key={`R${i}`}>
            <line x1={pinLen + size} y1={y} x2={totalSize} y2={y} stroke={color} strokeWidth={1.5} />
            <circle cx={totalSize} cy={y} r={3} fill={color} />
            <text x={pinLen + size - 6} y={y + 3} textAnchor="end"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7, fill: color }}>
              {p.name.slice(0, 8)}
            </text>
          </g>
        )
      })}
      {/* Top */}
      {sides[0].map((p, i) => {
        const x = pinLen + pitch * (i + 1)
        const color = getPinColor(p.type)
        return (
          <g key={`T${i}`}>
            <line x1={x} y1={0} x2={x} y2={pinLen} stroke={color} strokeWidth={1.5} />
            <circle cx={x} cy={0} r={3} fill={color} />
          </g>
        )
      })}
      {/* Bottom */}
      {sides[2].map((p, i) => {
        const x = pinLen + pitch * (i + 1)
        const color = getPinColor(p.type)
        return (
          <g key={`B${i}`}>
            <line x1={x} y1={pinLen + size} x2={x} y2={totalSize} stroke={color} strokeWidth={1.5} />
            <circle cx={x} cy={totalSize} r={3} fill={color} />
          </g>
        )
      })}
    </svg>
  )
}

interface Props {
  pins: PinDef[]
  packages: string[]
}

export function PinoutDiagram({ pins, packages }: Props) {
  if (!pins.length) return <p style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>No pinout data extracted.</p>

  const shape = detectPackageShape(packages)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ padding: '24px 32px', background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
        {shape === 'sot23' && <SOT23Diagram pins={pins} />}
        {shape === 'qfp' && <QFPDiagram pins={pins} />}
        {shape === 'dip' && <DIPDiagram pins={pins} />}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        {Object.entries(PIN_COLORS).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: v }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{k}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
