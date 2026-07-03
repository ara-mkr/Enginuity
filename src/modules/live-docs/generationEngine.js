import { getDraft, updateSection, getDocSettings } from './docWatcher'
import { moduleStateStore } from '../../store/moduleState'

// ── Section configs ────────────────────────────────────────────────────────

export const SECTION_ORDER = [
  'overview', 'methodology', 'parameters', 'components',
  'simulation', 'testing', 'results', 'decisions', 'issues', 'references'
]

export const SECTION_CONFIGS = {
  overview: {
    title: 'Project Overview',
    observationTypes: ['PROJECT_CONTEXT_SET', 'SESSION_STARTED'],
    autoGenerate: true,
    prompt: (obs, state) => `Write a professional project overview section for a technical engineering document.

Project context: ${state.projectContext || '(not set)'}
Tags/components: ${state.tags?.join(', ') || '(none)'}
Session count: ${state.sessionCount || 1}
Date started: ${obs[0] ? new Date(obs[0].timestamp).toLocaleDateString() : new Date().toLocaleDateString()}
Total observations: ${obs.length}

Write 2-3 paragraphs covering:
1. What is being built and why
2. Key technical scope and constraints
3. Current project stage

Write in professional technical documentation style. Past tense for completed work, present for ongoing. No bullet points. Flowing paragraphs. If there is little context, write what you can infer from the observations available.`
  },

  methodology: {
    title: 'Design Methodology',
    observationTypes: ['PARAMETER_SETUP_CREATED', 'FILE_LOADED', 'NOTEBOOK_ENTRY_ADDED', 'TEMPLATE_LOADED'],
    autoGenerate: true,
    prompt: (obs) => `Write a methodology section describing the engineering approach taken.

Observations:
${obs.map(formatObs).join('\n')}

Cover:
1. Design tools and workflow used
2. Analysis approach (parametric, simulation, etc.)
3. Key design decisions made early
4. Files and references used

Professional technical writing. 2-3 paragraphs. No bullet points. If observations are sparse, focus on the tools and workflow observed.`
  },

  parameters: {
    title: 'Design Parameters',
    observationTypes: ['PARAMETER_CHANGED', 'PARAMETER_SETUP_CREATED'],
    autoGenerate: false,
    generate: (obs, state) => {
      const params = state.playground?.parameters || {}
      const outputs = state.playground?.outputs || {}
      return {
        type: 'parameter_table',
        parameters: Object.entries(params).map(([name, p]) => ({
          name: p.label || name,
          value: p.value,
          unit: p.unit || '',
          min: p.min ?? '',
          max: p.max ?? '',
          description: p.description || ''
        })),
        outputs: Object.entries(outputs).map(([name, o]) => ({
          name: o.label || name,
          value: o.value,
          unit: o.unit || '',
          formula: o.formula || ''
        })),
        recentChanges: obs.filter(o => o.type === 'PARAMETER_CHANGED').slice(-10)
      }
    }
  },

  components: {
    title: 'Bill of Materials',
    observationTypes: ['BOM_FINALIZED', 'BOM_UPDATED'],
    autoGenerate: false,
    generate: (obs, state) => {
      const bom = state.bom || []
      return {
        type: 'bom_table',
        items: bom,
        totalCost: bom.reduce((sum, item) => sum + ((item.unitPrice || 0) * (item.quantity || 1)), 0),
        itemCount: bom.length
      }
    }
  },

  simulation: {
    title: 'Simulation & Analysis',
    observationTypes: ['AI_ANALYSIS_RUN', 'SIMULATION_RUN', 'CAD_ANALYSIS_RUN'],
    autoGenerate: true,
    prompt: (obs) => `Write a simulation and analysis section for a technical engineering document.

Analysis results from the session:
${obs.map(formatObs).join('\n') || '(no simulations recorded yet)'}

Cover each analysis performed:
- What was analyzed
- Method used
- Key findings
- Any issues discovered

Technical but readable. Use subsections if multiple analyses. Cite specific values where known. If no simulations have been run, write a brief placeholder.`
  },

  testing: {
    title: 'Testing & Validation',
    observationTypes: ['CODE_EXECUTED', 'JARVIS_MEASUREMENT', 'SERIAL_CONNECTED', 'NOTEBOOK_ENTRY_ADDED'],
    autoGenerate: true,
    prompt: (obs) => {
      const measurements = obs.filter(o => o.type === 'JARVIS_MEASUREMENT')
        .map(o => `${o.data.primaryReading?.value} ${o.data.primaryReading?.unit} (${o.data.instrumentType || 'measurement'})`)
        .join('\n') || '(none recorded)'
      const code = obs.filter(o => o.type === 'CODE_EXECUTED')
        .map(o => `${o.data.filename || 'script'}: ${o.data.result || 'executed'}`)
        .join('\n') || '(none recorded)'
      return `Write a testing and validation section.

Testing activities observed:
${obs.map(formatObs).join('\n') || '(none recorded)'}

Measurements taken:
${measurements}

Code executed:
${code}

Cover: test setup, measurements with values, code/firmware validation results, pass/fail outcomes. Include specific values. Technical tone. If no testing data exists, note that testing is pending.`
    }
  },

  results: {
    title: 'Results & Findings',
    observationTypes: ['CAD_ANALYSIS_RUN', 'AI_ANALYSIS_RUN', 'NOTEBOOK_ENTRY_ADDED', 'JARVIS_MEASUREMENT'],
    autoGenerate: true,
    prompt: (obs) => `Write a results and findings section.

All results observed during this project:
${obs.map(formatObs).join('\n') || '(no results recorded yet)'}

Synthesize the key findings:
1. What worked as expected
2. What was discovered or unexpected
3. Key measurements and their significance
4. Current state of the design

Objective, factual tone. Reference specific values. 2-4 paragraphs.`
  },

  decisions: {
    title: 'Design Decisions',
    observationTypes: ['NOTEBOOK_ENTRY_ADDED'],
    autoGenerate: false,
    generate: (obs) => {
      const decisions = obs
        .filter(o => o.type === 'NOTEBOOK_ENTRY_ADDED' && o.data.entryType === 'DECISION')
        .map(o => o.data)
      return { type: 'decisions_list', decisions }
    }
  },

  issues: {
    title: 'Issues & Resolutions',
    observationTypes: ['NOTEBOOK_ENTRY_ADDED'],
    autoGenerate: false,
    generate: (obs) => {
      let problems = []
      try {
        problems = JSON.parse(localStorage.getItem('enginguity_notebook') || '[]')
          .filter(e => e.type === 'PROBLEM')
          .map(p => ({
            title: p.title,
            description: p.content,
            status: p.status || 'open',
            solution: p.solution || null,
            date: p.createdAt
          }))
      } catch { /* ignore */ }
      return { type: 'issues_table', problems }
    }
  },

  references: {
    title: 'References & Resources',
    observationTypes: ['FILE_LOADED', 'JARVIS_COMMAND'],
    autoGenerate: false,
    generate: (obs) => {
      const files = obs
        .filter(o => o.type === 'FILE_LOADED')
        .map(o => ({ type: 'file', name: o.data.filename, format: o.data.format, date: o.timestamp }))
      const links = obs
        .filter(o => o.type === 'JARVIS_COMMAND' && o.data.intent === 'youtube_search')
        .map(o => ({ type: 'video', title: o.data.title, url: o.data.url, date: o.timestamp }))
      return { type: 'references_list', references: [...files, ...links] }
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function formatObs(obs) {
  const time = new Date(obs.timestamp).toLocaleString()
  switch (obs.type) {
    case 'PARAMETER_CHANGED':
      return `[${time}] Parameter "${obs.data.paramName}" changed from ${obs.data.oldValue}${obs.data.unit || ''} to ${obs.data.newValue}${obs.data.unit || ''}`
    case 'FILE_LOADED':
      return `[${time}] Loaded file: ${obs.data.filename} (${obs.data.format || 'unknown format'})`
    case 'CAD_ANALYSIS_RUN':
      return `[${time}] CAD Analysis: ${obs.data.analysisText?.slice(0, 300) || ''}`
    case 'AI_ANALYSIS_RUN':
      return `[${time}] AI Analysis (${obs.data.module || 'unknown'}): ${obs.data.analysisText?.slice(0, 300) || ''}`
    case 'SIMULATION_RUN':
      return `[${time}] Simulation: ${obs.data.circuitType || 'circuit'} — ${obs.data.result?.slice(0, 200) || ''}`
    case 'NOTEBOOK_ENTRY_ADDED':
      return `[${time}] Notebook ${obs.data.entryType || 'entry'}: ${obs.data.title || ''} — ${obs.data.content?.slice(0, 200) || ''}`
    case 'JARVIS_MEASUREMENT':
      return `[${time}] Measurement: ${obs.data.primaryReading?.value} ${obs.data.primaryReading?.unit} (${obs.data.instrumentType || 'instrument'})`
    case 'CODE_EXECUTED':
      return `[${time}] Code executed: ${obs.data.filename || 'script'} (${obs.data.language || 'unknown'}) — ${obs.data.result || 'ran'}`
    default:
      return `[${time}] ${obs.type}: ${JSON.stringify(obs.data || {}).slice(0, 100)}`
  }
}

function buildCurrentState() {
  const state = moduleStateStore.getState()
  let projectContext = ''
  let tags = []
  try {
    const proj = JSON.parse(localStorage.getItem('enginguity_project_context') || '{}')
    projectContext = proj.description || ''
    tags = proj.tags || []
  } catch { /* ignore */ }
  return {
    projectContext,
    tags,
    sessionCount: 1,
    playground: state.moduleData?.playground || null,
    bom: state.moduleData?.bom || null,
    ...state.moduleData
  }
}

// ── Core generation ────────────────────────────────────────────────────────

export async function generateSection(sectionKey, makeRequest, onProgress) {
  const config = SECTION_CONFIGS[sectionKey]
  if (!config) return null

  const draft = getDraft()
  const allObs = draft.rawObservations || []
  const settings = getDocSettings()

  const relevant = allObs.filter(obs =>
    config.observationTypes.includes(obs.type) &&
    (!config.filterFn || config.filterFn(obs))
  )

  if (!config.autoGenerate) {
    const result = config.generate(relevant, buildCurrentState())
    updateSection(sectionKey, result)
    onProgress?.(sectionKey, result)
    return result
  }

  if (relevant.length === 0 && sectionKey !== 'overview') {
    const empty = { type: 'prose', content: '', generatedAt: Date.now(), empty: true }
    updateSection(sectionKey, empty)
    onProgress?.(sectionKey, empty)
    return empty
  }

  const depth = settings.technicalDepth || 'standard'
  const depthInstruction = {
    summary: 'Write only 1 concise paragraph. Be brief.',
    standard: 'Write 2-3 paragraphs.',
    detailed: 'Write in full technical depth with no word limit.'
  }[depth] || 'Write 2-3 paragraphs.'

  const state = buildCurrentState()
  const promptText = typeof config.prompt === 'function'
    ? config.prompt(relevant, state)
    : config.prompt

  const system = `You are a technical writer generating sections of a professional engineering document. Write in clear, precise technical English. Past tense for completed work. Active voice. No bullet points unless listing items explicitly. No marketing language. Just facts and analysis. Be specific with numbers and measurements. ${depthInstruction}`

  const lang = settings.language || 'English'
  const langInstruction = lang !== 'English' ? `\n\nWrite the section in ${lang}.` : ''

  try {
    const response = await makeRequest(
      [{ role: 'user', content: promptText + langInstruction }],
      system
    )
    const result = {
      type: 'prose',
      content: response,
      generatedAt: Date.now(),
      basedOnObservations: relevant.map(o => o.id)
    }
    updateSection(sectionKey, result)
    onProgress?.(sectionKey, result)
    return result
  } catch (err) {
    const errResult = { type: 'prose', content: '', error: String(err), generatedAt: Date.now() }
    updateSection(sectionKey, errResult)
    onProgress?.(sectionKey, errResult)
    return errResult
  }
}

export async function generateAllSections(makeRequest, onProgress) {
  // Instant structured sections first
  const instant = ['parameters', 'components', 'decisions', 'issues', 'references']
  instant.forEach(key => generateSection(key, makeRequest, onProgress))

  // AI sections in parallel
  const ai = ['overview', 'methodology', 'simulation', 'testing', 'results']
  await Promise.all(ai.map(key => generateSection(key, makeRequest, onProgress)))
}

// ── Export helpers ─────────────────────────────────────────────────────────

export function docToMarkdown(draft, title) {
  const lines = []
  const date = new Date().toLocaleDateString()
  lines.push(`# ${title || draft.title || 'Engineering Document'}`)
  lines.push(`*Generated ${date} · ENGINGUITY*`)
  lines.push('')

  SECTION_ORDER.forEach(key => {
    const config = SECTION_CONFIGS[key]
    const section = draft.sections[key]
    if (!section) return

    lines.push(`## ${config.title}`)
    lines.push('')

    if (section.type === 'prose') {
      lines.push(section.content || '*No content generated.*')
    } else if (section.type === 'parameter_table') {
      if (section.parameters?.length) {
        lines.push('| Parameter | Value | Unit | Min | Max | Description |')
        lines.push('|-----------|-------|------|-----|-----|-------------|')
        section.parameters.forEach(p => {
          lines.push(`| ${p.name} | ${p.value} | ${p.unit} | ${p.min} | ${p.max} | ${p.description} |`)
        })
      }
      if (section.outputs?.length) {
        lines.push('')
        lines.push('**Computed Outputs**')
        lines.push('')
        lines.push('| Output | Value | Unit | Formula |')
        lines.push('|--------|-------|------|---------|')
        section.outputs.forEach(o => {
          lines.push(`| ${o.name} | ${o.value} | ${o.unit} | ${o.formula} |`)
        })
      }
    } else if (section.type === 'bom_table') {
      if (section.items?.length) {
        lines.push('| # | Part | Description | Qty | Unit Price | Total |')
        lines.push('|---|------|-------------|-----|------------|-------|')
        section.items.forEach((item, i) => {
          const total = ((item.unitPrice || 0) * (item.quantity || 1)).toFixed(2)
          lines.push(`| ${i + 1} | ${item.mpn || item.name || ''} | ${item.description || ''} | ${item.quantity || 1} | $${item.unitPrice?.toFixed(2) || '—'} | $${total} |`)
        })
        lines.push(`\n*Total estimated cost: $${section.totalCost?.toFixed(2)}*`)
      } else {
        lines.push('*No BOM data available.*')
      }
    } else if (section.type === 'decisions_list') {
      if (section.decisions?.length) {
        section.decisions.forEach(d => {
          lines.push(`**${d.title || 'Decision'}** — *${new Date(d.createdAt || Date.now()).toLocaleDateString()}*`)
          lines.push(d.content || d.rationale || '')
          lines.push('')
        })
      } else {
        lines.push('*No design decisions recorded.*')
      }
    } else if (section.type === 'issues_table') {
      if (section.problems?.length) {
        lines.push('| Issue | Status | Resolution |')
        lines.push('|-------|--------|------------|')
        section.problems.forEach(p => {
          lines.push(`| ${p.title} | ${p.status} | ${p.solution || '—'} |`)
        })
      } else {
        lines.push('*No issues recorded.*')
      }
    } else if (section.type === 'references_list') {
      if (section.references?.length) {
        section.references.forEach((ref, i) => {
          if (ref.type === 'file') {
            lines.push(`[${i + 1}] ${ref.name} — ${ref.format || 'File'} — ${new Date(ref.date).toLocaleDateString()}`)
          } else {
            lines.push(`[${i + 1}] ${ref.title || ref.url} — ${new Date(ref.date).toLocaleDateString()}`)
          }
        })
      } else {
        lines.push('*No references recorded.*')
      }
    }

    lines.push('')
  })

  if (getDocSettings().includeRawObservations) {
    lines.push('## Appendix: Raw Observations')
    lines.push('')
    ;(draft.rawObservations || []).forEach(o => {
      lines.push(`- [${new Date(o.timestamp).toLocaleString()}] **${o.type}**: ${JSON.stringify(o.data).slice(0, 120)}`)
    })
    lines.push('')
  }

  lines.push('---')
  lines.push('*Generated with [ENGINGUITY](https://enginguity.app)*')

  return lines.join('\n')
}
