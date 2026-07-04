import { useMemo, useState } from 'react'
import {
  X, Cloud, Cpu, Check, AlertTriangle, Trash2, ExternalLink,
  Download, RefreshCw, Copy, Loader2, Zap, Sparkles,
} from 'lucide-react'
import { useOpenRouter } from '../../context/OpenRouterContext'
import { useOllamaStatus } from '../../hooks/useOllamaStatus'
import { useDeviceSpecs, modelFitsInRAM } from '../../hooks/useDeviceSpecs'
import OPENROUTER_MODELS from '../../config/openrouterModels'
import {
  DEFAULT_OLLAMA_HOST,
  OLLAMA_HOST_STORAGE,
  deleteOllamaModel,
  getOllamaHost,
  pullOllamaModel,
} from '../../config/ollama'

export function AISettings({ onClose }) {
  const {
    activeProvider, setActiveProvider,
    activeModelId, setModelId,
    ollamaModelId, setOllamaModelId,
    apiKey, openSetup,
  } = useOpenRouter()

  const [tab, setTab] = useState(activeProvider === 'ollama' ? 'ollama' : 'openrouter')

  const handleClose = () => onClose?.()

  const activeLabel = activeProvider === 'ollama'
    ? `Ollama · ${ollamaModelId ?? '—'}`
    : activeProvider === 'both'
      ? `Hybrid · ${ollamaModelId ?? '—'} → ${activeModelId ?? '—'}`
      : `OpenRouter · ${activeModelId ?? '—'}`

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(8,8,16,0.85)', backdropFilter: 'blur(8px)', padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <style>{`
        @keyframes aiSettingsIn {
          from { opacity: 0; transform: scale(0.97) }
          to   { opacity: 1; transform: scale(1) }
        }
        @keyframes fadeTab {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
      `}</style>

      <div style={{
        width: '100%', maxWidth: 560, maxHeight: '88vh',
        background: 'var(--surface)', border: '1px solid var(--border-bright)',
        borderRadius: 12, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        animation: 'aiSettingsIn 150ms ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border)',
          position: 'relative',
        }}>
          <h2 style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 400,
            color: '#e2e4f0', margin: 0,
          }}>
            AI Settings
          </h2>
          <p style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
            color: 'var(--text-muted)', margin: '2px 0 0',
          }}>
            Pick a provider and choose your model.
          </p>
          <button
            onClick={handleClose}
            style={{
              position: 'absolute', top: 16, right: 16,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)', padding: 4, display: 'flex',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Provider Cards */}
        <div style={{ padding: '16px 24px 0', display: 'flex', gap: 8 }}>
          <ProviderCard
            active={tab === 'openrouter'}
            selected={activeProvider === 'openrouter' || activeProvider === 'both'}
            icon={<Cloud size={16} />}
            label="OpenRouter"
            sublabel="Cloud · 50+ models"
            onClick={() => setTab('openrouter')}
          />
          <ProviderCard
            active={tab === 'ollama'}
            selected={activeProvider === 'ollama' || activeProvider === 'both'}
            icon={<Cpu size={16} />}
            label="Local (Ollama)"
            sublabel="Free · runs locally"
            onClick={() => setTab('ollama')}
          />
        </div>

        {/* Hybrid mode: prefer Ollama, fall back to OpenRouter */}
        <div style={{ padding: '12px 24px 0' }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            padding: '10px 12px', borderRadius: 8,
            background: activeProvider === 'both' ? 'var(--surface-2)' : 'transparent',
            border: '1px solid ' + (activeProvider === 'both' ? 'var(--border-bright)' : 'var(--border)'),
          }}>
            <input
              type="checkbox"
              checked={activeProvider === 'both'}
              onChange={(e) => {
                if (e.target.checked) {
                  setActiveProvider('both')
                } else {
                  // Fall back to whichever single provider the open tab shows.
                  setActiveProvider(tab === 'ollama' ? 'ollama' : 'openrouter')
                }
              }}
              style={{ accentColor: 'var(--accent)' }}
            />
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text)' }}>
                Hybrid mode
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Prefer local Ollama; automatically fall back to OpenRouter if Ollama fails.
              </div>
            </div>
          </label>
        </div>

        {/* Body */}
        <div
          key={tab}
          style={{
            flex: 1, overflowY: 'auto', padding: '16px 24px 0',
            animation: 'fadeTab 150ms ease',
          }}
        >
          {tab === 'openrouter' ? (
            <OpenRouterPanel
              apiKey={apiKey}
              activeModelId={activeModelId}
              onSelect={(id) => { setModelId(id); setActiveProvider('openrouter') }}
              onConnectKey={openSetup}
            />
          ) : (
            <OllamaPanel
              ollamaModelId={ollamaModelId}
              onSelect={(id) => { setOllamaModelId(id); setActiveProvider('ollama') }}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{
          height: 40, borderTop: '1px solid var(--border)',
          padding: '0 24px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', background: 'var(--bg-2)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: '#94a5ba',
            }} />
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)',
            }}>
              ACTIVE: {activeProvider === 'ollama' ? 'Ollama · ' : 'OpenRouter · '}
              <span style={{ color: '#e2e4f0' }}>
                {activeProvider === 'ollama' ? (ollamaModelId ?? '—') : (activeModelId ?? '—')}
              </span>
            </span>
          </div>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)',
          }}>
            All choices stored locally
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── PROVIDER CARD ──────────────────────────────────────────────

function ProviderCard({ active, selected, icon, label, sublabel, onClick }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
        background: active || hovered ? 'var(--surface-2)' : 'var(--bg-2)',
        border: '1px solid',
        borderColor: active ? '#94a5ba' : hovered ? 'var(--border-bright)' : 'var(--border)',
        transition: 'all 0.15s',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 6, flexShrink: 0,
        background: 'var(--surface)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: selected ? '#94a5ba' : 'var(--border-bright)',
            transition: 'background 0.15s',
          }} />
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 400,
            color: '#e2e4f0',
          }}>
            {label}
          </span>
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
          color: 'var(--text-muted)', paddingLeft: 12,
        }}>
          {sublabel}
        </div>
      </div>
    </button>
  )
}

// ─── OPENROUTER PANEL ───────────────────────────────────────────

const TIER_COLORS = {
  flagship: '#94a3b8', balanced: '#6b6d85', fast: '#7aaa8a',
  reasoning: '#9485b8', code: '#b09470',
}

function OpenRouterPanel({ apiKey, activeModelId, onSelect, onConnectKey }) {
  const [filter, setFilter] = useState('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return OPENROUTER_MODELS
    if (filter === 'recommended') return OPENROUTER_MODELS.filter((m) => m.recommended)
    if (filter === 'free') return OPENROUTER_MODELS.filter((m) => m.free)
    return OPENROUTER_MODELS.filter((m) => m.tier === filter)
  }, [filter])

  const grouped = useMemo(() => {
    const out = {}
    for (const m of filtered) {
      ;(out[m.provider] ??= []).push(m)
    }
    return out
  }, [filtered])

  if (!apiKey) {
    return (
      <div style={{
        padding: 24, textAlign: 'center',
        background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10,
        marginBottom: 24,
      }}>
        <Cloud size={24} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
        <h3 style={{
          fontSize: 14, color: '#e2e4f0', margin: '0 0 6px',
          fontFamily: "'JetBrains Mono', monospace", fontWeight: 400,
        }}>
          Connect your OpenRouter key
        </h3>
        <p style={{
          fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.6,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          One key unlocks Claude, GPT, Gemini, Grok, DeepSeek and 45+ more frontier models.
        </p>
        <button
          onClick={onConnectKey}
          style={{
            padding: '8px 18px', background: 'var(--surface-2)',
            color: '#e2e4f0', border: '1px solid var(--border-bright)',
            borderRadius: 6, cursor: 'pointer', fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          <Zap size={12} /> Connect Key
        </button>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Filter pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'recommended', label: 'Recommended' },
          { id: 'flagship', label: 'Flagship' },
          { id: 'balanced', label: 'Balanced' },
          { id: 'reasoning', label: 'Reasoning' },
          { id: 'fast', label: 'Fast' },
          { id: 'code', label: 'Code' },
          { id: 'free', label: 'Free' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding: '4px 10px', borderRadius: 12,
              background: filter === f.id ? 'var(--surface-2)' : 'transparent',
              border: '1px solid',
              borderColor: filter === f.id ? 'var(--border-bright)' : 'var(--border)',
              color: filter === f.id ? '#e2e4f0' : 'var(--text-muted)',
              fontSize: 11, fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Provider groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {Object.entries(grouped).map(([provider, models]) => (
          <div key={provider}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: models[0].providerColor,
              }} />
              <span style={{
                fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                color: 'var(--text-dim)',
              }}>
                {provider}
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 8,
            }}>
              {models.map((m) => (
                <CloudModelCard
                  key={m.id}
                  model={m}
                  selected={m.id === activeModelId}
                  onClick={() => onSelect(m.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CloudModelCard({ model, selected, onClick }) {
  const [hovered, setHovered] = useState(false)
  const avgPrice = (model.inputPricePer1M + model.outputPricePer1M) / 2

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start', gap: 4, padding: '12px 14px',
        borderRadius: 8, cursor: 'pointer', textAlign: 'left', minHeight: 72,
        background: selected || hovered ? 'var(--surface)' : 'var(--bg-2)',
        border: '1px solid',
        borderColor: selected ? '#94a5ba' : hovered ? 'var(--border-bright)' : 'var(--border)',
        transition: 'all 0.15s',
      }}
    >
      {selected && (
        <span style={{
          position: 'absolute', top: 8, right: 8,
          fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: '#94a5ba',
        }}>
          ✓
        </span>
      )}
      <div style={{
        fontSize: 13, fontWeight: 400, color: '#e2e4f0',
        fontFamily: "'JetBrains Mono', monospace", paddingRight: selected ? 20 : 0,
      }}>
        {model.name}
        {model.recommended && (
          <Sparkles size={10} color="var(--text-dim)" style={{ marginLeft: 5, verticalAlign: 'middle' }} />
        )}
      </div>
      <div style={{
        fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace',",
      }}>
        {model.contextK}K ctx
        {model.free && (
          <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>· free</span>
        )}
      </div>
      <div style={{
        marginTop: 'auto', fontSize: 10, color: 'var(--text-dim)',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        ${avgPrice.toFixed(2)} / 1M
      </div>
    </button>
  )
}

// ─── OLLAMA PANEL ───────────────────────────────────────────────

// ─── OLLAMA HOST OVERRIDE ───────────────────────────────────────
// The storage key has existed since the provider landed; this is the input
// for it. Committing re-checks against the new host immediately, so a wrong
// address shows up as "not detected" rather than failing silently later.

function OllamaHostRow({ onCommit }) {
  const [text, setText] = useState(() => getOllamaHost())
  const [error, setError] = useState(null)
  const overridden = getOllamaHost() !== DEFAULT_OLLAMA_HOST

  const commit = (raw) => {
    const value = (raw ?? text).trim().replace(/\/+$/, '')
    if (!value) return reset()
    try {
      const url = new URL(value)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('bad protocol')
    } catch {
      setError('Enter a full URL, e.g. http://192.168.1.20:11434')
      return
    }
    setError(null)
    if (value === DEFAULT_OLLAMA_HOST) localStorage.removeItem(OLLAMA_HOST_STORAGE)
    else localStorage.setItem(OLLAMA_HOST_STORAGE, value)
    setText(value)
    onCommit?.()
  }

  const reset = () => {
    localStorage.removeItem(OLLAMA_HOST_STORAGE)
    setText(DEFAULT_OLLAMA_HOST)
    setError(null)
    onCommit?.()
  }

  return (
    <div>
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        borderTop: '1px solid var(--border)', paddingTop: 12,
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-dim)',
          flexShrink: 0,
        }}>
          host
        </span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
          placeholder={DEFAULT_OLLAMA_HOST}
          spellCheck={false}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
            color: error ? '#b08080' : 'var(--text)',
          }}
        />
        {overridden ? (
          <button
            onClick={reset}
            title={`Reset to ${DEFAULT_OLLAMA_HOST}`}
            style={{
              padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
              border: '1px solid var(--border-bright)', color: 'var(--text-muted)',
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              background: 'transparent',
            }}
          >
            Reset
          </button>
        ) : (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)' }}>
            default
          </span>
        )}
      </div>
      {error && (
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#b08080', marginTop: 6 }}>
          {error}
        </div>
      )}
      {overridden && !error && (
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)', marginTop: 6 }}>
          Remote hosts need OLLAMA_ORIGINS set on the server for browser access.
        </div>
      )}
    </div>
  )
}

function OllamaPanel({ ollamaModelId, onSelect }) {
  const status = useOllamaStatus(8000)
  const specs = useDeviceSpecs()
  const [busyModel, setBusyModel] = useState(null)
  const [pullName, setPullName] = useState('')
  const [pulling, setPulling] = useState(false)
  const [pullError, setPullError] = useState(null)

  const modelsWithFit = useMemo(
    () => status.models.map((m) => ({
      ...m,
      fit: modelFitsInRAM(parseFloat(m.sizeGB), specs.estimatedRamGB),
    })),
    [status.models, specs.estimatedRamGB],
  )

  const recommendedId = useMemo(() => {
    if (modelsWithFit.length === 0) return null
    const fitting = modelsWithFit.filter((m) => m.fit === 'fits')
    if (fitting.length > 0) {
      return [...fitting].sort((a, b) => parseFloat(b.sizeGB) - parseFloat(a.sizeGB))[0].id
    }
    return [...modelsWithFit].sort((a, b) => parseFloat(a.sizeGB) - parseFloat(b.sizeGB))[0].id
  }, [modelsWithFit])

  const handleDelete = async (name) => {
    if (!confirm(`Delete ${name} from your machine? This frees up disk space.`)) return
    setBusyModel(name)
    try {
      await deleteOllamaModel(name)
      await status.recheck()
    } catch (e) {
      alert(`Delete failed: ${e.message}`)
    } finally {
      setBusyModel(null)
    }
  }

  const handlePull = async () => {
    const name = pullName.trim()
    if (!name || pulling) return
    setPulling(true)
    setPullError(null)
    try {
      await pullOllamaModel(name, () => {})
      await status.recheck()
      setPullName('')
    } catch (e) {
      setPullError(e.message)
    } finally {
      setPulling(false)
    }
  }

  if (!status.running) {
    return <OllamaInstallWizard specs={specs} onRecheck={status.recheck} checking={status.checking} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
      {/* Ollama status line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: '#4ade80',
        }} />
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)',
        }}>
          Ollama{status.version ? ` v${status.version}` : ''}
          {' · '}{status.models.length} model{status.models.length !== 1 ? 's' : ''} installed
        </span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)',
        }}>
          · Detected: ~{specs.estimatedRamGB} GB RAM
          {specs.isAppleSilicon ? ' · Apple Silicon' : specs.isNvidiaGPU ? ' · NVIDIA GPU' : ''}
        </span>
      </div>

      {/* Installed models */}
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
        }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-dim)',
          }}>
            Installed models
          </span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-dim)',
          }}>
            {modelsWithFit.length}
          </span>
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'start',
        }}>
          {modelsWithFit.map((m) => (
            <OllamaModelCard
              key={m.id}
              model={m}
              selected={m.id === ollamaModelId}
              recommended={m.id === recommendedId}
              busy={busyModel === m.id}
              onClick={() => onSelect(m.id)}
              onDelete={() => handleDelete(m.id)}
            />
          ))}
        </div>
        {modelsWithFit.length === 0 && (
          <div style={{
            padding: 18, textAlign: 'center', borderRadius: 8,
            background: 'var(--bg-2)', border: '1px dashed var(--border)',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-muted)',
          }}>
            No models installed. Pull one below or run{' '}
            <code style={{ color: '#e2e4f0' }}>ollama pull qwen2.5:3b</code> in a terminal.
          </div>
        )}
      </div>

      {/* Pull model row */}
      <div style={{
        borderTop: '1px solid var(--border)', paddingTop: 12,
        display: 'flex', gap: 8, alignItems: 'center',
        background: 'var(--bg)', borderRadius: 0,
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-dim)',
          flexShrink: 0,
        }}>
          ollama pull
        </span>
        <input
          value={pullName}
          onChange={(e) => setPullName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handlePull() }}
          placeholder="model:tag"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
            color: 'var(--text)',
          }}
        />
        <button
          onClick={handlePull}
          disabled={!pullName.trim() || pulling}
          style={{
            padding: '4px 12px', borderRadius: 4, cursor: pulling ? 'wait' : 'pointer',
            border: '1px solid var(--border-bright)', color: 'var(--text-muted)',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
            background: 'transparent', display: 'inline-flex', alignItems: 'center', gap: 4,
            opacity: !pullName.trim() && !pulling ? 0.4 : 1,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { if (!pulling) e.currentTarget.style.color = '#e2e4f0' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          {pulling && <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />}
          {pulling ? 'Pulling…' : 'Pull'}
        </button>
      </div>
      {pullError && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#b08080',
        }}>
          {pullError}
        </div>
      )}

      <OllamaHostRow onCommit={status.recheck} />
    </div>
  )
}

// ─── OLLAMA MODEL CARD ──────────────────────────────────────────

function OllamaModelCard({ model, selected, recommended, busy, onClick, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const tooLarge = model.fit === 'too-large'

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', borderRadius: 8, padding: '14px 16px', cursor: 'pointer',
        background: selected || hovered ? 'var(--surface)' : 'var(--bg-2)',
        border: '1px solid',
        borderColor: selected ? '#94a5ba' : hovered ? 'var(--border-bright)' : 'var(--border)',
        opacity: tooLarge ? 0.65 : 1,
        transition: 'all 0.15s',
      }}
    >
      {/* Selected checkmark */}
      {selected && (
        <span style={{
          position: 'absolute', top: 10, right: 12,
          fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: '#94a5ba',
        }}>
          ✓
        </span>
      )}

      {/* Model name */}
      <div style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 400,
        color: '#e2e4f0', paddingRight: selected ? 20 : 0, marginBottom: 4,
      }}>
        {model.name}
      </div>

      {/* Detail row */}
      <div style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)',
        marginBottom: (model.fit !== 'fits' || recommended) ? 4 : 0,
      }}>
        {model.sizeGB} GB · {model.contextK}K context
        {model.parameterSize ? ` · ${model.parameterSize}` : ''}
      </div>

      {/* Fit warning — plain English, no badge */}
      {model.fit === 'tight' && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
          color: 'var(--text-dim)', fontStyle: 'italic',
          marginBottom: recommended ? 4 : 0,
        }}>
          May be slow — close other apps for best performance
        </div>
      )}
      {tooLarge && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
          color: 'var(--text-dim)', fontStyle: 'italic',
          display: 'flex', alignItems: 'center', gap: 4,
          marginBottom: recommended ? 4 : 0,
        }}>
          <AlertTriangle size={10} />
          Requires more RAM than available
        </div>
      )}

      {/* Recommended note — plain italic text, no card */}
      {recommended && !tooLarge && (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
          color: 'var(--text-dim)', fontStyle: 'italic',
        }}>
          Recommended
        </div>
      )}

      {/* Delete — shows only on hover */}
      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          disabled={busy}
          style={{
            position: 'absolute', bottom: 10, right: 10,
            background: 'transparent', border: 'none', cursor: busy ? 'wait' : 'pointer',
            color: 'var(--text-dim)', padding: 2, display: 'flex', alignItems: 'center',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  )
}

// ─── OLLAMA INSTALL WIZARD ──────────────────────────────────────

const INSTALL_CATALOG = [
  { name: 'llama3.2:3b',      sizeGB: 2.0,  label: 'Llama 3.2 3B',      tag: 'fast',      desc: 'Fastest response. Good for quick Q&A and prototyping.' },
  { name: 'qwen2.5:3b',       sizeGB: 2.0,  label: 'Qwen 2.5 3B',       tag: 'fast',      desc: 'Compact but sharp. Solid at math and structured output.' },
  { name: 'phi3.5:3.8b',      sizeGB: 2.2,  label: 'Phi 3.5 3.8B',      tag: 'fast',      desc: "Microsoft's efficient small model, great reasoning-per-watt." },
  { name: 'qwen2.5:7b',       sizeGB: 4.7,  label: 'Qwen 2.5 7B',       tag: 'balanced',  desc: 'Best general engineering model — fast and smart.' },
  { name: 'qwen2.5-coder:7b', sizeGB: 4.7,  label: 'Qwen 2.5 Coder 7B', tag: 'code',      desc: 'Trained on code. Best for firmware review and debugging.' },
  { name: 'deepseek-r1:7b',   sizeGB: 4.7,  label: 'DeepSeek R1 7B',    tag: 'reasoning', desc: 'Chain-of-thought. Great for circuit analysis and formulas.' },
  { name: 'qwen2.5:14b',      sizeGB: 9.0,  label: 'Qwen 2.5 14B',      tag: 'balanced',  desc: 'Noticeably smarter than 7B. Worth it if you have the RAM.' },
  { name: 'qwen2.5:32b',      sizeGB: 19.0, label: 'Qwen 2.5 32B',      tag: 'flagship',  desc: 'Near-cloud quality. Needs a powerful machine.' },
  { name: 'deepseek-r1:32b',  sizeGB: 19.0, label: 'DeepSeek R1 32B',   tag: 'reasoning', desc: 'Best local reasoning model. Needs 28 GB+ RAM.' },
]

function StepHeader({ n, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <span style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
        background: 'var(--surface-2)', border: '1px solid var(--border-bright)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)',
      }}>
        {n}
      </span>
      <span style={{
        fontSize: 13, fontWeight: 400, color: '#e2e4f0',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {text}
      </span>
    </div>
  )
}

function OllamaInstallWizard({ specs, onRecheck, checking }) {
  const [copied, setCopied] = useState(null)

  const modelsWithFit = useMemo(
    () => INSTALL_CATALOG.map((m) => ({
      ...m,
      fit: modelFitsInRAM(m.sizeGB, specs.estimatedRamGB),
    })),
    [specs.estimatedRamGB],
  )

  const fitsModels = modelsWithFit.filter((m) => m.fit !== 'too-large')
  const tooLargeModels = modelsWithFit.filter((m) => m.fit === 'too-large')

  const copyCmd = (name) => {
    navigator.clipboard.writeText(`ollama pull ${name}`).catch(() => {})
    setCopied(name)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 24 }}>

      {/* Status line — not running */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border-bright)', flexShrink: 0 }} />
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)' }}>
          Ollama not detected
        </span>
        <a
          href="https://ollama.com/download"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
            color: '#94a5ba', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}
        >
          Install guide <ExternalLink size={9} />
        </a>
      </div>

      {/* Device spec line */}
      <div style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)',
      }}>
        Detected: ~{specs.estimatedRamGB} GB RAM
        {specs.isAppleSilicon ? ' · Apple Silicon' : specs.isNvidiaGPU ? ' · NVIDIA GPU' : ''}
      </div>

      {/* Ollama may be running somewhere other than localhost — let the user
          point at it before walking through an install they don't need. */}
      <OllamaHostRow onCommit={onRecheck} />

      {/* Step 1 */}
      <div>
        <StepHeader n={1} text="Download & install Ollama" />
        <a
          href="https://ollama.com/download"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px',
            background: 'var(--surface-2)', color: '#e2e4f0',
            border: '1px solid var(--border-bright)',
            borderRadius: 6, textDecoration: 'none',
            fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <Download size={12} /> Download Ollama <ExternalLink size={10} />
        </a>
        <div style={{
          marginTop: 6, fontSize: 10, color: 'var(--text-dim)',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          ollama.com/download · macOS, Windows, Linux
        </div>
      </div>

      {/* Step 2 */}
      <div>
        <StepHeader n={2} text={`Pull a model (~${specs.estimatedRamGB} GB RAM detected)`} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {fitsModels.map((m) => (
            <div key={m.name} style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'var(--bg-2)',
              border: `1px solid ${m.fit === 'tight' ? 'var(--border-bright)' : 'var(--border)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#e2e4f0',
                }}>
                  {m.label}
                </span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                  color: 'var(--text-muted)', marginLeft: 'auto',
                }}>
                  {m.sizeGB} GB
                  {m.fit === 'tight' && <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}> · may be slow</span>}
                </span>
              </div>
              <div style={{
                fontSize: 11, color: 'var(--text-muted)',
                fontFamily: "'JetBrains Mono', monospace", marginBottom: 7,
              }}>
                {m.desc}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <code style={{
                  flex: 1, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                  color: 'var(--text-muted)', background: 'var(--surface)',
                  padding: '4px 9px', borderRadius: 4,
                }}>
                  ollama pull {m.name}
                </code>
                <button
                  onClick={() => copyCmd(m.name)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                    fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                    background: 'transparent',
                    border: `1px solid ${copied === m.name ? 'var(--border-bright)' : 'var(--border)'}`,
                    color: copied === m.name ? '#e2e4f0' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  {copied === m.name ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                </button>
              </div>
            </div>
          ))}
        </div>

        {tooLargeModels.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{
              fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--text-dim)', marginBottom: 6,
            }}>
              Requires more RAM than detected on your machine
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, opacity: 0.5 }}>
              {tooLargeModels.map((m) => (
                <div key={m.name} style={{
                  padding: '8px 14px', borderRadius: 6,
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-muted)',
                  }}>
                    {m.label}
                  </span>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)',
                    marginLeft: 'auto',
                  }}>
                    {m.sizeGB} GB · needs ~{Math.ceil(m.sizeGB * 1.3 + 4)} GB RAM
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Step 3 */}
      <div>
        <StepHeader n={3} text="Come back here once Ollama is running" />
        <button
          onClick={onRecheck}
          disabled={checking}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 6, cursor: checking ? 'wait' : 'pointer',
            fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
            background: 'transparent', color: checking ? 'var(--text-dim)' : '#e2e4f0',
            border: '1px solid var(--border-bright)', transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { if (!checking) e.currentTarget.style.borderColor = '#94a5ba' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-bright)' }}
        >
          <RefreshCw size={12} style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }} />
          {checking ? 'Checking…' : 'Check Again'}
        </button>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}

export default AISettings
