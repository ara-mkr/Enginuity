import { describe, expect, it } from 'vitest'
import { parseCircuitNetlist, parseValue } from '../netlistParser'
import { runNetlistAnalysis } from '../runSimulation'

describe('parseValue', () => {
  it('parses plain numbers and SPICE scale factors', () => {
    expect(parseValue('10')).toBe(10)
    expect(parseValue('1k')).toBe(1000)
    expect(parseValue('100n')).toBeCloseTo(1e-7, 12)
    expect(parseValue('2.2meg')).toBeCloseTo(2.2e6, 3)
    expect(parseValue('1e-6')).toBeCloseTo(1e-6, 12)
  })

  it('ignores trailing unit letters after the scale factor', () => {
    expect(parseValue('100nF')).toBeCloseTo(1e-7, 12)
    expect(parseValue('4.7uF')).toBeCloseTo(4.7e-6, 12)
    expect(parseValue('10kΩ')).toBe(10000)
  })
})

describe('parseCircuitNetlist', () => {
  it('does not mistake source-spec tokens (DC/AC values) for nodes', () => {
    const parsed = parseCircuitNetlist(`* RC Low-Pass Filter
V1 in 0 DC 5 AC 1
R1 in out 1k
C1 out 0 100n
.TRAN 1u 5m
.AC DEC 100 10 100k
.END`)
    const names = Object.values(parsed.nodeNames)
    expect(names.sort()).toEqual(['0', 'in', 'out'])
    const v1 = parsed.netlist.components.find((c) => c.id === 'V1')
    expect(v1?.value).toBe(5)
    expect(parsed.acSourceId).toBe('V1')
    // Last directive wins: this netlist ends on .AC
    expect(parsed.analysis.type).toBe('ac')
  })

  it('extracts .TRAN parameters', () => {
    const parsed = parseCircuitNetlist('V1 1 0 5\nR1 1 2 1k\nC1 2 0 1u\n.TRAN 10u 1m\n.END')
    expect(parsed.analysis.type).toBe('transient')
    expect(Number(parsed.analysis.params.tStep)).toBeCloseTo(1e-5, 12)
    expect(Number(parsed.analysis.params.tStop)).toBeCloseTo(1e-3, 12)
  })
})

describe('runNetlistAnalysis (typed-engine pipeline)', () => {
  it('solves the 10V / 1k / 2k divider operating point exactly', () => {
    const parsed = parseCircuitNetlist(`V1 1 0 10
R1 1 2 1k
R2 2 0 2k
.OP
.END`)
    const result = runNetlistAnalysis(parsed)
    expect(result.type).toBe('operating_point')
    const v = result.data.nodeVoltages as Record<string, number>
    expect(v['2']).toBeCloseTo(6.6666666667, 9)
    expect(v['1']).toBeCloseTo(10, 9)
  })

  it('RC low-pass reads −3.01 dB and −45° at the cutoff frequency', () => {
    const fc = 1 / (2 * Math.PI * 1000 * 1e-6) // ≈ 159.155 Hz
    // Start the sweep exactly at fc so the first point probes the cutoff.
    const parsed = parseCircuitNetlist(`V1 in 0 DC 0 AC 1
R1 in out 1k
C1 out 0 1u
.AC DEC 10 ${fc} ${fc * 10}
.END`)
    const result = runNetlistAnalysis(parsed)
    expect(result.type).toBe('ac')
    const db = result.data.magnitude_db as number[]
    const deg = result.data.phase_deg as number[]
    expect(result.data.probeNode).toBe('out')
    expect(db[0]).toBeCloseTo(-3.0103, 3)
    expect(deg[0]).toBeCloseTo(-45, 3)
  })

  it('RC step transient starts at exactly 0 V and follows 5(1−e^(−t/τ))', () => {
    const parsed = parseCircuitNetlist(`V1 in 0 5
R1 in out 1k
C1 out 0 1u
.TRAN 10u 1m
.END`)
    const result = runNetlistAnalysis(parsed)
    expect(result.type).toBe('transient')
    const time = result.data.time as number[]
    const vout = (result.data.voltages as Record<string, number[]>).out
    const tau = 1e-3

    expect(time[0]).toBe(0)
    expect(vout[0]).toBe(0) // exact initial condition, no half-step shift

    for (const i of [10, 50, time.length - 1]) {
      const expected = 5 * (1 - Math.exp(-time[i] / tau))
      expect(Math.abs(vout[i] - expected)).toBeLessThan(0.005) // < 5 mV
    }
  })

  it('reports a clear error instead of numbers when the circuit has no ground', () => {
    const parsed = parseCircuitNetlist('V1 a b 5\nR1 b c 1k\n.OP\n.END')
    expect(() => runNetlistAnalysis(parsed)).toThrow(/ground/i)
  })
})
