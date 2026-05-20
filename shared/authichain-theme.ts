// AuthiChain Shared Theme Module v1.1
// Premium, mobile-optimized design system for the Truth Layer Ecosystem

export const BRANDS = {
  authichain: {
    name: 'AuthiChain',
    tagline: 'The Truth Layer for the Global Economy',
    primary: '#d4af37',
    primaryDim: '#b8941f',
    secondary: '#8b5cf6',
    bg: '#050507',
    bg2: '#0a0a0f',
    bg3: '#12121a',
    text: '#f8fafc',
    textDim: '#94a3b8',
    border: 'rgba(212,175,55,0.25)',
    borderDim: 'rgba(212,175,55,0.12)',
    glowRgba: 'rgba(212,175,55,0.15)',
    logoMark: 'AC',
    url: 'https://authichain.com',
  },
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
  },
  strainchain: {
    name: 'StrainChain',
    tagline: 'Cannabis Provenance & Seed-to-Sale Storymode',
    primary: '#22c55e',
    primaryDim: '#16a34a',
    secondary: '#f59e0b',
    bg: '#050705',
    bg2: '#0a0f0a',
    bg3: '#111811',
    text: '#f0fdf4',
    textDim: '#86efac',
    border: 'rgba(34,197,94,0.25)',
    borderDim: 'rgba(34,197,94,0.12)',
    glowRgba: 'rgba(34,197,94,0.15)',
    logoMark: 'SC',
    url: 'https://strainchain.io',
  },
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

export const FONTS_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">`;

export function svgLogo(brand: keyof typeof BRANDS, size = 36) {
  const b = BRANDS[brand];
  const logos = {
    authichain: `<svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="18,1 33,9.5 33,26.5 18,35 3,26.5 3,9.5" fill="${b.primary}" opacity="0.15" stroke="${b.primary}" stroke-width="1.5"/>
      <polygon points="18,5 30,11.5 30,24.5 18,31 6,24.5 6,11.5" fill="${b.bg}" stroke="${b.primary}" stroke-width="0.5" opacity="0.6"/>
      <path d="M12,22 L18,12 L24,22 M14.5,19 L21.5,19" stroke="${b.primary}" stroke-width="2" stroke-linecap="round" fill="none"/>
      <path d="M20,14 Q26,16 24,22" stroke="${b.secondary}" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.7"/>
    </svg>`,
    qron: `<svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="18,1 33,9.5 33,26.5 18,35 3,26.5 3,9.5" fill="${b.primary}" opacity="0.15" stroke="${b.primary}" stroke-width="1.5"/>
      <polygon points="18,5 30,11.5 30,24.5 18,31 6,24.5 6,11.5" fill="${b.bg}" stroke="${b.primary}" stroke-width="0.5" opacity="0.6"/>
      <rect x="10" y="11" width="5" height="5" rx="1" fill="${b.primary}" opacity="0.8"/>
      <rect x="21" y="11" width="5" height="5" rx="1" fill="${b.primary}" opacity="0.8"/>
      <rect x="10" y="21" width="5" height="5" rx="1" fill="${b.primary}" opacity="0.8"/>
      <rect x="16" y="16" width="4" height="4" rx="0.5" fill="${b.secondary}" opacity="0.7"/>
      <rect x="21" y="21" width="5" height="5" rx="1" fill="${b.secondary}" opacity="0.5"/>
    </svg>`,
    strainchain: `<svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="18,1 33,9.5 33,26.5 18,35 3,26.5 3,9.5" fill="${b.primary}" opacity="0.15" stroke="${b.primary}" stroke-width="1.5"/>
      <polygon points="18,5 30,11.5 30,24.5 18,31 6,24.5 6,11.5" fill="${b.bg}" stroke="${b.primary}" stroke-width="0.5" opacity="0.6"/>
      <path d="M18,10 Q14,15 18,18 Q22,21 18,26" stroke="${b.primary}" stroke-width="2" stroke-linecap="round" fill="none"/>
      <circle cx="18" cy="11" r="1.5" fill="${b.secondary}" opacity="0.7"/>
    </svg>`,
    govchain: `<svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="18,1 33,9.5 33,26.5 18,35 3,26.5 3,9.5" fill="${b.primary}" opacity="0.15" stroke="${b.primary}" stroke-width="1.5"/>
      <polygon points="18,5 30,11.5 30,24.5 18,31 6,24.5 6,11.5" fill="${b.bg}" stroke="${b.primary}" stroke-width="0.5" opacity="0.6"/>
      <path d="M12,24 L12,16 L18,11 L24,16 L24,24 Z" stroke="${b.primary}" stroke-width="1.5" fill="none"/>
      <line x1="18" y1="11" x2="18" y2="8" stroke="${b.secondary}" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  };
  return logos[brand] || logos.authichain;
}

export function cssVars(brand: keyof typeof BRANDS) {
  const b = BRANDS[brand];
  return `
:root {
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

export const BASE_CSS = `
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
  background: rgba(5, 5, 7, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-dim);
}
@media (min-width: 768px) {
  nav { padding: 20px 48px; }
}

.nav-logo { display: flex; align-items: center; gap: 12px; text-decoration: none; }
.nav-logo-text {
  font-family: var(--display);
  font-size: 24px;
  letter-spacing: 2px;
  color: var(--text);
}
.nav-logo-text span { color: var(--primary); }

.nav-links { display: none; }
@media (min-width: 1024px) {
  .nav-links {
    display: flex;
    align-items: center;
    gap: 32px;
    list-style: none;
  }
}
.nav-links a {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-dim);
  text-decoration: none;
  transition: all 0.2s;
}
.nav-links a:hover { color: var(--primary); transform: translateY(-1px); }

.nav-cta {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #000 !important;
  background: var(--primary);
  padding: 8px 16px;
  border-radius: 4px;
  text-decoration: none;
  font-weight: 700;
  transition: all 0.2s;
}
.nav-cta:hover { background: var(--primary-dim); box-shadow: 0 0 20px var(--primary-glow); }

.hero {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  align-items: center;
  padding: 120px 24px 60px;
  overflow: hidden;
}
@media (min-width: 768px) {
  .hero { padding: 160px 48px 100px; }
}

.hero-bg-glow {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 100vw; height: 100vw;
  background: radial-gradient(circle, var(--primary-glow) 0%, transparent 70%);
  pointer-events: none;
  z-index: -1;
}

.hero-content {
  max-width: 800px;
  margin: 0 auto;
  text-align: center;
  z-index: 2;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--primary);
  border: 1px solid var(--border);
  padding: 6px 16px;
  border-radius: 100px;
  margin-bottom: 24px;
  background: rgba(var(--bg-rgb), 0.5);
  backdrop-filter: blur(4px);
}

.hero-title {
  font-family: var(--display);
  font-size: clamp(56px, 12vw, 120px);
  line-height: 0.9;
  letter-spacing: 2px;
  color: var(--text);
  margin-bottom: 24px;
  font-weight: 400;
}
.hero-title span { display: block; }
.hero-title .accent { color: var(--primary); }

.hero-sub {
  font-size: clamp(16px, 4vw, 20px);
  font-weight: 300;
  color: var(--text-dim);
  max-width: 600px;
  margin: 0 auto 40px;
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  justify-content: center;
}
@media (min-width: 480px) {
  .hero-actions { flex-direction: row; }
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
@media (min-width: 480px) {
  .btn { width: auto; }
}

.btn-primary {
  background: var(--primary);
  color: #000;
  box-shadow: 0 4px 0 var(--primary-dim);
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px var(--primary-glow);
}
.btn-primary:active { transform: translateY(2px); box-shadow: 0 0 0 transparent; }

.btn-secondary {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
}
.btn-secondary:hover {
  background: var(--border-dim);
  border-color: var(--primary);
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
.card:hover {
  border-color: var(--primary);
  transform: translateY(-4px);
  background: rgba(255,255,255,0.05);
}

.web3-section {
  padding: 80px 24px;
  border-top: 1px solid var(--border-dim);
}
.web3-badge {
  color: var(--secondary);
  font-family: var(--mono);
  font-size: 11px;
  margin-bottom: 8px;
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
.footer-col-title {
  font-family: var(--display);
  font-size: 14px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--primary);
  margin-bottom: 24px;
}
.footer-col-links {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.footer-col-links a {
  font-size: 14px;
  color: var(--text-dim);
  text-decoration: none;
  transition: color 0.2s;
}
.footer-col-links a:hover { color: var(--primary); }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeRight {
  from { opacity: 0; transform: translateX(32px); }
  to { opacity: 1; transform: translateX(0); }
}
`;

export function seoMetadata(brand: keyof typeof BRANDS) {
  const b = BRANDS[brand];
  return `
  <!-- SEO Metadata -->
  <meta name="title" content="${b.name} — ${b.tagline}">
  <meta name="description" content="${b.tagline}. Powered by AuthiChain Protocol. Verify everything.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${b.url}">
  <meta property="og:title" content="${b.name} — ${b.tagline}">
  <meta property="og:description" content="${b.tagline}. The source of truth for the physical economy.">
  <meta property="og:image" content="https://images.unsplash.com/photo-1639322537228-f710d846310a?w=1200&q=80&auto=format">
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${b.url}">
  <meta property="twitter:title" content="${b.name} — ${b.tagline}">
  <meta property="twitter:description" content="${b.tagline}. The source of truth for the physical economy.">
  <meta property="twitter:image" content="https://images.unsplash.com/photo-1639322537228-f710d846310a?w=1200&q=80&auto=format">`;
}

export function growthBand(brand: keyof typeof BRANDS) {
  return `
<section style="background: var(--primary); padding: 12px 24px; text-align: center; position: relative; z-index: 1001">
  <p style="color: #000; font-family: var(--mono); font-size: 11px; font-weight: 700; letter-spacing: 1px; margin: 0">
    🚀 JOIN THE AUTHENTIC ECONOMY: <a href="https://authichain.com/referral" style="color: #000; text-decoration: underline">EARN $QRON REWARDS BY REFERRING BRANDS</a>
  </p>
</section>`;
}

export function communityHub(brand: keyof typeof BRANDS) {
  return `
<section class="web3-section" id="community">
  <div class="hero-content" style="max-width:1000px">
    <div class="web3-badge">$QRON ECOSYSTEM</div>
    <h2>COMMUNITY <span class="accent">HUB</span></h2>
    <p class="hero-sub">The protocol belongs to you. Participate in the Truth Layer economy through $QRON utility and BTC Ordinals anchoring.</p>
    
    <div class="grid" style="margin-top:48px; text-align:left">
      <div class="card glass">
        <div style="font-size:32px; margin-bottom:16px">💎</div>
        <h3 style="font-family:var(--display); font-size:24px; margin-bottom:12px">$QRON TOKEN</h3>
        <p style="font-size:14px; color:var(--text-dim)">Native utility on Polygon. Earn $QRON for each successful authentication and use it for TrueMark minting fees and marketplace deals.</p>
      </div>
      <div class="card glass">
        <div style="font-size:32px; margin-bottom:16px">🟠</div>
        <h3 style="font-family:var(--display); font-size:24px; margin-bottom:12px">BTC ORDINALS</h3>
        <p style="font-size:14px; color:var(--text-dim)">Permanent provenance. Anchor your high-value product certificates directly to Bitcoin via Ordinals for immutable, eternal verification.</p>
      </div>
      <div class="card glass">
        <div style="font-size:32px; margin-bottom:16px">🤝</div>
        <h3 style="font-family:var(--display); font-size:24px; margin-bottom:12px">GOVERNANCE</h3>
        <p style="font-size:14px; color:var(--text-dim)">Stake $QRON to participate in protocol updates. Vote on new industry vertical expansion and official manufacturer partnerships.</p>
      </div>
    </div>
  </div>
</section>`;
}

export function foundersVision() {
  return `
<section style="padding: 100px 24px; background: linear-gradient(to bottom, var(--bg), var(--bg2))">
  <div class="hero-content" style="max-width: 900px">
    <div class="section-tag">Founder's Vision</div>
    <h2 style="font-size: clamp(32px, 6vw, 56px)">THE <span class="accent">AUTHENTICATION</span> LAYER</h2>
    <p class="hero-sub" style="font-style: italic; border-left: 2px solid var(--primary); padding-left: 24px; text-align: left; margin: 40px auto">
      "We are building the authentication layer for the physical world. Our product, QRON, transforms physical items into scannable identities. With just one scan, you can access their full provenance and authenticity. This is essential infrastructure for a global economy plagued by counterfeits."
    </p>
    <div style="display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 32px">
      <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--primary-glow); display: flex; align-items: center; justify-content: center; border: 1px solid var(--primary)">
        <span style="font-family: var(--display); font-size: 18px; color: var(--primary)">Z</span>
      </div>
      <div style="text-align: left">
        <div style="font-family: var(--display); font-size: 20px; letter-spacing: 1px">ZACH</div>
        <div style="font-family: var(--mono); font-size: 10px; color: var(--text-dim); text-transform: uppercase">Founder, AuthiChain Protocol</div>
      </div>
    </div>
  </div>
</section>`;
}

export function techStack() {
  return `
<section style="padding: 80px 24px; border-top: 1px solid var(--border-dim)">
  <div class="hero-content" style="max-width: 1100px">
    <div class="section-tag">Core Technology</div>
    <h2>THE <span class="accent">QRONCODE</span> STACK</h2>
    
    <div class="grid" style="margin-top:48px; text-align:left">
      <div class="card glass">
        <div style="font-family: var(--mono); font-size: 11px; color: var(--primary); margin-bottom: 8px">01 / TRUMARK</div>
        <h3 style="font-family:var(--display); font-size:24px; margin-bottom:12px">CRYPTOGRAPHIC SEAL</h3>
        <p style="font-size:14px; color:var(--text-dim)">Every QronCode is signed with a TrueMark digital seal, providing tamper-proof evidence of authenticity anchored to the blockchain.</p>
      </div>
      <div class="card glass">
        <div style="font-family: var(--mono); font-size: 11px; color: var(--primary); margin-bottom: 8px">02 / AUTOFLOW</div>
        <h3 style="font-family:var(--display); font-size:24px; margin-bottom:12px">AI PIPELINE</h3>
        <p style="font-size:14px; color:var(--text-dim)">Autonomous manufacturing integration. Autoflow handles classification and asset generation in real-time as products leave the floor.</p>
      </div>
      <div class="card glass">
        <div style="font-family: var(--mono); font-size: 11px; color: var(--primary); margin-bottom: 8px">03 / MAGIC EYE</div>
        <h3 style="font-family:var(--display); font-size:24px; margin-bottom:12px">FORENSIC VISION</h3>
        <p style="font-size:14px; color:var(--text-dim)">Advanced autostereogram depth-shifting patterns that prevent photocopy fraud through micro-geometry verification.</p>
      </div>
    </div>
  </div>
</section>`;
}

export function ecosystemFooter(currentBrand: keyof typeof BRANDS) {
  return `
<!-- REAL-TIME VERIFICATION TICKER -->
<div style="background: rgba(0,0,0,0.5); border-top: 1px solid var(--border-dim); padding: 8px 24px; overflow: hidden; white-space: nowrap; position: relative; z-index: 10">
  <div class="animate-marquee inline-block font-mono text-[9px] text-slate-500 uppercase tracking-widest">
    <span style="margin-right: 40px"><span style="color: var(--primary)">●</span> LIVE PROOF: AC-TR-098872 SEALED ON POLYGON (2s ago)</span>
    <span style="margin-right: 40px"><span style="color: var(--secondary)">●</span> LIVE PROOF: QRON-ORD-A7B3 ANCHORED TO BTC (14s ago)</span>
    <span style="margin-right: 40px"><span style="color: var(--primary)">●</span> LIVE PROOF: SC-BATCH-665 VERIFIED IN DETROIT (28s ago)</span>
    <span style="margin-right: 40px"><span style="color: #3ddc60">●</span> LIVE PROOF: GOV-US-SIGMA SEALED IN DC (42s ago)</span>
    <span style="margin-right: 40px"><span style="color: var(--primary)">●</span> LIVE PROOF: AC-TR-098873 SEALED ON POLYGON (59s ago)</span>
  </div>
</div>

<footer>
  <div class="footer-grid" style="max-width: 1200px; margin: 0 auto">
    <div>
      <div class="nav-logo" style="margin-bottom:16px">
        ${svgLogo('authichain', 28)}
        <span class="nav-logo-text">AUTHI<span>CHAIN</span></span>
      </div>
      <p style="font-size:14px; color:var(--text-dim)">The Truth Layer for the Global Economy. Built on Polygon. Anchored to Bitcoin.</p>
    </div>
    <div>
      <div class="footer-col-title">Protocol</div>
      <div class="footer-col-links">
        <a href="https://authichain.com/api">API Gateway</a>
        <a href="https://polygonscan.com/address/0xc3143254997d48fdc9983d618fb2e10067673eb5" target="_blank">Verify Contract</a>
        <a href="#">Staking</a>
      </div>
    </div>
    <div>
      <div class="footer-col-title">Verticals</div>
      <div class="footer-col-links">
        <a href="https://qron.space">QRON Studio</a>
        <a href="https://strainchain.io">StrainChain</a>
        <a href="https://govchain.us">GovChain</a>
      </div>
    </div>
    <div>
      <div class="footer-col-title">Community</div>
      <div class="footer-col-links">
        <a href="#">X / Twitter</a>
        <a href="#">Telegram</a>
        <a href="#">Discord</a>
      </div>
    </div>
  </div>
  <div style="margin-top:48px; padding-top:24px; border-top:1px solid var(--border-dim); text-align:center; font-family:var(--mono); font-size:10px; color:var(--text-dim)">
    &copy; 2026 AuthiChain LLC. All rights reserved. Deployed at the Edge.
  </div>
</footer>`;
}
