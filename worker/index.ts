import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  APP_ENV: string;
  DB: D1Database;
  SESSIONS: KVNamespace;
  ASSETS: Fetcher;
  MICROSITES_BUCKET: R2Bucket;
  PRIMARY_APP_URL: string;
  GITHUB_WEBHOOK_SECRET: string;
};

const BRANDS = {
  authichain: {
    name: "AuthiChain",
    tagline: "The Truth Layer for the Global Economy",
    primary: "#d4af37",
    primaryDim: "#b8952d",
    secondary: "#1a1a1a",
    bg: "#050505",
    bg2: "#0d0d0d",
    bg3: "#151515",
    text: "#ffffff",
    textDim: "#a0a0a0",
    border: "rgba(212,175,55,0.15)",
    borderDim: "rgba(212,175,55,0.12)",
    glowRgba: "rgba(212,175,55,0.15)",
    logoMark: "AC",
    url: "https://authichain.com",
  },
} as const;

function cssVars(brand: keyof typeof BRANDS) {
  const b = BRANDS[brand];
  return `:root {
    --bg: \${b.bg};
    --bg2: \${b.bg2};
    --bg3: \${b.bg3};
    --text: \${b.text};
    --text-dim: \${b.textDim};
    --primary: \${b.primary};
    --primary-dim: \${b.primaryDim};
    --secondary: \${b.secondary};
    --border: \${b.border};
    --border-dim: \${b.borderDim};
    --primary-glow: \${b.glowRgba};
    --mono: 'JetBrains Mono', monospace;
    --display: 'Bebas Neue', cursive;
    --body: 'Outfit', sans-serif;
    --radius: 12px;
  }`;
}

const app = new Hono<{ Bindings: Bindings }>();
app.use("*", cors());

app.get("/", (c) => {
  return c.html("<h1>AuthiChain</h1>");
});

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
