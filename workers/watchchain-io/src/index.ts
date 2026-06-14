// AuthiChain Vertical Factory - 2026 AI-Native Template
// (c) 2026 AuthiChain Inc.

const BRAND = {
  id: "watchchain-io",
  name: "WatchChain",
  tagline: "Luxury Timepiece Provenance",
  primary: "#d4af37",
  primaryDim: "#b8941f",
  bg: "#08080a",
  bg2: "#0c0c0f",
  border: "rgba(255,255,255,0.1)",
  url: "https://watchchain.io",
};

const FONTS_LINK = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">';

function cssVars() {
  return `:root {
  --bg: ${BRAND.bg};
  --bg2: ${BRAND.bg2};
  --primary: ${BRAND.primary};
  --primary-dim: ${BRAND.primaryDim};
  --text: #f8fafc;
  --text-dim: #94a3b8;
  --border: ${BRAND.border};
  --radius-sq: 42px;
  --shadow-tactile: 0 20px 40px -10px rgba(0,0,0,0.5), 0 0 20px ${BRAND.border};
}`;
}

const BASE_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Outfit', sans-serif;
  line-height: 1.5;
  overflow-x: hidden;
}
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 240px;
  gap: 20px;
  max-width: 1200px;
  margin: 100px auto;
  padding: 0 24px;
}
.tile {
  background: var(--bg2);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: var(--radius-sq);
  padding: 32px;
  position: relative;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
  box-shadow: var(--shadow-tactile);
}
.tile:hover {
  transform: translateY(-5px) scale(1.01);
  border-color: var(--primary);
}
.tile-content { position: relative; z-index: 2; height: 100%; display: flex; flex-direction: column; }
.tile-tag { font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 700; text-transform: uppercase; color: var(--primary); letter-spacing: 0.2em; margin-bottom: 12px; }
.tile-title { font-family: 'Bebas Neue', sans-serif; font-size: 32px; line-height: 1; letter-spacing: 1px; margin-bottom: 12px; }
.tile-desc { font-size: 14px; color: var(--text-dim); font-weight: 300; }
.col-2 { grid-column: span 2; }
.row-2 { grid-row: span 2; }
.btn-sq {
  background: var(--primary);
  color: #000;
  padding: 16px 32px;
  border-radius: 20px;
  text-decoration: none;
  font-weight: 900;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  display: inline-block;
  margin-top: auto;
  transition: transform 0.2s;
}
nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
  padding: 24px; display: flex; justify-content: space-between; align-items: center;
  background: rgba(0,0,0,0.8); backdrop-filter: blur(20px);
}
.logo { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 2px; color: #fff; text-decoration: none; }
.logo span { color: var(--primary); }
`;

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${BRAND.name} — The Truth Layer for Luxury Watches</title>
  ${FONTS_LINK}
  <style>${cssVars()}${BASE_CSS}</style>
</head>
<body>
  <nav>
    <a href="/" class="logo">${BRAND.name.toUpperCase()}</a>
    <a href="https://authichain-unified.vercel.app/login" class="btn-sq" style="padding: 10px 20px; font-size: 9px">Console</a>
  </nav>

  <div class="bento-grid">
    <div class="tile col-2 row-2">
      <div class="tile-content">
        <div class="tile-tag">${BRAND.name} Vertical</div>
        <h1 class="tile-title" style="font-size: 84px;">${BRAND.tagline}</h1>
        <p class="tile-desc" style="font-size: 18px;">Powered by the AuthiChain Truth Layer. Industry-specific cryptographic verification.</p>
        <a href="https://authichain-unified.vercel.app/dashboard" class="btn-sq" style="width: fit-content;">Launch Platform</a>
      </div>
      <div style="position: absolute; bottom: -20px; right: -20px; width: 300px; height: 300px; background: radial-gradient(circle, var(--primary) 0%, transparent 70%); opacity: 0.1; filter: blur(40px);"></div>
    </div>

    <div class="tile">
      <div class="tile-content">
        <div class="tile-tag">Protocol</div>
        <div class="tile-title">SECURE</div>
        <p class="tile-desc">Tamper-proof blockchain signatures.</p>
      </div>
    </div>

    <div class="tile">
      <div class="tile-content">
        <div class="tile-tag">Global</div>
        <div class="tile-title">SCALABLE</div>
        <p class="tile-desc">Cloudflare Edge delivery.</p>
      </div>
    </div>

    <div class="tile col-2">
      <div class="tile-content">
        <div class="tile-tag">Trust</div>
        <div class="tile-title">AI-NATIVE FORENSICS</div>
        <p class="tile-desc">Multi-model visual verification for Luxury Watches.</p>
      </div>
    </div>

    <div class="tile col-2">
      <div class="tile-content">
        <div class="tile-tag">Ecosystem</div>
        <div class="tile-title">UNIFIED BACKEND</div>
        <p class="tile-desc">Seamless integration with the AuthiChain treasury and governance.</p>
        <a href="https://authichain.com" class="btn-sq" style="background: #fff; color: #000;">Powered by AuthiChain</a>
      </div>
    </div>
  </div>

  <footer style="text-align: center; padding: 100px 24px; opacity: 0.5; font-size: 10px; letter-spacing: 2px; font-weight: 900; text-transform: uppercase;">
    ${BRAND.name} — A Protocol Vertical of AuthiChain
  </footer>
</body>
</html>`;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return new Response('OK', { status: 200 });
    return new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
};
