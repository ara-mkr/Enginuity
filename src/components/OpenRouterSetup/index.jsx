import { useState } from 'react'
import { Zap, Cpu, Server, Eye, EyeOff, ExternalLink, Check, Loader2, AlertTriangle, X, ArrowLeft } from 'lucide-react'
import { useOpenRouter } from '../../context/OpenRouterContext'
import OPENROUTER_MODELS from '../../config/openrouterModels'
import { OllamaSetup } from './OllamaSetup'
import { CustomProviderSetup } from '../CustomProviderPanel'
import { useOllamaStatus } from '../../hooks/useOllamaStatus'

const PROVIDERS = [
  'Anthropic', 'OpenAI', 'Google', 'xAI', 'DeepSeek',
  'Meta', 'Mistral', 'Alibaba', 'Cohere', 'NVIDIA', 'Perplexity', 'Microsoft',
]

const PROVIDER_COLORS = {
  Anthropic: '#cc785c', OpenAI: '#10a37f', Google: '#4285f4', xAI: '#e5e5e5',
  DeepSeek: '#4d6bfe', Meta: '#0866ff', Mistral: '#ff7000', Alibaba: '#b07e50',
  Cohere: '#39594d', NVIDIA: '#7a9a5a', Perplexity: '#20808d', Microsoft: '#0078d4',
}

export function OpenRouterSetup({ onClose }) {
  const { saveKey, closeSetup, apiKey, activeProvider, ollamaModelId } = useOpenRouter()
  const [key, setKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [status, setStatus] = useState('idle') // idle | testing | ok | error
  const [error, setError] = useState('')
  const [modelCount, setModelCount] = useState(0)
  // Provider chooser: 'choose' → 'openrouter' | 'ollama' | 'custom'.
  // Default to chooser unless the user already has OpenRouter set up (legacy users
  // re-opening from sidebar should land back on the OpenRouter form they remember).
  const [mode, setMode] = useState(
    activeProvider === 'ollama' && ollamaModelId ? 'ollama'
      : activeProvider === 'custom' ? 'custom'
      : apiKey ? 'openrouter'
      : 'choose',
  )

  const handleClose = () => {
    closeSetup()
    onClose?.()
  }

  if (mode === 'ollama') {
    return <OllamaSetup onBack={() => setMode('choose')} onClose={onClose} />
  }

  if (mode === 'custom') {
    return <CustomProviderSetup onBack={() => setMode('choose')} onClose={onClose} />
  }

  if (mode === 'choose') {
    return <ProviderChooser onPick={setMode} onClose={handleClose} />
  }

  const handleConnect = async () => {
    const trimmed = key.trim()
    if (!trimmed.startsWith('sk-or-')) {
      setError('Key must start with sk-or-  —  make sure you copied an OpenRouter key.')
      setStatus('error')
      return
    }

    setStatus('testing')
    setError('')

    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${trimmed}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error?.message ?? `API returned ${res.status}`)
      }
      const data = await res.json()
      const count = data?.data?.length ?? OPENROUTER_MODELS.length
      setModelCount(count)
      setStatus('ok')

      // Store and close after brief success flash
      setTimeout(() => {
        saveKey(trimmed)
        handleClose()
      }, 1200)
    } catch (e) {
      setError(e.message ?? 'Connection failed')
      setStatus('error')
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(8,8,16,0.92)', backdropFilter: 'blur(8px)',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'var(--surface)',
        border: '1px solid var(--border-bright)',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          padding: '28px 28px 0',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <button
                onClick={() => setMode('choose')}
                title="Back to provider choice"
                style={{
                  background: 'transparent', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
                }}
              >
                <ArrowLeft size={16} />
              </button>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Zap size={20} color="var(--accent)" />
              </div>
              <div>
                <h2 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                  One Key. Every Model.
                </h2>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
              Connect your OpenRouter key to unlock 50+ AI models — Claude, GPT, Gemini, Grok, DeepSeek, Llama &amp; more — all through one endpoint.
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Key input */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={(e) => { setKey(e.target.value); setStatus('idle'); setError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              placeholder="sk-or-v1-..."
              style={{
                width: '100%', padding: '13px 44px 13px 16px',
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 10, color: 'var(--text)', fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace", outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
            <button
              onClick={() => setShowKey((v) => !v)}
              style={{
                position: 'absolute', right: 12, color: 'var(--text-muted)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 2,
              }}
            >
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {/* Error */}
          {status === 'error' && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-start',
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)',
              color: '#b08080', fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
            }}>
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}

          {/* Success */}
          {status === 'ok' && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'center',
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
              color: '#7aaa8a', fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
            }}>
              <Check size={13} />
              Connected — {modelCount} models available
            </div>
          )}

          {/* Connect button */}
          <button
            onClick={handleConnect}
            disabled={!key.trim() || status === 'testing' || status === 'ok'}
            style={{
              width: '100%', padding: '13px 0',
              background: status === 'ok' ? '#7aaa8a' : 'var(--accent)',
              color: 'var(--bg)', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
              cursor: (!key.trim() || status === 'testing' || status === 'ok') ? 'not-allowed' : 'pointer',
              opacity: (!key.trim() || status === 'testing') ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s',
            }}
          >
            {status === 'testing' ? (
              <><Loader2 size={15} className="animate-spin" /> Verifying...</>
            ) : status === 'ok' ? (
              <><Check size={15} /> Connected</>
            ) : (
              <>Connect →</>
            )}
          </button>

          {/* Get key link */}
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            Don't have a key?{' '}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
            >
              Get one free at openrouter.ai <ExternalLink size={10} />
            </a>
            <br />
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Free tier available — no credit card required</span>
          </p>

          {/* Security note */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 0', borderTop: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
              <span style={{ color: '#b8d4f0' }}>⊕</span> Stored locally in your browser. Never sent to our servers.
            </span>
          </div>
        </div>

        {/* Provider marquee */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '14px 20px',
          background: 'var(--bg-2)',
          overflow: 'hidden',
        }}>
          <p style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-dim)', marginBottom: 10,   }}>
            Models available through OpenRouter
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px' }}>
            {PROVIDERS.map((name) => (
              <span key={name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: PROVIDER_COLORS[name] ?? '#888', display: 'inline-block' }} />
                <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>{name}</span>
              </span>
            ))}
            <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-dim)' }}>+ more</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProviderChooser({ onPick, onClose }) {
  const ollama = useOllamaStatus(5000)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(8,8,16,0.92)', backdropFilter: 'blur(8px)', padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 560,
        background: 'var(--surface)', border: '1px solid var(--border-bright)',
        borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          padding: '28px 28px 0',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700,
              color: 'var(--text)', margin: 0,
            }}>
              How do you want to power ENGINGUITY?
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 0' }}>
              Pick one to start — you can switch anytime, or connect both.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              color: 'var(--text-muted)', background: 'none', border: 'none',
              cursor: 'pointer', padding: 4, flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{
          padding: 24, display: 'grid', gap: 14,
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        }}>
          <ProviderCard
            icon={<Zap size={22} color="var(--accent)" />}
            iconBg="rgba(0,200,255,0.1)"
            iconBorder="rgba(0,200,255,0.25)"
            title="OpenRouter"
            subtitle="Cloud · best quality"
            lines={['50+ frontier models', 'Claude, GPT, Gemini, Grok', '~$0.001 per message']}
            ctaColor="var(--accent)"
            cta="Connect →"
            onClick={() => onPick('openrouter')}
          />
          <ProviderCard
            icon={<Cpu size={22} color="#8b8df0" />}
            iconBg="rgba(99,102,241,0.12)"
            iconBorder="rgba(99,102,241,0.25)"
            title="Local (Ollama)"
            subtitle={
              ollama.running
                ? `Detected · ${ollama.models.length} model${ollama.models.length === 1 ? '' : 's'}`
                : 'Free · private · offline'
            }
            lines={[
              ollama.running ? 'Ollama is running' : 'Run models on your machine',
              'No API key required',
              '$0.00 forever',
            ]}
            ctaColor="#7a85f0"
            cta={ollama.running ? 'Choose Model →' : 'Set Up →'}
            badge={ollama.running ? 'READY' : null}
            onClick={() => onPick('ollama')}
          />
          <ProviderCard
            icon={<Server size={22} color="#b09470" />}
            iconBg="rgba(176,148,112,0.1)"
            iconBorder="rgba(176,148,112,0.25)"
            title="Other"
            subtitle="Any OpenAI-compatible API"
            lines={['NVIDIA NIM, Groq, Together…', 'Your base URL + API key', 'Self-hosted works too']}
            ctaColor="#b09470"
            cta="Configure →"
            onClick={() => onPick('custom')}
          />
        </div>

        <div style={{
          borderTop: '1px solid var(--border)', padding: '14px 28px',
          background: 'var(--bg-2)', textAlign: 'center',
        }}>
          <span style={{
            fontSize: 11, color: 'var(--text-dim)',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            ⊕ Your keys and selections are stored locally in your browser.
          </span>
        </div>
      </div>
    </div>
  )
}

function ProviderCard({ icon, iconBg, iconBorder, title, subtitle, lines, ctaColor, cta, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12,
        padding: 18, borderRadius: 12,
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        cursor: 'pointer', textAlign: 'left', minHeight: 180,
        transition: 'border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#94a5ba'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.transform = 'none'
      }}
    >
      {badge && (
        <span style={{
          position: 'absolute', top: 12, right: 12,
          fontSize: 9, fontFamily: "'JetBrains Mono', monospace",
          color: '#4ade80', letterSpacing: 0.6,
          padding: '2px 6px', borderRadius: 4,
          background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
        }}>
          {badge}
        </span>
      )}
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: iconBg, border: `1px solid ${iconBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700,
          color: 'var(--text)', marginBottom: 2,
        }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{subtitle}</div>
      </div>
      <ul style={{
        listStyle: 'none', padding: 0, margin: 0,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {lines.map((l) => (
          <li key={l} style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {l}</li>
        ))}
      </ul>
      <span style={{
        marginTop: 'auto', fontSize: 12, fontWeight: 600,
        fontFamily: "'JetBrains Mono', monospace", color: ctaColor,
      }}>
        {cta}
      </span>
    </button>
  )
}

export default OpenRouterSetup
