/**
 * Central registry of every tool available in ENGINGUITY.
 *
 * Sidebar.tsx no longer hardcodes its list — it reads from here, filtered by
 * the user's installed-tools set (managed by useInstalledTools). New built-in
 * tools are added by appending to BUILTIN_TOOLS below.
 *
 * Community tools are loaded via the Tool Marketplace as JSON manifests and
 * stored separately in localStorage; see useInstalledTools.ts.
 */

import {
  LayoutDashboard, Box, Sliders, Sparkles, FlaskConical, Lightbulb,
  Terminal, Clock, Radio, GitCompare, Zap, Cpu, BookOpen, ClipboardList,
  Calculator, Library, Trophy, Home, CircuitBoard,
  History, TruckIcon, TestTube2, ShieldCheck, Waves, FileText, Pencil,
  Store, Wrench, Package, Puzzle, Code, Globe, Settings, Activity,
} from 'lucide-react'
import type { ComponentType } from 'react'

export type ToolCategory =
  | 'Core'
  | 'Mechanical'
  | 'Electrical'
  | 'Firmware'
  | 'AI'
  | 'Documentation'
  | 'Supply Chain'
  | 'Quality'
  | 'Collaboration'
  | 'Custom'

export interface BuiltinTool {
  id: string
  /** Route path, e.g. `/dashboard` */
  to: string
  label: string
  description: string
  icon: ComponentType<{ size?: number; style?: any; className?: string }>
  category: ToolCategory
  /** True if this tool appears in a fresh sidebar with no user customization. */
  defaultInstalled: boolean
  /** True if the user cannot uninstall it (Home, Marketplace). */
  pinned?: boolean
  kind: 'builtin'
}

export const BUILTIN_TOOLS: BuiltinTool[] = [
  // ─── Always-pinned ──────────────────────────────────────────────────────────
  {
    id: 'home', to: '/', label: 'Home', icon: Home, category: 'Core',
    description: 'Project landing page and entry point.',
    defaultInstalled: true, pinned: true, kind: 'builtin',
  },
  {
    id: 'tool-marketplace', to: '/marketplace', label: 'Tool Marketplace', icon: Store, category: 'Core',
    description: 'Browse, install, and share tools.',
    defaultInstalled: true, pinned: true, kind: 'builtin',
  },

  // ─── Default-installed core tools ───────────────────────────────────────────
  {
    id: 'dashboard', to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, category: 'Core',
    description: 'Project status, recent activity, and key metrics.',
    defaultInstalled: true, kind: 'builtin',
  },
  {
    id: 'jarvis', to: '/jarvis', label: 'Jarvis', icon: Waves, category: 'AI',
    description: 'Voice-controlled infinite-canvas workspace.',
    defaultInstalled: true, kind: 'builtin',
  },
  {
    id: 'cad-viewer', to: '/cad-viewer', label: 'CAD Viewer', icon: Box, category: 'Mechanical',
    description: 'Load and inspect 3D models (STL, STEP, etc.).',
    defaultInstalled: true, kind: 'builtin',
  },
  {
    id: 'parameter-playground', to: '/parameter-playground', label: 'Parameters', icon: Sliders, category: 'Mechanical',
    description: 'Live-tweak design parameters and watch downstream effects.',
    defaultInstalled: true, kind: 'builtin',
  },
  {
    id: 'asset-generator', to: '/asset-generator', label: 'Asset Gen', icon: Sparkles, category: 'AI',
    description: 'Generate images and diagrams from prompts.',
    defaultInstalled: true, kind: 'builtin',
  },
  {
    id: 'simulation-assistant', to: '/simulation-assistant', label: 'Simulation', icon: FlaskConical, category: 'AI',
    description: 'AI assistant for setting up engineering simulations.',
    defaultInstalled: true, kind: 'builtin',
  },
  {
    id: 'project-ideas', to: '/ideas', label: 'Project Ideas', icon: Lightbulb, category: 'AI',
    description: 'AI-generated project concepts and feasibility starting points.',
    defaultInstalled: true, kind: 'builtin',
  },
  {
    id: 'model-comparison', to: '/model-comparison', label: 'Model Compare', icon: GitCompare, category: 'AI',
    description: 'Run the same prompt across multiple LLMs side-by-side.',
    defaultInstalled: true, kind: 'builtin',
  },
  {
    id: 'circuit-sim', to: '/circuit-sim', label: 'Circuit Simulator', icon: Zap, category: 'Electrical',
    description: 'Launch the Velxio circuit and microcontroller simulator.',
    defaultInstalled: true, kind: 'builtin',
  },
  {
    id: 'simulation-lab', to: '/simulation', label: 'Simulation Lab', icon: Activity, category: 'Electrical',
    description: 'Multi-domain simulation workspace with a SPICE-lite circuit engine.',
    defaultInstalled: true, kind: 'builtin',
  },
  {
    id: 'collaborate', to: '/collaborate', label: 'Collaborate', icon: Radio, category: 'Collaboration',
    description: 'Multi-user collaboration surface.',
    defaultInstalled: true, kind: 'builtin',
  },
  {
    id: 'notebook', to: '/notebook', label: 'Notebook', icon: BookOpen, category: 'Documentation',
    description: 'Engineering lab notebook with timestamped entries.',
    defaultInstalled: true, kind: 'builtin',
  },
  {
    id: 'bom', to: '/bom', label: 'BOM Intel', icon: ClipboardList, category: 'Supply Chain',
    description: 'Bill-of-materials management with AI sourcing intelligence.',
    defaultInstalled: true, kind: 'builtin',
  },
  {
    id: 'formula-lab', to: '/formula-lab', label: 'Formula Lab', icon: Calculator, category: 'AI',
    description: 'Interactive engineering formula calculator with units.',
    defaultInstalled: true, kind: 'builtin',
  },
  {
    id: 'templates', to: '/templates', label: 'Templates', icon: Library, category: 'Documentation',
    description: 'Reusable project and document templates.',
    defaultInstalled: true, kind: 'builtin',
  },
  {
    id: 'pcb-reviewer', to: '/pcb-reviewer', label: 'PCB Reviewer', icon: CircuitBoard, category: 'Electrical',
    description: 'AI critique of PCB layouts.',
    defaultInstalled: true, kind: 'builtin',
  },
  {
    id: 'history', to: '/history', label: 'Version History', icon: History, category: 'Core',
    description: 'Snapshots and rollback across project state.',
    defaultInstalled: true, kind: 'builtin',
  },
  {
    id: 'timeline', to: '/timeline', label: 'Project Timeline', icon: Clock, category: 'Core',
    description: 'Chronological view of project milestones and events.',
    defaultInstalled: true, kind: 'builtin',
  },
  {
    id: 'live-docs', to: '/live-docs', label: 'Live Docs', icon: FileText, category: 'Documentation',
    description: 'Live, data-bound project documentation.',
    defaultInstalled: true, kind: 'builtin',
  },
  {
    id: 'drawing-board', to: '/drawing-board', label: 'Drawing Board', icon: Pencil, category: 'Documentation',
    description: 'Freehand sketching and annotation canvas.',
    defaultInstalled: true, kind: 'builtin',
  },

  // ─── Marketplace-only by default (user must install) ────────────────────────
  {
    id: 'footprint-gen', to: '/footprint-gen', label: 'Footprint Gen', icon: Cpu, category: 'Electrical',
    description: 'Generate IPC-7351 PCB footprints with KiCad export.',
    defaultInstalled: false, kind: 'builtin',
  },
  {
    id: 'datasheet', to: '/datasheet', label: 'Datasheet', icon: Cpu, category: 'Electrical',
    description: 'Extract structured, queryable knowledge cards from component datasheets.',
    defaultInstalled: false, kind: 'builtin',
  },
  {
    id: 'firmware-diff', to: '/firmware-diff', label: 'Firmware Diff', icon: GitCompare, category: 'Firmware',
    description: 'Compare firmware revisions semantically — HEX, BIN, ELF, ZIP.',
    defaultInstalled: false, kind: 'builtin',
  },
  {
    id: 'test-harness', to: '/test-harness', label: 'Test Harness', icon: TestTube2, category: 'Quality',
    description: 'AI-generated tests for Python and JavaScript functions.',
    defaultInstalled: false, kind: 'builtin',
  },
  {
    id: 'supply-chain', to: '/supply-chain', label: 'Supply Chain', icon: TruckIcon, category: 'Supply Chain',
    description: 'Monitor BOMs for part availability, pricing, and lead-time changes.',
    defaultInstalled: false, kind: 'builtin',
  },
  {
    id: 'compliance', to: '/compliance', label: 'Compliance', icon: ShieldCheck, category: 'Quality',
    description: 'Identify required certifications, cost, and timeline for a product.',
    defaultInstalled: false, kind: 'builtin',
  },
  {
    id: 'debug-console', to: '/debug-console', label: 'Debug Console', icon: Terminal, category: 'Core',
    description: 'Internal logs, telemetry, and AI request inspection.',
    defaultInstalled: false, kind: 'builtin',
  },
  {
    id: 'challenges', to: '/challenges', label: 'Challenges', icon: Trophy, category: 'AI',
    description: 'Gamified engineering challenge mode.',
    defaultInstalled: false, kind: 'builtin',
  },
]

// ─── Community / custom tools (uploaded via .tool.json) ─────────────────────────

/**
 * Minimal manifest for a community tool. The user uploads one of these via the
 * marketplace; it's stored in localStorage and rendered via a CustomToolFrame
 * (iframe-based) at `/custom/<id>`.
 */
export interface CustomToolManifest {
  /** kebab-case, unique. Used in the route `/custom/<id>`. */
  id: string
  label: string
  description: string
  category?: ToolCategory | string
  /** Lucide icon name; falls back to a generic Puzzle icon. */
  icon?: string
  /** External URL to embed in an iframe. */
  url?: string
  /** Inline HTML, used via srcdoc if no url. */
  html?: string
  /** Author attribution, optional. */
  author?: string
  /** Semver-ish, optional. */
  version?: string
}

export interface CustomTool extends CustomToolManifest {
  kind: 'custom'
  /** Always true once added — only built-ins can be marketplace-only. */
  defaultInstalled: true
  /** Route, computed from id. */
  to: string
}

export const CUSTOM_ICON_MAP: Record<string, ComponentType<{ size?: number; style?: any }>> = {
  Wrench, Package, Puzzle, Code, Globe, Settings, Sparkles, Cpu, Zap, BookOpen,
  ClipboardList, Calculator, Library, Trophy, FileText, Pencil, Waves,
}

export function iconForCustomTool(name?: string) {
  if (!name) return Puzzle
  return CUSTOM_ICON_MAP[name] || Puzzle
}

export function isValidManifest(obj: unknown): obj is CustomToolManifest {
  if (!obj || typeof obj !== 'object') return false
  const m = obj as Record<string, unknown>
  if (typeof m.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/i.test(m.id)) return false
  if (typeof m.label !== 'string' || m.label.length === 0) return false
  if (typeof m.description !== 'string') return false
  if (m.url && typeof m.url !== 'string') return false
  if (m.html && typeof m.html !== 'string') return false
  if (!m.url && !m.html) return false
  return true
}

export type Tool = BuiltinTool | CustomTool

export function getBuiltinById(id: string): BuiltinTool | undefined {
  return BUILTIN_TOOLS.find((t) => t.id === id)
}

export function defaultInstalledIds(): string[] {
  return BUILTIN_TOOLS.filter((t) => t.defaultInstalled).map((t) => t.id)
}
