import { moduleStateStore } from '../../store/moduleState'

// ── Observation rules ─────────────────────────────────────────────────────────

const OBSERVATION_RULES = [

  // PARAMETER PLAYGROUND
  {
    id: 'playground_efficiency_low',
    module: 'playground',
    cooldown: 180000,
    condition: (data) =>
      data.outputs?.efficiency !== undefined &&
      data.outputs.efficiency < 0.85,
    message: (data) =>
      `Efficiency is at ${(data.outputs.efficiency * 100).toFixed(1)}% — ` +
      `below the 85% threshold common for power converter designs. ` +
      `Consider adjusting switching frequency or inductor value.`,
    actions: [{ label: 'Open Formula Lab', route: '/formula-lab' }]
  },
  {
    id: 'playground_power_high',
    module: 'playground',
    cooldown: 180000,
    condition: (data) =>
      data.outputs?.power !== undefined &&
      data.outputs.power > 100,
    message: (data) =>
      `Output power is ${data.outputs.power.toFixed(1)}W. ` +
      `At this level, thermal management becomes critical. ` +
      `A heatsink or forced air cooling is likely required.`,
    actions: [{ label: 'Check thermal design', route: '/formula-lab' }]
  },
  {
    id: 'playground_voltage_high',
    module: 'playground',
    cooldown: 300000,
    condition: (data) =>
      data.parameters?.voltage !== undefined &&
      data.parameters.voltage > 48,
    message: (data) =>
      `Supply voltage is ${data.parameters.voltage}V — above 48V requires ` +
      `reinforced insulation and safety-rated isolation per IEC 60950. ` +
      `Double-check your creepage and clearance distances.`
  },

  // CAD VIEWER
  {
    id: 'cad_thin_wall',
    module: 'cad',
    cooldown: 300000,
    condition: (data) => {
      const minDim = Math.min(
        data.boundingBox?.x ?? 999,
        data.boundingBox?.y ?? 999,
        data.boundingBox?.z ?? 999
      )
      return minDim > 0 && minDim < 1.2
    },
    message: (data) => {
      const minDim = Math.min(
        data.boundingBox.x,
        data.boundingBox.y,
        data.boundingBox.z
      ).toFixed(1)
      return `Smallest dimension is ${minDim}mm — below the 1.2mm ` +
        `minimum wall thickness for FDM printing. This feature may ` +
        `not print reliably on most desktop printers.`
    }
  },
  {
    id: 'cad_large_file',
    module: 'cad',
    cooldown: 600000,
    condition: (data) => data.stats?.vertices > 500000,
    message: (data) =>
      `This model has ${(data.stats.vertices / 1000).toFixed(0)}K vertices. ` +
      `Consider decimating to under 500K for better slicer performance. ` +
      `Blender's Decimate modifier or Meshmixer can reduce this.`
  },
  {
    id: 'cad_aspect_ratio',
    module: 'cad',
    cooldown: 300000,
    condition: (data) => {
      const bb = data.boundingBox
      if (!bb) return false
      const dims = [bb.x, bb.y, bb.z].filter(d => d > 0)
      if (dims.length < 2) return false
      const max = Math.max(...dims)
      const min = Math.min(...dims)
      return max / min > 10
    },
    message: (data) => {
      const bb = data.boundingBox
      const max = Math.max(bb.x, bb.y, bb.z).toFixed(1)
      const min = Math.min(bb.x, bb.y, bb.z).toFixed(1)
      return `High aspect ratio detected (${max}mm vs ${min}mm). ` +
        `Long thin parts are prone to warping in FDM — ` +
        `use a brim or orient the long axis vertically if strength permits.`
    }
  },

  // BOM
  {
    id: 'bom_out_of_stock',
    module: 'bom',
    cooldown: 300000,
    condition: (data) => data.outOfStock > 0,
    message: (data) =>
      `${data.outOfStock} component${data.outOfStock > 1 ? 's are' : ' is'} ` +
      `out of stock. Consider finding alternatives before finalizing ` +
      `your design to avoid production delays.`,
    actions: [{ label: 'Find alternatives', action: 'bom_find_alts' }]
  },
  {
    id: 'bom_high_risk',
    module: 'bom',
    cooldown: 600000,
    condition: (data) => data.highRiskItems?.length > 0,
    message: (data) =>
      `${data.highRiskItems[0]} has known supply chain risk. ` +
      `Single-source components like this can delay production ` +
      `by months if supply tightens. Consider identifying a second source.`
  },
  {
    id: 'bom_cost_high',
    module: 'bom',
    cooldown: 600000,
    condition: (data) => data.totalCost > 200,
    message: (data) =>
      `BOM total is $${data.totalCost.toFixed(2)}. ` +
      `At this cost, consider sourcing passives in bulk reels — ` +
      `typically 30–50% cheaper than cut tape for production runs.`
  },

  // DEBUG CONSOLE
  {
    id: 'debug_c_volatile',
    module: 'debug',
    cooldown: 600000,
    condition: (data) =>
      data.language === 'C' &&
      data.code?.includes('ISR') &&
      !data.code?.includes('volatile'),
    message: () =>
      `Variables shared between ISR and main code should be declared volatile. ` +
      `Without it, the compiler may optimize away reads ` +
      `and your ISR updates will be silently ignored.`
  },
  {
    id: 'debug_large_file',
    module: 'debug',
    cooldown: 600000,
    condition: (data) => data.lineCount > 500,
    message: (data) =>
      `At ${data.lineCount} lines this file is getting large. ` +
      `Consider splitting into logical modules — ` +
      `peripheral drivers, application logic, and configuration separately.`
  },
  {
    id: 'debug_c_malloc',
    module: 'debug',
    cooldown: 600000,
    condition: (data) =>
      (data.language === 'C' || data.language === 'C++') &&
      data.code?.includes('malloc'),
    message: () =>
      `Dynamic memory allocation (malloc) in embedded firmware is risky. ` +
      `Heap fragmentation can cause non-deterministic failures after hours of operation. ` +
      `Prefer static allocation or memory pools for safety-critical code.`
  },
  {
    id: 'jarvis_pattern_alert',
    module: 'jarvis',
    cooldown: 0,
    condition: (data) => data.patternAlert !== undefined && data.patternAlert !== null,
    message: (data) => data.patternAlert,
    actions: [{ label: 'View in Notebook', route: '/notebook' }]
  }
]

// ── Engine ────────────────────────────────────────────────────────────────────

const lastFired = new Map()
let addMessageCallback = null
let settingsGetter = () => ({ proactive: true, sensitivity: 'normal' })

function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

const SENSITIVITY_FILTER = {
  minimal: ['playground_efficiency_low', 'bom_out_of_stock', 'debug_c_volatile'],
  normal: null, // all rules
  detailed: null // all rules, but with lower effective cooldowns
}

function evaluateRules(state) {
  if (!addMessageCallback) return
  const settings = settingsGetter()
  if (!settings.proactive) return
  if (!state.activeModule) return

  const moduleData = state.moduleData[state.activeModule]
  if (!moduleData) return

  const now = Date.now()
  const sensitivity = settings.sensitivity || 'normal'
  const allowedIds = SENSITIVITY_FILTER[sensitivity]
  const cooldownMultiplier = sensitivity === 'detailed' ? 0.5 : 1

  for (const rule of OBSERVATION_RULES) {
    if (rule.module !== state.activeModule) continue
    if (allowedIds && !allowedIds.includes(rule.id)) continue

    const lastFiredTime = lastFired.get(rule.id) || 0
    const effectiveCooldown = rule.cooldown * cooldownMultiplier
    if (now - lastFiredTime < effectiveCooldown) continue

    try {
      if (rule.condition(moduleData)) {
        lastFired.set(rule.id, now)
        addMessageCallback({
          type: 'proactive',
          text: rule.message(moduleData),
          actions: rule.actions || [],
          timestamp: Date.now()
        })
        break // one proactive at a time
      }
    } catch {
      // rule errors are silent
    }
  }
}

const debouncedEvaluate = debounce(evaluateRules, 2000)

export function initObservationEngine(onMessage, getSettings) {
  addMessageCallback = onMessage
  if (getSettings) settingsGetter = getSettings
  const unsub = moduleStateStore.subscribe(debouncedEvaluate)
  return unsub
}

export function resetRuleCooldowns() {
  lastFired.clear()
}
