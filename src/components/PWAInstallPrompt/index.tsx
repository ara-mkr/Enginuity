import { useState, useEffect } from 'react'

export function PWAInstallPrompt() {
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isiOS, setIsiOS] = useState(false)
  const [showiOSPrompt, setShowiOSPrompt] = useState(false)
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false)

  useEffect(() => {
    // 1. Listen for Service Worker update prompts
    const handleUpdateFound = () => {
      setShowUpdatePrompt(true)
    }
    window.addEventListener('sw-update-available', handleUpdateFound)

    // 2. Track visit count for iOS prompt
    let visits = parseInt(localStorage.getItem('enginguity_visit_count') || '0')
    visits += 1
    localStorage.setItem('enginguity_visit_count', String(visits))

    // 3. Detect iOS platform
    const ua = window.navigator.userAgent
    const isAppleMobile = /iPhone|iPad|iPod/.test(ua) && !(window as any).MSStream
    const isStandalone = (window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches

    setIsiOS(isAppleMobile)

    // 4. Handle Standard PWA install prompts
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault()
      // Store event
      setInstallPromptEvent(e)

      // Check if dismissed recently (within 7 days)
      const dismissedTime = localStorage.getItem('enginguity_install_dismissed')
      if (dismissedTime) {
        const diff = Date.now() - parseInt(dismissedTime)
        if (diff < 7 * 24 * 60 * 60 * 1000) {
          return
        }
      }

      if (!isStandalone) {
        setShowPrompt(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleInstallPrompt)

    // 5. Show iOS instructions if visited 3+ times, on iOS, and not already standalone
    const dismissediOS = localStorage.getItem('enginguity_ios_prompt_dismissed') === 'true'
    if (isAppleMobile && !isStandalone && visits >= 3 && !dismissediOS) {
      setShowiOSPrompt(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
      window.removeEventListener('sw-update-available', handleUpdateFound)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!installPromptEvent) return
    setShowPrompt(false)
    installPromptEvent.prompt()
    const choiceResult = await installPromptEvent.userChoice
    if (choiceResult.outcome === 'accepted') {
    } else {
    }
    setInstallPromptEvent(null)
  }

  const handleDismissInstall = () => {
    setShowPrompt(false)
    localStorage.setItem('enginguity_install_dismissed', String(Date.now()))
  }

  const handleDismissiOS = () => {
    setShowiOSPrompt(false)
    localStorage.setItem('enginguity_ios_prompt_dismissed', 'true')
  }

  const handleReloadToUpdate = () => {
    window.location.reload()
  }

  // 1. Update Notification Banner
  if (showUpdatePrompt) {
    return (
      <div style={bannerStyle}>
        <span style={{ fontSize: 13 }}>ENGINGUITY has been updated with a new version.</span>
        <button onClick={handleReloadToUpdate} style={actionButtonStyle}>
          Reload to Update
        </button>
      </div>
    )
  }

  // 2. Standard PWA Install Banner
  if (showPrompt) {
    return (
      <div style={bannerStyle}>
        <span style={{ fontSize: 13 }}>Install ENGINGUITY for offline access and faster loading</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleInstallClick} style={actionButtonStyle}>
            Install
          </button>
          <button onClick={handleDismissInstall} style={cancelButtonStyle}>
            Not now
          </button>
        </div>
      </div>
    )
  }

  // 3. iOS Add to Home Screen Instructions
  if (showiOSPrompt) {
    return (
      <div style={bannerStyle}>
        <span style={{ fontSize: 12, lineHeight: 1.4 }}>
          Add to Home Screen: tap <strong>Share</strong> then <strong>'Add to Home Screen'</strong> for offline access.
        </span>
        <button onClick={handleDismissiOS} style={cancelButtonStyle}>
          Close
        </button>
      </div>
    )
  }

  return null
}

const bannerStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 24,
  left: 24,
  right: 24,
  maxWidth: 480,
  margin: '0 auto',
  background: 'var(--surface)',
  border: '1px solid var(--border-bright)',
  borderLeft: '4px solid var(--accent)',
  borderRadius: 8,
  padding: '12px 18px',
  boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  zIndex: 1050,
  fontFamily: "'JetBrains Mono', monospace",
  color: 'var(--text)'
}

const actionButtonStyle: React.CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--bg)',
  border: 'none',
  padding: '6px 12px',
  borderRadius: 6,
  fontWeight: 600,
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: "'JetBrains Mono', monospace"
}

const cancelButtonStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid var(--border)',
  padding: '6px 12px',
  borderRadius: 6,
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: "'JetBrains Mono', monospace"
}
