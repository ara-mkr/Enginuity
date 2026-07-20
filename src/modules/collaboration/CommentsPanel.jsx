import { useState, useRef } from 'react'
import { X, Check, Reply, MessageSquare, Filter } from 'lucide-react'

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function CommentCard({ comment, localUserId, onResolve, onReply }) {
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)

  const submitReply = () => {
    if (!replyText.trim()) return
    onReply(comment.id, replyText.trim())
    setReplyText('')
    setReplying(false)
  }

  return (
    <div
      style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--border)',
        opacity: comment.resolved ? 0.5 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {/* Color dot */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: comment.userColor,
            marginTop: 5,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                fontWeight: 600,
                color: comment.userColor,
              }}
            >
              {comment.userName}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
              {timeAgo(comment.createdAt)}
            </span>
            {comment.position?.type !== 'general' && (
              <span
                style={{
                  fontSize: 9,
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  fontFamily: "'JetBrains Mono', monospace",
                  
                }}
              >
                {comment.position.type}
              </span>
            )}
          </div>

          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: 'var(--text)',
              lineHeight: 1.5,
              textDecoration: comment.resolved ? 'line-through' : 'none',
            }}
          >
            {comment.text}
          </p>

          {/* Replies */}
          {comment.replies?.length > 0 && (
            <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: '2px solid var(--border)' }}>
              {comment.replies.map((r, i) => (
                <div key={i} style={{ marginBottom: 4 }}>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--accent)',
                      marginRight: 6,
                    }}
                  >
                    {r.userName}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text)' }}>{r.text}</span>
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {timeAgo(r.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Reply input */}
          {replying && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <input
                autoFocus
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitReply(); if (e.key === 'Escape') setReplying(false) }}
                placeholder="Reply..."
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  borderRadius: 4,
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  outline: 'none',
                }}
              />
              <button
                onClick={submitReply}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  background: 'var(--accent-glow)',
                  border: '1px solid var(--accent)',
                  color: 'var(--accent)',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Send
              </button>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {!comment.resolved && (
              <>
                <button
                  onClick={() => setReplying((r) => !r)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <Reply size={11} /> Reply
                </button>
                <button
                  onClick={() => onResolve(comment.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <Check size={11} /> Resolve
                </button>
              </>
            )}
            {comment.resolved && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                Resolved
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CommentsPanel({
  comments = [],
  localUser,
  onClose,
  onAddComment,
  onResolve,
  onReply,
  /** Pixels of fixed app chrome above the drawer (e.g. the top bar height). */
  topOffset = 0,
}) {
  const [tab, setTab] = useState('unresolved')
  const [newText, setNewText] = useState('')
  const inputRef = useRef(null)

  const filtered = comments.filter((c) => {
    if (tab === 'unresolved') return !c.resolved
    if (tab === 'mine') return c.userId === localUser?.id
    return true
  })

  const addComment = () => {
    if (!newText.trim()) return
    onAddComment({
      text: newText.trim(),
      position: { type: 'general' },
    })
    setNewText('')
  }

  const tabs = [
    { id: 'unresolved', label: 'Unresolved', count: comments.filter((c) => !c.resolved).length },
    { id: 'all', label: 'All', count: comments.length },
    { id: 'mine', label: 'Mine', count: comments.filter((c) => c.userId === localUser?.id).length },
  ]

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: topOffset,
        bottom: 0,
        width: 320,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9000,
        boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageSquare size={14} color="var(--accent)" />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
            Comments
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} data-tooltip="Close">
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: '8px 0',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span style={{ marginLeft: 4, opacity: 0.7 }}>({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Comments list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            No comments yet
          </div>
        )}
        {filtered.map((c) => (
          <CommentCard
            key={c.id}
            comment={c}
            localUserId={localUser?.id}
            onResolve={onResolve}
            onReply={onReply}
          />
        ))}
      </div>

      {/* New comment input */}
      <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
        <textarea
          ref={inputRef}
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addComment()
          }}
          placeholder="Add a comment... (⌘Enter to post)"
          rows={3}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 6,
            background: 'var(--bg-2)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            fontSize: 12,
            fontFamily: "'DM Sans Variable', 'DM Sans', system-ui, sans-serif",
            resize: 'none',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={addComment}
          disabled={!newText.trim()}
          style={{
            marginTop: 6,
            width: '100%',
            padding: '6px 0',
            borderRadius: 5,
            background: newText.trim() ? 'var(--accent-glow)' : 'transparent',
            border: `1px solid ${newText.trim() ? 'var(--accent)' : 'var(--border)'}`,
            color: newText.trim() ? 'var(--accent)' : 'var(--text-muted)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            cursor: newText.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Post Comment
        </button>
      </div>
    </div>
  )
}
