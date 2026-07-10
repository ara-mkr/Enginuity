import React, { createContext, useContext, useState, useEffect, useRef } from 'react'

interface FocusModeContextType {
  isFocusMode: boolean
  leftSidebarRevealed: boolean
  rightSidebarRevealed: boolean
  toggleFocusMode: () => void
  exitFocusMode: () => void
  setLeftSidebarRevealed: (v: boolean) => void
  setRightSidebarRevealed: (v: boolean) => void
}

const FocusModeContext = createContext<FocusModeContextType | null>(null)

export function FocusModeProvider({ children }: { children: React.ReactNode }) {
  const [isFocusMode, setIsFocusMode] = useState(() => {
    try {
      return localStorage.getItem('enginguity_focus_mode') === 'true'
    } catch {
      return false
    }
  })

  const [leftSidebarRevealed, setLeftSidebarRevealed] = useState(false)
  const [rightSidebarRevealed, setRightSidebarRevealed] = useState(false)

  const leftEnterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leftLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rightEnterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rightLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleFocusMode = () => {
    setIsFocusMode((prev) => {
      const next = !prev
      try {
        localStorage.setItem('enginguity_focus_mode', String(next))
      } catch { /* storage unavailable (private mode/quota) — safe to skip */ }
      return next
    })
  }

  const exitFocusMode = () => {
    setIsFocusMode(false)
    try {
      localStorage.setItem('enginguity_focus_mode', 'false')
    } catch { /* storage unavailable (private mode/quota) — safe to skip */ }
  }

  // Listen to external toggle events (e.g. from Command Palette)
  useEffect(() => {
    const handleToggleEvent = () => toggleFocusMode();
    window.addEventListener('enginguity_toggle_focus_mode', handleToggleEvent);
    return () => window.removeEventListener('enginguity_toggle_focus_mode', handleToggleEvent);
  }, []);

  // Sync class on body
  useEffect(() => {
    if (isFocusMode) {
      document.body.classList.add('focus-mode')
    } else {
      document.body.classList.remove('focus-mode')
      // Reset revealed states when leaving focus mode
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting reveal state as a side effect of exiting focus mode
      setLeftSidebarRevealed(false)
      setRightSidebarRevealed(false)
    }
  }, [isFocusMode])

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isFKey = e.key === 'F11'
      const isCmdShiftF = (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f'

      if (isCmdShiftF || isFKey) {
        e.preventDefault()
        toggleFocusMode()
      } else if (e.key === 'Escape' && isFocusMode) {
        // Only trigger Escape exit if user is not focused on an input/textarea
        if (
          document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement
        ) {
          return
        }
        exitFocusMode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFocusMode])

  // Mouse movement edge reveal listeners
  useEffect(() => {
    if (!isFocusMode) {
      // Clear any remaining timers
      if (leftEnterTimer.current) clearTimeout(leftEnterTimer.current)
      if (leftLeaveTimer.current) clearTimeout(leftLeaveTimer.current)
      if (rightEnterTimer.current) clearTimeout(rightEnterTimer.current)
      if (rightLeaveTimer.current) clearTimeout(rightLeaveTimer.current)
      leftEnterTimer.current = null
      leftLeaveTimer.current = null
      rightEnterTimer.current = null
      rightLeaveTimer.current = null
      return
    }

    const handleMouseMove = (e: MouseEvent) => {
      const { clientX } = e
      const width = window.innerWidth

      // Left edge reveal (Sidebar: 220px width)
      if (clientX <= 8) {
        // Mouse is on the left edge
        if (leftLeaveTimer.current) {
          clearTimeout(leftLeaveTimer.current)
          leftLeaveTimer.current = null
        }
        if (!leftSidebarRevealed && !leftEnterTimer.current) {
          leftEnterTimer.current = setTimeout(() => {
            setLeftSidebarRevealed(true)
            leftEnterTimer.current = null
          }, 1000) // 1 second edge delay
        }
      } else if (clientX <= 220) {
        // Mouse is inside the revealed sidebar
        if (leftLeaveTimer.current) {
          clearTimeout(leftLeaveTimer.current)
          leftLeaveTimer.current = null
        }
        if (leftEnterTimer.current) {
          clearTimeout(leftEnterTimer.current)
          leftEnterTimer.current = null
        }
      } else {
        // Mouse has left the sidebar area
        if (leftEnterTimer.current) {
          clearTimeout(leftEnterTimer.current)
          leftEnterTimer.current = null
        }
        if (leftSidebarRevealed && !leftLeaveTimer.current) {
          leftLeaveTimer.current = setTimeout(() => {
            setLeftSidebarRevealed(false)
            leftLeaveTimer.current = null
          }, 1500) // 1.5 seconds auto-hide delay
        }
      }

      // Right edge reveal (Copilot: 280px width)
      if (clientX >= width - 8) {
        // Mouse is on the right edge
        if (rightLeaveTimer.current) {
          clearTimeout(rightLeaveTimer.current)
          rightLeaveTimer.current = null
        }
        if (!rightSidebarRevealed && !rightEnterTimer.current) {
          rightEnterTimer.current = setTimeout(() => {
            setRightSidebarRevealed(true)
            rightEnterTimer.current = null
          }, 1000) // 1 second edge delay
        }
      } else if (clientX >= width - 280) {
        // Mouse is inside the revealed copilot panel
        if (rightLeaveTimer.current) {
          clearTimeout(rightLeaveTimer.current)
          rightLeaveTimer.current = null
        }
        if (rightEnterTimer.current) {
          clearTimeout(rightEnterTimer.current)
          rightEnterTimer.current = null
        }
      } else {
        // Mouse has left the copilot area
        if (rightEnterTimer.current) {
          clearTimeout(rightEnterTimer.current)
          rightEnterTimer.current = null
        }
        if (rightSidebarRevealed && !rightLeaveTimer.current) {
          rightLeaveTimer.current = setTimeout(() => {
            setRightSidebarRevealed(false)
            rightLeaveTimer.current = null
          }, 1500) // 1.5 seconds auto-hide delay
        }
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (leftEnterTimer.current) clearTimeout(leftEnterTimer.current)
      if (leftLeaveTimer.current) clearTimeout(leftLeaveTimer.current)
      if (rightEnterTimer.current) clearTimeout(rightEnterTimer.current)
      if (rightLeaveTimer.current) clearTimeout(rightLeaveTimer.current)
    }
  }, [isFocusMode, leftSidebarRevealed, rightSidebarRevealed])

  return (
    <FocusModeContext.Provider
      value={{
        isFocusMode,
        leftSidebarRevealed,
        rightSidebarRevealed,
        toggleFocusMode,
        exitFocusMode,
        setLeftSidebarRevealed,
        setRightSidebarRevealed,
      }}
    >
      {children}
    </FocusModeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook is tightly coupled to this provider's context instance
export function useFocusMode() {
  const ctx = useContext(FocusModeContext)
  if (!ctx) throw new Error('useFocusMode must be used within FocusModeProvider')
  return ctx
}
