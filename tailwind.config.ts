import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: ["class"],
  content: ["./client/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: { DEFAULT: "#C9A227", light: "#E8C547", dark: "#A07D10" },
        background: "#0a0a0a",
        foreground: "#ededed",
        primary: { DEFAULT: "#C9A227", foreground: "#0a0a0a" },
        secondary: { DEFAULT: "#1a1a1a", foreground: "#ededed" },
        muted: { DEFAULT: "#1a1a1a", foreground: "#888888" },
        accent: { DEFAULT: "#C9A227", foreground: "#0a0a0a" },
        border: "#2a2a2a",
        card: { DEFAULT: "#111111", foreground: "#ededed" },
        destructive: { DEFAULT: "#ef4444", foreground: "#ffffff" },
      },
      fontFamily: {
        sans: ["Geist", "Geist Fallback", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
export default config;
