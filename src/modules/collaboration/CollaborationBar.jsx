import { useState, useEffect } from 'react'
import { Users, Copy, Check, LogOut, MessageSquare, Radio, UserPlus } from 'lucide-react'
import CommentsPanel from './CommentsPanel'

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function Avatar({ user, size = 28, showTooltip = true }) {
  const [tip, setTip] = useState(false)
  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="relative" style={{ display: 'inline-block' }}>
      <div
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: user.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.38,
          fontWeight: 700,
          color: '#000',
          fontFamily: "'JetBrains Mono', monospace",
          cursor: 'default',
          border: '2px solid var(--bg)',
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
      {showTooltip && tip && (
        <div
          style={{
            position: 'absolute',
            bottom: '110%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          <span style={{ color: user.color }}>{user.name}</span>
          {user.lastSeen && (
            <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
              · {timeAgo(user.lastSeen)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default function CollaborationBar({
  connected,
  users,
  roomId,
  localUser,
  comments,
  onStartSession,
  onLeave,
  onOpenComments,
  commentsOpen,
}) {
  const [copied, setCopied] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)
  const unresolvedCount = (comments || []).filter((c) => !c.resolved).length

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyInviteLink = () => {
    const url = new URL(window.location.href)
    if (roomId) url.searchParams.set('room', roomId)
    navigator.clipboard.writeText(url.toString())
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
  }

  const visibleUsers = users.slice(0, 5)
  const extraUsers = users.length - 5

  if (!roomId && !connected) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '6px 16px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          height: 42,
        }}
      >
        <div style={{ flex: 1 }} />
        <button
          onClick={onStartSession}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 14px',
            borderRadius: 6,
            background: 'var(--accent-glow)',
            border: '1px solid var(--accent)',
            color: 'var(--accent)',
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            cursor: 'pointer',
          }}
        >
          <Radio size={13} />
          Start Session
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        height: 42,
        flexShrink: 0,
      }}
    >
      {/* LEFT — status + room code */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {/* Live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: connected ? '#7aaa8a' : '#b08080',
              animation: 'none',
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: connected ? '#7aaa8a' : 'var(--text-muted)',
              fontWeight: 600,
              
            }}
          >
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>

        {roomId && (
          <>
            <span style={{ color: 'var(--border-bright)', fontSize: 12 }}>|</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)' }}>
              Room:
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                color: 'var(--accent)',
                
              }}
            >
              {roomId}
            </span>
            <button
              onClick={copyRoomCode}
              title="Copy room code"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: copied ? '#7aaa8a' : 'var(--text-muted)',
                padding: 0,
                display: 'flex',
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
            <button
              onClick={copyInviteLink}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'transparent',
                border: '1px solid var(--border)',
                color: inviteCopied ? '#7aaa8a' : 'var(--text-muted)',
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                cursor: 'pointer',
              }}
            >
              {inviteCopied ? <Check size={11} /> : <UserPlus size={11} />}
              {inviteCopied ? 'Copied!' : 'Invite'}
            </button>
          </>
        )}
      </div>

      {/* CENTER — avatar stack */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {visibleUsers.map((u) => (
            <div key={u.id} style={{ marginLeft: -6 }}>
              <Avatar user={u} size={26} />
            </div>
          ))}
          {extraUsers > 0 && (
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'var(--surface-2)',
                border: '2px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                color: 'var(--text-muted)',
                marginLeft: -6,
              }}
            >
              +{extraUsers}
            </div>
          )}
          {users.length === 0 && (
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)' }}>
              Only you
            </span>
          )}
        </div>
      </div>

      {/* RIGHT — comments + leave */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={onOpenComments}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 10px',
            borderRadius: 5,
            background: commentsOpen ? 'var(--accent-glow)' : 'transparent',
            border: `1px solid ${commentsOpen ? 'var(--accent)' : 'var(--border)'}`,
            color: commentsOpen ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            cursor: 'pointer',
          }}
        >
          <MessageSquare size={12} />
          Comments
          {unresolvedCount > 0 && (
            <span
              style={{
                background: 'var(--accent)',
                color: '#000',
                borderRadius: 8,
                padding: '0 5px',
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {unresolvedCount}
            </span>
          )}
        </button>

        <button
          onClick={onLeave}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 10px',
            borderRadius: 5,
            background: 'transparent',
            border: '1px solid var(--border)',
            color: '#b08080',
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            cursor: 'pointer',
          }}
        >
          <LogOut size={12} />
          Leave
        </button>
      </div>

    </div>
  )
}
