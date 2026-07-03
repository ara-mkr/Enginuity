import { useState, useEffect } from 'react'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isChecking, setIsChecking] = useState(false)
  const [lastChecked, setLastChecked] = useState(Date.now())
  const [wasOffline, setWasOffline] = useState(false)

  const checkConnectivity = async () => {
    setIsChecking(true)
    try {
      const response = await fetch('https://www.gstatic.com/generate_204?t=' + Date.now(), {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store'
      })
      // If fetch succeeds or returns opaque response (no-cors), we are online
      setIsOnline(true)
    } catch (e) {
      setIsOnline(false)
      setWasOffline(true)
    } finally {
      setIsChecking(false)
      setLastChecked(Date.now())
    }
  }

  useEffect(() => {
    const handleOnline = () => {
      checkConnectivity()
    }

    const handleOffline = () => {
      setIsOnline(false)
      setWasOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial check
    checkConnectivity()

    // 30 second heartbeat loop
    const interval = setInterval(checkConnectivity, 30000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  return { isOnline, isChecking, lastChecked, wasOffline }
}
