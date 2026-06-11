// GovChain.us - Government Authentication Landing Page
// (c) 2026 AuthiChain Inc.

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

const FONTS_LINK = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">';

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
.btn {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 14px 28px;
  border-radius: 4px;
  text-decoration: none;
  font-weight: 700;
  transition: all 0.2s;
  display: inline-block;
}
.btn-primary {
  background: var(--primary);
  color: #fff;
}
.btn-secondary {
  border: 1px solid var(--border);
  color: var(--text);
}
.section-tag {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--primary);
  text-transform: uppercase;
  margin-bottom: 16px;
}
footer {
  padding: 60px 24px;
  border-top: 1px solid var(--border-dim);
  background: var(--bg2);
  text-align: center;
}
`;

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GovChain — Sovereign Document Verification Protocol</title>
  ${FONTS_LINK}
  <style>
    ${cssVars('govchain')}
    ${BASE_CSS}
  </style>
</head>
<body>
  <nav>
    <a class="nav-logo" href="/">
      ${svgLogo('govchain', 28)}
      <span class="nav-logo-text">GOV<span>CHAIN</span></span>
    </a>
    <a href="https://authichain-unified.vercel.app/governance" class="btn btn-primary" style="padding: 8px 16px; font-size: 10px">DAO Console</a>
  </nav>

  <section class="hero">
    <div class="hero-content">
      <div class="section-tag">Sovereign Protocol</div>
      <h1 class="hero-title"><span>PUBLIC</span><span class="accent">TRUST.</span></h1>
      <p class="hero-sub">The government-grade truth layer for manufacturing, federal grants, and state records. Verified by the AuthiChain Protocol.</p>
      <div style="display: flex; gap: 16px; justify-content: center">
        <a href="https://authichain-unified.vercel.app/governance" class="btn btn-primary">Participate in DAO</a>
        <a href="https://authichain-unified.vercel.app/grants" class="btn btn-secondary">View Grant Hub</a>
      </div>
    </div>
  </section>

  <section style="padding: 100px 24px; background: var(--bg2)">
    <div class="hero-content" style="max-width: 1100px; text-align: left">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center">
        <div style="background: var(--bg); aspect-ratio: 1; border: 1px solid var(--border); border-radius: 24px; display: flex; align-items: center; justify-content: center; overflow: hidden">
           <div style="font-family: var(--mono); color: var(--primary); font-size: 10px; text-align: center">
            [ SOVEREIGN ASSET: MILITARY GRADE ]<br>
            <span style="font-size: 80px">🦅</span>
          </div>
        </div>
        <div>
          <div class="section-tag">High-Security Utility</div>
          <h2 style="font-family: var(--display); font-size: 56px; margin-bottom: 24px">NATIONAL <span class="accent">PROVENANCE</span></h2>
          <p style="color: var(--text-dim); margin-bottom: 32px">GovChain provides cryptographic certainty for national supply chains, fusing visual deterrence with immutable blockchain signatures.</p>
          <ul style="list-style: none; display: flex; flex-direction: column; gap: 20px">
            <li style="font-size: 15px; display: flex; align-items: start; gap: 16px">
              <span style="color: var(--primary); font-weight: bold; margin-top: 2px">✓</span>
              <span><strong>Visual Deterrence</strong>: Recognizable sovereign branding psychological deters counterfeiting at the point of scan.</span>
            </li>
            <li style="font-size: 15px; display: flex; align-items: start; gap: 16px">
              <span style="color: var(--primary); font-weight: bold; margin-top: 2px">✓</span>
              <span><strong>Forensic Utility</strong>: Magic Eye depth-shifting hidden within the QR pattern allows for offline verification by field agents.</span>
            </li>
            <li style="font-size: 15px; display: flex; align-items: start; gap: 16px">
              <span style="color: var(--primary); font-weight: bold; margin-top: 2px">✓</span>
              <span><strong>Immutable Audit</strong>: Every "Made in USA" manufacturer deal is sealed with a TrueMark ID on-chain.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <footer>
    <div class="nav-logo" style="justify-content: center; margin-bottom: 24px">
      ${svgLogo('govchain', 28)}
      <span class="nav-logo-text">GOV<span>CHAIN</span></span>
    </div>
    <p style="font-size: 12px; color: var(--text-dim); font-family: var(--mono); letter-spacing: 0.1em uppercase">Sovereign Document Verification Protocol</p>
    <div style="margin-top: 32px">
      <a href="https://authichain-unified.vercel.app/grants" style="color: var(--text-dim); font-size: 12px; margin: 0 16px; text-decoration: none">Grant Hub</a>
      <a href="https://authichain.com" style="color: var(--text-dim); font-size: 12px; margin: 0 16px; text-decoration: none">AuthiChain Protocol</a>
    </div>
  </footer>
</body>
</html>`;

export default {
  async fetch(request) {
    return new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
};
