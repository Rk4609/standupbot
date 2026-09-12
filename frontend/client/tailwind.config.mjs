/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand — matches the PWA icon gradient (#8b5cf6 → #6d28d9)
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065'
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
        display: ['2.125rem', { lineHeight: '2.4rem', letterSpacing: '-0.025em' }],
        title: ['1.625rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],
        heading: ['1.125rem', { lineHeight: '1.6rem', letterSpacing: '-0.011em' }],
        metric: ['1.75rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }]
      },

      spacing: {
        sidebar: '15rem'
      },

      borderRadius: {
        card: '0.875rem'
      },

      boxShadow: {
        // Low-contrast elevation — reads on both light and dark surfaces
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        lift: '0 4px 12px -2px rgb(0 0 0 / 0.08), 0 2px 6px -2px rgb(0 0 0 / 0.06)',
        pop: '0 12px 32px -8px rgb(0 0 0 / 0.18)',
        brand: '0 6px 20px -6px rgb(124 58 237 / 0.5)'
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
