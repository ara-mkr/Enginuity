import { Star, Zap } from 'lucide-react'
import { useModelRegistry, REGISTRY, PROVIDER_IDS } from '../../context/ModelRegistryContext'
import { TierBadge } from './APIKeyModal'

export function ProviderGrid() {
  const { connectedProviderIds, openKeyModal, closeGrid, setActive } = useModelRegistry()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(8,8,16,0.92)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) closeGrid() }}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border-bright)',
          maxHeight: '88vh',
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div>
            <h2
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text)',
                
                
              }}
            >
              Model Providers
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Connect one key per provider to unlock every model they offer
            </p>
          </div>
          <div className="flex items-center gap-2">
            {connectedProviderIds.length > 0 && (
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: '#7aaa8a',
                  background: 'rgba(34,197,94,0.1)',
                  padding: '2px 8px',
                  borderRadius: 6,
                }}
              >
                {connectedProviderIds.length} connected
              </span>
            )}
          </div>
        </div>

        {/* Grid */}
        <div className="overflow-y-auto p-5 grid grid-cols-2 gap-3">
          {PROVIDER_IDS.map((id) => {
            const provider = REGISTRY[id]
            const isConnected = connectedProviderIds.includes(id)
            const isOpenRouter = id === 'openrouter'
            const uniqueTiers = [...new Set(provider.models.map((m) => m.tier))].slice(0, 4)

            return (
              <div
                key={id}
                className="relative rounded-xl border p-4 flex flex-col gap-3 transition-all cursor-default"
                style={{
                  background: isConnected
                    ? `${provider.color}08`
                    : 'var(--surface-2)',
                  borderColor: isConnected ? `${provider.color}40` : 'var(--border)',
                }}
              >
                {/* OpenRouter star badge */}
                {isOpenRouter && (
                  <div
                    className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{
                      background: 'rgba(100,103,242,0.15)',
                      border: '1px solid rgba(100,103,242,0.3)',
                    }}
                  >
                    <Star size={9} style={{ color: '#8a85b8' }} />
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9,
                        color: '#8a85b8',
                        
                      }}
                    >
                      200+ models
                    </span>
                  </div>
                )}

                {/* Provider identity */}
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                      background: provider.color,
                      boxShadow: isConnected ? `0 0 8px ${provider.color}60` : 'none',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text)',
                    }}
                  >
                    {provider.name}
                  </span>
                </div>

                {/* Model count + tier badges */}
                <div className="flex flex-col gap-1.5">
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      color: isConnected ? '#7aaa8a' : 'var(--text-muted)',
                    }}
                  >
                    {isConnected
                      ? `✓ ${provider.models.length} models unlocked`
                      : `${provider.models.length} models`}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {uniqueTiers.map((tier) => (
                      <TierBadge key={tier} tier={tier} />
                    ))}
                  </div>
                </div>

                {/* OpenRouter tagline */}
                {isOpenRouter && (
                  <p
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      fontFamily: "'JetBrains Mono', monospace",
                      lineHeight: 1.4,
                    }}
                  >
                    Connect once, access 200+ models from every major lab.
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 mt-auto pt-1">
                  {isConnected ? (
                    <>
                      {/* Quick-activate button */}
                      <button
                        onClick={() => {
                          const modelId = provider.models[0].id
                          setActive(id, modelId)
                          closeGrid()
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all border"
                        style={{
                          borderColor: `${provider.color}40`,
                          color: provider.color,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 10,
                          
                          
                          background: `${provider.color}08`,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = `${provider.color}18`
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = `${provider.color}08`
                        }}
                      >
                        <Zap size={10} />
                        Use
                      </button>
                      <button
                        onClick={() => openKeyModal(id)}
                        className="px-3 py-1.5 rounded-lg text-xs border transition-all"
                        style={{
                          borderColor: 'var(--border)',
                          color: 'var(--text-muted)',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 10,
                          
                          
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-bright)'
                          e.currentTarget.style.color = 'var(--text)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border)'
                          e.currentTarget.style.color = 'var(--text-muted)'
                        }}
                      >
                        Edit
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => openKeyModal(id)}
                      className="flex-1 flex items-center justify-center px-3 py-1.5 rounded-lg text-xs transition-all"
                      style={{
                        background: `${provider.color}15`,
                        color: provider.color,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10,
                        fontWeight: 600,
                        
                        
                        border: `1px solid ${provider.color}30`,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `${provider.color}28`
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = `${provider.color}15`
                      }}
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 border-t flex items-center justify-between shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}
        >
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>
            Keys stored locally · never sent to our servers
          </span>
          <button
            onClick={closeGrid}
            className="px-4 py-1.5 rounded-lg text-xs border transition-all"
            style={{
              borderColor: 'var(--border-bright)',
              color: 'var(--text-muted)',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text)'
              e.currentTarget.style.borderColor = 'var(--accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.borderColor = 'var(--border-bright)'
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
