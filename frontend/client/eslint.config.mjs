import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

/** Vitest injects these when `globals: true` is set in the config. */
const vitestGlobals = {
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  vi: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly'
}

export default defineConfig([
  globalIgnores(['dist', 'coverage']),

  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  // Build and tooling config runs in Node, not the browser — `process` and
  // friends are legitimate there. `eslint .` covers these; `eslint src` did
  // not, which is why this only surfaced in CI.
  {
    files: ['*.config.{js,mjs,cjs}', 'pwa-assets.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },

  {
    files: ['src/**/*.{test,spec}.{js,jsx}', 'src/__tests__/**/*.{js,jsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node, ...vitestGlobals } },
  },
])
