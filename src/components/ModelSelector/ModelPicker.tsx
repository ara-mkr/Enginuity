import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, Settings2 } from 'lucide-react'
import {
  useModelRegistry,
  REGISTRY,
  type RegistryModel,
} from '../../context/ModelRegistryContext'
import { TierBadge } from './APIKeyModal'

export function ModelPicker() {
  const {
    activeProviderId,
    activeModelId,
    connectedProviderIds,
    setActive,
    openGrid,
  } = useModelRegistry()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Focus search when opening
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30)
    else setQuery('')
  }, [open])

  const activeProvider = activeProviderId ? REGISTRY[activeProviderId] : null
  const activeModel = activeProvider?.models.find((m) => m.id === activeModelId)

  const lq = query.toLowerCase()

  // Filtered connected providers + their matching models
  const sections = connectedProviderIds
    .map((pid) => {
      const provider = REGISTRY[pid]
      const models = provider.models.filter(
        (m) => !lq || m.name.toLowerCase().includes(lq) || m.tier.includes(lq)
      )
      return { pid, provider, models }
    })
    .filter((s) => s.models.length > 0)

  const handleSelect = (pid: string, model: RegistryModel) => {
    setActive(pid, model.id)
    setOpen(false)
  }

  // No providers connected yet
  if (connectedProviderIds.length === 0) {
    return (
      <button
        onClick={openGrid}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all"
        style={{
          borderColor: 'var(--border-bright)',
          background: 'var(--surface-2)',
          color: 'var(--accent)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--accent-glow)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--surface-2)'
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--text-dim)' }} />
        Connect a provider
      </button>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all"
        style={{
          borderColor: open ? 'var(--accent)' : 'var(--border-bright)',
          background: open ? 'var(--accent-glow)' : 'var(--surface-2)',
        }}
      >
        {/* Provider dot */}
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            background: activeProvider?.color ?? '#7aaa8a',
            boxShadow: `0 0 5px ${activeProvider?.color ?? '#7aaa8a'}80`,
          }}
        />

        {/* Model name */}
        <span
          className="flex-1 truncate text-left"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: activeModel ? 'var(--text)' : 'var(--text-muted)',
          }}
        >
          {activeModel?.name ?? 'Select model'}
        </span>

        {/* Tier badge */}
        {activeModel && <TierBadge tier={activeModel.tier} />}

        <ChevronDown
          size={11}
          style={{
            color: 'var(--text-dim)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 150ms',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute left-0 right-0 bottom-full mb-1.5 rounded-xl border shadow-2xl overflow-hidden z-50"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border-bright)',
            maxHeight: 360,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Search */}
          <div
            className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0"
            style={{ borderColor: 'var(--border)' }}
          >
            <Search size={12} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models…"
              className="flex-1 bg-transparent outline-none"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                color: 'var(--text)',
              }}
            />
          </div>

          {/* Model list */}
          <div className="overflow-y-auto flex-1">
            {sections.length === 0 ? (
              <div
                className="px-4 py-6 text-center"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-dim)' }}
              >
                No models match "{query}"
              </div>
            ) : (
              sections.map(({ pid, provider, models }) => (
                <div key={pid}>
                  {/* Provider header */}
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 sticky top-0"
                    style={{ background: 'var(--bg-2)' }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: provider.color }}
                    />
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9,
                        
                        
                        color: provider.color,
                      }}
                    >
                      {provider.name}
                    </span>
                  </div>

                  {/* Models */}
                  {models.map((model) => {
                    const isActive = pid === activeProviderId && model.id === activeModelId
                    return (
                      <button
                        key={model.id}
                        onClick={() => handleSelect(pid, model)}
                        className="w-full flex items-center justify-between px-3 py-2.5 transition-all"
                        style={{
                          background: isActive ? 'var(--accent-glow)' : 'transparent',
                          borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'var(--surface-2)'
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 12,
                            color: isActive ? 'var(--accent)' : 'var(--text)',
                          }}
                        >
                          {model.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <TierBadge tier={model.tier} />
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 10,
                              color: 'var(--text-dim)',
                            }}
                          >
                            {model.context}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            className="px-3 py-2 border-t shrink-0 flex items-center justify-between"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}
          >
            <span
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)' }}
            >
              {connectedProviderIds.length} provider{connectedProviderIds.length !== 1 ? 's' : ''} connected
            </span>
            <button
              onClick={() => { setOpen(false); openGrid() }}
              className="flex items-center gap-1 transition-colors"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <Settings2 size={10} />
              Manage Keys
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
