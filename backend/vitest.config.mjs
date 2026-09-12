import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    // Each file gets its own module registry, which matters for the rate
    // limiters: their counters live in module state, so the limit tests would
    // otherwise leak into every other suite.
    isolate: true,
    testTimeout: 20_000,
    // First run downloads the in-memory mongod binary
    hookTimeout: 120_000,
    coverage: {
      provider: 'v8',
      include: ['controllers/**', 'middleware/**', 'utils/**', 'app.js'],
      reporter: ['text', 'lcov']
    }
  }
})
