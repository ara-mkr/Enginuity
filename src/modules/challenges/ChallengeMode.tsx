import { useState, useEffect } from 'react'
import { Trophy, Calendar, Award, Compass, RefreshCw } from 'lucide-react'
import { ChallengesFeed } from './components/ChallengesFeed'
import { ChallengeWorkspace } from './components/ChallengeWorkspace'
import { ChallengeLeaderboard } from './components/ChallengeLeaderboard'
import { ChallengeCalendar } from './components/ChallengeCalendar'
import type { Challenge, ChallengeHistoryEntry } from './types'

export default function ChallengeMode() {
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null)
  const [activeTab, setActiveTab] = useState<'feed' | 'leaderboard' | 'calendar'>('feed')
  const [completedChallenges, setCompletedChallenges] = useState<ChallengeHistoryEntry[]>([])

  // Load completion history from localStorage
  useEffect(() => {
    const loadHistory = () => {
      try {
        const history = JSON.parse(localStorage.getItem('enginguity_challenge_history') || '[]')
        setCompletedChallenges(history)
      } catch (err) {
        console.error('Failed to load challenge history:', err)
      }
    }
    loadHistory()

    // Listen to local storage updates or internal updates
    window.addEventListener('storage', loadHistory)
    return () => {
      window.removeEventListener('storage', loadHistory)
    }
  }, [])

  const totalPoints = completedChallenges.reduce((sum, item) => sum + item.score, 0)

  const handleAcceptChallenge = (challenge: Challenge) => {
    setActiveChallenge(challenge)
  }

  const handleExitWorkspace = () => {
    setActiveChallenge(null)
  }

  const handleSubmitSolution = (entry: ChallengeHistoryEntry) => {
    // Reload history from localStorage
    try {
      const history = JSON.parse(localStorage.getItem('enginguity_challenge_history') || '[]')
      setCompletedChallenges(history)
    } catch { /* corrupted/missing stored value — fall back to default */ }
  }

  if (activeChallenge) {
    return (
      <ChallengeWorkspace
        challenge={activeChallenge}
        onExit={handleExitWorkspace}
        onSubmitSolution={handleSubmitSolution}
      />
    )
  }

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        minHeight: '100%',
        color: 'var(--text)'
      }}
    >
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 24,
              fontWeight: 500,
              margin: 0,
              color: 'var(--text)',
            }}
          >
            Challenges
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6, margin: 0 }}>
            Put your engineering skills to the test with real-world design, calculation, and circuit simulations.
          </p>
        </div>

        {/* Global Reset/Progress Stats Button */}
        <button
          onClick={() => {
            if (confirm('Are you sure you want to reset your Challenge progress? This cannot be undone.')) {
              localStorage.removeItem('enginguity_challenge_history')
              // Clean workspaces
              const keys = Object.keys(localStorage)
              keys.forEach(k => {
                if (k.startsWith('enginguity_challenge_')) {
                  localStorage.removeItem(k)
                }
              })
              setCompletedChallenges([])
            }
          }}
          style={{
            background: 'none',
            border: '1px solid var(--border-bright)',
            borderRadius: 6,
            padding: '7px 14px',
            fontSize: 13,
            fontFamily: "'DM Sans', system-ui, sans-serif",
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'background 120ms ease',
          }}
        >
          <RefreshCw size={11} /> Reset Progress
        </button>
      </div>

      {/* Main Module Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          gap: 4
        }}
      >
        <button
          onClick={() => setActiveTab('feed')}
          style={{
            ...tabStyle,
            color: activeTab === 'feed' ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: `2px solid ${activeTab === 'feed' ? 'var(--accent)' : 'transparent'}`
          }}
        >
          <Compass size={14} /> Challenges
        </button>
        
        <button
          onClick={() => setActiveTab('leaderboard')}
          style={{
            ...tabStyle,
            color: activeTab === 'leaderboard' ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: `2px solid ${activeTab === 'leaderboard' ? 'var(--accent)' : 'transparent'}`
          }}
        >
          <Trophy size={14} /> Leaderboard
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          style={{
            ...tabStyle,
            color: activeTab === 'calendar' ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: `2px solid ${activeTab === 'calendar' ? 'var(--accent)' : 'transparent'}`
          }}
        >
          <Calendar size={14} /> Streak Tracker
        </button>
      </div>

      {/* Tab Panel Content */}
      <div style={{ flex: 1 }}>
        {activeTab === 'feed' && (
          <ChallengesFeed
            onAcceptChallenge={handleAcceptChallenge}
            completedChallenges={completedChallenges}
            totalPoints={totalPoints}
          />
        )}
        {activeTab === 'leaderboard' && (
          <ChallengeLeaderboard
            completedChallenges={completedChallenges}
            totalPoints={totalPoints}
          />
        )}
        {activeTab === 'calendar' && (
          <ChallengeCalendar completedChallenges={completedChallenges} />
        )}
      </div>
    </div>
  )
}

const tabStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '10px 16px',
  fontSize: 14,
  fontWeight: 400,
  fontFamily: "'DM Sans', system-ui, sans-serif",
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  transition: 'color 120ms ease',
}
