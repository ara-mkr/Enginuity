import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

export function OfflineBanner() {
  const { isOnline, wasOffline } = useOnlineStatus()
  const [visible, setVisible] = useState(false)
  const [status, setStatus] = useState<'offline' | 'reconnected'>('offline')

  useEffect(() => {
    if (!isOnline) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- surfacing banner state as a side effect of connectivity changing
      setStatus('offline')
      setVisible(true)
    } else if (isOnline && wasOffline) {
      setStatus('reconnected')
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
      }, 3000)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [isOnline, wasOffline])

  if (!visible) return null

  const isOfflineMode = status === 'offline'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '8px 16px',
        fontSize: 12,
        fontFamily: "'JetBrains Mono', monospace",
        transition: 'all 0.3s ease-in-out',
        background: isOfflineMode ? 'rgba(255, 171, 64, 0.15)' : 'rgba(0, 230, 118, 0.15)',
        borderBottom: `1px solid ${isOfflineMode ? '#b09470' : '#7aaa8a'}`,
        color: isOfflineMode ? '#b09470' : '#7aaa8a',
        zIndex: 1000,
        boxSizing: 'border-box'
      }}
    >
      {isOfflineMode ? (
        <>
          <WifiOff size={14} style={{  }} />
          <span>You're offline — AI features paused. Tools, notebook, and parameters work normally.</span>
        </>
      ) : (
        <>
          <Wifi size={14} />
          <span>Back online — AI features resumed.</span>
        </>
      )}
    </div>
  )
}
