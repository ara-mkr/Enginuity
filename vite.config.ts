import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// When building for Electron, assets must use relative paths (file:// protocol)
const isElectronBuild = process.env.ELECTRON_BUILD === 'true'

export default defineConfig({
  plugins: [react()],
  base: isElectronBuild ? './' : '/',
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
