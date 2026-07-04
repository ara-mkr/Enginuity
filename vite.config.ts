import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// When building for Electron, assets must use relative paths (file:// protocol)
const isElectronBuild = process.env.ELECTRON_BUILD === 'true'

// Honor a tooling-assigned PORT when present (preview/CI runners set it) so the
// dev server lands on the port the harness proxies; a plain `npm run dev` with
// no PORT set keeps Vite's default behavior.
const devPort = process.env.PORT ? Number(process.env.PORT) : undefined

export default defineConfig({
  plugins: [react()],
  base: isElectronBuild ? './' : '/',
  server: devPort ? { port: devPort, strictPort: true } : undefined,
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Ensure asset filenames stay stable
        manualChunks: undefined,
      },
    },
  },
})
