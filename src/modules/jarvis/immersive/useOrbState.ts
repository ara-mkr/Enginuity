import { useMemo } from 'react'

export type JarvisVisualState = 'sleeping' | 'listening' | 'processing' | 'speaking'

export interface OrbParams {
  speedMultiplier: number
  coreRadius: number
  corePulseAmp: number
  showSpeechBars: boolean
  showProcessingRing: boolean
  particleBrightness: number
}

export function useOrbState(state: JarvisVisualState): OrbParams {
  return useMemo(() => {
    switch (state) {
      case 'speaking':
        return {
          speedMultiplier: 4,
          coreRadius: 35,
          corePulseAmp: 10,
          showSpeechBars: true,
          showProcessingRing: false,
          particleBrightness: 1.15,
        }
      case 'processing':
        return {
          speedMultiplier: 2.5,
          coreRadius: 35,
          corePulseAmp: 4,
          showSpeechBars: false,
          showProcessingRing: true,
          particleBrightness: 1.0,
        }
      case 'listening':
        return {
          speedMultiplier: 1.5,
          coreRadius: 35,
          corePulseAmp: 3,
          showSpeechBars: false,
          showProcessingRing: false,
          particleBrightness: 0.95,
        }
      default:
        return {
          speedMultiplier: 1,
          coreRadius: 35,
          corePulseAmp: 1,
          showSpeechBars: false,
          showProcessingRing: false,
          particleBrightness: 0.7,
        }
    }
  }, [state])
}
