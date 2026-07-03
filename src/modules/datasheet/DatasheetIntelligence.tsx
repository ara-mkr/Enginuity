/**
 * Datasheet Intelligence — structured, queryable knowledge cards from component datasheets.
 *
 * TODO: browser extension — postMessage from extension to
 * window.opener with { type: 'ENGINGUITY_DATASHEET', url: datasheetUrl }
 * Listen for this message here and auto-fetch + analyze:
 *
 * useEffect(() => {
 *   function onMessage(e: MessageEvent) {
 *     if (e.data?.type === 'ENGINGUITY_DATASHEET') fetchAndAnalyze(e.data.url)
 *   }
 *   window.addEventListener('message', onMessage)
 *   return () => window.removeEventListener('message', onMessage)
 * }, [])
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Loader2, Library, RefreshCw } from 'lucide-react'
import { useAIProvider } from '../../hooks/useAIProvider'
import { ComponentCard } from './ComponentCard'
import { ComponentLibrary, saveToLibrary, loadLibrary } from './ComponentLibrary'
// @ts-ignore
import { UniversalDropZone } from '../../components/UniversalDropZone/index.jsx'
import type { ComponentData, ChatMessage, SavedComponent } from './types'

const PROCESSING_MESSAGES = [
  'Reading pin definitions…',
  'Extracting electrical characteristics…',
  'Finding application circuits…',
  'Building component profile…',
]

const SYSTEM_PROMPT = `You are an expert electronics engineer. Extract structured data from this datasheet. Return ONLY valid JSON, no markdown, no explanation.`

const EXTRACTION_PROMPT = (text: string) => `Extract all available information from this datasheet:
${text}

Return this exact JSON structure:
{
  "component": {
    "partNumber": "",
    "manufacturer": "",
    "description": "",
    "category": "",
    "package": [],
    "rohs": null
  },
  "pinout": [{ "pin": "", "name": "", "type": "", "description": "" }],
  "absoluteMaximums": [{ "parameter": "", "min": null, "max": null, "unit": "" }],
  "electricalCharacteristics": [{
    "parameter": "", "symbol": "",
    "min": null, "typ": null, "max": null,
    "unit": "", "conditions": ""
  }],
  "applicationCircuits": [{
    "title": "", "description": "",
    "components": [{ "name": "", "value": "" }],
    "notes": ""
  }],
  "features": [],
  "applications": [],
  "orderingInfo": [{ "partNumber": "", "package": "", "notes": "" }],
  "resources": { "productPage": null, "evalBoard": null }
}`

function ProcessingState({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 20, padding: 80, background: 'var(--surface)', borderRadius: 16,
      border: '1px solid var(--border)',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: 'var(--text)', marginBottom: 8 }}>
          Extracting datasheet intelligence…
        </p>
        <p style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--accent)',
          transition: 'opacity 0.3s',
        }}>
          {message}
        </p>
      </div>
    </div>
  )
}

export function DatasheetIntelligence() {
  const [phase, setPhase] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [processingMsg, setProcessingMsg] = useState(PROCESSING_MESSAGES[0])
  const [component, setComponent] = useState<ComponentData | null>(null)
  const [pdfPages, setPdfPages] = useState<string[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState('')
  const [showLibrary, setShowLibrary] = useState(false)
  const [currentFileName, setCurrentFileName] = useState('')
  const { makeRequest } = useAIProvider()
  const msgTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const prefillStr = localStorage.getItem('enginguity_datasheet_prefill')
    if (prefillStr) {
      try {
        const prefill = JSON.parse(prefillStr)
        const mockedData = {
          component: {
            partNumber: prefill.partNumber || 'Unknown Part',
            manufacturer: prefill.manufacturer || 'Unknown Manufacturer',
            description: prefill.description || '',
            category: prefill.category || '',
            package: prefill.package ? [prefill.package] : [],
            rohs: null
          },
          pinout: [],
          absoluteMaximums: [],
          electricalCharacteristics: prefill.keySpecs?.map((s: any) => ({
            parameter: s.param,
            symbol: '',
            min: null,
            typ: null,
            max: null,
            unit: s.value,
            conditions: ''
          })) || [],
          applicationCircuits: [],
          features: [],
          applications: [],
          orderingInfo: [],
          resources: { productPage: prefill.productPageUrl || null, evalBoard: null }
        }
        setComponent(mockedData)
        setCurrentFileName(`${prefill.partNumber || 'component'}-prefill.json`)
        setPhase('done')
        localStorage.removeItem('enginguity_datasheet_prefill')
      } catch (e) {
        console.error('Failed to parse prefill', e)
      }
    }
  }, [])

  function startMsgCycle() {
    let idx = 0
    msgTimerRef.current = setInterval(() => {
      idx = (idx + 1) % PROCESSING_MESSAGES.length
      setProcessingMsg(PROCESSING_MESSAGES[idx])
    }, 1800)
  }

  function stopMsgCycle() {
    if (msgTimerRef.current) clearInterval(msgTimerRef.current)
  }

  useEffect(() => () => stopMsgCycle(), [])

  const handleFileLoaded = useCallback(async (result: any) => {
    setPhase('processing')
    setError('')
    setCurrentFileName(result.name || 'datasheet')
    startMsgCycle()

    try {
      let extractedText = ''
      let pages: string[] = []

      if (result.viewMode === 'pdf') {
        extractedText = result.metadata.text
        pages = result.metadata.pages
        setPdfPages(pages)
      } else if (result.viewMode === 'image') {
        const base64 = result.metadata.dataURL
        extractedText = `[Image datasheet - base64 data follows]\n${base64}`
        setPdfPages([])
      } else {
        throw new Error('Unsupported file format. Please upload a PDF or image.')
      }

      setProcessingMsg(PROCESSING_MESSAGES[1])
      const raw = await makeRequest(
        [{ role: 'user', content: EXTRACTION_PROMPT(extractedText) }],
        SYSTEM_PROMPT,
        { maxTokens: 4096 }
      )

      setProcessingMsg(PROCESSING_MESSAGES[3])
      const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const data: ComponentData = JSON.parse(cleaned)

      saveToLibrary(data, result.name)
      setComponent(data)
      setChatMessages([])
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed')
      setPhase('error')
    } finally {
      stopMsgCycle()
    }
  }, [makeRequest])

  function handleLoadFromLibrary(saved: SavedComponent) {
    setComponent(saved.data)
    setCurrentFileName(saved.fileName)
    setPdfPages([])
    setChatMessages([])
    setPhase('done')
  }

  const libCount = loadLibrary().length

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
            Datasheet Intelligence
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            {component ? `Active file: ${currentFileName}` : 'Drop any component datasheet — get a structured, queryable knowledge card'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {phase === 'done' && (
            <button className="btn" onClick={() => { setPhase('idle'); setComponent(null); setPdfPages([]) }}
              style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <RefreshCw size={13} /> New
            </button>
          )}
          <button
            className="btn"
            onClick={() => setShowLibrary(true)}
            style={{ display: 'flex', gap: 6, alignItems: 'center' }}
          >
            <Library size={13} /> Library ({libCount})
          </button>
        </div>
      </div>

      {phase === 'idle' && (
        <UniversalDropZone
          onFileLoaded={handleFileLoaded}
          acceptedCategories={['documents', 'imaging']}
        />
      )}
      {phase === 'processing' && <ProcessingState message={processingMsg} />}
      {phase === 'error' && (
        <div style={{ padding: 24, background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: 12 }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#b08080', margin: '0 0 12px' }}>Extraction failed</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>{error}</p>
          <button className="btn" onClick={() => setPhase('idle')}>Try Again</button>
        </div>
      )}
      {phase === 'done' && component && (
        <ComponentCard
          data={component}
          pdfPages={pdfPages}
          chatMessages={chatMessages}
          onChatChange={setChatMessages}
          onLoadInCircuitSim={(netlist) => {
            localStorage.setItem('enginguity_circuit_prefill', netlist)
            window.location.href = '/circuit-sim'
          }}
          onLoadInParamPlayground={(components) => {
            localStorage.setItem('enginguity_params_prefill', JSON.stringify(components))
            window.location.href = '/parameter-playground'
          }}
        />
      )}

      {showLibrary && (
        <ComponentLibrary
          onLoad={handleLoadFromLibrary}
          onClose={() => setShowLibrary(false)}
        />
      )}
    </div>
  )
}

export default DatasheetIntelligence
