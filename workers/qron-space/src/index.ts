// Inlined Authichain Theme Module for Cloudflare Worker compatibility
const BRANDS = {
  qron: {
    name: 'QRON Studio',
    tagline: 'Authentic Blockchain Verified Art QR',
    primary: '#d4af37',
    primaryDim: '#b8941f',
    secondary: '#14b8a6',
    bg: '#050507',
    bg2: '#0a0a0f',
    bg3: '#12121a',
    text: '#f8fafc',
    textDim: '#94a3b8',
    border: 'rgba(212,175,55,0.25)',
    borderDim: 'rgba(212,175,55,0.12)',
    glowRgba: 'rgba(212,175,55,0.15)',
    logoMark: 'QR',
    url: 'https://qron.space',
  }
};

const FONTS_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">`;

function svgLogo(brand, size = 36) {
  const b = BRANDS[brand];
  return `<svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="18,1 33,9.5 33,26.5 18,35 3,26.5 3,9.5" fill="${b.primary}" opacity="0.15" stroke="${b.primary}" stroke-width="1.5"/>
      <polygon points="18,5 30,11.5 30,24.5 18,31 6,24.5 6,11.5" fill="${b.bg}" stroke="${b.primary}" stroke-width="0.5" opacity="0.6"/>
      <rect x="10" y="11" width="5" height="5" rx="1" fill="${b.primary}" opacity="0.8"/>
      <rect x="21" y="11" width="5" height="5" rx="1" fill="${b.primary}" opacity="0.8"/>
      <rect x="10" y="21" width="5" height="5" rx="1" fill="${b.primary}" opacity="0.8"/>
      <rect x="16" y="16" width="4" height="4" rx="0.5" fill="${b.secondary}" opacity="0.7"/>
      <rect x="21" y="21" width="5" height="5" rx="1" fill="${b.secondary}" opacity="0.5"/>
    </svg>`;
}

function cssVars(brand) {
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
  --radius: 8px;
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
.nav-logo { display: flex; align-items: center; gap: 12px; text-decoration: none; }
.nav-logo-text {
  font-family: var(--display);
  font-size: 24px;
  letter-spacing: 2px;
  color: var(--text);
}
.nav-logo-text span { color: var(--primary); }
.hero {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  align-items: center;
  padding: 120px 24px 60px;
  overflow: hidden;
}
.hero-content {
  max-width: 800px;
  margin: 0 auto;
  text-align: center;
  z-index: 2;
}
.hero-title {
  font-family: var(--display);
  font-size: clamp(56px, 12vw, 120px);
  line-height: 0.9;
  letter-spacing: 2px;
  color: var(--text);
  margin-bottom: 24px;
}
.hero-title .accent { color: var(--primary); }
.hero-sub {
  font-size: clamp(16px, 4vw, 20px);
  font-weight: 300;
  color: var(--text-dim);
  max-width: 600px;
  margin: 0 auto 40px;
  line-height: 1.6;
}
.btn {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 16px 32px;
  border-radius: 4px;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  width: 100%;
  text-align: center;
}
.btn-primary {
  background: var(--primary);
  color: #000;
  box-shadow: 0 4px 0 var(--primary-dim);
}
.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 768px) {
  .grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .grid { grid-template-columns: repeat(3, 1fr); }
}
.card {
  padding: 32px;
  transition: all 0.3s ease;
}
footer {
  padding: 60px 24px;
  border-top: 1px solid var(--border-dim);
  background: var(--bg2);
}
.footer-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 40px;
}
@media (min-width: 1024px) {
  .footer-grid { grid-template-columns: 2fr 1fr 1fr 1fr; }
}
`;

function communityHub(brand) {
  return `
<section class="web3-section" id="community" style="padding: 80px 24px; border-top: 1px solid var(--border-dim)">
  <div class="hero-content" style="max-width:1000px">
    <div style="color: var(--secondary); font-family: var(--mono); font-size: 11px; margin-bottom: 8px">$QRON ECOSYSTEM</div>
    <h2>COMMUNITY <span class="accent">HUB</span></h2>
    <p class="hero-sub">The protocol belongs to you. Participate in the Truth Layer economy through $QRON utility and BTC Ordinals anchoring.</p>
    <div class="grid" style="margin-top:48px; text-align:left">
      <div class="card glass">
        <div style="font-size:32px; margin-bottom:16px">💎</div>
        <h3 style="font-family:var(--display); font-size:24px; margin-bottom:12px">$QRON TOKEN</h3>
        <p style="font-size:14px; color:var(--text-dim)">Native utility on Polygon. Earn $QRON for each successful authentication and use it for TrueMark minting fees.</p>
      </div>
      <div class="card glass">
        <div style="font-size:32px; margin-bottom:16px">🟠</div>
        <h3 style="font-family:var(--display); font-size:24px; margin-bottom:12px">BTC ORDINALS</h3>
        <p style="font-size:14px; color:var(--text-dim)">Permanent provenance. Anchor your high-value product certificates directly to Bitcoin via Ordinals.</p>
      </div>
      <div class="card glass">
        <div style="font-size:32px; margin-bottom:16px">🤝</div>
        <h3 style="font-family:var(--display); font-size:24px; margin-bottom:12px">GOVERNANCE</h3>
        <p style="font-size:14px; color:var(--text-dim)">Stake $QRON to participate in protocol updates. Vote on new industry vertical expansion.</p>
      </div>
    </div>
  </div>
</section>`;
}

function foundersVision() {
  return `
<section style="padding: 100px 24px; background: linear-gradient(to bottom, var(--bg), var(--bg2))">
  <div class="hero-content" style="max-width: 900px">
    <div class="section-tag">Founder's Vision</div>
    <h2 style="font-size: clamp(32px, 6vw, 56px)">THE <span class="accent">AUTHENTICATION</span> LAYER</h2>
    <p class="hero-sub" style="font-style: italic; border-left: 2px solid var(--primary); padding-left: 24px; text-align: left; margin: 40px auto">
      "We are building the authentication layer for the physical world. Our product, QRON, transforms physical items into scannable identities."
    </p>
  </div>
</section>`;
}

function techStack() {
  return `
<section style="padding: 80px 24px; border-top: 1px solid var(--border-dim)">
  <div class="hero-content" style="max-width: 1100px">
    <div class="section-tag">Core Technology</div>
    <h2>THE <span class="accent">QRONCODE</span> STACK</h2>
    <div class="grid" style="margin-top:48px; text-align:left">
      <div class="card glass">
        <div style="font-family: var(--mono); font-size: 11px; color: var(--primary); margin-bottom: 8px">01 / MAGIC EYE</div>
        <p style="font-size:14px; color:var(--text-dim)">Forensic-level visual fingerprinting using autostereogram depth-shifting.</p>
      </div>
    </div>
  </div>
</section>`;
}

function ecosystemFooter() {
  return `
<footer>
  <div class="footer-grid" style="max-width: 1200px; margin: 0 auto">
    <div>
      <div class="nav-logo" style="margin-bottom:16px">
        ${svgLogo('qron', 28)}
        <span class="nav-logo-text">QRON<span>STUDIO</span></span>
      </div>
      <p style="font-size:14px; color:var(--text-dim)">Artistic QR Codes for the Authentic Economy.</p>
    </div>
  </div>
</footer>`;
}

const BRAND = 'qron';
const b = BRANDS[BRAND];

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${b.name} — ${b.tagline}</title>
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
      <span class="nav-logo-text">QRON<span>STUDIO</span></span>
    </a>
  </nav>

  <section class="hero">
    <div class="hero-content">
      <h1 class="hero-title"><span>ARTISTIC</span><span class="accent">QR CODES.</span></h1>
      <p class="hero-sub">Qron.space is the authentic blockchain verified art QR code generator (QronCode) featuring Autoflow, Trumark, and AI Storymode.</p>
    </div>
  </section>

  <section id="gallery" style="padding: 80px 24px; background: var(--bg2)">
    <div class="hero-content" style="max-width: 1200px">
      <div class="section-tag">Visual Portfolio</div>
      <h2>QRON <span class="accent">DEMO</span> GALLERY</h2>
      <div class="grid" style="margin-top:48px; text-align:left">
        <div class="card glass">
           <div style="font-size: 48px; text-align: center">🎨</div>
           <h3 style="font-family:var(--display); font-size:22px; margin-top:16px">CINEMATIC STYLE</h3>
        </div>
      </div>
    </div>
  </section>

  ${foundersVision()}
  ${techStack()}
  ${communityHub(BRAND)}
  ${ecosystemFooter()}
</body>
</html>`;

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === '/api/generate/free') {
       return new Response(JSON.stringify({ success: true, qrImageUrl: 'https://quickchart.io/qr?text=https://qron.space&ecLevel=H' }), { headers: { 'Content-Type': 'application/json' } });
        if (url.pathname === '/health') {
              return new Response(JSON.stringify({ status: 'ok', worker: 'qron-space', timestamp: new Date().toISOString() }), {
                      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    });
            }
    }
    return new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
};
