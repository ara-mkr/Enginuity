import { useMemo } from 'react'

export interface DeviceSpecs {
  // RAM in GB. Browser caps navigator.deviceMemory at 8 for privacy.
  // For Apple Silicon we estimate higher since the base config is 16 GB.
  reportedRamGB: number
  estimatedRamGB: number
  cpuThreads: number
  gpu: string | null
  gpuVendor: string | null
  isAppleSilicon: boolean
  isNvidiaGPU: boolean
  isAMDGPU: boolean
  platform: string
  // Rough perf tier based on specs
  tier: 'low' | 'mid' | 'high' | 'unknown'
}

function getWebGLInfo(): { renderer: string | null; vendor: string | null } {
  try {
    const canvas = document.createElement('canvas')
    const gl =
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null)
    if (!gl) return { renderer: null, vendor: null }
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (!ext) return { renderer: null, vendor: null }
    return {
      renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string,
      vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string,
    }
  } catch {
    return { renderer: null, vendor: null }
  }
}

export function getDeviceSpecs(): DeviceSpecs {
  const reportedRamGB: number = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  const cpuThreads: number = navigator.hardwareConcurrency ?? 4
  const platform: string = navigator.platform ?? ''
  const { renderer, vendor } = getWebGLInfo()

  const rendererLower = renderer?.toLowerCase() ?? ''
  const isAppleSilicon =
    /apple m[1-9]|apple gpu/i.test(rendererLower) ||
    /mac/i.test(platform)

  const isNvidiaGPU = /nvidia|geforce|quadro/i.test(rendererLower)
  const isAMDGPU = /amd|radeon|rx \d/i.test(rendererLower)

  // Apple Silicon M-series: browser always reports 8 GB (the privacy cap),
  // but the minimum config for M1/M2/M3/M4 is 8 GB and base Air is 16 GB.
  // We estimate 16 GB if we detect Apple Silicon — conservative but realistic.
  let estimatedRamGB = reportedRamGB
  if (isAppleSilicon && reportedRamGB >= 8) {
    estimatedRamGB = 16 // minimum realistic for an M-series Mac with full deviceMemory
  }

  // Extract Apple chip generation from renderer
  const appleChipMatch = renderer?.match(/Apple M(\d+)/i)
  const appleGen = appleChipMatch ? parseInt(appleChipMatch[1]) : 0
  if (isAppleSilicon && appleGen >= 3 && reportedRamGB >= 8) {
    estimatedRamGB = 16 // M3/M4 base is 16 GB
  }

  // Perf tier
  let tier: DeviceSpecs['tier'] = 'unknown'
  if (estimatedRamGB >= 32 || (isNvidiaGPU && /rtx 3[0-9]{3}|rtx 4[0-9]{3}/i.test(rendererLower))) {
    tier = 'high'
  } else if (estimatedRamGB >= 16 || isAppleSilicon) {
    tier = 'mid'
  } else if (estimatedRamGB >= 8) {
    tier = 'low'
  }

  return {
    reportedRamGB,
    estimatedRamGB,
    cpuThreads,
    gpu: renderer,
    gpuVendor: vendor,
    isAppleSilicon,
    isNvidiaGPU,
    isAMDGPU,
    platform,
    tier,
  }
}

// Model size-to-RAM rule: need ~1.3x the model's disk size loaded in RAM.
// We leave headroom for the OS + app (~4 GB on macOS).
export function modelFitsInRAM(sizeGB: number, specsEstimatedRam: number): 'fits' | 'tight' | 'too-large' {
  const needed = sizeGB * 1.3
  const available = Math.max(0, specsEstimatedRam - 4)
  if (needed <= available * 0.7) return 'fits'
  if (needed <= available) return 'tight'
  return 'too-large'
}

export function useDeviceSpecs(): DeviceSpecs {
  return useMemo(() => getDeviceSpecs(), [])
}
