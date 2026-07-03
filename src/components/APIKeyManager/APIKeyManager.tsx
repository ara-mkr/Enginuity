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
  ChevronDown,
} from 'lucide-react'
import {
  PROVIDERS,
  keyFor,
  modelFor,
  ACTIVE_PROVIDER_KEY,
  type Provider,
} from './providers'

interface APIKeyManagerProps {
  onClose: () => void
  initialProvider?: string
}

type TestState = 'idle' | 'testing' | 'ok' | 'fail'

function buildTestHeaders(provider: Provider, key: string): Record<string, string> {
  if (provider.id === 'anthropic') {
    return {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }
  }
  if (provider.id === 'openai' || provider.id === 'mistral') {
    return { Authorization: `Bearer ${key}` }
  }
  if (provider.id === 'gemini') {
    return { 'x-goog-api-key': key }
  }
  return {}
}

async function testConnection(provider: Provider, key: string): Promise<boolean> {
  try {
    const url =
      provider.id === 'gemini'
        ? `${provider.baseURL}/models`
        : `${provider.baseURL}${provider.testEndpoint}`

    const headers = buildTestHeaders(provider, key)

    // Gemini models list needs the key as a query param too
    const fullUrl =
      provider.id === 'gemini' ? `${url}?key=${encodeURIComponent(key)}` : url

    const res = await fetch(fullUrl, { method: 'GET', headers })
    return res.ok || res.status === 200
  } catch {
    return false
  }
}

export function APIKeyManager({ onClose, initialProvider }: APIKeyManagerProps) {
  const [activeTab, setActiveTab] = useState<string>(
    initialProvider ?? PROVIDERS[0].id
  )
  const provider = PROVIDERS.find((p) => p.id === activeTab) ?? PROVIDERS[0]

  const [keyValue, setKeyValue] = useState('')
  const [selectedModel, setSelectedModel] = useState(provider.models[0])
  const [showKey, setShowKey] = useState(false)
  const [testState, setTestState] = useState<TestState>('idle')
  const [testError, setTestError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load stored values when tab changes
  useEffect(() => {
    const stored = localStorage.getItem(keyFor(provider.id)) ?? ''
    const storedModel = localStorage.getItem(modelFor(provider.id)) ?? provider.models[0]
    setKeyValue(stored)
    setSelectedModel(storedModel)
    setShowKey(false)
    setTestState('idle')
    setTestError(null)
    setSaved(false)
  }, [provider.id])

  useEffect(() => {
    inputRef.current?.focus()
  }, [activeTab])

  const hasSavedKey = useCallback(
    (id: string) => !!localStorage.getItem(keyFor(id)),
    []
  )

  const handleTest = useCallback(async () => {
    if (!keyValue.trim()) return
    setTestState('testing')
    setTestError(null)
    const ok = await testConnection(provider, keyValue.trim())
    if (ok) {
      setTestState('ok')
    } else {
      setTestState('fail')
      setTestError('Connection failed — check key permissions and try again.')
    }
  }, [provider, keyValue])

  const handleSave = useCallback(() => {
    const trimmed = keyValue.trim()
    if (!trimmed) return
    localStorage.setItem(keyFor(provider.id), trimmed)
    localStorage.setItem(modelFor(provider.id), selectedModel)
    // Set as active provider
    localStorage.setItem(ACTIVE_PROVIDER_KEY, provider.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
    // Dispatch storage event so hooks pick up the change
    window.dispatchEvent(new Event('storage'))
  }, [provider.id, keyValue, selectedModel])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(8,8,16,0.9)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden"
        style={{ background: 'var(--surface)', borderColor: 'var(--border-bright)' }}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div>
            <h2
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text)',
                
                
              }}
            >
              API Key Manager
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Configure providers for all AI modules
            </p>
          </div>
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

        {/* Provider tabs */}
        <div
          className="flex border-b"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}
        >
          {PROVIDERS.map((p) => {
            const isActive = p.id === activeTab
            const hasKey = hasSavedKey(p.id)
            return (
              <button
                key={p.id}
                onClick={() => setActiveTab(p.id)}
                className="flex items-center gap-2 px-4 py-3 text-xs transition-all border-b-2"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  
                  borderBottomColor: isActive ? p.color : 'transparent',
                  color: isActive ? 'var(--text)' : 'var(--text-muted)',
                  background: isActive ? 'var(--surface)' : 'transparent',
                }}
              >
                {/* Status dot */}
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: hasKey ? '#7aaa8a' : 'var(--text-dim)' }}
                />
                {p.name}
              </button>
            )
          })}
        </div>

        {/* Form body */}
        <div className="px-5 py-5 flex flex-col gap-4">
          {/* Model selector */}
          <div>
            <label
              className="block mb-1.5"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                
                
                color: 'var(--text-muted)',
              }}
            >
              Model
            </label>
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full appearance-none rounded-lg px-3 py-2 text-sm outline-none border transition-all pr-8 cursor-pointer"
                style={{
                  background: 'var(--bg-2)',
                  color: 'var(--text)',
                  borderColor: 'var(--border)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)'
                  e.currentTarget.style.borderColor = 'var(--border-bright)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {provider.models.map((m) => (
                  <option key={m} value={m} style={{ background: 'var(--surface)' }}>
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              />
            </div>
          </div>

          {/* API key input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  
                  
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
                style={{ color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}
              >
                Get API Key
                <ExternalLink size={10} />
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
                placeholder={provider.placeholder}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none border transition-all pr-10"
                style={{
                  background: 'var(--bg-2)',
                  color: 'var(--text)',
                  borderColor: 'var(--border)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)'
                  e.currentTarget.style.borderColor = 'var(--border-bright)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              <button
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 transition-colors"
                style={{ color: 'var(--text-muted)' }}
                tabIndex={-1}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Test result */}
          {testState !== 'idle' && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={
                testState === 'ok'
                  ? { background: 'rgba(34,197,94,0.1)', color: '#7aaa8a' }
                  : testState === 'fail'
                  ? { background: 'rgba(255,80,80,0.1)', color: '#b08080' }
                  : { background: 'var(--bg-2)', color: 'var(--text-muted)' }
              }
            >
              {testState === 'testing' && <Loader2 size={12} className="animate-spin" />}
              {testState === 'ok' && <Check size={12} />}
              {testState === 'fail' && <AlertTriangle size={12} />}
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {testState === 'testing' && 'Testing connection…'}
                {testState === 'ok' && 'Connection successful'}
                {testState === 'fail' && (testError ?? 'Connection failed')}
              </span>
            </div>
          )}

          {/* Disclaimer */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border"
            style={{
              background: 'rgba(0,200,255,0.04)',
              borderColor: 'rgba(0,200,255,0.12)',
              color: 'var(--text-muted)',
            }}
          >
            <Lock size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span>Keys are stored locally in your browser and never leave your device.</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleTest}
              disabled={!keyValue.trim() || testState === 'testing'}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs border font-mono transition-all disabled:opacity-40"
              style={{ borderColor: 'var(--border-bright)', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace",   fontSize: 11 }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-glow)'
                e.currentTarget.style.borderColor = 'var(--accent)'
                e.currentTarget.style.color = 'var(--accent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.borderColor = 'var(--border-bright)'
                e.currentTarget.style.color = 'var(--text-muted)'
              }}
            >
              {testState === 'testing' ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Check size={11} />
              )}
              Test Connection
            </button>

            <button
              onClick={handleSave}
              disabled={!keyValue.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs transition-all disabled:opacity-40"
              style={{
                background: saved ? '#7aaa8a' : 'var(--accent)',
                color: 'var(--bg)',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                
                
                fontSize: 11,
              }}
            >
              {saved ? <><Check size={11} /> Saved</> : 'Save & Set Active'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
