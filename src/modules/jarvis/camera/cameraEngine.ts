/**
 * Singleton camera engine — lives outside React.
 * Manages the MediaStream, offscreen video element, and capture canvas.
 * Mirrors the pattern of recognitionEngine.ts.
 */

type DiagType = 'info' | 'success' | 'warn' | 'error'
const diag = (msg: string, type: DiagType = 'info') =>
  (window as any).jarvisDiag?.(msg, type)

// Module-level singletons
let stream: MediaStream | null = null
let videoElement: HTMLVideoElement | null = null
let captureCanvas: HTMLCanvasElement | null = null
let captureCtx: CanvasRenderingContext2D | null = null
let isActive = false
let analysisInterval: ReturnType<typeof setInterval> | null = null
let _continuousMode = false

export interface CapturedFrame {
  dataURL: string
  base64: string
  width: number
  height: number
}

export interface CameraCallbacks {
  onStream?: (stream: MediaStream, video: HTMLVideoElement) => void
  onStop?: () => void
  onError?: (message: string) => void
}

let callbacks: CameraCallbacks = {}

export function setCameraCallbacks(cbs: Partial<CameraCallbacks>): void {
  callbacks = { ...callbacks, ...cbs }
}

export async function startCamera(facingMode: 'environment' | 'user' = 'environment'): Promise<boolean> {
  diag('startCamera() called', 'info')

  if (isActive) {
    diag('Camera already active', 'warn')
    return true
  }

  try {
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
      },
      audio: false,
    }

    stream = await navigator.mediaDevices.getUserMedia(constraints)

    videoElement = document.createElement('video')
    videoElement.srcObject = stream
    videoElement.autoplay = true
    videoElement.playsInline = true
    videoElement.muted = true

    await new Promise<void>((resolve, reject) => {
      if (!videoElement) return reject(new Error('no video element'))
      videoElement.onloadedmetadata = () => resolve()
      videoElement.onerror = () => reject(new Error('video load error'))
      setTimeout(() => reject(new Error('timeout')), 5000)
    })

    await videoElement.play()

    captureCanvas = document.createElement('canvas')
    captureCanvas.width = videoElement.videoWidth || 640
    captureCanvas.height = videoElement.videoHeight || 480
    captureCtx = captureCanvas.getContext('2d')

    isActive = true
    diag(`Camera started: ${captureCanvas.width}×${captureCanvas.height}`, 'success')
    callbacks.onStream?.(stream, videoElement)
    return true

  } catch (err) {
    const e = err as DOMException
    diag(`Camera error: ${e.name}: ${e.message}`, 'error')

    if (e.name === 'NotAllowedError') {
      callbacks.onError?.('Camera permission denied. Click the camera icon in your browser address bar to allow access.')
    } else if (e.name === 'NotFoundError') {
      callbacks.onError?.('No camera found. Please connect a camera and try again.')
    } else if (e.name === 'OverconstrainedError') {
      diag('Retrying with front-facing camera', 'warn')
      return startCamera('user')
    } else {
      callbacks.onError?.(`Camera error: ${e.message}`)
    }
    return false
  }
}

export function stopCamera(): void {
  diag('stopCamera() called', 'info')

  if (stream) {
    stream.getTracks().forEach((t) => t.stop())
    stream = null
  }
  if (videoElement) {
    videoElement.srcObject = null
    videoElement = null
  }

  stopContinuousAnalysis()
  isActive = false
  captureCanvas = null
  captureCtx = null

  callbacks.onStop?.()
}

export function captureFrame(quality = 0.85): CapturedFrame | null {
  if (!isActive || !captureCtx || !videoElement || !captureCanvas) {
    diag('captureFrame: camera not active', 'error')
    return null
  }

  captureCtx.drawImage(videoElement, 0, 0, captureCanvas.width, captureCanvas.height)
  const dataURL = captureCanvas.toDataURL('image/jpeg', quality)
  const base64 = dataURL.split(',')[1]

  diag(`Frame captured: ${Math.round(base64.length / 1024)}KB`, 'success')

  return {
    dataURL,
    base64,
    width: captureCanvas.width,
    height: captureCanvas.height,
  }
}

export function getVideoElement(): HTMLVideoElement | null {
  return videoElement
}

export function isCameraActive(): boolean {
  return isActive
}

export function startContinuousAnalysis(
  intervalSeconds: number,
  onAnalysis: (frame: CapturedFrame) => void
): void {
  if (analysisInterval) clearInterval(analysisInterval)
  _continuousMode = true

  analysisInterval = setInterval(() => {
    if (!isActive) return
    const frame = captureFrame(0.7)
    if (frame) onAnalysis(frame)
  }, intervalSeconds * 1000)

  diag(`Continuous analysis: every ${intervalSeconds}s`, 'info')
}

export function stopContinuousAnalysis(): void {
  if (analysisInterval) {
    clearInterval(analysisInterval)
    analysisInterval = null
  }
  _continuousMode = false
}

export function isContinuousMode(): boolean {
  return _continuousMode
}
