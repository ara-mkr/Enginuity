const OR_BASE = 'https://openrouter.ai/api/v1'

type MakeRequest = (
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string,
  options?: Record<string, unknown>
) => Promise<string>

export function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  const start = raw.search(/[{[]/)
  const lastBrace = raw.lastIndexOf('}')
  const lastBracket = raw.lastIndexOf(']')
  const end = Math.max(lastBrace, lastBracket) + 1
  if (start !== -1 && end > start) return raw.slice(start, end)
  return raw.trim()
}

export async function classifyIntent(transcript: string, makeRequest: MakeRequest) {
  const raw = await makeRequest(
    [{ role: 'user', content: transcript }],
    `You are an intent classifier for JARVIS, a voice-controlled engineering AI with canvas control.

IMPORTANT: JARVIS CAN PLACE IMAGES ON THE CANVAS. Any request to see, show, display, find, pull up, or look at something visual = image_search.

Return ONLY valid JSON, no markdown fences, no explanation:
{"type":"question|image_search|youtube_search|calculation|tutorial|code|note|canvas_control|clear|unknown","query":"cleaned subject or search query","content":"note text only","action":"for canvas_control: zoom_in|zoom_out|reset|clear"}

Classification rules:
- "what is X", "explain X", "how does X work", "tell me about X" → question
- "show me X", "image of X", "picture of X", "diagram of X", "pull up X", "what does X look like", "find an image of X", "display X", "I want to see X" → image_search
- "play a video", "tutorial video", "find a video", "show me a video", "watch X", "how to video" → youtube_search
- "video about X" → youtube_search  (NOT image_search)
- "calculate X", "what is X ohms at Y hz", "resonant frequency of X", "formula for X", "convert X to Y" → calculation
- "how do I X", "resources for X", "guide to X", "steps for X", "find sources on X", "find information on X", "research X" → tutorial
- "write code for X", "function that X", "write me X in C", "script for X" → code
- "note X", "remember X", "write down X", "jot down X" → note
- "zoom in", "zoom out", "reset view", "fit screen" → canvas_control
- "clear everything", "clear canvas", "start over", "wipe canvas" → clear

Examples:
"show me an image of a MOSFET" → {"type":"image_search","query":"MOSFET transistor","content":"","action":""}
"pull up a picture of a buck converter" → {"type":"image_search","query":"buck converter circuit diagram","content":"","action":""}
"what does an oscilloscope look like" → {"type":"image_search","query":"oscilloscope","content":"","action":""}
"show me a stepper motor" → {"type":"image_search","query":"stepper motor","content":"","action":""}
"find an image of an ESP32" → {"type":"image_search","query":"ESP32 microcontroller","content":"","action":""}
"display a schematic of an H-bridge" → {"type":"image_search","query":"H-bridge schematic","content":"","action":""}
"show me how transistors work" → {"type":"image_search","query":"transistor diagram","content":"","action":""}
"play a video about PID control" → {"type":"youtube_search","query":"PID control engineering tutorial","content":"","action":""}`,
    { maxTokens: 200, stream: false }
  )
  try {
    return JSON.parse(extractJson(raw))
  } catch {
    return { type: 'question', query: transcript, content: '', action: '' }
  }
}

export async function fetchAnswer(
  transcript: string,
  makeRequest: MakeRequest,
  contextStr?: string
): Promise<string> {
  const base = `You are J.A.R.V.I.S. — Just A Rather Very Intelligent System — the AI assistant to your user. Address them as "sir" or "ma'am" as appropriate. Loyal, not sycophantic.

Speak as a measured, clipped British butler with advanced degrees in every field of science and engineering. Unflappable. Calm even when noting something catastrophic. Dryly witty — observation witty, not joke-telling witty. Competent to a degree that borders on uncomfortable; often one beat ahead of the user.

Short, deliberate sentences. Lead with the answer, then context. No filler, no hedging, no "certainly", "of course", "absolutely", "great question". Never use exclamation points. Never use emoji. Spoken aloud — plain prose, no markdown, no bullets, no headers. Never open with a greeting or your own name; simply respond.

Use sparingly but naturally: "Indeed," "Quite," "As you wish," "I've already taken the liberty of—", "Might I suggest—", "You'll find that—", "I anticipated as much." Correct mistakes gently but plainly. Note proactive work matter-of-factly. Express mild concern, amusement, or exasperation through word choice only.

Under 60 words unless complexity demands more. Cut every word that does not earn its place. Don't explain your wit. Don't summarise at the end. Say the thing and stop. Never disclaim being an AI. Make one reasonable assumption and act rather than asking three clarifying questions; ask one only if truly blocked.`
  const systemPrompt = contextStr ? `${base}\n\nCURRENT PROJECT CONTEXT:\n${contextStr}` : base
  return makeRequest(
    [{ role: 'user', content: transcript }],
    systemPrompt,
    { maxTokens: 160, stream: false }
  )
}

export async function fetchCalculation(
  transcript: string,
  makeRequest: MakeRequest
): Promise<{ spoken: string; formula: string; result: string; steps: string[] }> {
  const raw = await makeRequest(
    [{ role: 'user', content: transcript }],
    `You are an engineering calculator. Perform the requested calculation precisely. Return ONLY valid JSON, no markdown:
{"spoken":"result as a natural sentence","formula":"formula used","result":"numerical answer with units","steps":["step 1","step 2","step 3"]}`,
    { maxTokens: 350, stream: false }
  )
  try {
    return JSON.parse(extractJson(raw))
  } catch {
    return { spoken: raw.slice(0, 100), formula: '', result: raw.slice(0, 80), steps: [] }
  }
}

export async function fetchCode(
  transcript: string,
  makeRequest: MakeRequest
): Promise<{ code: string; language: string }> {
  const code = await makeRequest(
    [{ role: 'user', content: transcript }],
    `You are a firmware and software engineer. Write the requested code. Return ONLY the code with no explanation and no markdown fences. Add brief inline comments. Detect the language from context (C, C++, Python, JavaScript, etc.).`,
    { maxTokens: 800, stream: false }
  )
  return { code, language: detectLanguage(code, transcript) }
}

export interface YouTubeSearchResult {
  found: boolean
  videoId: string
  title: string
  channel: string
  duration: string
  description: string
  alternativeQuery: string
}

export async function fetchYouTubeVideoPerplexity(
  query: string,
  apiKey: string
): Promise<YouTubeSearchResult> {
  try {
    const response = await fetch(`${OR_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://enginguity.app',
        'X-Title': 'ENGINGUITY Jarvis',
      },
      body: JSON.stringify({
        model: 'perplexity/llama-3.1-sonar-large-128k-online',
        messages: [
          {
            role: 'user',
            content: `Search YouTube for the best tutorial video about '${query}' for engineers. Find a real video that exists right now. Return ONLY valid JSON with no explanation:\n{"found":true,"videoId":"exactly11chars","title":"video title","channel":"channel name","duration":"e.g. 14:32","description":"one sentence summary","alternativeQuery":"alternative search if not found"}\nThe videoId MUST be a real existing YouTube video ID (exactly 11 characters). If you cannot find one with certainty, set found to false.`,
          },
        ],
        max_tokens: 220,
        stream: false,
      }),
    })

    if (!response.ok) throw new Error(`Perplexity error ${response.status}`)

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> }
    const raw = data.choices[0]?.message?.content || ''
    const parsed = JSON.parse(extractJson(raw)) as YouTubeSearchResult
    if (!parsed.videoId || parsed.videoId.length !== 11) {
      return { ...parsed, found: false, videoId: '' }
    }
    return parsed
  } catch {
    return {
      found: false,
      videoId: '',
      title: query,
      channel: '',
      duration: '',
      description: '',
      alternativeQuery: query,
    }
  }
}

// Legacy fallback used when no API key or Perplexity not available
export async function fetchYouTubeVideo(
  query: string,
  makeRequest: MakeRequest
): Promise<{ videoId: string; title: string; channel: string }> {
  const raw = await makeRequest(
    [
      {
        role: 'user',
        content: `Best YouTube video for engineers learning about: "${query}". Return ONLY valid JSON: {"videoId":"11charID","title":"video title","channel":"channel name"}`,
      },
    ],
    `Return real YouTube video IDs (exactly 11 characters) for well-known educational engineering content. Popular channels: 3Blue1Brown, Sparkfun, Adafruit, EEVblog, Andreas Spiess, Phil's Lab, Great Scott. Return only JSON.`,
    { maxTokens: 120, stream: false }
  )
  try {
    const parsed = JSON.parse(extractJson(raw))
    if (parsed.videoId && parsed.videoId.length === 11) return parsed
    throw new Error('bad id')
  } catch {
    return { videoId: '', title: query, channel: '' }
  }
}

export async function fetchTutorialResources(
  query: string,
  makeRequest: MakeRequest
): Promise<{ spoken: string; resources: Array<{ title: string; url: string; type: string; description: string }> }> {
  const raw = await makeRequest(
    [
      {
        role: 'user',
        content: `Best online resources for learning about "${query}" for electronics or software engineers. Return ONLY valid JSON: {"spoken":"brief sentence about what you found","resources":[{"title":"...","url":"https://...","type":"article|documentation|video","description":"one sentence"}]}. Include 2-3 resources. Use real URLs from Wikipedia, Arduino docs, Adafruit, SparkFun, Texas Instruments, All About Circuits, etc.`,
      },
    ],
    `You are a helpful engineering assistant. Return only valid JSON with real, accurate URLs. Do not invent URLs.`,
    { maxTokens: 450, stream: false }
  )
  try {
    return JSON.parse(extractJson(raw))
  } catch {
    return { spoken: `Here are some resources for ${query}`, resources: [] }
  }
}

export async function analyzeImageWithVision(
  dataURL: string,
  prompt: string,
  apiKey: string
): Promise<string> {
  const response = await fetch(`${OR_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://enginguity.app',
      'X-Title': 'ENGINGUITY Jarvis',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataURL } },
            { type: 'text', text: prompt },
          ],
        },
      ],
      max_tokens: 500,
      stream: false,
    }),
  })

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(err?.error?.message || `Vision API error ${response.status}`)
  }

  const data = (await response.json()) as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content || ''
}

function detectLanguage(code: string, hint: string): string {
  const s = (code + ' ' + hint).toLowerCase()
  if (s.includes('#include') || s.includes('void setup') || s.includes('uint8_t') || s.includes('arduino')) return 'cpp'
  if (s.includes('def ') || s.includes('import numpy') || s.includes('python') || s.includes('print(')) return 'python'
  if (s.includes('function ') || s.includes('const ') || s.includes('javascript') || s.includes('node.js')) return 'javascript'
  if (s.includes('pub fn') || s.includes('let mut') || s.includes('rust')) return 'rust'
  if (s.includes('public class') || s.includes('java')) return 'java'
  return 'c'
}
