import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Hash, Layers, DollarSign, AlertTriangle, HelpCircle } from 'lucide-react'
import type { BOMItem } from './types'

interface Props {
  items: BOMItem[]
}

const CATEGORY_COLORS = {
  'ICs': '#7ab4c4',         // Cyan
  'Passives': '#7b5ea7',    // Purple
  'Connectors': '#7aaa8a',  // Green
  'Mechanical': '#b09470',  // Orange
  'Other': '#6b6d85',       // Grey
}

function categorize(item: BOMItem): keyof typeof CATEGORY_COLORS {
  const desc = (item.description || '').toLowerCase()
  const part = (item.part_number || '').toLowerCase()
  const refs = (item.reference_designators || '').toLowerCase()

  if (
    /ic|chip|opamp|mcu|microcontroller|transceiver|regulator|sensor|adc|dac|op-amp|comparator|stm32|esp32|gate|driver/i.test(desc) ||
    /ic|chip|opamp|mcu|microcontroller|transceiver|regulator|sensor|adc|dac|op-amp|comparator|stm32|esp32|gate|driver/i.test(part) ||
    /^(u\d+|ic\d+)/i.test(refs)
  ) {
    return 'ICs'
  }
  if (
    /resistor|capacitor|inductor|ferrite|bead|varistor|potentiometer|cap\b|res\b|ind\b/i.test(desc) ||
    /resistor|capacitor|inductor|ferrite|bead|varistor|potentiometer|cap\b|res\b|ind\b/i.test(part) ||
    /^(r\d+|c\d+|l\d+|fb\d+|c_)/i.test(refs)
  ) {
    return 'Passives'
  }
  if (
    /connector|header|plug|jack|terminal|socket|pin|jst|molex|usb|hdmi/i.test(desc) ||
    /connector|header|plug|jack|terminal|socket|pin|jst|molex|usb|hdmi/i.test(part) ||
    /^(j\d+|p\d+|con\d+|t\d+)/i.test(refs)
  ) {
    return 'Connectors'
  }
  if (
    /screw|standoff|spacer|bracket|housing|enclosure|heatsink|fan|mechanical|washer|nut|bolt/i.test(desc) ||
    /screw|standoff|spacer|bracket|housing|enclosure|heatsink|fan|mechanical|washer|nut|bolt/i.test(part) ||
    /^(h\d+|mp\d+|mech\d+)/i.test(refs)
  ) {
    return 'Mechanical'
  }
  return 'Other'
}

export function CostSummary({ items }: Props) {
  const stats = useMemo(() => {
    let totalLines = items.length
    let totalComponents = 0
    let estimatedCost = 0
    let atRiskCount = 0
    let missingPartNumbers = 0

    items.forEach((item) => {
      totalComponents += item.quantity || 0
      
      const price = item.unitPrice ?? 0
      estimatedCost += (item.quantity || 0) * price

      const isOutOfStock = item.stockStatus === 'out_of_stock'
      const isLongLead = (item.leadTimeWeeks ?? 0) > 12
      if (isOutOfStock || isLongLead) {
        atRiskCount += item.quantity || 0
      }

      if (!item.part_number || !item.part_number.trim()) {
        missingPartNumbers++
      }
    })

    return {
      totalLines,
      totalComponents,
      estimatedCost,
      atRiskCount,
      missingPartNumbers,
    }
  }, [items])

  const chartData = useMemo(() => {
    const categoryCosts: Record<string, number> = {
      'ICs': 0,
      'Passives': 0,
      'Connectors': 0,
      'Mechanical': 0,
      'Other': 0,
    }

    items.forEach((item) => {
      const cat = categorize(item)
      const cost = (item.quantity || 0) * (item.unitPrice ?? 0)
      categoryCosts[cat] += cost
    })

    const data = Object.entries(categoryCosts)
      .map(([name, value]) => ({
        name,
        value: parseFloat(value.toFixed(2)),
      }))
      .filter((entry) => entry.value > 0)

    return data
  }, [items])

  const hasCostData = chartData.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Metric Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        {[
          { label: 'Total Line Items', value: stats.totalLines, icon: Hash, color: 'var(--accent)' },
          { label: 'Total Components', value: stats.totalComponents, icon: Layers, color: '#9485b8' },
          { label: 'Estimated BOM Cost', value: `$${stats.estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: DollarSign, color: '#7aaa8a' },
          { label: 'At Risk Components', value: stats.atRiskCount, icon: AlertTriangle, color: stats.atRiskCount > 0 ? '#b08080' : 'var(--text-muted)' },
          { label: 'Missing Part Numbers', value: stats.missingPartNumbers, icon: HelpCircle, color: stats.missingPartNumbers > 0 ? '#b09470' : 'var(--text-muted)' },
        ].map((card, i) => {
          const Icon = card.icon
          return (
            <div
              key={i}
              className="card"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
                borderWidth: 1,
                borderStyle: 'solid',
                borderRadius: 12,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: `${card.color}10`,
                  border: `1px solid ${card.color}24`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={18} style={{ color: card.color }} />
              </div>
              <div>
                <span className="label" style={{ display: 'block', fontSize: 10, marginBottom: 2 }}>{card.label}</span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 20,
                    fontWeight: 700,
                    color: 'var(--text)',
                  }}
                >
                  {card.value}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Donut Chart Card */}
      {hasCostData && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <span className="label" style={{ fontSize: 11,  }}>Cost Breakdown by Category</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap' }}>
            <div style={{ width: 180, height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry) => (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={CATEGORY_COLORS[entry.name as keyof typeof CATEGORY_COLORS] || '#6b6d85'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Cost']}
                    contentStyle={{
                      background: 'var(--surface-2)',
                      borderColor: 'var(--border-bright)',
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: 'var(--text)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legend with percentages */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 200 }}>
              {chartData.map((entry) => {
                const color = CATEGORY_COLORS[entry.name as keyof typeof CATEGORY_COLORS] || '#6b6d85'
                const percent = ((entry.value / stats.estimatedCost) * 100).toFixed(1)
                return (
                  <div key={entry.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)' }}>{entry.name}</span>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", display: 'flex', gap: 16 }}>
                      <span style={{ color: 'var(--text-muted)' }}>${entry.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      <span style={{ color, fontWeight: 600, width: 50, textAlign: 'right' }}>{percent}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
