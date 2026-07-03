import { useState, useEffect, useMemo } from 'react'
import { Search, Library, AlertCircle, ExternalLink } from 'lucide-react'
import { templates as localTemplates, templateCategories } from '../../config/templates/index'
import { COMMUNITY_TEMPLATES_GIST_URL, COMMUNITY_SUBMIT_TEMPLATE_URL } from '../../config/communityTemplatesUrl'
import { useProject } from '../../context/ProjectContext'
import type { ProjectTemplate, TemplateLoadLog } from './types'
import type { BOMItem } from '../bom/types'
import type { NotebookEntry } from '../notebook/types'
import { TemplateDetailModal } from './TemplateDetailModal'
import { logEvent } from '../../engine/eventLog'
import { useProbeContext } from '../../hooks/useProbeContext'

// Offline/Fallback Community Templates
const mockCommunityTemplates: ProjectTemplate[] = [
  {
    id: 'keyboard-split-ergo',
    name: 'Split Ergonomic Keyboard (42-key)',
    tagline: 'RP2040-powered split mechanical keyboard with OLED screens.',
    category: 'Community',
    difficulty: 'advanced',
    estimatedHours: 10,
    tags: ['Keyboard', 'RP2040', 'QMK', 'Mechanical', 'OLED'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="44" width="104" height="72" rx="4" fill="#111111" stroke="#6b6d85" stroke-width="1.5"/><rect x="156" y="44" width="104" height="72" rx="4" fill="#111111" stroke="#6b6d85" stroke-width="1.5"/><line x1="20" y1="60" x2="50" y2="60" stroke="#6b6d85" stroke-width="1.5"/><line x1="20" y1="75" x2="50" y2="75" stroke="#6b6d85" stroke-width="1.5"/><line x1="20" y1="90" x2="50" y2="90" stroke="#6b6d85" stroke-width="1.5"/><line x1="230" y1="60" x2="260" y2="60" stroke="#6b6d85" stroke-width="1.5"/><line x1="230" y1="75" x2="260" y2="75" stroke="#6b6d85" stroke-width="1.5"/><line x1="230" y1="90" x2="260" y2="90" stroke="#94a3b8" stroke-width="1.5"/><circle cx="260" cy="90" r="3" fill="#94a3b8"/><line x1="124" y1="80" x2="156" y2="80" stroke="#6b6d85" stroke-width="1.5" stroke-dasharray="4 3"/></svg>`,
    projectContext: {
      description: 'A 42-key split ergonomic keyboard utilizing two RP2040 Zero controllers running QMK firmware. Features hot-swap sockets and status display screens.',
      tags: ['QMK', 'RP2040', 'SplitKeyboard', 'Ergonomics']
    },
    parameterPlayground: {
      description: 'Tune switch debounce speeds and scan matrix timing constraints.',
      parameters: [
        { name: 'debounce_ms', label: 'Matrix Debounce Delay', min: 1, max: 20, default: 5, unit: 'ms' },
        { name: 'polling_rate_hz', label: 'USB Polling Speed', min: 125, max: 1000, default: 1000, unit: 'Hz' }
      ],
      equations: [
        { outputName: 'total_latency_ms', label: 'Total Input Latency', formula_js: 'debounce_ms + (1000 / polling_rate_hz)', unit: 'ms' }
      ]
    },
    starterCode: {
      language: 'cpp',
      filename: 'keymap.c',
      content: `// QMK split keyboard keymap definition
#include QMK_KEYBOARD_H

const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {
    [0] = LAYOUT_split_3x6_3(
        KC_TAB,  KC_Q,    KC_W,    KC_E,    KC_R,    KC_T,                      KC_Y,    KC_U,    KC_I,    KC_O,    KC_P,    KC_BSPC,
        KC_LSFT, KC_A,    KC_S,    KC_D,    KC_F,    KC_G,                      KC_H,    KC_J,    KC_K,    KC_L,    KC_SCLN, KC_QUOT,
        KC_LCTL, KC_Z,    KC_X,    KC_C,    KC_V,    KC_B,                      KC_N,    KC_M,    KC_COMM, KC_DOT,  KC_SLSH, KC_ENT,
                                   KC_LALT, KC_SPC,  KC_LGUI,                 KC_RGUI, KC_SPC,  KC_RALT
    )
};`
    },
    bomStarter: [
      { quantity: 2, description: 'Waveshare RP2040-Zero Module', value: 'RP2040-Zero', package: 'Module', notes: 'Core controller per side' },
      { quantity: 42, description: 'MX Mechanical Switches (Tactile)', value: 'Brown Switches', package: 'Through-Hole', notes: 'Keyswitches' },
      { quantity: 42, description: '1N4148 Switching Diodes', value: '1N4148', package: 'SOD-123', notes: 'Matrix anti-ghosting diodes' },
      { quantity: 2, description: '128x32 I2C OLED Displays', value: 'SSD1306 OLED', package: 'Module', notes: 'Layer and WPM indicators' }
    ],
    notebookEntries: [
      { type: 'DECISION', title: 'Adopt RP2040 over Pro Micro', content: 'Selected RP2040 due to higher flash space, letting us enable rich QMK configurations, status screen, and RGB patterns simultaneously.' }
    ],
    resources: [
      { title: 'QMK Firmware Docs', url: 'https://docs.qmk.fm/', type: 'reference' }
    ]
  },
  {
    id: 'solar-irrigation-lora',
    name: 'Solar LoRa Irrigation Node',
    tagline: 'Solar-harvesting soil moisture sensor node sending data over LoRa.',
    category: 'Community',
    difficulty: 'intermediate',
    estimatedHours: 6,
    tags: ['LoRa', 'Solar', 'Soil Sensor', 'IoT', 'Low Power'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg"><line x1="140" y1="130" x2="140" y2="60" stroke="#6b6d85" stroke-width="1.5"/><line x1="100" y1="130" x2="180" y2="130" stroke="#6b6d85" stroke-width="1.5"/><path d="M112,102 C122,90 158,90 168,102" stroke="#6b6d85" stroke-width="1.5" fill="none"/><path d="M90,116 C108,96 172,96 190,116" stroke="#6b6d85" stroke-width="1.5" fill="none"/><path d="M68,128 C94,100 186,100 212,128" stroke="#94a3b8" stroke-width="1.5" fill="none"/><rect x="60" y="32" width="160" height="28" rx="4" fill="#111111" stroke="#6b6d85" stroke-width="1.5"/><circle cx="140" cy="60" r="3" fill="#6b6d85"/></svg>`,
    projectContext: {
      description: 'An agricultural sensor system tracking soil moisture levels. Leverages a small solar cell to trickle charge a supercapacitor, powering regular LoRa packets.',
      tags: ['LoRaNode', 'SolarHarvesting', 'CapacitiveSensor', 'AgriculturalIoT']
    },
    parameterPlayground: {
      description: 'Optimize solar charging duration against sleep power states.',
      parameters: [
        { name: 'panel_current_ma', label: 'Solar Panel Output', min: 10, max: 200, default: 50, unit: 'mA' },
        { name: 'sleep_sec', label: 'Update Interval', min: 10, max: 3600, default: 600, unit: 's' }
      ],
      equations: [
        { outputName: 'charge_capacity_mah', label: 'Daily Energy Harvest', formula_js: 'panel_current_ma * 4.5', unit: 'mAh' }
      ]
    },
    starterCode: {
      language: 'cpp',
      filename: 'solar_node.ino',
      content: `// Solar Soil Moisture Node with Deep Sleep
#include <LoRa.h>

const int MOISTURE_PIN = A0;
const int POWER_PIN = 4; // Cycles power to soil sensor

void setup() {
  Serial.begin(115200);
  pinMode(POWER_PIN, OUTPUT);
  digitalWrite(POWER_PIN, LOW);
  
  if (!LoRa.begin(915E6)) {
    Serial.println("Starting LoRa failed!");
    while (1);
  }
}

void loop() {
  // Power up sensor
  digitalWrite(POWER_PIN, HIGH);
  delay(50);
  int rawValue = analogRead(MOISTURE_PIN);
  digitalWrite(POWER_PIN, LOW); // Power down sensor to prevent probe corrosion
  
  float moisture = (1023.0 - rawValue) / 10.23; // Percentage estimate
  
  LoRa.beginPacket();
  LoRa.print(moisture);
  LoRa.endPacket();
  
  Serial.print("Soil Moisture sent: ");
  Serial.println(moisture);
  
  delay(600000); // Sleep 10 minutes
}`
    },
    bomStarter: [
      { quantity: 1, description: 'Capacitive Soil Moisture Sensor v1.2', value: 'Capacitive Probe', package: 'Sensor', notes: 'Resists corrosion' },
      { quantity: 1, description: '5V 100mA Small Epoxy Solar Cell', value: 'Solar Cell 5V', package: 'Panel', notes: 'Energy harvester source' },
      { quantity: 1, description: 'Supercapacitor 5.5V 4.0F', value: '4.0F Supercap', package: 'Radial', notes: 'Stores charge for pings' }
    ],
    notebookEntries: [
      { type: 'OBSERVATION', title: 'Probe Corrosion Suppression', content: 'Observed standard resistive probes fail within weeks. Switched to capacitive probe powered only during measurements to stop electrolysis.' }
    ],
    resources: [
      { title: 'Supercapacitor Charging Circuit Tutorial', url: 'https://www.instructables.com/Solar-Supercapacitor-Charger/', type: 'tutorial' }
    ]
  }
]

export function TemplatesGallery() {
  const { setDescription, setTags } = useProject()

  // Grid/UI states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [difficultyFilter, setDifficultyFilter] = useState('All')
  const [sortBy, setSortBy] = useState('alphabetical-az')

  // Data states
  const [communityTemplates, setCommunityTemplates] = useState<ProjectTemplate[]>([])

  // Selected Detail Modal
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null)

  // Toast notification
  const [toast, setToast] = useState<{
    show: boolean
    title: string
    message: string
    link?: string
    linkLabel?: string
  }>({ show: false, title: '', message: '' })

  // History log
  const [loadLogs, setLoadLogs] = useState<TemplateLoadLog[]>([])

  useProbeContext('templates', {
    searchQuery: searchQuery || null,
    category: selectedCategory,
    difficulty: difficultyFilter,
    communityTemplateCount: communityTemplates.length,
    openTemplate: selectedTemplate?.name ?? null,
    loadedCount: loadLogs.length,
  })

  // Load active logs from localStorage on mount
  useEffect(() => {
    try {
      const logs = localStorage.getItem('enginguity_template_history')
      if (logs) {
        setLoadLogs(JSON.parse(logs))
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  // Fetch Community Gist on mount
  useEffect(() => {
    async function fetchCommunityGist() {
      try {
        const response = await fetch(COMMUNITY_TEMPLATES_GIST_URL)
        if (!response.ok) {
          throw new Error('Gist not found or rate limited')
        }
        const gistData = await response.json()
        const templatesFile = gistData.files && gistData.files['templates.json']
        if (templatesFile && templatesFile.content) {
          const parsed = JSON.parse(templatesFile.content) as ProjectTemplate[]
          if (Array.isArray(parsed)) {
            setCommunityTemplates(parsed.map(t => ({
              ...t,
              difficulty: t.difficulty as 'beginner' | 'intermediate' | 'advanced' | 'expert',
              category: 'Community'
            })))
          } else {
            throw new Error('Invalid JSON structure inside Gist')
          }
        } else {
          throw new Error('Missing templates.json inside Gist')
        }
      } catch (e) {
        console.warn('Gist fetch failed, using preloaded community templates instead:', e)
        setCommunityTemplates(mockCommunityTemplates)
      }
    }

    fetchCommunityGist()
  }, [])

  // Consolidate all templates
  const allTemplates = useMemo(() => {
    return [...(localTemplates as unknown as ProjectTemplate[]), ...communityTemplates]
  }, [communityTemplates])

  // Filter and sort templates
  const filteredTemplates = useMemo(() => {
    return allTemplates
      .filter((t) => {
        // Search Query match
        const matchesSearch =
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.projectContext.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))

        if (!matchesSearch) return false

        // Category match
        if (selectedCategory !== 'All') {
          if (selectedCategory === 'Community') {
            return t.category === 'Community'
          }
          if (t.category !== selectedCategory) return false
        }

        // Difficulty match
        if (difficultyFilter !== 'All' && t.difficulty !== difficultyFilter.toLowerCase()) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        if (sortBy === 'alphabetical-az') {
          return a.name.localeCompare(b.name)
        }
        if (sortBy === 'alphabetical-za') {
          return b.name.localeCompare(a.name)
        }
        if (sortBy === 'hours-asc') {
          return a.estimatedHours - b.estimatedHours
        }
        if (sortBy === 'hours-desc') {
          return b.estimatedHours - a.estimatedHours
        }
        if (sortBy === 'difficulty-asc') {
          const diffMap: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 }
          return diffMap[a.difficulty] - diffMap[b.difficulty]
        }
        if (sortBy === 'difficulty-desc') {
          const diffMap: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 }
          return diffMap[b.difficulty] - diffMap[a.difficulty]
        }
        return 0
      })
  }, [allTemplates, searchQuery, selectedCategory, difficultyFilter, sortBy])

  // Handler: Load Template into ENGINGUITY Workspace
  const handleLoadTemplate = (template: ProjectTemplate) => {
    if (!confirm(`Are you sure you want to load "${template.name}"? This will overwrite your active project description, BOM list, starter code, and add engineering notebook entries.`)) {
      return
    }

    try {
      // 1. Update Project Context
      setDescription(template.projectContext.description)
      setTags(template.tags)

      // 2. Generate and Update BOM list
      const bomItems: BOMItem[] = template.bomStarter.map((item, idx) => ({
        id: `bom-item-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        quantity: item.quantity,
        part_number: item.value || null,
        description: item.description,
        manufacturer: null,
        value: item.value || null,
        package: item.package || null,
        reference_designators: null,
        unitPrice: null,
        extendedPrice: null,
        stockStatus: 'unknown',
        leadTimeWeeks: null,
        altAvailable: null,
        warnings: []
      }))
      localStorage.setItem('enginguity_boms', JSON.stringify(bomItems))

      // 3. Update Starter Code (for Debug Console IDE)
      if (template.starterCode) {
        localStorage.setItem('enginguity_starter_code', JSON.stringify(template.starterCode))
      } else {
        localStorage.removeItem('enginguity_starter_code')
      }

      // 4. Map and Prepend/Merge Notebook entries
      let existingNotebook: NotebookEntry[] = []
      try {
        existingNotebook = JSON.parse(localStorage.getItem('enginguity_notebook') ?? '[]')
      } catch (e) {
        console.error(e)
      }

      const mappedNotebookEntries = template.notebookEntries.map((entry, idx) => {
        const base = {
          id: `nb-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          title: entry.title,
          tags: [...template.tags, 'Template'],
          date: new Date().toISOString(),
          linkedModule: 'Templates',
          attachedFiles: []
        }

        const type = entry.type === 'PLAN' ? 'NOTE' : (entry.type as string)

        switch (type) {
          case 'DECISION':
            return {
              ...base,
              type: 'DECISION' as const,
              context: entry.content,
              optionsConsidered: '',
              chosenOption: entry.title,
              rationale: entry.content
            }
          case 'OBSERVATION':
            return {
              ...base,
              type: 'OBSERVATION' as const,
              description: entry.content,
              possibleCauses: '',
              followUpNeeded: false
            }
          case 'PROBLEM':
            return {
              ...base,
              type: 'PROBLEM' as const,
              description: entry.content,
              impact: '',
              status: 'open' as const,
              solution: null
            }
          case 'REFERENCE':
            return {
              ...base,
              type: 'REFERENCE' as const,
              source: 'Template',
              summary: entry.content,
              relevantTo: '',
              url: null
            }
          case 'EXPERIMENT':
            return {
              ...base,
              type: 'EXPERIMENT' as const,
              hypothesis: entry.content,
              setup: '',
              results: '',
              conclusion: '',
              succeeded: true
            }
          case 'TEST_RESULT':
            return {
              ...base,
              type: 'TEST_RESULT' as const,
              testType: 'Initial',
              conditions: '',
              measurements: [],
              passFail: true,
              notes: entry.content
            }
          case 'NOTE':
          default:
            return {
              ...base,
              type: 'NOTE' as const,
              content: entry.content
            }
        }
      })

      const mergedNotebook = [...mappedNotebookEntries, ...existingNotebook]
      localStorage.setItem('enginguity_notebook', JSON.stringify(mergedNotebook))

      // 5. Generate Parameter Playground schema link
      let encodedPlayground = ''
      if (template.parameterPlayground) {
        const pgSchema = {
          parameters: template.parameterPlayground.parameters,
          equations: template.parameterPlayground.equations.map(eq => ({
            outputName: eq.outputName,
            label: eq.label,
            formula: eq.formula_js,
            unit: eq.unit
          }))
        }

        const defaultVals: Record<string, number> = {}
        template.parameterPlayground.parameters.forEach(p => {
          defaultVals[p.name] = p.default
        })

        const sweep = template.parameterPlayground.parameters[0]?.name || ''

        const stateObj = {
          schema: pgSchema,
          values: defaultVals,
          sweep
        }

        encodedPlayground = btoa(encodeURIComponent(JSON.stringify(stateObj)))
      }

      // Update history log
      const newLog: TemplateLoadLog = {
        templateId: template.id,
        templateName: template.name,
        loadedAt: new Date().toISOString()
      }
      const updatedLogs = [newLog, ...loadLogs.filter(l => l.templateId !== template.id)].slice(0, 10)
      setLoadLogs(updatedLogs)
      localStorage.setItem('enginguity_template_history', JSON.stringify(updatedLogs))

      // Close modal
      setSelectedTemplate(null)

      // Show success toast with deep links
      setToast({
        show: true,
        title: 'Project Loaded successfully!',
        message: `"${template.name}" has been mapped into Project Brain, BOM, Notebook, and Debug Console.`,
        link: encodedPlayground ? `/parameter-playground?playground=${encodedPlayground}` : undefined,
        linkLabel: 'Go to Parameter Playground'
      })

      // Auto dismiss toast after 12s
      setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }))
      }, 12000)

      logEvent('TEMPLATE_LOADED', {
        templateId: template.id,
        templateName: template.name,
        category: template.category,
        module: 'workspace'
      })

    } catch (e) {
      alert(`Error loading template: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  // Clear load history
  const handleClearHistory = () => {
    if (confirm('Clear template loading history?')) {
      localStorage.removeItem('enginguity_template_history')
      setLoadLogs([])
    }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* Toast Banner (glowing glassmorphism) */}
      {toast.show && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          maxWidth: 380,
          background: 'var(--surface)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-bright)',
          borderLeft: '4px solid var(--accent)',
          borderRadius: 8,
          padding: '16px 20px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.1)',
          zIndex: 1100,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)',
                display: 'inline-block'
              }} />
              <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                {toast.title}
              </h4>
            </div>
            <button
              onClick={() => setToast(prev => ({ ...prev, show: false }))}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: 0 }}
              data-tooltip="Dismiss"
            >
              ✕
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
            {toast.message}
          </p>
          {toast.link && (
            <a
              href={toast.link}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--bg)',
                backgroundColor: 'var(--accent)',
                padding: '6px 12px',
                borderRadius: 6,
                textDecoration: 'none',
                textAlign: 'center',
                alignSelf: 'flex-start',
                
                transition: 'background 120ms ease, border-color 120ms ease',
              }}
              
              
            >
              {toast.linkLabel}
            </a>
          )}
        </div>
      )}

      {/* Main Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
            Project Templates Gallery
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Jumpstart engineering workspaces with preconfigured CAD contexts, equations, codes, and BOM tables.
          </p>
        </div>
      </div>

      {/* Controls: Search, Category, Sort, Difficulty */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }}>
        {/* Row 1: Search & Sorts */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates by part, tags, category..."
              style={{ paddingLeft: 36, width: '100%', fontSize: 12 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="input"
              style={{ fontSize: 12, width: 140 }}
            >
              <option value="All">All Difficulties</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
              <option value="Expert">Expert</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input"
              style={{ fontSize: 12, width: 160 }}
            >
              <option value="alphabetical-az">Alphabetical (A-Z)</option>
              <option value="alphabetical-za">Alphabetical (Z-A)</option>
              <option value="hours-asc">Estimated Hours (Low to High)</option>
              <option value="hours-desc">Estimated Hours (High to Low)</option>
              <option value="difficulty-asc">Difficulty (Beginner to Expert)</option>
              <option value="difficulty-desc">Difficulty (Expert to Beginner)</option>
            </select>
          </div>
        </div>

        {/* Row 2: Category tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
          {templateCategories.map((cat) => {
            const active = selectedCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '8px 14px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? '1px solid var(--accent)' : '1px solid transparent',
                  cursor: 'pointer',
                  color: active ? 'var(--text)' : '#6b6d85',
                  marginBottom: -1,
                  transition: 'color 0.15s ease, border-color 0.15s ease',
                  whiteSpace: 'nowrap',
                  fontWeight: 400,
                }}
              >
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Grid View */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
        {filteredTemplates.map((template) => {
          const hasThumbnail = !!template.thumbnail

          return (
            <div
              key={template.id}
              onClick={() => setSelectedTemplate(template)}
              style={{
                background: 'var(--surface)',
                border: '1px solid #1f1f35',
                borderRadius: 8,
                overflow: 'hidden',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                transition: 'border-color 0.15s',
                boxShadow: 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#2a2a45'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#1f1f35'
              }}
            >
              {/* Card Header Illustration */}
              <div style={{
                height: 140,
                background: '#0e0e0e',
                borderBottom: '1px solid #1f1f35',
                borderRadius: '8px 8px 0 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                padding: 20,
                position: 'relative',
              }}>
                {hasThumbnail ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: template.thumbnail }}
                    style={{ width: '100%', height: '100%', maxWidth: 240, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                  />
                ) : (
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, color: '#2a2a45' }}>
                    CAD
                  </div>
                )}
                <span style={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  fontWeight: 400,
                  padding: '2px 8px',
                  borderRadius: 3,
                  background: 'transparent',
                  color: '#6b6d85',
                  border: '1px solid #2a2a45',
                }}>
                  {template.difficulty}
                </span>
              </div>

              {/* Card Body */}
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#6b6d85', fontWeight: 400 }}>
                  {template.category}
                </span>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>
                  {template.name}
                </h3>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4, flex: 1 }}>
                  {template.tagline}
                </p>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                  {template.tags.slice(0, 3).map((tag) => (
                    <span key={tag} style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      color: '#6b6d85',
                      background: '#131313',
                      padding: '2px 7px',
                      borderRadius: 3,
                      border: '1px solid #1f1f35'
                    }}>
                      {tag}
                    </span>
                  ))}
                  {template.tags.length > 3 && (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#6b6d85', padding: '2px 3px' }}>
                      +{template.tags.length - 3}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {filteredTemplates.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <AlertCircle size={32} style={{ margin: '0 auto 12px', color: 'var(--text-dim)' }} />
            <p style={{ fontSize: 14, fontFamily: "'JetBrains Mono', monospace", margin: 0 }}>No templates match the current filters.</p>
          </div>
        )}
      </div>

      {/* Community Info Section (bottom) */}
      {selectedCategory === 'Community' && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '20px 24px',
          marginTop: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
            Submit Your Own Custom Templates
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
            To contribute a template to the gallery, publish your configuration structure inside a GitHub Gist named <code>templates.json</code>. Use the hashtag <code>#enginguity-templates</code>. Shared workspaces sync automatically for all teams!
          </p>
          <a
            href={COMMUNITY_SUBMIT_TEMPLATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--accent)',
              textDecoration: 'none',
              alignSelf: 'flex-start',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            Submit to GitHub <ExternalLink size={12} />
          </a>
        </div>
      )}

      {/* Load History Log (Side Sidebar or Bottom list) */}
      {loadLogs.length > 0 && (
        <div style={{
          marginTop: 24,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)',   }}>
              Recently Loaded Workspace History
            </span>
            <button
              onClick={handleClearHistory}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)' }}
            >
              Clear History
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loadLogs.map((log, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 6
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Library size={12} style={{ color: 'var(--text-dim)' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>{log.templateName}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>
                  Loaded: {new Date(log.loadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Modal Overlay */}
      {selectedTemplate && (
        <TemplateDetailModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onLoad={() => handleLoadTemplate(selectedTemplate)}
        />
      )}
    </div>
  )
}

export default TemplatesGallery
