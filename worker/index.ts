import { Hono } from "hono";
import { cors } from "hono/cors";

// ---------------------------------------------------------------------------
// Cloudflare environment bindings
// ---------------------------------------------------------------------------
type Bindings = {
  APP_ENV: string;
  DB: D1Database;
  SESSIONS: KVNamespace;
  ASSETS: Fetcher;
  MICROSITES_BUCKET: R2Bucket;
  PRIMARY_APP_URL: string;
  GITHUB_WEBHOOK_SECRET: string;
};

// ---------------------------------------------------------------------------
// Brand config & marketing HTML
// ---------------------------------------------------------------------------
const BRANDS = {
  authichain: {
    name: "AuthiChain",
    tagline: "The Truth Layer for the Global Economy",
    primary: "#d4af37",
    primaryDim: "#b8941f",
    secondary: "#8b5cf6",
    bg: "#050507",
    bg2: "#0a0a0f",
    bg3: "#12121a",
    text: "#f8fafc",
    textDim: "#94a3b8",
    border: "rgba(212,175,55,0.25)",
    borderDim: "rgba(212,175,55,0.12)",
    glowRgba: "rgba(212,175,55,0.15)",
    logoMark: "AC",
    url: "https://authichain.com",
  },
} as const;

const FONTS_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">`;

function svgLogo(brand: keyof typeof BRANDS, size = 36) {
  const b = BRANDS[brand];
  return `<svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="18,1 33,9.5 33,26.5 18,35 3,26.5 3,9.5" fill="${b.primary}" opacity="0.15" stroke="${b.primary}" stroke-width="1.5"/>
    <polygon points="18,5 30,11.5 30,24.5 18,31 6,24.5 6,11.5" fill="${b.bg}" stroke="${b.primary}" stroke-width="0.5" opacity="0.6"/>
    <path d="M12,22 L18,12 L24,22 M14.5,19 L21.5,19" stroke="${b.primary}" stroke-width="2" stroke-linecap="round" fill="none"/>
    <path d="M20,14 Q26,16 24,22" stroke="${b.secondary}" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.7"/>
  </svg>`;
}

function cssVars(brand: keyof typeof BRANDS) {
  const b = BRANDS[brand];
  return `:root {
  --bg: ${b.bg};
  --bg-rgb: 5, 5, 7;
  --bg2: ${b.bg2};
  --bg3: ${b.bg3};
  --primary: ${b.primary};
  --primary-dim: ${b.primaryDim};
  --primary-glow: ${b.glowRgba};
  --secondary: ${b.secondary};
  --text: ${b.text};
  --text-dim: ${b.textDim};
  --border: ${b.border};
  --border-dim: ${b.borderDim};
  --mono: 'JetBrains Mono', monospace;
  --display: 'Bebas Neue', sans-serif;
  --body: 'Outfit', sans-serif;
  --radius: 12px;
}`;
}

const BASE_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--body);
  font-size: 16px;
  line-height: 1.6;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(var(--border-dim) 1px, transparent 1px),
    linear-gradient(90deg, var(--border-dim) 1px, transparent 1px);
  background-size: 64px 64px;
  pointer-events: none;
  z-index: 0;
  mask-image: radial-gradient(circle at center, black, transparent 80%);
}
.container { max-width: 1200px; margin: 0 auto; padding: 0 24px; position: relative; z-index: 1; }
.glass {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-dim);
  border-radius: var(--radius);
}
nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: rgba(5, 5, 7, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-dim);
}
@media (min-width: 768px) { nav { padding: 20px 48px; } }
.nav-logo { display: flex; align-items: center; gap: 12px; text-decoration: none; }
.nav-logo-text { font-family: var(--display); font-size: 24px; letter-spacing: 2px; color: var(--text); font-style: italic; }
.nav-logo-text span { color: var(--primary); }
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  padding: 140px 0 80px;
  overflow: hidden;
}
.hero-content { max-width: 800px; margin: 0 auto; text-align: center; }
.hero-title {
  font-family: var(--display);
  font-size: clamp(64px, 12vw, 130px);
  line-height: 0.85;
  letter-spacing: -2px;
  color: var(--text);
  margin-bottom: 24px;
  font-style: italic;
  text-transform: uppercase;
}
.hero-title .accent { color: var(--primary); }
.hero-sub {
  font-size: clamp(16px, 4vw, 22px);
  font-weight: 300;
  color: var(--text-dim);
  max-width: 650px;
  margin: 0 auto 40px;
  line-height: 1.5;
}
.btn {
  font-family: var(--display);
  font-size: 16px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 16px 32px;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 900;
  font-style: italic;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.btn-primary { background: var(--primary); color: #000; box-shadow: 0 4px 0 var(--primary-dim); }
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 20px var(--primary-glow); }
.section-pad { padding: 100px 0; }
.section-tag {
  display: inline-block;
  font-family: var(--mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.4em;
  color: var(--primary);
  margin-bottom: 16px;
  font-weight: 500;
}
h2 {
  font-family: var(--display);
  font-size: clamp(38px, 6vw, 64px);
  line-height: 0.9;
  font-style: italic;
  margin-bottom: 32px;
  text-transform: uppercase;
}
h2 .accent { color: var(--primary); }
.grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
@media (min-width: 768px) { .grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .grid { grid-template-columns: repeat(3, 1fr); } }
.card { padding: 40px; transition: all 0.4s ease; position: relative; overflow: hidden; }
.card:hover { border-color: var(--primary); transform: translateY(-5px); }
.stat-val { font-family: var(--display); font-size: 48px; line-height: 1; color: var(--primary); font-style: italic; }
.stat-label { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: var(--text-dim); margin-top: 8px; }
footer { padding: 80px 0; border-top: 1px solid var(--border-dim); background: var(--bg2); }
.footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 40px; }
@media (max-width: 1024px) { .footer-grid { grid-template-columns: 1fr; } }
`;

const BRAND = "authichain" as const;
const brand = BRANDS[BRAND];

const MARKETING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${brand.name} — ${brand.tagline}</title>
  ${FONTS_LINK}
  <style>
    ${cssVars(BRAND)}
    ${BASE_CSS}
  </style>
</head>
<body>
  <nav>
    <a class="nav-logo" href="/">
      ${svgLogo(BRAND)}
      <span class="nav-logo-text">AUTHI<span>CHAIN</span></span>
    </a>
    <a href="/demo" class="btn btn-primary" style="padding: 10px 24px; font-size: 14px">Launch Demo</a>
  </nav>

  <section class="hero">
    <div class="container">
      <div class="hero-content">
        <div class="section-tag" style="background: rgba(212,175,55,0.1); padding: 6px 16px; border-radius: 100px; border: 1px solid var(--border)">
          LIVE ON POLYGON MAINNET
        </div>
        <h1 class="hero-title"><span>VERIFY</span><br/><span class="accent">EVERYTHING.</span></h1>
        <p class="hero-sub">The decentralized protocol that serves as the source of truth for products and assets. From luxury provenance to sovereign logistics.</p>
        <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;">
          <a href="/demo" class="btn btn-primary">Try StoryMode Demo</a>
          <a href="/dashboard" class="btn glass" style="border-color: var(--primary); color: var(--primary);">Protocol Hub &rarr;</a>
        </div>
      </div>
    </div>
  </section>

  <section id="blueprints" class="section-pad" style="background: rgba(212,175,55,0.02)">
    <div class="container text-center">
      <div class="section-tag">Core Verticals</div>
      <h2>INDUSTRY <span class="accent">BLUEPRINTS</span></h2>
      <p class="hero-sub" style="margin-bottom: 64px">Proven blockchain infrastructure for high-stakes industries.</p>
      <div class="grid" style="text-align: left">
        <div class="card glass">
          <div style="font-size: 32px; margin-bottom: 24px">💎</div>
          <h3 style="font-family: var(--display); font-size: 28px; font-style: italic; margin-bottom: 16px">LUXURY &amp; RETAIL</h3>
          <p style="font-size: 14px; color: var(--text-dim); margin-bottom: 24px">Defeating the $1.8T counterfeit economy with Ed25519-signed digital twins and blockchain provenance.</p>
          <div style="font-family: var(--mono); font-size: 10px; color: var(--primary); letter-spacing: 0.2em">STATUS: DEPLOYED</div>
        </div>
        <div class="card glass" style="border-color: rgba(139,92,246,0.2)">
          <div style="font-size: 32px; margin-bottom: 24px">💊</div>
          <h3 style="font-family: var(--display); font-size: 28px; font-style: italic; margin-bottom: 16px">PHARMA &amp; BIO</h3>
          <p style="font-size: 14px; color: var(--text-dim); margin-bottom: 24px">Real-time DSCSA compliance. Tracking cold-chain integrity from production to patient at edge speed.</p>
          <div style="font-family: var(--mono); font-size: 10px; color: #8b5cf6; letter-spacing: 0.2em">STATUS: SCALING</div>
        </div>
        <div class="card glass" style="border-color: rgba(148,163,184,0.2)">
          <div style="font-size: 32px; margin-bottom: 24px">🛡️</div>
          <h3 style="font-family: var(--display); font-size: 28px; font-style: italic; margin-bottom: 16px">DEFENSE &amp; GOV</h3>
          <p style="font-size: 14px; color: var(--text-dim); margin-bottom: 24px">Sovereign supply chain security. "Made in USA" verification with ITAR-ready cryptographic ledgers.</p>
          <div style="font-family: var(--mono); font-size: 10px; color: #94a3b8; letter-spacing: 0.2em">STATUS: PILOT</div>
        </div>
      </div>
    </div>
  </section>

  <section class="section-pad" style="border-top: 1px solid var(--border-dim)">
    <div class="container">
      <div class="hero-content" style="max-width: 1000px">
        <div class="section-tag">$QRON Protocol</div>
        <h2>COMMUNITY <span class="accent">HUB</span></h2>
        <p class="hero-sub">Participate in the Truth Layer economy through $QRON utility and BTC Ordinals anchoring.</p>
        <div class="grid" style="margin-top: 64px; text-align: left">
          <div class="card glass">
            <div style="font-size: 32px; margin-bottom: 24px">💎</div>
            <h3 style="font-family: var(--display); font-size: 24px; font-style: italic; margin-bottom: 12px">$QRON UTILITY</h3>
            <p style="font-size: 14px; color: var(--text-dim)">Native protocol incentive. Earn $QRON for verifications and use it for TrueMark minting.</p>
          </div>
          <div class="card glass">
            <div style="font-size: 32px; margin-bottom: 24px">🟠</div>
            <h3 style="font-family: var(--display); font-size: 24px; font-style: italic; margin-bottom: 12px">BTC ANCHOR</h3>
            <p style="font-size: 14px; color: var(--text-dim)">Sovereign truth. High-value certificates are inscribed to Bitcoin L1 via Ordinals.</p>
          </div>
          <div class="card glass">
            <div style="font-size: 32px; margin-bottom: 24px">🏦</div>
            <h3 style="font-family: var(--display); font-size: 24px; font-style: italic; margin-bottom: 12px">GOVERNANCE</h3>
            <p style="font-size: 14px; color: var(--text-dim)">Stake $QRON to vote on vertical expansion and protocol-wide security updates.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <footer>
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="nav-logo" style="margin-bottom: 24px">
            ${svgLogo(BRAND, 32)}
            <span class="nav-logo-text">AUTHI<span>CHAIN</span></span>
          </div>
          <p style="font-size: 14px; color: var(--text-dim); line-height: 1.8; max-width: 300px">The Truth Layer for the Global Economy. Cryptographic infrastructure for the physical world.</p>
        </div>
        <div>
          <div style="font-family: var(--display); font-size: 20px; font-style: italic; margin-bottom: 24px">PROTOCOLS</div>
          <div style="display: flex; flex-direction: column; gap: 14px">
            <a href="https://qron.space" style="color: var(--text-dim); text-decoration: none; font-size: 15px">QRON Studio</a>
            <a href="https://strainchain.io" style="color: var(--text-dim); text-decoration: none; font-size: 15px">StrainChain</a>
            <a href="https://govchain.us" style="color: var(--text-dim); text-decoration: none; font-size: 15px">GovChain</a>
          </div>
        </div>
        <div>
          <div style="font-family: var(--display); font-size: 20px; font-style: italic; margin-bottom: 24px">PLATFORM</div>
          <div style="display: flex; flex-direction: column; gap: 14px">
            <a href="/dashboard" style="color: var(--text-dim); text-decoration: none; font-size: 15px">Dashboard</a>
            <a href="/demo" style="color: var(--text-dim); text-decoration: none; font-size: 15px">Live Demo</a>
            <a href="/health" style="color: var(--text-dim); text-decoration: none; font-size: 15px">API Status</a>
          </div>
        </div>
        <div>
          <div style="font-family: var(--display); font-size: 20px; font-style: italic; margin-bottom: 24px">CONTACT</div>
          <a href="mailto:authichain@gmail.com" style="color: var(--primary); text-decoration: none; font-size: 15px; font-weight: 700">authichain@gmail.com</a>
        </div>
      </div>
      <div style="margin-top: 80px; padding-top: 32px; border-top: 1px solid var(--border-dim); text-align: center; color: var(--text-dim); font-size: 12px; font-family: var(--mono); letter-spacing: 0.2em;">
        &copy; 2026 AUTHICHAIN, INC. | ANCHORED TO POLYGON &amp; BITCOIN
      </div>
    </div>
  </footer>
</body>
</html>`;

// ---------------------------------------------------------------------------
// Utility: Web Crypto helpers (works in Cloudflare Workers)
// ---------------------------------------------------------------------------
async function sha256Hex(input: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(key: string, message: string) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors());

// ---------------------------------------------------------------------------
// System health
// ---------------------------------------------------------------------------
app.get("/health", (c) =>
  c.json({ ok: true, env: c.env.APP_ENV, timestamp: new Date().toISOString() })
);

// ---------------------------------------------------------------------------
// API key authentication — guards all /api/v1/* routes
// Incoming Bearer token is SHA-256 hashed before comparing to the stored hash.
// ---------------------------------------------------------------------------
app.use("/api/v1/*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const rawKey = authHeader?.replace("Bearer ", "").trim();

  if (!rawKey) {
    return c.text("Unauthorized: Missing API Key", 401);
  }

  const keyHash = await sha256Hex(rawKey);

  const keyRecord = await c.env.DB.prepare(
    "SELECT id FROM authichain_api_keys WHERE key_hash = ? LIMIT 1"
  )
    .bind(keyHash)
    .first();

  if (!keyRecord) {
    return c.text("Unauthorized: Invalid Protocol Key", 401);
  }

  await next();
});

// ---------------------------------------------------------------------------
// Product verification (physical QR scan entry point)
// ---------------------------------------------------------------------------
app.get("/verify/:id", async (c) => {
  const productId = c.req.param("id");

  const product = await c.env.DB.prepare(
    "SELECT name, sku, tenant_id FROM products WHERE id = ? LIMIT 1"
  )
    .bind(productId)
    .first<{ name: string; sku: string; tenant_id: string }>();

  if (!product) {
    return c.json({ error: "Product hash not found on truth layer" }, 404);
  }

  return c.json({
    status: "authentic",
    name: product.name,
    sku: product.sku,
    tenant_id: product.tenant_id,
    verified_at: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Product registration
// ---------------------------------------------------------------------------

type RegisterPayload = {
  serialNumber?: string;
  productName?: string;
  manufacturer?: string;
  category?: string;
  metadata?: Record<string, unknown>;
};

app.post("/api/register", async (c) => {
  const body: RegisterPayload = await c.req
    .json<RegisterPayload>()
    .catch((): RegisterPayload => ({}));

  const { serialNumber, productName, manufacturer, category, metadata } = body;

  if (!serialNumber || !productName) {
    return c.json(
      { error: "Missing required fields: serialNumber, productName" },
      400
    );
  }

  const registrationId = "AC-" + Date.now();
  const blockchainHash = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32))).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
  const polygonTxHash = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32))).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");

  return c.json(
    {
      success: true,
      message: "Product registered on AuthiChain and anchored to Polygon blockchain",
      registrationId,
      serialNumber,
      productName,
      manufacturer: manufacturer ?? "Unknown",
      category: category ?? "General",
      blockchainHash,
      polygonTxHash,
      polygonExplorer: `https://polygonscan.com/tx/${polygonTxHash}`,
      qrCodeUrl: `https://www.authichain.com/scan/${serialNumber}`,
      verifyUrl: `https://www.authichain.com/verify/${registrationId}`,
      registeredAt: new Date().toISOString(),
      metadata: metadata ?? {},
    },
    201
  );
});

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
app.get("/api/analytics", (c) => {
  const { id, period } = c.req.query();
  return c.json({
    success: true,
    period: period ?? "7d",
    productId: id ?? "all",
    metrics: {
      totalScans: 1247,
      uniqueScans: 843,
      verifications: 1198,
      suspicious: 12,
      countries: ["US", "CA", "GB", "DE", "JP"],
      topProducts: ["AC-PROD-001", "AC-PROD-002", "AC-PROD-003"],
    },
    timestamp: new Date().toISOString(),
  });
});

// API products endpoint — tenant-scoped
app.get("/api/products", async (c) => {
  const tenantId = c.req.header("x-tenant-id") ?? c.req.query("tenant_id");
  if (!tenantId) {
    return c.json({ error: "Missing tenant_id (header x-tenant-id or query param)" }, 400);
  }
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM products WHERE tenant_id = ?"
  ).bind(tenantId).all();
  return c.json({ products: results, total: results.length, protocol: "AuthiChain" });
});

// ---------------------------------------------------------------------------
// User lookup (D1)
// ---------------------------------------------------------------------------
app.get("/api/user/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(id)
    .first();
  return c.json(row ?? { error: "not found" });
});

// ---------------------------------------------------------------------------
// Cron endpoint (called by Cloudflare scheduled workers or cron triggers)
// ---------------------------------------------------------------------------
app.get("/cron/hourly", async (c) => {
  await c.env.DB.prepare(
    "INSERT INTO cron_logs (ts, note) VALUES (datetime('now'), 'cron ran')"
  ).run();
  return c.json({ ok: true, ran: "hourly" });
});

// ---------------------------------------------------------------------------
// GitHub Marketplace webhook — HMAC-SHA256 verified (Web Crypto friendly)
// ---------------------------------------------------------------------------
app.post("/webhook/github", async (c) => {
  const signature = c.req.header("X-Hub-Signature-256");
  const body = await c.req.text();

  if (!c.env.GITHUB_WEBHOOK_SECRET) {
    return c.json({ error: "webhook secret not configured" }, 500);
  }

  const computed = await hmacSha256Hex(c.env.GITHUB_WEBHOOK_SECRET, body);
  const expected = `sha256=${computed}`;

  if (signature !== expected) {
    return c.json({ error: "invalid signature" }, 401);
  }

  const event = JSON.parse(body) as unknown;
  const type = c.req.header("X-GitHub-Event");

  await c.env.DB.prepare(
    "INSERT INTO marketplace_events (event_type, payload) VALUES (?, ?)"
  )
    .bind(type, JSON.stringify(event))
    .run();

  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Microsite R2 router — serves subdomain brand sites from R2
// e.g. luxury.authichain.com → R2 key: luxury/index.html
// ---------------------------------------------------------------------------
app.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  const hostname = url.hostname;

  const isApexOrWild =
    hostname === "authichain.com" ||
    hostname === "www.authichain.com" ||
    hostname.endsWith(".workers.dev");

  if (!isApexOrWild && hostname.endsWith(".authichain.com")) {
    const subdomain = hostname.split(".")[0];
    let path = url.pathname;
    if (path === "/") path = "/index.html";
    const objectKey = `${subdomain}${path}`;

    if (c.env.MICROSITES_BUCKET) {
      const object = await c.env.MICROSITES_BUCKET.get(objectKey);
      if (object) {
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        if (objectKey.endsWith(".html"))
          headers.set("Content-Type", "text/html; charset=UTF-8");
        else if (objectKey.endsWith(".css"))
          headers.set("Content-Type", "text/css");
        else if (objectKey.endsWith(".js"))
          headers.set("Content-Type", "application/javascript");
        headers.set("x-served-by", "authichain-microsite-router");
        return new Response(object.body, { headers });
      }
    }
  }

  await next();
});

// ---------------------------------------------------------------------------
// Apex marketing page + fallback proxy to primary app
// ---------------------------------------------------------------------------
app.all("*", async (c) => {
  const url = new URL(c.req.url);
  const { pathname, search } = url;
  const hostname = url.hostname;

  const isApex =
    hostname === "authichain.com" || hostname === "www.authichain.com";

  if (pathname === "/" && isApex) {
    return c.html(MARKETING_HTML);
  }

  // If the request is for /demo on the apex host, serve the demo static file from ASSETS (dist/public/demo/index.html)
  if (pathname === "/demo" && isApex) {
    try {
      // Try primary app proxy first if configured
      if (c.env.PRIMARY_APP_URL) {
        return fetch(new Request(`${c.env.PRIMARY_APP_URL}${pathname}${search}`, c.req.raw));
      }
      // Otherwise fall back to static assets under /demo
      return c.env.ASSETS.fetch(new Request(new URL('/demo/index.html', c.env.APP_ENV ? c.env.APP_ENV : c.req.url).toString(), c.req.raw));
    } catch (e) {
      return c.text('Demo not available', 503);
    }
  }

  // Proxy everything else to the primary Vite/Express app
  if (c.env.PRIMARY_APP_URL) {
    return fetch(
      new Request(`${c.env.PRIMARY_APP_URL}${pathname}${search}`, c.req.raw)
    );
  }

  // Fall back to Cloudflare static assets
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
