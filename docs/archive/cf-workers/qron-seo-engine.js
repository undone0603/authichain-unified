--3e59e4a0fd0eb4b41bdc82e8e6e8fa9865c8d2c16d2c9221e84a2b0de0e0
Content-Disposition: form-data; name="worker.js"

// â”€â”€ DATA: Style Presets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const STYLES = [
  { slug: 'holographic', title: 'Holographic QR Code Style', desc: 'Iridescent, light-shifting QR art with prismatic effects â€” perfect for tech brands and futuristic aesthetics.' },
  { slug: 'cyberpunk', title: 'Cyberpunk QR Code Style', desc: 'Neon-drenched, high-contrast QR art with glitch effects and circuit-board textures.' },
  { slug: 'watercolor', title: 'Watercolor QR Code Style', desc: 'Soft, organic QR art with flowing brushstrokes and translucent color washes.' },
  { slug: 'gothic', title: 'Gothic QR Code Style', desc: 'Dark, ornate QR art with cathedral-inspired geometry and dramatic shadows.' },
  { slug: 'minimalist', title: 'Minimalist QR Code Style', desc: 'Clean, geometric QR art with precise lines and restrained palettes.' },
  { slug: 'retro-arcade', title: 'Retro Arcade QR Code Style', desc: 'Pixel-art QR codes inspired by 8-bit and 16-bit gaming aesthetics.' },
  { slug: 'botanical', title: 'Botanical QR Code Style', desc: 'Nature-inspired QR art woven with leaves, flowers, and organic patterns.' },
  { slug: 'geometric', title: 'Geometric QR Code Style', desc: 'Sacred geometry and tessellation patterns integrated into scannable QR art.' },
  { slug: 'luxury-gold', title: 'Luxury Gold QR Code Style', desc: 'Premium metallic QR art with gold leaf textures and embossed effects â€” ideal for luxury brands.' },
  { slug: 'street-art', title: 'Street Art QR Code Style', desc: 'Urban graffiti-inspired QR art with spray paint textures and bold color blocking.' }
];

// â”€â”€ DATA: Competitors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const COMPETITORS = [
  {
    slug: 'qr-tiger',
    name: 'QR TIGER',
    title: 'QRON vs QR TIGER â€” AI QR Code Generator Comparison',
    meta: 'Compare QRON and QR TIGER for AI QR code generation. See why cryptographic signing, Ed25519 verification, and AuthiChain blockchain anchoring set QRON apart.',
    advantages: [
      'Ed25519 cryptographic signing on every QR code â€” QR TIGER offers none',
      'Blockchain-anchored verification via AuthiChain Protocol',
      '99.7% scan reliability guaranteed vs variable scan rates',
      'AI-generated art with fal.ai diffusion models, not simple overlays'
    ]
  },
  {
    slug: 'canva-qr',
    name: 'Canva QR Code Generator',
    title: 'QRON vs Canva QR Code Generator â€” Which Is Better?',
    meta: 'Canva makes simple QR codes. QRON generates AI art QR codes with cryptographic signatures and blockchain verification. Compare features, security, and style.',
    advantages: [
      'True AI-generated art vs basic template overlays',
      'Cryptographic signing ensures QR code integrity',
      'AuthiChain blockchain verification â€” Canva has no verification layer',
      'Purpose-built for authentication, not just decoration'
    ]
  },
  {
    slug: 'quick-qr-art',
    name: 'QuickQR.art',
    title: 'QRON vs QuickQR.art â€” AI QR Art Generator Comparison',
    meta: 'Compare QRON and QuickQR.art for AI-generated QR codes. QRON adds Ed25519 cryptographic signing and blockchain verification that QuickQR lacks.',
    advantages: [
      'Every QRON is cryptographically signed â€” QuickQR codes are unsigned',
      'AuthiChain Protocol verification vs no verification infrastructure',
      'Enterprise tiers with API access and white-label options',
      '100% scan guarantee with regeneration if any code fails'
    ]
  },
  {
    slug: 'qrcode-ai',
    name: 'QRCode AI',
    title: 'QRON vs QRCode AI â€” Secure AI QR Code Generator',
    meta: 'QRCode AI generates pretty codes. QRON generates cryptographically verified AI QR art anchored on the AuthiChain blockchain. See the difference.',
    advantages: [
      'Ed25519 digital signatures vs no cryptographic layer',
      'On-chain verification for enterprise authentication use cases',
      'Free tier with 10 generations/month â€” no credit card required',
      'Built for product authentication, not just aesthetics'
    ]
  }
];

// â”€â”€ DATA: Use Cases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const USE_CASES = [
  { slug: 'product-packaging', title: 'AI QR Codes for Product Packaging', desc: 'Turn packaging into a verification surface. Every QRON on your product proves authenticity, tells your brand story, and links to verified provenance.' },
  { slug: 'business-cards', title: 'AI QR Codes for Business Cards', desc: 'Replace boring QR codes with AI-generated art that makes your business card unforgettable â€” and cryptographically links to your verified identity.' },
  { slug: 'restaurant-menus', title: 'AI QR Codes for Restaurant Menus', desc: 'Beautiful, branded QR codes for digital menus. Each QRON is unique, on-brand, and verifiable â€” no generic black-and-white squares.' },
  { slug: 'real-estate', title: 'AI QR Codes for Real Estate Listings', desc: 'Property signage with AI-designed QR codes that link to verified listing data. Stand out and build trust with cryptographic verification.' },
  { slug: 'concert-merch', title: 'AI QR Codes for Concert Merchandise', desc: 'Authenticate limited-edition merch with collectible QR art. Every scan proves it is genuine and links to the artist or venue.' },
  { slug: 'museum-exhibits', title: 'AI QR Codes for Museums & Exhibits', desc: 'Embed AI-generated QR art into exhibit displays. Visitors scan for verified information, audio guides, and provenance data.' },
  { slug: 'warranty-cards', title: 'AI QR Codes for Warranty Cards', desc: 'Replace paper warranty cards with cryptographically signed QR codes. One scan registers the product and verifies authenticity.' },
  { slug: 'supply-chain', title: 'AI QR Codes for Supply Chain Tracking', desc: 'Track products from factory to shelf with Ed25519-signed QR codes. Every scan logs a verified checkpoint on the AuthiChain Protocol.' }
];

// ── DATA: Industries ────────────────────────────────────────
const INDUSTRIES = [
  {
    slug: 'cannabis',
    h1: 'AI QR Codes for Cannabis Brands',
    hero: 'Verify every product from seed to sale with cryptographically signed QR art.',
    title: 'AI QR Codes for Cannabis — Compliance & Brand Identity',
    meta: 'Cannabis-industry QR codes with Ed25519 cryptographic signing and AuthiChain blockchain verification. Comply with track-and-trace regulations while building brand identity.',
    keywords: 'cannabis QR code, dispensary QR code, seed to sale tracking, cannabis compliance QR',
    useCases: ['Dispensary product labels with scan-to-verify authenticity', 'Seed-to-sale compliance tracking per state regulations', 'Branded packaging that doubles as a verification surface', 'Customer loyalty and strain information portals']
  },
  {
    slug: 'luxury-goods',
    h1: 'AI QR Codes for Luxury Goods',
    hero: 'Authenticate handbags, watches, and fine goods with QR art worthy of your brand.',
    title: 'AI QR Codes for Luxury Goods — Anti-Counterfeiting',
    meta: 'Protect luxury products with AI-generated QR art, Ed25519 digital signatures, and blockchain-anchored verification. Stop counterfeits at the scan.',
    keywords: 'luxury goods authentication, anti-counterfeiting QR code, luxury brand QR, handbag authentication',
    useCases: ['Certificate of authenticity embedded in product packaging', 'Anti-counterfeiting verification for secondary market resale', 'Brand storytelling — scan to view provenance and craftsmanship', 'Limited-edition product registration and warranty activation']
  },
  {
    slug: 'food-beverage',
    h1: 'AI QR Codes for Food & Beverage',
    hero: 'From farm to fork — scannable provenance on every label.',
    title: 'AI QR Codes for Food & Beverage — Provenance & Branding',
    meta: 'AI-generated QR codes for food and beverage brands. Prove origin, freshness, and authenticity with Ed25519 cryptographic signing on every product.',
    keywords: 'food QR code, beverage QR code, farm to fork QR, food provenance',
    useCases: ['Origin and freshness verification on product labels', 'Digital menus with branded, scannable QR art', 'Allergen and nutrition info linked to verified data', 'Craft brewery and winery batch tracking']
  },
  {
    slug: 'real-estate',
    h1: 'AI QR Codes for Real Estate',
    hero: 'Property signage that converts — beautiful QR art linking to verified listings.',
    title: 'AI QR Codes for Real Estate — Listings & Open Houses',
    meta: 'Stand out in real estate with AI-designed QR codes on yard signs, flyers, and business cards. Link to verified listing data with cryptographic trust.',
    keywords: 'real estate QR code, property listing QR, open house QR code, realtor QR code',
    useCases: ['Yard sign QR codes linking to virtual tours', 'Open house check-in with lead capture', 'Business cards with branded scannable art', 'Verified listing data — no bait-and-switch']
  },
  {
    slug: 'healthcare',
    h1: 'AI QR Codes for Healthcare & Pharma',
    hero: 'Patient safety meets brand trust — verified QR codes on every package.',
    title: 'AI QR Codes for Healthcare — Drug Authentication',
    meta: 'Pharmaceutical and healthcare QR codes with Ed25519 signing and blockchain verification. Meet serialization requirements while building patient trust.',
    keywords: 'pharmaceutical QR code, drug authentication, healthcare QR, patient safety QR',
    useCases: ['Drug serialization and anti-counterfeiting per DSCSA', 'Patient information leaflets linked via scannable QR art', 'Medical device tracking from manufacturer to hospital', 'Clinical trial sample chain-of-custody verification']
  },
  {
    slug: 'events-entertainment',
    h1: 'AI QR Codes for Events & Entertainment',
    hero: 'Tickets, merch, and experiences — all verified with scannable art.',
    title: 'AI QR Codes for Events — Ticketing & Merch Authentication',
    meta: 'Event ticketing and merchandise authentication with AI QR art. Prevent counterfeits, capture leads, and create collectible scan experiences.',
    keywords: 'event QR code, concert ticket QR, merch authentication, event marketing QR',
    useCases: ['Counterfeit-proof event tickets with unique QR art', 'Limited-edition merch authentication and registration', 'Sponsor activations with branded scannable experiences', 'Post-event engagement and feedback collection']
  }
];

// ── HTML TEMPLATE ENGINE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function baseHTML({ title, meta, canonical, bodyContent, keywords }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | QRON â€” AI QR Code Generator</title>
  <meta name="description" content="${meta}">
  <meta name="keywords" content="${keywords || ''}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${meta}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="QRON â€” Creative Layer of the AuthiChain Protocol">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${meta}">
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "QRON",
    "applicationCategory": "DesignApplication",
    "operatingSystem": "Web",
    "url": "https://qron.space",
    "description": "AI-powered QR code generator with Ed25519 cryptographic signing and AuthiChain blockchain verification.",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "creator": {
      "@type": "Organization",
      "name": "AuthiChain",
      "url": "https://authichain.com"
    }
  })}</script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0f;color:#e0e0e0;line-height:1.7}
    .container{max-width:800px;margin:0 auto;padding:2rem 1.5rem}
    header{text-align:center;padding:3rem 0 2rem;border-bottom:1px solid #1a1a2e}
    h1{font-size:2.2rem;font-weight:700;color:#fff;margin-bottom:0.5rem}
    .subtitle{color:#8b8ba3;font-size:1.1rem;margin-bottom:1.5rem}
    .cta-primary{display:inline-block;background:#6c3ce0;color:#fff;padding:0.85rem 2rem;border-radius:8px;text-decoration:none;font-weight:600;font-size:1.05rem;transition:background 0.2s}
    .cta-primary:hover{background:#7b4ae8}
    .section{padding:2.5rem 0;border-bottom:1px solid #1a1a2e}
    h2{font-size:1.6rem;color:#fff;margin-bottom:1rem}
    .use-case-list{list-style:none;padding:0}
    .use-case-list li{padding:0.6rem 0 0.6rem 1.5rem;position:relative;color:#c0c0d0}
    .use-case-list li::before{content:"â—†";position:absolute;left:0;color:#6c3ce0}
    .stats{display:flex;gap:2rem;justify-content:center;flex-wrap:wrap;margin:1.5rem 0}
    .stat{text-align:center}
    .stat-value{font-size:1.8rem;font-weight:700;color:#6c3ce0}
    .stat-label{font-size:0.85rem;color:#8b8ba3}
    .advantage{background:#111122;border:1px solid #1a1a2e;border-radius:8px;padding:1rem 1.25rem;margin:0.5rem 0}
    footer{text-align:center;padding:2rem 0;color:#555;font-size:0.85rem}
    footer a{color:#6c3ce0;text-decoration:none}
    @media(max-width:600px){h1{font-size:1.6rem}.stats{flex-direction:column;align-items:center}}
  </style>
</head>
<body>
  <nav style="background:#111;padding:0.75rem 1.5rem;display:flex;justify-content:space-between;align-items:center;font-size:0.9rem">
    <a href="https://qron.space" style="color:#fff;text-decoration:none;font-weight:700">â—† QRON</a>
    <div>
      <a href="https://authichain.com" style="color:#8b8ba3;text-decoration:none;margin-right:1.5rem">AuthiChain</a>
      <a href="https://qron.space" class="cta-primary" style="padding:0.5rem 1.25rem;font-size:0.85rem">Generate Free</a>
    </div>
  </nav>
  <div class="container">
    ${bodyContent}
  </div>
  <footer>
    <p>â—† 100% scannable guarantee Â· Ed25519 cryptographic signing Â· AuthiChain blockchain anchoring</p>
    <p style="margin-top:0.5rem"><a href="https://qron.space">QRON</a> | <a href="https://authichain.com">AuthiChain Enterprise</a> | Â© 2026 AuthiChain, Inc.</p>
  </footer>
</body>
</html>`;
}


// â”€â”€ PAGE RENDERERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function renderIndustryPage(industry) {
  const canonical = `https://qron.space/qr-code-for/${industry.slug}`;
  const bodyContent = `
    <header>
      <h1>${industry.h1}</h1>
      <p class="subtitle">${industry.hero}</p>
      <div class="stats">
        <div class="stat"><div class="stat-value">~25%</div><div class="stat-label">Scan Lift vs Plain QR</div></div>
        <div class="stat"><div class="stat-value">Ed25519</div><div class="stat-label">Cryptographic Signing</div></div>
        <div class="stat"><div class="stat-value">99.7%</div><div class="stat-label">Verification Accuracy</div></div>
      </div>
      <a href="https://qron.space" class="cta-primary">Generate Your QRON â€” Free</a>
    </header>
    <div class="section">
      <h2>Use Cases</h2>
      <ul class="use-case-list">
        ${industry.useCases.map(uc => `<li>${uc}</li>`).join('')}
      </ul>
    </div>
    <div class="section">
      <h2>How It Works</h2>
      <p>1. Enter your destination URL and describe your brand aesthetic.</p>
      <p>2. QRON's AI generates scannable QR art using fal.ai diffusion models.</p>
      <p>3. Every code is signed with Ed25519 cryptography and anchored on the AuthiChain Protocol.</p>
      <p>4. Anyone who scans your QRON verifies authenticity instantly â€” no app required.</p>
    </div>
    <div class="section" style="text-align:center">
      <h2>Start Free â€” No Credit Card Required</h2>
      <p style="color:#8b8ba3;margin-bottom:1rem">10 free generations per month. Credits never expire.</p>
      <a href="https://qron.space" class="cta-primary">Create Your First QRON</a>
    </div>`;
  return baseHTML({ title: industry.title, meta: industry.meta, canonical, bodyContent, keywords: industry.keywords });
}

function renderStylePage(style) {
  const canonical = `https://qron.space/styles/${style.slug}`;
  const bodyContent = `
    <header>
      <h1>${style.title}</h1>
      <p class="subtitle">${style.desc}</p>
      <a href="https://qron.space" class="cta-primary">Generate ${style.slug.replace(/-/g, ' ')} QR â€” Free</a>
    </header>
    <div class="section">
      <h2>About This Style</h2>
      <p>The ${style.slug.replace(/-/g, ' ')} preset transforms your QR code into AI-generated art while maintaining 99.7% scan reliability. Every code is cryptographically signed with Ed25519 and verified on the AuthiChain Protocol.</p>
      <p style="margin-top:1rem">Available on the free tier â€” no credit card required. Generate up to 10 QRONs per month.</p>
    </div>
    <div class="section" style="text-align:center">
      <h2>Try It Now</h2>
      <a href="https://qron.space" class="cta-primary">Open QRON Studio</a>
    </div>`;
  return baseHTML({ title: style.title, meta: style.desc, canonical, bodyContent, keywords: `${style.slug} QR code, AI QR code ${style.slug}, ${style.slug} QR art` });
}

function renderVsPage(comp) {
  const canonical = `https://qron.space/vs/${comp.slug}`;
  const bodyContent = `
    <header>
      <h1>${comp.title}</h1>
      <p class="subtitle">${comp.meta}</p>
    </header>
    <div class="section">
      <h2>Why QRON Over ${comp.name}</h2>
      ${comp.advantages.map(a => `<div class="advantage">â—† ${a}</div>`).join('')}
    </div>
    <div class="section">
      <h2>Side-by-Side</h2>
      <table style="width:100%;border-collapse:collapse;margin:1rem 0">
        <thead>
          <tr style="border-bottom:2px solid #1a1a2e;text-align:left">
            <th style="padding:0.75rem;color:#8b8ba3">Feature</th>
            <th style="padding:0.75rem;color:#6c3ce0">QRON</th>
            <th style="padding:0.75rem;color:#8b8ba3">${comp.name}</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid #1a1a2e"><td style="padding:0.6rem">AI-Generated Art</td><td style="padding:0.6rem">âœ… fal.ai Diffusion</td><td style="padding:0.6rem">â�Œ Templates</td></tr>
          <tr style="border-bottom:1px solid #1a1a2e"><td style="padding:0.6rem">Cryptographic Signing</td><td style="padding:0.6rem">âœ… Ed25519</td><td style="padding:0.6rem">â�Œ None</td></tr>
          <tr style="border-bottom:1px solid #1a1a2e"><td style="padding:0.6rem">Blockchain Verification</td><td style="padding:0.6rem">âœ… AuthiChain</td><td style="padding:0.6rem">â�Œ None</td></tr>
          <tr style="border-bottom:1px solid #1a1a2e"><td style="padding:0.6rem">Free Tier</td><td style="padding:0.6rem">âœ… 10/month</td><td style="padding:0.6rem">Varies</td></tr>
          <tr><td style="padding:0.6rem">Scan Guarantee</td><td style="padding:0.6rem">âœ… 100%</td><td style="padding:0.6rem">â�Œ No</td></tr>
        </tbody>
      </table>
    </div>
    <div class="section" style="text-align:center">
      <h2>Try QRON Free</h2>
      <p style="color:#8b8ba3;margin-bottom:1rem">10 free generations. No credit card. See the difference.</p>
      <a href="https://qron.space" class="cta-primary">Generate Your First QRON</a>
    </div>`;
  return baseHTML({ title: comp.title, meta: comp.meta, canonical, bodyContent, keywords: `${comp.name} alternative, ${comp.name} vs QRON, AI QR code generator comparison` });
}

function renderUseCasePage(uc) {
  const canonical = `https://qron.space/use-cases/${uc.slug}`;
  const bodyContent = `
    <header>
      <h1>${uc.title}</h1>
      <p class="subtitle">${uc.desc}</p>
      <a href="https://qron.space" class="cta-primary">Generate Free QR Code</a>
    </header>
    <div class="section">
      <h2>Why QRON for ${uc.title.replace('AI QR Codes for ', '')}</h2>
      <p>Standard QR codes are forgettable and unverifiable. QRON generates AI art that matches your brand, signed with Ed25519 cryptography, and verifiable on the AuthiChain Protocol. Every scan proves the code is genuine.</p>
    </div>
    <div class="section">
      <h2>How It Works</h2>
      <p>1. Enter your URL and describe your aesthetic.</p>
      <p>2. AI generates a beautiful, scannable QR code in under 3 seconds.</p>
      <p>3. The code is cryptographically signed and anchored on-chain.</p>
      <p>4. Download as PNG and use anywhere â€” packaging, signage, digital media.</p>
    </div>
    <div class="section" style="text-align:center">
      <h2>Start Free</h2>
      <a href="https://qron.space" class="cta-primary">Open QRON Studio</a>
    </div>`;
  return baseHTML({ title: uc.title, meta: uc.desc, canonical, bodyContent, keywords: `${uc.slug.replace(/-/g, ' ')} QR code, AI QR code ${uc.slug.replace(/-/g, ' ')}` });
}

function renderFreeGeneratorPage() {
  const canonical = 'https://qron.space/free-qr-code-generator';
  const bodyContent = `
    <header>
      <h1>Free AI QR Code Generator</h1>
      <p class="subtitle">Generate beautiful, AI-designed QR codes â€” cryptographically signed and blockchain-verified. No signup required.</p>
      <div class="stats">
        <div class="stat"><div class="stat-value">Free</div><div class="stat-label">10 Generations / Month</div></div>
        <div class="stat"><div class="stat-value"><3s</div><div class="stat-label">Generation Time</div></div>
        <div class="stat"><div class="stat-value">100%</div><div class="stat-label">Scan Guarantee</div></div>
      </div>
      <a href="https://qron.space" class="cta-primary">Generate Your Free QR Code</a>
    </header>
    <div class="section">
      <h2>What Makes QRON Different</h2>
      <div class="advantage">â—† <strong>AI-Generated Art</strong> â€” Not templates. Fal.ai diffusion models create unique, stunning QR art from your text prompt.</div>
      <div class="advantage">â—† <strong>Cryptographically Signed</strong> â€” Every QR code is signed with Ed25519 digital signatures. Tamper-proof by design.</div>
      <div class="advantage">â—† <strong>Blockchain Verified</strong> â€” Anchored on the AuthiChain Protocol. Anyone can verify authenticity in one scan.</div>
      <div class="advantage">â—† <strong>100% Scan Guarantee</strong> â€” If a generated code doesn't scan, we regenerate it free. 99.7% accuracy on first generation.</div>
    </div>
    <div class="section">
      <h2>Style Presets</h2>
      <p>Choose from 10+ AI art styles: Holographic, Cyberpunk, Watercolor, Minimalist, Luxury Gold, Botanical, and more. Every style maintains scan reliability.</p>
    </div>
    <div class="section">
      <h2>Pricing</h2>
      <p><strong>Free:</strong> 10 generations/month, static & stereographic modes, basic styles.</p>
      <p><strong>Starter Pack:</strong> $29 one-time â€” 100 generations, holographic & memory modes.</p>
      <p><strong>Creator Pack:</strong> $99 one-time â€” 500 generations, all pro modes, premium styles.</p>
      <p><strong>Business:</strong> $49/month â€” Unlimited generations, API access, team seats.</p>
    </div>
    <div class="section" style="text-align:center">
      <h2>Generate Your First QRON â€” Free</h2>
      <a href="https://qron.space" class="cta-primary">Open QRON Studio</a>
    </div>`;
  return baseHTML({
    title: 'Free AI QR Code Generator â€” Cryptographically Signed',
    meta: 'Generate free AI-designed QR codes with Ed25519 cryptographic signing and AuthiChain blockchain verification. No signup required. 10 free generations per month.',
    canonical,
    bodyContent,
    keywords: 'free AI QR code generator, free QR code maker, AI QR code art, cryptographic QR code, blockchain QR code'
  });
}

function renderGalleryPage() {
  const canonical = 'https://qron.space/gallery';
  const bodyContent = `
    <header>
      <h1>QRON Gallery â€” AI QR Code Art</h1>
      <p class="subtitle">Explore AI-generated QR art created by the QRON community. Every piece is cryptographically signed and scannable.</p>
      <a href="https://qron.space" class="cta-primary">Create Your Own QRON</a>
    </header>
    <div class="section">
      <h2>Featured Styles</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem;margin:1rem 0">
        ${STYLES.map(s => `<div style="background:#111122;border:1px solid #1a1a2e;border-radius:8px;padding:1.25rem;text-align:center">
          <h3 style="font-size:1rem;color:#fff;margin-bottom:0.5rem">${s.slug.replace(/-/g,' ')}</h3>
          <p style="font-size:0.8rem;color:#8b8ba3">${s.desc.slice(0, 80)}...</p>
          <a href="https://qron.space/styles/${s.slug}" style="color:#6c3ce0;font-size:0.85rem;text-decoration:none">View style â†’</a>
        </div>`).join('')}
      </div>
    </div>
    <div class="section" style="text-align:center">
      <h2>Add Your QRON to the Gallery</h2>
      <p style="color:#8b8ba3;margin-bottom:1rem">Generate a QRON and opt in to display it here.</p>
      <a href="https://qron.space" class="cta-primary">Generate Free</a>
    </div>`;
  return baseHTML({
    title: 'QRON Gallery â€” AI QR Code Art Showcase',
    meta: 'Browse AI-generated QR code art from the QRON community. Each piece is cryptographically signed with Ed25519 and verified on the AuthiChain blockchain.',
    canonical,
    bodyContent,
    keywords: 'AI QR code art, QR code gallery, AI generated QR, QRON art, QR code design'
  });
}


// â”€â”€ SITEMAP GENERATOR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function generateSitemap() {
  const now = new Date().toISOString().split('T')[0];
  const urls = [
    { loc: 'https://qron.space/', priority: '1.0', changefreq: 'weekly' },
    // Blog posts (Next.js app)
    { loc: 'https://qron.space/blog', priority: '0.8', changefreq: 'weekly' },
    { loc: 'https://qron.space/blog/ai-qr-codes-scan-rate', priority: '0.8', changefreq: 'monthly' },
    { loc: 'https://qron.space/blog/luxury-goods-qr-code-authentication', priority: '0.8', changefreq: 'monthly' },
    { loc: 'https://qron.space/blog/best-ai-qr-code-generator-2026', priority: '0.8', changefreq: 'monthly' },
    { loc: 'https://qron.space/blog/restaurant-menu-qr-code', priority: '0.7', changefreq: 'monthly' },
    { loc: 'https://qron.space/blog/cannabis-dispensary-qr-code-guide', priority: '0.7', changefreq: 'monthly' },
    { loc: 'https://qron.space/blog/ai-qr-code-generator-free', priority: '0.7', changefreq: 'monthly' },
    { loc: 'https://qron.space/blog/how-ai-qr-codes-work', priority: '0.7', changefreq: 'monthly' },
    { loc: 'https://qron.space/free-qr-code-generator', priority: '0.9', changefreq: 'weekly' },
    { loc: 'https://qron.space/gallery', priority: '0.8', changefreq: 'daily' },
    ...INDUSTRIES.map(i => ({ loc: `https://qron.space/qr-code-for/${i.slug}`, priority: '0.8', changefreq: 'monthly' })),
    ...STYLES.map(s => ({ loc: `https://qron.space/styles/${s.slug}`, priority: '0.7', changefreq: 'monthly' })),
    ...COMPETITORS.map(c => ({ loc: `https://qron.space/vs/${c.slug}`, priority: '0.7', changefreq: 'monthly' })),
    ...USE_CASES.map(u => ({ loc: `https://qron.space/use-cases/${u.slug}`, priority: '0.7', changefreq: 'monthly' })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
}


// â”€â”€ ROBOTS.TXT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ROBOTS_TXT = `User-agent: *
Allow: /

Sitemap: https://qron.space/sitemap.xml

# Crawl-delay not needed â€” Cloudflare handles rate limiting
`;


// â”€â”€ INDEXNOW SUBMISSION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const INDEXNOW_KEY = 'f2dbe7c03cf14c188b019262eccf4b6d'; // Replace with your actual key

async function submitToIndexNow(urls) {
  try {
    await fetch('https://api.indexnow.org/IndexNow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: 'qron.space',
        key: INDEXNOW_KEY,
        keyLocation: `https://qron.space/${INDEXNOW_KEY}.txt`,
        urlList: urls
      })
    });
  } catch (e) {
    console.error('IndexNow submission failed:', e);
  }
}


// â”€â”€ MAIN ROUTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // robots.txt
    if (path === '/robots.txt') {
      return new Response(ROBOTS_TXT, { headers: { 'Content-Type': 'text/plain' } });
    }

    // sitemap.xml
    if (path === '/sitemap.xml') {
      return new Response(generateSitemap(), { headers: { 'Content-Type': 'application/xml' } });
    }

    // IndexNow key verification
    if (path === `/${INDEXNOW_KEY}.txt`) {
      return new Response(INDEXNOW_KEY, { headers: { 'Content-Type': 'text/plain' } });
    }

    // KV-backed dynamic SEO pages
    if (path.startsWith('/use-cases/') && env && env.OUTREACH_KV) {
      const slug = path.replace('/use-cases/', '').replace(/\/+$/, '');
      const kvHtml = await env.OUTREACH_KV.get('seo_page_' + slug);
      if (kvHtml) return new Response(kvHtml, { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public,max-age=3600' } });
    }

    // Free generator page
    if (path === '/free-qr-code-generator') {
      return new Response(renderFreeGeneratorPage(), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    }

    // Gallery
    if (path === '/gallery') {
      return new Response(renderGalleryPage(), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    }

    // Industry pages: /qr-code-for/[slug]
    const industryMatch = path.match(/^\/qr-code-for\/([a-z0-9-]+)$/);
    if (industryMatch) {
      const industry = INDUSTRIES.find(i => i.slug === industryMatch[1]);
      if (industry) {
        return new Response(renderIndustryPage(industry), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
      }
    }

    // Style pages: /styles/[slug]
    const styleMatch = path.match(/^\/styles\/([a-z0-9-]+)$/);
    if (styleMatch) {
      const style = STYLES.find(s => s.slug === styleMatch[1]);
      if (style) {
        return new Response(renderStylePage(style), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
      }
    }

    // Competitor pages: /vs/[slug]
    const vsMatch = path.match(/^\/vs\/([a-z0-9-]+)$/);
    if (vsMatch) {
      const comp = COMPETITORS.find(c => c.slug === vsMatch[1]);
      if (comp) {
        return new Response(renderVsPage(comp), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
      }
    }

    // Use case pages: /use-cases/[slug]
    const ucMatch = path.match(/^\/use-cases\/([a-z0-9-]+)$/);
    if (ucMatch) {
      const uc = USE_CASES.find(u => u.slug === ucMatch[1]);
      if (uc) {
        return new Response(renderUseCasePage(uc), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
      }
    }

    // IndexNow trigger endpoint (POST /api/indexnow with { urls: [...] })
    if (path === '/api/indexnow' && request.method === 'POST') {
      const { urls } = await request.json();
      await submitToIndexNow(urls);
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 404 for unmatched SEO routes
    return new Response('Not Found', { status: 404 });
  }
};
--3e59e4a0fd0eb4b41bdc82e8e6e8fa9865c8d2c16d2c9221e84a2b0de0e0--
