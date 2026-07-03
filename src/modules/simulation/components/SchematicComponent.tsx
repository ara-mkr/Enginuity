// Per-instance schematic symbol renderer: rotated symbol group, pin dots,
// refdes/value labels (kept unrotated for readability), and selection state.
// Selection is a stroke-color shift + subtle halo rect — no glow, per Polaris.

import { memo } from 'react'
import type { ComponentInstance } from '../types'
import { getDef } from '../componentDefs'
import { formatEngNotation } from '../core/engNotation'
import { rotateOffset } from '../core/geometry'

interface Props {
  component: ComponentInstance
  selected: boolean
  /** Node id under highlight (full-node highlight when a wire/pin is selected). */
  highlightedPins?: Set<string>
  showPins: boolean
  onPointerDown: (e: React.PointerEvent, id: string) => void
}

function primaryValueText(component: ComponentInstance): string | null {
  const def = getDef(component.type)
  const first = def.params[0]
  if (!first) return null
  const v = component.params[first.key]
  if (v === undefined) return null
  return formatEngNotation(v, first.unit === '°' ? '' : first.unit)
}

export const SchematicComponent = memo(function SchematicComponent({
  component,
  selected,
  highlightedPins,
  showPins,
  onPointerDown,
}: Props) {
  const def = getDef(component.type)
  const { x, y } = component.position
  const rotated = component.rotation === 90 || component.rotation === 270
  const w = rotated ? def.bounds.h : def.bounds.w
  const h = rotated ? def.bounds.w : def.bounds.h

  const stroke = selected ? 'var(--color-accent)' : 'var(--color-text-primary)'
  const value = primaryValueText(component)
  const isGround = component.type === 'ground'

  return (
    <g
      onPointerDown={(e) => onPointerDown(e, component.id)}
      style={{ cursor: 'move' }}
      data-component-id={component.id}
    >
      {/* Invisible hit area sized to the rotated bounds */}
      <rect
        x={x - w / 2 - 4}
        y={y - h / 2 - 4}
        width={w + 8}
        height={h + 8}
        fill="transparent"
        stroke="none"
      />
      {selected && (
        <rect
          x={x - w / 2 - 6}
          y={y - h / 2 - 6}
          width={w + 12}
          height={h + 12}
          rx={3}
          fill="none"
          stroke="var(--color-accent)"
          strokeOpacity={0.45}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}
      <g transform={`translate(${x} ${y}) rotate(${component.rotation})`} color={stroke}>
        {def.symbol}
      </g>

      {/* Pin markers */}
      {def.pins.map((pin) => {
        const off = rotateOffset(pin.offset, component.rotation)
        const px = x + off.x
        const py = y + off.y
        const pinId = `${component.id}:${pin.name}`
        const hl = highlightedPins?.has(pinId)
        if (!showPins && !hl) return null
        return (
          <circle
            key={pin.name}
            cx={px}
            cy={py}
            r={2.6}
            fill={hl ? 'var(--color-accent)' : 'var(--color-text-muted)'}
          />
        )
      })}

      {/* Labels — never rotated. Horizontal parts label above/below; vertical
          parts label to the right so stacked components don't collide. */}
      {!isGround && (
        <text
          x={rotated ? x + w / 2 + 6 : x}
          y={rotated ? y - 3 : y - h / 2 - 8}
          textAnchor={rotated ? 'start' : 'middle'}
          fill={selected ? 'var(--color-accent)' : 'var(--color-text-secondary)'}
          style={{ fontFamily: "var(--font-family-mono, 'Geist Mono', monospace)", fontSize: 10, userSelect: 'none' }}
        >
          {component.refdes}
        </text>
      )}
      {!isGround && value && (
        <text
          x={rotated ? x + w / 2 + 6 : x}
          y={rotated ? y + 9 : y + h / 2 + 14}
          textAnchor={rotated ? 'start' : 'middle'}
          fill="var(--color-text-muted)"
          style={{ fontFamily: "var(--font-family-mono, 'Geist Mono', monospace)", fontSize: 10, userSelect: 'none' }}
        >
          {value}
        </text>
      )}
    </g>
  )
})
