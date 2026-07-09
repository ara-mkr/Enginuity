import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Monitor, Search, Star } from 'lucide-react'
import { useOpenRouter } from '../../context/OpenRouterContext'
import { TIER_COLORS } from '../../config/openrouterModels'
import {
  fetchOllamaModels,
  formatOllamaModelName,
  getOllamaTokenRate,
  OLLAMA_METRICS_EVENT,
} from '../../config/ollama'

function TierBadge({ tier }) {
  const color = TIER_COLORS[tier] ?? '#78909c'
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace", fontSize: 9, 
       padding: '1px 6px', borderRadius: 4,
      background: `${color}18`, color, border: `1px solid ${color}30`,
      flexShrink: 0,
    }}>
      {tier}
    </span>
  )
}

export function ModelPicker({ moduleKey = null }) {
  const {
    apiKey, activeModelId, setModelId, models, isConnected, openSetup,
    activeProvider, setActiveProvider, ollamaModelId, setOllamaModelId,
  } = useOpenRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState(null)
  // null = not checked yet; { available, models } after the on-demand fetch.
  // Checked when the dropdown opens — the sidebar never polls in the background.
  const [localOllama, setLocalOllama] = useState(null)
  const containerRef = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30)
    else setQuery('')
  }, [open])

  // Refresh the installed local models each time the dropdown opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetchOllamaModels().then((result) => {
      if (!cancelled) setLocalOllama(result)
    })
    return () => { cancelled = true }
  }, [open])

  // Live generation speed for the active local model — updates the moment a
  // chat completes anywhere in the app (callOllama broadcasts its metrics).
  const [tokRate, setTokRate] = useState(() => (ollamaModelId ? getOllamaTokenRate(ollamaModelId) : null))
  useEffect(() => {
    setTokRate(ollamaModelId ? getOllamaTokenRate(ollamaModelId) : null)
    const handler = (e) => {
      if (e.detail?.model === ollamaModelId) setTokRate(e.detail)
    }
    window.addEventListener(OLLAMA_METRICS_EVENT, handler)
    return () => window.removeEventListener(OLLAMA_METRICS_EVENT, handler)
  }, [ollamaModelId])

  const activeModel = models.find((m) => m.id === activeModelId)
  const usingLocal = activeProvider === 'ollama' || activeProvider === 'both'

  const handleSelect = (model) => {
    setModelId(model.id)
    // Picking a cloud model routes to OpenRouter unless hybrid keeps both.
    if (activeProvider === 'ollama') setActiveProvider('openrouter')
    setOpen(false)
    setToast(`Switched to ${model.name}`)
    setTimeout(() => setToast(null), 2500)
  }

  const handleSelectLocal = (model) => {
    setOllamaModelId(model.id)
    // Picking a local model routes to Ollama; hybrid mode stays hybrid.
    if (activeProvider !== 'both') setActiveProvider('ollama')
    setOpen(false)
    setToast(`Switched to ${model.name} (local · free)`)
    setTimeout(() => setToast(null), 2500)
  }

  const lq = query.toLowerCase()

  // Group by provider
  const providers = [...new Set(models.map((m) => m.provider))]

  // Recommended for this module
  const recommendedIds = moduleKey
    ? (models.filter((m) => m.recommended).map((m) => m.id)).slice(0, 3)
    : []

  if (!isConnected) {
    return null
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--surface)', border: '1px solid var(--border-bright)',
          borderRadius: 10, padding: '8px 18px', zIndex: 9999,
          fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', gap: 8,
          pointerEvents: 'none',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: activeModel?.providerColor ?? 'var(--accent)', display: 'inline-block' }} />
          {toast}
        </div>
      )}

      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '5px 12px', borderRadius: 8,
          background: open ? 'var(--accent-glow)' : 'var(--surface-2)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border-bright)'}`,
          cursor: 'pointer', minWidth: 0, maxWidth: 240,
          transition: 'all 0.15s',
        }}
      >
        {usingLocal && ollamaModelId ? (
          <>
            <Monitor size={11} style={{ color: '#7aaa8a', flexShrink: 0 }} />
            <span
              title={activeProvider === 'both' ? `Hybrid mode — local first, ${activeModel?.name ?? 'cloud'} fallback` : 'Running locally via Ollama'}
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
            >
              {formatOllamaModelName(ollamaModelId)}
            </span>
            <span style={{ fontSize: 9, color: '#7aaa8a', background: 'rgba(34,197,94,0.12)', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>
              FREE
            </span>
            {tokRate && (
              <span
                title={`Last generation: ${tokRate.evalCount} tokens at ${tokRate.tokensPerSecond.toFixed(1)} tok/s`}
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--text-dim)', flexShrink: 0 }}
              >
                {Math.round(tokRate.tokensPerSecond)} t/s
              </span>
            )}
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7aaa8a', flexShrink: 0 }} />
          </>
        ) : (
          <>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: activeModel?.providerColor ?? 'var(--accent)', flexShrink: 0 }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {activeModel?.name ?? activeModelId}
            </span>
            {activeModel && <TierBadge tier={activeModel.tier} />}
            <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>
              {activeModel ? `${activeModel.contextK}K` : ''}
            </span>
          </>
        )}
        <ChevronDown size={11} style={{ color: 'var(--text-dim)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          width: 360, maxHeight: 440,
          background: 'var(--surface)', border: '1px solid var(--border-bright)',
          borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          zIndex: 1000, display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Search */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <Search size={12} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models..."
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text)',
              }}
            />
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {/* Local (Ollama) models — listed first when the daemon is running */}
            {localOllama?.available && (
              <div>
                <div style={{ padding: '8px 12px 4px', position: 'sticky', top: 0, background: 'var(--bg-2)', display: 'flex', alignItems: 'center', gap: 6, zIndex: 1 }}>
                  <Monitor size={10} style={{ color: '#7aaa8a' }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#7aaa8a' }}>Local · Ollama</span>
                </div>
                {localOllama.models
                  .filter((m) => !lq || m.name.toLowerCase().includes(lq) || m.tier.includes(lq) || 'ollama local free'.includes(lq))
                  .map((model) => (
                    <ModelRow
                      key={model.id}
                      model={model}
                      active={usingLocal && model.id === ollamaModelId}
                      onSelect={handleSelectLocal}
                    />
                  ))}
                <div style={{ margin: '4px 12px', borderBottom: '1px solid var(--border)' }} />
              </div>
            )}
            {!query && localOllama && !localOllama.available && (
              <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--border)' }}>
                <Monitor size={10} style={{ color: 'var(--text-dim)' }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)' }}>
                  Ollama not detected — start it to run models locally, free
                </span>
              </div>
            )}

            {/* Recommended section */}
            {!query && recommendedIds.length > 0 && (
              <div>
                <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Star size={10} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--accent)',   }}>Recommended</span>
                </div>
                {models.filter((m) => recommendedIds.includes(m.id)).map((model) => (
                  <ModelRow key={model.id} model={model} active={model.id === activeModelId} onSelect={handleSelect} />
                ))}
                <div style={{ margin: '4px 12px', borderBottom: '1px solid var(--border)' }} />
              </div>
            )}

            {/* All providers */}
            {providers.map((provider) => {
              const providerModels = models.filter(
                (m) => m.provider === provider && (!lq || m.name.toLowerCase().includes(lq) || m.tier.includes(lq) || m.provider.toLowerCase().includes(lq) || m.tags.some((t) => t.includes(lq)))
              )
              if (!providerModels.length) return null
              const providerColor = providerModels[0].providerColor
              return (
                <div key={provider}>
                  <div style={{ padding: '8px 12px 4px', position: 'sticky', top: 0, background: 'var(--bg-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: providerColor, display: 'inline-block' }} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: providerColor,   }}>{provider}</span>
                  </div>
                  {providerModels.map((model) => (
                    <ModelRow key={model.id} model={model} active={model.id === activeModelId} onSelect={handleSelect} />
                  ))}
                </div>
              )
            })}

            {lq && !models.some((m) => m.name.toLowerCase().includes(lq) || m.provider.toLowerCase().includes(lq)) && (
              <div style={{ padding: '24px', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-dim)' }}>
                No models match "{query}"
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '8px 12px', borderTop: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'var(--bg-2)', flexShrink: 0,
          }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)' }}>
              {models.length} models via OpenRouter
            </span>
            <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)', textDecoration: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
              Browse all →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function ModelRow({ model, active, onSelect }) {
  const [hovered, setHovered] = useState(false)
  const estCostPer1k = ((model.inputPricePer1M * 0.3 + model.outputPricePer1M * 0.7) / 1000).toFixed(4)
  // Local models: show the last measured generation speed beside the size.
  const localRate = model.local ? getOllamaTokenRate(model.id) : null

  return (
    <button
      onClick={() => onSelect(model)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 12px', border: 'none', cursor: 'pointer',
        background: active ? 'var(--accent-glow)' : hovered ? 'var(--surface-2)' : 'transparent',
        borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
        gap: 8, textAlign: 'left',
      }}
    >
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: active ? 'var(--accent)' : 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {model.name}
        {model.free && <span style={{ marginLeft: 6, fontSize: 9, color: '#7aaa8a', background: 'rgba(34,197,94,0.12)', padding: '1px 5px', borderRadius: 3 }}>FREE</span>}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <TierBadge tier={model.tier} />
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)', minWidth: 36, textAlign: 'right' }}>
          {model.contextK}K
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--accent)', minWidth: 50, textAlign: 'right' }}>
          {model.local ? `${model.sizeGB}GB` : `$${estCostPer1k}/1K`}
        </span>
        {localRate && (
          <span
            title={`Last generation: ${localRate.evalCount} tokens at ${localRate.tokensPerSecond.toFixed(1)} tok/s`}
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--text-dim)', flexShrink: 0 }}
          >
            {Math.round(localRate.tokensPerSecond)} t/s
          </span>
        )}
      </div>
    </button>
  )
}

export default ModelPicker
