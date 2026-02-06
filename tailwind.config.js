/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
    "!./node_modules/**",
    "!./src-tauri/**",
    "!./e2e/**",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        neo: {
          bg: 'var(--neo-bg)',
          panel: 'var(--neo-panel)',
          border: 'var(--neo-border)',
          primary: 'var(--neo-primary)',
          secondary: 'var(--neo-secondary)',
          accent: 'var(--neo-accent)',
          text: 'var(--neo-text)',
          dim: 'var(--neo-dim)',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    }
  },
  plugins: [],
}
