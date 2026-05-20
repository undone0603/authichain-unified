// Inlined Authichain Theme Module for Cloudflare Worker compatibility
const BRANDS = {
  govchain: {
    name: 'GovChain',
    tagline: 'Sovereign Document Verification Protocol',
    primary: '#3b82f6',
    primaryDim: '#2563eb',
    secondary: '#facc15',
    bg: '#05060b',
    bg2: '#0a0c14',
    bg3: '#101423',
    text: '#f0f9ff',
    textDim: '#93c5fd',
    border: 'rgba(59,130,246,0.25)',
    borderDim: 'rgba(59,130,246,0.12)',
    glowRgba: 'rgba(59,130,246,0.15)',
    logoMark: 'GC',
    url: 'https://govchain.us',
  }
};

const FONTS_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">`;

function svgLogo(brand, size = 36) {
  const b = BRANDS[brand];
  return `<svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="18,1 33,9.5 33,26.5 18,35 3,26.5 3,9.5" fill="${b.primary}" opacity="0.15" stroke="${b.primary}" stroke-width="1.5"/>
      <polygon points="18,5 30,11.5 30,24.5 18,31 6,24.5 6,11.5" fill="${b.bg}" stroke="${b.primary}" stroke-width="0.5" opacity="0.6"/>
      <path d="M12,24 L12,16 L18,11 L24,16 L24,24 Z" stroke="${b.primary}" stroke-width="1.5" fill="none"/>
      <line x1="18" y1="11" x2="18" y2="8" stroke="${b.secondary}" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
}

function cssVars(brand) {
  const b = BRANDS[brand];
  return `:root {
  --bg: ${b.bg};
  --bg-rgb: 5, 6, 11;
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
  background: rgba(5, 6, 11, 0.8);
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
    <h2>THE <span class="accent">GOVCHAIN</span> STACK</h2>
    <div class="grid" style="margin-top:48px; text-align:left; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px">
      <div class="card glass" style="padding: 32px; border: 1px solid var(--border-dim); border-radius: 8px">
        <div style="font-family: var(--mono); font-size: 11px; color: var(--primary); margin-bottom: 8px">01 / TRUMARK</div>
        <p style="font-size:14px; color:var(--text-dim)">Sovereign document verification protocol.</p>
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
        ${svgLogo('govchain', 28)}
        <span class="nav-logo-text">GOV<span>CHAIN</span></span>
      </div>
      <p style="font-size:14px; color:var(--text-dim)">Sovereign Provenance Protocol.</p>
    </div>
  </div>
</footer>`;
}

const BRAND = 'govchain';
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
      <span class="nav-logo-text">GOV<span>CHAIN</span></span>
    </a>
  </nav>

  <section class="hero">
    <div class="hero-content">
      <h1 class="hero-title"><span>PUBLIC</span><span class="accent">TRUST.</span></h1>
      <p class="hero-sub">GovChain is the government associated blockchain authentication vertical, providing a truth layer for official manufacturers and state records.</p>
      <div class="hero-actions">
        <a href="https://authichain-unified.vercel.app/onboard" class="btn btn-primary">Manufacturer Onboarding</a>
        <a href="#sectors" class="btn btn-secondary">Explore Sectors</a>
      </div>
    </div>
  </section>

  <section id="sectors" style="padding: 80px 24px">
    <div class="hero-content" style="max-width: 1000px">
      <div class="section-tag">Strategic Verticals</div>
      <h2>SECURED <span class="accent">INFRASTRUCTURE</span></h2>
      <div class="grid" style="margin-top:48px; text-align:left">
        <div class="card glass">
          <div style="font-size:32px; margin-bottom:16px">🇺🇸</div>
          <h3 style="font-family:var(--display); font-size:24px; margin-bottom:12px">MADE IN USA</h3>
          <p style="font-size:14px; color:var(--text-dim)">Official manufacturers' deal tracking for domestic integrity.</p>
        </div>
      </div>
    </div>
  </section>

  <section id="military-use" style="padding: 100px 24px; background: linear-gradient(to bottom, var(--bg), var(--bg2))">
    <div class="hero-content" style="max-width: 1100px">
      <div class="section-tag">High-Security Protocol</div>
      <h2>SOVEREIGN <span class="accent">MANUFACTURING</span></h2>
      <p class="hero-sub">The ultimate utility of a QronCode: Fusing visual deterrence with cryptographic certainty.</p>
      
      <div class="glass" style="margin-top: 48px; display: grid; grid-template-columns: 1fr; gap: 40px; padding: 40px; text-align: left; align-items: center">
        <div style="order: 2">
          <h3 style="font-family: var(--display); font-size: 32px; margin-bottom: 20px">QRONCODE: MILITARY & GOV EDITION</h3>
          <p style="color: var(--text-dim); margin-bottom: 24px">A QronCode is more than a link; it's a cinematic artifact that carries the weight of official verification. In government and defense sectors, this technology provides:</p>
          <ul style="list-style: none; display: flex; flex-direction: column; gap: 12px">
            <li style="font-size: 14px; display: flex; align-items: center; gap: 12px">
              <span style="color: var(--primary)">&#10003;</span> <strong>Visual Provenance</strong>: Instantly recognizable branding (e.g. Patriotic Eagle/M1 Abrams) that psychological deters counterfeiters.
            </li>
            <li style="font-size: 14px; display: flex; align-items: center; gap: 12px">
              <span style="color: var(--primary)">&#10003;</span> <strong>Forensic Utility</strong>: Magic Eye technology hidden within the QR pattern allows field agents to verify authenticity even without a database connection.
            </li>
            <li style="font-size: 14px; display: flex; align-items: center; gap: 12px">
              <span style="color: var(--primary)">&#10003;</span> <strong>Immutable Audit</strong>: Every "Made in the USA" manufacturer deal is sealed with a TrueMark ID, creating a perfect paper trail for state and federal contracts.
            </li>
          </ul>
        </div>
        <div style="order: 1; aspect-ratio: 1; background: #000; border: 1px solid var(--border); border-radius: var(--radius); display: flex; align-items: center; justify-content: center; overflow: hidden">
          <div style="font-family: var(--mono); color: var(--primary); font-size: 10px; text-align: center">
            [ QRON ASSET: LaQa1.jpg - Military Grade QR ]<br>
            <span style="font-size: 48px">🦅</span>
          </div>
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
    return new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
};
