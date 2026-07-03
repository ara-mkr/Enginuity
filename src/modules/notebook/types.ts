export type EntryType = 'DECISION' | 'EXPERIMENT' | 'TEST_RESULT' | 'OBSERVATION' | 'PROBLEM' | 'REFERENCE' | 'NOTE'
export type ProblemStatus = 'open' | 'investigating' | 'solved'

export interface BaseEntry {
  id: string
  type: EntryType
  title: string
  tags: string[]
  date: string
  linkedModule: string | null
  attachedFiles: string[]
}

export interface DecisionEntry extends BaseEntry {
  type: 'DECISION'
  context: string
  optionsConsidered: string
  chosenOption: string
  rationale: string
}

export interface ExperimentEntry extends BaseEntry {
  type: 'EXPERIMENT'
  hypothesis: string
  setup: string
  results: string
  conclusion: string
  succeeded: boolean
}

export interface TestResultEntry extends BaseEntry {
  type: 'TEST_RESULT'
  testType: string
  conditions: string
  measurements: Array<{ param: string; value: string; unit: string }>
  passFail: boolean
  notes: string
}

export interface ObservationEntry extends BaseEntry {
  type: 'OBSERVATION'
  description: string
  possibleCauses: string
  followUpNeeded: boolean
}

export interface ProblemEntry extends BaseEntry {
  type: 'PROBLEM'
  description: string
  impact: string
  status: ProblemStatus
  solution: string | null
}

export interface ReferenceEntry extends BaseEntry {
  type: 'REFERENCE'
  source: string
  summary: string
  relevantTo: string
  url: string | null
}

export interface NoteEntry extends BaseEntry {
  type: 'NOTE'
  content: string
}

export type NotebookEntry =
  | DecisionEntry
  | ExperimentEntry
  | TestResultEntry
  | ObservationEntry
  | ProblemEntry
  | ReferenceEntry
  | NoteEntry

export const ENTRY_META: Record<EntryType, { label: string; color: string }> = {
  DECISION:    { label: 'Decision',    color: 'var(--accent)' },
  EXPERIMENT:  { label: 'Experiment',  color: '#c084fc' }, // Pastel Purple
  TEST_RESULT: { label: 'Test Result', color: '#86efac' }, // Pastel Green
  OBSERVATION: { label: 'Observation', color: '#fde047' }, // Pastel Yellow
  PROBLEM:     { label: 'Problem',     color: '#fca5a5' }, // Pastel Red
  REFERENCE:   { label: 'Reference',   color: '#cbd5e1' }, // Pastel Slate
  NOTE:        { label: 'Note',        color: 'var(--text-muted)' },
}

export const MODULE_LINKS = [
  'Dashboard', 'CAD Viewer', 'Parameters', 'Asset Gen',
  'Simulation', 'Project Ideas', 'Debug Console',
  'Model Compare', 'Circuit Sim', 'Collaborate', 'Datasheet',
]

export const STORAGE_KEY = 'enginguity_notebook'

export interface AIInsight {
  type: string
  description: string
  relatedEntryIds: string[]
}

export interface SurfaceResult {
  recurringIssues: AIInsight[]
  unresolvedThreads: AIInsight[]
  decisionsToRevisit: AIInsight[]
  knowledgeGaps: AIInsight[]
  timelineAnomalies: AIInsight[]
  suggestedNextEntries: AIInsight[]
}
