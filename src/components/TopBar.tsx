import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Store, MessageSquarePlus, Search,
  Clock, Settings, HelpCircle, SlidersHorizontal,
} from 'lucide-react'
import { FileHistory } from './FileHistory/index'
import { AISettings } from './AISettings'
import { ModelPicker } from './ModelPicker'
import { TutorialModal } from './TutorialModal'
import { OpenRouterSetup } from './OpenRouterSetup'
import { useOpenRouter } from '../context/OpenRouterContext'
import { UISettingsPanel } from './UISettingsPanel'
import { useUISettings } from '../hooks/useUISettings'
import { ChatHistoryPopover } from './ChatHistoryPopover'
import { useProbeChat, type ProbeMessage } from '../context/ProbeChatContext'
import { useHomeChat, type HomeMessage } from '../context/HomeChatContext'

function TopBarButton({
  icon: Icon,
  label,
  onClick,
  active,
  accent,
  shortcut,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  label: string
  onClick: () => void
  active?: boolean
  accent?: boolean
  shortcut?: string
}) {
  const [hover, setHover] = useState(false)
  const baseColor = accent ? 'var(--accent)' : 'var(--text-muted)'
  const activeBg = active || hover ? 'var(--surface-2)' : 'transparent'
  const textColor = active || hover ? 'var(--text)' : baseColor
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 30,
        padding: '0 10px',
        borderRadius: 6,
        background: activeBg,
        border: '1px solid ' + (active || hover ? 'var(--border-bright)' : 'transparent'),
        color: textColor,
        cursor: 'pointer',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
      }}
    >
      <Icon size={14} style={{ color: 'currentColor', flexShrink: 0 }} />
      <span>{label}</span>
      {shortcut && (
        <span style={{
          fontSize: 9,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 3,
          padding: '1px 4px',
          fontFamily: 'monospace',
          color: 'var(--text-dim)',
          marginLeft: 2,
        }}>
          {shortcut}
        </span>
      )}
    </button>
  )
}

export function TopBar() {
  const { isConnected, totalRequestsToday } = useOpenRouter()
  const location = useLocation()
  const isHome = location.pathname === '/'

  const probeChat = useProbeChat()
  const homeChat = useHomeChat()
  const { sessions, activeSessionId, startNewSession, switchToSession, deleteSession, renameSession } =
    isHome ? homeChat : probeChat
  const [historyOpen, setHistoryOpen] = useState(false)
  const [aiSettingsOpen, setAISettingsOpen] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [uiSettingsOpen, setUISettingsOpen] = useState(false)
  const [uiSettingsHover, setUISettingsHover] = useState(false)

  // Apply saved settings on mount
  useUISettings()

  // Ctrl+, keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault()
        setUISettingsOpen(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Native menu bar "Settings" item (Electron only)
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Electron preload bridge, not present in a browser environment
    const api = (window as any).electronAPI
    if (!api?.onMenuOpenSettings) return
    const cleanup = api.onMenuOpenSettings(() => setUISettingsOpen(true))
    return cleanup
  }, [])

  const openCommandPalette = () =>
    window.dispatchEvent(new CustomEvent('enginguity_open_command_palette'))

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 44,
          padding: '0 14px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          zIndex: 50,
        }}
      >
        <NavLink to="/marketplace" style={{ textDecoration: 'none' }}>
          {({ isActive }) => (
            <TopBarButton
              icon={Store}
              label="Tool Marketplace"
              onClick={() => {}}
              active={isActive}
              accent
            />
          )}
        </NavLink>

        <TopBarButton icon={MessageSquarePlus} label="New Chat" onClick={startNewSession} />
        <ChatHistoryPopover<HomeMessage | ProbeMessage>
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSwitch={switchToSession}
          onNew={startNewSession}
          onDelete={deleteSession}
          onRename={renameSession}
          label="Chat"
          align="left"
        />

        <button
          onClick={openCommandPalette}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 30,
            padding: '0 10px',
            borderRadius: 6,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            minWidth: 220,
            transition: 'border-color 120ms ease, color 120ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text)'
            e.currentTarget.style.borderColor = 'var(--border-bright)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)'
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          <Search size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ flex: 1, textAlign: 'left' }}>Search commands...</span>
          <span style={{
            fontSize: 9,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            padding: '1px 4px',
            fontFamily: 'monospace',
            color: 'var(--text-dim)',
          }}>⌘K</span>
        </button>

        <div style={{ flex: 1 }} />

        <TopBarButton icon={Clock} label="File History" onClick={() => setHistoryOpen(true)} />

        {/* Quick model switcher — shows the active provider (cloud model or
            local Ollama model with FREE badge) and swaps models in place. */}
        {isConnected && <ModelPicker />}

        {isConnected ? (
          <button
            onClick={() => setAISettingsOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 30,
              padding: '0 10px',
              borderRadius: 6,
              background: 'transparent',
              border: '1px solid var(--border-bright)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 12,
              fontWeight: 600,
              transition: 'background 120ms ease, color 120ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface-2)'
              e.currentTarget.style.color = 'var(--text)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
            title="AI provider & model settings"
          >
            <Settings size={13} />
            <span>AI Settings</span>
            {totalRequestsToday > 0 && (
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: 'var(--text-dim)',
                marginLeft: 2,
              }}>
                {totalRequestsToday}
              </span>
            )}
          </button>
        ) : (
          <TopBarButton icon={Settings} label="Connect AI" onClick={() => setSetupOpen(true)} />
        )}

        <TopBarButton icon={HelpCircle} label="Tutorial" onClick={() => setTutorialOpen(true)} />

        {/* UI Settings gear */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setUISettingsOpen(v => !v)}
            onMouseEnter={() => setUISettingsHover(true)}
            onMouseLeave={() => setUISettingsHover(false)}
            title="UI Settings (Ctrl+,)"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: 6,
              background: uiSettingsOpen ? 'var(--surface-2)' : 'transparent',
              border: `1px solid ${uiSettingsOpen || uiSettingsHover ? 'var(--border-bright)' : 'transparent'}`,
              color: uiSettingsOpen ? 'var(--accent)' : uiSettingsHover ? 'var(--text)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
            }}
          >
            <SlidersHorizontal size={14} />
          </button>
          {/* Tooltip */}
          {uiSettingsHover && !uiSettingsOpen && (
            <div style={{
              position: 'absolute',
              bottom: -32,
              right: 0,
              background: 'var(--surface-2)',
              border: '1px solid var(--border-bright)',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 11,
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}>
              UI Settings
              <span style={{
                fontSize: 9,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 3,
                padding: '1px 4px',
                fontFamily: 'monospace',
                color: 'var(--text-dim)',
              }}>
                Ctrl+,
              </span>
            </div>
          )}
        </div>
      </div>

      {historyOpen && <FileHistory onClose={() => setHistoryOpen(false)} />}
      {aiSettingsOpen && <AISettings onClose={() => setAISettingsOpen(false)} />}
      {tutorialOpen && <TutorialModal onClose={() => setTutorialOpen(false)} />}
      {setupOpen && <OpenRouterSetup onClose={() => setSetupOpen(false)} />}
      {uiSettingsOpen && <UISettingsPanel onClose={() => setUISettingsOpen(false)} />}
    </>
  )
}
