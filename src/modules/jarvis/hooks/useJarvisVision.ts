import { useState, useRef, useCallback } from 'react'
import {
  setCameraCallbacks,
  startCamera as engStartCamera,
  stopCamera as engStopCamera,
  captureFrame as engCaptureFrame,
  isCameraActive as engIsCameraActive,
  startContinuousAnalysis as engStartContinuous,
  stopContinuousAnalysis as engStopContinuous,
} from '../camera/cameraEngine'
import { analyzeFrame as visionAnalyzeFrame, analyzeFrameOllama } from '../camera/visionAI'
import { analyzeImageWithVision } from '../commandProcessor'
import type { CanvasItem, LogEntry, PlaceItemInput } from '../types'
import type { JarvisIntent } from '../JarvisModule'

interface UseJarvisVisionParams {
  speak: (text: string, intent?: JarvisIntent) => void
  addLog: (role: LogEntry['role'], text: string) => void
  placeItem: (partial: PlaceItemInput) => CanvasItem
  updateCanvasItem: (id: string, updates: Partial<CanvasItem>) => void
  setItems: React.Dispatch<React.SetStateAction<CanvasItem[]>>
  itemsRef: React.RefObject<CanvasItem[]>
  apiKey: string | null | undefined
  activeModel: string | null | undefined
  trackUsage: (modelId: string, promptText: string, responseText: string) => void
}

const JARVIS_VISION_PROMPT = (additionalContext = '') =>
  `You are JARVIS, an AI assistant for an engineer.
Describe what you see in this image concisely and helpfully.
${additionalContext ? `The engineer specifically asks: ${additionalContext}` : ''}
Guidelines:
- Speak naturally as JARVIS would (British, precise, helpful)
- Be specific about what you actually see
- For engineering components: identify them, mention key markings
- For circuits or schematics: describe the topology
- For workbench scenes: list the main items
- For text/labels: read them out
- Keep it under 100 words
- Address the user as "sir"
- Start with what's most prominent`

/**
 * Owns the camera engine wiring and the vision-analysis actions built on
 * top of it: still-photo capture + analysis, "what do you see" live
 * description, and continuous-watch mode.
 */
export function useJarvisVision({
  speak,
  addLog,
  placeItem,
  updateCanvasItem,
  setItems,
  itemsRef,
  apiKey,
  activeModel,
  trackUsage,
}: UseJarvisVisionParams) {
  const [cameraActive, setCameraActive] = useState(false)
  const cameraVideoRef = useRef<HTMLVideoElement>(null) // kept for prop compat
  const cameraActiveRef = useRef(cameraActive)
  cameraActiveRef.current = cameraActive

  const startCamera = useCallback(async () => {
    if (cameraActiveRef.current) {
      speak('The camera is already active, sir.')
      return
    }
    speak('Activating camera, sir.')

    setCameraCallbacks({
      onStream: (stream) => {
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream
          cameraVideoRef.current.play().catch(() => {})
        }
        setCameraActive(true)
        placeItem({
          type: 'camera',
          title: 'Camera · Live',
          content: { active: true },
          width: 320,
          height: 240,
        })
        addLog('jarvis', '⟡ Camera activated')
        setTimeout(() => {
          speak("Camera online, sir. Say 'what do you see' and I'll describe what's in frame.")
        }, 800)
      },
      onStop: () => {
        setCameraActive(false)
        setItems((prev) => prev.filter((it) => it.type !== 'camera'))
        addLog('system', '— Camera stopped')
      },
      onError: (msg) => {
        speak(`I'm afraid the camera is unavailable, sir. ${msg}`)
        addLog('jarvis', `Camera error: ${msg}`)
      },
    })

    const ok = await engStartCamera()
    if (!ok) speak("I couldn't access the camera, sir.")
  }, [placeItem, speak, addLog, setItems])

  const stopCamera = useCallback(() => {
    engStopCamera()
    speak('Camera deactivated, sir.')
    // onStop callback in setCameraCallbacks handles state cleanup
  }, [speak])

  const capturePhoto = useCallback((): CanvasItem | null => {
    if (!engIsCameraActive()) {
      speak("The camera isn't active, sir. Say 'turn on camera' first.")
      return null
    }
    const frame = engCaptureFrame(0.85)
    if (!frame) {
      speak("I couldn't capture a frame, sir.")
      return null
    }
    const photoItem = placeItem({
      type: 'photo',
      title: `Photo ${new Date().toLocaleTimeString()}`,
      content: {
        dataURL: frame.dataURL,
        base64: frame.base64,
        width: frame.width,
        height: frame.height,
        capturedAt: Date.now(),
        analysis: null,
        analyzing: false,
      },
    })
    speak('Photo captured, sir. Shall I analyze it?')
    addLog('jarvis', '⟡ Photo captured')
    return photoItem
  }, [placeItem, speak, addLog])

  const analyzePhoto = useCallback(
    async (photoItem: CanvasItem, additionalContext = '') => {
      if (!apiKey) {
        speak('No API key connected.')
        return
      }
      updateCanvasItem(photoItem.id, { content: { ...photoItem.content, analyzing: true } })
      addLog('system', '— Analyzing photo…')

      const prompt =
        additionalContext ||
        'Analyze this image. Identify what you see. If it is an electronic component, circuit, schematic, mechanical part, or engineering artifact, provide specific technical details. If there is text or labels visible, read them. Be specific and practical. The user is an engineer.'

      try {
        const analysis = await analyzeImageWithVision(photoItem.content.dataURL, prompt, apiKey)
        trackUsage('openai/gpt-4o', prompt, analysis)
        updateCanvasItem(photoItem.id, { content: { ...photoItem.content, analysis, analyzing: false } })
        speak(analysis.slice(0, 180))
        addLog('jarvis', `⟡ ${analysis.slice(0, 80)}…`)

        placeItem({
          type: 'text',
          title: `Analysis: ${photoItem.title}`,
          content: { question: 'Photo analysis', answer: analysis, linkedPhotoId: photoItem.id },
          x: photoItem.x + (photoItem.width || 320) + 16,
          y: photoItem.y,
        })
      } catch (err) {
        updateCanvasItem(photoItem.id, { content: { ...photoItem.content, analyzing: false } })
        speak("I couldn't analyze that photo. Please try again.")
        addLog('system', `— Vision error: ${err instanceof Error ? err.message : 'unknown'}`)
      }
    },
    [apiKey, updateCanvasItem, placeItem, speak, addLog, trackUsage]
  )

  const handleAnalyzePhotoById = useCallback(
    (itemId: string) => {
      const item = itemsRef.current.find((i) => i.id === itemId)
      if (item) analyzePhoto(item)
    },
    [analyzePhoto, itemsRef]
  )

  const handleWhatDoYouSee = useCallback(
    async (additionalContext = '') => {
      if (!engIsCameraActive()) {
        speak("The camera isn't on, sir. Say 'turn on camera' and point it at what you'd like me to examine.")
        return
      }

      speak('Let me take a look, sir.')

      const frame = engCaptureFrame(0.85)
      if (!frame) {
        speak("I couldn't get a clear image, sir.")
        return
      }

      const prompt = JARVIS_VISION_PROMPT(additionalContext)
      const activeProvider = localStorage.getItem('enginguity_active_provider')
      let result
      if (activeProvider === 'ollama') {
        result = await analyzeFrameOllama(frame, prompt)
      } else {
        result = await visionAnalyzeFrame(frame, prompt, apiKey || '', activeModel || undefined)
      }

      if (!result.success) {
        speak(
          result.noVision
            ? result.message ||
                "I'm afraid my current model can't process images, sir. Switch to GPT-4o or Claude for vision capabilities."
            : `I ran into a difficulty, sir. ${result.message}`
        )
        return
      }

      const analysis = result.analysis || ''
      speak(analysis)
      addLog('jarvis', `⟡ ${analysis.slice(0, 80)}${analysis.length > 80 ? '…' : ''}`)

      // Place snapshot card on canvas next to the camera feed
      const snapshot = engCaptureFrame(0.7)
      const cameraItem = itemsRef.current.find((it) => it.type === 'camera')
      placeItem({
        type: 'photo',
        x: (cameraItem?.x || 100) + (cameraItem?.width || 320) + 20,
        y: cameraItem?.y || 100,
        title: 'What Jarvis sees',
        content: {
          dataURL: snapshot?.dataURL || frame.dataURL,
          base64: snapshot?.base64 || frame.base64,
          width: snapshot?.width || frame.width,
          height: snapshot?.height || frame.height,
          analysis,
          capturedAt: Date.now(),
          analyzing: false,
        },
        fromCommand: 'what do you see',
      })
    },
    [apiKey, activeModel, placeItem, speak, addLog, itemsRef]
  )

  const handleContinuousMode = useCallback(async () => {
    if (!engIsCameraActive()) {
      speak("Camera isn't active, sir. Say 'turn on camera' first.")
      return
    }

    speak(
      "Continuous watch mode active, sir. I'll describe any significant changes I notice. Say 'stop watching' to end."
    )

    let lastDescription = ''

    engStartContinuous(8, async (frame) => {
      const prompt = `You are JARVIS watching a live camera feed.
Very briefly note what you see (20 words max).
Only describe it if something significant changed from before.
If nothing notable changed, respond with exactly: unchanged
Previous description: ${lastDescription || 'none'}`

      const activeProvider = localStorage.getItem('enginguity_active_provider')
      let result
      if (activeProvider === 'ollama') {
        result = await analyzeFrameOllama(frame, prompt)
      } else {
        result = await visionAnalyzeFrame(frame, prompt, apiKey || '', activeModel || undefined)
      }

      if (result.success && !result.analysis?.toLowerCase().includes('unchanged')) {
        lastDescription = result.analysis || ''
        speak(lastDescription)
        addLog('jarvis', lastDescription)
      }
    })
  }, [apiKey, activeModel, speak, addLog])

  const stopContinuousMode = useCallback(() => {
    engStopContinuous()
    speak('Stopped watching, sir.')
    addLog('system', '— Continuous mode stopped')
  }, [speak, addLog])

  return {
    cameraActive,
    cameraVideoRef,
    cameraActiveRef,
    startCamera,
    stopCamera,
    capturePhoto,
    analyzePhoto,
    handleAnalyzePhotoById,
    handleWhatDoYouSee,
    handleContinuousMode,
    stopContinuousMode,
  }
}
