import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ResizablePanel from '../../components/ResizablePanel'
import {
  Sliders, Clock, Save, Trash2, X, ExternalLink,
  ChevronDown, ChevronUp, FolderPlus, Download, BookOpen
} from 'lucide-react'
import { useProjectContext } from '../../hooks/useProjectContext'
import { useAIProvider } from '../../hooks/useAIProvider'
import { useProbeContext } from '../../hooks/useProbeContext'
import { logEvent } from '../../engine/eventLog'

// Raw AI-generated idea JSON before it's normalized into the Idea shape
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawIdea = any

// ── Static Suggestion List (80 common maker components) ─────────────────────
const COMMON_COMPONENTS = [
  // MCUs & SBCs
  'Arduino Uno', 'Arduino Nano', 'Arduino Mega', 'ESP32', 'ESP8266', 
  'Raspberry Pi Pico', 'Raspberry Pi 4', 'Raspberry Pi 5', 'STM32 Blue Pill', 
  'Teensy 4.0', 'Teensy 4.1', 'ATtiny85',
  // Sensors
  'Ultrasonic Sensor HC-SR04', 'DHT11 Temperature Sensor', 'DHT22 Temperature Sensor', 
  'MPU6050 Accelerometer', 'LDR Light Sensor', 'PIR Motion Sensor HC-SR501', 
  'Rotary Encoder', 'BMP280 Barometric Sensor', 'MAX6675 Thermocouple', 
  'Soil Moisture Sensor', 'Rain Sensor', 'Gas Sensor MQ-2', 'Gas Sensor MQ-135', 
  'RFID RC522', 'APDS9960 Gesture Sensor', 'VL53L0X LiDAR', 'IR Receiver',
  // Displays
  '0.96 OLED Display', '16x2 LCD Screen', '20x4 LCD Screen', 'Nextion TFT Display', 
  'E-Paper Display', '7-Segment Display', '8x8 LED Matrix',
  // Motors & Actuators
  'Stepper Motor NEMA 17', 'Servo Motor SG90', 'Servo Motor MG996R', 
  'DC Gear Motor', 'Brushless Motor ESC', 'Solenoid Valve', 'Vibration Motor', 
  'Linear Actuator',
  // Power & Charging
  '18650 Li-ion Battery', 'LiPo Battery 3.7V', 'AA Battery Holder', '9V Battery', 
  'TP4056 Charger Module', 'LM2596 Buck Converter', 'Boost Converter MT3608', 
  'Solar Panel 5V', 'Breadboard Power Supply',
  // Passives & Discrete
  'Resistor 220 Ohm', 'Resistor 1k Ohm', 'Resistor 10k Ohm', 'Potentiometer 10k', 
  'Capacitor 100nF', 'Electrolytic Capacitor 10uF', 'Electrolytic Capacitor 100uF', 
  'LED Red', 'LED Green', 'LED Blue', 'RGB LED WS2812B', 'LED Strip', 
  'Diode 1N4007', 'Zener Diode 5.1V', 'NPN Transistor 2N2222', 'MOSFET IRF540N', 
  'Optocoupler PC817', 'Active Buzzer', 'Passive Buzzer', '5V Relay Module', 
  '10V Relay Module',
  // Prototyping
  'Breadboard', 'Jumper Wires M-M', 'Jumper Wires M-F', 'Tactile Push Button', 
  'Slide Switch', 'Toggle Switch'
]

// ── Skills Configuration ───────────────────────────────────────────────────
const SKILLS_LIST = {
  programming: ['Arduino', 'Python', 'C/C++', 'Rust', 'MicroPython', 'JavaScript'],
  hardware: ['PCB Design', '3D Printing', 'CNC', 'Soldering', 'Sheet Metal'],
  domains: ['Embedded', 'RF/Wireless', 'Power Electronics', 'Robotics', 'Signal Processing', 'Mechanical', 'IoT', 'Audio']
}

// ── Interfaces ─────────────────────────────────────────────────────────────
interface Idea {
  id: string
  title: string
  difficulty: 'Weekend build' | '1-2 weeks' | 'Month project'
  description: string
  additionalParts: string[]
  coreChallenge: string
  estimatedCost: string
  firstSteps: string[]
  learningOutcome: string
  stretchGoals: string[]
  suggestedLinks: string[]
  dismissed?: boolean
}

interface HistoryItem {
  timestamp: string
  inputs: {
    components: string[]
    skills: string[]
    complexity: string
    budget: string
    goal: string
  }
  ideas: Idea[]
}

interface ProjectIdeasLayoutProps {
  isDesktop: boolean
  children: [React.ReactNode, React.ReactNode]
}

function ProjectIdeasLayout({ isDesktop, children }: ProjectIdeasLayoutProps) {
  if (isDesktop) {
    return (
      <ResizablePanel
        direction="horizontal"
        initialSplit={0.25}
        minFirst={280}
        minSecond={400}
        storageKey="project-ideas-split"
      >
        {children}
      </ResizablePanel>
    )
  }
  return <>{children[1]}</>
}

export function ProjectIdeas() {
  const navigate = useNavigate()
  const { tags: brainTags, setDescription: setBrainDescription, setTags: setBrainTags } = useProjectContext()
  const { makeRequest, isConnected, activeModel, openGrid } = useAIProvider()

  // --- UI Layout state ---
  const [activeTab, setActiveTab] = useState<'generate' | 'saved'>('generate')
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount read of matchMedia state
    setIsDesktop(media.matches)
    const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])

  // --- Form Context Input states ---
  const [components, setComponents] = useState<string[]>(brainTags && brainTags.length > 0 ? brainTags : [])
  const [compInput, setCompInput] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [complexity, setComplexity] = useState<string>('Weekend') // 'Weekend' | '1–2 weeks' | 'Month+' | 'Open-ended'
  const [budget, setBudget] = useState('')
  const [goal, setGoal] = useState('')

  // --- Generation Settings ---
  const [ideasCount, setIdeasCount] = useState<number>(5)
  const [focusArea, setFocusArea] = useState('Any')
  const [temperature, setTemperature] = useState(0.8)

  // --- Data feeds ---
  const [generatedIdeas, setGeneratedIdeas] = useState<Idea[]>([])
  const [savedIdeas, setSavedIdeas] = useState<Idea[]>(() => {
    try {
      const stored = localStorage.getItem('enginguity_saved_ideas')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem('enginguity_ideas_history')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)

  useProbeContext('project-ideas', {
    activeTab,
    components,
    complexity,
    goal: goal || null,
    generatedCount: generatedIdeas.length,
    savedCount: savedIdeas.length,
    expandedIdea: generatedIdeas.find((i) => i.id === expandedCardId)?.title
      ?? savedIdeas.find((i) => i.id === expandedCardId)?.title ?? null,
  })

  // Synchronize tags prefill from useProjectContext on load
  useEffect(() => {
    if (brainTags && brainTags.length > 0 && components.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time prefill sync from external project context
      setComponents(brainTags)
    }
  }, [brainTags])

  // Save ideas list to localStorage
  useEffect(() => {
    localStorage.setItem('enginguity_saved_ideas', JSON.stringify(savedIdeas))
  }, [savedIdeas])

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('enginguity_ideas_history', JSON.stringify(history))
  }, [history])

  // Autocomplete filter effect
  useEffect(() => {
    const query = compInput.trim().toLowerCase()
    if (!query) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing derived autocomplete list when input is empty
      setSuggestions([])
      return
    }
    const filtered = COMMON_COMPONENTS.filter(c =>
      c.toLowerCase().includes(query) && !components.includes(c)
    ).slice(0, 5)
    setSuggestions(filtered)
  }, [compInput, components])

  // Dismiss toast helper
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // --- Tag Input Handlers ---
  const handleAddTag = (tag: string) => {
    const cleaned = tag.trim()
    if (cleaned && !components.includes(cleaned)) {
      setComponents(prev => [...prev, cleaned])
    }
    setCompInput('')
    setSuggestions([])
  }

  const handleRemoveTag = (tag: string) => {
    setComponents(prev => prev.filter(t => t !== tag))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      handleAddTag(compInput)
    }
  }

  // --- Skills Toggle Handler ---
  const handleToggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    )
  }

  // --- Prompt Starters handler ---
  const handleStarterClick = (starterText: string) => {
    const parts = starterText.split('+').map(p => p.trim())
    setComponents(parts)
    setComplexity('Weekend')
    setBudget('')
    setGoal('')
    
    // Auto-trigger generation with short delay to allow state changes
    setTimeout(() => {
      triggerGeneration(parts, selectedSkills, 'Weekend', '', '')
    }, 100)
  }

  // --- Generation execution ---
  const handleGenerateClick = () => {
    triggerGeneration(components, selectedSkills, complexity, budget, goal)
  }

  const triggerGeneration = async (
    compsList: string[],
    skillsList: string[],
    complexPref: string,
    budVal: string,
    goalText: string
  ) => {
    if (compsList.length === 0) return
    setLoading(true)
    setError(null)
    setMobileSheetOpen(false)

    const systemPrompt = `You are an experienced hardware and software engineer helping someone find their next project. You suggest projects that are achievable, genuinely interesting, and matched to the person's skill level. You write plainly. No hype, no filler sentences, no 'This exciting project will...'. Every word is useful.
Return ONLY valid JSON. No markdown. No explanation.`

    const userPrompt = `Generate ${ideasCount} engineering project ideas for someone with:

Components available: ${compsList.join(', ') || 'not specified'}
Skills: ${skillsList.join(', ') || 'general engineering'}
Complexity preference: ${complexPref || 'any'}
Budget: ${budVal || 'flexible'}
Goal: ${goalText || 'build something useful'}
Focus Area: ${focusArea}

Return a JSON array of ${ideasCount} objects, each with:
{
  title: string (5 words max, plain and descriptive),
  difficulty: 'Weekend build' | '1-2 weeks' | 'Month project',
  description: string (2-3 sentences, no hype, state what it does and one reason it is interesting),
  additionalParts: string[] (max 4, only parts NOT in the components list above),
  coreChallenge: string (1-2 sentences, the hardest part),
  estimatedCost: string (format: '$X-Y' or 'Under $X'),
  firstSteps: string[] (exactly 3 steps, concrete and specific, start with a verb),
  learningOutcome: string (1-2 sentences),
  stretchGoals: string[] (exactly 3, each under 10 words),
  suggestedLinks: string[] (2-3 URLs, real sites like instructables.com, hackaday.io, github.com — suggest plausible URLs, user should verify)
}`

    try {
      const response = await makeRequest([{ role: 'user', content: userPrompt }], systemPrompt, {
        temperature: temperature,
        maxTokens: 4000
      })

      const cleaned = response.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
      const rawIdeas = JSON.parse(cleaned)

      if (!Array.isArray(rawIdeas)) {
        throw new Error('Response is not a valid JSON array')
      }

      // Map UUIDs to generated ideas
      const parsedIdeas: Idea[] = rawIdeas.map((idea: RawIdea) => ({
        ...idea,
        id: Math.random().toString(36).substring(2, 9) + Date.now()
      }))

      setGeneratedIdeas(parsedIdeas)
      setActiveTab('generate')
      logEvent('IDEAS_GENERATED', {
        count: parsedIdeas.length,
        components: compsList,
        complexity: complexPref,
        module: 'project-ideas',
      })

      // Record in History (maintain max 10)
      const newHistoryItem: HistoryItem = {
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        inputs: {
          components: compsList,
          skills: skillsList,
          complexity: complexPref,
          budget: budVal,
          goal: goalText
        },
        ideas: parsedIdeas
      }
      setHistory(prev => [newHistoryItem, ...prev].slice(0, 10))
    } catch (e) {
      console.error(e)
      setError('Model returned invalid data. Try again.')
    } finally {
      setLoading(false)
    }
  }

  // --- Saved Ideas Actions ---
  const handleSaveIdeaToggle = (idea: Idea) => {
    setSavedIdeas(prev => {
      const exists = prev.some(i => i.title === idea.title)
      if (exists) {
        return prev.filter(i => i.title !== idea.title)
      } else {
        return [...prev, idea]
      }
    })
  }

  const handleDismissCard = (id: string) => {
    // Stagger transition then hide
    setGeneratedIdeas(prev =>
      prev.map(i => (i.id === id ? { ...i, dismissed: true } : i))
    )
  }

  const handleLoadIntoWorkspace = (idea: Idea) => {
    // 1. Updates description
    const desc = `Title: ${idea.title}\nDescription: ${idea.description}\nAdditional parts required: ${idea.additionalParts.join(', ')}`
    setBrainDescription(desc)
    
    // 2. Append new tags to workspace brain
    const combinedTags = Array.from(new Set([...components, ...idea.additionalParts]))
    setBrainTags(combinedTags)

    // 3. Show Toast and redirect
    setToast(`"${idea.title}" loaded into workspace`)
    setTimeout(() => {
      navigate('/')
    }, 1000)
  }

  const handleLoadAllSavedIntoNotebook = () => {
    if (savedIdeas.length === 0) return

    try {
      const existingStr = localStorage.getItem('enginguity_notebook')
      const existing = existingStr ? JSON.parse(existingStr) : []

      const newEntries = savedIdeas.map(idea => ({
        id: 'reference-' + Math.random().toString(36).substring(2, 9) + Date.now(),
        type: 'REFERENCE' as const,
        title: idea.title,
        tags: ['project-idea', 'saved-ideas'],
        date: new Date().toISOString(),
        linkedModule: 'Project Ideas',
        attachedFiles: [],
        source: 'Saved Ideas Export',
        summary: `${idea.description}\n\nCore Challenge: ${idea.coreChallenge}\nLearning Outcome: ${idea.learningOutcome}`,
        relevantTo: 'Maker Prototyping',
        url: idea.suggestedLinks?.[0] || null
      }))

      localStorage.setItem('enginguity_notebook', JSON.stringify([...existing, ...newEntries]))
      setToast(`${savedIdeas.length} ideas loaded into Notebook`)
    } catch (e) {
      console.error(e)
      setToast('Failed to load ideas into Notebook')
    }
  }

  const handleExportSavedAsMarkdown = () => {
    if (savedIdeas.length === 0) return

    const markdown = savedIdeas.map((idea, idx) => `
# ${idx + 1}. ${idea.title} (${idea.difficulty})
**Description:** ${idea.description}

### Details:
- **Estimated Cost:** ${idea.estimatedCost}
- **Core Challenge:** ${idea.coreChallenge}
- **Required Additional Components:** ${idea.additionalParts.join(', ') || 'None'}

### Initial Steps:
${idea.firstSteps.map((step, sIdx) => `${sIdx + 1}. ${step}`).join('\n')}

### Learning Outcome:
${idea.learningOutcome}

### Stretch Goals:
${idea.stretchGoals.map(goal => `- ${goal}`).join('\n')}

### References:
${idea.suggestedLinks.map(link => `- [${link}](${link})`).join('\n')}
---
`).join('\n')

    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'saved_project_ideas.md'
    a.click()
  }

  // --- History actions ---
  const handleRestoreHistory = (item: HistoryItem) => {
    setComponents(item.inputs.components)
    setSelectedSkills(item.inputs.skills)
    setComplexity(item.inputs.complexity)
    setBudget(item.inputs.budget)
    setGoal(item.inputs.goal)
    setGeneratedIdeas(item.ideas)
    setActiveTab('generate')
    setShowHistory(false)
  }

  const handleClearHistory = () => {
    setHistory([])
    setShowHistory(false)
  }

  return (
    <div className="h-full flex flex-col bg-[#080808] font-sans text-[var(--text)] overflow-hidden">
      
      {/* 1. Header bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-[#080808]" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="font-sans font-normal text-2xl text-[var(--text)] leading-tight">
            Project Ideas
          </h1>
          <p className="font-sans font-normal text-sm text-[var(--text-muted)] mt-1">
            Tell us what you have. Get back what you could build.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('generate')}
            className="font-sans text-sm font-normal pb-1 relative transition-colors"
            style={{ color: activeTab === 'generate' ? 'var(--text)' : 'var(--text-muted)' }}
          >
            Generate
            {activeTab === 'generate' && (
              <div className="absolute bottom-0 left-0 right-0 h-[1px]" style={{ background: 'var(--accent)' }} />
            )}
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className="font-sans text-sm font-normal pb-1 relative transition-colors"
            style={{ color: activeTab === 'saved' ? 'var(--text)' : 'var(--text-muted)' }}
          >
            Saved ({savedIdeas.length})
            {activeTab === 'saved' && (
              <div className="absolute bottom-0 left-0 right-0 h-[1px]" style={{ background: 'var(--accent)' }} />
            )}
          </button>
        </div>
      </header>

      {/* 2. Main Content Layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative p-6 gap-6">
        <ProjectIdeasLayout isDesktop={isDesktop}>
          {/* DESKTOP LEFT PANEL */}
          <div className="flex flex-col gap-6 overflow-y-auto pr-2 h-full">
          {/* Input Context Flow */}
          <div className="flex flex-col gap-5">
            
            {/* Tag Input */}
            <div className="flex flex-col gap-2 relative">
              <label className="font-sans font-normal text-xs text-[var(--text-muted)]">
                Components & parts
              </label>
              <div className="flex flex-wrap gap-1.5 p-2 rounded bg-[#0e0e0e] border border-[var(--border)] min-h-[38px]">
                {components.map(tag => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 bg-[var(--surface-2)] border border-[var(--border-bright)] rounded px-2 py-0.5 font-sans font-normal text-xs text-[var(--text)]"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="text-[var(--text-dim)] hover:text-[var(--text)] text-xs font-bold leading-none ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  value={compInput}
                  onChange={(e) => setCompInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={components.length === 0 ? "ESP32, stepper motor, 0.96 OLED..." : ""}
                  className="flex-1 bg-transparent border-none outline-none font-sans text-xs text-white placeholder-[var(--text-dim)] py-0.5 min-w-[60px]"
                />
              </div>

              {/* Suggestions Dropdown */}
              {suggestions.length > 0 && (
                <div
                  className="absolute left-0 right-0 top-[102%] z-50 rounded-md border border-[var(--border-bright)] bg-[var(--surface)] max-h-[200px] overflow-y-auto"
                >
                  {suggestions.map(sug => (
                    <button
                      key={sug}
                      onClick={() => handleAddTag(sug)}
                      className="w-full text-left px-3 text-xs text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
                      style={{ height: 32 }}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Skills toggles matrix */}
            <div className="flex flex-col gap-2">
              <label className="font-sans font-normal text-xs text-[var(--text-muted)]">
                Skills & experience
              </label>
              
              {/* Grid block */}
              <div className="flex flex-col gap-3 mt-1">
                <div>
                  <div className="text-[10px] font-mono text-[var(--text-dim)] mb-1 uppercase tracking-wider">Programming</div>
                  <div className="flex flex-wrap gap-1.5">
                    {SKILLS_LIST.programming.map(skill => {
                      const selected = selectedSkills.includes(skill)
                      return (
                        <button
                          key={skill}
                          onClick={() => handleToggleSkill(skill)}
                          className="font-sans font-normal text-xs rounded transition-colors cursor-pointer"
                          style={{
                            padding: '4px 10px',
                            background: selected ? 'var(--surface-2)' : 'transparent',
                            border: `1px solid ${selected ? 'var(--border-bright)' : 'var(--border)'}`,
                            color: selected ? 'var(--text)' : 'var(--text-muted)'
                          }}
                        >
                          {skill}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-mono text-[var(--text-dim)] mb-1 uppercase tracking-wider">Hardware</div>
                  <div className="flex flex-wrap gap-1.5">
                    {SKILLS_LIST.hardware.map(skill => {
                      const selected = selectedSkills.includes(skill)
                      return (
                        <button
                          key={skill}
                          onClick={() => handleToggleSkill(skill)}
                          className="font-sans font-normal text-xs rounded transition-colors cursor-pointer"
                          style={{
                            padding: '4px 10px',
                            background: selected ? 'var(--surface-2)' : 'transparent',
                            border: `1px solid ${selected ? 'var(--border-bright)' : 'var(--border)'}`,
                            color: selected ? 'var(--text)' : 'var(--text-muted)'
                          }}
                        >
                          {skill}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-mono text-[var(--text-dim)] mb-1 uppercase tracking-wider">Domains</div>
                  <div className="flex flex-wrap gap-1.5">
                    {SKILLS_LIST.domains.map(skill => {
                      const selected = selectedSkills.includes(skill)
                      return (
                        <button
                          key={skill}
                          onClick={() => handleToggleSkill(skill)}
                          className="font-sans font-normal text-xs rounded transition-colors cursor-pointer"
                          style={{
                            padding: '4px 10px',
                            background: selected ? 'var(--surface-2)' : 'transparent',
                            border: `1px solid ${selected ? 'var(--border-bright)' : 'var(--border)'}`,
                            color: selected ? 'var(--text)' : 'var(--text-muted)'
                          }}
                        >
                          {skill}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Complexity Segmented Control */}
            <div className="flex flex-col gap-2">
              <label className="font-sans font-normal text-xs text-[var(--text-muted)]">
                Project goals
              </label>
              
              <div className="flex flex-col gap-3 mt-1">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Complexity</span>
                  <div className="grid grid-cols-4 gap-0.5 bg-[#0e0e0e] border border-[var(--border)] rounded-md p-[2px]">
                    {['Weekend', '1–2 weeks', 'Month+', 'Open-ended'].map(lvl => (
                      <button
                        key={lvl}
                        onClick={() => setComplexity(lvl)}
                        className="py-1.5 px-1 font-sans text-[10px] font-normal cursor-pointer transition-colors text-center"
                        style={{
                          background: complexity === lvl ? 'var(--surface-2)' : 'transparent',
                          color: complexity === lvl ? 'var(--text)' : 'var(--text-muted)',
                          borderRadius: complexity === lvl ? '4px' : '0'
                        }}
                      >
                        {lvl.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Budget */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Budget (optional)</span>
                  <input
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="e.g. under $30, no limit..."
                    className="w-full bg-[#0e0e0e] border border-[var(--border)] rounded px-3 py-1.5 text-xs text-[var(--text)] outline-none placeholder-[var(--text-dim)]"
                  />
                </div>

                {/* One line Goal */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">One-line goal (optional)</span>
                    <span className="text-[9px] font-mono text-[var(--text-dim)]">{goal.length}/120</span>
                  </div>
                  <input
                    value={goal}
                    onChange={(e) => setGoal(e.target.value.slice(0, 120))}
                    placeholder="Something I can actually finish..."
                    className="w-full bg-[#0e0e0e] border border-[var(--border)] rounded px-3 py-1.5 text-xs text-[var(--text)] outline-none placeholder-[var(--text-dim)]"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Action Generate button container */}
          <div className="mt-auto pt-4 border-t border-[var(--border)] flex flex-col gap-2">
            
            {/* Polaris animated loading bar */}
            {loading && (
              <div className="w-full h-[1px] bg-[#1f1f35] relative overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 bg-[var(--accent)] animate-[loading-bar_1.2s_infinite_ease-in-out]"
                  style={{ width: '40%' }}
                />
              </div>
            )}

            <button
              onClick={handleGenerateClick}
              disabled={loading || components.length === 0}
              className="w-full h-[38px] rounded border font-sans text-sm font-normal cursor-pointer transition-colors flex items-center justify-center gap-2"
              style={{
                borderColor: components.length === 0 ? 'var(--border)' : loading ? 'var(--border-bright)' : 'var(--accent)',
                color: components.length === 0 ? 'var(--text-dim)' : loading ? 'var(--text-muted)' : 'var(--accent)',
                background: 'transparent',
                cursor: components.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Generating...' : 'Generate ideas →'}
            </button>

            {error && (
              <span className="text-[10px] text-red-400 font-mono text-center block">
                {error}
              </span>
            )}

            {isConnected && activeModel && (
              <div className="text-[10px] font-sans font-normal text-[var(--text-dim)] text-center">
                Using{' '}
                <button
                  onClick={openGrid}
                  className="underline hover:text-[var(--text)] cursor-pointer"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {activeModel}
                </button>
              </div>
            )}
          </div>
        </div>

          {/* RIGHT PANEL - FEED & CARDS */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#0c0c16] rounded-lg border border-[var(--border)] h-full">
          
          {/* Feed Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b shrink-0 bg-[#0e0e0e]" style={{ borderColor: 'var(--border)' }}>
            <span className="font-sans text-xs text-[var(--text-muted)] font-normal">
              {activeTab === 'generate'
                ? generatedIdeas.length > 0
                  ? `${generatedIdeas.filter(i => !i.dismissed).length} ideas`
                  : 'Starters'
                : `${savedIdeas.length} saved ideas`}
            </span>

            <div className="flex items-center gap-2 relative">
              {/* History Button */}
              {activeTab === 'generate' && (
                <>
                  <button
                    onClick={() => { setShowHistory(!showHistory); setShowSettings(false); }}
                    title="History"
                    className="p-1.5 rounded border border-[var(--border)] hover:bg-[#111111] hover:border-[var(--border-bright)] cursor-pointer transition-colors text-[var(--text-muted)]"
                  >
                    <Clock size={14} />
                  </button>

                  {/* History Menu Popover */}
                  {showHistory && (
                    <div
                      className="absolute right-8 top-8 z-[60] w-[280px] bg-[var(--surface)] border border-[var(--border-bright)] rounded-lg p-3 flex flex-col gap-2 font-mono text-xs"
                    >
                      <span className="text-[10px] uppercase text-[var(--text-dim)] tracking-wider">Generation History</span>
                      <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto">
                        {history.map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleRestoreHistory(item)}
                            className="w-full text-left p-2 rounded hover:bg-[#111111] transition-colors truncate"
                          >
                            <span className="text-[var(--accent)]">{item.timestamp}</span>
                            <span className="text-[var(--text-muted)] ml-2">({item.inputs.components.length} parts)</span>
                            <div className="text-[10px] text-[var(--text-dim)] mt-0.5 truncate">
                              Goal: {item.inputs.goal || 'Any'}
                            </div>
                          </button>
                        ))}
                        {history.length === 0 && (
                          <div className="p-4 text-center text-[var(--text-dim)]">No runs recorded.</div>
                        )}
                      </div>
                      <button
                        onClick={handleClearHistory}
                        className="w-full text-center py-1.5 border-t border-[var(--border)] text-[var(--text-dim)] hover:text-red-400 font-sans transition-colors cursor-pointer mt-1"
                      >
                        Clear history
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Saved actions */}
              {activeTab === 'saved' && savedIdeas.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={handleLoadAllSavedIntoNotebook}
                    className="py-1 px-2.5 rounded border border-[var(--border)] hover:bg-[#111111] text-xs font-sans font-normal text-[var(--text-muted)] cursor-pointer hover:text-white flex items-center gap-1.5"
                  >
                    <BookOpen size={12} />
                    Load all into Notebook
                  </button>
                  <button
                    onClick={handleExportSavedAsMarkdown}
                    className="py-1 px-2.5 rounded border border-[var(--border)] hover:bg-[#111111] text-xs font-sans font-normal text-[var(--text-muted)] cursor-pointer hover:text-white flex items-center gap-1.5"
                  >
                    <Download size={12} />
                    Export as MD
                  </button>
                </div>
              )}

              {/* Settings Button */}
              {activeTab === 'generate' && (
                <>
                  <button
                    onClick={() => { setShowSettings(!showSettings); setShowHistory(false); }}
                    className="p-1.5 rounded border border-[var(--border)] hover:bg-[#111111] hover:border-[var(--border-bright)] cursor-pointer transition-colors text-[var(--text-muted)] flex items-center gap-1 text-xs"
                  >
                    <Sliders size={14} />
                  </button>

                  {/* Popover Settings Panel */}
                  {showSettings && (
                    <div
                      className="absolute right-0 top-8 z-[60] w-[240px] bg-[var(--surface)] border border-[var(--border-bright)] rounded-lg p-4 flex flex-col gap-4 font-sans text-xs"
                    >
                      {/* Count segmented control */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Number of ideas</span>
                        <div className="grid grid-cols-3 gap-0.5 bg-[#0e0e0e] border border-[var(--border)] rounded-md p-[2px]">
                          {[3, 5, 8].map(cnt => (
                            <button
                              key={cnt}
                              onClick={() => setIdeasCount(cnt)}
                              className="py-1 font-sans text-xs font-normal cursor-pointer"
                              style={{
                                background: ideasCount === cnt ? 'var(--surface-2)' : 'transparent',
                                color: ideasCount === cnt ? 'var(--text)' : 'var(--text-muted)',
                                borderRadius: ideasCount === cnt ? '4px' : '0'
                              }}
                            >
                              {cnt}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Focus area select */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Focus Area</span>
                        <select
                          value={focusArea}
                          onChange={(e) => setFocusArea(e.target.value)}
                          className="w-full bg-[#0e0e0e] border border-[var(--border)] text-[var(--text)] rounded-md px-2 py-1.5 outline-none"
                        >
                          <option>Any</option>
                          <option>Practical</option>
                          <option>Experimental</option>
                          <option>Learning-focused</option>
                          <option>Crowd-pleasing</option>
                          <option>Fastest to build</option>
                        </select>
                      </div>

                      {/* Temperature slider */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">
                          <span>Creativity</span>
                          <span>{temperature}</span>
                        </div>
                        <input
                          type="range"
                          min="0.4"
                          max="1.2"
                          step="0.1"
                          value={temperature}
                          onChange={(e) => setTemperature(parseFloat(e.target.value))}
                          className="w-full h-1 bg-[#1f1f35] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                        />
                        <div className="flex justify-between text-[10px] font-mono text-[var(--text-dim)]">
                          <span>Safe</span>
                          <span>Wild</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Feed content viewport */}
          <div className="flex-1 overflow-y-auto p-5">
            
            {/* Generate view empty starters */}
            {activeTab === 'generate' && generatedIdeas.length === 0 && (
              <div className="h-full flex flex-col justify-center items-center py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl w-full px-4 mb-5">
                  {[
                    'ESP32 + old laptop battery',
                    'Arduino + stepper + 3D printer',
                    'Raspberry Pi + camera + Python',
                    'STM32 + accelerometer + OLED',
                    'ATtiny85 + LED strip + CR2032',
                    'ESP8266 + relay + home wifi',
                    'Nano + ultrasonic + servo',
                    'Teensy + audio codec + buttons'
                  ].map(starter => (
                    <button
                      key={starter}
                      onClick={() => handleStarterClick(starter)}
                      className="text-left rounded-lg p-3 bg-[var(--surface)] border border-[var(--border)] font-sans font-normal text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:border-[var(--border-bright)] hover:text-white cursor-pointer"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
                <span className="text-xs font-sans text-[var(--text-dim)]">
                  Or fill in the panel and generate your own
                </span>
              </div>
            )}

            {/* Main Ideas feed array */}
            {activeTab === 'generate' && generatedIdeas.length > 0 && (
              <div className="flex flex-col gap-4">
                {generatedIdeas.filter(i => !i.dismissed).map((idea, index) => {
                  const isSaved = savedIdeas.some(s => s.title === idea.title)
                  const isExpanded = expandedCardId === idea.id
                  return (
                    <div
                      key={idea.id}
                      className="bg-[var(--surface)] border rounded-lg p-5 w-full flex flex-col gap-4 transition-all hover:border-[var(--border-bright)] animate-fade-in"
                      style={{
                        animationDelay: `${index * 80}ms`,
                        borderColor: isSaved ? 'var(--accent)' : 'var(--border)'
                      }}
                    >
                      {/* Top metadata */}
                      <div className="flex justify-between items-start gap-4">
                        <h3 className="font-sans font-medium text-base text-[var(--text)]">
                          {idea.title}
                        </h3>
                        <span className="font-sans font-normal text-xs text-[var(--text-muted)] whitespace-nowrap">
                          {idea.difficulty}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="font-sans font-normal text-xs text-[var(--text-muted)] leading-relaxed">
                        {idea.description}
                      </p>

                      <hr className="border-t" style={{ borderColor: 'var(--border)' }} />

                      {/* Three-column grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        
                        {/* You'll need */}
                        <div className="flex flex-col gap-2">
                          <span className="font-sans font-normal text-[10px] text-[var(--text-dim)] uppercase tracking-wider">
                            You'll need
                          </span>
                          <div className="flex flex-col gap-1.5">
                            {idea.additionalParts.slice(0, 4).map(part => (
                              <div key={part} className="flex items-center gap-2 text-xs font-sans text-[var(--text-muted)]">
                                <span className="w-1.5 h-1.5 bg-[var(--border-bright)] rounded-sm shrink-0" />
                                <span className="truncate">{part}</span>
                              </div>
                            ))}
                            {idea.additionalParts.length > 4 && (
                              <span className="text-[10px] font-sans text-[var(--text-dim)] block ml-3.5">
                                + {idea.additionalParts.length - 4} more
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Core challenge */}
                        <div className="flex flex-col gap-2 md:border-l md:pl-5" style={{ borderColor: 'var(--border)' }}>
                          <span className="font-sans font-normal text-[10px] text-[var(--text-dim)] uppercase tracking-wider">
                            Core challenge
                          </span>
                          <p className="font-sans font-normal text-xs text-[var(--text-muted)] leading-relaxed">
                            {idea.coreChallenge}
                          </p>
                        </div>

                        {/* Cost estimation */}
                        <div className="flex flex-col gap-1.5 md:border-l md:pl-5" style={{ borderColor: 'var(--border)' }}>
                          <span className="font-sans font-normal text-[10px] text-[var(--text-dim)] uppercase tracking-wider">
                            Estimated cost
                          </span>
                          <div className="font-mono text-base font-bold text-[var(--text)] mt-0.5">
                            {idea.estimatedCost}
                          </div>
                          <span className="text-[10px] font-sans text-[var(--text-dim)]">
                            excl. parts you have
                          </span>
                        </div>

                      </div>

                      {/* Expand details button */}
                      <div className="border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                        <button
                          onClick={() => setExpandedCardId(isExpanded ? null : idea.id)}
                          className="font-sans font-normal text-xs text-[var(--text-muted)] hover:text-white cursor-pointer flex items-center gap-1"
                        >
                          {isExpanded ? (
                            <>
                              Less details <ChevronUp size={12} />
                            </>
                          ) : (
                            <>
                              More details <ChevronDown size={12} />
                            </>
                          )}
                        </button>
                      </div>

                      {/* Expandable detailed drawer */}
                      {isExpanded && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 transition-all duration-200">
                          
                          {/* First steps */}
                          <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">First steps</span>
                            <div className="flex flex-col gap-1.5">
                              {idea.firstSteps.map((step, idx) => (
                                <div key={idx} className="flex gap-2 text-xs font-sans text-[var(--text-muted)]">
                                  <span className="font-mono text-[var(--accent)] text-[10px] shrink-0 mt-0.5">{idx + 1}.</span>
                                  <span>{step}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Learning outcome */}
                          <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Learning outcome</span>
                            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                              {idea.learningOutcome}
                            </p>
                          </div>

                          {/* Stretch goals */}
                          <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Stretch goals</span>
                            <div className="flex flex-col gap-1">
                              {idea.stretchGoals.map((g, idx) => (
                                <div key={idx} className="text-xs font-sans text-[var(--text-muted)]">
                                  — {g}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Similar projects */}
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Similar projects</span>
                              <span className="text-[9px] font-mono text-[var(--text-dim)] italic">AI-suggested links, verify before visiting</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              {idea.suggestedLinks.map((link, idx) => (
                                <a
                                  key={idx}
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-[var(--text-muted)] hover:underline truncate flex items-center gap-1"
                                >
                                  <ExternalLink size={10} className="shrink-0" />
                                  {link}
                                </a>
                              ))}
                            </div>
                          </div>

                        </div>
                      )}

                      {/* Card actions footer */}
                      <div className="flex gap-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                        <button
                          onClick={() => handleLoadIntoWorkspace(idea)}
                          className="h-7 px-3 text-xs font-sans font-normal rounded border bg-transparent hover:bg-[var(--surface-2)] transition-colors hover:border-[var(--border-bright)] cursor-pointer text-[var(--text-muted)] hover:text-white flex items-center gap-1"
                        >
                          <FolderPlus size={12} />
                          Load into workspace
                        </button>
                        <button
                          onClick={() => handleSaveIdeaToggle(idea)}
                          className="h-7 px-3 text-xs font-sans font-normal rounded border bg-transparent transition-colors cursor-pointer flex items-center gap-1"
                          style={{
                            borderColor: isSaved ? 'var(--accent)' : 'var(--border)',
                            color: isSaved ? 'var(--accent)' : 'var(--text-muted)'
                          }}
                        >
                          <Save size={12} />
                          {isSaved ? 'Saved' : 'Save idea'}
                        </button>
                        <button
                          onClick={() => handleDismissCard(idea.id)}
                          className="h-7 px-3 text-xs font-sans font-normal rounded border bg-transparent hover:bg-[var(--surface-2)] transition-colors hover:border-[var(--border-bright)] cursor-pointer text-[var(--text-muted)] hover:text-white flex items-center gap-1 ml-auto"
                        >
                          <Trash2 size={12} />
                          Dismiss
                        </button>
                      </div>

                    </div>
                  )
                })}
              </div>
            )}

            {/* Saved list tab viewport */}
            {activeTab === 'saved' && (
              <div className="flex flex-col gap-4">
                {savedIdeas.map((idea) => {
                  const isExpanded = expandedCardId === idea.id
                  return (
                    <div
                      key={idea.id}
                      className="bg-[var(--surface)] border rounded-lg p-5 w-full flex flex-col gap-4 border-[var(--accent)]"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <h3 className="font-sans font-medium text-base text-[var(--text)]">
                          {idea.title}
                        </h3>
                        <span className="font-sans font-normal text-xs text-[var(--text-muted)]">
                          {idea.difficulty}
                        </span>
                      </div>

                      <p className="font-sans font-normal text-xs text-[var(--text-muted)] leading-relaxed">
                        {idea.description}
                      </p>

                      <hr className="border-t" style={{ borderColor: 'var(--border)' }} />

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="flex flex-col gap-2">
                          <span className="font-sans font-normal text-[10px] text-[var(--text-dim)] uppercase tracking-wider">
                            You'll need
                          </span>
                          <div className="flex flex-col gap-1.5">
                            {idea.additionalParts.slice(0, 4).map(part => (
                              <div key={part} className="flex items-center gap-2 text-xs font-sans text-[var(--text-muted)]">
                                <span className="w-1.5 h-1.5 bg-[var(--border-bright)] rounded-sm shrink-0" />
                                <span className="truncate">{part}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 md:border-l md:pl-5" style={{ borderColor: 'var(--border)' }}>
                          <span className="font-sans font-normal text-[10px] text-[var(--text-dim)] uppercase tracking-wider">
                            Core challenge
                          </span>
                          <p className="font-sans font-normal text-xs text-[var(--text-muted)] leading-relaxed">
                            {idea.coreChallenge}
                          </p>
                        </div>

                        <div className="flex flex-col gap-1.5 md:border-l md:pl-5" style={{ borderColor: 'var(--border)' }}>
                          <span className="font-sans font-normal text-[10px] text-[var(--text-dim)] uppercase tracking-wider">
                            Estimated cost
                          </span>
                          <div className="font-mono text-base font-bold text-[var(--text)] mt-0.5">
                            {idea.estimatedCost}
                          </div>
                          <span className="text-[10px] font-sans text-[var(--text-dim)]">
                            excl. parts you have
                          </span>
                        </div>
                      </div>

                      <div className="border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                        <button
                          onClick={() => setExpandedCardId(isExpanded ? null : idea.id)}
                          className="font-sans font-normal text-xs text-[var(--text-muted)] hover:text-white cursor-pointer flex items-center gap-1"
                        >
                          {isExpanded ? 'Less details' : 'More details'}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3">
                          <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">First steps</span>
                            <div className="flex flex-col gap-1.5">
                              {idea.firstSteps.map((step, idx) => (
                                <div key={idx} className="flex gap-2 text-xs font-sans text-[var(--text-muted)]">
                                  <span className="font-mono text-[var(--accent)] text-[10px] shrink-0">{idx + 1}.</span>
                                  <span>{step}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Learning outcome</span>
                            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                              {idea.learningOutcome}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                        <button
                          onClick={() => handleLoadIntoWorkspace(idea)}
                          className="h-7 px-3 text-xs font-sans font-normal rounded border bg-transparent hover:bg-[var(--surface-2)] transition-colors hover:border-[var(--border-bright)] cursor-pointer text-[var(--text-muted)] hover:text-white flex items-center gap-1"
                        >
                          <FolderPlus size={12} />
                          Load into workspace
                        </button>
                        <button
                          onClick={() => handleSaveIdeaToggle(idea)}
                          className="h-7 px-3 text-xs font-sans font-normal rounded border bg-transparent transition-colors cursor-pointer flex items-center gap-1"
                          style={{
                            borderColor: 'var(--accent)',
                            color: 'var(--accent)'
                          }}
                        >
                          <Save size={12} />
                          Saved
                        </button>
                      </div>
                    </div>
                  )
                })}

                {savedIdeas.length === 0 && (
                  <div className="p-8 text-center text-[var(--text-muted)] text-xs font-sans">
                    You have no saved ideas. Mark project cards as saved to persist them here.
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
        </ProjectIdeasLayout>

      </div>

      {/* 3. Mobile Navigation & Sheet Overlay */}
      <div className="md:hidden flex p-4 shrink-0 bg-[#0e0e0e] border-t border-[var(--border)] gap-3">
        <button
          onClick={() => setMobileSheetOpen(true)}
          className="flex-1 h-9 rounded border border-[var(--border-bright)] text-xs text-white font-sans cursor-pointer hover:bg-[#131313]"
        >
          Refine inputs
        </button>
        <button
          onClick={handleGenerateClick}
          disabled={loading || components.length === 0}
          className="flex-1 h-9 rounded text-xs font-bold font-sans cursor-pointer"
          style={{
            background: components.length === 0 ? 'var(--surface)' : 'var(--accent)',
            color: components.length === 0 ? 'var(--text-dim)' : '#000'
          }}
        >
          {loading ? 'Generating...' : 'Generate ideas →'}
        </button>
      </div>

      {/* Mobile Bottom Sheet Modal */}
      {mobileSheetOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex flex-col justify-end md:hidden">
          <div
            className="w-full bg-[var(--surface)] border-t border-[var(--border-bright)] rounded-t-xl p-5 overflow-y-auto"
            style={{ maxHeight: '80vh' }}
          >
            <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: 'var(--border)' }}>
              <span className="text-sm font-bold text-white">Refine Context Inputs</span>
              <button onClick={() => setMobileSheetOpen(false)} className="text-[var(--text-muted)] hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Render tags, skills, and parameters inputs inside sheet */}
            <div className="flex flex-col gap-5">
              {/* Components */}
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-xs text-[var(--text-muted)]">Components & parts</label>
                <div className="flex flex-wrap gap-1.5 p-2 rounded bg-[#0e0e0e] border border-[var(--border)] min-h-[38px]">
                  {components.map(tag => (
                    <span key={tag} className="flex items-center gap-1 bg-[var(--surface-2)] border border-[var(--border-bright)] rounded px-2 py-0.5 text-xs text-[var(--text)]">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="text-[var(--text-dim)] hover:text-[var(--text)] text-xs font-bold leading-none">×</button>
                    </span>
                  ))}
                  <input
                    value={compInput}
                    onChange={(e) => setCompInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="ESP32, stepper motor..."
                    className="flex-1 bg-transparent border-none outline-none text-xs text-white"
                  />
                </div>
                {suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-[102%] z-50 rounded-md border border-[var(--border-bright)] bg-[var(--surface)] max-h-[150px] overflow-y-auto">
                    {suggestions.map(sug => (
                      <button key={sug} onClick={() => handleAddTag(sug)} className="w-full text-left px-3 text-xs text-white hover:bg-[var(--surface-2)]" style={{ height: 32 }}>{sug}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Skills */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[var(--text-muted)]">Skills</label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.values(SKILLS_LIST).flat().map(skill => {
                    const selected = selectedSkills.includes(skill)
                    return (
                      <button
                        key={skill}
                        onClick={() => handleToggleSkill(skill)}
                        className="text-xs px-2.5 py-1 rounded border transition-colors cursor-pointer"
                        style={{
                          background: selected ? 'var(--surface-2)' : 'transparent',
                          borderColor: selected ? 'var(--border-bright)' : 'var(--border)',
                          color: selected ? 'var(--text)' : 'var(--text-muted)'
                        }}
                      >
                        {skill}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Complexity */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[var(--text-muted)]">Complexity</span>
                <div className="grid grid-cols-4 gap-0.5 bg-[#0e0e0e] border border-[var(--border)] rounded-md p-[2px]">
                  {['Weekend', '1–2 weeks', 'Month+', 'Open-ended'].map(lvl => (
                    <button
                      key={lvl}
                      onClick={() => setComplexity(lvl)}
                      className="py-1.5 text-xs text-center rounded transition-colors"
                      style={{
                        background: complexity === lvl ? 'var(--surface-2)' : 'transparent',
                        color: complexity === lvl ? 'var(--text)' : 'var(--text-muted)'
                      }}
                    >
                      {lvl.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Goal */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[var(--text-muted)]">Goal</span>
                <input
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Something I can finish..."
                  className="w-full bg-[#0e0e0e] border border-[var(--border)] rounded px-3 py-1.5 text-xs text-white"
                />
              </div>
            </div>

            <button
              onClick={handleGenerateClick}
              disabled={loading || components.length === 0}
              className="w-full h-10 rounded mt-6 font-bold text-xs"
              style={{
                background: components.length === 0 ? 'var(--surface)' : 'var(--accent)',
                color: components.length === 0 ? 'var(--text-dim)' : '#000'
              }}
            >
              {loading ? 'Generating...' : 'Generate ideas →'}
            </button>
          </div>
        </div>
      )}

      {/* 4. Global Toast Notification */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-4 py-2.5 rounded-md border border-[var(--border-bright)] bg-[var(--surface-2)] text-xs text-white shadow-lg font-sans font-normal"
        >
          {toast}
        </div>
      )}
      
      {/* 5. Polaris Loading Animation Style Inject */}
      <style>{`
        @keyframes loading-bar {
          0% { left: -40%; }
          50% { left: 100%; }
          100% { left: 100%; }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
          opacity: 0;
        }
      `}</style>

    </div>
  )
}
