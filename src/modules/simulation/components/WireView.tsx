import { memo } from 'react'
import type { Wire } from '../types'

interface Props {
  wire: Wire
  selected: boolean
  /** True when this wire belongs to the currently highlighted electrical node. */
  highlighted: boolean
  onPointerDown: (e: React.PointerEvent, id: string) => void
}

export const WireView = memo(function WireView({ wire, selected, highlighted, onPointerDown }: Props) {
  const d = wire.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const active = selected || highlighted
  return (
    <g onPointerDown={(e) => onPointerDown(e, wire.id)} style={{ cursor: 'pointer' }}>
      {/* Fat invisible stroke for easier clicking */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={10} />
      <path
        d={d}
        fill="none"
        stroke={active ? 'var(--color-accent)' : 'var(--color-text-secondary)'}
        strokeWidth={active ? 2 : 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  )
})
