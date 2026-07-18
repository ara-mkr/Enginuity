// Shared Pyodide loader. Injects the CDN script (once) and instantiates the
// runtime, caching the promise at module scope so every caller — Debug
// Console, Test Harness, anything else — shares one instance instead of each
// racing to inject its own <script> tag or reloading the ~8MB runtime.

type PyodideInstance = {
  runPythonAsync: (code: string) => Promise<unknown>
  globals: { set: (name: string, value: unknown) => void }
  [key: string]: unknown
}

type PyodideWindow = Window & {
  loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideInstance>
}

const PYODIDE_VERSION = 'v0.26.0'
const PYODIDE_BASE_URL = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`

let pyodidePromise: Promise<PyodideInstance> | null = null

export function loadPyodideRuntime(): Promise<PyodideInstance> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      const win = window as PyodideWindow
      if (!win.loadPyodide) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = `${PYODIDE_BASE_URL}pyodide.js`
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Failed to load Pyodide'))
          document.head.appendChild(script)
        })
      }
      return await win.loadPyodide!({ indexURL: PYODIDE_BASE_URL })
    })().catch((e) => {
      pyodidePromise = null
      throw e
    })
  }
  return pyodidePromise
}
