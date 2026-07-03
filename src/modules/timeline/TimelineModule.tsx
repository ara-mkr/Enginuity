import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search, Calendar, Download, Sparkles, Sliders, Play, CheckCircle,
  AlertTriangle, ArrowRight, X, Clock, HelpCircle, LayoutDashboard,
  Cpu, Database, Network, ChevronDown, ChevronRight, Filter, RefreshCw,
  Box, BookOpen, ClipboardList, Radio, History, Terminal, Info, Library
} from 'lucide-react'
import { useAIProvider } from '../../hooks/useAIProvider'
import { useProbeContext } from '../../hooks/useProbeContext'

// Helper for human-readable description of event
function getEventDescription(e: any): string {
  const d = e.data || {}
  switch (e.type) {
    case 'FILE_LOADED':
      return `Loaded 3D file "${d.filename}" in format "${(d.format || '').toUpperCase()}"`
    case 'PARAMETER_CHANGED':
      return `Adjusted parameter "${d.paramName}" from "${d.oldValue}" to "${d.newValue}"${d.unit ? ` ${d.unit}` : ''}`
    case 'NOTEBOOK_ENTRY_ADDED':
      return `Added new engineering notebook entry: "${d.title}" (Type: ${d.type})`
    case 'NOTEBOOK_PROBLEM_SOLVED':
      return `Marked notebook problem as solved: "${d.title}"`
    case 'BOM_UPDATED':
      if (d.action === 'add') return `Added new empty row to Bill of Materials`
      if (d.action === 'delete') return `Deleted part "${d.partNumber || ''}" (${d.description || ''}) from BOM`
      if (d.action === 'edit') return `Edited BOM item "${d.partNumber || ''}": changed "${d.field}" from "${d.oldValue}" to "${d.newValue}"`
      if (d.action === 'merge') return `Merged ${d.count} duplicate rows for part "${d.partNumber || ''}"`
      if (d.action === 'import_excel') return `Imported BOM from Excel file "${d.filename || ''}" (${d.count} items)`
      if (d.action === 'import_csv') return `Imported BOM from CSV file "${d.filename || ''}" (${d.count} items)`
      if (d.action === 'import_kicad') return `Imported BOM from KiCad file "${d.filename || ''}" (${d.count} items)`
      if (d.action === 'import_paste') return `Pasted and parsed BOM list via AI (${d.count} items)`
      if (d.action === 'swap') return `Swapped part "${d.oldPartNumber || ''}" with alternative "${d.newPartNumber || ''}"`
      return `Updated Bill of Materials: action "${d.action}"`
    case 'BOM_ALERT':
      if (d.type === 'out_of_stock') return `⚠️ Out of Stock warning for part "${d.partNumber || ''}"`
      return `⚠️ BOM warning for "${d.partNumber || ''}": ${d.message}`
    case 'AI_ANALYSIS_RUN':
      return `Ran AI assistant message (estimated tokens: ${d.tokens}) using model "${d.model || ''}"`
    case 'MODEL_SWITCHED':
      return `Switched default AI provider model from "${d.oldModel || ''}" to "${d.newModel || ''}"`
    case 'LAYOUT_SAVED':
      return `Saved custom window layout preset: "${d.name}" (${d.windowsCount} active panels)`
    case 'LAYOUT_RESTORED':
      return `Restored window layout preset: "${d.name}"`
    case 'SERIAL_CONNECTED':
      return `Opened hardware serial port connection at ${d.baudRate} baud`
    case 'CODE_EXECUTED':
      if (d.status === 'success') {
        const timeStr = d.language === 'Python' ? `${d.elapsedSeconds}s` : `${d.elapsedMs}ms`
        return `Successfully ran ${d.language} code snippet in ${timeStr}`
      }
      return `Failed to run ${d.language} code snippet: ${d.error}`
    case 'TEMPLATE_LOADED':
      return `Initialized new project from template: "${d.templateName}" (Category: ${d.category})`
    case 'EXPORT_CREATED':
      return `Exported module ${d.module} as ${(d.format || '').toUpperCase()} to target "${d.target}"`
    case 'SUPPLY_CHAIN_ALERT':
      return `Supply chain alert for "${d.partNumber || ''}": ${d.detail}`
    case 'COLLABORATION_STARTED':
      return `Joined live collaborative room "${d.roomId}" as user "${d.userName}"`
    case 'VERSION_RESTORED':
      return `Restored version snapshot "${d.label || ''}" for module ${d.moduleId}`
    case 'SESSION_STARTED':
      return `Session started on route "${d.pathname}" (Module: ${d.module})`
    case 'SESSION_ENDED':
      return `Session completed on route "${d.pathname}" (Duration: ${d.durationMinutes} minutes)`
    case 'FOCUS_MODE_TOGGLED':
      return `Focus Mode ${d.enabled ? 'activated' : 'deactivated'} in module "${d.module}"`
    case 'SIMULATION_RUN':
      return d.status === 'success'
        ? `Ran ${d.analysisType} simulation (${d.componentCount} components${d.warningCount ? `, ${d.warningCount} warnings` : ''})`
        : `Simulation failed (${d.analysisType}): ${d.error || 'solver error'}`
    case 'DATASHEET_ANALYZED':
      return `Extracted datasheet intelligence for "${d.partNumber}" from "${d.fileName}"`
    case 'FORMULA_CALCULATED':
      return `Calculated "${d.interpretedAs}" → ${d.result}`
    case 'MODELS_COMPARED':
      return `Compared ${(d.models || []).length} AI models (${d.succeeded} succeeded${d.failed ? `, ${d.failed} failed` : ''})`
    case 'IDEAS_GENERATED':
      return `Generated ${d.count} project ideas (complexity: ${d.complexity})`
    case 'ASSET_GENERATED':
      return `Generated ${d.assetType} asset "${d.label}"`
    case 'CHALLENGE_SUBMITTED':
      return `Submitted solution for challenge "${d.title}" (score: ${d.score})`
    case 'FIRMWARE_DIFF_ANALYZED':
      return `AI-analyzed firmware diff "${d.fileA}" vs "${d.fileB}" (${d.riskCount} risks)`
    case 'PCB_REVIEWED':
      return `Reviewed PCB "${d.fileName}" — ${d.rating} (${d.criticalIssues} critical, ${d.warnings} warnings)`
    case 'FOOTPRINT_EXPORTED':
      return `Exported KiCad footprint "${d.packageName}" to ${d.target}`
    case 'COMPLIANCE_CHECKED':
      return `Generated compliance roadmap for "${d.productType}" (${d.certifications} certifications, ${d.complexity} complexity)`
    case 'TESTS_RUN':
      return `Ran ${d.total} tests on ${d.functionName}: ${d.passed} passed, ${d.failed} failed`
    case 'DOC_GENERATED':
      return `Generated live document "${d.title}" (${d.sections} sections)`
    case 'TOOL_INSTALLED':
      return `Installed tool "${d.toolLabel}" from the marketplace`
    case 'TOOL_UNINSTALLED':
      return `Removed tool "${d.toolLabel}" from the sidebar`
    case 'PROJECT_SUMMARY_GENERATED':
      return `Generated AI project summary (${d.tagCount} tags, ${d.fileCount} files in context)`
    case 'PROJECT_BLUEPRINT_EXTRACTED':
      return `Extracted project blueprint "${d.title}" (${d.componentCount} components)`
    case 'BOARD_CREATED':
      return `Created new drawing board "${d.name}"`
    case 'JARVIS_COMMAND':
      return `Voice command: "${d.transcriptPreview}"`
    default:
      return `Triggered timeline event "${e.type}"`
  }
}

// Icon mapper for event type
const EVENT_ICONS: Record<string, any> = {
  FILE_LOADED: Box,
  PARAMETER_CHANGED: Sliders,
  NOTEBOOK_ENTRY_ADDED: BookOpen,
  NOTEBOOK_PROBLEM_SOLVED: CheckCircle,
  BOM_UPDATED: ClipboardList,
  BOM_ALERT: AlertTriangle,
  AI_ANALYSIS_RUN: Sparkles,
  MODEL_SWITCHED: Cpu,
  LAYOUT_SAVED: LayoutDashboard,
  LAYOUT_RESTORED: RefreshCw,
  SERIAL_CONNECTED: Network,
  CODE_EXECUTED: Terminal,
  TEMPLATE_LOADED: Library,
  EXPORT_CREATED: Download,
  SUPPLY_CHAIN_ALERT: AlertTriangle,
  COLLABORATION_STARTED: Radio,
  VERSION_RESTORED: History,
  SESSION_STARTED: Clock,
  SESSION_ENDED: Clock,
  FOCUS_MODE_TOGGLED: Sliders,
  SIMULATION_RUN: Play,
  DATASHEET_ANALYZED: Database,
  FORMULA_CALCULATED: BookOpen,
  MODELS_COMPARED: Cpu,
  IDEAS_GENERATED: Sparkles,
  ASSET_GENERATED: Box,
  CHALLENGE_SUBMITTED: CheckCircle,
  FIRMWARE_DIFF_ANALYZED: Terminal,
  PCB_REVIEWED: ClipboardList,
  FOOTPRINT_EXPORTED: Download,
  COMPLIANCE_CHECKED: CheckCircle,
  TESTS_RUN: Play,
  DOC_GENERATED: BookOpen,
  TOOL_INSTALLED: Box,
  TOOL_UNINSTALLED: X,
  PROJECT_SUMMARY_GENERATED: LayoutDashboard,
  PROJECT_BLUEPRINT_EXTRACTED: Box,
  BOARD_CREATED: LayoutDashboard,
  JARVIS_COMMAND: Radio,
}

const EVENT_COLORS: Record<string, string> = {
  FILE_LOADED: '#7dd3fc', // Pastel Blue
  PARAMETER_CHANGED: 'rgba(130,110,170,0.15)', // Pastel Purple
  NOTEBOOK_ENTRY_ADDED: '#a7f3d0', // Pastel Green
  NOTEBOOK_PROBLEM_SOLVED: 'rgba(100,150,110,0.15)', // Soft Pastel Green
  BOM_UPDATED: 'rgba(150,130,80,0.15)', // Pastel Yellow
  BOM_ALERT: 'rgba(160,100,100,0.18)', // Pastel Red
  AI_ANALYSIS_RUN: 'rgba(160,100,130,0.15)', // Pastel Pink
  MODEL_SWITCHED: '#c7d2fe', // Pastel Indigo
  LAYOUT_SAVED: '#99f6e4', // Pastel Teal
  LAYOUT_RESTORED: '#a5f3fc', // Pastel Cyan
  SERIAL_CONNECTED: 'rgba(160,130,90,0.15)', // Pastel Orange
  CODE_EXECUTED: '#e2f0d9', // Pastel Lime/Sage
  TEMPLATE_LOADED: 'rgba(100,130,170,0.15)', // Pastel Light Blue
  EXPORT_CREATED: 'rgba(160,100,100,0.15)', // Pastel Rose
  SUPPLY_CHAIN_ALERT: 'rgba(160,130,90,0.12)', // Soft Pastel Orange
  COLLABORATION_STARTED: 'rgba(100,130,170,0.15)', // Pastel Light Blue
  VERSION_RESTORED: '#ddd6fe', // Pastel Lavender
  SESSION_STARTED: 'rgba(100,150,110,0.15)', // Pastel Green
  SESSION_ENDED: '#cbd5e1', // Pastel Gray
  FOCUS_MODE_TOGGLED: 'rgba(160,100,100,0.15)', // Pastel Rose
  SIMULATION_RUN: 'rgba(122,180,196,0.15)', // Steel Blue
  DATASHEET_ANALYZED: 'rgba(100,130,170,0.15)', // Pastel Light Blue
  FORMULA_CALCULATED: 'rgba(130,110,170,0.15)', // Pastel Purple
  MODELS_COMPARED: '#c7d2fe', // Pastel Indigo
  IDEAS_GENERATED: 'rgba(160,100,130,0.15)', // Pastel Pink
  ASSET_GENERATED: 'rgba(150,130,80,0.15)', // Pastel Yellow
  CHALLENGE_SUBMITTED: 'rgba(100,150,110,0.15)', // Pastel Green
  FIRMWARE_DIFF_ANALYZED: '#e2f0d9', // Pastel Lime/Sage
  PCB_REVIEWED: 'rgba(150,130,80,0.15)', // Pastel Yellow
  FOOTPRINT_EXPORTED: 'rgba(160,100,100,0.15)', // Pastel Rose
  COMPLIANCE_CHECKED: 'rgba(100,150,110,0.15)', // Pastel Green
  TESTS_RUN: 'rgba(122,170,138,0.15)', // Sage
  DOC_GENERATED: '#99f6e4', // Pastel Teal
  TOOL_INSTALLED: '#a5f3fc', // Pastel Cyan
  TOOL_UNINSTALLED: '#cbd5e1', // Pastel Gray
  PROJECT_SUMMARY_GENERATED: 'rgba(100,130,170,0.15)', // Pastel Light Blue
  PROJECT_BLUEPRINT_EXTRACTED: 'rgba(122,180,196,0.15)', // Steel Blue
  BOARD_CREATED: '#ddd6fe', // Pastel Lavender
  JARVIS_COMMAND: 'rgba(148,133,184,0.15)', // Mauve
}

interface AIInsights {
  bottlenecks: string[]
  patterns: string[]
  recommendations: string[]
}

export function TimelineModule() {
  const [events, setEvents] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('all')
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null)
  
  // UI states
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({})
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({})
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [insights, setInsights] = useState<AIInsights | null>(null)
  const [insightsError, setInsightsError] = useState<string | null>(null)
  const [tokenEstimate, setTokenEstimate] = useState<number>(0)

  const { makeRequest, apiKey } = useAIProvider()

  useProbeContext('timeline', {
    eventCount: events.length,
    search: search || null,
    dateRange,
    moduleFilters: selectedModules,
    hasInsights: !!insights,
  })

  // Load events & seed if empty
  const loadLogEvents = useCallback(() => {
    let log = []
    try {
      log = JSON.parse(localStorage.getItem('enginguity_event_log') || '[]')
    } catch {
      log = []
    }

    if (log.length === 0) {
      const mockEvents = [
        {
          id: 'mock-1',
          type: 'TEMPLATE_LOADED',
          timestamp: Date.now() - 36 * 3600 * 1000,
          module: 'workspace',
          data: { templateId: 'keyboard-split-ergo', templateName: 'Split Ergonomic Keyboard (42-key)', category: 'Community' }
        },
        {
          id: 'mock-2',
          type: 'FILE_LOADED',
          timestamp: Date.now() - 35 * 3600 * 1000,
          module: 'cad-viewer',
          data: { filename: 'split_keyboard_left.3mf', format: '3mf' }
        },
        {
          id: 'mock-3',
          type: 'PARAMETER_CHANGED',
          timestamp: Date.now() - 30 * 3600 * 1000,
          module: 'parameter-playground',
          data: { paramName: 'debounce_ms', oldValue: 5, newValue: 10, unit: 'ms' }
        },
        {
          id: 'mock-4',
          type: 'NOTEBOOK_ENTRY_ADDED',
          timestamp: Date.now() - 25 * 3600 * 1000,
          module: 'notebook',
          data: { type: 'DECISION', title: 'Adopt RP2040 over Pro Micro' }
        },
        {
          id: 'mock-5',
          type: 'BOM_UPDATED',
          timestamp: Date.now() - 20 * 3600 * 1000,
          module: 'bom',
          data: { action: 'import_kicad', filename: 'main_pcb.xml', count: 12 }
        },
        {
          id: 'mock-6',
          type: 'BOM_ALERT',
          timestamp: Date.now() - 19 * 3600 * 1000,
          module: 'bom',
          data: { type: 'out_of_stock', partNumber: 'SSD1306 OLED', message: 'SSD1306 OLED is currently out of stock.' }
        },
        {
          id: 'mock-7',
          type: 'CODE_EXECUTED',
          timestamp: Date.now() - 10 * 3600 * 1000,
          module: 'debug',
          data: { language: 'Python', code: 'print("Testing key matrix...")', status: 'success', elapsedSeconds: 0.12 }
        },
        {
          id: 'mock-8',
          type: 'SESSION_STARTED',
          timestamp: Date.now() - 50 * 60 * 1000,
          module: 'workspace',
          data: { pathname: '/timeline', module: 'timeline' }
        },
        {
          id: 'mock-9',
          type: 'SESSION_ENDED',
          timestamp: Date.now() - 20 * 60 * 1000,
          module: 'workspace',
          data: { pathname: '/timeline', durationMinutes: 30, module: 'timeline' }
        }
      ]
      localStorage.setItem('enginguity_event_log', JSON.stringify(mockEvents))
      log = mockEvents
    }

    log.sort((a: any, b: any) => b.timestamp - a.timestamp)
    setEvents(log)
  }, [])

  useEffect(() => {
    loadLogEvents()
    const handler = () => {
      loadLogEvents()
    }
    window.addEventListener('enginguity:event_logged', handler)
    return () => window.removeEventListener('enginguity:event_logged', handler)
  }, [loadLogEvents])

  // Categorize event type
  const getEventCategory = (type: string): string => {
    if (['FILE_LOADED', 'EXPORT_CREATED'].includes(type)) return 'Files'
    if (['PARAMETER_CHANGED', 'BOM_UPDATED', 'LAYOUT_SAVED', 'LAYOUT_RESTORED', 'VERSION_RESTORED'].includes(type)) return 'Changes'
    if (['AI_ANALYSIS_RUN', 'MODEL_SWITCHED'].includes(type)) return 'AI'
    if (['NOTEBOOK_PROBLEM_SOLVED', 'BOM_ALERT', 'SUPPLY_CHAIN_ALERT', 'NOTEBOOK_ENTRY_ADDED'].includes(type)) return 'Problems'
    if (['SESSION_STARTED', 'SESSION_ENDED', 'FOCUS_MODE_TOGGLED'].includes(type)) return 'Sessions'
    return 'Other'
  }

  // List of available modules & categories for filter chips
  const modulesList = useMemo(() => {
    return Array.from(new Set(events.map(e => e.module || 'global'))).sort()
  }, [events])

  const categoriesList = ['Files', 'Changes', 'AI', 'Problems', 'Sessions']

  // Filter implementation
  const filteredEvents = useMemo(() => {
    let result = [...events]

    // 1. Date Range
    const now = Date.now()
    if (dateRange === 'today') {
      const startOfToday = new Date().setHours(0,0,0,0)
      result = result.filter(e => e.timestamp >= startOfToday)
    } else if (dateRange === 'week') {
      result = result.filter(e => e.timestamp >= now - 7 * 24 * 3600 * 1000)
    } else if (dateRange === 'month') {
      result = result.filter(e => e.timestamp >= now - 30 * 24 * 3600 * 1000)
    }

    // 2. Specific Heatmap Date Filter
    if (selectedDateFilter) {
      result = result.filter(e => {
        const dStr = new Date(e.timestamp).toISOString().split('T')[0]
        return dStr === selectedDateFilter
      })
    }

    // 3. Module chips
    if (selectedModules.length > 0) {
      result = result.filter(e => selectedModules.includes(e.module || 'global'))
    }

    // 4. Category chips
    if (selectedCategories.length > 0) {
      result = result.filter(e => selectedCategories.includes(getEventCategory(e.type)))
    }

    // 5. Search query
    if (search.trim()) {
      let regex: RegExp | null = null
      try {
        regex = new RegExp(search, 'i')
      } catch {
        // invalid regex, fallback to simple search
      }

      result = result.filter(e => {
        const matchesModule = regex ? regex.test(e.module) : e.module.toLowerCase().includes(search.toLowerCase())
        const matchesType = regex ? regex.test(e.type) : e.type.toLowerCase().includes(search.toLowerCase())
        const matchesDesc = regex ? regex.test(getEventDescription(e)) : getEventDescription(e).toLowerCase().includes(search.toLowerCase())
        
        const dataString = JSON.stringify(e.data || {})
        const matchesData = regex ? regex.test(dataString) : dataString.toLowerCase().includes(search.toLowerCase())

        return matchesModule || matchesType || matchesDesc || matchesData
      })
    }

    return result
  }, [events, dateRange, selectedModules, selectedCategories, search, selectedDateFilter])

  // Heatmap calculation
  const heatmapDays = useMemo(() => {
    const counts: Record<string, number> = {}
    events.forEach(e => {
      const dStr = new Date(e.timestamp).toISOString().split('T')[0]
      counts[dStr] = (counts[dStr] || 0) + 1
    })

    const days = []
    const today = new Date()
    today.setHours(0,0,0,0)

    const startDate = new Date(today)
    startDate.setDate(today.getDate() - 364)
    // Align to Sunday
    const startDay = startDate.getDay()
    startDate.setDate(startDate.getDate() - startDay)

    for (let i = 0; i < 371; i++) {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      const dStr = d.toISOString().split('T')[0]
      days.push({
        dateStr: dStr,
        count: counts[dStr] || 0,
        dayOfWeek: d.getDay(),
        dateObj: d
      })
    }
    
    // Chunk into 53 weeks
    const weeks = []
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7))
    }
    return weeks
  }, [events])

  // Clustering logic: collapse consecutive events of the same type within 2 minutes into a cluster if count >= 5
  const groupedAndClusteredEventsByDay = useMemo(() => {
    // 1. Group events by day string
    const groups: Record<string, any[]> = {}
    
    filteredEvents.forEach(e => {
      const dayKey = new Date(e.timestamp).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      if (!groups[dayKey]) groups[dayKey] = []
      groups[dayKey].push(e)
    })

    // 2. Perform clustering inside each day
    const clusteredGroups: Record<string, any[]> = {}

    Object.entries(groups).forEach(([day, dayEvents]) => {
      const dayClustered: any[] = []
      let i = 0
      while (i < dayEvents.length) {
        const currentEvent = dayEvents[i]
        let j = i + 1
        const clusterItems = [currentEvent]

        while (j < dayEvents.length) {
          const nextEvent = dayEvents[j]
          const prevInCluster = clusterItems[clusterItems.length - 1]
          const timeDiff = Math.abs(prevInCluster.timestamp - nextEvent.timestamp)
          
          if (nextEvent.type === currentEvent.type && timeDiff <= 120000) {
            clusterItems.push(nextEvent)
            j++
          } else {
            break
          }
        }

        if (clusterItems.length >= 5) {
          dayClustered.push({
            id: `cluster-${currentEvent.id}`,
            isCluster: true,
            type: currentEvent.type,
            timestamp: currentEvent.timestamp,
            module: currentEvent.module,
            items: clusterItems
          })
          i = j
        } else {
          dayClustered.push({
            ...currentEvent,
            isCluster: false
          })
          i++
        }
      }
      clusteredGroups[day] = dayClustered
    })

    return clusteredGroups
  }, [filteredEvents])

  // Module filter chip toggler
  const toggleModuleFilter = (mod: string) => {
    setSelectedModules(prev =>
      prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]
    )
  }

  // Category filter chip toggler
  const toggleCategoryFilter = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  // Expand event details toggler
  const toggleEventExpanded = (id: string) => {
    setExpandedEvents(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Expand cluster toggler
  const toggleClusterExpanded = (id: string) => {
    setExpandedClusters(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Markdown exporter
  const triggerMarkdownExport = () => {
    const lines = [
      `# ENGINGUITY Project Timeline Report`,
      `**Generated on:** ${new Date().toLocaleString()}`,
      `**Total Filtered Events:** ${filteredEvents.length}`,
      selectedDateFilter ? `**Filtered Date:** ${selectedDateFilter}` : '',
      `---`,
      ``,
      `## Summary Statistics`,
      `- Total Actions: ${filteredEvents.length}`,
      `- Files Loaded / Created: ${filteredEvents.filter(e => getEventCategory(e.type) === 'Files').length}`,
      `- Parameters / Hardware Changes: ${filteredEvents.filter(e => getEventCategory(e.type) === 'Changes').length}`,
      `- AI assistant invocations: ${filteredEvents.filter(e => getEventCategory(e.type) === 'AI').length}`,
      `- Notebook warnings & problems: ${filteredEvents.filter(e => getEventCategory(e.type) === 'Problems').length}`,
      `- Active Workspace sessions: ${filteredEvents.filter(e => getEventCategory(e.type) === 'Sessions').length}`,
      ``,
      `## Chronological Activity Ledger`,
      ``
    ]

    const sortedChron = [...filteredEvents].sort((a, b) => a.timestamp - b.timestamp)
    const groupedByDay: Record<string, any[]> = {}
    sortedChron.forEach(e => {
      const dStr = new Date(e.timestamp).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      if (!groupedByDay[dStr]) groupedByDay[dStr] = []
      groupedByDay[dStr].push(e)
    })

    Object.entries(groupedByDay).forEach(([day, dayEvents]) => {
      lines.push(`### ${day}`)
      lines.push(``)
      dayEvents.forEach(e => {
        const timeStr = new Date(e.timestamp).toLocaleTimeString()
        const desc = getEventDescription(e)
        lines.push(`- **${timeStr}** | *${(e.module || 'global').toUpperCase()}* | **${e.type}**`)
        lines.push(`  ${desc}`)
        if (e.data && Object.keys(e.data).length > 0) {
          lines.push(`  \`\`\`json`)
          lines.push(`  ${JSON.stringify(e.data, null, 2).replace(/\n/g, '\n  ')}`)
          lines.push(`  \`\`\``)
        }
        lines.push(``)
      })
    })

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `enginguity-project-timeline-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // AI Insights generation
  const generateInsights = async () => {
    if (!apiKey) {
      setInsightsError('No API key connected. Connect your OpenRouter API key in the banner above.')
      return
    }
    setLoadingInsights(true)
    setInsightsError(null)
    setInsights(null)

    const summary = filteredEvents.slice(0, 150).map(e => ({
      type: e.type,
      module: e.module,
      timestamp: new Date(e.timestamp).toISOString(),
      desc: getEventDescription(e)
    }))

    setTokenEstimate(Math.ceil(JSON.stringify(summary).length / 4))

    const systemPrompt = 'You are a senior hardware product manager and engineering analyst. Evaluate the activity logs and return a clean JSON object containing lists of bottlenecks, patterns, and recommendations. Do not return markdown blocks, return ONLY the raw JSON object.'
    const prompt = `Analyze these recent project actions from the engineering team workspace:
${JSON.stringify(summary, null, 2)}

Provide a professional structural report in this JSON format:
{
  "bottlenecks": ["List 2-3 specific process bottlenecks or system failures"],
  "patterns": ["List 2-3 productivity patterns or peak working hours details"],
  "recommendations": ["List 3-4 professional recommendations, dual-sourcing options, or latency fixes"]
}`

    try {
      const response = await makeRequest([{ role: 'user', content: prompt }], systemPrompt, { maxTokens: 1024, stream: false })
      const cleaned = response.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
      const parsed = JSON.parse(cleaned) as AIInsights
      setInsights(parsed)
    } catch (e: any) {
      setInsightsError(`Failed to generate insights: ${e.message || String(e)}`)
    } finally {
      setLoadingInsights(false)
    }
  }

  // Heatmap intensity class helper
  const getIntensityStyle = (count: number) => {
    if (count === 0) return { background: '#131326' }
    if (count <= 2) return { background: 'rgba(0, 200, 255, 0.2)', border: '1px solid rgba(0, 200, 255, 0.3)' }
    if (count <= 5) return { background: 'rgba(0, 200, 255, 0.4)', border: '1px solid rgba(0, 200, 255, 0.5)' }
    if (count <= 9) return { background: 'rgba(0, 200, 255, 0.7)', border: '1px solid rgba(0, 200, 255, 0.8)' }
    return {
      background: 'var(--accent)',
      border: '1px solid #ffffff',
      boxShadow: '0 0 8px var(--accent-glow)'
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* CSS Styles injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        .timeline-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .timeline-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .timeline-scroll::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 3px;
        }
        .timeline-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--text-dim);
        }
        
        .heatmap-cell {
          position: relative;
        }
        .heatmap-cell:hover .heatmap-tooltip {
          display: block;
        }
        .heatmap-tooltip {
          display: none;
          position: absolute;
          bottom: 130%;
          left: 50%;
          transform: translateX(-50%);
          background: var(--surface);
          border: 1px solid var(--border-bright);
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 10px;
          font-family: 'JetBrains Mono', monospace;
          color: var(--text);
          white-space: nowrap;
          z-index: 100;
          box-shadow: 0 10px 25px rgba(0,0,0,0.6);
          pointer-events: none;
        }
      `}} />

      {/* Header Panel */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-lg font-bold font-mono tracking-wide">Project Timeline</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Consolidated chronological activity audit ledger of all events, modifications, and code runs
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedDateFilter && (
            <button
              onClick={() => setSelectedDateFilter(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-red-500/30 text-red-400 bg-red-500/5 font-mono transition-all"
            >
              Reset Date Filter ({selectedDateFilter})
            </button>
          )}

          <button
            onClick={triggerMarkdownExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-mono transition-all"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <Download size={12} /> Export Markdown
          </button>
          <button
            onClick={() => { setInsightsOpen(true); if(!insights) generateInsights() }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            <Sparkles size={12} /> AI Insights
          </button>
        </div>
      </div>

      {/* Main Grid: Left Timeline list, Right Heatmap + Stats */}
      <div className="flex-1 min-h-0 flex flex-col xl:flex-row overflow-hidden">
        
        {/* LEFT COLUMN: Filters, Search, and Clustered Timeline list */}
        <div className="flex-1 min-h-0 flex flex-col border-r overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          
          {/* Controls Bar */}
          <div className="shrink-0 p-4 border-b flex flex-col gap-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="flex gap-2 items-center flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="input w-full"
                  placeholder="Filter by keyword / regex..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: 32, fontSize: 12 }}
                />
              </div>

              {/* Segmented control */}
              <div className="flex border rounded-lg p-0.5" style={{ borderColor: 'var(--border)', background: 'rgba(0,0,0,0.1)' }}>
                {(['all', 'today', 'week', 'month'] as const).map(range => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className="px-2.5 py-1 rounded-md text-xs font-mono capitalize transition-all"
                    style={dateRange === range ? { background: 'var(--surface-2)', color: 'var(--text)', fontWeight: 600 } : { background: 'transparent', color: 'var(--text-muted)' }}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter chips */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 overflow-x-auto timeline-scroll py-0.5">
                <span className="text-[10px] font-mono uppercase tracking-widest flex items-center gap-1 shrink-0" style={{ color: 'var(--text-muted)' }}>
                  <Filter size={10} /> Modules:
                </span>
                {modulesList.map(mod => {
                  const active = selectedModules.includes(mod)
                  return (
                    <button
                      key={mod}
                      onClick={() => toggleModuleFilter(mod)}
                      className="px-2 py-0.5 rounded-full text-[10px] font-mono border transition-all shrink-0"
                      style={active ? { background: 'rgba(0,200,255,0.12)', borderColor: 'var(--accent)', color: 'var(--accent)' } : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                    >
                      {mod}
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto timeline-scroll py-0.5">
                <span className="text-[10px] font-mono uppercase tracking-widest flex items-center gap-1 shrink-0" style={{ color: 'var(--text-muted)' }}>
                  <Filter size={10} /> Categories:
                </span>
                {categoriesList.map(cat => {
                  const active = selectedCategories.includes(cat)
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCategoryFilter(cat)}
                      className="px-2 py-0.5 rounded-full text-[10px] font-mono border transition-all shrink-0"
                      style={active ? { background: 'rgba(0,200,255,0.12)', borderColor: 'var(--accent)', color: 'var(--accent)' } : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Timeline View list */}
          <div className="flex-1 overflow-y-auto timeline-scroll px-6 py-4">
            {Object.keys(groupedAndClusteredEventsByDay).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center p-8">
                <Info size={28} className="text-gray-600" />
                <p className="text-sm font-semibold">No timeline events found</p>
                <p className="text-xs max-w-xs" style={{ color: 'var(--text-muted)' }}>
                  No actions match your filters. Adjust search query or module filters to view history.
                </p>
              </div>
            ) : (
              Object.entries(groupedAndClusteredEventsByDay).map(([day, dayEvents]) => (
                <div key={day} className="mb-8 last:mb-0">
                  {/* Date break marker */}
                  <div className="flex items-center justify-center my-6">
                    <div className="h-[1px] flex-1" style={{ background: 'var(--border)' }} />
                    <span className="px-4 text-[10px] font-mono font-semibold uppercase tracking-widest text-center" style={{ color: 'var(--text-muted)' }}>
                      {day}
                    </span>
                    <div className="h-[1px] flex-1" style={{ background: 'var(--border)' }} />
                  </div>

                  <div className="relative border-l-2 pl-6 ml-4 flex flex-col gap-6" style={{ borderColor: 'var(--border)' }}>
                    {dayEvents.map(item => {
                      const timeStr = new Date(item.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

                      if (item.isCluster) {
                        const isClusterOpen = !!expandedClusters[item.id]
                        const ClusterIcon = EVENT_ICONS[item.type] || Clock
                        const clusterColor = EVENT_COLORS[item.type] || '#6b7280'

                        return (
                          <div key={item.id} className="relative">
                            {/* Cluster node marker */}
                            <div
                              onClick={() => toggleClusterExpanded(item.id)}
                              className="absolute -left-[37px] top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all hover:scale-115"
                              style={{
                                background: 'var(--bg)',
                                borderColor: clusterColor,
                                color: clusterColor,
                                boxShadow: '0 0 6px rgba(0,0,0,0.5)'
                              }}
                            >
                              <ClusterIcon size={12} />
                            </div>

                            {/* Cluster Header card */}
                            <div
                              onClick={() => toggleClusterExpanded(item.id)}
                              className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:border-gray-500/40 transition-colors"
                              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold px-2 py-0.5 rounded font-mono" style={{ background: `${clusterColor}15`, color: clusterColor }}>
                                  COLLAPSED ACTIONS
                                </span>
                                <span className="text-xs font-mono font-bold" style={{ color: 'var(--text)' }}>
                                  {item.items.length} {item.type.replace('_', ' ').toLowerCase()} events
                                </span>
                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                  within 2 mins
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                                <span className="font-mono">{timeStr}</span>
                                {isClusterOpen ? <ChevronDown size={14} style={{ transform: 'rotate(180deg)' }} /> : <ChevronRight size={14} />}
                              </div>
                            </div>

                            {/* Nested Cluster Items */}
                            {isClusterOpen && (
                              <div className="mt-3 flex flex-col gap-3 pl-4 border-l border-dashed" style={{ borderColor: 'var(--border)' }}>
                                {item.items.map((sub: any) => {
                                  const isExpanded = !!expandedEvents[sub.id]
                                  const subTime = new Date(sub.timestamp).toLocaleTimeString()
                                  
                                  return (
                                    <div key={sub.id} className="p-3 rounded-lg border" style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}>
                                      <div className="flex justify-between items-start cursor-pointer" onClick={() => toggleEventExpanded(sub.id)}>
                                        <div className="flex-1">
                                          <p className="text-xs leading-relaxed font-sans">{getEventDescription(sub)}</p>
                                          <div className="flex gap-2 items-center mt-1">
                                            <span className="text-[9px] font-mono" style={{ color: 'var(--text-dim)' }}>
                                              {sub.type}
                                            </span>
                                            <span className="text-[9px] font-mono uppercase tracking-widest px-1 py-0.1 rounded" style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>
                                              {sub.module}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                          <span className="text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>{subTime}</span>
                                          {isExpanded ? <ChevronDown size={12} style={{ transform: 'rotate(180deg)', color: 'var(--text-muted)' }} /> : <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
                                        </div>
                                      </div>

                                      {isExpanded && sub.data && Object.keys(sub.data).length > 0 && (
                                        <div className="mt-2.5 p-2 rounded text-xs font-mono overflow-x-auto max-h-48 timeline-scroll" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                          <pre style={{ margin: 0, color: 'var(--accent-2)' }}>{JSON.stringify(sub.data, null, 2)}</pre>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      }

                      // Standard single event
                      const Icon = EVENT_ICONS[item.type] || Clock
                      const eventColor = EVENT_COLORS[item.type] || '#6b7280'
                      const isExpanded = !!expandedEvents[item.id]

                      return (
                        <div key={item.id} className="relative">
                          {/* Timeline node icon */}
                          <div
                            className="absolute -left-[37px] top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center"
                            style={{
                              background: 'var(--bg)',
                              borderColor: eventColor,
                              color: eventColor,
                              boxShadow: '0 0 6px rgba(0,0,0,0.5)'
                            }}
                          >
                            <Icon size={12} />
                          </div>

                          {/* Event Card */}
                          <div
                            className="p-3.5 rounded-lg border hover:border-gray-500/40 transition-colors"
                            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                          >
                            <div className="flex justify-between items-start cursor-pointer" onClick={() => toggleEventExpanded(item.id)}>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs leading-relaxed font-sans text-left pr-4" style={{ color: 'var(--text)' }}>
                                  {getEventDescription(item)}
                                </p>
                                <div className="flex gap-2 items-center mt-1 flex-wrap">
                                  <span className="text-[9px] font-mono font-semibold" style={{ color: eventColor }}>
                                    {item.type}
                                  </span>
                                  <span className="text-[9px] font-mono text-dim uppercase tracking-widest px-1 py-0.1 rounded" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
                                    {item.module}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                <span className="text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>{timeStr}</span>
                                {isExpanded ? <ChevronDown size={13} style={{ transform: 'rotate(180deg)', color: 'var(--text-muted)' }} /> : <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />}
                              </div>
                            </div>

                            {/* Details JSON pre-block */}
                            {isExpanded && item.data && Object.keys(item.data).length > 0 && (
                              <div className="mt-2.5 p-2 rounded text-xs font-mono overflow-x-auto max-h-60 timeline-scroll" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                <pre style={{ margin: 0, color: 'var(--accent-2)' }}>{JSON.stringify(item.data, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Activity Heatmap & summary stats */}
        <div className="w-full xl:w-96 p-6 overflow-y-auto timeline-scroll flex flex-col gap-6 shrink-0" style={{ background: 'var(--surface)' }}>
          <div>
            <h2 className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
              Activity Map
            </h2>
            
            {/* Heatmap Grid wrapper */}
            <div className="p-4 rounded-xl border flex flex-col gap-3" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
              <div className="flex overflow-x-auto timeline-scroll pb-1 gap-1">
                {heatmapDays.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-1 shrink-0">
                    {week.map(day => {
                      const isActiveDate = selectedDateFilter === day.dateStr
                      const intensityStyle = getIntensityStyle(day.count)
                      const isBorders = isActiveDate ? { outline: '1.5px solid #ffffff', zIndex: 10 } : {}

                      return (
                        <div
                          key={day.dateStr}
                          onClick={() => setSelectedDateFilter(isActiveDate ? null : day.dateStr)}
                          className="w-3.5 h-3.5 rounded-sm cursor-pointer heatmap-cell transition-all hover:scale-120"
                          style={{
                            ...intensityStyle,
                            ...isBorders
                          }}
                        >
                          <div className="heatmap-tooltip">
                            {day.dateStr} · {day.count} action{day.count !== 1 ? 's' : ''}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex justify-between items-center text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
                <span>Less</span>
                <div className="flex gap-1">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#131326' }} />
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(0, 200, 255, 0.2)' }} />
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(0, 200, 255, 0.4)' }} />
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(0, 200, 255, 0.7)' }} />
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--accent)' }} />
                </div>
                <span>More</span>
              </div>
            </div>
          </div>

          {/* Productivity metrics */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Productivity Metrics
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border" style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}>
                <p className="text-[10px] font-mono uppercase tracking-wider text-dim" style={{ color: 'var(--text-muted)' }}>
                  Total Actions
                </p>
                <p className="text-xl font-bold font-mono text-white mt-1">{events.length}</p>
              </div>

              <div className="p-3 rounded-lg border" style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}>
                <p className="text-[10px] font-mono uppercase tracking-wider text-dim" style={{ color: 'var(--text-muted)' }}>
                  Busiest Module
                </p>
                <p className="text-xs font-bold font-mono text-white mt-2 uppercase truncate">
                  {modulesList.length > 0
                    ? modulesList.map(mod => ({
                        mod,
                        count: events.filter(e => e.module === mod).length
                      })).reduce((max, c) => c.count > max.count ? c : max, { mod: 'none', count: 0 }).mod
                    : '—'}
                </p>
              </div>

              <div className="p-3 rounded-lg border" style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}>
                <p className="text-[10px] font-mono uppercase tracking-wider text-dim" style={{ color: 'var(--text-muted)' }}>
                  Active Days
                </p>
                <p className="text-xl font-bold font-mono text-white mt-1">
                  {Array.from(new Set(events.map(e => new Date(e.timestamp).toISOString().split('T')[0]))).length}
                </p>
              </div>

              <div className="p-3 rounded-lg border" style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}>
                <p className="text-[10px] font-mono uppercase tracking-wider text-dim" style={{ color: 'var(--text-muted)' }}>
                  AI Operations
                </p>
                <p className="text-xl font-bold font-mono text-white mt-1">
                  {events.filter(e => getEventCategory(e.type) === 'AI').length}
                </p>
              </div>
            </div>
          </div>

          {/* Legend description */}
          <div className="p-3.5 rounded-lg border flex gap-3 text-xs leading-relaxed" style={{ background: 'rgba(0, 200, 255, 0.04)', borderColor: 'rgba(0, 200, 255, 0.15)', color: 'var(--text-muted)' }}>
            <Info size={16} className="shrink-0 text-accent" style={{ color: 'var(--accent)' }} />
            <div>
              <p className="font-semibold text-white">Event Clustering</p>
              <p className="text-[11px] mt-0.5">
                Timeline clusters consecutive events of the same type occurring within a 2-minute window. Hover or click cells on the activity map to filter by day.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* AI INSIGHTS DRAWER BACKDROP */}
      {insightsOpen && (
        <div
          onClick={() => setInsightsOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          style={{ zIndex: 1000 }}
        />
      )}

      {/* AI INSIGHTS DRAWER PANEL */}
      <div
        className="fixed top-0 right-0 h-full w-[450px] shadow-2xl transition-all duration-300 transform flex flex-col"
        style={{
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border-bright)',
          transform: insightsOpen ? 'translateX(0)' : 'translateX(100%)',
          zIndex: 1001,
        }}
      >
        <div className="shrink-0 flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: 'var(--accent)' }} />
            <h3 className="font-bold font-mono text-sm uppercase tracking-wider">AI Workspace Insights</h3>
          </div>
          <button
            onClick={() => setInsightsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Drawer content */}
        <div className="flex-1 overflow-y-auto timeline-scroll p-6 flex flex-col gap-6">
          {!apiKey && (
            <div className="flex flex-col items-center justify-center text-center p-6 border border-dashed rounded-lg" style={{ borderColor: 'var(--border)' }}>
              <AlertTriangle size={32} className="text-amber-500 mb-3" />
              <h4 className="text-sm font-semibold text-white">No API Key Connected</h4>
              <p className="text-xs text-dim mt-1 max-w-xs" style={{ color: 'var(--text-muted)' }}>
                Please connect your OpenRouter API key in the top banner configuration to run AI analyses.
              </p>
            </div>
          )}

          {apiKey && (
            <div className="flex flex-col gap-5">
              
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  Auditing {filteredEvents.length} events
                </span>
                <button
                  disabled={loadingInsights}
                  onClick={generateInsights}
                  className="btn text-xs font-mono py-1.5 px-3 rounded flex items-center gap-1.5"
                >
                  <RefreshCw size={11} className={loadingInsights ? 'animate-spin' : ''} />
                  Analyze Again
                </button>
              </div>

              {loadingInsights && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <div className="w-8 h-8 rounded-full border-4 border-accent border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                  <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    AI is reviewing your timeline actions...
                  </p>
                </div>
              )}

              {insightsError && (
                <div className="p-4 rounded-lg border text-xs leading-relaxed flex gap-2" style={{ background: 'rgba(255,80,80,0.05)', borderColor: 'rgba(255,80,80,0.2)', color: '#b08080' }}>
                  <AlertTriangle size={15} className="shrink-0" />
                  <p>{insightsError}</p>
                </div>
              )}

              {/* Render AI recommendations */}
              {!loadingInsights && insights && (
                <div className="flex flex-col gap-6">
                  
                  {/* Bottlenecks cards */}
                  <div className="flex flex-col gap-3">
                    <h4 className="text-[11px] font-mono font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                      Process Bottlenecks
                    </h4>
                    {insights.bottlenecks.map((bot, i) => (
                      <div key={i} className="p-3.5 rounded-lg border text-xs leading-relaxed font-sans" style={{ background: 'rgba(239, 68, 68, 0.03)', borderColor: 'rgba(239, 68, 68, 0.15)' }}>
                        {bot}
                      </div>
                    ))}
                  </div>

                  {/* Patterns */}
                  <div className="flex flex-col gap-3">
                    <h4 className="text-[11px] font-mono font-semibold uppercase tracking-wider" style={{ color: '#7aaa8a' }}>
                      Productivity Patterns
                    </h4>
                    {insights.patterns.map((pat, i) => (
                      <div key={i} className="p-3.5 rounded-lg border text-xs leading-relaxed font-sans" style={{ background: 'rgba(52, 211, 153, 0.03)', borderColor: 'rgba(52, 211, 153, 0.15)' }}>
                        {pat}
                      </div>
                    ))}
                  </div>

                  {/* Recommendations */}
                  <div className="flex flex-col gap-3">
                    <h4 className="text-[11px] font-mono font-semibold uppercase tracking-wider" style={{ color: '#b09060' }}>
                      Actionable Advice
                    </h4>
                    {insights.recommendations.map((rec, i) => (
                      <div key={i} className="p-3.5 rounded-lg border text-xs leading-relaxed font-sans" style={{ background: 'rgba(245, 158, 11, 0.03)', borderColor: 'rgba(245, 158, 11, 0.15)' }}>
                        {rec}
                      </div>
                    ))}
                  </div>

                  {/* Character/Tokens cost info */}
                  <div className="flex items-center gap-1.5 p-3 rounded bg-surface-2 border text-[10px] font-mono" style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}>
                    <Info size={11} />
                    <span>
                      Est. tokens: ~{tokenEstimate} in / ~300 out.
                    </span>
                  </div>
                  
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
