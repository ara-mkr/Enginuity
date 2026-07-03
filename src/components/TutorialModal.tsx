import React, { useState } from 'react'
import { X, ChevronRight, ChevronLeft, Zap, Box, Cpu, FlaskConical, BookOpen, Terminal, Waves, GitCompare, Radio, ClipboardList, Calculator, Trophy, CircuitBoard, ShieldCheck, LayoutDashboard, Lightbulb, TruckIcon, TestTube2, History, Library } from 'lucide-react'

interface Step {
  icon: React.ReactNode
  title: string
  tag: string
  description: string
  tips: string[]
  color: string
}

const STEPS: Step[] = [
  {
    icon: <LayoutDashboard size={28} />,
    title: 'Dashboard',
    tag: '/dashboard',
    color: '#7c6af7',
    description: 'Your mission control. See all your active projects, recent files, AI usage stats, and quick-launch any module from one place.',
    tips: [
      'Pin your most-used modules to the top for fast access',
      'The usage panel tracks your OpenRouter API spend in real time',
      'Recent files are sorted by last opened — click any to jump right back in',
    ],
  },
  {
    icon: <Box size={28} />,
    title: 'CAD Viewer',
    tag: '/cad-viewer',
    color: '#38bdf8',
    description: 'Drag and drop 3D model files (.STL, .3MF, .OBJ, .PLY, .GLB) to inspect, rotate, and analyze your parts directly in the browser.',
    tips: [
      'Your last loaded file is remembered — navigate away and come back, it stays loaded',
      'Use the top-right camera presets (Top / Front / Side) for orthographic inspection',
      'Enable "Double Sided" for thin shell models that look hollow from behind',
      'Say "analyze this design" with Jarvis open to get an AI review of your model',
      'Use the Parts panel to toggle individual components on/off in multi-body files',
    ],
  },
  {
    icon: <Cpu size={28} />,
    title: 'Datasheet Lookup',
    tag: '/datasheet',
    color: '#7aaa8a',
    description: 'Search any component by part number or description and get instant AI-summarized datasheets, pinouts, and usage notes.',
    tips: [
      'Paste a full part number (e.g. STM32F103C8T6) for exact matches',
      'Use plain English like "5V LDO under 300mA" for broad searches',
      'Click any pin in the pinout view to get its function explained',
    ],
  },
  {
    icon: <FlaskConical size={28} />,
    title: 'Simulation Assistant',
    tag: '/simulation-assistant',
    color: '#b08460',
    description: 'Describe a circuit or system and get AI-generated simulation code, transfer functions, Bode plots, and step responses.',
    tips: [
      'Start with "simulate a low-pass RC filter at 1kHz" for a quick demo',
      'Ask for SPICE netlist output if you want to import into LTspice',
      'You can follow up in the same session — the AI remembers your circuit',
    ],
  },
  {
    icon: <Zap size={28} />,
    title: 'Circuit Simulator',
    tag: '/circuit-sim',
    color: '#b09e60',
    description: 'Build and simulate schematic circuits right in the browser with a visual node editor, waveform output, and component library.',
    tips: [
      'Right-click the canvas to place components from the library',
      'Ground nodes are required on every circuit or simulation will fail',
      'Export your schematic as an image or netlist from the toolbar',
    ],
  },
  {
    icon: <CircuitBoard size={28} />,
    title: 'PCB Reviewer',
    tag: '/pcb-reviewer',
    color: '#a78bfa',
    description: 'Upload a PCB image or Gerber file and get an AI design-rule review — spacing, silkscreen issues, component placement, and more.',
    tips: [
      'Higher resolution images get more detailed feedback',
      'Mention the board house design rules (e.g. JLCPCB 2-layer) for targeted checks',
      'Ask "what would fail assembly?" for DFM-specific feedback',
    ],
  },
  {
    icon: <Cpu size={28} />,
    title: 'Footprint Generator',
    tag: '/footprint-gen',
    color: '#22d3ee',
    description: 'Describe a component package (e.g. "SOT-23-5") and generate a KiCad-compatible footprint file ready to drop into your project.',
    tips: [
      'Include pad pitch and courtyard clearance in your description for accuracy',
      'Generated footprints follow IPC-7351 land pattern standards',
      'Download the .kicad_mod file and place it in your KiCad footprint library folder',
    ],
  },
  {
    icon: <GitCompare size={28} />,
    title: 'Firmware Diff',
    tag: '/firmware-diff',
    color: '#b08a60',
    description: 'Paste two versions of firmware or code and get an AI-powered semantic diff — not just line changes, but what the changes actually mean.',
    tips: [
      'Works best with C, C++, Python, and MicroPython firmware',
      'Ask "what bugs could this change introduce?" for a risk assessment',
      'Use it to review PRs before merging hardware-critical code',
    ],
  },
  {
    icon: <GitCompare size={28} />,
    title: 'Model Comparison',
    tag: '/model-comparison',
    color: '#e879f9',
    description: 'Run the same prompt across multiple AI models side by side to compare quality, speed, and cost for your specific engineering task.',
    tips: [
      'Great for calibrating which model to use for different task types',
      'Cost-per-token is shown live so you can budget your API usage',
      'Lock in the best model for a module from the sidebar model picker',
    ],
  },
  {
    icon: <Lightbulb size={28} />,
    title: 'Project Ideas',
    tag: '/ideas',
    color: '#b09a60',
    description: 'Describe a problem or domain and get a ranked list of project ideas with difficulty ratings, component lists, and learning outcomes.',
    tips: [
      'Be specific: "IoT environmental sensor for a greenhouse under $20" beats "IoT project"',
      'Click any idea to expand it into a full project brief',
      'Save ideas to your project workspace for later development',
    ],
  },
  {
    icon: <BookOpen size={28} />,
    title: 'Notebook',
    tag: '/notebook',
    color: '#6ee7b7',
    description: 'A persistent engineering notebook with rich text, code blocks, and AI assistance. Document your designs, calculations, and decisions.',
    tips: [
      'Use /calc blocks for inline formula evaluation',
      'Ask the AI to "summarize this page" for quick meeting notes',
      'Notebooks are saved per-project — switch projects in the sidebar to access different notebooks',
    ],
  },
  {
    icon: <Terminal size={28} />,
    title: 'Debug Console',
    tag: '/debug-console',
    color: '#7aaa8a',
    description: 'Paste error messages, stack traces, or misbehaving code and get AI-guided root cause analysis and fix suggestions.',
    tips: [
      'Include the full error trace, not just the last line',
      'Mention your toolchain version (e.g. GCC 12, Arduino 1.8.19) for targeted fixes',
      'Ask "explain this error to a beginner" for simpler breakdowns',
    ],
  },
  {
    icon: <Calculator size={28} />,
    title: 'Formula Lab',
    tag: '/formula-lab',
    color: '#60a5fa',
    description: 'Solve engineering formulas interactively — input values, get computed outputs, and see the derivation with unit analysis.',
    tips: [
      'Type a formula name like "Ohm\'s Law" or paste a raw equation',
      'All SI unit conversions are handled automatically',
      'Ask "what resistor do I need for 20mA through an LED at 3.3V?" for practical examples',
    ],
  },
  {
    icon: <ClipboardList size={28} />,
    title: 'BOM Intel',
    tag: '/bom',
    color: '#b07888',
    description: 'Upload or paste a Bill of Materials and get live pricing, availability, and alternative part suggestions from multiple distributors.',
    tips: [
      'CSV and Excel BOMs are supported — make sure part numbers are in a "MPN" column',
      'Ask for "drop-in alternatives" on any line item to find substitutes during shortages',
      'Export the enriched BOM back to CSV with pricing columns filled in',
    ],
  },
  {
    icon: <TruckIcon size={28} />,
    title: 'Supply Chain',
    tag: '/supply-chain',
    color: '#94a3b8',
    description: 'Monitor component lead times, flag at-risk parts in your design, and get early warning on supply disruptions affecting your BOM.',
    tips: [
      'Paste part numbers one per line for bulk lead time checks',
      'Red flags indicate parts with lead times over 26 weeks or allocation restrictions',
      'Pair with BOM Intel for a full procurement risk picture',
    ],
  },
  {
    icon: <TestTube2 size={28} />,
    title: 'Test Harness',
    tag: '/test-harness',
    color: '#a3e635',
    description: 'Generate automated test scripts for hardware, firmware, or embedded systems based on your spec or schematic description.',
    tips: [
      'Describe the DUT (device under test) and expected behavior for best results',
      'Outputs Python (pytest), C (Unity), or Arduino test sketches',
      'Ask to "add edge case tests for power-off behavior" to improve coverage',
    ],
  },
  {
    icon: <ShieldCheck size={28} />,
    title: 'Compliance',
    tag: '/compliance',
    color: '#7aaa8a',
    description: 'Check your product design against CE, FCC, RoHS, UL, and other regulatory standards with AI-guided compliance checklists.',
    tips: [
      'Specify your target market (EU, US, etc.) and product category upfront',
      'Use the checklist export to share with your certification lab',
      'Ask "what testing is required for CE Mark on a Class B device?"',
    ],
  },
  {
    icon: <History size={28} />,
    title: 'Version History',
    tag: '/history',
    color: '#c4b5fd',
    description: 'Browse, diff, and restore previous versions of your project files stored across your workspace sessions.',
    tips: [
      'Snapshots are created automatically on every significant save',
      'Click any snapshot to preview it before restoring',
      'Use the diff view to see exactly what changed between two versions',
    ],
  },
  {
    icon: <Library size={28} />,
    title: 'Templates',
    tag: '/templates',
    color: 'rgba(160,120,80,0.18)',
    description: 'Browse and import pre-built project templates — from motor controllers to sensor nodes — as a starting point for your design.',
    tips: [
      'Templates include schematics, firmware stubs, and BOM starters',
      'Fork any template to your project with one click',
      'Export your own designs as templates to reuse across projects',
    ],
  },
  {
    icon: <Trophy size={28} />,
    title: 'Challenges',
    tag: '/challenges',
    color: '#b09a70',
    description: 'Sharpen your engineering skills with timed design challenges, spec-driven build prompts, and community submissions.',
    tips: [
      'Weekly challenges refresh every Monday — check back for new ones',
      'Submit your solution to get AI feedback scored against the spec',
      'Leaderboard rankings are based on efficiency, BOM cost, and design quality',
    ],
  },
  {
    icon: <Radio size={28} />,
    title: 'Collaborate',
    tag: '/collaborate',
    color: '#67e8f9',
    description: 'Share your workspace with teammates in real time — co-edit notebooks, review designs together, and leave inline comments.',
    tips: [
      'Generate a share link from the Collaborate tab — no sign-up required for guests',
      'Comments are anchored to specific design elements, not just pages',
      'Use presence indicators to see which section teammates are viewing',
    ],
  },
  {
    icon: <Waves size={28} />,
    title: 'Jarvis',
    tag: '/jarvis',
    color: '#818cf8',
    description: 'Your voice-controlled AI engineering assistant. Wake it with "Hey Jarvis" and use natural speech to search, analyze, generate, and control the entire workspace hands-free.',
    tips: [
      'Say "Hey Jarvis, open the CAD viewer" to navigate with your voice',
      'Say "turn on camera" then "analyze this circuit" to get a visual AI review',
      'Say "take a photo" to capture and annotate what\'s on your bench',
      'Say "search for [component]" to pull up datasheets instantly',
      'Say "summarize my notebook" to get a spoken briefing of your notes',
      'The canvas is infinite — items you place stay until you clear them',
    ],
  },
]

interface Props {
  onClose: () => void
}

export function TutorialModal({ onClose }: Props) {
  const [step, setStep] = useState(0)

  const current = STEPS[step]
  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 560,
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--surface-2)' }}>
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: current.color,
              transition: 'width 0.3s ease, background 0.3s ease',
            }}
          />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 0' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {step + 1} / {STEPS.length}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 6 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Icon + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 12, flexShrink: 0,
              background: `${current.color}18`,
              border: `1px solid ${current.color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: current.color,
              transition: 'all 0.3s ease',
            }}>
              {current.icon}
            </div>
            <div>
              <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                {current.title}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: current.color, marginTop: 2 }}>
                {current.tag}
              </div>
            </div>
          </div>

          {/* Description */}
          <p style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            {current.description}
          </p>

          {/* Tips */}
          <div style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
              Tips &amp; Tricks
            </div>
            {current.tips.map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: current.color, fontSize: 12, marginTop: 2, flexShrink: 0 }}>→</span>
                <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{tip}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer nav */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px 16px',
          borderTop: '1px solid var(--border)',
        }}>
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 8, padding: '7px 14px', cursor: step === 0 ? 'not-allowed' : 'pointer',
              color: step === 0 ? 'var(--text-dim)' : 'var(--text-muted)',
              fontSize: 13, fontFamily: "'DM Sans', system-ui, sans-serif",
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (step > 0) e.currentTarget.style.borderColor = 'var(--border-bright)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <ChevronLeft size={14} /> Back
          </button>

          {/* Dot indicators */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                style={{
                  width: i === step ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === step ? current.color : 'var(--border)',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.2s ease',
                }}
              />
            ))}
          </div>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: current.color, border: 'none',
                borderRadius: 8, padding: '7px 16px', cursor: 'pointer',
                color: '#000', fontWeight: 600,
                fontSize: 13, fontFamily: "'DM Sans', system-ui, sans-serif",
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={onClose}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: current.color, border: 'none',
                borderRadius: 8, padding: '7px 16px', cursor: 'pointer',
                color: '#000', fontWeight: 600,
                fontSize: 13, fontFamily: "'DM Sans', system-ui, sans-serif",
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
