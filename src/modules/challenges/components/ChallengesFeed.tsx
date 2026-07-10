import { useState, useEffect } from 'react'
import { Clock, ChevronRight, Lock, CheckCircle, Play } from 'lucide-react'
import { CHALLENGES as RAW_CHALLENGES } from '../../../config/challenges'
import type { Challenge, ChallengeHistoryEntry } from '../types'

const CHALLENGES = RAW_CHALLENGES as Challenge[]

interface ChallengesFeedProps {
  onAcceptChallenge: (challenge: Challenge) => void
  completedChallenges: ChallengeHistoryEntry[]
  totalPoints: number
}

export function ChallengesFeed({ onAcceptChallenge, completedChallenges, totalPoints }: ChallengesFeedProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all')

  const featuredChallenge = CHALLENGES.find(c => c.expiresDate !== null) || CHALLENGES[0]

  const [timeLeft, setTimeLeft] = useState('')
  useEffect(() => {
    if (!featuredChallenge.expiresDate) return

    const updateTimer = () => {
      const exp = new Date(featuredChallenge.expiresDate!).getTime()
      const diff = exp - Date.now()
      if (diff <= 0) {
        setTimeLeft('Expired')
        return
      }
      const days = Math.floor(diff / (24 * 3600000))
      const hrs = Math.floor((diff % (24 * 3600000)) / 3600000)
      const mins = Math.floor((diff % 3600000) / 60000)
      setTimeLeft(`${days}d ${hrs}h ${mins}m remaining`)
    }

    updateTimer()
    const timer = setInterval(updateTimer, 60000)
    return () => clearInterval(timer)
  }, [featuredChallenge])

  const getStatusIcon = (challengeId: string) => {
    const isCompleted = completedChallenges.some(h => h.challengeId === challengeId)
    const activeWorkspace = localStorage.getItem(`enginguity_challenge_${challengeId}_workspace`)

    if (isCompleted) {
      return <span title="Completed"><CheckCircle size={15} style={{ color: 'var(--accent)' }} /></span>
    }
    if (activeWorkspace) {
      return <span title="In Progress"><Play size={14} style={{ color: 'var(--text-muted)' }} /></span>
    }
    return <span title="Available"><Lock size={13} style={{ color: 'var(--text-dim)' }} /></span>
  }

  const categories = ['all', ...Array.from(new Set(CHALLENGES.map(c => c.category)))]
  const difficulties = ['all', 'entry', 'intermediate', 'advanced', 'expert']

  const filteredChallenges = CHALLENGES.filter(c => {
    const isCompleted = completedChallenges.some(h => h.challengeId === c.id)
    const activeWorkspace = localStorage.getItem(`enginguity_challenge_${c.id}_workspace`)

    if (activeTab === 'active' && (isCompleted || !activeWorkspace)) return false
    if (activeTab === 'completed' && !isCompleted) return false
    if (selectedCategory !== 'all' && c.category !== selectedCategory) return false
    if (selectedDifficulty !== 'all' && c.difficulty !== selectedDifficulty) return false

    return true
  })

  const getRank = (pts: number) => {
    if (pts >= 3000) return 'Principal Engineer'
    if (pts >= 1500) return 'Senior Architect'
    if (pts >= 500) return 'Staff Specialist'
    return 'Junior Apprentice'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Stats row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 8,
      }}>
        <div style={statsCardStyle}>
          <span style={statsLabelStyle}>Score</span>
          <span style={{ fontSize: 20, fontWeight: 400, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
            {totalPoints} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>pts</span>
          </span>
        </div>
        <div style={statsCardStyle}>
          <span style={statsLabelStyle}>Completed</span>
          <span style={{ fontSize: 20, fontWeight: 400, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
            {completedChallenges.length}
          </span>
        </div>
        <div style={statsCardStyle}>
          <span style={statsLabelStyle}>Standing</span>
          <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)', marginTop: 4 }}>
            {getRank(totalPoints)}
          </span>
        </div>
      </div>

      {/* Featured challenge */}
      {featuredChallenge && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            Featured this week
          </span>

          <h2 style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 16, fontWeight: 500, margin: 0, color: 'var(--text)' }}>
            {featuredChallenge.title}
          </h2>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {featuredChallenge.category.replace('_', ' ')}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {featuredChallenge.difficulty}
            </span>
            {featuredChallenge.expiresDate && timeLeft && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                <Clock size={11} /> {timeLeft}
              </span>
            )}
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0, maxWidth: 800 }}>
            {featuredChallenge.brief.split('\n').filter(Boolean)[1]?.replace(/[#*`]/g, '') || 'Begin this week\'s design simulation.'}
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
              {featuredChallenge.points} pts
            </span>
            <button
              onClick={() => onAcceptChallenge(featuredChallenge)}
              style={actionButtonStyle}
            >
              Accept <ArrowRightIcon />
            </button>
          </div>
        </div>
      )}

      {/* List header and filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 8, flexWrap: 'wrap', gap: 12 }}>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {(['all', 'active', 'completed'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '6px 14px',
                  border: 'none',
                  background: 'none',
                  fontSize: 13,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontWeight: 400,
                  cursor: 'pointer',
                  color: activeTab === tab ? 'var(--text)' : 'var(--text-muted)',
                  borderBottom: `2px solid ${activeTab === tab ? 'var(--accent)' : 'transparent'}`,
                  transition: 'color 120ms ease',
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={filterSelectStyle}
            >
              <option value="all">All categories</option>
              {categories.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c?.replace('_', ' ')}</option>)}
            </select>

            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              style={filterSelectStyle}
            >
              <option value="all">All difficulties</option>
              {difficulties.filter(d => d !== 'all').map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

        </div>

        {/* Challenge cards grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
          {filteredChallenges.map(challenge => {
            const isCompleted = completedChallenges.some(h => h.challengeId === challenge.id)

            return (
              <div
                key={challenge.id}
                onClick={() => onAcceptChallenge(challenge)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 16,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  transition: 'background 120ms ease, border-color 120ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface-2)'
                  e.currentTarget.style.borderColor = 'var(--border-bright)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {challenge.category.replace('_', ' ')}
                  </span>
                  {getStatusIcon(challenge.id)}
                </div>

                <h3 style={{ fontSize: 14, fontWeight: 400, margin: 0, color: isCompleted ? 'var(--text-muted)' : 'var(--text)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                  {challenge.title}
                </h3>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                    <span>{challenge.points} pts</span>
                    <span>·</span>
                    <span>{challenge.timeLimit ? `${challenge.timeLimit}m` : 'Untimed'}</span>
                    <span>·</span>
                    <span>{challenge.difficulty}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {challenge.submissionCount} shared
                  </span>
                </div>
              </div>
            )
          })}

          {filteredChallenges.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '40px 0', color: 'var(--text-muted)', textAlign: 'center', fontSize: 14 }}>
              No challenges match the current filters.
            </div>
          )}
        </div>

      </div>

    </div>
  )
}

const statsCardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '12px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const statsLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "'DM Sans', system-ui, sans-serif",
  color: 'var(--text-dim)',
  fontWeight: 400,
}

const actionButtonStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--accent)',
  border: '1px solid var(--accent)',
  padding: '7px 14px',
  borderRadius: 6,
  fontWeight: 400,
  fontSize: 13,
  fontFamily: "'DM Sans', system-ui, sans-serif",
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  transition: 'background 120ms ease',
}

const filterSelectStyle: React.CSSProperties = {
  background: 'var(--bg-2)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-muted)',
  padding: '6px 8px',
  fontSize: 12,
  fontFamily: "'DM Sans', system-ui, sans-serif",
  outline: 'none',
}

function ArrowRightIcon() {
  return <ChevronRight size={13} style={{ display: 'inline' }} />
}
