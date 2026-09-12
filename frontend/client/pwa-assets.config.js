// Run with `npm run generate-pwa-assets` after editing public/favicon.svg.
//
// The generator is fetched on demand (npx) rather than kept as a devDependency:
// it pulls in sharp (~50MB of platform binaries) that the deploy build would
// install on every push and never use, since the generated icons are committed.
//
// For the same reason this file exports a plain object instead of importing
// the package's `defineConfig` helper — that import cannot resolve when the
// generator lives in the npx cache rather than in node_modules.

// Brand purple — matches the tokens in src/index.css
const BRAND = '#7c3aed'

export default {
  headLinkOptions: { preset: '2023' },

  preset: {
    // Browser tab + PWA "any" icons — tile keeps its own rounded corners,
    // transparent outside them
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[48, 'favicon.ico']],
      padding: 0
    },

    // Android maskable — the launcher crops this to a circle or squircle.
    // Full bleed on a flat brand background: any padding would leave the
    // tile's gradient seaming against the fill.
    maskable: {
      sizes: [512],
      padding: 0,
      resizeOptions: { background: BRAND }
    },

    // iOS apple-touch-icon — full bleed, iOS rounds the corners itself
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions: { background: BRAND }
    }
  },

  images: ['public/favicon.svg']
}
