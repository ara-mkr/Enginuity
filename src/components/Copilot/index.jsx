import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronRight, Settings, X, Send, Loader2
} from 'lucide-react'
import { useAIProvider } from '../../hooks/useAIProvider'
import { useProjectContext } from '../../hooks/useProjectContext'
import { useProbeChat } from '../../context/ProbeChatContext'
import { ChatHistoryPopover } from '../ChatHistoryPopover'
import { moduleStateStore } from '../../store/moduleState'
import { initObservationEngine } from './observationEngine'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useFocusMode } from '../../context/FocusModeContext'



// ── Route → display name map ──────────────────────────────────────────────────

const ROUTE_NAMES = {
  '/': 'Home',
  '/dashboard': 'Dashboard',
  '/cad-viewer': 'CAD Viewer',
  '/parameter-playground': 'Parameter Playground',
  '/asset-generator': 'Asset Generator',
  '/simulation-assistant': 'Simulation Assistant',
  '/ideas': 'Project Ideas',
  '/project-ideas': 'Project Ideas',
  '/debug-console': 'Debug Console',
  '/model-comparison': 'Model Compare',
  '/circuit-sim': 'Circuit Sim',
  '/collaborate': 'Collaborate',
  '/datasheet': 'Datasheet Intel',
  '/notebook': 'Engineering Notebook',
  '/bom': 'BOM Intelligence',
  '/formula-lab': 'Formula Lab',
  '/templates': 'Templates',
  '/challenges': 'Challenges',
  '/firmware-diff': 'Firmware Diff',
  '/pcb-reviewer': 'PCB Reviewer',
}

// ── LocalStorage keys ─────────────────────────────────────────────────────────

const LS_OPEN = 'enginguity_copilot_open'
const LS_SETTINGS = 'enginguity_copilot_settings'

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}')
  } catch { return {} }
}

function saveSettings(s) {
  localStorage.setItem(LS_SETTINGS, JSON.stringify(s))
}

// ── Timestamp helper ──────────────────────────────────────────────────────────

function relativeTime(ts) {
  const diff = Date.now() - ts
  if (diff < 10000) return 'just now'
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  return `${Math.floor(diff / 3600000)}h ago`
}

// ── Message components ────────────────────────────────────────────────────────

function ProactiveMessage({ msg, onAction }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: '2px solid var(--border-bright)',
      borderRadius: 6,
      padding: '10px 12px',
      marginRight: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'Geist, sans-serif' }}>
          Probe Bot noticed
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto', fontFamily: 'Geist, sans-serif' }}>
          {relativeTime(msg.timestamp)}
        </span>
      </div>
      <p style={{
        fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5,
        margin: 0, fontFamily: 'Geist, sans-serif'
      }}>
        {msg.text}
      </p>
      {msg.actions?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {msg.actions.map((a, i) => (
            <button
              key={i}
              onClick={() => onAction(a)}
              style={{
                height: 24, padding: '0 8px', fontSize: 11,
                fontFamily: 'Geist, sans-serif',
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer',
                transition: 'color 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function UserMessage({ msg }) {
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      padding: '8px 12px',
      marginLeft: 20,
      fontSize: 13,
      color: 'var(--text)',
      fontFamily: 'Geist, sans-serif',
      lineHeight: 1.5,
      wordBreak: 'break-word'
    }}>
      {msg.text}
    </div>
  )
}

function ProbeBotResponse({ msg }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      padding: '10px 12px',
      marginRight: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'Geist, sans-serif' }}>
          Probe Bot
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto', fontFamily: 'Geist, sans-serif' }}>
          {relativeTime(msg.timestamp)}
        </span>
      </div>
      <p style={{
        fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5,
        margin: 0, fontFamily: 'Geist, sans-serif', whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}>
        {msg.text}
        {msg.streaming && (
          <span style={{
            display: 'inline-block', width: 2, height: '1em',
            background: 'var(--text-muted)', marginLeft: 2,
            verticalAlign: 'text-bottom',
            animation: 'probebot-blink 0.8s step-end infinite'
          }} />
        )}
      </p>
    </div>
  )
}

function SystemMessage({ msg }) {
  return (
    <div style={{
      textAlign: 'center', fontSize: 11, color: 'var(--text-dim)',
      fontFamily: 'Geist, sans-serif', fontStyle: 'italic',
      padding: '4px 0'
    }}>
      {msg.text}
    </div>
  )
}

// ── Settings popover ──────────────────────────────────────────────────────────

function SettingsPopover({ settings, onChange, onClear, onClose }) {
  return (
    <div style={{
      position: 'absolute', top: 52, right: 14, zIndex: 200,
      width: 220, background: 'var(--surface)',
      border: '1px solid var(--border-bright)',
      borderRadius: 8, padding: '12px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      display: 'flex', flexDirection: 'column', gap: 12
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', fontFamily: 'Geist, sans-serif' }}>
          Probe Bot Settings
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0 }} data-tooltip="Close">
          <X size={14} />
        </button>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Geist, sans-serif' }}>
          Proactive observations
        </span>
        <div
          onClick={() => onChange({ ...settings, proactive: !settings.proactive })}
          style={{
            width: 28, height: 16, borderRadius: 8,
            background: settings.proactive ? 'var(--accent)' : 'var(--border-bright)',
            position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0
          }}
        >
          <div style={{
            position: 'absolute', top: 2,
            left: settings.proactive ? 14 : 2,
            width: 12, height: 12, borderRadius: '50%',
            background: 'white', transition: 'left 0.2s'
          }} />
        </div>
      </label>

      <div>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Geist, sans-serif', display: 'block', marginBottom: 6 }}>
          Observation sensitivity
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {['minimal', 'normal', 'detailed'].map(s => (
            <button
              key={s}
              onClick={() => onChange({ ...settings, sensitivity: s })}
              style={{
                flex: 1, height: 24, fontSize: 10, cursor: 'pointer',
                fontFamily: 'Geist, sans-serif',
                border: '1px solid',
                borderColor: settings.sensitivity === s ? 'var(--accent)' : 'var(--border)',
                color: settings.sensitivity === s ? 'var(--accent)' : 'var(--text-dim)',
                background: 'transparent', borderRadius: 4,
                textTransform: 'capitalize', transition: 'all 0.15s'
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Geist, sans-serif' }}>
          Conversation memory
        </span>
        <div
          onClick={() => onChange({ ...settings, memory: !settings.memory })}
          style={{
            width: 28, height: 16, borderRadius: 8,
            background: settings.memory ? 'var(--accent)' : 'var(--border-bright)',
            position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0
          }}
        >
          <div style={{
            position: 'absolute', top: 2,
            left: settings.memory ? 14 : 2,
            width: 12, height: 12, borderRadius: '50%',
            background: 'white', transition: 'left 0.2s'
          }} />
        </div>
      </label>

      <button
        onClick={onClear}
        style={{
          height: 28, fontSize: 11, cursor: 'pointer',
          fontFamily: 'Geist, sans-serif',
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 4, color: 'var(--text-muted)',
          transition: 'color 0.15s'
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        Clear conversation
      </button>
    </div>
  )
}

// ── Main Probe Bot panel ──────────────────────────────────────────────────────

export function Copilot() {
  const location = useLocation()
  const navigate = useNavigate()
  const { makeRequest, isConnected, activeModel } = useAIProvider()
  const { description: projectDescription } = useProjectContext()
  const { rightSidebarRevealed } = useFocusMode()

  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(LS_OPEN) !== 'false' } catch { return true }
  })

  const [settings, setSettings] = useState(() => ({
    proactive: true,
    sensitivity: 'normal',
    memory: true,
    ...loadSettings()
  }))

  // Persisted chat — survives tab switches and reloads.
  const {
    messages, setMessages,
    sessions: probeSessions, activeSessionId: probeActiveId,
    startNewSession: probeNewSession,
    switchToSession: probeSwitchSession,
    deleteSession: probeDeleteSession,
    renameSession: probeRenameSession,
  } = useProbeChat()

  const [inputText, setInputText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  // If we unmounted mid-stream (panel closed, route change), persisted
  // messages may have streaming: true baked in. Clear those flags on mount
  // so the typing cursor doesn't get stuck forever.
  useEffect(() => {
    setMessages((prev) => {
      if (!prev.some((m) => m.streaming)) return prev
      return prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [showSettings, setShowSettings] = useState(false)

  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const settingsRef = useRef(null)
  const streamingMsgIdRef = useRef(null)

  let activeModuleName = ROUTE_NAMES[location.pathname] ||
    ROUTE_NAMES[Object.keys(ROUTE_NAMES).find(k => location.pathname.startsWith(k) && k !== '/') || '/'] ||
    'Dashboard'

  let workspaceActiveId = null
  try {
    const ws = useWorkspace()
    if (ws.layoutMode === 'workspace') {
      if (ws.activeWindowId) {
        const activeWin = ws.windows.find(w => w.id === ws.activeWindowId)
        if (activeWin) {
          activeModuleName = activeWin.title
          workspaceActiveId = activeWin.id
        }
      } else {
        activeModuleName = 'Workspace'
      }
    }
  } catch (err) { /* ignore */ }

  useEffect(() => {
    localStorage.setItem(LS_OPEN, String(open))
    window.dispatchEvent(new CustomEvent('enginguity_copilot_open_changed', { detail: { open } }))
  }, [open])

  useEffect(() => {
    const handler = (e) => {
      if (e.detail && typeof e.detail.open === 'boolean') {
        setOpen(e.detail.open)
      }
    }
    window.addEventListener('enginguity_set_copilot_open', handler)
    return () => window.removeEventListener('enginguity_set_copilot_open', handler)
  }, [])

  useEffect(() => {
    const handler = () => {
      try { probeNewSession() } catch { /* ignore */ }
    }
    window.addEventListener('enginguity_new_chat', handler)
    return () => window.removeEventListener('enginguity_new_chat', handler)
  }, [probeNewSession])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const prevPathRef = useRef(location.pathname)
  const prevActiveWinIdRef = useRef(workspaceActiveId)
  useEffect(() => {
    if (prevPathRef.current !== location.pathname || prevActiveWinIdRef.current !== workspaceActiveId) {
      prevPathRef.current = location.pathname
      prevActiveWinIdRef.current = workspaceActiveId
      addMessage({ type: 'system', text: `Switched to ${activeModuleName}` })
    }
  }, [location.pathname, workspaceActiveId, activeModuleName])

  useEffect(() => {
    if (!showSettings) return
    const handler = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setShowSettings(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSettings])

  useEffect(() => {
    const unsub = initObservationEngine(
      (proactiveMsg) => {
        if (!open) return
        addMessage({ type: 'proactive', ...proactiveMsg })
      },
      () => settings
    )
    return unsub
  }, [open, settings])

  const addMessage = useCallback((msg) => {
    setMessages(prev => [...prev, { id: `msg-${Date.now()}-${Math.random()}`, timestamp: Date.now(), ...msg }])
  }, [])

  const handleSend = useCallback(async () => {
    const text = inputText.trim()
    if (!text || isStreaming) return
    setInputText('')

    addMessage({ type: 'user', text })

    if (!isConnected) {
      addMessage({ type: 'system', text: 'Connect an API key to chat with Probe Bot' })
      return
    }

    const moduleState = moduleStateStore.getState()

    const systemPrompt = `You are Probe Bot, an engineering assistant embedded in ENGINGUITY, an engineering workspace. You have context about what the user is currently working on.

Current module: ${activeModuleName}
Current module state: ${JSON.stringify(moduleState.moduleData[moduleState.activeModule] || {}, null, 2)}
Project context: ${projectDescription || 'Not set'}
Active model: ${activeModel}

Be direct and specific. Answer engineering questions with numbers and references where possible. If you don't know something, say so. Keep responses under 150 words unless the question requires more. Never use bullet points for responses under 3 items — use prose.`

    const conversationHistory = settings.memory
      ? messages
          .filter(m => m.type === 'user' || m.type === 'copilot')
          .slice(-10)
          .map(m => ({ role: m.type === 'user' ? 'user' : 'assistant', content: m.text }))
      : []

    const streamId = `stream-${Date.now()}`
    streamingMsgIdRef.current = streamId
    setMessages(prev => [...prev, {
      id: streamId, type: 'copilot', text: '', streaming: true, timestamp: Date.now()
    }])
    setIsStreaming(true)

    try {
      await makeRequest(
        [...conversationHistory, { role: 'user', content: text }],
        systemPrompt,
        {
          maxTokens: 600,
          onToken: (_token, full) => {
            setMessages(prev => prev.map(m =>
              m.id === streamId ? { ...m, text: full } : m
            ))
          }
        }
      )
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === streamId
          ? { ...m, text: `Error: ${err.message}`, streaming: false }
          : m
      ))
    } finally {
      setMessages(prev => prev.map(m =>
        m.id === streamId ? { ...m, streaming: false } : m
      ))
      setIsStreaming(false)
    }
  }, [inputText, isStreaming, isConnected, activeModuleName, activeModel, projectDescription, messages, settings.memory, makeRequest, addMessage])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleAction = (action) => {
    if (action.route) navigate(action.route)
  }

  const handleSettingsChange = (next) => setSettings(next)

  const handleClear = () => {
    // Archive the current chat (if it has user messages) and start a fresh one.
    probeNewSession()
    setShowSettings(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes probebot-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes probebot-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes probebot-dot-glow {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(184, 212, 240, 0.8), 0 0 6px 2px rgba(184, 212, 240, 0.4);
          }
          50% {
            box-shadow: 0 0 0 5px rgba(184, 212, 240, 0), 0 0 10px 3px rgba(184, 212, 240, 0.2);
          }
        }
      `}</style>

      {/* Collapsed tab — shown only when closed */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Open Probe Bot"
          data-tooltip="Open Probe Bot"
          style={{
            position: 'fixed',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: 22,
            paddingTop: 14,
            paddingBottom: 14,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRight: 'none',
            borderRadius: '6px 0 0 6px',
            cursor: 'pointer',
            boxShadow: '-2px 0 12px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: isConnected ? '#b8d4f0' : '#333',
            animation: isConnected ? 'probebot-dot-glow 2s ease-in-out infinite' : 'none',
            boxShadow: isConnected ? '0 0 6px 2px rgba(184, 212, 240, 0.4)' : 'none',
          }} />
          <span style={{
            fontSize: 9,
            fontFamily: 'Geist, sans-serif',
            color: 'var(--text-dim)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            transform: 'rotate(180deg)',
            userSelect: 'none',
          }}>
            Probe Bot
          </span>
          <ChevronRight size={10} color="var(--text-dim)" style={{ transform: 'rotate(180deg)' }} />
        </button>
      )}

      {/* Panel */}
      <div
        className={`sidebar-right ${rightSidebarRevealed ? 'revealed' : ''}`}
        style={{
          width: open ? 280 : 0,
          minWidth: open ? 280 : 0,
          height: '100%',
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 0.22s ease, min-width 0.22s ease, transform 200ms ease, margin-left 200ms ease',
          position: 'relative',
        }}
      >
        <div style={{
          width: 280,
          height: '100%',
          background: 'var(--bg)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Header */}
          <div style={{
            height: 48,
            borderBottom: '1px solid var(--border)',
            padding: '0 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: isConnected ? 'var(--accent)' : 'var(--border-bright)',
              flexShrink: 0,
              animation: isConnected ? 'probebot-pulse 2s ease infinite' : 'none'
            }} />
            <span style={{
              fontSize: 13, color: 'var(--text-muted)',
              fontFamily: 'Geist, sans-serif', fontWeight: 400, flex: 1
            }}>
              Probe Bot
            </span>
            <ChatHistoryPopover
              sessions={probeSessions}
              activeSessionId={probeActiveId}
              onSwitch={probeSwitchSession}
              onNew={probeNewSession}
              onDelete={probeDeleteSession}
              onRename={probeRenameSession}
              label=""
              align="right"
            />
            <div ref={settingsRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowSettings(v => !v)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: showSettings ? 'var(--text)' : 'var(--text-dim)',
                  padding: 2, display: 'flex', alignItems: 'center'
                }}
              >
                <Settings size={16} />
              </button>
              {showSettings && (
                <SettingsPopover
                  settings={settings}
                  onChange={handleSettingsChange}
                  onClear={handleClear}
                  onClose={() => setShowSettings(false)}
                />
              )}
            </div>
            {/* Minimize button */}
            <button
              onClick={() => setOpen(false)}
              title="Minimize Probe Bot"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-dim)', padding: 2,
                display: 'flex', alignItems: 'center',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Context strip */}
          <div style={{
            height: 28,
            padding: '0 14px',
            background: 'var(--bg-2, #0e0e0e)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: 11, color: 'var(--text-dim)',
              fontFamily: 'Geist, sans-serif', fontWeight: 400
            }}>
              Watching · {activeModuleName}
            </span>
          </div>

          {/* Messages area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            minHeight: 0,
            position: 'relative',
          }}>
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {messages.map(msg => {
                if (msg.type === 'proactive') return <ProactiveMessage key={msg.id} msg={msg} onAction={handleAction} />
                if (msg.type === 'user') return <UserMessage key={msg.id} msg={msg} />
                if (msg.type === 'copilot') return <ProbeBotResponse key={msg.id} msg={msg} />
                if (msg.type === 'system') return <SystemMessage key={msg.id} msg={msg} />
                return null
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input area */}
          <div style={{
            borderTop: '1px solid var(--border)',
            padding: 8,
            flexShrink: 0,
            background: 'var(--bg)',
          }}>
            <div style={{ position: 'relative' }}>
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                rows={1}
                style={{
                  width: '100%',
                  minHeight: 36,
                  maxHeight: 120,
                  resize: 'none',
                  background: 'var(--bg-2, #0e0e0e)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '8px 32px 8px 10px',
                  fontFamily: 'Geist, sans-serif',
                  fontSize: 13,
                  color: 'var(--text)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  lineHeight: 1.4,
                  overflowY: 'auto',
                }}
                onInput={e => {
                  const el = e.target
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
                }}
                disabled={isStreaming}
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || isStreaming}
                style={{
                  position: 'absolute', right: 6, bottom: 6,
                  width: 24, height: 24,
                  background: inputText.trim() && !isStreaming ? 'var(--accent)' : 'var(--border)',
                  border: 'none', borderRadius: 4, cursor: inputText.trim() && !isStreaming ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                  padding: 0,
                }}
              >
                {isStreaming
                  ? <Loader2 size={12} color="white" style={{ animation: 'spin 1s linear infinite' }} />
                  : <Send size={12} color="white" />
                }
              </button>
            </div>
            <div style={{
              fontSize: 10, color: 'var(--text-dim)',
              fontFamily: 'Geist, sans-serif',
              marginTop: 5, paddingLeft: 2
            }}>
              Context: {activeModuleName} · {activeModel || 'no model'}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
