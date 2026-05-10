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

// SEO meta + JSON-LD. Replaces the previously sparse <head>.
const SEO = {
  description:
    'Authentic blockchain-verified art QR codes. AI-generated, illusion-diffusion style. Scan to earn $QRON tokens on Polygon. Free tier.',
  keywords:
    'AI QR code, art QR generator, scan to earn, $QRON token, illusion diffusion, blockchain rewards, custom QR codes, NFT QR, AuthiChain protocol',
  ogTitle: 'QRON Studio — Authentic Blockchain Verified Art QR',
  ogDescription:
    'Turn boring QR codes into AI-generated art. Scan-to-earn $QRON rewards. Free to start.',
  twitterTitle: 'QRON — AI Art QR Codes',
  twitterDescription: '11 AI styles. Scan-to-earn rewards. Free tier.',
  ogImage: 'https://qron.space/og-image.png',
  themeColor: '#d4af37',
  faqs: [
    {
      q: 'How does scan-to-earn work?',
      a: 'When someone scans one of your QR codes, the scan is recorded on Polygon and the creator wallet earns $QRON tokens automatically — no claim transaction needed.',
    },
    {
      q: 'Are the QR codes still scannable?',
      a: 'Every generation is validated against scan-readability before delivery. The illusion-diffusion AI is tuned to keep scan reliability above 98% across all 11 styles.',
    },
    {
      q: 'Is QRON really free?',
      a: 'Yes — generous free tier with no card required. Paid plans add higher daily limits, premium styles, and commercial licensing.',
    },
    {
      q: 'What is $QRON?',
      a: '$QRON is the utility token of the AuthiChain Protocol on Polygon. Earned via scans, used to mint TrueMark certificates and unlock premium QRON Studio features.',
    },
  ],
};

// Brand visual assets served by the worker. SVG keeps a single source of
// truth; if PNG is later required for Twitter/FB share cards, drop a
// /og.png file alongside the route in this fetch handler.
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="30" fill="#0d0d1a"/>
  <rect x="14" y="14" width="10" height="10" rx="1" fill="#a855f7"/>
  <rect x="40" y="14" width="10" height="10" rx="1" fill="#a855f7"/>
  <rect x="14" y="40" width="10" height="10" rx="1" fill="#a855f7"/>
  <rect x="17" y="17" width="4" height="4" fill="#e879f9"/>
  <rect x="43" y="17" width="4" height="4" fill="#e879f9"/>
  <rect x="17" y="43" width="4" height="4" fill="#e879f9"/>
  <rect x="28" y="14" width="4" height="4" fill="#06b6d4"/>
  <rect x="28" y="28" width="8" height="8" rx="4" fill="#a855f7"/>
  <rect x="40" y="28" width="4" height="4" fill="#06b6d4"/>
  <rect x="14" y="28" width="4" height="4" fill="#06b6d4"/>
  <rect x="28" y="40" width="4" height="4" fill="#06b6d4"/>
  <rect x="46" y="40" width="4" height="4" fill="#06b6d4"/>
  <rect x="40" y="46" width="4" height="4" fill="#06b6d4"/>
  <path d="M48 44l2-4 2 4-4 2 4 2-2 4-2-4-4-2z" fill="#fbbf24" opacity="0.8"/>
</svg>`;

const OG_IMAGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050507"/>
      <stop offset="100%" stop-color="#12121a"/>
    </linearGradient>
    <radialGradient id="glow" cx="85%" cy="20%" r="50%">
      <stop offset="0%" stop-color="#a855f7" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#a855f7" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#a855f7" stroke-opacity="0.06" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="0" y="624" width="1200" height="6" fill="#a855f7"/>
  <g stroke="#a855f7" stroke-width="2" stroke-opacity="0.4" fill="none">
    <path d="M40 40h40M40 40v40"/><path d="M1160 40h-40M1160 40v40"/>
    <path d="M40 590h40M40 590v-40"/><path d="M1160 590h-40M1160 590v-40"/>
  </g>
  <g transform="translate(110, 110) scale(2.6)">
    <circle cx="32" cy="32" r="30" fill="#0d0d1a"/>
    <rect x="14" y="14" width="10" height="10" rx="1" fill="#a855f7"/>
    <rect x="40" y="14" width="10" height="10" rx="1" fill="#a855f7"/>
    <rect x="14" y="40" width="10" height="10" rx="1" fill="#a855f7"/>
    <rect x="17" y="17" width="4" height="4" fill="#e879f9"/>
    <rect x="43" y="17" width="4" height="4" fill="#e879f9"/>
    <rect x="17" y="43" width="4" height="4" fill="#e879f9"/>
    <rect x="28" y="14" width="4" height="4" fill="#06b6d4"/>
    <rect x="28" y="28" width="8" height="8" rx="4" fill="#a855f7"/>
    <rect x="40" y="28" width="4" height="4" fill="#06b6d4"/>
    <rect x="14" y="28" width="4" height="4" fill="#06b6d4"/>
    <rect x="28" y="40" width="4" height="4" fill="#06b6d4"/>
    <rect x="46" y="40" width="4" height="4" fill="#06b6d4"/>
    <rect x="40" y="46" width="4" height="4" fill="#06b6d4"/>
    <path d="M48 44l2-4 2 4-4 2 4 2-2 4-2-4-4-2z" fill="#fbbf24" opacity="0.8"/>
  </g>
  <text x="110" y="385" font-family="'Bebas Neue','Helvetica Neue',Arial,sans-serif" font-size="104" font-weight="700" letter-spacing="6" fill="#f8fafc">QRON</text>
  <line x1="110" y1="412" x2="240" y2="412" stroke="#a855f7" stroke-width="3"/>
  <text x="110" y="468" font-family="'Outfit','Helvetica Neue',Arial,sans-serif" font-size="32" font-weight="300" fill="#94a3b8">Authentic Blockchain Verified Art QR</text>
  <text x="110" y="510" font-family="'Outfit','Helvetica Neue',Arial,sans-serif" font-size="22" font-weight="300" fill="#94a3b8" opacity="0.75">11 AI styles · Scan-to-earn $QRON · Free tier</text>
  <text x="1160" y="595" text-anchor="end" font-family="'JetBrains Mono','Courier New',monospace" font-size="20" letter-spacing="3" fill="#a855f7">QRON.SPACE</text>
</svg>`;

function assetResponse(svg: string): Response {
  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=86400, s-maxage=2592000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
}

// __OG_PNG_B64_START__
const OG_IMAGE_PNG_B64 =
  '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' +
  'X/4/LiZP2tWH2asAAAAASUVORK5CYII='
;
// __OG_PNG_B64_END__

function pngResponse(b64: string): Response {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Response(bytes, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=86400, s-maxage=2592000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
}

function seoMeta(): string {
  const url = BRANDS.qron.url;
  const ld = (obj: object) =>
    `<script type="application/ld+json">${JSON.stringify(obj).replace(/<\/script/gi, '<\\/script')}</script>`;
  return `
  <meta name="description" content="${SEO.description}">
  <meta name="keywords" content="${SEO.keywords}">
  <meta name="theme-color" content="${SEO.themeColor}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${url}/">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="apple-touch-icon" href="/apple-touch-icon.svg">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${BRANDS.qron.name}">
  <meta property="og:title" content="${SEO.ogTitle}">
  <meta property="og:description" content="${SEO.ogDescription}">
  <meta property="og:url" content="${url}/">
  <meta property="og:image" content="${SEO.ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${SEO.twitterTitle}">
  <meta name="twitter:description" content="${SEO.twitterDescription}">
  <meta name="twitter:image" content="${SEO.ogImage}">
  ${ld({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRANDS.qron.name,
    url,
    logo: `${url}/favicon.svg`,
    description: SEO.description,
    sameAs: [
      'https://twitter.com/qron_space',
      'https://www.instagram.com/qron.space',
    ],
  })}
  ${ld({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRANDS.qron.name,
    url,
  })}
  ${ld({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: SEO.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  })}`;
}

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
  ${seoMeta()}
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
    const p = url.pathname;
    if (p === '/api/generate/free') {
      return new Response(JSON.stringify({ success: true, qrImageUrl: 'https://quickchart.io/qr?text=https://qron.space&ecLevel=H' }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (p === '/og-image.png' || p === '/og.png') {
      return pngResponse(OG_IMAGE_PNG_B64);
    }
    if (p === '/og-image.svg' || p === '/og.svg') {
      return assetResponse(OG_IMAGE_SVG);
    }
    if (p === '/favicon.svg' || p === '/favicon.ico' || p === '/favicon.png') {
      return assetResponse(FAVICON_SVG);
    }
    if (p === '/apple-touch-icon.svg' || p === '/apple-touch-icon.png' || p === '/apple-touch-icon-precomposed.png') {
      return assetResponse(FAVICON_SVG);
    }
    return new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
};
