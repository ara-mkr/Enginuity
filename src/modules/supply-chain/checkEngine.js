const STORAGE_KEY = 'enginguity_scm_boms'
import { logEvent } from '../../engine/eventLog'

function chunk(arr, size) {
  const result = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

export function getMonitoredBOMs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveMonitoredBOMs(boms) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(boms))
}

export function getBOMById(id) {
  return getMonitoredBOMs().find(b => b.id === id) ?? null
}

export function saveBOM(bom) {
  const boms = getMonitoredBOMs()
  const idx = boms.findIndex(b => b.id === bom.id)
  if (idx >= 0) boms[idx] = bom
  else boms.unshift(bom)
  saveMonitoredBOMs(boms)
}

export function deleteBOM(id) {
  saveMonitoredBOMs(getMonitoredBOMs().filter(b => b.id !== id))
}

const STATUS_RANK = { in_stock: 0, limited: 1, out_of_stock: 2, unknown: 3 }

function detectAlerts(item, newStatus) {
  const alerts = []
  const prev = item.lastStatus
  if (!prev || !prev.stockStatus) return alerts

  if ((STATUS_RANK[newStatus.stockStatus] ?? 3) > (STATUS_RANK[prev.stockStatus] ?? 3)) {
    alerts.push({
      type: 'stock_change',
      detail: `${item.partNumber} changed from ${prev.stockStatus} to ${newStatus.stockStatus}`,
    })
  }

  if (prev.unitPrice && newStatus.unitPrice) {
    const changePct = (newStatus.unitPrice - prev.unitPrice) / prev.unitPrice
    if (changePct > 0.2) {
      alerts.push({
        type: 'price_spike',
        detail: `${item.partNumber} price increased ${(changePct * 100).toFixed(0)}% ($${prev.unitPrice.toFixed(2)} → $${newStatus.unitPrice.toFixed(2)})`,
      })
    }
  }

  if (prev.leadTimeWeeks && newStatus.leadTimeWeeks) {
    if (newStatus.leadTimeWeeks > prev.leadTimeWeeks + 4) {
      alerts.push({
        type: 'lead_time_increase',
        detail: `${item.partNumber} lead time grew from ${prev.leadTimeWeeks} to ${newStatus.leadTimeWeeks} weeks`,
      })
    }
  }

  return alerts
}

export async function checkBOM(bom, makeRequest, onProgress) {
  const results = []
  const batches = chunk(bom.items, 5)

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi]
    onProgress?.(`Checking batch ${bi + 1}/${batches.length}...`)

    const prompt = `Check supply chain status for these electronic components.
Return a JSON array with exactly ${batch.length} entries in the same order:

Components:
${batch.map((item, i) =>
  `${i + 1}. ${item.partNumber} — ${item.description} (${item.manufacturer}), qty needed: ${item.quantity}`
).join('\n')}

For each component return:
{
  "stockStatus": "in_stock" | "limited" | "out_of_stock" | "unknown",
  "unitPrice": number | null,
  "leadTimeWeeks": number | null,
  "alerts": string[],
  "confidence": "high" | "medium" | "low"
}

Base answers on your training data about component availability. These are estimates only.
Return ONLY a JSON array, no markdown, no explanation.`

    try {
      const response = await makeRequest(
        [{ role: 'user', content: prompt }],
        'You are a supply chain analyst for electronic components. Return only valid JSON arrays.',
        { stream: false }
      )

      const cleaned = response.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
      const parsed = JSON.parse(cleaned)
      results.push(...parsed)
    } catch {
      // Push unknowns for failed batches
      for (const _ of batch) {
        results.push({ stockStatus: 'unknown', unitPrice: null, leadTimeWeeks: null, alerts: [], confidence: 'low' })
      }
    }

    // Delay between batches to avoid rate limiting
    if (bi < batches.length - 1) {
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  // Apply results back to bom items
  const now = Date.now()
  const updatedItems = bom.items.map((item, i) => {
    const result = results[i] ?? { stockStatus: 'unknown', unitPrice: null, leadTimeWeeks: null, alerts: [] }
    const newStatus = {
      stockStatus: result.stockStatus ?? 'unknown',
      unitPrice: result.unitPrice ?? null,
      leadTimeWeeks: result.leadTimeWeeks ?? null,
      checkedAt: now,
    }

    const newAlerts = detectAlerts(item, newStatus).map(a => ({
      ...a,
      detectedAt: now,
      read: false,
    }))

    // Add EOL / shortage alerts from AI
    if (result.alerts?.length) {
      for (const detail of result.alerts) {
        newAlerts.push({
          type: 'eol_warning',
          detail: `${item.partNumber}: ${detail}`,
          detectedAt: now,
          read: false,
        })
      }
    }

    const newHistory = [
      ...(item.history ?? []),
      { checkedAt: now, stockStatus: newStatus.stockStatus, unitPrice: newStatus.unitPrice, leadTimeWeeks: newStatus.leadTimeWeeks },
    ].slice(-20) // keep last 20 history points

    if (newAlerts.length > 0) {
      newAlerts.forEach(alert => {
        logEvent('SUPPLY_CHAIN_ALERT', {
          type: alert.type,
          detail: alert.detail,
          partNumber: item.partNumber,
          bomId: bom.id,
          bomName: bom.name,
          module: 'supply-chain'
        })
      })
    }

    return {
      ...item,
      lastStatus: newStatus,
      history: newHistory,
      alerts: [...(item.alerts ?? []), ...newAlerts],
    }
  })

  return { ...bom, items: updatedItems, lastChecked: now }
}

export function shouldCheck(bom) {
  if (!bom.lastChecked) return true
  const hoursSince = (Date.now() - bom.lastChecked) / 3600000
  const interval = bom.checkFrequency === 'daily' ? 24 : 168
  return hoursSince >= interval
}

export function unreadAlertCount(bom) {
  return bom.items.reduce((sum, item) => sum + (item.alerts ?? []).filter(a => !a.read).length, 0)
}

export function totalUnreadAlerts(boms) {
  return boms.reduce((sum, bom) => sum + unreadAlertCount(bom), 0)
}
