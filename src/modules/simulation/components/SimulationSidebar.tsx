// Domain switcher rail. Circuits is the first fully-realized domain; the
// others are architectural placeholders so future domains slot in without a
// shell rewrite.

import { Box, Droplets, Thermometer, Zap } from 'lucide-react'

export type SimulationDomain = 'circuits' | 'mechanical' | 'thermal' | 'fluid'

interface Props {
  domain: SimulationDomain
  onDomainChange: (d: SimulationDomain) => void
}

const DOMAINS: Array<{
  id: SimulationDomain
  label: string
  icon: React.ComponentType<{ size?: number }>
  available: boolean
}> = [
  { id: 'circuits', label: 'Circuits', icon: Zap, available: true },
  { id: 'mechanical', label: 'Mechanical — coming later', icon: Box, available: false },
  { id: 'thermal', label: 'Thermal — coming later', icon: Thermometer, available: false },
  { id: 'fluid', label: 'Fluid — coming later', icon: Droplets, available: false },
]

export function SimulationSidebar({ domain, onDomainChange }: Props) {
  return (
    <div
      style={{
        width: 46,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '10px 0',
        borderRight: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
      }}
    >
      {DOMAINS.map((d) => {
        const Icon = d.icon
        const active = domain === d.id
        return (
          <button
            key={d.id}
            title={d.label}
            disabled={!d.available}
            onClick={() => d.available && onDomainChange(d.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              background: active ? 'var(--color-surface-raised)' : 'transparent',
              border: `1px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
              borderRadius: 7,
              color: active
                ? 'var(--color-accent)'
                : d.available
                  ? 'var(--color-text-secondary)'
                  : 'var(--color-text-muted)',
              opacity: d.available ? 1 : 0.45,
              cursor: d.available ? 'pointer' : 'default',
            }}
          >
            <Icon size={16} />
          </button>
        )
      })}
    </div>
  )
}
