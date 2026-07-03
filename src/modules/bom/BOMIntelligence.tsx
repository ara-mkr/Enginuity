import { useState, useCallback, useEffect } from 'react'
// @ts-ignore
import { moduleStateStore } from '../../store/moduleState'
import { RefreshCw, Layers } from 'lucide-react'
import { useAIProvider } from '../../hooks/useAIProvider'
import { CostSummary } from './CostSummary'
import { RiskAnalysis } from './RiskAnalysis'
import { BOMTable } from './BOMTable'
import { AlternativePanel } from './AlternativePanel'
// @ts-ignore
import { UniversalDropZone } from '../../components/UniversalDropZone/index.jsx'
import { parseKiCadPCBText, parseKiCadXMLText } from './kicadParser'
import type { BOMItem, AvailabilityResult, RiskAnalysisResult, AlternativePart } from './types'
import { logEvent } from '../../engine/eventLog'

const LOCAL_STORAGE_KEY = 'enginguity_boms'
const LAST_KICAD_KEY = 'enginguity_last_kicad'

// Dynamic script loader for SheetJS
function loadSheetJS(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).XLSX) {
      resolve((window as any).XLSX)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js'
    script.onload = () => resolve((window as any).XLSX)
    script.onerror = reject
    document.body.appendChild(script)
  })
}

export function BOMIntelligence() {
  const [items, setItems] = useState<BOMItem[]>([])
  const [inputMethod, setInputMethod] = useState<'upload' | 'paste'>('upload')
  const [pasteData, setPasteData] = useState('')
  
  // Status states
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [analyzingRisk, setAnalyzingRisk] = useState(false)
  const [riskReport, setRiskReport] = useState<RiskAnalysisResult | null>(null)
  
  // Alternatives state
  const [selectedRow, setSelectedRow] = useState<BOMItem | null>(null)
  const [alternatives, setAlternatives] = useState<AlternativePart[]>([])
  const [loadingAlternatives, setLoadingAlternatives] = useState(false)

  const { makeRequest } = useAIProvider()

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (saved) {
        setItems(JSON.parse(saved))
      }
    } catch (e) {
      console.error('Failed to load saved BOM', e)
    }
  }, [])

  // Publish BOM state to Copilot observation engine
  useEffect(() => {
    if (items.length === 0) return
    const outOfStock = items.filter(i => i.stockStatus === 'out_of_stock').length
    const totalCost = items.reduce((sum, i) => sum + (i.extendedPrice || 0), 0)
    const highRiskItems = riskReport?.riskItems.map(r => r.partNumber) || []
    moduleStateStore.publish('bom', { totalItems: items.length, outOfStock, totalCost, highRiskItems })
  }, [items, riskReport])

  // Save to localStorage when items change
  const updateItems = (newItems: BOMItem[]) => {
    setItems(newItems)
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newItems))
    } catch (e) {
      console.error('Failed to save BOM', e)
    }
  }

  // Parse Excel file using SheetJS
  const parseExcel = async (file: File) => {
    try {
      const XLSX = await loadSheetJS()
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(new Uint8Array(data), { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
      
      if (!rawRows.length) return

      // Attempt to find header row and map columns
      let headerIdx = 0
      let headers: string[] = []
      
      // Look for a row containing typical headers
      for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
        const row = rawRows[r]
        if (Array.isArray(row) && row.some(cell => /qty|quantity|part|desc|mfr|manuf|val|pkg|footprint|ref/i.test(String(cell)))) {
          headerIdx = r
          headers = row.map((h: any) => String(h || '').trim().toLowerCase())
          break
        }
      }

      if (!headers.length && rawRows.length) {
        headers = rawRows[0].map((h: any) => String(h || '').trim().toLowerCase())
      }

      const startIndex = headerIdx + 1
      const bomItems: BOMItem[] = []

      // Map columns
      const getColIndex = (names: string[]) => {
        return headers.findIndex(h => names.some(n => h.includes(n)))
      }

      const colIdx = {
        qty: getColIndex(['qty', 'quantity', 'count']),
        part: getColIndex(['part', 'mpn', 'partnumber', 'part number', 'model']),
        desc: getColIndex(['desc', 'description', 'comment', 'name']),
        mfr: getColIndex(['mfr', 'manufacturer', 'vendor']),
        val: getColIndex(['val', 'value', 'spec']),
        pkg: getColIndex(['pkg', 'package', 'footprint', 'size']),
        ref: getColIndex(['ref', 'designator', 'reference']),
      }

      for (let r = startIndex; r < rawRows.length; r++) {
        const row = rawRows[r]
        if (!Array.isArray(row) || row.every(c => c === null || c === '')) continue

        const qtyVal = colIdx.qty !== -1 ? parseInt(row[colIdx.qty]) : 1
        const part = colIdx.part !== -1 ? String(row[colIdx.part] || '') : ''
        const desc = colIdx.desc !== -1 ? String(row[colIdx.desc] || '') : ''
        const mfr = colIdx.mfr !== -1 ? String(row[colIdx.mfr] || '') : ''
        const val = colIdx.val !== -1 ? String(row[colIdx.val] || '') : ''
        const pkg = colIdx.pkg !== -1 ? String(row[colIdx.pkg] || '') : ''
        const ref = colIdx.ref !== -1 ? String(row[colIdx.ref] || '') : ''

        bomItems.push({
          id: `${Date.now()}-${r}-${Math.random().toString(36).substring(2, 7)}`,
          quantity: isNaN(qtyVal) ? 1 : qtyVal,
          part_number: part || null,
          description: desc || `${val} component`,
          manufacturer: mfr || null,
          value: val || null,
          package: pkg || null,
          reference_designators: ref || null,
          unitPrice: null,
          extendedPrice: null,
          stockStatus: 'unknown',
          leadTimeWeeks: null,
          altAvailable: null,
        })
      }

      updateItems(bomItems)
      logEvent('BOM_UPDATED', {
        action: 'import_excel',
        filename: file.name,
        count: bomItems.length,
        module: 'bom'
      })
    } catch (err) {
      alert(`Failed to parse Excel: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  // Handle file drop/load from UniversalDropZone
  const handleFileLoaded = useCallback((result: any) => {
    // Check if result has rows (Parsed CSV)
    if (result.viewMode === 'csv' && result.metadata?.rows) {
      const rows = result.metadata.rows
      const headers = result.metadata.headers.map((h: string) => h.toLowerCase())

      const getColIndex = (names: string[]) => {
        return headers.findIndex((h: string) => names.some(n => h.includes(n)))
      }

      const colIdx = {
        qty: getColIndex(['qty', 'quantity', 'count']),
        part: getColIndex(['part', 'mpn', 'partnumber', 'part number']),
        desc: getColIndex(['desc', 'description', 'comment']),
        mfr: getColIndex(['mfr', 'manufacturer', 'vendor']),
        val: getColIndex(['val', 'value', 'spec']),
        pkg: getColIndex(['pkg', 'package', 'footprint', 'size']),
        ref: getColIndex(['ref', 'designator', 'reference']),
      }

      const bomItems: BOMItem[] = rows.map((row: any, i: number) => {
        const qtyVal = colIdx.qty !== -1 ? parseInt(row[result.metadata.headers[colIdx.qty]]) : 1
        const part = colIdx.part !== -1 ? String(row[result.metadata.headers[colIdx.part]] || '') : ''
        const desc = colIdx.desc !== -1 ? String(row[result.metadata.headers[colIdx.desc]] || '') : ''
        const mfr = colIdx.mfr !== -1 ? String(row[result.metadata.headers[colIdx.mfr]] || '') : ''
        const val = colIdx.val !== -1 ? String(row[result.metadata.headers[colIdx.val]] || '') : ''
        const pkg = colIdx.pkg !== -1 ? String(row[result.metadata.headers[colIdx.pkg]] || '') : ''
        const ref = colIdx.ref !== -1 ? String(row[result.metadata.headers[colIdx.ref]] || '') : ''

        return {
          id: `${Date.now()}-${i}`,
          quantity: isNaN(qtyVal) ? 1 : qtyVal,
          part_number: part || null,
          description: desc || `${val} component`,
          manufacturer: mfr || null,
          value: val || null,
          package: pkg || null,
          reference_designators: ref || null,
          unitPrice: null,
          extendedPrice: null,
          stockStatus: 'unknown',
          leadTimeWeeks: null,
          altAvailable: null,
        }
      })

      updateItems(bomItems)
      logEvent('BOM_UPDATED', {
        action: 'import_csv',
        filename: result.name,
        count: bomItems.length,
        module: 'bom'
      })
    } else if (result.name?.endsWith('.xlsx') || result.name?.endsWith('.xls') || result.name?.endsWith('.ods')) {
      if (result.file) {
        parseExcel(result.file)
      } else {
        alert('Parsing Excel file... (Raw file reference missing)')
      }
    }
  }, [])

  // Parse pasted raw text
  const handlePasteSubmit = async () => {
    if (!pasteData.trim()) return
    setCheckingAvailability(true) // Reuse loader for paste parsing
    
    try {
      const system = 'Parse this BOM data into a JSON array. Each item should have: quantity (number), part_number (string or null), description (string), manufacturer (string or null), value (string or null), package (string or null), reference_designators (string or null). Return ONLY the JSON array.'
      const prompt = `Parse this BOM data:\n${pasteData}`
      const response = await makeRequest([{ role: 'user', content: prompt }], system, { maxTokens: 4096 })

      const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(cleaned)

      if (Array.isArray(parsed)) {
        const bomItems: BOMItem[] = parsed.map((item: any, i: number) => ({
          id: `${Date.now()}-${i}`,
          quantity: item.quantity || 1,
          part_number: item.part_number || null,
          description: item.description || 'Component',
          manufacturer: item.manufacturer || null,
          value: item.value || null,
          package: item.package || null,
          reference_designators: item.reference_designators || null,
          unitPrice: null,
          extendedPrice: null,
          stockStatus: 'unknown',
          leadTimeWeeks: null,
          altAvailable: null,
        }))
        updateItems(bomItems)
        setPasteData('')
        logEvent('BOM_UPDATED', {
          action: 'import_paste',
          count: bomItems.length,
          module: 'bom'
        })
      }
    } catch (err) {
      alert(`Failed to parse pasted BOM: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setCheckingAvailability(false)
    }
  }

  // Import from CAD Viewer (KiCad file)
  const importFromCADViewer = () => {
    try {
      const savedKicad = localStorage.getItem(LAST_KICAD_KEY)
      if (!savedKicad) {
        alert('No KiCad PCB file has been loaded in the CAD Viewer yet.')
        return
      }

      const { name, text } = JSON.parse(savedKicad)
      let parsed: any[] = []
      
      if (name.endsWith('.kicad_pcb')) {
        parsed = parseKiCadPCBText(text)
      } else if (name.endsWith('.xml')) {
        parsed = parseKiCadXMLText(text)
      }

      if (parsed.length > 0) {
        const bomItems: BOMItem[] = parsed.map((item) => ({
          ...item,
          unitPrice: null,
          extendedPrice: null,
          stockStatus: 'unknown',
          leadTimeWeeks: null,
          altAvailable: null,
        }))
        updateItems(bomItems)
        alert(`Successfully imported ${bomItems.length} line items from "${name}"!`)

        logEvent('BOM_UPDATED', {
          action: 'import_kicad',
          filename: name,
          count: bomItems.length,
          module: 'bom'
        })
      }
    } catch (e) {
      alert('Failed to import KiCad PCB file from CAD Viewer history.')
    }
  }

  // Check availability
  const checkAvailability = async () => {
    if (!items.length) return
    setCheckingAvailability(true)

    try {
      const updated = [...items]
      
      // Look up unique parts to avoid redundant requests
      const uniqueParts = Array.from(new Set(items.map(item => item.part_number || item.value).filter(Boolean)))

      // Run parallel lookups
      await Promise.all(uniqueParts.map(async (part) => {
        const matchedItems = updated.filter(item => (item.part_number || item.value) === part)
        const quantity = matchedItems.reduce((sum, item) => sum + item.quantity, 0)
        const first = matchedItems[0]

        try {
          const system = 'You are a stock availability and price lookup engine. Return ONLY valid JSON.'
          const prompt = `For the electronic component with part number ${part} (${first.description}, manufacturer: ${first.manufacturer}):
1. What is the approximate current market price for qty ${quantity}?
2. Is this part generally in stock as of early 2025?
3. What is the typical lead time?
4. Are there common drop-in alternatives?
5. Any known supply chain concerns with this part?

Return JSON structure:
{ 
  "unitPrice": number|null, 
  "priceQtyBreaks": [{"qty": number, "price": number}],
  "stockStatus": "in_stock"|"limited"|"out_of_stock"|"unknown",
  "leadTimeWeeks": number|null,
  "alternatives": [{"partNumber": "string", "manufacturer": "string", "notes": "string"}],
  "warnings": ["string"]
}`
          const response = await makeRequest([{ role: 'user', content: prompt }], system, { maxTokens: 1024 })
          const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
          const result: AvailabilityResult = JSON.parse(cleaned)

          // Update all items matching this part
          updated.forEach((item, idx) => {
            if ((item.part_number || item.value) === part) {
              updated[idx] = {
                ...item,
                unitPrice: result.unitPrice,
                extendedPrice: (item.quantity || 0) * (result.unitPrice ?? 0),
                stockStatus: result.stockStatus,
                leadTimeWeeks: result.leadTimeWeeks,
                altAvailable: result.alternatives.length > 0,
                warnings: result.warnings,
              }
            }
          })

          // Log availability alerts
          if (result.stockStatus === 'out_of_stock') {
            logEvent('BOM_ALERT', {
              type: 'out_of_stock',
              partNumber: part,
              message: `Part ${part} is out of stock.`,
              module: 'bom'
            })
          }
          if (result.warnings && result.warnings.length > 0) {
            result.warnings.forEach(warning => {
              logEvent('BOM_ALERT', {
                type: 'warning',
                partNumber: part,
                message: warning,
                module: 'bom'
              })
            })
          }
        } catch (e) {
          console.error(`Availability check failed for ${part}`, e)
        }
      }))

      updateItems(updated)
    } catch (err) {
      console.error('Failed checking availability', err)
    } finally {
      setCheckingAvailability(false)
    }
  }

  // Analyze supply chain risk
  const analyzeRisk = async () => {
    if (!items.length) return
    setAnalyzingRisk(true)
    setRiskReport(null)

    try {
      const system = 'You are a supply chain risk analyst. Evaluate vulnerabilities and suggest dual-sourcing options. Return ONLY valid JSON.'
      const prompt = `Analyze this BOM for supply chain risk. BOM data:
${JSON.stringify(items.map(item => ({
  quantity: item.quantity,
  partNumber: item.part_number,
  description: item.description,
  manufacturer: item.manufacturer,
  value: item.value,
  package: item.package,
  stockStatus: item.stockStatus,
  leadTimeWeeks: item.leadTimeWeeks
})), null, 2)}

Identify:
1. Single-source components (only one known manufacturer)
2. End-of-life (EOL) or lifecycle concern parts
3. Components historically affected by supply shortages
4. Suggestions for dual-sourcing high-risk components
5. Overall supply chain risk rating: LOW / MEDIUM / HIGH

Return JSON structure:
{
  "overallRating": "LOW"|"MEDIUM"|"HIGH",
  "riskItems": [{ "partNumber": "string", "riskType": "single_source"|"eol"|"shortage"|"other", "description": "string", "suggestion": "string" }],
  "reportSummary": "string"
}`

      const response = await makeRequest([{ role: 'user', content: prompt }], system, { maxTokens: 2048 })
      const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const report = JSON.parse(cleaned)
      setRiskReport(report)

      // Log risk alerts
      if (report.riskItems && report.riskItems.length > 0) {
        report.riskItems.forEach((ri: any) => {
          logEvent('BOM_ALERT', {
            type: 'risk_analysis',
            partNumber: ri.partNumber,
            message: `${ri.riskType}: ${ri.description}. Suggestion: ${ri.suggestion}`,
            module: 'bom'
          })
        })
      }
    } catch (err) {
      alert(`Risk analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setAnalyzingRisk(false)
    }
  }

  // Find alternatives for a specific row
  const findAlternatives = async (item: BOMItem) => {
    setSelectedRow(item)
    setLoadingAlternatives(true)
    setAlternatives([])

    try {
      const system = 'You are an electronics replacement database. Suggest drop-in or near drop-in alternatives. Return ONLY valid JSON.'
      const prompt = `Suggest drop-in or near drop-in alternatives for:
Part: ${item.part_number || item.value}
Description: ${item.description}
Key specs: Value: ${item.value || '—'}, Package: ${item.package || '—'}

Return JSON array of alternatives:
[{ "partNumber": "string", "manufacturer": "string", "differences": "string", "dropInCompatible": boolean, "notes": "string" }]`

      const response = await makeRequest([{ role: 'user', content: prompt }], system, { maxTokens: 1024 })
      const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      setAlternatives(JSON.parse(cleaned))
    } catch (err) {
      console.error('Failed to find alternatives', err)
    } finally {
      setLoadingAlternatives(false)
    }
  }

  // Swap in selected alternative
  const handleSwapPart = (alt: AlternativePart) => {
    if (!selectedRow) return
    const updated = items.map((item) => {
      if (item.id === selectedRow.id) {
        return {
          ...item,
          part_number: alt.partNumber,
          manufacturer: alt.manufacturer,
          description: `${selectedRow.value || ''} Alternative Component`,
        }
      }
      return item
    })
    updateItems(updated)

    logEvent('BOM_UPDATED', {
      action: 'swap',
      oldPartNumber: selectedRow.part_number,
      newPartNumber: alt.partNumber,
      module: 'bom'
    })

    setSelectedRow(null)
  }

  // Compression helper for URL share parameter
  const shareBOM = () => {
    try {
      const dataStr = JSON.stringify(items.map(item => [
        item.quantity,
        item.part_number || '',
        item.description || '',
        item.manufacturer || '',
        item.value || '',
        item.package || '',
        item.reference_designators || '',
      ]))
      const encoded = btoa(encodeURIComponent(dataStr))
      const shareUrl = `${window.location.origin}/bom?share=${encoded}`
      navigator.clipboard.writeText(shareUrl)
      alert('Share link copied to clipboard!')
    } catch (e) {
      alert('Failed to generate sharing URL.')
    }
  }

  // Load from URL share parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shareParam = params.get('share')
    if (shareParam) {
      try {
        const decoded = decodeURIComponent(atob(shareParam))
        const rawArray = JSON.parse(decoded)
        if (Array.isArray(rawArray)) {
          const bomItems: BOMItem[] = rawArray.map((row, i) => ({
            id: `${Date.now()}-${i}`,
            quantity: Number(row[0]) || 1,
            part_number: row[1] || null,
            description: row[2] || 'Component',
            manufacturer: row[3] || null,
            value: row[4] || null,
            package: row[5] || null,
            reference_designators: row[6] || null,
            unitPrice: null,
            extendedPrice: null,
            stockStatus: 'unknown',
            leadTimeWeeks: null,
            altAvailable: null,
          }))
          updateItems(bomItems)
          // Clean URL parameters
          window.history.replaceState({}, document.title, window.location.pathname)
        }
      } catch (e) {
        console.error('Failed to parse share parameter', e)
      }
    }
  }, [])

  // Check if CAD Viewer history contains a KiCad file
  const hasKicadInCADViewer = localStorage.getItem(LAST_KICAD_KEY) !== null

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
            BOM Intelligence
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Upload, check availability, optimize alternatives, and analyze supply chain risks.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {items.length > 0 && (
            <button className="btn" onClick={shareBOM} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              Share BOM
            </button>
          )}
          {hasKicadInCADViewer && (
            <button
              className="btn"
              onClick={importFromCADViewer}
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'center',
                borderColor: 'rgba(0,200,255,0.3)',
                color: 'var(--accent)',
              }}
            >
              <Layers size={13} /> Import from CAD Viewer
            </button>
          )}
          {items.length > 0 && (
            <button
              className="btn"
              onClick={() => {
                if (confirm('Clear current BOM table?')) {
                  updateItems([])
                  setRiskReport(null)
                }
              }}
              style={{ display: 'flex', gap: 6, alignItems: 'center' }}
            >
              <RefreshCw size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Input panel (if empty BOM) */}
      {items.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: 10 }}>
            <button
              onClick={() => setInputMethod('upload')}
              style={{
                padding: '10px 16px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: inputMethod === 'upload' ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: `2px solid ${inputMethod === 'upload' ? 'var(--accent)' : 'transparent'}`,
                marginBottom: -1,
              }}
            >
              File Upload
            </button>
            <button
              onClick={() => setInputMethod('paste')}
              style={{
                padding: '10px 16px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: inputMethod === 'paste' ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: `2px solid ${inputMethod === 'paste' ? 'var(--accent)' : 'transparent'}`,
                marginBottom: -1,
              }}
            >
              Paste Raw Data
            </button>
          </div>

          {/* Form wrapper */}
          <div style={{ minHeight: 240 }}>
            {inputMethod === 'upload' ? (
              <UniversalDropZone
                onFileLoaded={handleFileLoaded}
                acceptedCategories={['documents', 'imaging']}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <textarea
                  value={pasteData}
                  onChange={(e) => setPasteData(e.target.value)}
                  rows={8}
                  placeholder="Paste tab-separated columns or raw text, e.g.&#10;10x 100nF 0402 capacitors (C1-C10)&#10;5x ESP32-WROOM-32E (U1-U5)"
                  className="w-full resize-none rounded-lg px-3 py-2.5 text-xs outline-none border transition-colors font-mono"
                  style={{ background: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border)' }}
                />
                <button
                  className="btn"
                  onClick={handlePasteSubmit}
                  disabled={!pasteData.trim() || checkingAvailability}
                  style={{
                    alignSelf: 'flex-end',
                    background: 'var(--accent)',
                    color: 'var(--bg)',
                    borderColor: 'transparent',
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 600,
                  }}
                >
                  Parse with AI
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BOM Workspace */}
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Summary dashboard */}
          <CostSummary items={items} />

          {/* Action Toolbar */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="btn"
              onClick={checkAvailability}
              disabled={checkingAvailability}
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'center',
                background: 'var(--accent)',
                color: 'var(--bg)',
                borderColor: 'transparent',
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
              }}
            >
              {checkingAvailability ? 'Checking...' : 'Check Availability'}
            </button>
            <button
              className="btn"
              onClick={analyzeRisk}
              disabled={analyzingRisk}
              style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
            >
              {analyzingRisk ? 'Analyzing...' : 'Run Risk Analysis'}
            </button>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ color: '#b8d4f0' }}>△</span> Prices and availability are AI estimates based on training data. Verify before ordering.
            </span>
          </div>

          {/* Risk Dashboard */}
          {(riskReport || analyzingRisk) && (
            <RiskAnalysis
              report={riskReport}
              loading={analyzingRisk}
              onAnalyze={analyzeRisk}
              onSelectPart={(part) => {
                // Focus search or filter to that part
                const input = document.querySelector('input[placeholder="Search BOM items…"]') as HTMLInputElement
                if (input) {
                  input.value = part
                  input.dispatchEvent(new Event('input', { bubbles: true }))
                }
              }}
            />
          )}

          {/* Main BOM table */}
          <BOMTable
            items={items}
            onUpdateItems={updateItems}
            onFindAlternatives={findAlternatives}
          />
        </div>
      )}

      {/* Alternatives side drawer */}
      {selectedRow && (
        <AlternativePanel
          row={selectedRow}
          alternatives={alternatives}
          loading={loadingAlternatives}
          onClose={() => setSelectedRow(null)}
          onSwap={handleSwapPart}
        />
      )}
    </div>
  )
}

export default BOMIntelligence
