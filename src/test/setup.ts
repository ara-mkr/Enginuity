import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement crypto.randomUUID in older versions; Node's does.
if (!globalThis.crypto?.randomUUID) {
  // @ts-expect-error - polyfill for test environment
  globalThis.crypto = { ...globalThis.crypto, randomUUID: () => Math.random().toString(36).slice(2) }
}

if (!('AbortSignal' in globalThis) || !AbortSignal.timeout) {
  AbortSignal.timeout = (ms: number) => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), ms)
    return controller.signal
  }
}
