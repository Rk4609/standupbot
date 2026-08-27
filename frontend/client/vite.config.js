import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      manifest: {
        name: 'StandupBot',
        short_name: 'StandupBot',
        description: 'StandupBot Application',

        theme_color: '#863BFF',
        background_color: '#FFFFFF',

        display: 'standalone',
        start_url: '/',

        icons: [
          {
            src: '/icons/rk.png',
            sizes: 'any',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      }
    })
  ],

  server: {
    port: 5173
  }
})