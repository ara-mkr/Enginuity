import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Image,
  Hexagon,
  Sparkles,
  Loader2,
  Download,
  Copy,
  RefreshCw,
  Check,
  AlertTriangle,
  Clock,
  MessagesSquare,
  Send,
  Wand2,
  X,
  DollarSign,
} from 'lucide-react'
import { useOpenRouter } from '../../context/OpenRouterContext'
import { useAIProvider } from '../../hooks/useAIProvider'
import { useProbeContext } from '../../hooks/useProbeContext'
import { useProjectContext } from '../../hooks/useProjectContext'
import { logEvent } from '../../engine/eventLog'
// @ts-ignore
import { useEnginguityStore } from '../../engine/persistenceEngine'
// @ts-ignore
import { blobStore } from '../../engine/blobStore'

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'banner' | 'logo' | 'diagram' | 'brainstorm'

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts: number
  imagePrompt?: string
  imageUrl?: string
}

// OpenRouter image-capable model. Google's gemini-2.5-flash-image-preview is
// the "nano-banana" model. ~$0.039 per 1024x1024 image as of 2026-01.
const IMAGE_MODEL_ID = 'google/gemini-2.5-flash-image-preview'
const IMAGE_MODEL_LABEL = 'Gemini 2.5 Flash Image (nano-banana)'
const IMAGE_COST_PER_IMAGE = 0.04

type BannerStyle = 'minimal' | 'technical' | 'bold' | 'retro-terminal'

interface HistoryEntry {
  id: string
  mode: Mode
  svg: string
  label: string
  ts: number
}

// ─── System prompts ───────────────────────────────────────────────────────────

const SVG_SYSTEM = `You are an SVG engineer. Return ONLY raw SVG code starting with <svg. No markdown fences, no explanation, no comments outside the SVG, no prose. The SVG must be self-contained with all styles inline.`

function bannerPrompt(name: string, tagline: string, style: BannerStyle, seed: string, customStyle?: string): string {
  const styleGuides: Record<BannerStyle, string> = {
    minimal: 'Clean monochrome, lots of white space, thin lines, small geometric accent, sans-serif type. Colors: near-black background #0a0a0f, white text, single accent line in #7ab4c4.',
    technical: 'Dark engineering aesthetic. Grid lines, tick marks, dimension arrows, circuit-trace decorations. Colors: #0a0a0f bg, #e8e8f0 text, #7ab4c4 accent details.',
    bold: 'High contrast. Large bold typography. Diagonal slash accent. Strong color blocks. Colors: #0a0a0f bg, large #7ab4c4 accent shape, white text.',
    'retro-terminal': 'Green-on-black CRT terminal aesthetic. Monospace font simulation, scanline hints, cursor blink rectangle, blurred glow on text. Colors: #000 bg, #7ab4c4 text, #003300 secondary.',
  }
  const styleLine = customStyle?.trim()
    ? customStyle.trim()
    : styleGuides[style]

  return `Create an SVG banner exactly 800px wide by 200px tall.
Project name: "${name}"
Tagline: "${tagline}"
Style: ${styleLine}
Seed variation: ${seed}

The SVG must:
- Be exactly viewBox="0 0 800 200" with width="800" height="200"
- Use only geometric shapes, lines, and SVG text — no images, no foreign objects
- Simulate fonts by describing them in style attributes (font-family="monospace" or "sans-serif")
- Be visually impressive and polished
- Have rich detail: decorative elements, subtle patterns, geometric accents`
}

function logoPrompt(name: string, vibe: string, seed: string, customStyle?: string): string {
  const vibeMap: Record<string, string> = {
    fast: 'Dynamic. Angular, forward-leaning geometry. Sharp triangles, velocity lines. Colors: #7ab4c4 on #0a0a0f.',
    precise: 'Precise. Interlocking circles, fine grid lines, crosshairs, measurement marks. Colors: #60a5fa on #0a0a0f.',
    powerful: 'Bold. Thick geometric forms, overlapping shapes with opacity, strong diagonals. Colors: #b09060 on #0a0a0f.',
    minimal: 'Minimal. Single clean geometric form, maximum negative space. Colors: #e8e8f0 on #0a0a0f.',
  }
  const vibeLine = customStyle?.trim()
    ? customStyle.trim()
    : (vibeMap[vibe] ?? vibeMap.minimal)

  return `Create an SVG logomark exactly 200px by 200px. Abstract geometric design — no text.
Project name hint: "${name}" (use this only for conceptual inspiration, not text rendering)
Vibe: ${vibeLine}
Seed variation: ${seed}

The SVG must:
- Be exactly viewBox="0 0 200 200" with width="200" height="200"
- Contain ONLY geometric shapes — no text, no SVG <text> elements
- Be rotationally or reflectionally balanced
- Be intricate, layered, professional
- Use opacity and transforms for depth`
}

function diagramPrompt(description: string, seed: string): string {
  return `Create an SVG graphic, illustration, or diagram described as: "${description}"
Seed variation: ${seed}

The SVG must:
- Be exactly viewBox="0 0 800 500" with width="800" height="500"
- Be visually appealing, creative, and professional. It can be a vector illustration, a diagram, an icon, a custom shape, or any creative graphic.
- Use a rich color palette suitable for a dark modern workspace (background color should be dark, e.g. #0a0a0f or #080808)
- Be self-contained, clean, and fully styled
- Include clean labels or titles if appropriate`
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 8)
}

function sanitizeSVG(raw: string): string {
  // Strip everything before the first <svg
  const idx = raw.indexOf('<svg')
  if (idx === -1) return raw
  return raw.slice(idx)
}

function modeLabel(m: Mode): string {
  if (m === 'banner') return 'Project Banner'
  if (m === 'logo') return 'Logo Concept'
  if (m === 'diagram') return 'Custom Graphic'
  return 'Brainstorm'
}

// Heuristic — detect when the assistant has surfaced an image prompt that the
// user could feed to nano-banana, higgsfield, etc. We extract the content of
// fenced ```prompt blocks or "Prompt:" sections so the user can one-click run it.
function extractImagePrompt(text: string): string | null {
  // Fenced ```prompt ... ``` or ```image ... ``` block
  const fenced = text.match(/```(?:prompt|image|imagegen|gen)\s*\n([\s\S]+?)```/i)
  if (fenced) return fenced[1].trim()
  // "Prompt:" line followed by content until next blank line or heading
  const labeled = text.match(/(?:^|\n)\s*(?:\*\*)?Prompt(?:\*\*)?\s*[:\-—]\s*\n?([\s\S]+?)(?=\n\s*\n|\n\s*(?:#|\*\*|$))/i)
  if (labeled) return labeled[1].trim().replace(/^["']|["']$/g, '')
  return null
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function Tab({ label, icon: Icon, active, onClick }: {
  label: string
  icon: React.ElementType
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 text-sm font-mono border-b-2 transition-all"
      style={{
        borderBottomColor: active ? 'var(--accent)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
      }}
    >
      <Icon size={14} />
      {label}
    </button>
  )
}

// ─── Style pill ───────────────────────────────────────────────────────────────

function StylePill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-mono border transition-all"
      style={
        active
          ? { background: 'rgba(0,200,255,0.10)', borderColor: 'var(--accent)', color: 'var(--accent)' }
          : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-muted)' }
      }
    >
      {label}
    </button>
  )
}

// ─── History thumbnail ────────────────────────────────────────────────────────

function HistoryThumb({
  entry,
  active,
  onClick,
}: {
  entry: HistoryEntry
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-1.5 rounded-lg border overflow-hidden transition-all text-left w-full"
      style={{
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        background: active ? 'rgba(0,200,255,0.04)' : 'var(--bg)',
      }}
    >
      <div
        className="w-full overflow-hidden flex items-center justify-center"
        style={{ background: '#000', height: 64 }}
        dangerouslySetInnerHTML={{ __html: scaleSvg(entry.svg, entry.mode) }}
      />
      <div className="px-2 pb-2">
        <p className="text-xs font-mono truncate" style={{ color: 'var(--text)' }}>
          {entry.label}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {new Date(entry.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </button>
  )
}

// ─── Inspiration chip data ────────────────────────────────────────────────────

const BANNER_INSPIRATION = [
  'Minimalist white space, thin lines, no decoration',
  'Retro oscilloscope green on black, CRT aesthetic',
  'Blueprint technical drawing, white on navy blue',
  'Industrial metal plate, embossed text, dark steel',
  'Clean startup SaaS, modern sans-serif, light and airy',
  'Japanese tech aesthetic, kanji accents, precision',
  'Brutalist web, high contrast, bold geometry',
  'Cyberpunk neon, dark background, glitch effects',
]

const LOGO_INSPIRATION = [
  'Geometric monogram, two interlocking shapes, single accent color',
  'Abstract rotational symbol, three-fold symmetry, technical',
  'Minimal mark inspired by a circuit trace, sharp corners',
  'Concentric circles with measurement ticks, instrument feel',
  'Negative-space letterform hidden in geometry',
  'Hexagonal token, layered opacity, depth',
]

const DIAGRAM_INSPIRATION = [
  'System architecture with API, database, and frontend',
  'Signal flow from sensor to microcontroller to display',
  'Power supply stages: input → regulation → output',
  'I2C bus with master and three peripheral devices',
  'PID control loop block diagram',
]

// ─── Custom-style block ──────────────────────────────────────────────────────

function CustomStyleBlock({
  value,
  onChange,
  placeholder,
  chips,
  onChip,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  chips: string[]
  onChip: (text: string) => void
}) {
  const [chipsOpen, setChipsOpen] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label className="block text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
        Custom style description
      </label>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-none rounded-lg px-3 py-2 text-sm font-sans outline-none border transition-colors"
        style={{ background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--border)' }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-2)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
      />
      <button
        type="button"
        onClick={() => setChipsOpen((v) => !v)}
        className="self-start text-[11px] font-mono underline-offset-2 hover:underline"
        style={{ color: 'var(--text-muted)' }}
      >
        {chipsOpen ? '− Hide style inspiration' : '+ Style inspiration'}
      </button>
      {chipsOpen && <ChipRow chips={chips} onChip={onChip} />}
    </div>
  )
}

function ChipRow({ chips, onChip }: { chips: string[]; onChip: (text: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChip(c)}
          className="px-2 py-1 rounded-md text-[11px] font-sans border transition-all hover:opacity-90"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg)' }}
        >
          {c}
        </button>
      ))}
    </div>
  )
}

function scaleSvg(svg: string, mode: Mode): string {
  // For thumbnail: override width/height to fit the container
  const thumbW = 220
  const thumbH = 60
  const srcW = mode === 'logo' ? 200 : 800
  const srcH = mode === 'logo' ? 200 : mode === 'diagram' ? 500 : 200
  return svg
    .replace(/width="[^"]*"/, `width="${thumbW}"`)
    .replace(/height="[^"]*"/, `height="${thumbH}"`)
    .replace(/viewBox="[^"]*"/, `viewBox="0 0 ${srcW} ${srcH}" preserveAspectRatio="xMidYMid meet"`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AssetGenerator() {
  const { apiKey } = useOpenRouter()
  const { makeRequest, isConnected, activeModel } = useAIProvider()
  const { description, tags } = useProjectContext()

  // ── Global store hookups ─────────────────────────────────────────────────
  const addAssetGenResult = useEnginguityStore((s: any) => s.addAssetGenResult)
  const addToFileHistory = useEnginguityStore((s: any) => s.addToFileHistory)
  const addChatMessage = useEnginguityStore((s: any) => s.addChatMessage)
  const replaceChatHistory = useEnginguityStore((s: any) => s.replaceChatHistory)
  const persistedBrainstormMessages = useEnginguityStore(
    (s: any) => s.moduleChats['asset-generator-brainstorm']?.messages || [],
  )

  const [mode, setMode] = useState<Mode>('banner')
  const [bannerStyle, setBannerStyle] = useState<BannerStyle | null>('technical')
  const [vibe, setVibe] = useState<'fast' | 'precise' | 'powerful' | 'minimal' | null>('precise')
  const [customStyleBanner, setCustomStyleBanner] = useState('')
  const [customStyleLogo, setCustomStyleLogo] = useState('')

  // Auto-derive from project context
  const defaultName = tags[0] ?? 'My Project'
  const [projectName, setProjectName] = useState(defaultName)
  const [tagline, setTagline] = useState(description.slice(0, 80) || 'Engineering redefined.')
  const [diagramDesc, setDiagramDesc] = useState(
    description
      ? `A custom graphic or diagram for this project: ${description.slice(0, 120)}`
      : ''
  )

  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [currentSvg, setCurrentSvg] = useState<string | null>(null)
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [copied, setCopied] = useState(false)
  const seedRef = useRef(randomSeed())

  useProbeContext('asset-generator', {
    mode,
    projectName,
    generating,
    hasResult: !!currentSvg,
    historyCount: history.length,
    lastError: genError,
  })

  // Load persistent history (full SVGs) from IndexedDB on mount.
  useEffect(() => {
    let cancelled = false
    blobStore.getAll('asset-gen').then((items: any[]) => {
      if (cancelled || !items?.length) return
      const entries: HistoryEntry[] = items
        .filter((i) => i?.content && i?.mode)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 50)
        .map((i) => ({
          id: i.id,
          mode: i.mode,
          svg: i.content,
          label: i.label || i.name || 'Asset',
          ts: i.createdAt || i.savedAt || Date.now(),
        }))
      setHistory(entries)
    }).catch(() => { /* ignore — empty DB */ })
    return () => { cancelled = true }
  }, [])

  // ── Brainstorm chatbot state ──────────────────────────────────────────────
  // Messages live in the global store so they survive navigation. We mirror
  // them into local state for the existing render code.
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>(persistedBrainstormMessages)
  // Keep local mirror in sync if another tab/window updates the store.
  useEffect(() => {
    setChatMessages(persistedBrainstormMessages)
  }, [persistedBrainstormMessages])
  const [chatInput, setChatInput] = useState('')
  const [chatThinking, setChatThinking] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [confirmImageGen, setConfirmImageGen] = useState<{ prompt: string; sourceMsgId: string } | null>(null)
  const [imageGenLoading, setImageGenLoading] = useState(false)

  // Write-through helper: updates local mirror AND persists to the global store
  // so brainstorm messages survive navigation/refresh.
  const commitChatMessages = useCallback(
    (next: ChatMsg[] | ((prev: ChatMsg[]) => ChatMsg[])) => {
      setChatMessages((prev) => {
        const value = typeof next === 'function' ? (next as (p: ChatMsg[]) => ChatMsg[])(prev) : next
        replaceChatHistory('asset-generator-brainstorm', value)
        return value
      })
    },
    [replaceChatHistory],
  )

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chatMessages.length, chatThinking])

  const BRAINSTORM_SYSTEM = `You are the ENGINGUITY Brand & Visual Content Assistant. You ONLY help with visual content for engineering projects: logos, banners, color palettes, typography pairings, mood boards, icon ideas, illustration concepts, and writing prompts for external image/video AI tools (nano-banana, Higgsfield, Kling, Seedance, Midjourney, etc.).

STRICT BOUNDARIES — never answer anything else. If the user asks about code, math, circuits, BOM, simulation, or any non-content topic, politely refuse in one short sentence and steer them back to content.

Project context the user is working on:
- Name: ${projectName || '(unspecified)'}
- Description: ${description || '(none yet)'}
- Tags: ${tags.length ? tags.join(', ') : '(none)'}

Response style:
- Be concrete. Give 2–4 distinct directions instead of one. Use short bullets, not walls of text.
- For color palettes, give hex codes (5 swatches with role labels like primary/accent/bg).
- For typography, give 2 real font names and their pairing rationale.
- When the user asks for an image/banner/logo/illustration generation, OUTPUT a ready-to-paste prompt inside a fenced code block tagged \`\`\`prompt ... \`\`\`. Make the prompt richly detailed (style, palette, composition, mood, aspect ratio). The UI will detect that block and offer the user a one-click button to actually generate it.
- Never invent costs. Never claim to have generated an image yourself — only the user pressing the confirm button does that.`

  const sendChat = useCallback(async () => {
    const text = chatInput.trim()
    if (!text || chatThinking) return
    if (!isConnected) {
      setChatError('No model connected — open AI Settings and pick OpenRouter or Ollama.')
      return
    }
    setChatError(null)

    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: 'user', content: text, ts: Date.now() }
    const history = [...chatMessages, userMsg]
    commitChatMessages(history)
    setChatInput('')
    setChatThinking(true)

    try {
      const apiMessages = history.map((m) => ({ role: m.role, content: m.content }))
      const reply = await makeRequest(apiMessages, BRAINSTORM_SYSTEM, {
        module: 'asset-generator/brainstorm',
        maxTokens: 1200,
        temperature: 0.8,
        stream: false,
      })
      const imagePrompt = extractImagePrompt(reply)
      const assistantMsg: ChatMsg = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: reply,
        ts: Date.now(),
        imagePrompt: imagePrompt ?? undefined,
      }
      commitChatMessages((prev) => [...prev, assistantMsg])
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'Chat failed')
    } finally {
      setChatThinking(false)
    }
  }, [chatInput, chatThinking, isConnected, chatMessages, makeRequest, BRAINSTORM_SYSTEM, commitChatMessages])

  // ── OpenRouter image generation (nano-banana via gemini-2.5-flash-image) ──
  const runImageGen = useCallback(async () => {
    if (!confirmImageGen) return
    if (!apiKey) {
      setChatError('Image generation needs an OpenRouter API key. Add one in AI Settings.')
      setConfirmImageGen(null)
      return
    }
    const { prompt, sourceMsgId } = confirmImageGen
    setConfirmImageGen(null)
    setImageGenLoading(true)
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://enginguity.app',
          'X-Title': 'ENGINGUITY',
        },
        body: JSON.stringify({
          model: IMAGE_MODEL_ID,
          modalities: ['image', 'text'],
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        const errMsg = (errJson as { error?: { message?: string } })?.error?.message
        throw new Error(errMsg ?? `HTTP ${res.status}`)
      }
      const data = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string
            images?: Array<{ image_url?: { url?: string } | string }>
          }
        }>
      }
      const msg = data.choices?.[0]?.message
      let url: string | null = null
      const img = msg?.images?.[0]
      if (img) {
        if (typeof img.image_url === 'string') url = img.image_url
        else if (img.image_url?.url) url = img.image_url.url
      }
      if (!url) throw new Error('Model returned no image. Try a more visual prompt.')

      commitChatMessages((prev) =>
        prev.map((m) => (m.id === sourceMsgId ? { ...m, imageUrl: url! } : m)),
      )
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'Image generation failed')
    } finally {
      setImageGenLoading(false)
    }
  }, [confirmImageGen, apiKey, commitChatMessages])

  const generate = useCallback(async (newSeed?: string) => {
    if (!isConnected) {
      setGenError('No model connected — open AI Settings and pick OpenRouter or Ollama.')
      return
    }

    const seed = newSeed ?? seedRef.current

    let userMsg = ''
    let promptForRecord = ''
    let styleForRecord = ''
    if (mode === 'banner') {
      if (!projectName.trim()) { setGenError('Enter a project name.'); return }
      const cs = customStyleBanner.trim()
      userMsg = bannerPrompt(projectName, tagline, bannerStyle || 'technical', seed, cs || undefined)
      promptForRecord = `${projectName} — ${tagline}`
      styleForRecord = cs || (bannerStyle ?? '')
    } else if (mode === 'logo') {
      if (!projectName.trim()) { setGenError('Enter a project name.'); return }
      const cs = customStyleLogo.trim()
      userMsg = logoPrompt(projectName, vibe || 'minimal', seed, cs || undefined)
      promptForRecord = `${projectName} logo`
      styleForRecord = cs || (vibe ?? '')
    } else if (mode === 'diagram') {
      if (!diagramDesc.trim()) { setGenError('Describe what to generate.'); return }
      userMsg = diagramPrompt(diagramDesc, seed)
      promptForRecord = diagramDesc
      styleForRecord = 'diagram'
    } else {
      return
    }

    setGenerating(true)
    setGenError(null)

    try {
      const raw = await makeRequest(
        [{ role: 'user', content: userMsg }],
        SVG_SYSTEM,
        { module: 'asset-generator', maxTokens: 4096, temperature: 0.7, stream: false },
      )
      const svg = sanitizeSVG(raw)

      if (!svg.startsWith('<svg')) {
        throw new Error('Model did not return valid SVG. Try a stronger model or rephrase.')
      }

      const id = crypto.randomUUID()
      const ts = Date.now()
      const label = mode === 'banner'
        ? projectName
        : mode === 'logo'
          ? `${projectName} logo`
          : diagramDesc.slice(0, 30)
      const entry: HistoryEntry = { id, mode, svg, label, ts }

      setCurrentSvg(svg)
      setActiveHistoryId(id)
      setHistory((prev) => [entry, ...prev].slice(0, 50))
      seedRef.current = randomSeed()
      logEvent('ASSET_GENERATED', { assetType: mode, label, module: 'asset-generator' })

      // Persist the full SVG to IndexedDB.
      try {
        await blobStore.save(id, {
          category: 'asset-gen',
          mode,
          name: `${mode}-${ts}.svg`,
          label,
          mimeType: 'image/svg+xml',
          content: svg,
          prompt: promptForRecord,
          style: styleForRecord,
          createdAt: ts,
        })
      } catch (saveErr) {
        console.warn('[asset-generator] blobStore.save failed', saveErr)
      }

      // Index the generation in the global store + universal file history.
      addAssetGenResult({
        id,
        type: mode,
        name: `${mode}-${ts}`,
        prompt: promptForRecord,
        style: styleForRecord,
        blobId: id,
        generatedAt: ts,
      })
      addToFileHistory({
        id,
        name: `${mode}-${new Date(ts).toISOString().slice(11, 19)}`,
        ext: 'svg',
        category: 'generated',
        sizeBytes: svg.length,
        blobId: id,
        sourceModule: 'asset-generator',
        prompt: promptForRecord,
        style: styleForRecord,
      })
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }, [
    isConnected, makeRequest, mode, projectName, tagline, bannerStyle, vibe,
    diagramDesc, customStyleBanner, customStyleLogo, addAssetGenResult, addToFileHistory,
  ])

  const regenerate = useCallback(() => {
    const newSeed = randomSeed()
    seedRef.current = newSeed
    generate(newSeed)
  }, [generate])

  const downloadSvg = useCallback(() => {
    if (!currentSvg) return
    const blob = new Blob([currentSvg], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `enginguity-${mode}-${Date.now()}.svg`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [currentSvg, mode])

  const copySvg = useCallback(async () => {
    if (!currentSvg) return
    try { await navigator.clipboard.writeText(currentSvg) } catch { /* ignore */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [currentSvg])

  const selectHistory = useCallback((entry: HistoryEntry) => {
    setCurrentSvg(entry.svg)
    setActiveHistoryId(entry.id)
  }, [])

  // ── Current preview dimensions ────────────────────────────────────────────
  const previewAspect = mode === 'logo' ? '1/1' : mode === 'diagram' ? '8/5' : '4/1'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div
        className="shrink-0 flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          <h1 className="text-lg font-bold font-mono tracking-wide" style={{ color: 'var(--text)' }}>
            Asset Generator
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            AI-generated SVG banners, logos &amp; custom graphics
          </p>
        </div>

        {currentSvg && (
          <div className="flex items-center gap-2">
            <button
              onClick={regenerate}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-mono transition-all disabled:opacity-40"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              <RefreshCw size={12} className={generating ? 'animate-spin' : ''} />
              Regenerate
            </button>
            <button
              onClick={copySvg}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-mono transition-all"
              style={{
                borderColor: copied ? 'var(--accent)' : 'var(--border)',
                color: copied ? 'var(--accent)' : 'var(--text-muted)',
                background: copied ? 'rgba(0,200,255,0.08)' : 'transparent',
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy SVG'}
            </button>
            <button
              onClick={downloadSvg}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-mono transition-all"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              <Download size={12} />
              Download SVG
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* ── Left: controls + preview ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mode tabs */}
          <div
            className="shrink-0 flex border-b"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <Tab label="Project Banner" icon={Image} active={mode === 'banner'} onClick={() => { setMode('banner'); setCurrentSvg(null) }} />
            <Tab label="Logo Concept" icon={Hexagon} active={mode === 'logo'} onClick={() => { setMode('logo'); setCurrentSvg(null) }} />
            <Tab label="Graphic Generator" icon={Sparkles} active={mode === 'diagram'} onClick={() => { setMode('diagram'); setCurrentSvg(null) }} />
            <Tab label="Brainstorm" icon={MessagesSquare} active={mode === 'brainstorm'} onClick={() => setMode('brainstorm')} />
          </div>

          {/* Inputs (hidden in brainstorm mode) */}
          {mode !== 'brainstorm' && (
          <div
            className="shrink-0 px-5 py-4 border-b flex flex-col gap-3"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            {(mode === 'banner' || mode === 'logo') && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-mono mb-1" style={{ color: 'var(--text-muted)' }}>
                    Project Name
                  </label>
                  <input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="My Engineering Project"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none border font-mono transition-colors"
                    style={{ background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--border)' }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-2)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                  />
                </div>
                {mode === 'banner' && (
                  <div className="flex-1">
                    <label className="block text-xs font-mono mb-1" style={{ color: 'var(--text-muted)' }}>
                      Tagline
                    </label>
                    <input
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder="Engineering redefined."
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none border font-sans transition-colors"
                      style={{ background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--border)' }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-2)')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                    />
                  </div>
                )}
              </div>
            )}

            {mode === 'banner' && (
              <div className="flex flex-col gap-2.5">
                <div>
                  <label className="block text-xs font-mono mb-2" style={{ color: 'var(--text-muted)' }}>
                    Style
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(['minimal', 'technical', 'bold', 'retro-terminal'] as BannerStyle[]).map((s) => (
                      <StylePill
                        key={s}
                        label={s}
                        active={bannerStyle === s}
                        onClick={() => { setBannerStyle(s); setCustomStyleBanner('') }}
                      />
                    ))}
                  </div>
                </div>
                <CustomStyleBlock
                  value={customStyleBanner}
                  onChange={(v) => { setCustomStyleBanner(v); if (v.trim()) setBannerStyle(null) }}
                  placeholder="Dark industrial aesthetic with copper accents, engineering blueprint style, monospace typography, circuit trace decorations…"
                  chips={BANNER_INSPIRATION}
                  onChip={(text) => { setCustomStyleBanner(text); setBannerStyle(null) }}
                />
              </div>
            )}

            {mode === 'logo' && (
              <div className="flex flex-col gap-2.5">
                <div>
                  <label className="block text-xs font-mono mb-2" style={{ color: 'var(--text-muted)' }}>
                    Vibe
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(['fast', 'precise', 'powerful', 'minimal'] as const).map((v) => (
                      <StylePill
                        key={v}
                        label={v}
                        active={vibe === v}
                        onClick={() => { setVibe(v); setCustomStyleLogo('') }}
                      />
                    ))}
                  </div>
                </div>
                <CustomStyleBlock
                  value={customStyleLogo}
                  onChange={(v) => { setCustomStyleLogo(v); if (v.trim()) setVibe(null) }}
                  placeholder="Geometric owl made of circuit traces, minimalist, works at small sizes, no text, uses only two colors, feels technical and precise…"
                  chips={LOGO_INSPIRATION}
                  onChip={(text) => { setCustomStyleLogo(text); setVibe(null) }}
                />
              </div>
            )}

            {mode === 'diagram' && (
              <div className="flex flex-col gap-2">
                <label className="block text-xs font-mono mb-1" style={{ color: 'var(--text-muted)' }}>
                  Graphic Description / Prompt
                </label>
                <textarea
                  rows={6}
                  value={diagramDesc}
                  onChange={(e) => setDiagramDesc(e.target.value)}
                  placeholder="e.g. A futuristic circuit board graphic, or motor controller block diagram, or abstract science icon"
                  className="w-full resize-none rounded-lg px-3 py-2 text-sm font-sans outline-none border transition-colors"
                  style={{ background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--border)' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-2)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                />
                <ChipRow chips={DIAGRAM_INSPIRATION} onChip={(text) => setDiagramDesc(text)} />
              </div>
            )}

            {genError && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ background: 'rgba(255,80,80,0.1)', color: '#b08080' }}
              >
                <AlertTriangle size={13} />
                {genError}
              </div>
            )}

            <button
              onClick={() => generate()}
              disabled={generating}
              className="self-start flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold font-mono transition-all disabled:opacity-40"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >
              {generating
                ? <><Loader2 size={15} className="animate-spin" /> Generating SVG…</>
                : <><Sparkles size={15} /> Generate {modeLabel(mode)}</>
              }
            </button>
          </div>
          )}

          {/* SVG preview (hidden in brainstorm mode) */}
          {mode !== 'brainstorm' && (
          <div className="flex-1 overflow-auto p-5 flex items-start justify-center" style={{ background: 'var(--bg)' }}>
            {generating && (
              <div className="flex flex-col items-center justify-center gap-4 h-full w-full">
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
                <p className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
                  {activeModel ?? 'Model'} is designing your SVG…
                </p>
              </div>
            )}

            {!generating && currentSvg && (
              <div className="w-full max-w-4xl">
                <div
                  className="rounded-xl overflow-hidden border"
                  style={{
                    borderColor: 'var(--border)',
                    aspectRatio: previewAspect,
                    background: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  dangerouslySetInnerHTML={{ __html: currentSvg }}
                />
                <p className="mt-2 text-xs font-mono text-center" style={{ color: 'var(--text-muted)' }}>
                  {modeLabel(mode)} — rendered inline SVG
                </p>
              </div>
            )}

            {!generating && !currentSvg && (
              <div className="flex flex-col items-center justify-center gap-4 h-full min-h-48 text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.15)' }}
                >
                  <Image size={28} style={{ color: 'var(--accent)' }} />
                </div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Configure options above and click Generate
                </p>
              </div>
            )}
          </div>
          )}

          {/* ── Brainstorm chat panel ── */}
          {mode === 'brainstorm' && (
            <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
              {/* Header strip */}
              <div
                className="shrink-0 px-5 py-3 border-b flex items-center justify-between"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                <div className="flex flex-col">
                  <span className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    Visual Content Assistant
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                    Logos · banners · palettes · prompts for nano-banana / Higgsfield / Kling / Seedance
                  </span>
                </div>
                {isConnected && activeModel && (
                  <span
                    className="text-[10px] font-mono px-2 py-1 rounded border"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                  >
                    {activeModel}
                  </span>
                )}
              </div>

              {/* Scrolling message list */}
              <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                {chatMessages.length === 0 && !chatThinking && (
                  <div className="flex flex-col items-center justify-center gap-4 h-full min-h-32 text-center px-6">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.15)' }}
                    >
                      <MessagesSquare size={24} style={{ color: 'var(--accent)' }} />
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text)' }}>
                      Brainstorm visual content for your project
                    </p>
                    <p className="text-xs max-w-md" style={{ color: 'var(--text-muted)' }}>
                      Try: <span style={{ color: 'var(--accent)' }}>"give me 4 logo directions"</span>,{' '}
                      <span style={{ color: 'var(--accent)' }}>"a color palette for an industrial robotics startup"</span>,{' '}
                      or{' '}
                      <span style={{ color: 'var(--accent)' }}>"a nano-banana prompt for a hero banner"</span>.
                    </p>
                  </div>
                )}

                {chatMessages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className="max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm"
                      style={{
                        background: m.role === 'user' ? 'rgba(0,200,255,0.10)' : 'var(--surface)',
                        color: 'var(--text)',
                        border: '1px solid',
                        borderColor: m.role === 'user' ? 'rgba(0,200,255,0.25)' : 'var(--border)',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.55,
                      }}
                    >
                      {m.content}

                      {m.imagePrompt && !m.imageUrl && (
                        <div
                          className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          <button
                            onClick={() => navigator.clipboard.writeText(m.imagePrompt!)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                          >
                            <Copy size={11} /> Copy prompt
                          </button>
                          {apiKey && (
                            <button
                              onClick={() => setConfirmImageGen({ prompt: m.imagePrompt!, sourceMsgId: m.id })}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all"
                              style={{
                                borderColor: 'var(--accent)',
                                color: 'var(--accent)',
                                background: 'rgba(0,200,255,0.05)',
                              }}
                            >
                              <Wand2 size={11} /> Generate via {IMAGE_MODEL_LABEL.split(' (')[0]}
                            </button>
                          )}
                        </div>
                      )}

                      {m.imageUrl && (
                        <div className="mt-3">
                          <img
                            src={m.imageUrl}
                            alt="Generated"
                            className="rounded-lg border w-full"
                            style={{ borderColor: 'var(--border)', background: '#000' }}
                          />
                          <div className="mt-1.5 flex gap-2">
                            <a
                              href={m.imageUrl}
                              download="enginguity-asset.png"
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all"
                              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                            >
                              <Download size={11} /> Download
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {chatThinking && (
                  <div className="flex justify-start">
                    <div
                      className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                    >
                      <Loader2 size={14} className="animate-spin" />
                      Thinking…
                    </div>
                  </div>
                )}

                {imageGenLoading && (
                  <div className="flex justify-start">
                    <div
                      className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                    >
                      <Loader2 size={14} className="animate-spin" />
                      Generating image via {IMAGE_MODEL_LABEL}…
                    </div>
                  </div>
                )}

                {chatError && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                    style={{ background: 'rgba(255,80,80,0.1)', color: '#b08080' }}
                  >
                    <AlertTriangle size={13} />
                    {chatError}
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Composer */}
              <div
                className="shrink-0 px-4 py-3 border-t flex items-end gap-2"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                <textarea
                  rows={2}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendChat()
                    }
                  }}
                  placeholder={isConnected ? 'Ask for logo ideas, palettes, or image prompts…' : 'Connect a model in AI Settings to chat.'}
                  disabled={!isConnected || chatThinking}
                  className="flex-1 resize-none rounded-lg px-3 py-2 text-sm font-sans outline-none border transition-colors disabled:opacity-50"
                  style={{ background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--border)' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-2)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                />
                <button
                  onClick={sendChat}
                  disabled={!isConnected || chatThinking || !chatInput.trim()}
                  className="self-stretch flex items-center gap-1.5 px-4 rounded-lg text-sm font-mono transition-all disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}
                >
                  <Send size={14} />
                  Send
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: history rail (hidden in brainstorm) ── */}
        {mode !== 'brainstorm' && (
        <div
          className="shrink-0 w-52 flex flex-col border-l overflow-hidden"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <div
            className="px-3 py-3 border-b flex items-center gap-1.5"
            style={{ borderColor: 'var(--border)' }}
          >
            <Clock size={11} style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              History
            </span>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-2 p-2">
            {history.length === 0 ? (
              <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
                Generated assets will appear here
              </p>
            ) : (
              history.map((entry) => (
                <HistoryThumb
                  key={entry.id}
                  entry={entry}
                  active={activeHistoryId === entry.id}
                  onClick={() => selectHistory(entry)}
                />
              ))
            )}
          </div>
        </div>
        )}
      </div>

      {/* ── Image-gen confirm modal ── */}
      {confirmImageGen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setConfirmImageGen(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl border p-6 max-w-md w-full flex flex-col gap-4"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(0,200,255,0.10)', border: '1px solid rgba(0,200,255,0.25)' }}
                >
                  <Wand2 size={16} style={{ color: 'var(--accent)' }} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Generate image?</span>
                  <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>This will spend real API money.</span>
                </div>
              </div>
              <button
                onClick={() => setConfirmImageGen(null)}
                className="rounded-md p-1 transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-muted)' }}>Model</span>
                <span className="font-mono" style={{ color: 'var(--text)' }}>{IMAGE_MODEL_LABEL}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-muted)' }}>Routed via</span>
                <span className="font-mono" style={{ color: 'var(--text)' }}>OpenRouter</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-muted)' }}>Estimated cost</span>
                <span className="font-mono flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                  <DollarSign size={11} />
                  ~{IMAGE_COST_PER_IMAGE.toFixed(2)} / image
                </span>
              </div>
            </div>

            <div
              className="rounded-lg border px-3 py-2 text-xs max-h-32 overflow-y-auto font-mono"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              {confirmImageGen.prompt}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmImageGen(null)}
                className="px-4 py-2 rounded-lg text-xs font-mono border transition-all"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={runImageGen}
                className="px-4 py-2 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              >
                <Wand2 size={12} /> Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
