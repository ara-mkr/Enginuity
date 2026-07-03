import { useState, useRef, useCallback } from 'react'
import {
  FileText,
  Tag,
  Upload,
  X,
  Loader2,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  Cpu,
  Database,
  Trash2,
} from 'lucide-react'
import { useProject } from '../../context/ProjectContext'
import { useAIProvider } from '../../hooks/useAIProvider'
import { extractText } from './fileParser'
import type { ProjectFile } from '../../context/ProjectContext'

const MAX_DESC = 2000
const ACCEPTED = ['.txt', '.md', '.pdf']

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function Panel({
  title,
  icon: Icon,
  children,
  className = '',
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-xl border flex flex-col ${className}`}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <header
        className="flex items-center gap-2 px-4 py-3 border-b text-xs font-mono uppercase tracking-widest"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      >
        <Icon size={13} style={{ color: 'var(--accent)' }} />
        {title}
      </header>
      <div className="flex-1 p-4">{children}</div>
    </section>
  )
}

// ─── Tags input ──────────────────────────────────────────────────────────────

function TagsInput() {
  const { tags, setTags } = useProject()
  const [input, setInput] = useState('')

  function commit() {
    const trimmed = input.trim().replace(/,+$/, '')
    if (!trimmed) return
    const newTags = trimmed
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const merged = Array.from(new Set([...tags, ...newTags]))
    setTags(merged)
    setInput('')
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    }
    if (e.key === 'Backspace' && !input && tags.length) {
      setTags(tags.slice(0, -1))
    }
  }

  function remove(tag: string) {
    setTags(tags.filter((t) => t !== tag))
  }

  return (
    <div
      className="min-h-[44px] w-full flex flex-wrap gap-1.5 px-3 py-2 rounded-lg border cursor-text transition-colors"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
      onClick={() => document.getElementById('tag-input')?.focus()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono"
          style={{ background: 'rgba(0,200,255,0.1)', color: 'var(--accent)' }}
        >
          {tag}
          <button
            onClick={(e) => { e.stopPropagation(); remove(tag) }}
            className="opacity-60 hover:opacity-100 transition-opacity"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        id="tag-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={commit}
        placeholder={tags.length ? '' : 'ESP32, brushless motor, 3D printing…'}
        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
        style={{ color: 'var(--text)' }}
      />
    </div>
  )
}

// ─── File drop zone ──────────────────────────────────────────────────────────

function DropZone() {
  const { files, addFile, removeFile } = useProject()
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function processFile(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (!ext || !ACCEPTED.includes(`.${ext}`)) {
      setError(`Unsupported file type: .${ext}. Use .txt, .md, or .pdf`)
      return
    }
    setError(null)
    setParsing(f.name)
    try {
      const content = await extractText(f)
      const projectFile: ProjectFile = {
        name: f.name,
        content,
        size: f.size,
        addedAt: Date.now(),
      }
      addFile(projectFile)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse file')
    } finally {
      setParsing(null)
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    for (const f of droppedFiles) await processFile(f)
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    for (const f of picked) await processFile(f)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer py-8 transition-all"
        style={{
          borderColor: dragging ? 'var(--accent)' : 'var(--border)',
          background: dragging ? 'rgba(0,200,255,0.04)' : 'var(--bg)',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".txt,.md,.pdf"
          className="hidden"
          onChange={handleChange}
        />
        {parsing ? (
          <Loader2 size={22} className="animate-spin" style={{ color: 'var(--accent)' }} />
        ) : (
          <Upload size={22} style={{ color: dragging ? 'var(--accent)' : 'var(--text-muted)' }} />
        )}
        <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
          {parsing
            ? `Parsing ${parsing}…`
            : 'Drop .txt, .md, or .pdf files here, or click to browse'}
        </p>
      </div>

      {error && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: 'rgba(255,80,80,0.1)', color: '#b08080' }}
        >
          <AlertTriangle size={13} />
          {error}
        </div>
      )}

      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((f) => (
            <li
              key={f.name}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
            >
              <FileText size={13} style={{ color: 'var(--accent-2)', flexShrink: 0 }} />
              <span className="flex-1 truncate font-mono" style={{ color: 'var(--text)' }}>
                {f.name}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>{fmt(f.size)}</span>
              <button
                onClick={() => removeFile(f.name)}
                className="ml-1 opacity-50 hover:opacity-100 transition-opacity"
                style={{ color: 'var(--text-muted)' }}
                aria-label={`Remove ${f.name}`}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Context card ─────────────────────────────────────────────────────────────

function ContextCard() {
  const { description, tags, files } = useProject()
  const charCount = description.length + tags.join(' ').length + files.reduce((a, f) => a + f.content.length, 0)
  const empty = !description && !tags.length && !files.length

  return (
    <div className="flex flex-col gap-3">
      {empty ? (
        <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
          No context stored yet. Fill in the fields to the left.
        </p>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Description', value: `${description.length} ch` },
              { label: 'Tags', value: tags.length },
              { label: 'Files', value: files.length },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center rounded-lg py-3 border text-center"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
              >
                <span className="text-lg font-bold font-mono" style={{ color: 'var(--accent)' }}>
                  {value}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Description preview */}
          {description && (
            <div>
              <p className="text-xs font-mono mb-1" style={{ color: 'var(--text-muted)' }}>DESCRIPTION PREVIEW</p>
              <p
                className="text-xs leading-relaxed line-clamp-4"
                style={{ color: 'var(--text)' }}
              >
                {description}
              </p>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <p className="text-xs font-mono mb-1" style={{ color: 'var(--text-muted)' }}>COMPONENTS</p>
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="text-xs px-2 py-0.5 rounded-md font-mono"
                    style={{ background: 'rgba(0,200,255,0.08)', color: 'var(--accent-2)' }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {files.length > 0 && (
            <div>
              <p className="text-xs font-mono mb-1" style={{ color: 'var(--text-muted)' }}>ATTACHED FILES</p>
              {files.map((f) => (
                <div
                  key={f.name}
                  className="flex items-center gap-1.5 text-xs mb-1"
                  style={{ color: 'var(--text)' }}
                >
                  <FileText size={11} style={{ color: 'var(--text-muted)' }} />
                  <span className="font-mono truncate">{f.name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>— {fmt(f.size)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
              Total context: ~{(charCount / 4).toFixed(0)} tokens
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Summary card ─────────────────────────────────────────────────────────────

interface SummaryResult {
  building: string
  challenges: string[]
  nextSteps: string[]
}

function parseSummary(raw: string): SummaryResult {
  const building = raw.match(/BUILDING[:\s]+([\s\S]+?)(?=CHALLENGES|NEXT STEPS|$)/i)?.[1]?.trim() ?? raw
  const challenges = [...raw.matchAll(/[-•]\s*(.+)/gm)].slice(0, 5).map((m) => m[1].trim())
  const nextSteps = [...raw.matchAll(/\d+\.\s*(.+)/gm)].slice(0, 3).map((m) => m[1].trim())

  return {
    building: building.replace(/BUILDING[:\s]+/i, '').substring(0, 400),
    challenges: challenges.length ? challenges : ['See full output below.'],
    nextSteps: nextSteps.length ? nextSteps : raw.split('\n').filter(Boolean).slice(-3),
  }
}

function SummaryCard({ result, raw }: { result: SummaryResult; raw: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="rounded-xl border mt-6"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <header
        className="flex items-center gap-2 px-4 py-3 border-b text-xs font-mono uppercase tracking-widest"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      >
        <Sparkles size={13} style={{ color: 'var(--accent)' }} />
        AI Project Summary
      </header>

      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* What you're building */}
        <div
          className="md:col-span-3 rounded-lg p-3 border"
          style={{ background: 'rgba(0,200,255,0.04)', borderColor: 'rgba(0,200,255,0.15)' }}
        >
          <p className="text-xs font-mono mb-1" style={{ color: 'var(--accent-2)' }}>
            WHAT YOU'RE BUILDING
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
            {result.building}
          </p>
        </div>

        {/* Challenges */}
        <div className="md:col-span-1">
          <p className="text-xs font-mono mb-2" style={{ color: 'var(--text-muted)' }}>
            KEY CHALLENGES
          </p>
          <ul className="flex flex-col gap-1.5">
            {result.challenges.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text)' }}>
                <AlertTriangle size={11} className="mt-0.5 shrink-0" style={{ color: '#b09060' }} />
                {c}
              </li>
            ))}
          </ul>
        </div>

        {/* Next steps */}
        <div className="md:col-span-2">
          <p className="text-xs font-mono mb-2" style={{ color: 'var(--text-muted)' }}>
            SUGGESTED NEXT STEPS
          </p>
          <ol className="flex flex-col gap-2">
            {result.nextSteps.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text)' }}>
                <span
                  className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold font-mono"
                  style={{ background: 'rgba(0,200,255,0.12)', color: 'var(--accent)' }}
                >
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Raw toggle */}
      <div className="px-4 pb-4">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronRight
            size={13}
            className="transition-transform"
            style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
          />
          {expanded ? 'Hide' : 'Show'} raw output
        </button>
        {expanded && (
          <pre
            className="mt-2 text-xs leading-relaxed whitespace-pre-wrap rounded-lg p-3 overflow-auto max-h-64"
            style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}
          >
            {raw}
          </pre>
        )}
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function Dashboard() {
  const { description, setDescription, tags, files, clearContext } = useProject()
  const { makeRequest, isConnected } = useAIProvider()

  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [summaryRaw, setSummaryRaw] = useState<string | null>(null)
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null)

  const contextEmpty = !description && !tags.length && !files.length

  const generate = useCallback(async () => {
    if (!isConnected) {
      setGenError('No AI provider connected. Click "Connect Key" in the banner above.')
      return
    }
    if (contextEmpty) {
      setGenError('Add some context first — description, tags, or files.')
      return
    }

    setGenerating(true)
    setGenError(null)
    setSummaryRaw(null)
    setSummaryResult(null)

    try {
      const contextBlob = [
        description && `PROJECT DESCRIPTION:\n${description}`,
        tags.length && `COMPONENTS / SKILLS: ${tags.join(', ')}`,
        ...files.map((f) => `FILE: ${f.name}\n${f.content.substring(0, 4000)}`),
      ]
        .filter(Boolean)
        .join('\n\n---\n\n')

      const text = await makeRequest(
        [
          {
            role: 'user',
            content: `Here is my project context:\n\n${contextBlob}\n\nPlease generate a structured project summary.`,
          },
        ],
        'You are a senior engineering assistant. Analyze the project context and respond with exactly three sections:\n\nBUILDING: [One paragraph describing what is being built and its purpose]\n\nCHALLENGES:\n- [Key challenge 1]\n- [Key challenge 2]\n- [Key challenge 3]\n\nNEXT STEPS:\n1. [Concrete next step]\n2. [Concrete next step]\n3. [Concrete next step]\n\nBe specific, technical, and concise.',
        { maxTokens: 1024, stream: false, module: 'dashboard' }
      )
      setSummaryRaw(text)
      setSummaryResult(parseSummary(text))
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }, [makeRequest, isConnected, contextEmpty, description, tags, files])

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          <h1
            className="text-lg font-bold font-mono tracking-wide"
            style={{ color: 'var(--text)' }}
          >
            Project Brain
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Persistent context store — all modules read from here
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!contextEmpty && (
            <button
              onClick={clearContext}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors hover:border-red-500/40 hover:text-red-400"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              <Trash2 size={12} />
              Clear context
            </button>
          )}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-mono"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--surface)' }}
          >
            <Database size={12} style={{ color: 'var(--accent)' }} />
            localStorage
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-5 gap-4 content-start">
        {/* Left column — inputs */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Description */}
          <Panel title="Project Description" icon={Cpu}>
            <div className="relative">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESC))}
                rows={7}
                placeholder="Describe what you are building — purpose, scope, constraints, target users…"
                className="w-full resize-none rounded-lg px-3 py-2.5 text-sm leading-relaxed outline-none border transition-colors font-sans"
                style={{
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  borderColor: 'var(--border)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-2)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
              <span
                className="absolute bottom-3 right-3 text-xs font-mono pointer-events-none"
                style={{
                  color:
                    description.length > MAX_DESC * 0.9
                      ? '#b09060'
                      : 'var(--text-muted)',
                }}
              >
                {description.length}/{MAX_DESC}
              </span>
            </div>
          </Panel>

          {/* Tags */}
          <Panel title="Components / Skills" icon={Tag}>
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              Press Enter or comma to add. Backspace to remove.
            </p>
            <TagsInput />
          </Panel>

          {/* File drop */}
          <Panel title="Reference Files" icon={Upload}>
            <DropZone />
          </Panel>
        </div>

        {/* Right column — live context */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Panel title="Project Context" icon={Database} className="flex-1">
            <ContextCard />
          </Panel>
        </div>
      </div>

      {/* Generate bar */}
      <div
        className="shrink-0 px-6 py-4 border-t flex flex-col gap-3"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        {genError && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
            style={{ background: 'rgba(255,80,80,0.1)', color: '#b08080' }}
          >
            <AlertTriangle size={13} />
            {genError}
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            onClick={generate}
            disabled={generating || contextEmpty}
            className="relative flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold font-mono transition-all disabled:opacity-40 overflow-hidden"
            style={{
              background: generating ? 'transparent' : 'var(--accent)',
              color: generating ? 'var(--accent)' : 'var(--bg)',
              border: generating ? '1px solid var(--accent)' : '1px solid transparent',
            }}
          >
            {generating ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Generate Project Summary
              </>
            )}
          </button>

          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Calls{' '}
            <span className="font-mono" style={{ color: 'var(--text)' }}>
              claude-sonnet-4-20250514
            </span>{' '}
            with your stored context
          </p>
        </div>
      </div>

      {/* Result */}
      {summaryResult && summaryRaw && (
        <div className="px-6 pb-8">
          <SummaryCard result={summaryResult} raw={summaryRaw} />
        </div>
      )}

    </div>
  )
}
