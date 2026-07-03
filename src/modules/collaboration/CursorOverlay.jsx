import { useEffect, useState } from 'react'

const FADE_AFTER_MS = 3000

export default function CursorOverlay({ users, localUserId, sendCursorMove }) {
  const [remoteCursors, setRemoteCursors] = useState({})

  // Track remote cursor fade timers
  useEffect(() => {
    const timers = {}

    const updateCursor = (userId, position, name, color) => {
      clearTimeout(timers[userId])
      setRemoteCursors((prev) => ({
        ...prev,
        [userId]: { x: position.x, y: position.y, name, color, visible: true },
      }))
      timers[userId] = setTimeout(() => {
        setRemoteCursors((prev) => ({
          ...prev,
          [userId]: prev[userId] ? { ...prev[userId], visible: false } : prev[userId],
        }))
      }, FADE_AFTER_MS)
    }

    // Sync from users prop (cursor field)
    users.forEach((u) => {
      if (u.id !== localUserId && u.cursor) {
        updateCursor(u.id, u.cursor, u.name, u.color)
      }
    })

    return () => {
      Object.values(timers).forEach(clearTimeout)
    }
  }, [users, localUserId])

  // Send local cursor moves
  useEffect(() => {
    let lastSent = 0
    const THROTTLE = Math.floor(1000 / 30)

    const onMove = (e) => {
      const now = Date.now()
      if (now - lastSent < THROTTLE) return
      lastSent = now
      sendCursorMove({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      })
    }

    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [sendCursorMove])

  const cursors = Object.entries(remoteCursors)

  if (cursors.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 99999,
        overflow: 'hidden',
      }}
    >
      {cursors.map(([userId, cursor]) => {
        if (!cursor.visible) return null
        const px = cursor.x * window.innerWidth
        const py = cursor.y * window.innerHeight
        return (
          <div
            key={userId}
            style={{
              position: 'absolute',
              left: px,
              top: py,
              transition: 'transform 80ms linear',
              transform: 'translate(0, 0)',
              pointerEvents: 'none',
            }}
          >
            {/* Cursor SVG */}
            <svg
              width={16}
              height={20}
              viewBox="0 0 16 20"
              style={{ display: 'block', filter: `drop-shadow(0 1px 3px ${cursor.color}88)` }}
            >
              <path
                d="M0 0 L0 16 L4.5 12 L8 18 L10 17 L6.5 11 L12 11 Z"
                fill={cursor.color}
                stroke="#000"
                strokeWidth={0.8}
              />
            </svg>
            {/* Name tag */}
            <div
              style={{
                marginTop: 2,
                marginLeft: 4,
                padding: '1px 6px',
                borderRadius: 4,
                background: cursor.color,
                color: '#000',
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                whiteSpace: 'nowrap',
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {cursor.name}
            </div>
          </div>
        )
      })}
    </div>
  )
}
