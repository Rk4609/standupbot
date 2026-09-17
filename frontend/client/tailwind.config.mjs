/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /**
         * Brand — warm yellow for highlights, near-black for action.
         *
         * The scale is split on purpose rather than being one hue light to
         * dark. The design this follows uses yellow to mark what matters and
         * black for the thing you press, so the light steps are the yellow
         * (chips, active states, focus, the dark theme's accent) and the
         * steps components use for filled buttons and links are ink. A yellow
         * button with white text would fail contrast; a black one reads.
         */
        brand: {
          50: '#fefaeb',
          100: '#fdf1c4',
          200: '#fbe48c',
          300: '#f8d65a',
          400: '#f5c93a',
          500: '#e9b20c',
          600: '#1c1c1a',
          700: '#131312',
          800: '#0d0d0c',
          900: '#262521',
          950: '#1a1917'
        },

        // Semantic tokens — defined in index.css, flipped by .dark
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          muted: 'rgb(var(--surface-muted) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
          sunken: 'rgb(var(--surface-sunken) / <alpha-value>)'
        },
        line: {
          DEFAULT: 'rgb(var(--line) / <alpha-value>)',
          strong: 'rgb(var(--line-strong) / <alpha-value>)'
        },
        content: {
          DEFAULT: 'rgb(var(--content) / <alpha-value>)',
          muted: 'rgb(var(--content-muted) / <alpha-value>)',
          subtle: 'rgb(var(--content-subtle) / <alpha-value>)'
        }
      },

      // Type scale — headings get tighter tracking as they grow, which is what
      // makes large text read as designed rather than merely enlarged
      fontSize: {
        // The big light figures and greeting — thin at size, the way the
        // design sets them, rather than bold and shouting
        hero: ['2.75rem', { lineHeight: '3rem', letterSpacing: '-0.035em' }],
        display: ['1.75rem', { lineHeight: '2.1rem', letterSpacing: '-0.022em' }],
        title: ['1.5rem', { lineHeight: '1.9rem', letterSpacing: '-0.02em' }],
        heading: ['1.125rem', { lineHeight: '1.6rem', letterSpacing: '-0.011em' }],
        metric: ['1.75rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }]
      },

      spacing: {
        sidebar: '15rem'
      },

      borderRadius: {
        // Large and soft — the cards read as panels on a canvas, not boxes
        card: '1.5rem'
      },

      boxShadow: {
        // Low-contrast elevation — reads on both light and dark surfaces
        card: '0 1px 2px 0 rgb(40 34 20 / 0.04), 0 8px 24px -12px rgb(40 34 20 / 0.12)',
        lift: '0 12px 28px -12px rgb(40 34 20 / 0.22)',
        pop: '0 18px 40px -12px rgb(20 18 12 / 0.28)',
        brand: '0 8px 20px -8px rgb(20 18 12 / 0.45)'
      },

      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' }
        }
      },

      animation: {
        shimmer: 'shimmer 1.6s infinite'
      }
    }
  },
  plugins: []
}
