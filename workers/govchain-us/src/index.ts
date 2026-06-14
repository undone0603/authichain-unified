// GovChain.us - 2026 AI-Native Sovereign Protocol
// (c) 2026 AuthiChain Inc.

const BRANDS = {
  govchain: {
    name: 'GovChain',
    tagline: 'Sovereign Document Verification Protocol',
    primary: '#3b82f6',
    primaryDim: '#2563eb',
    secondary: '#facc15',
    bg: '#08080a',
    bg2: '#0c0c14',
    bg3: '#101423',
    text: '#f0f9ff',
    textDim: '#93c5fd',
    border: 'rgba(59,130,246,0.15)',
    borderDim: 'rgba(59,130,246,0.08)',
    glowRgba: 'rgba(59,130,246,0.1)',
    logoMark: 'GC',
    url: 'https://govchain.us',
  }
};

const FONTS_LINK = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">';

function cssVars(brand) {
  const b = BRANDS[brand];
  return `:root {
  --bg: ${b.bg};
  --bg2: ${b.bg2};
  --bg3: ${b.bg3};
  --primary: ${b.primary};
  --primary-dim: ${b.primaryDim};
  --secondary: ${b.secondary};
  --text: ${b.text};
  --text-dim: ${b.textDim};
  --border: ${b.border};
  --border-dim: ${b.borderDim};
  --radius-sq: 42px;
  --shadow-tactile: 0 20px 40px -10px rgba(0,0,0,0.5), 0 0 20px ${b.border};
}`;
}

const BASE_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); font-family: 'Outfit', sans-serif; line-height: 1.5; overflow-x: hidden; }
.bento-grid { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 240px; gap: 20px; max-width: 1200px; margin: 100px auto; padding: 0 24px; }
.tile { background: var(--bg2); border: 1px solid var(--border-dim); border-radius: var(--radius-sq); padding: 32px; position: relative; overflow: hidden; transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1); box-shadow: var(--shadow-tactile); }
.tile:hover { transform: translateY(-5px) scale(1.01); border-color: var(--primary); }
.tile-content { position: relative; z-index: 2; height: 100%; display: flex; flex-direction: column; }
.tile-tag { font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 700; text-transform: uppercase; color: var(--primary); letter-spacing: 0.2em; margin-bottom: 12px; }
.tile-title { font-family: 'Bebas Neue', sans-serif; font-size: 32px; line-height: 1; letter-spacing: 1px; margin-bottom: 12px; }
.tile-desc { font-size: 14px; color: var(--text-dim); font-weight: 300; }
.col-2 { grid-column: span 2; }
.row-2 { grid-row: span 2; }
.btn-sq { background: var(--primary); color: #fff; padding: 16px 32px; border-radius: 20px; text-decoration: none; font-weight: 900; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; display: inline-block; margin-top: auto; transition: transform 0.2s; }
.jit-search { background: rgba(255,255,255,0.05); border: 1px solid var(--border-dim); border-radius: 20px; padding: 10px 20px; color: var(--text); font-family: 'Outfit', sans-serif; font-size: 12px; width: 300px; outline: none; transition: border-color 0.2s; }
.jit-search:focus { border-color: var(--primary); }
nav { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; padding: 24px; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.8); backdrop-filter: blur(20px); }
.logo { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 2px; color: #fff; text-decoration: none; }
.logo span { color: var(--primary); }
`;

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GovChain — Sovereign Document Protocol</title>
  ${FONTS_LINK}
  <style>${cssVars('govchain')}${BASE_CSS}</style>
  <script>
    function handleJITSearch(e) {
      if (e.key === 'Enter') {
        const val = e.target.value.toLowerCase();
        let route = 'https://authichain-unified.vercel.app/governance';
        if (val.includes('art') || val.includes('qr')) route = 'https://qron.space';
        else if (val.includes('cannabis') || val.includes('metrc')) route = 'https://strainchain.io';
        else if (val.includes('enterprise') || val.includes('protocol')) route = 'https://authichain.com';
        window.location.href = route;
      }
    }
  </script>
</head>
<body>
  <nav>
    <a href="/" class="logo">GOV<span>CHAIN</span></a>
    <input type="text" class="jit-search" placeholder="JIT Engine: Type 'art' or 'cannabis'..." onkeydown="handleJITSearch(event)" />
    <a href="https://authichain-unified.vercel.app/governance" class="btn-sq" style="padding: 10px 20px; font-size: 9px">DAO Portal</a>
  </nav>

  <div class="bento-grid">
    <div class="tile col-2 row-2">
      <div class="tile-content">
        <div class="tile-tag">Sovereign 2026</div>
        <h1 class="tile-title" style="font-size: 84px;">PUBLIC<br><span style="color: var(--primary)">TRUST.</span></h1>
        <p class="tile-desc" style="font-size: 18px;">Government-grade verification for national supply chains. Cryptographic certainty for manufacturing and grants.</p>
        <a href="https://authichain-unified.vercel.app/governance" class="btn-sq" style="width: fit-content;">Access Grant Hub</a>
      </div>
      <div style="position: absolute; bottom: 10%; right: 10%; font-size: 120px; opacity: 0.05;">🦅</div>
    </div>

    <div class="tile">
      <div class="tile-content">
        <div class="tile-tag">Compliance</div>
        <div class="tile-title">NIST-NATIVE</div>
        <p class="tile-desc">SP 800-131A Compliant signatures.</p>
      </div>
    </div>

    <div class="tile">
      <div class="tile-content">
        <div class="tile-tag">Status</div>
        <div class="tile-title" style="color: #3b82f6;">AUTHORIZED</div>
        <p class="tile-desc">Federal Registry Active.</p>
      </div>
    </div>

    <div class="tile col-2">
      <div class="tile-content">
        <div class="tile-tag">Industrial</div>
        <div class="tile-title">MADE IN USA</div>
        <p class="tile-desc">EO 14392 compliant origin tracking for American manufacturers.</p>
      </div>
    </div>

    <div class="tile col-2">
      <div class="tile-content">
        <div class="tile-tag">Infrastructure</div>
        <div class="tile-title">SECURE EDGE</div>
        <p class="tile-desc">High-throughput blockchain anchoring for federal records.</p>
        <a href="https://authichain.com" class="btn-sq" style="background: #fff; color: #000;">Powered by AuthiChain</a>
      </div>
    </div>
  </div>

  <footer style="text-align: center; padding: 100px 24px; opacity: 0.5; font-size: 10px; letter-spacing: 2px; font-weight: 900; text-transform: uppercase;">
    GovChain — Sovereign Document Verification Protocol
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
