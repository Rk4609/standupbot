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
      },

      workbox: {
        runtimeCaching: [
          {
            // StandupBot backend API cache
            urlPattern: /^https:\/\/standupbot-backend\.onrender\.com\/api\/.*$/i,

            handler: 'NetworkFirst',

            options: {
              cacheName: 'standupbot-api-cache',

              networkTimeoutSeconds: 10,

              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24
              },

              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],

  server: {
    port: 5173
  }
})