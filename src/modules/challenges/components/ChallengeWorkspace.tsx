import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Clock,
  Sparkles,
  HelpCircle,
  CheckSquare,
  Square,
  BookOpen,
  Send,
  Loader2,
  Lock,
  ChevronLeft,
  Share2,
  ExternalLink,
  ChevronDown
} from 'lucide-react'
import { ParameterPlayground } from '../../parameter-playground/ParameterPlayground'
import CircuitSim from '../../circuit-sim/CircuitSim'
import { FormulaLab } from '../../formula-lab/FormulaLab'
import { DebugConsole } from '../../debug-console/DebugConsole'
import { EngineeringNotebook } from '../../notebook/EngineeringNotebook'
import { speakText } from '../../../engine/voiceEngine'
import { useAIProvider } from '../../../hooks/useAIProvider'
import type { Challenge, ChallengeWorkspaceState, ChallengeHistoryEntry } from '../types'

interface ChallengeWorkspaceProps {
  challenge: Challenge
  onExit: () => void
  onSubmitSolution: (entry: ChallengeHistoryEntry) => void
}

export function ChallengeWorkspace({ challenge, onExit, onSubmitSolution }: ChallengeWorkspaceProps) {
  const { makeRequest } = useAIProvider()

  // Time & Points States
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const [hintsUnlocked, setHintsUnlocked] = useState<number[]>([])
  const [checkedConstraints, setCheckedConstraints] = useState<string[]>([])
  
  // Tabs: playground / circuit / formula / console / notebook
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'playground' | 'circuit' | 'formula' | 'console' | 'notebook'>('playground')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Modals
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showResultsCard, setShowResultsCard] = useState(false)
  const [resultsData, setResultsData] = useState<ChallengeHistoryEntry | null>(null)

  // Submission inputs
  const [approachDescription, setApproachDescription] = useState('')
  const [sharePlayground, setSharePlayground] = useState(true)
  const [shareConsole, setShareConsole] = useState(true)
  const [keyInsight, setKeyInsight] = useState('')

  // AI reference state
  const [loadingAISolution, setLoadingAISolution] = useState(false)
  const [aiReferenceSolution, setAiReferenceSolution] = useState<string | null>(null)

  // Local backups for state isolation
  const backupDataRef = useRef<Record<string, string | null>>({})

  // Initialize: backup main localStorage, load challenge workspace state
  useEffect(() => {
    const backupKeys = [
      'enginguity_starter_code',
      'enginguity_notebook',
      'enginguity_params_prefill',
      'enginguity_circuit_prefill'
    ]

    // Save backups
    backupKeys.forEach(key => {
      backupDataRef.current[key] = localStorage.getItem(key)
    })

    // Load challenge workspace
    const wsSaved = localStorage.getItem(`enginguity_challenge_${challenge.id}_workspace`)
    if (wsSaved) {
      try {
        const parsed = JSON.parse(wsSaved) as ChallengeWorkspaceState
        if (parsed.consoleCode) localStorage.setItem('enginguity_starter_code', parsed.consoleCode)
        if (parsed.notebookNotes) localStorage.setItem('enginguity_notebook', parsed.notebookNotes)
        if (parsed.playgroundState) localStorage.setItem('enginguity_params_prefill', parsed.playgroundState)
        if (parsed.circuitState) localStorage.setItem('enginguity_circuit_prefill', parsed.circuitState)
        if (parsed.checkedConstraints) setCheckedConstraints(parsed.checkedConstraints)
      } catch (e) {
        console.error('Failed to parse saved challenge workspace', e)
      }
    } else {
      // Clear for a clean slate inside this workspace
      localStorage.removeItem('enginguity_starter_code')
      localStorage.removeItem('enginguity_notebook')
      localStorage.removeItem('enginguity_params_prefill')
      localStorage.removeItem('enginguity_circuit_prefill')
    }

    // Load unlocked hints
    try {
      const savedHints = JSON.parse(localStorage.getItem(`enginguity_challenge_${challenge.id}_unlocked_hints`) || '[]')
      setHintsUnlocked(savedHints)
    } catch { /* corrupted/missing stored value — fall back to default */ }

    // Load elapsed timer
    const savedTime = localStorage.getItem(`enginguity_challenge_${challenge.id}_time`)
    if (savedTime) setSecondsElapsed(parseInt(savedTime))

    return () => {
      // Auto-save on exit
      saveWorkspaceState()

      // Restore backups
      backupKeys.forEach(key => {
        const val = backupDataRef.current[key]
        if (val === null) {
          localStorage.removeItem(key)
        } else {
          localStorage.setItem(key, val)
        }
      })
    }
  }, [challenge])

  // Timer tick
  useEffect(() => {
    if (showResultsCard) return

    const timer = setInterval(() => {
      setSecondsElapsed(prev => {
        const next = prev + 1
        localStorage.setItem(`enginguity_challenge_${challenge.id}_time`, String(next))
        return next
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [showResultsCard, challenge])

  // Auto-save every 30 seconds loop
  useEffect(() => {
    if (showResultsCard) return

    const autoSave = setInterval(() => {
      saveWorkspaceState()
    }, 30000)

    return () => clearInterval(autoSave)
  }, [showResultsCard, checkedConstraints])

  const saveWorkspaceState = () => {
    const wsState: ChallengeWorkspaceState = {
      consoleCode: localStorage.getItem('enginguity_starter_code') || '',
      notebookNotes: localStorage.getItem('enginguity_notebook') || '[]',
      playgroundState: localStorage.getItem('enginguity_params_prefill') || '{}',
      circuitState: localStorage.getItem('enginguity_circuit_prefill') || '{}',
      checkedConstraints
    }
    localStorage.setItem(`enginguity_challenge_${challenge.id}_workspace`, JSON.stringify(wsState))
  }

  // Points ticks down 1% per 2 minutes
  const pointsRemaining = useMemo(() => {
    const elapsedMinutes = Math.floor(secondsElapsed / 60)
    const reductionPercent = Math.floor(elapsedMinutes / 2)
    const multiplier = Math.max(0.5, 1 - reductionPercent / 100)
    return Math.floor(challenge.points * multiplier)
  }, [secondsElapsed, challenge])

  // Clock format
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const remainingSecs = secs % 60
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`
  }

  // Hints reveals logic
  const handleRevealHint = (hintIdx: number) => {
    const cost = Math.round(challenge.points * 0.1)
    if (confirm(`Reveal hint ${hintIdx + 1}? This will cost ${cost} points.`)) {
      const next = [...hintsUnlocked, hintIdx]
      setHintsUnlocked(next)
      localStorage.setItem(`enginguity_challenge_${challenge.id}_unlocked_hints`, JSON.stringify(next))
      speakText('Hint unlocked.')
    }
  }

  // Constraint toggle checklists
  const toggleConstraint = (c: string) => {
    if (checkedConstraints.includes(c)) {
      setCheckedConstraints(prev => prev.filter(item => item !== c))
    } else {
      setCheckedConstraints(prev => [...prev, c])
    }
  }

  // Submit flow
  const handleSubmitSolution = () => {
    const minutesTaken = Math.max(1, Math.round(secondsElapsed / 60))
    const time_factor = Math.max(0.5, 1 - (minutesTaken / 120) * 0.3)
    const hints_factor = 1 - (hintsUnlocked.length * 0.1)
    const finalScore = Math.round(challenge.points * time_factor * hints_factor)

    // Build share link base64 payload if playground checked
    let shareUrl = ''
    if (sharePlayground) {
      try {
        const val = localStorage.getItem('enginguity_params_prefill') || '{}'
        shareUrl = `${window.location.origin}/parameter-playground?share=${btoa(encodeURIComponent(val))}`
      } catch { /* unencodable prefill — share link is optional */ }
    }

    const newHistoryEntry: ChallengeHistoryEntry = {
      challengeId: challenge.id,
      score: finalScore,
      completedAt: new Date().toISOString(),
      timeMinutes: minutesTaken,
      hintsUsed: hintsUnlocked.length,
      description: approachDescription,
      shareUrl
    }

    // Save history locally
    const existing = JSON.parse(localStorage.getItem('enginguity_challenge_history') || '[]')
    localStorage.setItem('enginguity_challenge_history', JSON.stringify([newHistoryEntry, ...existing]))

    // Update state & show results card
    setResultsData(newHistoryEntry)
    setShowSubmitModal(false)
    setShowResultsCard(true)

    // Callback to propagate points
    onSubmitSolution(newHistoryEntry)
    speakText(`Challenge submitted successfully. Your score is ${finalScore} points.`)
  }

  // Trigger AI Reference solver
  const handleRequestAIReference = async () => {
    setLoadingAISolution(true)
    setAiReferenceSolution(null)

    const system = `You are an expert design engineer. Review the challenge details and provide a comprehensive, well-documented model solution.`
    const prompt = `Provide the reference solution for this challenge:
Title: ${challenge.title}
Brief: ${challenge.brief}
Constraints: ${challenge.constraints.join(', ')}
Evaluation Criteria: ${challenge.evaluation_criteria.join(', ')}

Please structure the solution with:
1. Design approach and reasoning
2. Key calculations (show your work clearly)
3. Component/parameter values with justification
4. Potential failure modes and how to avoid them
5. Validation and testing steps in practice`

    try {
      const response = await makeRequest([{ role: 'user', content: prompt }], system)
      setAiReferenceSolution(response)
    } catch (e: any) {
      setAiReferenceSolution('Failed to load reference solution. Make sure you are connected to the internet.')
    } finally {
      setLoadingAISolution(false)
    }
  }

  // Get estimation of performance standing
  const getEstimatedPercentile = (score: number, difficulty: string) => {
    // Hardcoded realistic curves
    if (difficulty === 'entry') return score > 450 ? 'Top 10%' : 'Top 25%'
    if (difficulty === 'intermediate') return score > 650 ? 'Top 15%' : 'Top 30%'
    if (difficulty === 'advanced') return score > 750 ? 'Top 20%' : 'Top 35%'
    return score > 900 ? 'Top 25%' : 'Top 45%'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      
      {/* Top Workspace Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        height: 56,
        boxSizing: 'border-box'
      }}>
        
        {/* Back and Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onExit} style={backButtonStyle}>
            <ChevronLeft size={16} /> Back
          </button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{challenge.title}</span>
            <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
              Category: {challenge.category} | Difficulty: {challenge.difficulty}
            </span>
          </div>
        </div>

        {/* Live Counters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          
          <div style={timerBoxStyle}>
            <Clock size={13} />
            <span>{formatTime(secondsElapsed)}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-dim)',  }}>Points Available</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>
              {pointsRemaining} pts
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            
            {/* Hints menu button */}
            <button
              onClick={() => {
                const unrevealedIdx = challenge.hints.findIndex((_, idx) => !hintsUnlocked.includes(idx))
                if (unrevealedIdx !== -1) {
                  handleRevealHint(unrevealedIdx)
                } else {
                  alert('All hints have already been unlocked.')
                }
              }}
              className="btn btn-outline"
              style={{
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                borderColor: 'var(--border-bright)',
                color: 'var(--text-muted)'
              }}
            >
              Hints ({challenge.hints.length - hintsUnlocked.length} left)
            </button>

            {/* Submission button */}
            <button
              onClick={() => setShowSubmitModal(true)}
              style={{
                background: 'var(--accent)',
                color: 'var(--bg)',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 11,
                padding: '6px 14px',
                fontFamily: "'JetBrains Mono', monospace",
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <Send size={11} /> Submit Solution
            </button>
          </div>

        </div>
      </div>

      {/* Main Split Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Brief Sidebar (collapsible) */}
        {sidebarOpen && (
          <div style={{
            width: 320,
            borderRight: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: 20,
            gap: 20
          }}>
            
            {/* Objective */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={labelStyle}>Engineering Brief</span>
              <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)' }} dangerouslySetInnerHTML={{ __html: challenge.brief }} />
            </div>

            {/* Constraints Checklists */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={labelStyle}>Design Constraints</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {challenge.constraints.map((c, idx) => {
                  const checked = checkedConstraints.includes(c)
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleConstraint(c)}
                      style={{
                        display: 'flex',
                        gap: 8,
                        fontSize: 11,
                        color: checked ? 'var(--text-muted)' : 'var(--text)',
                        cursor: 'pointer',
                        alignItems: 'flex-start'
                      }}
                    >
                      {checked ? <CheckSquare size={13} style={{ color: 'var(--accent)', marginTop: 1 }} /> : <Square size={13} style={{ color: 'var(--border-bright)', marginTop: 1 }} />}
                      <span style={{ textDecoration: checked ? 'line-through' : 'none' }}>{c}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Evaluation list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={labelStyle}>Evaluation Criteria</span>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {challenge.evaluation_criteria.map((ec, idx) => (
                  <li key={idx} style={{ marginBottom: 4 }}>{ec}</li>
                ))}
              </ul>
            </div>

            {/* Reference links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={labelStyle}>References</span>
              {challenge.referenceLinks.map((rl, idx) => (
                <a
                  key={idx}
                  href={rl.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 11,
                    color: 'var(--accent)',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  {rl.title} <ExternalLink size={10} />
                </a>
              ))}
            </div>

            {/* Unlocked Hints display */}
            {hintsUnlocked.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <span style={labelStyle}>Unlocked Hints</span>
                {hintsUnlocked.map((hintIdx) => (
                  <div key={hintIdx} style={hintCardStyle}>
                    <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)', fontWeight: 600 }}>HINT #{hintIdx + 1}</span>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: 1.4 }}>{challenge.hints[hintIdx]}</p>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* Center Panel Workspace tabs */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* Tabs header bar */}
          <div style={{
            display: 'flex',
            background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border)',
            height: 40,
            alignItems: 'center',
            paddingLeft: 12,
            paddingRight: 12
          }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                padding: '0 12px'
              }}
            >
              {sidebarOpen ? '◀ Hide Brief' : '▶ Show Brief'}
            </button>
            <div style={{ display: 'flex', gap: 2, height: '100%' }}>
              {(['playground', 'circuit', 'formula', 'console', 'notebook'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveWorkspaceTab(tab)}
                  style={{
                    padding: '0 16px',
                    background: activeWorkspaceTab === tab ? 'var(--bg)' : 'transparent',
                    border: 'none',
                    color: activeWorkspaceTab === tab ? 'var(--accent)' : 'var(--text-muted)',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    cursor: 'pointer',
                    height: '100%',
                    borderTop: activeWorkspaceTab === tab ? '2px solid var(--accent)' : '2px solid transparent'
                  }}
                >
                  {tab === 'playground' ? 'Playground' : tab === 'circuit' ? 'Circuit Sim' : tab === 'formula' ? 'Formula Lab' : tab === 'console' ? 'Console' : 'Logbook'}
                </button>
              ))}
            </div>
          </div>

          {/* Core Embedded Module */}
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {activeWorkspaceTab === 'playground' && <ParameterPlayground />}
            {activeWorkspaceTab === 'circuit' && <CircuitSim />}
            {activeWorkspaceTab === 'formula' && <FormulaLab />}
            {activeWorkspaceTab === 'console' && <DebugConsole />}
            {activeWorkspaceTab === 'notebook' && <EngineeringNotebook />}
          </div>

        </div>

      </div>

      {/* Submission Modal */}
      {showSubmitModal && (
        <div style={overlayStyle}>
          <div style={submitModalStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, margin: 0 }}>
                Submit Design Solution
              </h3>
              <button onClick={() => setShowSubmitModal(false)} style={closeButtonStyle} data-tooltip="Close">✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', paddingRight: 4 }}>
              
              <div style={fieldStyle}>
                <span style={labelStyle}>Describe your design approach</span>
                <textarea
                  value={approachDescription}
                  onChange={(e) => setApproachDescription(e.target.value)}
                  placeholder="Explain calculations, component selections, and filter layouts..."
                  style={textareaInputStyle}
                />
              </div>

              <div style={fieldStyle}>
                <span style={labelStyle}>Key insight or trick</span>
                <input
                  type="text"
                  value={keyInsight}
                  onChange={(e) => setKeyInsight(e.target.value)}
                  placeholder="E.g., cascaded filters for NE5532 stage bandwidth"
                  style={textInputStyle}
                />
              </div>

              <div style={toggleRowStyle}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, display: 'block' }}>Share Parameter Setup?</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Encodes current playground sliders as a share link</span>
                </div>
                <input
                  type="checkbox"
                  checked={sharePlayground}
                  onChange={(e) => setSharePlayground(e.target.checked)}
                />
              </div>

              <div style={toggleRowStyle}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, display: 'block' }}>Include console code?</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Exports active script from Debug Console</span>
                </div>
                <input
                  type="checkbox"
                  checked={shareConsole}
                  onChange={(e) => setShareConsole(e.target.checked)}
                />
              </div>

            </div>

            <button
              onClick={handleSubmitSolution}
              style={{
                background: 'var(--accent)',
                color: 'var(--bg)',
                border: 'none',
                borderRadius: 8,
                padding: '10px 0',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
                marginTop: 10
              }}
            >
              Verify & Complete Challenge
            </button>
          </div>
        </div>
      )}

      {/* Results / Review Overlay */}
      {showResultsCard && resultsData && (
        <div style={overlayStyle}>
          <div style={resultsCardStyle}>
            <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)', fontWeight: 600,  }}>
              Challenge Finalized
            </span>

            <div style={{ textAlign: 'center', paddingTop: 16, paddingBottom: 16 }}>
              <span style={{ fontSize: 11, fontFamily: "'DM Sans', system-ui, sans-serif", color: 'var(--text-muted)', display: 'block' }}>Score</span>
              <span style={{ fontSize: 48, fontWeight: 400, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
                {resultsData.score}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-dim)', display: 'block' }}>out of {challenge.points} base points</span>
            </div>

            {/* Score Breakdown Table */}
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Elapsed Time taken:</span>
                <span>{resultsData.timeMinutes} minutes</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Hints revealed:</span>
                <span>{resultsData.hintsUsed} (-{resultsData.hintsUsed * 10}%)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 4, fontWeight: 700 }}>
                <span style={{ color: 'var(--accent)' }}>Performance standing:</span>
                <span>{getEstimatedPercentile(resultsData.score, challenge.difficulty)}</span>
              </div>
            </div>

            {/* Reference Solution Solver */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {aiReferenceSolution ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={labelStyle}>AI Model Reference Solution</span>
                  <div style={aiSolutionContainerStyle}>
                    <pre style={{ margin: 0, fontSize: 11, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{aiReferenceSolution}</pre>
                  </div>
                </div>
              ) : (
                <button
                  disabled={loadingAISolution}
                  onClick={handleRequestAIReference}
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-bright)',
                    color: 'var(--accent)',
                    borderRadius: 6,
                    padding: '8px 0',
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  {loadingAISolution ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={11} />}
                  {loadingAISolution ? 'Generating Reference Solution...' : 'View the Reference Solution'}
                </button>
              )}
            </div>

            <button
              onClick={() => {
                setShowResultsCard(false)
                onExit()
              }}
              style={actionButtonStyle}
            >
              Back to Challenges Feed
            </button>

          </div>
        </div>
      )}

    </div>
  )
}

const backButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-muted)',
  borderRadius: 6,
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: 11,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontFamily: "'JetBrains Mono', monospace"
}

const timerBoxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: 'rgba(0,0,0,0.2)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 12,
  fontFamily: "'JetBrains Mono', monospace",
  color: 'var(--text-muted)'
}

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  fontFamily: "'JetBrains Mono', monospace",
  color: 'var(--text-dim)',
  
  
}

const hintCardStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 10
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(4px)',
  zIndex: 1100,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center'
}

const submitModalStyle: React.CSSProperties = {
  width: 460,
  maxHeight: '85vh',
  background: 'var(--surface)',
  border: '1px solid var(--border-bright)',
  borderRadius: 12,
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
  boxSizing: 'border-box'
}

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: 14
}

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6
}

const textareaInputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 8,
  padding: 12,
  fontSize: 12,
  fontFamily: 'inherit',
  outline: 'none',
  resize: 'none',
  height: 90
}

const textInputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 12,
  outline: 'none'
}

const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 12
}

const resultsCardStyle: React.CSSProperties = {
  width: 480,
  maxHeight: '90vh',
  background: 'var(--surface)',
  border: '1px solid var(--border-bright)',
  borderRadius: 12,
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
  boxSizing: 'border-box'
}

const aiSolutionContainerStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.25)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 14,
  maxHeight: 200,
  overflowY: 'auto',
  color: 'var(--text-muted)'
}

const actionButtonStyle: React.CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--bg)',
  border: 'none',
  borderRadius: 8,
  padding: '10px 0',
  fontWeight: 700,
  fontSize: 12,
  fontFamily: "'JetBrains Mono', monospace",
  cursor: 'pointer',
  textAlign: 'center'
}
