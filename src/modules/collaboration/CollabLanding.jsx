import { useState, useEffect } from 'react'
import { Radio, LogIn, Clock, Copy, Check, Trash2, Users } from 'lucide-react'
import { useProbeContext } from '../../hooks/useProbeContext'

const STORAGE_KEY = 'enginguity_recent_rooms'
const MAX_RECENT = 5

function loadRecentRooms() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveRecentRoom(room) {
  const rooms = loadRecentRooms().filter((r) => r.code !== room.code)
  rooms.unshift(room)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms.slice(0, MAX_RECENT)))
}

function generateRoomId() {
  const seg = () => Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${seg()}-${seg()}`
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

function InputField({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: 'var(--text-muted)',
          
          
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: '10px 12px',
          borderRadius: 8,
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          fontSize: 13,
          fontFamily: "'JetBrains Mono', monospace",
          outline: 'none',
          transition: 'border-color 0.15s',
        }}
        onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
        onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
      />
    </div>
  )
}

function Card({ children, accent = false }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${accent ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 12,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {children}
    </div>
  )
}

export default function CollabLanding({ onJoin }) {
  const [newName, setNewName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinName, setJoinName] = useState('')
  const [recentRooms, setRecentRooms] = useState([])
  const [generated, setGenerated] = useState(null)
  const [copied, setCopied] = useState(false)

  useProbeContext('collaboration', {
    recentRoomCount: recentRooms.length,
    joinCodeEntered: !!joinCode.trim(),
    generatedRoom: generated?.roomId ?? null,
  })

  useEffect(() => {
    setRecentRooms(loadRecentRooms())
    // Pre-fill name from previous session
    const saved = localStorage.getItem('enginguity_collab_name')
    if (saved) {
      setNewName(saved)
      setJoinName(saved)
    }
    // Check URL for room param
    const params = new URLSearchParams(window.location.search)
    const urlRoom = params.get('room')
    if (urlRoom) setJoinCode(urlRoom)
  }, [])

  const startSession = () => {
    const roomId = generateRoomId()
    const name = newName.trim() || 'Engineer'
    localStorage.setItem('enginguity_collab_name', name)
    saveRecentRoom({ code: roomId, name, lastActive: Date.now(), userCount: 1 })
    setGenerated({ roomId, name })
    onJoin(roomId, name)
  }

  const joinSession = () => {
    const code = joinCode.trim().toUpperCase()
    const name = joinName.trim() || 'Engineer'
    if (!code) return
    localStorage.setItem('enginguity_collab_name', name)
    saveRecentRoom({ code, name, lastActive: Date.now(), userCount: 1 })
    onJoin(code, name)
  }

  const rejoinRoom = (room) => {
    const name = localStorage.getItem('enginguity_collab_name') || 'Engineer'
    saveRecentRoom({ ...room, lastActive: Date.now() })
    onJoin(room.code, name)
  }

  const removeRecent = (code) => {
    const updated = recentRooms.filter((r) => r.code !== code)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setRecentRooms(updated)
  }

  const copyLink = () => {
    if (!generated) return
    const url = new URL(window.location.href)
    url.searchParams.set('room', generated.roomId)
    url.pathname = '/'
    navigator.clipboard.writeText(url.toString())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      style={{
        minHeight: '100%',
        padding: 40,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40, maxWidth: 560 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <Radio size={22} color="var(--accent)" />
          <h1
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--text)',
              margin: 0,
              
            }}
          >
            Live Collaboration
          </h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
          Work on engineering projects in real time with your team.
          Share a room code or URL — no account required.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
          width: '100%',
          maxWidth: 860,
        }}
      >
        {/* START NEW SESSION */}
        <Card accent>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Radio size={15} color="var(--accent)" />
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--accent)',
                
                
              }}
            >
              Start New Session
            </span>
          </div>

          <InputField
            label="Your Name"
            value={newName}
            onChange={setNewName}
            placeholder="e.g. Ada Lovelace"
          />

          <button
            onClick={startSession}
            style={{
              padding: '10px 0',
              borderRadius: 8,
              background: 'var(--accent)',
              border: 'none',
              color: '#000',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              
            }}
          >
            Generate Room &amp; Connect
          </button>

          {generated && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 2 }}>
                    ROOM CODE
                  </div>
                  <div style={{ fontSize: 18, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--accent)',  }}>
                    {generated.roomId}
                  </div>
                </div>
                <button
                  onClick={copyLink}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: 'var(--accent-glow)',
                    border: '1px solid var(--accent)',
                    color: copied ? '#7aaa8a' : 'var(--accent)',
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                    cursor: 'pointer',
                  }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* JOIN EXISTING */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LogIn size={15} color="var(--text-muted)" />
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text)',
                
                
              }}
            >
              Join Existing Session
            </span>
          </div>

          <InputField
            label="Room Code"
            value={joinCode}
            onChange={setJoinCode}
            placeholder="XXXX-XXXX"
          />
          <InputField
            label="Your Name"
            value={joinName}
            onChange={setJoinName}
            placeholder="e.g. Nikola Tesla"
          />

          <button
            onClick={joinSession}
            disabled={!joinCode.trim()}
            style={{
              padding: '10px 0',
              borderRadius: 8,
              background: joinCode.trim() ? 'var(--surface-2)' : 'transparent',
              border: `1px solid ${joinCode.trim() ? 'var(--border-bright)' : 'var(--border)'}`,
              color: joinCode.trim() ? 'var(--text)' : 'var(--text-muted)',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              fontWeight: 600,
              cursor: joinCode.trim() ? 'pointer' : 'not-allowed',
              
            }}
          >
            Join Room
          </button>
        </Card>
      </div>

      {/* RECENT ROOMS */}
      {recentRooms.length > 0 && (
        <div style={{ width: '100%', maxWidth: 860, marginTop: 28 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <Clock size={13} color="var(--text-muted)" />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)',   }}>
              Recent Rooms
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentRooms.map((room) => (
              <div
                key={room.code}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 16px',
                  borderRadius: 8,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--accent)',
                        
                      }}
                    >
                      {room.code}
                    </span>
                    {room.userCount && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                        <Users size={11} /> {room.userCount}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                    Last active {timeAgo(room.lastActive)}
                  </div>
                </div>
                <button
                  onClick={() => rejoinRoom(room)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: 6,
                    background: 'var(--accent-glow)',
                    border: '1px solid var(--accent)',
                    color: 'var(--accent)',
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                    cursor: 'pointer',
                  }}
                >
                  Rejoin
                </button>
                <button
                  onClick={() => removeRecent(room.code)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: 4,
                    display: 'flex',
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info footer */}
      <div
        style={{
          marginTop: 40,
          padding: '14px 20px',
          borderRadius: 8,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          maxWidth: 560,
          width: '100%',
          fontSize: 11,
          color: 'var(--text-muted)',
          fontFamily: "'JetBrains Mono', monospace",
          lineHeight: 1.7,
          textAlign: 'center',
        }}
      >
        Rooms are ephemeral — state lives in memory only and resets when the server restarts.
        Start the server with <span style={{ color: 'var(--accent)' }}>npm run collab</span> before joining.
      </div>
    </div>
  )
}
