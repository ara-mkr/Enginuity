// Oscilloscope-style bottom panel: transient node-voltage traces or an AC
// Bode plot (magnitude + phase). Trace colors resolve from the shared
// --chart-trace-* palette via useChartPalette (recharts strokes are SVG
// presentation attributes and can't read var() themselves). Buffers arrive
// already coarsened by the solver; CSV export writes the full result.

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useChartPalette } from '../../../hooks/useChartPalette'
import { formatEngNotation } from '../core/engNotation'
import type { ACRunResult, TransientRunResult } from '../core/runAnalysis'

interface Props {
  circuitName: string
  result: TransientRunResult | ACRunResult
  stale: boolean
}

const uiFont = "var(--font-family-ui, 'Geist', sans-serif)"
const monoFont = "var(--font-family-mono, 'Geist Mono', monospace)"

const axisTick = { fill: 'var(--color-text-muted)', fontSize: 10 }
const tooltipStyle = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  fontFamily: monoFont,
  fontSize: 11,
}

export function WaveformViewer({ circuitName, result, stale }: Props) {
  const [open, setOpen] = useState(true)
  const palette = useChartPalette()

  const nodeIds = useMemo(() => {
    const source = result.kind === 'transient' ? result.nodeVoltages : result.magnitudeDb
    return Object.keys(source)
      .map(Number)
      .filter((n) => n !== 0)
      .sort((a, b) => a - b)
  }, [result])

  const [hidden, setHidden] = useState<Set<number>>(new Set())
  const toggleNode = (id: number) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const visible = nodeIds.filter((n) => !hidden.has(n))

  const colorOf = (id: number) => palette[nodeIds.indexOf(id) % palette.length]

  const exportCSV = () => {
    const lines: string[] = []
    if (result.kind === 'transient') {
      lines.push(['time_s', ...nodeIds.map((n) => `V(N${n})`)].join(','))
      for (let i = 0; i < result.time.length; i++) {
        lines.push([result.time[i], ...nodeIds.map((n) => result.nodeVoltages[n][i])].join(','))
      }
    } else {
      lines.push(['frequency_hz', ...nodeIds.flatMap((n) => [`mag_db(N${n})`, `phase_deg(N${n})`])].join(','))
      for (let i = 0; i < result.frequency.length; i++) {
        lines.push(
          [result.frequency[i], ...nodeIds.flatMap((n) => [result.magnitudeDb[n][i], result.phaseDeg[n][i]])].join(','),
        )
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${circuitName.replace(/[^\w-]+/g, '_')}-${result.kind}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      style={{
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        opacity: stale ? 0.65 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            fontFamily: uiFont,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: 0,
          }}
        >
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {result.kind === 'transient' ? 'Waveforms' : 'Bode Plot'}
        </button>
        {stale && (
          <span style={{ fontFamily: monoFont, fontSize: 10, color: 'var(--color-warning)' }}>stale — re-run</span>
        )}

        <div style={{ flex: 1 }} />

        {/* Trace toggles */}
        {nodeIds.map((id) => {
          const active = !hidden.has(id)
          return (
            <button
              key={id}
              onClick={() => toggleNode(id)}
              title={`Toggle N${id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 7px',
                background: active ? 'var(--color-surface-raised)' : 'transparent',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                cursor: 'pointer',
                opacity: active ? 1 : 0.45,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 2, background: colorOf(id) }} />
              <span style={{ fontFamily: monoFont, fontSize: 10.5, color: 'var(--color-text-secondary)' }}>N{id}</span>
            </button>
          )
        })}

        <button
          onClick={exportCSV}
          title="Export CSV"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 9px',
            background: 'transparent',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            color: 'var(--color-text-secondary)',
            fontFamily: uiFont,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          <Download size={12} />
          CSV
        </button>
      </div>

      {open && result.kind === 'transient' && (
        <TransientChart result={result} visible={visible} colorOf={colorOf} />
      )}
      {open && result.kind === 'ac' && <BodeCharts result={result} visible={visible} colorOf={colorOf} />}
    </div>
  )
}

function TransientChart({
  result,
  visible,
  colorOf,
}: {
  result: TransientRunResult
  visible: number[]
  colorOf: (id: number) => string
}) {
  const data = useMemo(
    () =>
      result.time.map((t, i) => {
        const row: Record<string, number> = { t }
        for (const [node, series] of Object.entries(result.nodeVoltages)) {
          if (Number(node) !== 0) row[`n${node}`] = series[i]
        }
        return row
      }),
    [result],
  )

  return (
    <div style={{ height: 220, padding: '0 12px 10px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 10, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={axisTick}
            tickFormatter={(t: number) => formatEngNotation(t, 's')}
          />
          <YAxis tick={axisTick} tickFormatter={(v: number) => formatEngNotation(v, 'V')} width={70} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: 'var(--color-text-muted)' }}
            labelFormatter={(t) => `t = ${formatEngNotation(Number(t), 's')}`}
            formatter={(value, name) => [formatEngNotation(Number(value), 'V'), String(name).replace('n', 'N')]}
          />
          {visible.map((id) => (
            <Line
              key={id}
              dataKey={`n${id}`}
              stroke={colorOf(id)}
              strokeWidth={1.6}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function BodeCharts({
  result,
  visible,
  colorOf,
}: {
  result: ACRunResult
  visible: number[]
  colorOf: (id: number) => string
}) {
  const data = useMemo(
    () =>
      result.frequency.map((f, i) => {
        const row: Record<string, number> = { f }
        for (const node of Object.keys(result.magnitudeDb)) {
          if (Number(node) === 0) continue
          row[`m${node}`] = result.magnitudeDb[Number(node)][i]
          row[`p${node}`] = result.phaseDeg[Number(node)][i]
        }
        return row
      }),
    [result],
  )

  const decadeTicks = useMemo(() => {
    const ticks: number[] = []
    if (result.frequency.length === 0) return ticks
    const min = result.frequency[0]
    const max = result.frequency[result.frequency.length - 1]
    for (let e = Math.ceil(Math.log10(min)); Math.pow(10, e) <= max * 1.0001; e++) {
      ticks.push(Math.pow(10, e))
    }
    return ticks
  }, [result.frequency])

  const freqAxis = (
    <XAxis
      dataKey="f"
      type="number"
      scale="log"
      domain={['dataMin', 'dataMax']}
      ticks={decadeTicks}
      tick={axisTick}
      tickFormatter={(f: number) => formatEngNotation(f, 'Hz')}
    />
  )

  const chartLabel: React.CSSProperties = {
    fontFamily: uiFont,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--color-text-muted)',
    padding: '0 0 2px 12px',
  }

  return (
    <div style={{ display: 'flex', padding: '0 12px 10px', gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={chartLabel}>Magnitude (dB)</div>
        <div style={{ height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 10, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              {freqAxis}
              <YAxis tick={axisTick} width={48} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: 'var(--color-text-muted)' }}
                labelFormatter={(f) => formatEngNotation(Number(f), 'Hz')}
                formatter={(value, name) => [`${Number(value).toFixed(2)} dB`, String(name).replace('m', 'N')]}
              />
              {visible.map((id) => (
                <Line
                  key={id}
                  dataKey={`m${id}`}
                  stroke={colorOf(id)}
                  strokeWidth={1.6}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={chartLabel}>Phase (°)</div>
        <div style={{ height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 10, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              {freqAxis}
              <YAxis tick={axisTick} width={48} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: 'var(--color-text-muted)' }}
                labelFormatter={(f) => formatEngNotation(Number(f), 'Hz')}
                formatter={(value, name) => [`${Number(value).toFixed(1)}°`, String(name).replace('p', 'N')]}
              />
              {visible.map((id) => (
                <Line
                  key={id}
                  dataKey={`p${id}`}
                  stroke={colorOf(id)}
                  strokeWidth={1.6}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
