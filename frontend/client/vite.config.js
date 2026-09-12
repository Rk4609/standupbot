import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Regex special chars escape karo taaki URL literal match ho
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export default defineConfig(({ mode }) => {
  // loadEnv .env files aur process.env dono se padhta hai
  // (Vercel/Render build-time env vars process.env mein aate hain)
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  // src/api/axios.js ka same fallback — dono jagah consistent rehna chahiye
  const apiBase = (env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '')

  const apiPattern = new RegExp(`^${escapeRegex(apiBase)}/`, 'i')
  const authPattern = new RegExp(`^${escapeRegex(apiBase)}/auth/`, 'i')

  console.log(`[pwa] API cache pattern: ${apiPattern}`)

  return {
    plugins: [
      react(),

      VitePWA({
        registerType: 'autoUpdate',

        manifest: {
          id: '/',
          name: 'StandupBot — Async Daily Standups',
          short_name: 'StandupBot',
          description:
            'Submit daily standups, track blockers and keep your team aligned — without another meeting.',

          theme_color: '#7c3aed',
          background_color: '#ffffff',

          display: 'standalone',
          start_url: '/',
          scope: '/',

          lang: 'en',
          dir: 'ltr',
          categories: ['productivity', 'business'],

          // `npm run generate-pwa-assets` se banaye gaye — pwa-assets.config.js dekho
          icons: [
            {
              src: '/pwa-64x64.png',
              sizes: '64x64',
              type: 'image/png'
            },
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              // Android isko circle/squircle mein crop karta hai —
              // iske bina icon ke peeche safed box lagta hai
              src: '/maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ],

          // Home screen icon long-press pe dikhte hain
          shortcuts: [
            {
              name: 'Submit daily standup',
              short_name: 'New Standup',
              url: '/standup/new',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
            },
            {
              name: 'My standup history',
              short_name: 'History',
              url: '/history',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
            }
          ]
        },

        workbox: {
          runtimeCaching: [
            {
              // Auth endpoints (login/register/reset) — kabhi cache mat karo
              // Yeh rule pehle aana chahiye, workbox first-match-wins hai
              urlPattern: authPattern,
              handler: 'NetworkOnly'
            },
            {
              // StandupBot backend API cache — sirf GET reads
              urlPattern: apiPattern,

              method: 'GET',

              handler: 'NetworkFirst',

              options: {
                cacheName: 'standupbot-api-cache',

                networkTimeoutSeconds: 10,

                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24
                },

                // 0 (opaque) hata diya — sirf successful responses cache ho
                cacheableResponse: {
                  statuses: [200]
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
  }
})
