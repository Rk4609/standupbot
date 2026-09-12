import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Separate from vite.config.js: the app config builds a PWA and reads env to
// derive the service-worker cache pattern, none of which a test run needs.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/components/ui/**', 'src/store/**'],
      reporter: ['text', 'lcov']
    }
  }
})
