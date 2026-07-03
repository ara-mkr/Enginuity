import { useState, useEffect, useRef, useCallback } from 'react'
import {
  X,
  Eye,
  EyeOff,
  Lock,
  ExternalLink,
  Check,
  Loader2,
  AlertTriangle,
  Trash2,
} from 'lucide-react'
import { useModelRegistry, REGISTRY, keyFor } from '../../context/ModelRegistryContext'

type TestState = 'idle' | 'testing' | 'ok' | 'fail'

async function testProviderConnection(
  providerId: string,
  key: string
): Promise<{ ok: boolean; error?: string }> {
  const provider = REGISTRY[providerId]
  if (!provider) return { ok: false, error: 'Unknown provider' }

  try {
    let url: string
    let headers: Record<string, string> = {}

    if (providerId === 'anthropic') {
      url = `${provider.baseURL}/models`
      headers = {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      }
    } else if (providerId === 'google') {
      url = `${provider.baseURL}/models?key=${encodeURIComponent(key)}`
      headers = { 'x-goog-api-key': key }
    } else if (providerId === 'cohere') {
      url = `${provider.baseURL}/models`
      headers = { Authorization: `Bearer ${key}` }
    } else {
      // All OpenAI-compatible providers
      url = `${provider.baseURL}/models`
      headers = { Authorization: `${provider.authPrefix ?? 'Bearer '}${key}` }
    }

    const res = await fetch(url, { method: 'GET', headers })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => ({}))
    const msg =
      (data?.error as Record<string, string>)?.message ??
      (data?.message as string) ??
      `HTTP ${res.status}`
    return { ok: false, error: msg }
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? 'Network error' }
  }
}

interface APIKeyModalProps {
  providerId: string
  onClose: () => void
}

export function APIKeyModal({ providerId, onClose }: APIKeyModalProps) {
  const { saveKey, removeKey, getKey, setActive, connectedProviderIds } = useModelRegistry()
  const provider = REGISTRY[providerId]

  const [keyValue, setKeyValue] = useState('')
  const [selectedModel, setSelectedModel] = useState(provider?.models[0]?.id ?? '')
  const [showKey, setShowKey] = useState(false)
  const [testState, setTestState] = useState<TestState>('idle')
  const [testError, setTestError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isConnected = connectedProviderIds.includes(providerId)

  useEffect(() => {
    const stored = getKey(providerId) ?? ''
    setKeyValue(stored)
    setShowKey(false)
    setTestState('idle')
    setTestError(null)
    setSaved(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [providerId, getKey])

  const handleTest = useCallback(async () => {
    const trimmed = keyValue.trim()
    if (!trimmed) return
    setTestState('testing')
    setTestError(null)
    const result = await testProviderConnection(providerId, trimmed)
    if (result.ok) {
      setTestState('ok')
    } else {
      setTestState('fail')
      setTestError(result.error ?? 'Connection failed')
    }
  }, [providerId, keyValue])

  const handleSave = useCallback(() => {
    const trimmed = keyValue.trim()
    if (!trimmed) return
    saveKey(providerId, trimmed, selectedModel)
    setActive(providerId, selectedModel)
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      onClose()
    }, 1200)
  }, [providerId, keyValue, selectedModel, saveKey, setActive, onClose])

  const handleRemove = useCallback(() => {
    removeKey(providerId)
    onClose()
  }, [providerId, removeKey, onClose])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
  }

  if (!provider) return null

  const modelCount = provider.models.length
  const accentRgb = provider.color === '#ffffff' ? '180,180,180' : provider.color

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(8,8,16,0.92)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
        style={{ background: 'var(--surface)', borderColor: 'var(--border-bright)' }}
        onKeyDown={handleKeyDown}
      >
        {/* Colored top accent bar */}
        <div style={{ height: 3, background: provider.color }} />

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: provider.color, boxShadow: `0 0 8px ${provider.color}80` }}
            />
            <div>
              <h2
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text)',
                  
                }}
              >
                {provider.name}
              </h2>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                {isConnected ? `${modelCount} models unlocked` : `${modelCount} models available`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnected && (
              <button
                onClick={handleRemove}
                className="p-1.5 rounded-md transition-colors"
                style={{ color: 'var(--text-dim)' }}
                title="Disconnect"
                onMouseEnter={(e) => (e.currentTarget.style.color = '#b08080')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-4">
          {/* Special note */}
          {provider.note && (
            <div
              className="px-3 py-2 rounded-lg text-xs border"
              style={{
                background: `${accentRgb}08`,
                borderColor: `${provider.color}25`,
                color: 'var(--text-muted)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {provider.note}
            </div>
          )}

          {/* Model selector */}
          <div>
            <label
              className="block mb-1.5"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                
                
                color: 'var(--text-muted)',
              }}
            >
              Default Model
            </label>
            <div className="flex flex-col gap-1">
              {provider.models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedModel(m.id)}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-left"
                  style={{
                    background: selectedModel === m.id ? `${provider.color}12` : 'var(--bg-2)',
                    borderColor: selectedModel === m.id ? provider.color : 'var(--border)',
                    color: selectedModel === m.id ? 'var(--text)' : 'var(--text-muted)',
                  }}
                >
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{m.name}</span>
                  <div className="flex items-center gap-1.5">
                    <TierBadge tier={m.tier} />
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {m.context}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* API key input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  
                  
                  color: 'var(--text-muted)',
                }}
              >
                API Key
              </label>
              <a
                href={provider.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs transition-colors"
                style={{ color: provider.color, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
              >
                Get key <ExternalLink size={9} />
              </a>
            </div>
            <div className="relative">
              <input
                ref={inputRef}
                type={showKey ? 'text' : 'password'}
                value={keyValue}
                onChange={(e) => {
                  setKeyValue(e.target.value)
                  setTestState('idle')
                }}
                placeholder={provider.keyPrefix ? `${provider.keyPrefix}...` : 'Paste your API key…'}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none border transition-all pr-10"
                style={{
                  background: 'var(--bg-2)',
                  color: 'var(--text)',
                  borderColor: 'var(--border)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = provider.color
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${provider.color}18`
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              <button
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 transition-colors"
                style={{ color: 'var(--text-dim)' }}
                tabIndex={-1}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Test result */}
          {testState !== 'idle' && (
            <div
              className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
              style={
                testState === 'ok'
                  ? { background: 'rgba(34,197,94,0.08)', color: '#7aaa8a' }
                  : testState === 'fail'
                  ? { background: 'rgba(255,80,80,0.08)', color: '#b08080' }
                  : { background: 'var(--bg-2)', color: 'var(--text-muted)' }
              }
            >
              <span className="mt-0.5 shrink-0">
                {testState === 'testing' && <Loader2 size={12} className="animate-spin" />}
                {testState === 'ok' && <Check size={12} />}
                {testState === 'fail' && <AlertTriangle size={12} />}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {testState === 'testing' && 'Testing connection…'}
                {testState === 'ok' &&
                  `Connected — ${modelCount} model${modelCount !== 1 ? 's' : ''} available`}
                {testState === 'fail' && (testError ?? 'Connection failed')}
              </span>
            </div>
          )}

          {/* Privacy note */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border"
            style={{
              background: 'rgba(148, 163, 184, 0.03)',
              borderColor: 'rgba(148, 163, 184, 0.10)',
              color: 'var(--text-dim)',
            }}
          >
            <Lock size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span>Keys are stored locally in your browser and never leave your device.</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleTest}
              disabled={!keyValue.trim() || testState === 'testing'}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs border transition-all disabled:opacity-40"
              style={{
                borderColor: 'var(--border-bright)',
                color: 'var(--text-muted)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                
                
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = provider.color
                e.currentTarget.style.color = provider.color
                e.currentTarget.style.background = `${provider.color}10`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-bright)'
                e.currentTarget.style.color = 'var(--text-muted)'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              {testState === 'testing' ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Check size={11} />
              )}
              Test
            </button>

            <button
              onClick={handleSave}
              disabled={!keyValue.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs transition-all disabled:opacity-40"
              style={{
                background: saved ? '#7aaa8a' : provider.color,
                color: '#080808',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                fontSize: 11,
                
                
              }}
            >
              {saved ? (
                <><Check size={11} /> Saved</>
              ) : (
                isConnected ? 'Update Key' : 'Connect'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared tier badge (exported for reuse in other components)
// ---------------------------------------------------------------------------
const TIER_STYLES: Record<string, { bg: string; color: string }> = {
  flagship: { bg: 'rgba(148, 163, 184, 0.12)', color: '#94a3b8' },
  fast:     { bg: 'rgba(0,230,118,0.12)', color: '#7aaa8a' },
  reasoning:{ bg: 'rgba(179,136,255,0.12)', color: '#9485b8' },
  code:     { bg: 'rgba(255,171,64,0.12)', color: '#b09470' },
  balanced: { bg: 'transparent', color: 'var(--text-muted)' },
}

export function TierBadge({ tier }: { tier: string }) {
  const style = TIER_STYLES[tier] ?? TIER_STYLES.balanced
  return (
    <span
      style={{
        ...style,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9,
        
        
        padding: '1px 5px',
        borderRadius: 4,
        whiteSpace: 'nowrap',
      }}
    >
      {tier}
    </span>
  )
}

// Re-export for easy access
export { testProviderConnection }
