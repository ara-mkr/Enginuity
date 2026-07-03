import { useEffect, useRef, useState } from 'react'
import { History, Plus, Trash2, MessageSquare, Pencil, Check, X } from 'lucide-react'
import { formatRelativeTime, type ChatSession } from '../hooks/useChatSessions'

interface Props<T> {
  sessions: ChatSession<T>[]
  activeSessionId: string
  onSwitch: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  label?: string
  align?: 'left' | 'right'
}

export function ChatHistoryPopover<T>({
  sessions,
  activeSessionId,
  onSwitch,
  onNew,
  onDelete,
  onRename,
  label = 'History',
  align = 'left',
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`${sessions.length} saved ${sessions.length === 1 ? 'chat' : 'chats'}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '5px 10px', borderRadius: 7,
          background: open ? 'var(--surface-2)' : 'transparent',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)', cursor: 'pointer',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = 'transparent'
        }}
      >
        <History size={12} />
        {label}
        {sessions.length > 0 && (
          <span style={{ color: 'var(--text-dim)' }}>{sessions.length}</span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            [align]: 0,
            width: 320,
            maxHeight: 380,
            overflowY: 'auto',
            background: 'var(--surface)',
            border: '1px solid var(--border-bright)',
            borderRadius: 10,
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            zIndex: 200,
            padding: 6,
          }}
        >
          <button
            type="button"
            onClick={() => {
              onNew()
              setOpen(false)
            }}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 7,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text)', cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
              marginBottom: 6,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Plus size={12} />
            New chat
          </button>

          {sessions.length === 0 ? (
            <div style={{
              padding: 14, textAlign: 'center',
              fontSize: 11, color: 'var(--text-dim)',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              No chats yet
            </div>
          ) : (
            sessions.map((s) => {
              const isActive = s.id === activeSessionId
              const isEditing = editingId === s.id
              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 8px', borderRadius: 7,
                    background: isActive ? 'rgba(148,165,186,0.08)' : 'transparent',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--border-bright)' : 'transparent',
                    cursor: isEditing ? 'default' : 'pointer',
                    marginBottom: 2,
                  }}
                  onClick={() => {
                    if (isEditing) return
                    if (!isActive) onSwitch(s.id)
                    setOpen(false)
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive && !isEditing) e.currentTarget.style.background = 'var(--surface-2)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive && !isEditing) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <MessageSquare size={11} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onRename(s.id, editValue)
                            setEditingId(null)
                          } else if (e.key === 'Escape') {
                            setEditingId(null)
                          }
                        }}
                        style={{
                          width: '100%',
                          background: 'var(--bg)', border: '1px solid var(--border)',
                          borderRadius: 5, color: 'var(--text)',
                          padding: '3px 6px', fontSize: 12,
                          fontFamily: "'DM Sans', system-ui, sans-serif",
                        }}
                      />
                    ) : (
                      <>
                        <div style={{
                          fontSize: 12, color: 'var(--text)',
                          fontFamily: "'DM Sans', system-ui, sans-serif",
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {s.title}
                        </div>
                        <div style={{
                          fontSize: 10, color: 'var(--text-dim)',
                          fontFamily: "'JetBrains Mono', monospace", marginTop: 1,
                        }}>
                          {formatRelativeTime(s.updatedAt)}
                          {s.messages.length > 0 && ` · ${s.messages.length} msg${s.messages.length === 1 ? '' : 's'}`}
                        </div>
                      </>
                    )}
                  </div>
                  {isEditing ? (
                    <>
                      <IconBtn
                        title="Save"
                        onClick={(e) => {
                          e.stopPropagation()
                          onRename(s.id, editValue)
                          setEditingId(null)
                        }}
                      >
                        <Check size={11} />
                      </IconBtn>
                      <IconBtn
                        title="Cancel"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingId(null)
                        }}
                      >
                        <X size={11} />
                      </IconBtn>
                    </>
                  ) : (
                    <>
                      <IconBtn
                        title="Rename"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingId(s.id)
                          setEditValue(s.title)
                        }}
                      >
                        <Pencil size={10} />
                      </IconBtn>
                      <IconBtn
                        title="Delete chat"
                        danger
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`Delete "${s.title}"?`)) onDelete(s.id)
                        }}
                      >
                        <Trash2 size={10} />
                      </IconBtn>
                    </>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function IconBtn({
  children, title, danger, onClick,
}: {
  children: React.ReactNode
  title: string
  danger?: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: 'var(--text-dim)', padding: 3, display: 'flex',
        alignItems: 'center', borderRadius: 4, flexShrink: 0,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = danger ? '#f87171' : 'var(--text)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
    >
      {children}
    </button>
  )
}
