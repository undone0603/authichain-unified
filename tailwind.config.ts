// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./client/src/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ── AuthiChain Unified Color Palette ─────────────────────────────────
      colors: {
        primary:   '#0A0F1E',   // Deep navy  — base/background
        accent:    '#00FFD1',   // Cyan/teal  — AuthiChain brand, CTAs
        secondary: '#6C3BFF',   // Purple     — NFT/crypto elements
        govchain:  '#1B4FD8',   // Gov blue   — govchain.us
        strain:    '#22C55E',   // Green      — StrainChain cannabis
        qron:      '#F59E0B',   // Amber      — QRON QR art
        surface:   '#111827',   // Card bg
        muted:     '#374151',   // Muted text/borders
        border:    '#1F2937',   // Default border
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse':  'glow-pulse 2s ease-in-out infinite alternate',
        'scan-line':   'scan-line 2s linear infinite',
        'fade-in':     'fade-in 0.5s ease-out forwards',
        'slide-up':    'slide-up 0.4s ease-out forwards',
      },
      keyframes: {
        'glow-pulse': {
          '0%':   { boxShadow: '0 0 5px rgba(0,255,209,0.2)' },
          '100%': { boxShadow: '0 0 30px rgba(0,255,209,0.6)' },
        },
        'scan-line': {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'grid-pattern': "url(\"data:image/svg+xml,%3Csvg width='30' height='30' viewBox='0 0 30 30' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h30v1H0zM0 0v30h1V0z' fill='%231f2937' fill-opacity='0.4'/%3E%3C/svg%3E\")",
        'hero-glow':     'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,255,209,0.12) 0%, transparent 60%)',
        'govchain-glow': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(27,79,216,0.18) 0%, transparent 60%)',
      },
    },
  },
  plugins: [],
};

export default config;
