import { useState, useEffect } from 'react'
import { Award, User, Clock, Copy, Check, ExternalLink, Trophy, Star } from 'lucide-react'
import { CHALLENGES } from '../../../config/challenges'
import type { ChallengeHistoryEntry, LeaderboardEntry } from '../types'

interface ChallengeLeaderboardProps {
  completedChallenges: ChallengeHistoryEntry[]
  totalPoints: number
}

// Mock Community Leaderboard data in case Gist fetch is offline or unavailable
const MOCK_COMMUNITY_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, username: "VoltViper", score: 6850, time: "42m total", sharedLink: "https://gist.github.com/mock-1" },
  { rank: 2, username: "ThermalThief", score: 6200, time: "58m total", sharedLink: "https://gist.github.com/mock-2" },
  { rank: 3, username: "FuzzyLogicGates", score: 5500, time: "71m total" },
  { rank: 4, username: "AtmegaOptimizer", score: 4800, time: "92m total" },
  { rank: 5, username: "AmpereAlchemist", score: 4200, time: "110m total" }
]

export function ChallengeLeaderboard({ completedChallenges, totalPoints }: ChallengeLeaderboardProps) {
  const [subTab, setSubTab] = useState<'local' | 'community'>('local')
  const [communityList, setCommunityList] = useState<LeaderboardEntry[]>(MOCK_COMMUNITY_LEADERBOARD)
  const [sortBy, setSortBy] = useState<'score' | 'time'>('score')
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  // Fetch community leaderboard if config URL is set
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const gistUrl = localStorage.getItem('enginguity_leaderboard_gist_url')
        if (gistUrl) {
          const res = await fetch(gistUrl)
          if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data)) {
              setCommunityList(data)
            }
          }
        }
      } catch (e) {
        console.warn('Failed to fetch community Gist leaderboard, using mock data.')
      }
    }
    fetchLeaderboard()
  }, [])

  // Local calculations
  const sortedLocalHistory = [...completedChallenges].sort((a, b) => b.score - a.score)
  const personalBest = sortedLocalHistory[0] || null

  const averageScore = completedChallenges.length > 0
    ? Math.round(totalPoints / completedChallenges.length)
    : 0

  const handlePostMyScore = (entry: ChallengeHistoryEntry) => {
    const chName = CHALLENGES.find(c => c.id === entry.challengeId)?.title || entry.challengeId
    const username = localStorage.getItem('enginguity_collab_name') || 'Anonymous Engineer'
    
    let md = `### Challenge Score Submission\n\n`
    md += `- **Username**: ${username}\n`
    md += `- **Challenge**: ${chName}\n`
    md += `- **Score achieved**: ${entry.score} pts\n`
    md += `- **Time taken**: ${entry.timeMinutes} minutes\n`
    md += `- **Hints unlocked**: ${entry.hintsUsed}\n`
    if (entry.shareUrl) {
      md += `- **Solution Link**: ${entry.shareUrl}\n`
    }
    md += `\n*Post this issue. The repository maintainers will append this score manually to the Gist leaderboard database.*`

    const repoUrl = 'https://github.com/akhilraja-amudhan/ENGINGUITY/issues/new'
    const finalUrl = `${repoUrl}?title=${encodeURIComponent(`Score Submission: ${chName}`)}&body=${encodeURIComponent(md)}`
    window.open(finalUrl, '_blank')
  }

  const handleCopyLink = async (link: string, id: string) => {
    await navigator.clipboard.writeText(link)
    setCopiedLink(id)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      
      {/* Sub Tabs Selection */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingBottom: 1 }}>
        <button
          onClick={() => setSubTab('local')}
          style={{
            padding: '8px 20px',
            background: 'none',
            border: 'none',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            color: subTab === 'local' ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: `2px solid ${subTab === 'local' ? 'var(--accent)' : 'transparent'}`
          }}
        >
          Personal Record
        </button>
        <button
          onClick={() => setSubTab('community')}
          style={{
            padding: '8px 20px',
            background: 'none',
            border: 'none',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            color: subTab === 'community' ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: `2px solid ${subTab === 'community' ? 'var(--accent)' : 'transparent'}`
          }}
        >
          Community Standings
        </button>
      </div>

      {subTab === 'local' ? (
        /* Personal History tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* PB Card */}
          {personalBest && (
            <div style={{
              background: 'var(--accent-glow)',
              border: '1px solid rgba(148, 163, 184, 0.15)',
              borderRadius: 10,
              padding: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)',  display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Star size={11} fill="var(--accent)" /> Personal Best
                </span>
                <h4 style={{ fontSize: 14, fontWeight: 700, margin: '6px 0 2px 0' }}>
                  {CHALLENGES.find(c => c.id === personalBest.challengeId)?.title || personalBest.challengeId}
                </h4>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Time: {personalBest.timeMinutes}m | Hints: {personalBest.hintsUsed} used
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {personalBest.score}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block' }}>points</span>
              </div>
            </div>
          )}

          {/* Stats Summary Panel */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16
          }}>
            <div style={innerStatsBoxStyle}>
              <span style={innerStatsLabelStyle}>Total Points</span>
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{totalPoints}</span>
            </div>
            <div style={innerStatsBoxStyle}>
              <span style={innerStatsLabelStyle}>Completed</span>
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{completedChallenges.length}</span>
            </div>
            <div style={innerStatsBoxStyle}>
              <span style={innerStatsLabelStyle}>Average Score</span>
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{averageScore}</span>
            </div>
          </div>

          {/* Local Submissions History List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)',  }}>Submission History</span>
            
            {sortedLocalHistory.map((item, idx) => {
              const ch = CHALLENGES.find(c => c.id === item.challengeId)
              return (
                <div key={idx} style={localRowStyle}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{ch?.title || item.challengeId}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Completed: {new Date(item.completedAt).toLocaleDateString()}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ fontSize: 11, textAlign: 'right', color: 'var(--text-muted)' }}>
                      <div>{item.timeMinutes}m elapsed</div>
                      <div>{item.hintsUsed} hints</div>
                    </div>
                    
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {item.score} pts
                    </span>

                    <button
                      onClick={() => handlePostMyScore(item)}
                      title="Publish this score to the community leaderboard"
                      style={smallActionButtonStyle}
                    >
                      Publish
                    </button>
                  </div>
                </div>
              )
            })}

            {sortedLocalHistory.length === 0 && (
              <div style={{ padding: '24px 0', color: 'var(--text-muted)', textAlign: 'center', fontSize: 12 }}>
                Complete a challenge to log record metrics.
              </div>
            )}
          </div>

        </div>
      ) : (
        /* Community Standings tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
            <span>Global engineering submissions scoreboard</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <span
                onClick={() => setSortBy('score')}
                style={{ cursor: 'pointer', color: sortBy === 'score' ? 'var(--accent)' : 'inherit', fontWeight: sortBy === 'score' ? 600 : 400 }}
              >
                Score
              </span>
              <span
                onClick={() => setSortBy('time')}
                style={{ cursor: 'pointer', color: sortBy === 'time' ? 'var(--accent)' : 'inherit', fontWeight: sortBy === 'time' ? 600 : 400 }}
              >
                Time
              </span>
            </div>
          </div>

          {/* Standings table */}
          <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface-2)' }}>
            
            {communityList
              .sort((a,b) => sortBy === 'score' ? b.score - a.score : a.rank - b.rank)
              .map((entry, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderBottom: idx === communityList.length - 1 ? 'none' : '1px solid var(--border)',
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace"
                }}>
                  <span style={{ width: 30, color: entry.rank <= 3 ? '#b09470' : 'var(--text-muted)', fontWeight: 700 }}>
                    #{entry.rank}
                  </span>
                  
                  <span style={{ flex: 1, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={12} style={{ color: 'var(--text-muted)' }} /> {entry.username}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{entry.time}</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{entry.score} pts</span>
                    {entry.sharedLink ? (
                      <button
                        onClick={() => handleCopyLink(entry.sharedLink!, `comm-${idx}`)}
                        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}
                        title="Copy shared playground simulation link"
                      >
                        {copiedLink === `comm-${idx}` ? <Check size={12} style={{ color: '#7aaa8a' }} /> : <ExternalLink size={12} />}
                      </button>
                    ) : (
                      <span style={{ width: 14 }}></span>
                    )}
                  </div>
                </div>
              ))}

          </div>

        </div>
      )}

    </div>
  )
}

const innerStatsBoxStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '8px 12px',
  display: 'flex',
  flexDirection: 'column'
}

const innerStatsLabelStyle: React.CSSProperties = {
  fontSize: 9,
  fontFamily: "'JetBrains Mono', monospace",
  color: 'var(--text-muted)',
  
}

const localRowStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 14px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12
}

const smallActionButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--accent)',
  color: 'var(--accent)',
  borderRadius: 4,
  padding: '3px 8px',
  fontSize: 10,
  fontFamily: "'JetBrains Mono', monospace",
  cursor: 'pointer'
}
