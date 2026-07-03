import { useMemo } from 'react'
import { Calendar, Flame, Lock } from 'lucide-react'
import { CHALLENGES } from '../../../config/challenges'
import type { ChallengeHistoryEntry } from '../types'

interface ChallengeCalendarProps {
  completedChallenges: ChallengeHistoryEntry[]
}

export function ChallengeCalendar({ completedChallenges }: ChallengeCalendarProps) {
  // Sort challenges by posted date
  const sortedChallenges = useMemo(() => {
    return [...CHALLENGES].sort((a, b) => new Date(a.postedDate).getTime() - new Date(b.postedDate).getTime())
  }, [])

  // Calculate weekly completion streak
  const streak = useMemo(() => {
    let currentStreak = 0
    // Group completed challenge IDs for quick lookup
    const completedIds = new Set(completedChallenges.map(h => h.challengeId))

    // Walk backwards from current week
    const now = Date.now()
    const pastWeeks = sortedChallenges.filter(c => new Date(c.postedDate).getTime() <= now)

    for (let i = pastWeeks.length - 1; i >= 0; i--) {
      const ch = pastWeeks[i]
      if (completedIds.has(ch.id)) {
        currentStreak++
      } else {
        break // Streak broken
      }
    }

    return currentStreak
  }, [completedChallenges, sortedChallenges])

  const getWeekStatus = (challengeDateStr: string, challengeId: string) => {
    const time = new Date(challengeDateStr).getTime()
    const now = Date.now()
    const isCompleted = completedChallenges.some(h => h.challengeId === challengeId)

    if (time > now) return 'future'
    if (isCompleted) return 'completed'
    
    // Check if this week's active challenge (posted within 7 days from now)
    const diff = now - time
    if (diff > 0 && diff < 7 * 24 * 60 * 60 * 1000) {
      return 'active'
    }

    return 'past'
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }}>
      
      {/* Calendar header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={14} style={{ color: 'var(--accent)' }} /> 12-Week Challenge Tracker
        </h3>
        
        {streak > 0 && (
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            fontWeight: 700,
            color: '#b09470',
            background: 'rgba(255, 171, 64, 0.08)',
            border: '1px solid rgba(255, 171, 64, 0.2)',
            padding: '4px 10px',
            borderRadius: 15,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}>
            <Flame size={13} fill="#b09470" /> {streak} Week Streak!
          </span>
        )}
      </div>

      {/* Grid of weeks */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))',
        gap: 12
      }}>
        {sortedChallenges.map((ch, idx) => {
          const status = getWeekStatus(ch.postedDate, ch.id)
          const weekNum = idx + 1

          let bg = 'var(--surface-2)'
          let border = '1px solid var(--border)'
          let textColor = 'var(--text-muted)'
          let title = `Week ${weekNum}: Available`

          if (status === 'completed') {
            bg = 'var(--surface-2)'
            border = '1px solid var(--border)'
            textColor = 'var(--text-muted)'
            title = `Week ${weekNum}: Completed!`
          } else if (status === 'active') {
            bg = 'var(--accent-glow)'
            border = '1px solid var(--accent)'
            textColor = 'var(--accent)'
            title = `Week ${weekNum}: Active Featured Challenge`
          } else if (status === 'future') {
            bg = 'rgba(0,0,0,0.1)'
            border = '1px dashed var(--border)'
            textColor = 'var(--text-dim)'
            title = `Week ${weekNum}: Locked (Future)`
          } else if (status === 'past') {
            bg = 'rgba(255,255,255,0.02)'
            textColor = 'var(--text-muted)'
            title = `Week ${weekNum}: Past challenge (no time bonus)`
          }

          return (
            <div
              key={ch.id}
              title={title}
              style={{
                background: bg,
                border: border,
                borderRadius: 8,
                padding: '12px 6px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                cursor: status === 'future' ? 'not-allowed' : 'default',
                userSelect: 'none'
              }}
            >
              <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace",  color: textColor, opacity: 0.7 }}>
                Week {weekNum}
              </span>
              
              {status === 'future' ? (
                <Lock size={12} style={{ color: 'var(--text-dim)' }} />
              ) : status === 'completed' ? (
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>✓</span>
              ) : (
                <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: textColor }}>
                  {ch.category.slice(0, 3).toUpperCase()}
                </span>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}
