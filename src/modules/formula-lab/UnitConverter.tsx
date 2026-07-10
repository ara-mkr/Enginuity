import { useState, useEffect } from 'react'
import { ArrowLeftRight, Check } from 'lucide-react'

interface UnitCategory {
  base?: string
  special?: boolean
  units: Record<string, number>
  convert?: (val: number, from: string, to: string) => number
}

// eslint-disable-next-line react-refresh/only-export-components -- shared conversion-table constant, not worth a separate file
export const UNIT_CATEGORIES: Record<string, UnitCategory> = {
  length: { 
    base: 'm',
    units: { pm:1e-12, nm:1e-9, um:1e-6, mm:0.001, cm:0.01, 
             m:1, km:1000, inch:0.0254, foot:0.3048, yard:0.9144, mile:1609.34 }
  },
  mass: {
    base: 'kg',
    units: { ug:1e-9, mg:1e-6, g:0.001, kg:1, tonne:1000, 
             oz:0.028349, lb:0.453592, ton_us:907.185 }
  },
  force: {
    base: 'N',
    units: { uN:1e-6, mN:0.001, N:1, kN:1000, MN:1e6,
             lbf:4.44822, kgf:9.80665, ozf:0.278014 }
  },
  torque: {
    base: 'Nm',
    units: { uNm:1e-6, mNm:0.001, Nm:1, kNm:1000,
             lbfin:0.112985, lbfft:1.35582, ozfin:0.00706155, kgfm:9.80665 }
  },
  pressure: {
    base: 'Pa',
    units: { Pa:1, kPa:1000, MPa:1e6, GPa:1e9, bar:1e5, 
             mbar:100, psi:6894.76, atm:101325, torr:133.322, mmHg:133.322 }
  },
  energy: {
    base: 'J',
    units: { uJ:1e-6, mJ:0.001, J:1, kJ:1000, MJ:1e6, 
             Wh:3600, kWh:3.6e6, cal:4.184, kcal:4184, BTU:1055.06, eV:1.602e-19 }
  },
  power: {
    base: 'W',
    units: { uW:1e-6, mW:0.001, W:1, kW:1000, MW:1e6, GW:1e9,
             hp:745.7, BTU_hr:0.293071 }
  },
  temperature: {
    special: true,
    units: { C: 1, F: 1, K: 1 },
    convert: (val: number, from: string, to: string) => {
      let c;
      if (from === 'C') c = val;
      else if (from === 'F') c = (val - 32) * 5/9;
      else if (from === 'K') c = val - 273.15;
      else return val;

      if (to === 'C') return c;
      if (to === 'F') return (c * 9/5) + 32;
      if (to === 'K') return c + 273.15;
      return c;
    }
  },
  frequency: {
    base: 'Hz',
    units: { uHz:1e-6, mHz:0.001, Hz:1, kHz:1000, MHz:1e6, GHz:1e9, THz:1e12, rpm:1/60 }
  },
  voltage: {
    base: 'V',
    units: { uV:1e-6, mV:0.001, V:1, kV:1000, MV:1e6 }
  },
  current: {
    base: 'A',
    units: { nA:1e-9, uA:1e-6, mA:0.001, A:1, kA:1000 }
  },
  resistance: {
    base: 'Ohm',
    units: { mOhm:0.001, Ohm:1, kOhm:1000, MOhm:1e6, GOhm:1e9 }
  },
  capacitance: {
    base: 'F',
    units: { pF:1e-12, nF:1e-9, uF:1e-6, mF:0.001, F:1 }
  },
  inductance: {
    base: 'H',
    units: { nH:1e-9, uH:1e-6, mH:0.001, H:1 }
  },
  data: {
    base: 'bit',
    units: { bit:1, byte:8, KB:8000, KiB:8192, MB:8e6, MiB:8388608, 
             GB:8e9, GiB:8589934592, TB:8e12, Mbps:1e6, Gbps:1e9 }
  },
  angle: {
    base: 'rad',
    units: { rad:1, deg: Math.PI/180, grad: Math.PI/200, rev: 2*Math.PI }
  },
  speed: {
    base: 'm/s',
    units: { 'mm/s':0.001, 'cm/s':0.01, 'm/s':1, 'km/h':1/3.6, 
             mph:0.44704, knot:0.514444, 'ft/s':0.3048 }
  }
}

interface UnitConverterProps {
  onUseInFormula: (text: string) => void
  insertedValue?: number
}

export function UnitConverter({ onUseInFormula, insertedValue }: UnitConverterProps) {
  const [category, setCategory] = useState<string>('length')
  const [valInput, setValInput] = useState<string>('1')
  const [fromUnit, setFromUnit] = useState<string>('m')
  const [toUnit, setToUnit] = useState<string>('mm')
  const [result, setResult] = useState<number | null>(1000)
  const [copied, setCopied] = useState<boolean>(false)

  // Sync state if category changes
  useEffect(() => {
    const catData = UNIT_CATEGORIES[category]
    const unitKeys = Object.keys(catData.units)
    const defaultFrom = unitKeys[0] || ''
    const defaultTo = unitKeys[1] || unitKeys[0] || ''
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting from/to units when the unit category changes
    setFromUnit(defaultFrom)
    setToUnit(defaultTo)
  }, [category])

  // Sync if externally inserted value changes
  useEffect(() => {
    if (insertedValue !== undefined && !isNaN(insertedValue)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local input from an external inserted value prop
      setValInput(String(insertedValue))
    }
  }, [insertedValue])

  // Live conversion
  useEffect(() => {
    const val = parseFloat(valInput)
    if (isNaN(val)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing derived conversion result when input is invalid
      setResult(null)
      return
    }

    const catData = UNIT_CATEGORIES[category]
    if (catData.special) {
      setResult(catData.convert(val, fromUnit, toUnit))
    } else {
      const fromFactor = catData.units[fromUnit]
      const toFactor = catData.units[toUnit]
      if (fromFactor && toFactor) {
        // Convert to base, then to target
        const valInBase = val * fromFactor
        const converted = valInBase / toFactor
        setResult(converted)
      } else {
        setResult(null)
      }
    }
  }, [valInput, category, fromUnit, toUnit])

  const handleSwap = () => {
    const temp = fromUnit
    setFromUnit(toUnit)
    setToUnit(temp)
  }

  const formatResult = (val: number | null): string => {
    if (val === null) return '—'
    if (val === 0) return '0'
    const abs = Math.abs(val)
    if (abs < 1e-4 || abs > 1e6) {
      return val.toExponential(6)
    }
    return parseFloat(val.toFixed(6)).toString()
  }

  const handleUseInFormula = () => {
    if (result === null) return
    const formattedVal = formatResult(result)
    // Send string like "4.5 N" or "4.5 N (converted from 1 lbf)"
    onUseInFormula(`${formattedVal} ${toUnit}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Category Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)',   }}>
            Measurement Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 14,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          >
            {Object.keys(UNIT_CATEGORIES).map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Inputs row */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {/* Value input */}
          <div style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
              Value
            </label>
            <input
              type="number"
              value={valInput}
              onChange={(e) => setValInput(e.target.value)}
              placeholder="1.0"
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace",
                outline: 'none',
              }}
            />
          </div>

          {/* From Unit */}
          <div style={{ flex: '1 1 120px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
              From Unit
            </label>
            <select
              value={fromUnit}
              onChange={(e) => setFromUnit(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace",
                outline: 'none',
              }}
            >
              {Object.keys(UNIT_CATEGORIES[category].units).map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>

          {/* Swap Button */}
          <button
            onClick={handleSwap}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 40,
            }}
            title="Swap Units"
          >
            <ArrowLeftRight size={16} />
          </button>

          {/* To Unit */}
          <div style={{ flex: '1 1 120px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
              To Unit
            </label>
            <select
              value={toUnit}
              onChange={(e) => setToUnit(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace",
                outline: 'none',
              }}
            >
              {Object.keys(UNIT_CATEGORIES[category].units).map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Equals Display */}
        <div
          style={{
            marginTop: 10,
            padding: '16px 20px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: 64,
          }}
        >
          <div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
              Result
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)' }}>
                {formatResult(result)}
              </span>
              <span style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                {toUnit}
              </span>
            </div>
          </div>

          <button
            onClick={handleUseInFormula}
            disabled={result === null}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              background: copied ? 'var(--accent-glow)' : 'var(--accent)',
              color: copied ? 'var(--accent)' : 'var(--bg)',
              border: copied ? '1px solid var(--accent)' : '1px solid transparent',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "'JetBrains Mono', monospace",
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: result === null ? 0.5 : 1,
            }}
          >
            {copied ? <Check size={12} /> : null}
            {copied ? 'Copied' : 'Use in Formula'}
          </button>
        </div>
      </div>
    </div>
  )
}
