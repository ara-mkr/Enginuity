import { useState, useEffect, useRef } from 'react'
import {
  Palette, Type, LayoutGrid, Zap, Eye, X, RotateCcw,
  Download, Upload, Check, Shuffle, HardDrive,
} from 'lucide-react'
import {
  useUISettings, THEME_PRESETS, DEFAULT_SETTINGS,
  FONT_FAMILIES, MONO_FONTS,
} from '../../hooks/useUISettings'
import type { UISettings, ThemeColors } from '../../hooks/useUISettings'
import { StoragePanel } from '../StoragePanel'
import ohmaMascot from '../../assets/ohma-mascot.png'

// ── Curated accent palette ────────────────────────────────────────────────────

const ACCENT_PALETTE = [
  '#94a5ba', // polaris steel (default)
  '#58a6ff', // radar blue
  '#3fb950', // terminal green
  '#e3b341', // amber CRT
  '#f78166', // oscilloscope red-pink
  '#00d4ff', // electric cyan
  '#9f7aea', // violet
  '#f472b6', // rose
  '#2dd4bf', // teal
  '#a3e635', // lime
  '#fb923c', // orange
  '#6ba68a', // sage green
]

// ── Tiny primitives ───────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.1em',
      textTransform: 'uppercase' as const,
      color: 'var(--color-text-muted)',
      marginBottom: 10,
      marginTop: 22,
      paddingBottom: 6,
      borderBottom: '1px solid var(--color-border)',
    }}>
      {children}
    </div>
  )
}

function SettingRow({
  label,
  hint,
  children,
  alignTop,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  alignTop?: boolean
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: alignTop ? 'flex-start' : 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '9px 0',
      borderBottom: '1px solid color-mix(in srgb, var(--color-border) 60%, transparent)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>{label}</div>
        {hint && (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{hint}</div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      aria-pressed={value}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: value ? 'var(--color-accent)' : 'var(--color-border)',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 200ms ease',
        flexShrink: 0,
        outline: 'none',
      }}
    >
      <span style={{
        position: 'absolute',
        top: 2,
        left: value ? 18 : 2,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: '#ffffff',
        transition: 'left 200ms ease',
        display: 'block',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  small,
}: {
  options: { label: string; value: T }[]
  value: T
  onChange: (v: T) => void
  small?: boolean
}) {
  return (
    <div style={{
      display: 'flex',
      background: 'var(--color-surface-raised)',
      borderRadius: 6,
      padding: 2,
      gap: 1,
    }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: small ? '3px 8px' : '4px 10px',
            borderRadius: 4,
            border: 'none',
            borderBottom: value === opt.value
              ? '2px solid var(--color-accent)'
              : '2px solid transparent',
            background: value === opt.value ? 'var(--color-surface)' : 'transparent',
            color: value === opt.value ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            fontSize: small ? 10 : 11,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 150ms ease, color 150ms ease',
            whiteSpace: 'nowrap' as const,
            outline: 'none',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function PSSlider({
  min, max, step = 1, value, onChange, unit = '', width = 110,
}: {
  min: number; max: number; step?: number; value: number
  onChange: (v: number) => void; unit?: string; width?: number
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="ps-slider"
        style={{ '--pct': `${pct}%`, width } as React.CSSProperties}
      />
      <span style={{
        fontSize: 11,
        color: 'var(--color-text-muted)',
        minWidth: 38,
        textAlign: 'right' as const,
        fontFamily: 'var(--font-family-mono, monospace)',
        flexShrink: 0,
      }}>
        {value}{unit}
      </span>
    </div>
  )
}

function PSSelect({
  options, value, onChange, width = 140,
}: {
  options: { label: string; value: string }[]
  value: string; onChange: (v: string) => void; width?: number
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--color-border)',
        borderRadius: 4,
        color: 'var(--color-text-primary)',
        fontSize: 12,
        padding: '4px 24px 4px 8px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        outline: 'none',
        width,
        appearance: 'none' as const,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%235a6370'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
      }}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}

// ── Theme color swatch picker ─────────────────────────────────────────────────

function ColorPicker({
  label, varName, value, onChange,
}: {
  label: string; varName: string; value: string
  onChange: (varName: string, val: string) => void
}) {
  const [hex, setHex] = useState(value)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local hex text input from the controlled color value prop
    setHex(value)
  }, [value])

  const commit = (v: string) => {
    if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(varName, v)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
      <span style={{
        fontSize: 9,
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.06em',
        lineHeight: 1,
      }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={{ position: 'relative' as const, flexShrink: 0 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: value,
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
          }} />
          <input
            type="color"
            value={value}
            onChange={e => { setHex(e.target.value); onChange(varName, e.target.value) }}
            style={{
              position: 'absolute' as const,
              opacity: 0,
              width: '100%',
              height: '100%',
              top: 0,
              left: 0,
              cursor: 'pointer',
              padding: 0,
              border: 'none',
            }}
          />
        </label>
        <input
          type="text"
          value={hex}
          maxLength={7}
          onChange={e => setHex(e.target.value)}
          onBlur={() => commit(hex)}
          onKeyDown={e => e.key === 'Enter' && commit(hex)}
          style={{
            width: 64,
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-family-mono, monospace)',
            fontSize: 11,
            outline: 'none',
            padding: '1px 0',
          }}
        />
      </div>
    </div>
  )
}

// ── Mini theme preview card ───────────────────────────────────────────────────

function ThemePreviewCard() {
  return (
    <div style={{
      border: '1px solid var(--color-border)',
      borderRadius: 6,
      overflow: 'hidden',
      background: 'var(--color-bg)',
      marginBottom: 16,
      userSelect: 'none' as const,
    }}>
      <div style={{
        padding: '3px 8px',
        fontSize: 9,
        color: 'var(--color-text-muted)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
        borderBottom: '1px solid var(--color-border)',
        fontFamily: 'var(--font-family-mono, monospace)',
      }}>
        Preview
      </div>
      {/* Mini topbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        height: 26,
        padding: '0 8px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div style={{ width: 30, height: 7, borderRadius: 2, background: 'var(--color-accent)', opacity: 0.9 }} />
        <div style={{ width: 22, height: 7, borderRadius: 2, background: 'var(--color-border)' }} />
        <div style={{ width: 22, height: 7, borderRadius: 2, background: 'var(--color-border)' }} />
        <div style={{ flex: 1 }} />
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }} />
      </div>
      {/* Mini content */}
      <div style={{ display: 'flex', gap: 7, padding: 7 }}>
        {/* Mini sidebar */}
        <div style={{
          width: 28,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 3,
          padding: '5px 4px',
          display: 'flex',
          flexDirection: 'column' as const,
          gap: 3,
        }}>
          {[0.9, 0.5, 0.5, 0.7].map((op, i) => (
            <div key={i} style={{ width: '100%', height: 4, borderRadius: 1, background: `var(--color-accent)`, opacity: op }} />
          ))}
        </div>
        {/* Mini cards */}
        <div style={{ flex: 1, display: 'flex', gap: 5 }}>
          {[1, 2].map(i => (
            <div key={i} style={{
              flex: 1,
              height: 58,
              borderRadius: 3,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              padding: 5,
            }}>
              <div style={{ width: '55%', height: 5, borderRadius: 1, background: 'var(--color-accent)', marginBottom: 5 }} />
              <div style={{ width: '85%', height: 3, borderRadius: 1, background: 'var(--color-border)', marginBottom: 3 }} />
              <div style={{ width: '70%', height: 3, borderRadius: 1, background: 'var(--color-border)', marginBottom: 3 }} />
              <div style={{ width: '80%', height: 3, borderRadius: 1, background: 'var(--color-border)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Ohma Easter egg ───────────────────────────────────────────────────────────

function OhmaOwl() {
  return (
    <span title="Ohma approves 🦉" style={{ display: 'inline-flex', alignItems: 'center' }}>
      <img src={ohmaMascot} alt="Ohma" width={20} height={20} className="ps-owl-wink" style={{ display: 'block' }} />
    </span>
  )
}

// ── Bounce dot (transition speed preview) ────────────────────────────────────

function BounceDot({ speed }: { speed: UISettings['transitionSpeed'] }) {
  const durationMap = { instant: '0.08s', fast: '0.3s', normal: '0.5s', slow: '1s' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: 50, height: 14, overflow: 'hidden', flexShrink: 0 }}>
      <div
        className="ps-bounce-dot"
        style={{ '--bounce-dur': durationMap[speed] } as React.CSSProperties}
      />
    </div>
  )
}

// ── Swatchcard (theme preset) ─────────────────────────────────────────────────

function ThemeCard({
  label, colors, selected, onClick,
}: {
  id: string; label: string; colors: ThemeColors | null
  selected: boolean; onClick: () => void
}) {
  const fallback = THEME_PRESETS['polaris-dark']
  const c = colors ?? fallback
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 5,
        padding: '8px 10px',
        borderRadius: 6,
        background: selected ? 'color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))' : 'var(--color-surface)',
        border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
        cursor: 'pointer',
        outline: 'none',
        transition: 'border-color 150ms ease, background 150ms ease',
        textAlign: 'left' as const,
        width: '100%',
      }}
    >
      {/* Color strip */}
      <div style={{ display: 'flex', gap: 3, height: 16 }}>
        {['--color-bg', '--color-surface', '--color-accent', '--color-text-primary'].map(k => (
          <div key={k} style={{
            flex: 1,
            borderRadius: 2,
            background: c[k] ?? '#111',
            border: '1px solid rgba(255,255,255,0.06)',
          }} />
        ))}
      </div>
      <div style={{
        fontSize: 11,
        color: selected ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        fontWeight: selected ? 600 : 400,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        {selected && <Check size={10} />}
        {label}
      </div>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section: Appearance
// ═══════════════════════════════════════════════════════════════════════════════

function AppearanceSection({
  settings,
  update,
}: {
  settings: UISettings
  update: (p: Partial<UISettings>) => void
}) {
  const [copyTick, setCopyTick] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [customDirty, setCustomDirty] = useState(false)

  const isOhma =
    settings.themeId === 'custom' &&
    settings.customTheme['--color-bg'] === '#000000' &&
    settings.customTheme['--color-accent'] === '#94a5ba'

  const handleThemeSelect = (id: UISettings['themeId']) => {
    if (id === 'custom') {
      update({ themeId: 'custom' })
    } else {
      update({ themeId: id, customTheme: { ...THEME_PRESETS[id] } })
    }
  }

  const handleColorChange = (varName: string, val: string) => {
    const next = { ...settings.customTheme, [varName]: val }
    update({ themeId: 'custom', customTheme: next })
    setCustomDirty(true)
  }

  const handleRandomAccent = () => {
    const current = settings.themeId === 'custom'
      ? settings.customTheme['--color-accent']
      : THEME_PRESETS[settings.themeId]?.['--color-accent']
    const others = ACCENT_PALETTE.filter(c => c !== current)
    const pick = others[Math.floor(Math.random() * others.length)]
    const base = settings.themeId === 'custom'
      ? settings.customTheme
      : { ...THEME_PRESETS[settings.themeId] }
    update({ themeId: 'custom', customTheme: { ...base, '--color-accent': pick } })
    setCustomDirty(true)
  }

  const handleCopyJSON = () => {
    const theme = settings.themeId === 'custom'
      ? settings.customTheme
      : THEME_PRESETS[settings.themeId]
    navigator.clipboard.writeText(JSON.stringify(theme, null, 2)).catch(() => {})
    setCopyTick(true)
    setCustomDirty(false)
    setTimeout(() => setCopyTick(false), 1800)
  }

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText)
      update({ themeId: 'custom', customTheme: parsed })
      setImportOpen(false)
      setImportText('')
      setCustomDirty(false)
    } catch {
      alert('Invalid JSON — check your theme object.')
    }
  }

  const COLOR_FIELDS: [string, string][] = [
    ['--color-bg', 'Background'],
    ['--color-surface', 'Surface'],
    ['--color-surface-raised', 'Surface Raised'],
    ['--color-border', 'Border'],
    ['--color-accent', 'Accent'],
    ['--color-accent-hover', 'Accent Hover'],
    ['--color-text-primary', 'Text Primary'],
    ['--color-text-secondary', 'Text Secondary'],
    ['--color-text-muted', 'Text Muted'],
    ['--color-danger', 'Danger'],
    ['--color-warning', 'Warning'],
    ['--color-success', 'Success'],
  ]

  const activeTheme =
    settings.themeId === 'custom'
      ? settings.customTheme
      : THEME_PRESETS[settings.themeId]

  return (
    <div>
      <ThemePreviewCard />

      <SectionHeader>Theme Presets</SectionHeader>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 4 }}>
        <ThemeCard
          id="polaris-dark"
          label="Polaris Dark"
          colors={THEME_PRESETS['polaris-dark']}
          selected={settings.themeId === 'polaris-dark'}
          onClick={() => handleThemeSelect('polaris-dark')}
        />
        <ThemeCard
          id="polaris-light"
          label="Polaris Light"
          colors={THEME_PRESETS['polaris-light']}
          selected={settings.themeId === 'polaris-light'}
          onClick={() => handleThemeSelect('polaris-light')}
        />
        <ThemeCard
          id="midnight-steel"
          label="Midnight Steel"
          colors={THEME_PRESETS['midnight-steel']}
          selected={settings.themeId === 'midnight-steel'}
          onClick={() => handleThemeSelect('midnight-steel')}
        />
        <ThemeCard
          id="custom"
          label="Custom"
          colors={settings.customTheme}
          selected={settings.themeId === 'custom'}
          onClick={() => handleThemeSelect('custom')}
        />
      </div>

      {/* Custom theme builder */}
      {settings.themeId === 'custom' && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              color: 'var(--color-text-muted)',
            }}>
              Custom Theme Builder
            </div>
            {customDirty && (
              <span style={{
                fontSize: 10,
                color: 'var(--color-warning)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-warning)', display: 'inline-block' }} />
                unsaved
              </span>
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 14,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            padding: 14,
            marginBottom: 12,
          }}>
            {COLOR_FIELDS.map(([varName, label]) => (
              <ColorPicker
                key={varName}
                label={label}
                varName={varName}
                value={activeTheme[varName] ?? '#888888'}
                onChange={handleColorChange}
              />
            ))}
          </div>

          {/* Randomize accent */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Accent</span>
            <button
              onClick={handleRandomAccent}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 4,
                background: 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'border-color 150ms ease, color 150ms ease',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--color-accent)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)'
              }}
            >
              <Shuffle size={11} />
              Randomize Accent
            </button>
          </div>

          {/* Export / Import / Reset */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
            <button
              onClick={handleCopyJSON}
              className="ps-ghost-btn"
            >
              {copyTick ? <Check size={11} /> : <Download size={11} />}
              {copyTick ? 'Copied!' : 'Copy Theme JSON'}
            </button>
            <button
              onClick={() => setImportOpen(v => !v)}
              className="ps-ghost-btn"
            >
              <Upload size={11} />
              Import JSON
            </button>
            <button
              onClick={() => {
                update({ themeId: 'polaris-dark', customTheme: { ...THEME_PRESETS['polaris-dark'] } })
                setCustomDirty(false)
              }}
              className="ps-ghost-btn ps-ghost-btn--danger"
            >
              <RotateCcw size={11} />
              Reset to Polaris Dark
            </button>
          </div>

          {importOpen && (
            <div style={{
              marginTop: 10,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: 10,
            }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Paste theme JSON:
              </div>
              <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                rows={5}
                placeholder='{"--color-bg": "#111314", ...}'
                style={{
                  width: '100%',
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-family-mono, monospace)',
                  fontSize: 11,
                  padding: 8,
                  resize: 'vertical' as const,
                  outline: 'none',
                  boxSizing: 'border-box' as const,
                }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={handleImport} className="ps-ghost-btn ps-ghost-btn--accent">Apply</button>
                <button onClick={() => { setImportOpen(false); setImportText('') }} className="ps-ghost-btn">Cancel</button>
              </div>
            </div>
          )}

          {isOhma && (
            <div style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 11,
              color: 'var(--color-text-muted)',
              padding: '6px 8px',
              background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)',
              borderRadius: 4,
            }}>
              <OhmaOwl />
              Ohma likes it here.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section: Typography
// ═══════════════════════════════════════════════════════════════════════════════

function TypographySection({
  settings,
  update,
}: {
  settings: UISettings
  update: (p: Partial<UISettings>) => void
}) {
  const previewFont = FONT_FAMILIES[settings.fontFamily] ?? 'inherit'
  return (
    <div>
      <SectionHeader>Type Scale</SectionHeader>

      <SettingRow label="Base font size" hint="Scales all UI text">
        <PSSlider
          min={12} max={18} step={1}
          value={settings.fontSize}
          onChange={v => update({ fontSize: v })}
          unit="px"
        />
      </SettingRow>

      <SettingRow label="Font family (UI)">
        <PSSelect
          value={settings.fontFamily}
          onChange={v => update({ fontFamily: v })}
          options={Object.keys(FONT_FAMILIES).map(f => ({ label: f, value: f }))}
        />
      </SettingRow>

      <SettingRow label="Line height">
        <PSSelect
          value={settings.lineHeight}
          onChange={v => update({ lineHeight: v })}
          width={160}
          options={[
            { label: 'Compact (1.3)', value: '1.3' },
            { label: 'Normal (1.5)', value: '1.5' },
            { label: 'Relaxed (1.7)', value: '1.7' },
          ]}
        />
      </SettingRow>

      <SettingRow label="Letter spacing">
        <PSSlider
          min={-5} max={10} step={1}
          value={Math.round(settings.letterSpacing * 100)}
          onChange={v => update({ letterSpacing: v / 100 })}
          unit="×10⁻²em"
          width={100}
        />
      </SettingRow>

      <SectionHeader>Code & Mono</SectionHeader>

      <SettingRow label="Monospace font">
        <PSSelect
          value={settings.monoFont}
          onChange={v => update({ monoFont: v })}
          options={Object.keys(MONO_FONTS).map(f => ({ label: f, value: f }))}
        />
      </SettingRow>

      {/* Live preview */}
      <div style={{
        marginTop: 16,
        padding: '10px 12px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 6,
      }}>
        <div style={{
          fontSize: 9,
          color: 'var(--color-text-muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase' as const,
          marginBottom: 8,
        }}>
          Live Preview
        </div>
        <div style={{
          fontFamily: previewFont,
          fontSize: settings.fontSize,
          lineHeight: settings.lineHeight,
          letterSpacing: `${settings.letterSpacing}em`,
          color: 'var(--color-text-primary)',
        }}>
          R₂ = 4.7kΩ — tolerance ±1%
        </div>
        <div style={{
          fontFamily: FONT_FAMILIES['DM Sans'],
          fontSize: settings.fontSize - 1,
          color: 'var(--color-text-secondary)',
          marginTop: 3,
        }}>
          Vcc = 3.3 V  |  I<sub>max</sub> = 200 mA
        </div>
        <div style={{
          fontFamily: `var(--font-family-mono, 'JetBrains Mono', monospace)`,
          fontSize: settings.fontSize - 2,
          color: 'var(--color-accent)',
          marginTop: 5,
        }}>
          {'const tolerance = 0.01; // ±1%'}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section: Layout
// ═══════════════════════════════════════════════════════════════════════════════

function LayoutSection({
  settings,
  update,
}: {
  settings: UISettings
  update: (p: Partial<UISettings>) => void
}) {
  return (
    <div>
      <SectionHeader>Density & Structure</SectionHeader>

      <SettingRow label="Panel density">
        <Segmented
          value={settings.density}
          onChange={v => update({ density: v })}
          options={[
            { label: 'Compact', value: 'compact' },
            { label: 'Normal', value: 'normal' },
            { label: 'Spacious', value: 'spacious' },
          ]}
        />
      </SettingRow>

      <SettingRow label="Topbar height">
        <Segmented
          value={String(settings.topbarHeight) as '40' | '48'}
          onChange={v => update({ topbarHeight: Number(v) as 40 | 48 })}
          options={[
            { label: 'Slim (40px)', value: '40' },
            { label: 'Normal (48px)', value: '48' },
          ]}
        />
      </SettingRow>

      <SectionHeader>Sidebar & Grid</SectionHeader>

      <SettingRow label="Sidebar default width">
        <PSSlider
          min={220} max={420} step={10}
          value={settings.sidebarWidth}
          onChange={v => update({ sidebarWidth: v })}
          unit="px"
          width={100}
        />
      </SettingRow>

      <SettingRow label="Module grid columns">
        <PSSlider
          min={1} max={4} step={1}
          value={settings.gridColumns}
          onChange={v => update({ gridColumns: v })}
          width={80}
        />
      </SettingRow>

      <SettingRow label="Show module labels">
        <Toggle value={settings.showLabels} onChange={v => update({ showLabels: v })} />
      </SettingRow>

      <SettingRow label="Resizable panel snap">
        <Toggle value={settings.snapPanels} onChange={v => update({ snapPanels: v })} />
      </SettingRow>

      <SectionHeader>Focus</SectionHeader>

      <SettingRow label="Focus mode dimming" hint="Opacity of non-focused panels">
        <PSSlider
          min={0} max={80} step={5}
          value={settings.focusDimming}
          onChange={v => update({ focusDimming: v })}
          unit="%"
          width={90}
        />
      </SettingRow>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section: Behavior
// ═══════════════════════════════════════════════════════════════════════════════

function BehaviorSection({
  settings,
  update,
}: {
  settings: UISettings
  update: (p: Partial<UISettings>) => void
}) {
  return (
    <div>
      <SectionHeader>Animation</SectionHeader>

      <SettingRow label="UI animations">
        <Toggle value={settings.animations} onChange={v => update({ animations: v })} />
      </SettingRow>

      <SettingRow label="Reduced motion" hint="Override OS preference">
        <Segmented
          value={settings.reducedMotion}
          onChange={v => update({ reducedMotion: v })}
          small
          options={[
            { label: 'Auto', value: 'auto' },
            { label: 'On', value: 'on' },
            { label: 'Off', value: 'off' },
          ]}
        />
      </SettingRow>

      <SettingRow label="Transition speed" alignTop>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, alignItems: 'flex-end' }}>
          <Segmented
            value={settings.transitionSpeed}
            onChange={v => update({ transitionSpeed: v })}
            small
            options={[
              { label: 'Instant', value: 'instant' },
              { label: 'Fast', value: 'fast' },
              { label: 'Normal', value: 'normal' },
              { label: 'Slow', value: 'slow' },
            ]}
          />
          <BounceDot speed={settings.transitionSpeed} />
        </div>
      </SettingRow>

      <SectionHeader>Interaction</SectionHeader>

      <SettingRow label="Hover previews">
        <Toggle value={settings.hoverPreviews} onChange={v => update({ hoverPreviews: v })} />
      </SettingRow>

      <SettingRow label="Confirm before close">
        <Toggle value={settings.confirmClose} onChange={v => update({ confirmClose: v })} />
      </SettingRow>

      <SettingRow label="Auto-save interval">
        <PSSlider
          min={10} max={300} step={10}
          value={settings.autoSaveInterval}
          onChange={v => update({ autoSaveInterval: v })}
          unit={settings.autoSaveInterval < 60 ? 's' : 'm'}
          width={90}
        />
      </SettingRow>

      <SectionHeader>Sound</SectionHeader>

      <SettingRow label="Notification sounds">
        <Toggle value={settings.sounds} onChange={v => update({ sounds: v })} />
      </SettingRow>

      <SettingRow label="Click sounds (micro-interactions)">
        <Toggle value={settings.clickSounds} onChange={v => update({ clickSounds: v })} />
      </SettingRow>

      <SectionHeader>Jarvis</SectionHeader>

      <SettingRow label="Jarvis wake-word hint overlay" hint="Shows wake-word reminder in canvas">
        <Toggle value={settings.jarvisHint} onChange={v => update({ jarvisHint: v })} />
      </SettingRow>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section: Accessibility
// ═══════════════════════════════════════════════════════════════════════════════

function AccessibilitySection({
  settings,
  update,
}: {
  settings: UISettings
  update: (p: Partial<UISettings>) => void
}) {
  return (
    <div>
      <SectionHeader>Contrast & Color</SectionHeader>

      <SettingRow label="High contrast mode" hint="Boosts border and text contrast">
        <Toggle value={settings.highContrast} onChange={v => update({ highContrast: v })} />
      </SettingRow>

      <SettingRow label="Color blind assist">
        <PSSelect
          value={settings.colorBlind}
          onChange={v => update({ colorBlind: v as UISettings['colorBlind'] })}
          options={[
            { label: 'None', value: 'none' },
            { label: 'Protanopia', value: 'protanopia' },
            { label: 'Deuteranopia', value: 'deuteranopia' },
            { label: 'Tritanopia', value: 'tritanopia' },
          ]}
        />
      </SettingRow>

      <SectionHeader>Focus & Navigation</SectionHeader>

      <SettingRow label="Focus ring style">
        <PSSelect
          value={settings.focusRing}
          onChange={v => update({ focusRing: v as UISettings['focusRing'] })}
          options={[
            { label: 'Subtle', value: 'subtle' },
            { label: 'Bold', value: 'bold' },
            { label: 'High Vis', value: 'high-vis' },
          ]}
          width={120}
        />
      </SettingRow>

      <SettingRow label="Keyboard shortcut hints" hint="Show hotkey badges in UI">
        <Toggle value={settings.keyboardHints} onChange={v => update({ keyboardHints: v })} />
      </SettingRow>

      <SectionHeader>Text & Cursor</SectionHeader>

      <SettingRow label="Dyslexia-friendly font" hint="Switches to OpenDyslexic">
        <Toggle value={settings.dyslexiaFont} onChange={v => update({ dyslexiaFont: v })} />
      </SettingRow>

      <SettingRow label="Cursor size">
        <Segmented
          value={settings.cursorSize}
          onChange={v => update({ cursorSize: v })}
          options={[
            { label: 'Default', value: 'default' },
            { label: 'Large', value: 'large' },
            { label: 'X-Large', value: 'xl' },
          ]}
        />
      </SettingRow>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Panel
// ═══════════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'appearance', label: 'Appearance', Icon: Palette },
  { id: 'typography', label: 'Type', Icon: Type },
  { id: 'layout', label: 'Layout', Icon: LayoutGrid },
  { id: 'behavior', label: 'Behavior', Icon: Zap },
  { id: 'accessibility', label: 'Access.', Icon: Eye },
  { id: 'storage', label: 'Storage', Icon: HardDrive },
] as const

type TabId = typeof TABS[number]['id']

export function UISettingsPanel({ onClose }: { onClose: () => void }) {
  const [settings, update, reset] = useUISettings()
  const [activeTab, setActiveTab] = useState<TabId>('appearance')
  const [importSettingsOpen, setImportSettingsOpen] = useState(false)
  const [importSettingsText, setImportSettingsText] = useState('')
  const [visible, setVisible] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Slide-in animation
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 220)
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'enginguity-ui-settings.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportSettings = () => {
    try {
      const parsed = JSON.parse(importSettingsText)
      const merged = { ...DEFAULT_SETTINGS, ...parsed }
      Object.keys(parsed).forEach(k => {
        if (!(k in DEFAULT_SETTINGS)) delete merged[k]
      })
      reset()
      update(merged)
      setImportSettingsOpen(false)
      setImportSettingsText('')
    } catch {
      alert('Invalid settings JSON.')
    }
  }

  // Scroll section into view on tab change
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeTab])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          background: 'rgba(0,0,0,0.45)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 220ms ease',
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column' as const,
          background: 'var(--color-bg)',
          borderLeft: '1px solid var(--color-border)',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 220ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
          // Mobile full-width
          maxWidth: '100vw',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          height: 48,
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
          background: 'var(--color-surface)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'var(--font-family-mono, monospace)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            letterSpacing: '0.02em',
          }}>
            <span style={{ color: 'var(--color-accent)' }}>⚙</span>
            UI Settings
          </div>
          <button
            onClick={handleClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 4,
              background: 'transparent',
              border: '1px solid transparent',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              outline: 'none',
              transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLElement).style.background = 'var(--color-surface-raised)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'transparent'
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body: tabs + content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left tab strip */}
          <div style={{
            width: 88,
            borderRight: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            display: 'flex',
            flexDirection: 'column' as const,
            padding: '8px 6px',
            gap: 2,
            flexShrink: 0,
          }}>
            {TABS.map(({ id, label, Icon }) => {
              const active = activeTab === id
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  title={label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column' as const,
                    alignItems: 'center',
                    gap: 4,
                    padding: '9px 4px',
                    borderRadius: 5,
                    border: 'none',
                    background: active
                      ? 'color-mix(in srgb, var(--color-accent) 12%, var(--color-bg))'
                      : 'transparent',
                    borderLeft: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                    color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 10,
                    fontWeight: active ? 600 : 400,
                    lineHeight: 1.2,
                    textAlign: 'center' as const,
                    outline: 'none',
                    transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
                    width: '100%',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      ;(e.currentTarget as HTMLElement).style.background = 'var(--color-surface-raised)'
                      ;(e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                      ;(e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'
                    }
                  }}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </button>
              )
            })}
          </div>

          {/* Section content */}
          <div
            ref={contentRef}
            style={{
              flex: 1,
              overflowY: 'auto' as const,
              padding: '4px 18px 20px',
            }}
          >
            {activeTab === 'appearance' && (
              <AppearanceSection settings={settings} update={update} />
            )}
            {activeTab === 'typography' && (
              <TypographySection settings={settings} update={update} />
            )}
            {activeTab === 'layout' && (
              <LayoutSection settings={settings} update={update} />
            )}
            {activeTab === 'behavior' && (
              <BehaviorSection settings={settings} update={update} />
            )}
            {activeTab === 'accessibility' && (
              <AccessibilitySection settings={settings} update={update} />
            )}
            {activeTab === 'storage' && (
              <StoragePanel />
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid var(--color-border)',
          padding: '10px 14px',
          background: 'var(--color-surface)',
          flexShrink: 0,
        }}>
          {importSettingsOpen && (
            <div style={{
              marginBottom: 10,
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: 10,
            }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Paste settings JSON:
              </div>
              <textarea
                value={importSettingsText}
                onChange={e => setImportSettingsText(e.target.value)}
                rows={4}
                placeholder='{"themeId": "polaris-dark", ...}'
                style={{
                  width: '100%',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-family-mono, monospace)',
                  fontSize: 11,
                  padding: 8,
                  resize: 'vertical' as const,
                  outline: 'none',
                  boxSizing: 'border-box' as const,
                }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={handleImportSettings} className="ps-ghost-btn ps-ghost-btn--accent">
                  Apply
                </button>
                <button onClick={() => { setImportSettingsOpen(false); setImportSettingsText('') }} className="ps-ghost-btn">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => { if (window.confirm('Reset all UI settings to defaults?')) reset() }}
              className="ps-ghost-btn ps-ghost-btn--danger"
            >
              <RotateCcw size={11} />
              Reset All
            </button>
            <button onClick={handleExport} className="ps-ghost-btn">
              <Download size={11} />
              Export
            </button>
            <button onClick={() => setImportSettingsOpen(v => !v)} className="ps-ghost-btn">
              <Upload size={11} />
              Import
            </button>

            <div style={{ flex: 1 }} />

            {/* Ohma footer easter egg */}
            {settings.themeId === 'custom' &&
              settings.customTheme['--color-bg'] === '#000000' &&
              settings.customTheme['--color-accent'] === '#94a5ba' && (
                <OhmaOwl />
              )}

            <span style={{
              fontSize: 10,
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-family-mono, monospace)',
              opacity: 0.6,
            }}>
              Polaris v1
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
