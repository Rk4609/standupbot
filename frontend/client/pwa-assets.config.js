import { defineConfig } from '@vite-pwa/assets-generator/config'

// Brand purple — index.css/Tailwind ke purple-600 se match karta hai
const BRAND = '#7c3aed'

export default defineConfig({
  headLinkOptions: { preset: '2023' },

  preset: {
    // Browser tab + PWA "any" icons — tile ke apne rounded corners,
    // uske bahar transparent
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[48, 'favicon.ico']],
      padding: 0
    },

    // Android maskable — icon ko circle/squircle mein crop karta hai.
    // Robot ko safe-zone ke andar rakhne ke liye 10% padding, aur
    // background brand purple taaki koi safed ring na dikhe.
    maskable: {
      sizes: [512],
      padding: 0,
      resizeOptions: { background: BRAND }
    },

    // iOS apple-touch-icon — full bleed, iOS khud corners round karta hai
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions: { background: BRAND }
    }
  },

  images: ['public/favicon.svg']
})
