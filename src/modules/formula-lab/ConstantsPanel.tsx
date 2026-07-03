import { useState } from 'react'
import { Search } from 'lucide-react'
import type { EngineeringConstant } from './types'

export const CONSTANTS: EngineeringConstant[] = [
  { symbol: 'g', name: 'Gravitational acceleration', value: 9.80665, unit: 'm/s²' },
  { symbol: 'G', name: 'Gravitational constant', value: 6.674e-11, unit: 'N⋅m²/kg²' },
  { symbol: 'c', name: 'Speed of light', value: 299792458, unit: 'm/s' },
  { symbol: 'h', name: 'Planck constant', value: 6.626e-34, unit: 'J⋅s' },
  { symbol: 'k', name: 'Boltzmann constant', value: 1.381e-23, unit: 'J/K' },
  { symbol: 'e', name: 'Elementary charge', value: 1.602e-19, unit: 'C' },
  { symbol: 'ε₀', name: 'Permittivity of free space', value: 8.854e-12, unit: 'F/m' },
  { symbol: 'μ₀', name: 'Permeability of free space', value: 1.257e-6, unit: 'H/m' },
  { symbol: 'NA', name: 'Avogadro constant', value: 6.022e23, unit: 'mol⁻¹' },
  { symbol: 'R', name: 'Gas constant', value: 8.314, unit: 'J/(mol⋅K)' },
  { symbol: 'σ', name: 'Stefan-Boltzmann constant', value: 5.67e-8, unit: 'W/(m²⋅K⁴)' },
  { symbol: 'atm', name: 'Standard atmosphere', value: 101325, unit: 'Pa' },
  { symbol: '∞', name: 'Copper resistivity', value: 1.68e-8, unit: 'Ω⋅m' },
]

interface ConstantsPanelProps {
  onSelectConstant: (value: number) => void
}

export function ConstantsPanel({ onSelectConstant }: ConstantsPanelProps) {
  const [search, setSearch] = useState('')

  const filtered = CONSTANTS.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.symbol.toLowerCase().includes(search.toLowerCase()) ||
      c.unit.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 20,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div>
        <h2 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>
          Engineering Constants
        </h2>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
          Click any constant to insert its value.
        </p>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search constants..."
          style={{
            width: '100%',
            padding: '8px 12px 8px 32px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 12,
            outline: 'none',
          }}
        />
      </div>

      {/* Constants List */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
        {filtered.length > 0 ? (
          filtered.map((c) => (
            <div
              key={c.symbol}
              onClick={() => onSelectConstant(c.value)}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)'
                e.currentTarget.style.background = 'var(--accent-glow)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.background = 'var(--surface-2)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 13, color: 'var(--accent)' }}>
                  {c.symbol}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {c.unit}
                </span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)' }}>
                {c.name}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                {c.value.toString()}
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', padding: '20px 0' }}>
            No constants found.
          </div>
        )}
      </div>
    </div>
  )
}
