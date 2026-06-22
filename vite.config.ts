import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true
  },
  test: {
    // happy-dom (not jsdom): jsdom 28 pulls an ESM-only @exodus/bytes that
    // Node < 20.19 cannot require(), breaking the whole suite. happy-dom is
    // pure ESM and provides the DOM APIs these tests need.
    environment: 'happy-dom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
})
