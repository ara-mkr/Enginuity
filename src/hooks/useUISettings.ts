import { useState, useEffect, useCallback } from 'react'

// Electron preload bridge, not present in a browser environment.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElectronAny = any

export interface UISettings {
  themeId: 'polaris-dark' | 'polaris-light' | 'midnight-steel' | 'custom'
  customTheme: Record<string, string>
  fontSize: number
  fontFamily: string
  lineHeight: string
  letterSpacing: number
  monoFont: string
  density: 'compact' | 'normal' | 'spacious'
  sidebarWidth: number
  topbarHeight: 40 | 48
  snapPanels: boolean
  gridColumns: number
  showLabels: boolean
  focusDimming: number
  animations: boolean
  reducedMotion: 'auto' | 'on' | 'off'
  transitionSpeed: 'instant' | 'fast' | 'normal' | 'slow'
  hoverPreviews: boolean
  confirmClose: boolean
  autoSaveInterval: number
  sounds: boolean
  clickSounds: boolean
  jarvisHint: boolean
  highContrast: boolean
  focusRing: 'subtle' | 'bold' | 'high-vis'
  cursorSize: 'default' | 'large' | 'xl'
  dyslexiaFont: boolean
  colorBlind: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia'
  keyboardHints: boolean
}

export type ThemeColors = Record<string, string>

export const THEME_PRESETS: Record<string, ThemeColors> = {
  'polaris-dark': {
    '--color-bg': '#111314',
    '--color-surface': '#1a1d1f',
    '--color-surface-raised': '#222527',
    '--color-border': '#2a2d30',
    '--color-accent': '#94a5ba',
    '--color-accent-hover': '#b0c4d8',
    '--color-text-primary': '#e4e8ec',
    '--color-text-secondary': '#9ba8b5',
    '--color-text-muted': '#5a6370',
    '--color-danger': '#e05a5a',
    '--color-warning': '#d4933d',
    '--color-success': '#4caf7d',
  },
  'polaris-light': {
    '--color-bg': '#f0f2f4',
    '--color-surface': '#ffffff',
    '--color-surface-raised': '#e8ebee',
    '--color-border': '#d0d5dc',
    '--color-accent': '#4a6278',
    '--color-accent-hover': '#385068',
    '--color-text-primary': '#1a1d1f',
    '--color-text-secondary': '#4a5568',
    '--color-text-muted': '#8a9ab0',
    '--color-danger': '#c53030',
    '--color-warning': '#b7791f',
    '--color-success': '#2f855a',
  },
  'midnight-steel': {
    '--color-bg': '#0d1117',
    '--color-surface': '#161b22',
    '--color-surface-raised': '#1c2230',
    '--color-border': '#30363d',
    '--color-accent': '#58a6ff',
    '--color-accent-hover': '#79b8ff',
    '--color-text-primary': '#c9d1d9',
    '--color-text-secondary': '#8b949e',
    '--color-text-muted': '#484f58',
    '--color-danger': '#f85149',
    '--color-warning': '#e3b341',
    '--color-success': '#3fb950',
  },
}

const TRANSITION_SPEEDS: Record<string, string> = {
  instant: '0ms',
  fast: '100ms',
  normal: '200ms',
  slow: '400ms',
}

export const FONT_FAMILIES: Record<string, string> = {
  'Geist': "'Geist', 'DM Sans Variable', 'DM Sans', system-ui, sans-serif",
  'DM Sans': "'DM Sans Variable', 'DM Sans', system-ui, sans-serif",
  'Inter': "'Inter', system-ui, sans-serif",
  'System UI': 'system-ui, sans-serif',
}

export const MONO_FONTS: Record<string, string> = {
  'Geist Mono': "'Geist Mono', 'JetBrains Mono', monospace",
  'JetBrains Mono': "'JetBrains Mono', monospace",
  'Fira Code': "'Fira Code', monospace",
  'System Mono': 'monospace',
}

export const DEFAULT_SETTINGS: UISettings = {
  themeId: 'polaris-dark',
  customTheme: { ...THEME_PRESETS['polaris-dark'] },
  fontSize: 14,
  fontFamily: 'DM Sans',
  lineHeight: '1.5',
  letterSpacing: 0,
  monoFont: 'JetBrains Mono',
  density: 'normal',
  sidebarWidth: 280,
  topbarHeight: 48,
  snapPanels: true,
  gridColumns: 2,
  showLabels: true,
  focusDimming: 60,
  animations: true,
  reducedMotion: 'auto',
  transitionSpeed: 'normal',
  hoverPreviews: true,
  confirmClose: true,
  autoSaveInterval: 30,
  sounds: false,
  clickSounds: false,
  jarvisHint: true,
  highContrast: false,
  focusRing: 'subtle',
  cursorSize: 'default',
  dyslexiaFont: false,
  colorBlind: 'none',
  keyboardHints: true,
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex || hex.length < 7) return `rgba(148,163,184,${alpha})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function lightenHex(hex: string, amount = 24): string {
  if (!hex || hex.length < 7) return hex
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount)
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount)
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

const COLOR_BLIND_MATRICES: Record<string, string> = {
  protanopia: `
    <feColorMatrix type="matrix" values="
      0.567 0.433 0     0 0
      0.558 0.442 0     0 0
      0     0.242 0.758 0 0
      0     0     0     1 0"/>`,
  deuteranopia: `
    <feColorMatrix type="matrix" values="
      0.625 0.375 0   0 0
      0.7   0.3   0   0 0
      0     0.3   0.7 0 0
      0     0     0   1 0"/>`,
  tritanopia: `
    <feColorMatrix type="matrix" values="
      0.95  0.05  0     0 0
      0     0.433 0.567 0 0
      0     0.475 0.525 0 0
      0     0     0     1 0"/>`,
}

function applyColorBlind(mode: UISettings['colorBlind']) {
  let svgEl = document.getElementById('ps-cbfilter-svg')
  if (mode === 'none') {
    document.body.style.filter = ''
    svgEl?.remove()
    return
  }
  if (!svgEl) {
    svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as HTMLElement
    svgEl.id = 'ps-cbfilter-svg'
    Object.assign((svgEl as HTMLElement).style, { position: 'absolute', width: 0, height: 0, overflow: 'hidden' })
    document.body.prepend(svgEl)
  }
  svgEl.innerHTML = `<defs><filter id="ps-cbfilter">${COLOR_BLIND_MATRICES[mode]}</filter></defs>`
  document.body.style.filter = 'url(#ps-cbfilter)'
}

export function applyToCSSRoot(settings: UISettings) {
  const root = document.documentElement
  const theme =
    settings.themeId === 'custom'
      ? settings.customTheme
      : (THEME_PRESETS[settings.themeId] ?? THEME_PRESETS['polaris-dark'])

  // New Polaris vars
  for (const [key, val] of Object.entries(theme)) {
    root.style.setProperty(key, val as string)
  }

  // Legacy var bridge — existing app components pick up theme changes
  root.style.setProperty('--bg', theme['--color-bg'] ?? '#111314')
  root.style.setProperty('--bg-2', theme['--color-surface'] ?? '#1a1d1f')
  root.style.setProperty('--surface', theme['--color-surface'] ?? '#1a1d1f')
  root.style.setProperty('--surface-2', theme['--color-surface-raised'] ?? '#222527')
  root.style.setProperty('--border', theme['--color-border'] ?? '#2a2d30')
  root.style.setProperty('--border-bright', lightenHex(theme['--color-border'] ?? '#2a2d30'))
  root.style.setProperty('--accent', theme['--color-accent'] ?? '#94a5ba')
  root.style.setProperty('--accent-2', theme['--color-accent-hover'] ?? '#b0c4d8')
  root.style.setProperty('--accent-glow', hexToRgba(theme['--color-accent'] ?? '#94a5ba', 0.12))
  root.style.setProperty('--text', theme['--color-text-primary'] ?? '#e4e8ec')
  root.style.setProperty('--text-muted', theme['--color-text-secondary'] ?? '#9ba8b5')
  root.style.setProperty('--text-dim', theme['--color-text-muted'] ?? '#5a6370')

  // Typography
  root.style.setProperty('--font-size-base', `${settings.fontSize}px`)
  root.style.setProperty('--font-family-ui', FONT_FAMILIES[settings.fontFamily] ?? FONT_FAMILIES['DM Sans'])
  root.style.setProperty('--font-family-mono', MONO_FONTS[settings.monoFont] ?? MONO_FONTS['JetBrains Mono'])
  root.style.setProperty('--line-height-ui', settings.lineHeight)
  root.style.setProperty('--letter-spacing-ui', `${settings.letterSpacing}em`)

  // Transitions
  root.style.setProperty('--transition-speed', TRANSITION_SPEEDS[settings.transitionSpeed] ?? '200ms')

  // Layout
  root.style.setProperty('--panel-density', settings.density)
  root.style.setProperty('--topbar-height', `${settings.topbarHeight}px`)
  root.style.setProperty('--sidebar-width', `${settings.sidebarWidth}px`)

  // Body-level typography
  document.body.style.fontSize = `${settings.fontSize}px`
  document.body.style.fontFamily = FONT_FAMILIES[settings.fontFamily] ?? FONT_FAMILIES['DM Sans']
  document.body.style.lineHeight = settings.lineHeight

  // Dyslexia font
  if (settings.dyslexiaFont) {
    let link = document.getElementById('ps-dyslexia-font') as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = 'ps-dyslexia-font'
      link.rel = 'stylesheet'
      link.href = 'https://fonts.cdnfonts.com/css/opendyslexic'
      document.head.appendChild(link)
    }
    document.body.style.fontFamily = "'OpenDyslexic', sans-serif"
  }

  // High contrast
  if (settings.highContrast) {
    root.style.setProperty('--color-border', lightenHex(theme['--color-border'] ?? '#2a2d30', 40))
    root.style.setProperty('--border', lightenHex(theme['--color-border'] ?? '#2a2d30', 40))
  }

  // Focus ring
  const ringMap = { subtle: '1px', bold: '2px', 'high-vis': '3px' }
  root.style.setProperty('--focus-ring-width', ringMap[settings.focusRing] ?? '1px')

  // Cursor size
  if (settings.cursorSize === 'large') root.style.setProperty('--cursor-scale', '1.5')
  else if (settings.cursorSize === 'xl') root.style.setProperty('--cursor-scale', '2')
  else root.style.setProperty('--cursor-scale', '1')

  // Color blind simulation
  applyColorBlind(settings.colorBlind)
}

const STORAGE_KEY = 'enginguity:ui-settings'

function loadSettings(): UISettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch { /* corrupted/missing stored value — fall back to default */ }
  return DEFAULT_SETTINGS
}

function saveSettings(s: UISettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch { /* storage unavailable (private mode/quota) — safe to skip */ }
  // Mirror to disk when running as desktop app (fire-and-forget)
  if (typeof window !== 'undefined' && (window as ElectronAny).electronAPI?.isElectron) {
    ;(window as ElectronAny).electronAPI.saveData('ui-settings', s).catch(() => {})
  }
}

export function useUISettings(): [UISettings, (patch: Partial<UISettings>) => void, () => void] {
  const [settings, setSettings] = useState<UISettings>(loadSettings)

  useEffect(() => {
    applyToCSSRoot(settings)
  }, [settings])

  // On Electron, load persisted settings from disk on first mount (may override localStorage)
  useEffect(() => {
    const api = (window as ElectronAny).electronAPI
    if (!api?.isElectron) return
    api.loadData('ui-settings').then((disk: unknown) => {
      if (disk && typeof disk === 'object') {
        const merged = { ...DEFAULT_SETTINGS, ...(disk as Partial<UISettings>) }
        setSettings(merged)
        applyToCSSRoot(merged)
      }
    }).catch(() => {})
  }, [])

  const update = useCallback((patch: Partial<UISettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS)
    setSettings(DEFAULT_SETTINGS)
  }, [])

  return [settings, update, reset]
}
