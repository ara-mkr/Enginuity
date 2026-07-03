export interface Challenge {
  id: string
  title: string
  category: 'analog' | 'digital' | 'power' | 'mechanical' | 'signal_processing' | 'algorithm' | 'mixed'
  difficulty: 'entry' | 'intermediate' | 'advanced' | 'expert'
  points: number
  timeLimit: null | number // in minutes
  postedDate: string
  expiresDate: string | null
  brief: string
  constraints: string[]
  evaluation_criteria: string[]
  hints: string[]
  referenceLinks: { title: string; url: string }[]
  solutionShareUrl: null | string
  submissionCount: number
}

export interface ChallengeWorkspaceState {
  playgroundState?: any
  circuitState?: any
  formulaQuery?: string
  consoleCode?: string
  notebookNotes?: string
  checkedConstraints?: string[]
}

export interface ChallengeHistoryEntry {
  challengeId: string
  score: number
  completedAt: string
  timeMinutes: number
  hintsUsed: number
  description: string
  shareUrl?: string
  aiSolution?: string
}

export interface LeaderboardEntry {
  rank: number
  username: string
  score: number
  time: string
  sharedLink?: string
}
