import React, { useState, useEffect, useRef, useMemo } from 'react'
import ResizablePanel from '../../components/ResizablePanel'
import {
  GitCompare,
  Upload,
  Sparkles,
  Download,
  Copy,
  Trash2,
  ChevronDown,
  Info,
  Brain,
  AlertTriangle,
  Check,
  RotateCcw,
  FileText
} from 'lucide-react'
import JSZip from 'jszip'

import { useAIProvider } from '../../hooks/useAIProvider'
import { UniversalDropZone } from '../../components/UniversalDropZone/index.jsx'
import { FileTree } from './components/FileTree'
import { AIAnalysisPanel } from './components/AIAnalysisPanel'
import {
  computeLineDiff,
  generateHunks,
  calculateStats,
  parseIntelHex,
  analyzeBin,
  parseElf,
  diffBinary
} from './engine/diffEngine.js'

import type { ParsedFile, DiffLine, Hunk, AIAnalysisResult, FileTreeNode } from './types'

// Dynamic loader helper for Highlight.js
const loadHighlightJS = (): Promise<any> => {
  return new Promise((resolve) => {
    if ((window as any).hljs) {
      resolve((window as any).hljs)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js'
    script.async = true
    script.onload = () => {
      resolve((window as any).hljs)
    }
    
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
    document.head.appendChild(link)
    
    document.body.appendChild(script)
  })
}

// Map file extensions to languages supported by Highlight.js
const getLanguageFromExtension = (ext?: string): string => {
  switch (ext?.toLowerCase()) {
    case 'c':
    case 'cpp':
    case 'h':
    case 'ino':
      return 'cpp'
    case 'py':
      return 'python'
    case 'rs':
      return 'rust'
    case 'v':
    case 'sv':
      return 'verilog'
    case 'vhd':
      return 'vhdl'
    case 'json':
      return 'json'
    case 'yaml':
    case 'yml':
      return 'yaml'
    case 'xml':
      return 'xml'
    default:
      return 'plaintext'
  }
}

interface MaybeResizableProps {
  condition: boolean
  storageKey: string
  children: [React.ReactNode, React.ReactNode]
}

function MaybeResizable({ condition, storageKey, children }: MaybeResizableProps) {
  if (condition) {
    return (
      <div style={{ height: 550, minHeight: 400 }}>
        <ResizablePanel
          direction="horizontal"
          initialSplit={0.25}
          minFirst={180}
          minSecond={300}
          storageKey={storageKey}
        >
          {children}
        </ResizablePanel>
      </div>
    )
  }
  return (
    <div style={{ height: 550, minHeight: 400 }}>
      {children[1]}
    </div>
  )
}

export function FirmwareDiffViewer() {
  const { makeRequest } = useAIProvider()

  // File states
  const [fileA, setFileA] = useState<ParsedFile | null>(null)
  const [fileB, setFileB] = useState<ParsedFile | null>(null)
  const [isLoadingA, setIsLoadingA] = useState(false)
  const [isLoadingB, setIsLoadingB] = useState(false)
  const [errorA, setErrorA] = useState<string | null>(null)
  const [errorB, setErrorB] = useState<string | null>(null)

  // ZIP tree selection
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)

  // Layout & Context states
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split')
  const [contextLines, setContextLines] = useState<number | 'all'>(3)

  // Navigation states
  const [currentChangeIndex, setCurrentChangeIndex] = useState<number>(-1)

  // AI analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null)

  // Highlight.js syntax highlighting
  const [hljsLoaded, setHljsLoaded] = useState(false)
  const [highlightedLinesA, setHighlightedLinesA] = useState<string[] | null>(null)
  const [highlightedLinesB, setHighlightedLinesB] = useState<string[] | null>(null)

  // Scroll references for synchronized scrolling
  const scrollARef = useRef<HTMLDivElement | null>(null)
  const scrollBRef = useRef<HTMLDivElement | null>(null)
  const unifiedScrollRef = useRef<HTMLDivElement | null>(null)
  const activeScrollRef = useRef<'A' | 'B' | 'U' | null>(null)

  // Toast notifications
  const [toast, setToast] = useState<{ show: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({
    show: false,
    title: '',
    message: '',
    type: 'info'
  })

  // Load Highlight.js once on mount
  useEffect(() => {
    loadHighlightJS().then(() => {
      setHljsLoaded(true)
    })
  }, [])

  // Auto-dismiss toast
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }))
      }, 8000)
      return () => clearTimeout(timer)
    }
  }, [toast.show])

  // Custom parser/dispatch for drops
  const processAndSetFile = async (rawFile: File, version: 'A' | 'B') => {
    const ext = rawFile.name.split('.').pop()?.toLowerCase()
    const setFile = version === 'A' ? setFileA : setFileB
    const setError = version === 'A' ? setErrorA : setErrorB
    const setLoading = version === 'A' ? setIsLoadingA : setIsLoadingB

    setLoading(true)
    setError(null)
    setAnalysisResult(null)

    try {
      if (ext === 'zip') {
        const zip = await JSZip.loadAsync(rawFile)
        const zipFilesList: { name: string; content: string }[] = []
        
        for (const [path, zipFile] of Object.entries(zip.files)) {
          if (!zipFile.dir) {
            const content = await zipFile.async('text')
            zipFilesList.push({ name: path, content })
          }
        }

        setFile({
          name: rawFile.name,
          type: 'ZIP',
          content: '',
          zipFiles: zipFilesList
        })
      } else if (ext === 'hex') {
        const text = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = (e) => resolve(e.target?.result as string)
          r.onerror = reject
          r.readAsText(rawFile)
        })

        const hexResult = parseIntelHex(text)
        setFile({
          name: rawFile.name,
          type: 'HEX',
          content: hexResult.hexDumpText,
          rawBuffer: hexResult.bytes,
          hexData: hexResult
        })
      } else if (ext === 'bin') {
        const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const r = new FileReader()
          r.onload = (e) => resolve(e.target?.result as ArrayBuffer)
          r.onerror = reject
          r.readAsArrayBuffer(rawFile)
        })

        const bytes = new Uint8Array(buffer)
        const binResult = analyzeBin(bytes)
        setFile({
          name: rawFile.name,
          type: 'BIN',
          content: binResult.hexDumpText,
          rawBuffer: bytes,
          binData: binResult
        })
      } else if (ext === 'elf') {
        const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const r = new FileReader()
          r.onload = (e) => resolve(e.target?.result as ArrayBuffer)
          r.onerror = reject
          r.readAsArrayBuffer(rawFile)
        })

        const bytes = new Uint8Array(buffer)
        const elfResult = parseElf(bytes)
        
        let summaryText = `ELF File Summary:\n`
        summaryText += `-----------------\n`
        if (elfResult.error) {
          summaryText += `Error: ${elfResult.error}\n`
        } else {
          summaryText += `Architecture: ${elfResult.architecture}\n`
          summaryText += `Class: ${elfResult.is64}\n`
          summaryText += `Endianness: ${elfResult.endianness}\n`
          summaryText += `Entry Point: ${elfResult.entryPoint}\n`
          summaryText += `Total Size: ${elfResult.totalSize} bytes\n\n`
          summaryText += `Sections (${elfResult.sections?.length || 0}):\n`
          elfResult.sections?.forEach(s => {
            summaryText += `  [${s.index.toString().padStart(2)}] Type: ${s.type.padEnd(16)} Address: ${s.address.padEnd(12)} Size: ${s.size}\n`
          })
        }

        setFile({
          name: rawFile.name,
          type: 'ELF',
          content: summaryText,
          rawBuffer: bytes,
          elfData: elfResult as any
        })
      } else {
        const text = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = (e) => resolve(e.target?.result as string)
          r.onerror = reject
          r.readAsText(rawFile)
        })

        setFile({
          name: rawFile.name,
          type: 'text',
          content: text
        })
      }
    } catch (err: any) {
      setError(err.message || 'Error parsing file.')
    } finally {
      setLoading(false)
    }
  }

  // ZIP Comparisons computation
  const { comparisons, fileTreeRoot } = useMemo(() => {
    if (fileA?.type !== 'ZIP' || fileB?.type !== 'ZIP') {
      return { comparisons: [], fileTreeRoot: null }
    }

    const zipA = fileA.zipFiles || []
    const zipB = fileB.zipFiles || []
    const allPaths = Array.from(new Set([
      ...zipA.map(f => f.name),
      ...zipB.map(f => f.name)
    ])).sort()

    const comps = allPaths.map(path => {
      const inA = zipA.find(f => f.name === path)
      const inB = zipB.find(f => f.name === path)
      
      let status: 'added' | 'removed' | 'modified' | 'unchanged' = 'unchanged'
      if (inA && !inB) {
        status = 'removed'
      } else if (!inA && inB) {
        status = 'added'
      } else if (inA && inB) {
        status = inA.content === inB.content ? 'unchanged' : 'modified'
      }
      
      return { path, status }
    })

    // Construct hierarchy tree
    const root: FileTreeNode = { name: 'Archive Contents', path: '', isDir: true, status: 'unchanged', children: [] }
    
    for (const item of comps) {
      const parts = item.path.split('/')
      let current = root

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        if (!part) continue

        const isLast = i === parts.length - 1
        const currentPath = parts.slice(0, i + 1).join('/')

        let child = current.children?.find(c => c.name === part)

        if (!child) {
          child = {
            name: part,
            path: currentPath,
            isDir: !isLast,
            status: isLast ? item.status : 'unchanged',
            children: isLast ? undefined : []
          }
          current.children?.push(child)
        }
        current = child
      }
    }

    // Update directories status recursively
    const updateDirStatus = (node: FileTreeNode): FileTreeNode['status'] => {
      if (!node.isDir) return node.status
      if (!node.children || node.children.length === 0) return 'unchanged'

      const childStatuses = node.children.map(updateDirStatus)
      if (childStatuses.includes('modified')) {
        node.status = 'modified'
      } else if (childStatuses.includes('added') && childStatuses.includes('removed')) {
        node.status = 'modified'
      } else if (childStatuses.includes('added')) {
        node.status = 'added'
      } else if (childStatuses.includes('removed')) {
        node.status = 'removed'
      } else {
        node.status = 'unchanged'
      }
      return node.status
    }

    updateDirStatus(root)
    return { comparisons: comps, fileTreeRoot: root }
  }, [fileA, fileB])

  // Select first modified/added/removed path for ZIP files automatically
  useEffect(() => {
    if (comparisons.length > 0 && !selectedFilePath) {
      const firstChanged = comparisons.find(c => c.status !== 'unchanged') || comparisons[0]
      if (firstChanged) {
        setSelectedFilePath(firstChanged.path)
      }
    }
  }, [comparisons, selectedFilePath])

  // Core diff memo
  const { diffLines, stats, binaryDiffResult } = useMemo(() => {
    // 1. ZIP File Comparison
    if (fileA?.type === 'ZIP' && fileB?.type === 'ZIP') {
      if (!selectedFilePath) {
        return {
          diffLines: [],
          stats: { linesAdded: 0, linesRemoved: 0, linesModified: 0, percentChanged: 0, functionsAffected: [] }
        }
      }
      const zipA = fileA.zipFiles || []
      const zipB = fileB.zipFiles || []
      const inA = zipA.find(f => f.name === selectedFilePath)
      const inB = zipB.find(f => f.name === selectedFilePath)

      const linesA = inA ? inA.content.split('\n') : []
      const linesB = inB ? inB.content.split('\n') : []

      const lines = computeLineDiff(linesA, linesB)
      const s = calculateStats(lines)
      return { diffLines: lines, stats: s }
    }

    // 2. Binary Diff Comparison (HEX, BIN, ELF)
    if (fileA && fileB && ['HEX', 'BIN', 'ELF'].includes(fileA.type)) {
      const bytesA = fileA.rawBuffer || new Uint8Array()
      const bytesB = fileB.rawBuffer || new Uint8Array()
      const binDiff = diffBinary(bytesA, bytesB)
      return {
        diffLines: [],
        stats: {
          linesAdded: 0,
          linesRemoved: 0,
          linesModified: binDiff.changesCount,
          percentChanged: binDiff.changedBytesTotal > 0 ? Math.min(100, Math.round((binDiff.changedBytesTotal / Math.max(1, bytesA.length)) * 100)) : 0,
          functionsAffected: []
        },
        binaryDiffResult: binDiff
      }
    }

    // 3. Flat Source Files Comparison
    if (fileA && fileB) {
      const linesA = fileA.content.split('\n')
      const linesB = fileB.content.split('\n')
      const lines = computeLineDiff(linesA, linesB)
      const s = calculateStats(lines)
      return { diffLines: lines, stats: s }
    }

    return {
      diffLines: [],
      stats: { linesAdded: 0, linesRemoved: 0, linesModified: 0, percentChanged: 0, functionsAffected: [] }
    }
  }, [fileA, fileB, selectedFilePath])

  // Run syntax highlighting on code text changes
  useEffect(() => {
    if (!hljsLoaded) return
    let activeFileName = fileB?.name || fileA?.name || ''
    if (fileA?.type === 'ZIP' && selectedFilePath) {
      activeFileName = selectedFilePath
    }
    const ext = activeFileName.split('.').pop() || ''
    const lang = getLanguageFromExtension(ext)

    const highlightText = (content: string) => {
      if (!content) return []
      try {
        const res = (window as any).hljs.highlight(content, { language: lang }).value
        return res.split('\n')
      } catch (e) {
        return content.split('\n')
      }
    }

    if (fileA?.type === 'ZIP' && fileB?.type === 'ZIP' && selectedFilePath) {
      const inA = fileA.zipFiles?.find(f => f.name === selectedFilePath)
      const inB = fileB.zipFiles?.find(f => f.name === selectedFilePath)
      setHighlightedLinesA(inA ? highlightText(inA.content) : [])
      setHighlightedLinesB(inB ? highlightText(inB.content) : [])
    } else if (fileA && fileB && !['HEX', 'BIN', 'ELF'].includes(fileA.type)) {
      setHighlightedLinesA(highlightText(fileA.content))
      setHighlightedLinesB(highlightText(fileB.content))
    } else {
      setHighlightedLinesA(null)
      setHighlightedLinesB(null)
    }
  }, [fileA, fileB, selectedFilePath, hljsLoaded])

  // Context hunks computation
  const hunks: Hunk[] = useMemo(() => {
    if (contextLines === 'all') return []
    return generateHunks(diffLines, contextLines) as any
  }, [diffLines, contextLines])

  // Navigation: target markers
  const changeIndices = useMemo(() => {
    const indices: number[] = []
    if (contextLines === 'all') {
      // Find beginning lines of each change sequence
      let inChange = false
      for (let i = 0; i < diffLines.length; i++) {
        if (diffLines[i].type !== 'UNCHANGED') {
          if (!inChange) {
            indices.push(i)
            inChange = true
          }
        } else {
          inChange = false
        }
      }
    } else {
      // Each hunk is a navigation target
      hunks.forEach((_, idx) => {
        indices.push(idx)
      })
    }
    return indices
  }, [diffLines, hunks, contextLines])

  // Jump to specific index of change
  const scrollToTarget = (index: number) => {
    if (index < 0 || index >= changeIndices.length) return
    setCurrentChangeIndex(index)

    const targetId = contextLines === 'all'
      ? `diff-row-${changeIndices[index]}`
      : `diff-hunk-${changeIndices[index]}`

    const element = document.getElementById(targetId)
    if (element) {
      element.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }

  // Prev / Next Change handlers
  const handlePrevChange = () => {
    if (changeIndices.length === 0) return
    let prev = currentChangeIndex - 1
    if (prev < 0) prev = changeIndices.length - 1
    scrollToTarget(prev)
  }

  const handleNextChange = () => {
    if (changeIndices.length === 0) return
    let next = currentChangeIndex + 1
    if (next >= changeIndices.length) next = 0
    scrollToTarget(next)
  }

  // Keyboard hotkeys N / P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        handleNextChange()
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        handlePrevChange()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [changeIndices, currentChangeIndex])

  // Synchronized scrolling event handlers
  const handleScrollSync = (e: React.UIEvent<HTMLDivElement>, source: 'A' | 'B' | 'U') => {
    if (activeScrollRef.current && activeScrollRef.current !== source) return

    activeScrollRef.current = source
    const targetScrollTop = e.currentTarget.scrollTop
    const targetScrollLeft = e.currentTarget.scrollLeft

    if (source === 'A' && scrollBRef.current) {
      scrollBRef.current.scrollTop = targetScrollTop
      scrollBRef.current.scrollLeft = targetScrollLeft
    } else if (source === 'B' && scrollARef.current) {
      scrollARef.current.scrollTop = targetScrollTop
      scrollARef.current.scrollLeft = targetScrollLeft
    }
  }

  const clearScrollActive = () => {
    activeScrollRef.current = null
  }

  // AI Semantic Analysis query
  const triggerAIAnalysis = async () => {
    if (!fileA || !fileB) return
    setIsAnalyzing(true)
    setAnalysisResult(null)

    let diffText = ''
    if (binaryDiffResult) {
      diffText = binaryDiffResult.diffDumpText
    } else {
      // Extract up to 10 hunks to not exceed token sizes
      const briefHunks = generateHunks(diffLines, 2).slice(0, 15)
      diffText = briefHunks.map(h => {
        let text = `Hunk @@ -${h.startA} +${h.startB} @@\n`
        h.linesA.forEach(l => {
          if (l.type === 'REMOVED' || l.type === 'MODIFIED') text += `-${l.value || l.valueA}\n`
        })
        h.linesB.forEach(l => {
          if (l.type === 'ADDED' || l.type === 'MODIFIED') text += `+${l.value || l.valueB}\n`
        })
        return text
      }).join('\n')
    }

    const systemPrompt = `You are a Principal Firmware Security & Integrity Engineer. Analyze the provided firmware diff. You MUST output a valid, parsable JSON response matching the schema described. Do not include markdown codeblocks in your final response.`
    const prompt = `Perform a semantic risk analysis on the following diff details:
Before: ${fileA.name} (${fileA.type})
After: ${fileB.name} (${fileB.type})

Stats:
- Lines Added: ${stats.linesAdded}
- Lines Removed: ${stats.linesRemoved}
- Lines Modified: ${stats.linesModified}
- Function scope affected: ${stats.functionsAffected.join(', ') || 'N/A'}

Diff Hunks / Payload:
${diffText.slice(0, 8000)}

Generate the report in this exact JSON structure:
{
  "summary": "Clear high-level explanation of code structure changes.",
  "overall_risk": "low" | "medium" | "high",
  "changes": [
    {
      "type": "behavioral" | "performance" | "safety" | "bug_fix" | "refactor" | "config" | "dependency",
      "description": "Short description of change details",
      "severity": "breaking" | "significant" | "minor" | "cosmetic",
      "lineRange": { "start": 12, "end": 15 } or null,
      "impact": "Firmware impact details"
    }
  ],
  "risks": [
    {
      "description": "Critical security, overflow, or safety concern detail",
      "severity": "high" | "medium" | "low",
      "relatedLines": [12]
    }
  ],
  "breaking_changes": ["Breaking change descriptions"],
  "test_recommendations": ["Automated or manual test recommendation steps"]
}`

    try {
      const res = await makeRequest([{ role: 'user', content: prompt }], systemPrompt)
      let cleanRes = res.trim()
      if (cleanRes.startsWith('```')) {
        cleanRes = cleanRes.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '')
      }
      
      const parsed: AIAnalysisResult = JSON.parse(cleanRes)
      setAnalysisResult(parsed)
      setToast({
        show: true,
        title: 'AI Analysis Complete',
        message: 'Semantic review generated successfully. Risks mapped.',
        type: 'success'
      })
    } catch (e: any) {
      console.error(e)
      setToast({
        show: true,
        title: 'AI Request Failed',
        message: e.message || 'Failed to fetch AI verification report.',
        type: 'error'
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Exports: Patch
  const handleExportPatch = () => {
    let patch = `diff --git a/${fileA?.name || 'before'} b/${fileB?.name || 'after'}\n`
    patch += `--- a/${fileA?.name || 'before'}\n`
    patch += `+++ b/${fileB?.name || 'after'}\n`

    const hs = generateHunks(diffLines, 3)
    hs.forEach(h => {
      patch += `@@ -${h.startA},${h.linesA.length} +${h.startB},${h.linesB.length} @@\n`
      h.linesA.forEach(l => {
        if (l.type === 'REMOVED' || l.type === 'MODIFIED') {
          patch += `-${l.value || l.valueA}\n`
        } else if (l.type === 'UNCHANGED') {
          patch += ` ${l.value}\n`
        }
      })
      h.linesB.forEach(l => {
        if (l.type === 'ADDED' || l.type === 'MODIFIED') {
          patch += `+${l.value || l.valueB}\n`
        }
      })
    })

    const blob = new Blob([patch], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${fileB?.name || 'firmware'}.patch`
    link.click()
  }

  // Exports: Markdown Report
  const handleExportMarkdown = () => {
    let md = `# Firmware Diff Analysis Report\n\n`
    md += `**A (Before):** \`${fileA?.name}\`\n`
    md += `**B (After):** \`${fileB?.name}\`\n\n`
    md += `## Metrics Summary\n`
    md += `- Additions: ${stats.linesAdded}\n`
    md += `- Removals: ${stats.linesRemoved}\n`
    md += `- Modifications: ${stats.linesModified}\n`
    md += `- Total Change Density: ${stats.percentChanged}%\n\n`

    if (stats.functionsAffected.length > 0) {
      md += `## Affected Functions\n`
      stats.functionsAffected.forEach(f => {
        md += `- \`${f}\`\n`
      })
      md += '\n'
    }

    if (analysisResult) {
      md += `## AI Semantic Insights\n`
      md += `> ${analysisResult.summary}\n\n`
      md += `### Integrity Risks\n`
      analysisResult.risks.forEach((r, i) => {
        md += `${i + 1}. **[${r.severity.toUpperCase()}]** ${r.description} (Lines: ${r.relatedLines.join(', ') || 'N/A'})\n`
      })
      md += '\n'
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `diff-analysis-${Date.now()}.md`
    link.click()
  }

  // Exports: Standalone HTML
  const handleExportHTML = () => {
    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Firmware Diff: ${fileA?.name} vs ${fileB?.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; background: #080808; color: #e2e4f0; padding: 30px; }
    h2 { border-bottom: 1px solid #1f1f35; padding-bottom: 10px; font-weight: 500; }
    .meta { color: #6b6d85; margin-bottom: 20px; }
    .table { border: 1px solid #1f1f35; border-radius: 6px; overflow: hidden; background: #131313; }
    .line { display: flex; font-size: 13px; line-height: 20px; font-family: monospace; border-bottom: 1px solid rgba(255,255,255,0.03); }
    .num { width: 50px; text-align: right; padding-right: 12px; color: #3a3c55; user-select: none; border-right: 1px solid #1f1f35; background: rgba(0,0,0,0.1); }
    .code { padding-left: 12px; white-space: pre; flex: 1; }
    .added { background: rgba(0,230,118,0.12); color: #7aaa8a; }
    .removed { background: rgba(255,107,107,0.12); color: #b08080; }
    .modified { background: rgba(255,171,64,0.12); color: #b09470; }
  </style>
</head>
<body>
  <h2>Firmware Comparison</h2>
  <div class="meta">
    File A: ${fileA?.name}<br>
    File B: ${fileB?.name}
  </div>
  <div class="table">
    ${diffLines.map((l, i) => `
      <div class="line ${l.type.toLowerCase()}">
        <span class="num">${l.lineA || ''}</span>
        <span class="num">${l.lineB || ''}</span>
        <span class="code">${escapeHtml(l.value || l.valueA || l.valueB || '')}</span>
      </div>
    `).join('')}
  </div>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `diff-${Date.now()}.html`
    link.click()
  }

  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  // Exports: PR Template Copy
  const handleCopyPRDescription = () => {
    let pr = `## Firmware Comparison Description\n\n`
    pr += `Comparing Version A: \`${fileA?.name}\` with Version B: \`${fileB?.name}\`.\n\n`
    pr += `### Metrics\n`
    pr += `- **Lines Added**: ${stats.linesAdded}\n`
    pr += `- **Lines Removed**: ${stats.linesRemoved}\n`
    pr += `- **Lines Modified**: ${stats.linesModified}\n`
    pr += `- **Total Density**: ${stats.percentChanged}%\n\n`

    if (stats.functionsAffected.length > 0) {
      pr += `### Affected Symbols/Functions\n`
      stats.functionsAffected.forEach(f => {
        pr += `- \`${f}\`\n`
      })
      pr += '\n'
    }

    if (analysisResult) {
      pr += `### AI Semantic Impact Insights\n`
      pr += `> ${analysisResult.summary}\n\n`
      if (analysisResult.breaking_changes.length > 0) {
        pr += `△ **Breaking Changes Alert**:\n`
        analysisResult.breaking_changes.forEach(bc => {
          pr += `- ${bc}\n`
        })
        pr += '\n'
      }
    }

    navigator.clipboard.writeText(pr)
    setToast({
      show: true,
      title: 'PR Template Copied',
      message: 'PR description template copied to keyboard clipboard.',
      type: 'success'
    })
  }

  // Clean / reset all loaded state
  const resetFiles = () => {
    setFileA(null)
    setFileB(null)
    setErrorA(null)
    setErrorB(null)
    setSelectedFilePath(null)
    setAnalysisResult(null)
  }

  // Frequency Chart component helper
  const renderFrequenciesChart = (frequencies?: number[]) => {
    if (!frequencies || frequencies.length === 0) return null
    const maxFreq = Math.max(...frequencies, 1)
    const sorted = frequencies
      .map((f, i) => ({ byte: i, freq: f }))
      .sort((a, b) => b.freq - a.freq)
      .slice(0, 5)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
        <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)',  }}>Byte Frequency Histogram</span>
        <div style={{ display: 'flex', alignItems: 'flex-end', height: 60, gap: 1, background: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 6, border: '1px solid var(--border)' }}>
          {frequencies.map((freq, idx) => {
            const pct = (freq / maxFreq) * 100
            return (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: `${Math.max(1, pct)}%`,
                  background: 'var(--accent)',
                  opacity: 0.5 + (pct / 100) * 0.5,
                  borderRadius: 1
                }}
                title={`Byte 0x${idx.toString(16).toUpperCase().padStart(2, '0')}: ${freq}`}
              />
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {sorted.map((item, idx) => (
            <span
              key={idx}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: 'var(--text-muted)',
                background: 'var(--surface-2)',
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px solid var(--border)'
              }}
            >
              <strong>0x{item.byte.toString(16).toUpperCase().padStart(2, '0')}</strong>: {item.freq}
            </span>
          ))}
        </div>
      </div>
    )
  }

  // Draw vertical Minimap indicators
  const renderMinimapTicks = () => {
    if (contextLines !== 'all' || diffLines.length === 0) return null
    return (
      <div
        style={{
          position: 'relative',
          width: 14,
          height: '100%',
          background: 'var(--bg-2)',
          borderLeft: '1px solid var(--border)',
          borderRadius: 3,
          cursor: 'pointer'
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const y = e.clientY - rect.top
          const pct = y / rect.height
          const lineIdx = Math.floor(pct * diffLines.length)
          const targetBlock = changeIndices.findIndex(idx => idx >= lineIdx)
          if (targetBlock !== -1) {
            scrollToTarget(targetBlock)
          }
        }}
      >
        {diffLines.map((line, idx) => {
          if (line.type === 'UNCHANGED') return null
          let color = '#b08080'
          if (line.type === 'ADDED') color = '#7aaa8a'
          if (line.type === 'MODIFIED') color = '#b09470'

          return (
            <div
              key={idx}
              style={{
                position: 'absolute',
                top: `${(idx / diffLines.length) * 100}%`,
                left: 0,
                right: 0,
                height: 2,
                background: color
              }}
            />
          )
        })}
      </div>
    )
  }

  // Line renderers
  const renderSplitLine = (line: DiffLine, idx: number) => {
    const isNavigated = contextLines === 'all' && changeIndices[currentChangeIndex] === idx
    let leftBg = 'transparent'
    let leftContent: React.ReactNode = ''

    if (line.type === 'REMOVED') {
      leftBg = 'rgba(255, 107, 107, 0.12)'
      leftContent = highlightedLinesA && line.lineA !== null ? (
        <span dangerouslySetInnerHTML={{ __html: highlightedLinesA[line.lineA - 1] }} />
      ) : (
        line.valueA || line.value
      )
    } else if (line.type === 'MODIFIED') {
      leftBg = 'rgba(255, 171, 64, 0.12)'
      if (line.charDiffA) {
        leftContent = line.charDiffA.map((c, cIdx) => (
          <span
            key={cIdx}
            style={{
              backgroundColor: c.type === 'REMOVED' ? 'rgba(255, 107, 107, 0.35)' : 'transparent',
              textDecoration: c.type === 'REMOVED' ? 'line-through' : 'none'
            }}
          >
            {c.char}
          </span>
        ))
      } else {
        leftContent = line.valueA
      }
    } else if (line.type === 'UNCHANGED' && line.lineA !== null) {
      leftContent = highlightedLinesA ? (
        <span dangerouslySetInnerHTML={{ __html: highlightedLinesA[line.lineA - 1] }} />
      ) : (
        line.value
      )
    }

    let rightBg = 'transparent'
    let rightContent: React.ReactNode = ''

    if (line.type === 'ADDED') {
      rightBg = 'rgba(0, 230, 118, 0.12)'
      rightContent = highlightedLinesB && line.lineB !== null ? (
        <span dangerouslySetInnerHTML={{ __html: highlightedLinesB[line.lineB - 1] }} />
      ) : (
        line.valueB || line.value
      )
    } else if (line.type === 'MODIFIED') {
      rightBg = 'rgba(255, 171, 64, 0.12)'
      if (line.charDiffB) {
        rightContent = line.charDiffB.map((c, cIdx) => (
          <span
            key={cIdx}
            style={{
              backgroundColor: c.type === 'ADDED' ? 'rgba(0, 230, 118, 0.35)' : 'transparent',
              textDecoration: c.type === 'ADDED' ? 'underline' : 'none'
            }}
          >
            {c.char}
          </span>
        ))
      } else {
        rightContent = line.valueB
      }
    } else if (line.type === 'UNCHANGED' && line.lineB !== null) {
      rightContent = highlightedLinesB ? (
        <span dangerouslySetInnerHTML={{ __html: highlightedLinesB[line.lineB - 1] }} />
      ) : (
        line.value
      )
    }

    return (
      <div
        id={`diff-row-${idx}`}
        key={idx}
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          background: isNavigated ? 'rgba(148, 163, 184, 0.08)' : 'transparent',
          fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace",
          lineHeight: '20px'
        }}
      >
        <div style={{ flex: 1, display: 'flex', borderRight: '1px solid var(--border)', background: leftBg, minWidth: 0 }}>
          <div style={{ width: 45, textAlign: 'right', paddingRight: 8, color: 'var(--text-dim)', userSelect: 'none', borderRight: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
            {line.lineA || ''}
          </div>
          <div style={{ padding: '0 8px', overflowX: 'auto', whiteSpace: 'pre', flex: 1 }}>
            {leftContent}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', background: rightBg, minWidth: 0 }}>
          <div style={{ width: 45, textAlign: 'right', paddingRight: 8, color: 'var(--text-dim)', userSelect: 'none', borderRight: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
            {line.lineB || ''}
          </div>
          <div style={{ padding: '0 8px', overflowX: 'auto', whiteSpace: 'pre', flex: 1 }}>
            {rightContent}
          </div>
        </div>
      </div>
    )
  }

  const renderUnifiedLine = (line: DiffLine, idx: number) => {
    const isNavigated = contextLines === 'all' && changeIndices[currentChangeIndex] === idx

    if (line.type === 'MODIFIED') {
      return (
        <div id={`diff-row-${idx}`} key={idx} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', background: 'rgba(255, 107, 107, 0.12)', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", lineHeight: '20px' }}>
            <div style={{ width: 45, textAlign: 'right', paddingRight: 8, color: 'var(--text-dim)', userSelect: 'none', borderRight: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
              {line.lineA}
            </div>
            <div style={{ width: 45, textAlign: 'right', paddingRight: 8, color: 'var(--text-dim)', userSelect: 'none', borderRight: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
              -
            </div>
            <div style={{ width: 20, textAlign: 'center', color: '#b08080', borderRight: '1px solid var(--border)' }}>
              -
            </div>
            <div style={{ padding: '0 8px', overflowX: 'auto', whiteSpace: 'pre', flex: 1 }}>
              {line.charDiffA ? line.charDiffA.map((c, cIdx) => (
                <span key={cIdx} style={{ backgroundColor: c.type === 'REMOVED' ? 'rgba(255, 107, 107, 0.35)' : 'transparent', textDecoration: c.type === 'REMOVED' ? 'line-through' : 'none' }}>{c.char}</span>
              )) : line.valueA}
            </div>
          </div>
          <div style={{ display: 'flex', background: 'rgba(0, 230, 118, 0.12)', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", lineHeight: '20px' }}>
            <div style={{ width: 45, textAlign: 'right', paddingRight: 8, color: 'var(--text-dim)', userSelect: 'none', borderRight: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
              -
            </div>
            <div style={{ width: 45, textAlign: 'right', paddingRight: 8, color: 'var(--text-dim)', userSelect: 'none', borderRight: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
              {line.lineB}
            </div>
            <div style={{ width: 20, textAlign: 'center', color: '#7aaa8a', borderRight: '1px solid var(--border)' }}>
              +
            </div>
            <div style={{ padding: '0 8px', overflowX: 'auto', whiteSpace: 'pre', flex: 1 }}>
              {line.charDiffB ? line.charDiffB.map((c, cIdx) => (
                <span key={cIdx} style={{ backgroundColor: c.type === 'ADDED' ? 'rgba(0, 230, 118, 0.35)' : 'transparent', textDecoration: c.type === 'ADDED' ? 'underline' : 'none' }}>{c.char}</span>
              )) : line.valueB}
            </div>
          </div>
        </div>
      )
    }

    let bg = 'transparent'
    let prefix = ' '
    let color = 'inherit'
    let content: React.ReactNode = ''

    if (line.type === 'REMOVED') {
      bg = 'rgba(255, 107, 107, 0.12)'
      prefix = '-'
      color = '#b08080'
      content = highlightedLinesA && line.lineA !== null ? (
        <span dangerouslySetInnerHTML={{ __html: highlightedLinesA[line.lineA - 1] }} />
      ) : (
        line.value || line.valueA
      )
    } else if (line.type === 'ADDED') {
      bg = 'rgba(0, 230, 118, 0.12)'
      prefix = '+'
      color = '#7aaa8a'
      content = highlightedLinesB && line.lineB !== null ? (
        <span dangerouslySetInnerHTML={{ __html: highlightedLinesB[line.lineB - 1] }} />
      ) : (
        line.value || line.valueB
      )
    } else {
      content = highlightedLinesA && line.lineA !== null ? (
        <span dangerouslySetInnerHTML={{ __html: highlightedLinesA[line.lineA - 1] }} />
      ) : (
        line.value
      )
    }

    return (
      <div
        id={`diff-row-${idx}`}
        key={idx}
        style={{
          display: 'flex',
          background: isNavigated ? 'rgba(148, 163, 184, 0.08)' : bg,
          fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace",
          lineHeight: '20px',
          borderBottom: '1px solid var(--border)'
        }}
      >
        <div style={{ width: 45, textAlign: 'right', paddingRight: 8, color: 'var(--text-dim)', userSelect: 'none', borderRight: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
          {line.lineA || ''}
        </div>
        <div style={{ width: 45, textAlign: 'right', paddingRight: 8, color: 'var(--text-dim)', userSelect: 'none', borderRight: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
          {line.lineB || ''}
        </div>
        <div style={{ width: 20, textAlign: 'center', color: color, userSelect: 'none', borderRight: '1px solid var(--border)' }}>
          {prefix}
        </div>
        <div style={{ padding: '0 8px', overflowX: 'auto', whiteSpace: 'pre', flex: 1 }}>
          {content}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, height: '100%', overflowY: 'auto' }}>
      
      {/* Toast Notification */}
      {toast.show && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          maxWidth: 380,
          background: 'var(--surface)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-bright)',
          borderLeft: `4px solid ${toast.type === 'success' ? '#7aaa8a' : toast.type === 'error' ? '#b08080' : 'var(--accent)'}`,
          borderRadius: 8,
          padding: '16px 20px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.1)',
          zIndex: 1100,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: toast.type === 'success' ? '#7aaa8a' : toast.type === 'error' ? '#b08080' : 'var(--accent)',
                // no glow,
                display: 'inline-block'
              }} />
              <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                {toast.title}
              </h4>
            </div>
            <button
              onClick={() => setToast(prev => ({ ...prev, show: false }))}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: 0 }}
              data-tooltip="Dismiss"
            >
              ✕
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
            {toast.message}
          </p>
        </div>
      )}

      {/* Main Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <GitCompare size={22} style={{ color: 'var(--accent)' }} /> Firmware Diff Viewer
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Compare, analyze, and review firmware changes, BIN entropy profiles, ELF structures, and source trees.
          </p>
        </div>

        {/* Global Action Tools */}
        {(fileA || fileB) && (
          <button
            onClick={resetFiles}
            className="btn btn-outline"
            style={{
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <RotateCcw size={13} /> Reset Files
          </button>
        )}
      </div>

      {/* Upload Screen */}
      {(!fileA || !fileB) ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, flex: 1, minHeight: 400 }}>
          
          {/* Version A Dropzone */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--text-muted)',  margin: 0 }}>
              Version A (Before)
            </h3>
            {fileA ? (
              <div style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border-bright)',
                borderRadius: 8,
                padding: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <FileText size={18} style={{ color: 'var(--accent)' }} />
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'block' }}>{fileA.name}</span>
                    <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>{fileA.type.toUpperCase()} file</span>
                  </div>
                </div>
                <button
                  onClick={() => setFileA(null)}
                  style={{ background: 'none', border: 'none', color: '#b08080', cursor: 'pointer', padding: 4 }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <UniversalDropZone
                  acceptedCategories={['all']}
                  onFileLoaded={(res: any) => processAndSetFile(res.file, 'A')}
                />
                {isLoadingA && (
                  <span style={{ fontSize: 11, color: 'var(--accent)', alignSelf: 'center', marginTop: 10 }}>Parsing Version A buffer...</span>
                )}
                {errorA && (
                  <span style={{ fontSize: 11, color: '#b08080', alignSelf: 'center', marginTop: 10 }}>{errorA}</span>
                )}
              </div>
            )}
          </div>

          {/* Version B Dropzone */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--text-muted)',  margin: 0 }}>
              Version B (After)
            </h3>
            {fileB ? (
              <div style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border-bright)',
                borderRadius: 8,
                padding: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <FileText size={18} style={{ color: 'var(--accent)' }} />
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'block' }}>{fileB.name}</span>
                    <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>{fileB.type.toUpperCase()} file</span>
                  </div>
                </div>
                <button
                  onClick={() => setFileB(null)}
                  style={{ background: 'none', border: 'none', color: '#b08080', cursor: 'pointer', padding: 4 }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <UniversalDropZone
                  acceptedCategories={['all']}
                  onFileLoaded={(res: any) => processAndSetFile(res.file, 'B')}
                />
                {isLoadingB && (
                  <span style={{ fontSize: 11, color: 'var(--accent)', alignSelf: 'center', marginTop: 10 }}>Parsing Version B buffer...</span>
                )}
                {errorB && (
                  <span style={{ fontSize: 11, color: '#b08080', alignSelf: 'center', marginTop: 10 }}>{errorB}</span>
                )}
              </div>
            )}
          </div>

        </div>
      ) : (
        /* Active Diff Screen */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Top Control Panel */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16
          }}>
            
            {/* View Mode & Context Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {!['HEX', 'BIN', 'ELF'].includes(fileA.type) && (
                <div style={{ display: 'flex', border: '1px solid var(--border-bright)', borderRadius: 6, overflow: 'hidden' }}>
                  <button
                    onClick={() => setViewMode('split')}
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      padding: '6px 12px',
                      background: viewMode === 'split' ? 'var(--accent-glow)' : 'transparent',
                      border: 'none',
                      color: viewMode === 'split' ? 'var(--accent)' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    Split View
                  </button>
                  <button
                    onClick={() => setViewMode('unified')}
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      padding: '6px 12px',
                      background: viewMode === 'unified' ? 'var(--accent-glow)' : 'transparent',
                      border: 'none',
                      color: viewMode === 'unified' ? 'var(--accent)' : 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    Unified View
                  </button>
                </div>
              )}

              {!['HEX', 'BIN', 'ELF'].includes(fileA.type) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Context:</span>
                  <select
                    value={contextLines.toString()}
                    onChange={(e) => {
                      const v = e.target.value
                      setContextLines(v === 'all' ? 'all' : parseInt(v))
                      setCurrentChangeIndex(-1)
                    }}
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-bright)',
                      borderRadius: 6,
                      color: 'var(--text)',
                      padding: '4px 8px',
                      fontSize: 12,
                      fontFamily: "'JetBrains Mono', monospace"
                    }}
                  >
                    <option value="3">3 lines</option>
                    <option value="5">5 lines</option>
                    <option value="10">10 lines</option>
                    <option value="all">Show All</option>
                  </select>
                </div>
              )}
            </div>

            {/* AI Review & Exporters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              
              <button
                disabled={isAnalyzing}
                onClick={triggerAIAnalysis}
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  borderColor: 'var(--border-bright)',
                  color: isAnalyzing ? 'var(--text-muted)' : 'var(--accent)',
                  background: isAnalyzing ? 'transparent' : 'rgba(148, 163, 184, 0.06)'
                }}
                className="btn btn-outline"
              >
                <Brain size={14} className={isAnalyzing ? 'animate-pulse' : ''} />
                {isAnalyzing ? 'Analyzing...' : 'AI Analyze Changes'}
              </button>

              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={handleExportPatch}
                  title="Export Unified Patch (.patch)"
                  className="btn btn-outline"
                  style={{ padding: 8, borderColor: 'var(--border-bright)' }}
                >
                  <Download size={13} />
                </button>
                <button
                  onClick={handleExportHTML}
                  title="Export HTML Document"
                  className="btn btn-outline"
                  style={{ padding: 8, borderColor: 'var(--border-bright)' }}
                >
                  <FileText size={13} />
                </button>
                <button
                  onClick={handleExportMarkdown}
                  title="Export Markdown Report"
                  className="btn btn-outline"
                  style={{ padding: 8, borderColor: 'var(--border-bright)' }}
                >
                  <Info size={13} />
                </button>
                <button
                  onClick={handleCopyPRDescription}
                  title="Copy PR Template description"
                  className="btn btn-outline"
                  style={{ padding: 8, borderColor: 'var(--border-bright)' }}
                >
                  <Copy size={13} />
                </button>
              </div>

            </div>
          </div>

          {/* Stats Bar */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 16
          }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
              <span style={{ display: 'block', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)',  }}>Additions</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#7aaa8a' }}>+{stats.linesAdded} lines</span>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
              <span style={{ display: 'block', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)',  }}>Removals</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#b08080' }}>-{stats.linesRemoved} lines</span>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
              <span style={{ display: 'block', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)',  }}>Modifications</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#b09470' }}>~{stats.linesModified} lines</span>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
              <span style={{ display: 'block', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)',  }}>Change Density</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{stats.percentChanged}%</span>
            </div>
          </div>

          {/* Binary Stats (If Hex/Bin/Elf) */}
          {['HEX', 'BIN', 'ELF'].includes(fileA.type) && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 20
            }}>
              {/* File A Metadata */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
                <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--accent)', margin: '0 0 12px 0' }}>Version A: {fileA.name}</h4>
                {fileA.hexData && (
                  <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div><strong>Total Size:</strong> {fileA.hexData.totalSize} bytes</div>
                    <div><strong>Entry Point:</strong> {fileA.hexData.entryPoint}</div>
                    <div><strong>Checksum:</strong> {fileA.hexData.checksumValid ? 'Valid' : 'INVALID'}</div>
                    <div><strong>Address Map Ranges:</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {fileA.hexData.addressRanges.map((r, i) => (
                          <span key={i} style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4 }}>
                            0x{r.start.toString(16).toUpperCase()}-0x{r.end.toString(16).toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {fileA.binData && (
                  <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div><strong>Total Size:</strong> {fileA.binData.totalSize} bytes</div>
                    <div><strong>Shannon Entropy:</strong> {fileA.binData.entropy} bits/byte</div>
                    {renderFrequenciesChart(fileA.binData.frequencies)}
                  </div>
                )}
                {fileA.elfData && (
                  <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div><strong>Target Architecture:</strong> {fileA.elfData.architecture}</div>
                    <div><strong>Class:</strong> {fileA.elfData.is64}</div>
                    <div><strong>Endianness:</strong> {fileA.elfData.endianness}</div>
                    <div><strong>Entry Point:</strong> {fileA.elfData.entryPoint}</div>
                    <div><strong>Sections:</strong> {fileA.elfData.sections?.length || 0}</div>
                  </div>
                )}
              </div>

              {/* File B Metadata */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
                <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--accent)', margin: '0 0 12px 0' }}>Version B: {fileB.name}</h4>
                {fileB.hexData && (
                  <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div><strong>Total Size:</strong> {fileB.hexData.totalSize} bytes</div>
                    <div><strong>Entry Point:</strong> {fileB.hexData.entryPoint}</div>
                    <div><strong>Checksum:</strong> {fileB.hexData.checksumValid ? 'Valid' : 'INVALID'}</div>
                    <div><strong>Address Map Ranges:</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {fileB.hexData.addressRanges.map((r, i) => (
                          <span key={i} style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4 }}>
                            0x{r.start.toString(16).toUpperCase()}-0x{r.end.toString(16).toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {fileB.binData && (
                  <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div><strong>Total Size:</strong> {fileB.binData.totalSize} bytes</div>
                    <div><strong>Shannon Entropy:</strong> {fileB.binData.entropy} bits/byte</div>
                    {renderFrequenciesChart(fileB.binData.frequencies)}
                  </div>
                )}
                {fileB.elfData && (
                  <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div><strong>Target Architecture:</strong> {fileB.elfData.architecture}</div>
                    <div><strong>Class:</strong> {fileB.elfData.is64}</div>
                    <div><strong>Endianness:</strong> {fileB.elfData.endianness}</div>
                    <div><strong>Entry Point:</strong> {fileB.elfData.entryPoint}</div>
                    <div><strong>Sections:</strong> {fileB.elfData.sections?.length || 0}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Main Diff Code Display area */}
          <MaybeResizable
            condition={fileA.type === 'ZIP' && fileB.type === 'ZIP' && !!fileTreeRoot}
            storageKey="diff-split"
          >
            {/* Left Zip File Tree Panel */}
            <div style={{
                  height: '100%',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 12,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxSizing: 'border-box',
                }}>
                  <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
                    Archive tree
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {fileTreeRoot && (
                      <FileTree
                        node={fileTreeRoot}
                        selectedPath={selectedFilePath}
                        onSelectFile={(path) => setSelectedFilePath(path)}
                      />
                    )}
                  </div>
                </div>

                {/* Main scroll diff views */}
                <div style={{
                  height: '100%',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  position: 'relative',
                }}>
              
              {/* Navigation Floating Toolbar */}
              {changeIndices.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: 12,
                  right: 32,
                  zIndex: 20,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-bright)',
                  borderRadius: 20,
                  padding: '4px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                }}>
                  <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
                    {currentChangeIndex !== -1 ? `Hunk ${currentChangeIndex + 1} of ${changeIndices.length}` : `${changeIndices.length} changes`}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={handlePrevChange}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent)',
                        cursor: 'pointer',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11,
                        padding: '2px 6px'
                      }}
                      title="Jump to Previous Hunk [P]"
                    >
                      ▲ Prev
                    </button>
                    <button
                      onClick={handleNextChange}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent)',
                        cursor: 'pointer',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11,
                        padding: '2px 6px'
                      }}
                      title="Jump to Next Hunk [N]"
                    >
                      ▼ Next
                    </button>
                  </div>
                </div>
              )}

              {/* View Rendering Logic */}
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {binaryDiffResult ? (
                  // Binary Output dump
                  <div style={{ flex: 1, padding: 16, overflow: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'pre' }}>
                    <pre style={{ margin: 0, color: 'var(--text)' }}>{binaryDiffResult.diffDumpText}</pre>
                  </div>
                ) : contextLines === 'all' ? (
                  /* Show All Lines view */
                  viewMode === 'split' ? (
                    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                      <div
                        ref={scrollARef}
                        onScroll={(e) => handleScrollSync(e, 'A')}
                        onMouseLeave={clearScrollActive}
                        style={{ flex: 1, overflow: 'auto', borderRight: '1px solid var(--border)' }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 'max-content', width: '100%' }}>
                          {diffLines.map((line, idx) => renderSplitLine(line as any, idx))}
                        </div>
                      </div>
                      <div
                        ref={scrollBRef}
                        onScroll={(e) => handleScrollSync(e, 'B')}
                        onMouseLeave={clearScrollActive}
                        style={{ flex: 1, overflow: 'auto' }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 'max-content', width: '100%' }}>
                          {diffLines.map((line, idx) => renderSplitLine(line as any, idx))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Unified Show All */
                    <div
                      ref={unifiedScrollRef}
                      style={{ flex: 1, overflow: 'auto' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 'max-content', width: '100%' }}>
                        {diffLines.map((line, idx) => renderUnifiedLine(line as any, idx))}
                      </div>
                    </div>
                  )
                ) : (
                  /* Hunks Context view */
                  <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                    {hunks.length > 0 ? (
                      hunks.map((hunk, hIdx) => {
                        const isNavigatedHunk = currentChangeIndex === hIdx
                        return (
                          <div
                            id={`diff-hunk-${hIdx}`}
                            key={hIdx}
                            style={{
                              border: isNavigatedHunk ? '1px solid var(--accent)' : '1px solid transparent',
                              margin: '8px 12px',
                              borderRadius: 6,
                              overflow: 'hidden',
                              background: 'rgba(0,0,0,0.1)'
                            }}
                          >
                            {/* Hunk Header */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: 'var(--surface-2)',
                              color: 'var(--accent-2)',
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 11,
                              padding: '6px 12px',
                              borderBottom: '1px solid var(--border)'
                            }}>
                              <span>@@ -{hunk.startA},{hunk.linesA.length} +{hunk.startB},{hunk.linesB.length} @@</span>
                              <span style={{ fontSize: 9,  opacity: 0.7 }}>Context: {hunk.context}</span>
                            </div>
                            
                            {/* Hunk contents */}
                            <div>
                              {viewMode === 'split' ? (
                                // For split view in hunk, align hunk.linesA and hunk.linesB
                                // To align them perfectly, we pad them to same length
                                Array.from({ length: Math.max(hunk.linesA.length, hunk.linesB.length) }).map((_, idx) => {
                                  const lineA = hunk.linesA[idx]
                                  const lineB = hunk.linesB[idx]
                                  
                                  // Re-align line representation
                                  const dummyLine: DiffLine = {
                                    type: lineA?.type !== 'UNCHANGED' ? lineA?.type : lineB?.type,
                                    lineA: lineA?.lineA ?? null,
                                    lineB: lineB?.lineB ?? null,
                                    valueA: lineA?.value || lineA?.valueA,
                                    valueB: lineB?.value || lineB?.valueB,
                                    charDiffA: (lineA as any)?.charDiff || lineA?.charDiffA,
                                    charDiffB: (lineB as any)?.charDiff || lineB?.charDiffB
                                  }

                                  if (lineA?.type === 'UNCHANGED' && lineB?.type === 'UNCHANGED') {
                                    dummyLine.type = 'UNCHANGED'
                                    dummyLine.value = lineA.value
                                  }

                                  return renderSplitLine(dummyLine, idx)
                                })
                              ) : (
                                // Unified view: render linesA then linesB, or aligned
                                hunk.linesA.map((line, idx) => {
                                  // Pad type
                                  const dummy: DiffLine = {
                                    ...line,
                                    valueA: line.value || line.valueA,
                                    valueB: line.value || line.valueB,
                                    charDiffA: (line as any).charDiff || line.charDiffA,
                                    charDiffB: (line as any).charDiff || line.charDiffB
                                  }
                                  return renderUnifiedLine(dummy, idx)
                                })
                              )}
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        No changes detected in selected context range.
                      </div>
                    )}
                  </div>
                )}

                {/* Minimap scrollbar layout */}
                {renderMinimapTicks()}
              </div>

            </div>
          </MaybeResizable>

          {/* AI Semantic report section */}
          {analysisResult && (
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 24
            }}>
              <h2 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} style={{ color: 'var(--accent)' }} /> AI Verification Report
              </h2>
              <AIAnalysisPanel
                analysis={analysisResult}
                onJumpToLine={(lineNum) => {
                  if (contextLines !== 'all') {
                    setContextLines('all')
                  }
                  // Find index of line in diffLines
                  const targetIdx = diffLines.findIndex(l => l.lineA === lineNum || l.lineB === lineNum)
                  if (targetIdx !== -1) {
                    // Navigate block
                    const targetBlock = changeIndices.findIndex(idx => idx >= targetIdx)
                    scrollToTarget(targetBlock !== -1 ? targetBlock : 0)
                  }
                }}
              />
            </div>
          )}

        </div>
      )}

    </div>
  )
}
