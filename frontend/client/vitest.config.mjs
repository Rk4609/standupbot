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
    // These tests type into forms key by key the way a person does. With the
    // whole suite running at once that takes several seconds on a busy
    // machine or a shared CI runner, and the default 5s turned slowness into
    // a failure that had nothing to do with the code under test.
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/components/ui/**', 'src/store/**'],
      reporter: ['text', 'lcov']
    }
  }
})
