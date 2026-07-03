import { useModelRegistry, REGISTRY } from '../../context/ModelRegistryContext'

export function UsageBar() {
  const { activeProviderId, activeModelId, todayUsage } = useModelRegistry()

  const provider = activeProviderId ? REGISTRY[activeProviderId] : null
  const model = provider?.models.find((m) => m.id === activeModelId)
  const usage = activeProviderId ? (todayUsage[activeProviderId] ?? null) : null

  if (!provider || !model) {
    return (
      <div
        className="px-3 py-1.5 flex items-center gap-1.5"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: 'var(--text-dim)',
          
        }}
      >
        <span className="w-1 h-1 rounded-full" style={{ background: 'var(--text-dim)' }} />
        No provider active
      </div>
    )
  }

  const requestCount = usage?.requests ?? 0

  return (
    <div
      className="px-3 py-1.5 flex items-center gap-1.5 overflow-hidden"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        color: 'var(--text-muted)',
        
        whiteSpace: 'nowrap',
      }}
      title={`${provider.name} · ${model.name}${requestCount > 0 ? ` · ${requestCount} req today` : ''}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: '#7aaa8a', boxShadow: '0 0 4px #7aaa8a80' }}
      />

      <span style={{ color: provider.color, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {provider.name}
      </span>

      <span style={{ color: 'var(--text-dim)' }}>·</span>

      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1 }}>
        {model.name}
      </span>

      {requestCount > 0 && (
        <>
          <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>·</span>
          <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
            {requestCount} req
          </span>
        </>
      )}
    </div>
  )
}
