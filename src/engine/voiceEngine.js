// Web Speech API Voice Recognition & Synthesis Manager

export const isVoiceSupported = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  return !!SpeechRecognition && !!window.speechSynthesis
}

export function createSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) return null

  const recognition = new SpeechRecognition()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = 'en-US'
  recognition.maxAlternatives = 3

  return recognition
}

// Select best voice automatically
export function getBestVoice(voices, preferredName = '') {
  if (voices.length === 0) return null

  if (preferredName) {
    const preferred = voices.find(v => v.name === preferredName)
    if (preferred) return preferred
  }

  // Priority order
  const priorities = ['Google US English', 'Microsoft David', 'Alex']
  for (const name of priorities) {
    const found = voices.find(v => v.name.includes(name))
    if (found) return found
  }

  // English first fallback
  const englishVoice = voices.find(v => v.lang.startsWith('en'))
  if (englishVoice) return englishVoice

  return voices[0]
}

// TTS Voice player
export function speakText(text, options = {}) {
  const synth = window.speechSynthesis
  if (!synth) return

  // Cancel any active speakings
  synth.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  const voices = synth.getVoices()

  const selectedVoiceName = localStorage.getItem('enginguity_voice_name') || ''
  utterance.voice = getBestVoice(voices, selectedVoiceName)

  // Configure parameters
  utterance.rate = parseFloat(localStorage.getItem('enginguity_voice_rate') || '1.0')
  utterance.pitch = parseFloat(localStorage.getItem('enginguity_voice_pitch') || '1.0')
  utterance.volume = parseFloat(localStorage.getItem('enginguity_voice_volume') || '0.8')

  if (options.onStart) utterance.onstart = options.onStart
  if (options.onEnd) utterance.onend = options.onEnd
  if (options.onError) utterance.onerror = options.onError

  synth.speak(utterance)
}

// AI Voice Intent mapping
export async function parseVoiceIntent(makeRequest, transcript, activeModule, parameters, projectContext) {
  const systemPrompt = `You are the voice interface for ENGINGUITY, an engineering workspace. Classify the user's spoken command into a structured intent and return ONLY JSON.`
  
  const prompt = `Current Module: ${activeModule}
Current Parameter Values: ${JSON.stringify(parameters || {})}
Project Context Details: ${projectContext || 'none'}

User spoken command: '${transcript}'

Classify this into a structured command. Return ONLY a JSON object:
{
  "intent": string,
  "confidence": number (0-1),
  "params": {}
}

Supported intents and parameters:
'navigate' -> { "module": "playground" | "cad" | "notebook" | "bom" | "circuit-sim" | "datasheet" | "formula-lab" }
'set_parameter' -> { "paramName": string, "value": number, "unit": string|null }
'ask_question' -> { "question": string }
  (For 'ask_question', the system will query you for the answer to read aloud.)
'run_analysis' -> { "type": "ai_analysis" | "simulate" | "export" }
'add_notebook_entry' -> { "type": "NOTE" | "PROBLEM" | "TEST_RESULT", "title": string, "content": string }
'read_value' -> { "paramName": string }
'run_comparison' -> {}
'stop_voice' -> {}
'repeat_last' -> {}
'help' -> {}`

  try {
    const rawRes = await makeRequest([{ role: 'user', content: prompt }], systemPrompt)
    let clean = rawRes.trim()
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '')
    }
    const result = JSON.parse(clean)
    return result
  } catch (e) {
    console.error('Failed to parse voice command intent:', e)
    return { intent: 'help', confidence: 0.1, params: {} }
  }
}
