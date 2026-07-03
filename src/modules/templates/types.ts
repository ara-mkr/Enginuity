export interface TemplateParameter {
  name: string
  label: string
  min: number
  max: number
  default: number
  unit: string
}

export interface TemplateEquation {
  outputName: string
  label: string
  formula_js: string
  unit: string
}

export interface TemplatePlayground {
  description: string
  parameters: TemplateParameter[]
  equations: TemplateEquation[]
}

export interface TemplateStarterCode {
  language: string
  filename: string
  content: string
}

export interface TemplateBOMItem {
  quantity: number
  description: string
  value: string
  package: string
  notes: string
}

export interface TemplateNotebookEntry {
  type: 'DECISION' | 'PLAN' | 'OBSERVATION' | 'TODO'
  title: string
  content: string
}

export interface TemplateResource {
  title: string
  url: string
  type: 'datasheet' | 'reference' | 'tutorial'
}

export interface TemplateProjectContext {
  description: string
  tags: string[]
}

export interface ProjectTemplate {
  id: string
  name: string
  tagline: string
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  estimatedHours: number
  tags: string[]
  thumbnail: string // SVG string
  projectContext: TemplateProjectContext
  parameterPlayground: TemplatePlayground
  starterCode: TemplateStarterCode | null
  bomStarter: TemplateBOMItem[]
  notebookEntries: TemplateNotebookEntry[]
  resources: TemplateResource[]
}

export interface TemplateLoadLog {
  templateId: string
  templateName: string
  loadedAt: string
}
