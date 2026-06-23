const HTML_SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data: https:; frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", domain: "govchain.us", ts: Date.now() });
    }
    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GovChain — Federal Contract Intelligence & Public Provenance</title>
<meta name="description" content="GovChain turns SAM.gov into pursue-ready intelligence: AI fit-scoring, auto-drafted capability statements, and an immutable on-chain public datalog for Made-in-USA and federal compliance.">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#05060b;--surface:#0a0c14;--surface2:#101423;--border:#1e2d4a;--blue:#3b82f6;--gold:#facc15;--text:#f0f9ff;--muted:#7e93b8}
body{background:var(--bg);color:var(--text);font-family:'Inter',system-ui,sans-serif;line-height:1.6}
a{color:var(--blue);text-decoration:none}
.nav{display:flex;justify-content:space-between;align-items:center;padding:1.2rem 2rem;border-bottom:1px solid var(--border);position:sticky;top:0;background:rgba(5,6,11,.95);backdrop-filter:blur(12px);z-index:100}
.logo{font-size:1.4rem;font-weight:800;letter-spacing:.05em;background:linear-gradient(135deg,var(--blue),var(--gold));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.nav-links{display:flex;gap:1.5rem;list-style:none}
.nav-links a{color:var(--muted);font-size:.9rem;transition:color .2s}
.nav-links a:hover{color:var(--blue)}
.btn{display:inline-block;padding:.75rem 1.75rem;border-radius:.5rem;font-weight:600;font-size:.95rem;transition:all .2s;cursor:pointer;border:none}
.btn-primary{background:linear-gradient(135deg,var(--blue),var(--primary-dim,#2563eb));color:#fff}
.btn-primary:hover{opacity:.92;transform:translateY(-1px)}
.btn-outline{background:transparent;border:1px solid var(--blue);color:var(--blue)}
.btn-outline:hover{background:var(--blue);color:#fff}
.hero{text-align:center;padding:5rem 2rem 4rem;max-width:920px;margin:0 auto}
.hero-badge{display:inline-block;background:rgba(59,130,246,.1);border:1px solid var(--blue);color:var(--blue);padding:.4rem 1rem;border-radius:2rem;font-size:.85rem;margin-bottom:1.5rem}
.hero h1{font-size:clamp(2.5rem,6vw,4.5rem);font-weight:800;line-height:1.1;margin-bottom:1.5rem;background:linear-gradient(135deg,#fff 40%,var(--blue));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero p{font-size:1.2rem;color:var(--muted);max-width:640px;margin:0 auto 2.5rem}
.hero-cta{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
.stats-bar{display:grid;grid-template-columns:repeat(4,1fr);gap:1.5rem;padding:2.5rem;background:var(--surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.stat{text-align:center}
.stat-value{font-size:1.8rem;font-weight:700;color:var(--blue)}
.stat-label{font-size:.8rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-top:.25rem}
section{padding:5rem 2rem;max-width:1200px;margin:0 auto}
h2{font-size:clamp(1.75rem,4vw,2.5rem);font-weight:700;margin-bottom:1rem}
.accent{color:var(--gold)}
.section-sub{color:var(--muted);margin-bottom:3rem;max-width:640px}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:1.5rem}
.step{background:var(--surface);border:1px solid var(--border);border-radius:1rem;padding:1.75rem;position:relative}
.step-num{font-size:2.5rem;font-weight:800;color:var(--border);line-height:1;margin-bottom:.75rem}
.step h3{font-size:1rem;font-weight:600;margin-bottom:.5rem;color:var(--blue)}
.step p{color:var(--muted);font-size:.85rem}
.pros-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem}
.pro{background:var(--surface);border:1px solid var(--border);border-radius:1rem;padding:1.75rem;transition:border-color .2s,transform .2s}
.pro:hover{border-color:var(--blue);transform:translateY(-2px)}
.pro-icon{font-size:2rem;margin-bottom:1rem}
.pro h3{font-size:1.1rem;font-weight:700;margin-bottom:.6rem}
.pro p{color:var(--muted);font-size:.9rem}
.opp-card{background:var(--surface);border:1px solid var(--border);border-radius:1.25rem;overflow:hidden;max-width:560px;margin:0 auto}
.opp-header{background:linear-gradient(135deg,rgba(59,130,246,.18),rgba(250,204,21,.08));padding:1.5rem}
.opp-title{font-size:1.1rem;font-weight:700}
.opp-agency{font-size:.85rem;color:var(--muted);margin-top:.25rem}
.opp-body{padding:1.5rem}
.opp-row{display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--border);font-size:.9rem}
.opp-row:last-child{border-bottom:none}
.opp-label{color:var(--muted)}
.opp-value{font-weight:600}
.fit{display:inline-block;padding:.2rem .6rem;border-radius:2rem;font-size:.8rem;font-weight:700;background:rgba(34,197,94,.15);color:#22c55e;border:1px solid #22c55e}
.compliance-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1.5rem}
.compliance-card{background:var(--surface);border:1px solid var(--border);border-radius:1rem;padding:1.5rem}
.compliance-card h3{font-size:1rem;font-weight:600;margin-bottom:.5rem;color:var(--gold)}
.compliance-card p{color:var(--muted);font-size:.85rem}
.audit-pipeline{display:flex;gap:0;overflow:hidden;border-radius:1rem;border:1px solid var(--border)}
.audit-layer{flex:1;padding:1.5rem 1rem;text-align:center;border-right:1px solid var(--border);background:var(--surface)}
.audit-layer:last-child{border-right:none}
.audit-icon{font-size:1.75rem;margin-bottom:.5rem}
.audit-name{font-size:.8rem;font-weight:600;color:var(--blue);margin-bottom:.25rem}
.audit-desc{font-size:.75rem;color:var(--muted)}
.pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem}
.price-card{background:var(--surface);border:1px solid var(--border);border-radius:1rem;padding:2rem;text-align:center}
.price-card.featured{border-color:var(--blue)}
.price-amount{font-size:2.5rem;font-weight:700;color:var(--blue);margin:1rem 0}
.price-period{font-size:.85rem;color:var(--muted);margin-bottom:1.5rem}
.price-features{list-style:none;text-align:left;margin-bottom:2rem}
.price-features li{padding:.4rem 0;font-size:.9rem;color:var(--muted)}
.price-features li::before{content:"✓ ";color:var(--blue)}
.cta-section{text-align:center;padding:5rem 2rem;background:linear-gradient(135deg,rgba(59,130,246,.05),rgba(250,204,21,.05));border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
footer{text-align:center;padding:2rem;color:var(--muted);font-size:.85rem;border-top:1px solid var(--border)}
@media(max-width:768px){.stats-bar,.steps,.compliance-grid,.pricing-grid{grid-template-columns:1fr}.audit-pipeline{flex-direction:column}.audit-layer{border-right:none;border-bottom:1px solid var(--border)}.nav-links{display:none}}
</style></head><body>
<nav class="nav">
  <div class="logo">GOVCHAIN</div>
  <ul class="nav-links">
    <li><a href="#how">How It Works</a></li>
    <li><a href="#pros">Advantages</a></li>
    <li><a href="#compliance">Compliance</a></li>
    <li><a href="#pricing">Pricing</a></li>
  </ul>
  <a href="https://authichain-unified.vercel.app/onboard" class="btn btn-primary">Request Access</a>
</nav>

<div class="hero">
  <div class="hero-badge">🏛️ Federal Contract Intelligence · On-Chain Public Trust</div>
  <h1>Win More Federal Work, Prove Every Claim</h1>
  <p>GovChain turns SAM.gov into pursue-ready intelligence — AI fit-scoring, auto-drafted capability statements, and an immutable public datalog that makes "Made in USA" and federal compliance verifiable by anyone.</p>
  <div class="hero-cta">
    <a href="#how" class="btn btn-primary">See How It Works</a>
    <a href="#pros" class="btn btn-outline">Why GovChain</a>
  </div>
</div>

<div class="stats-bar">
  <div class="stat"><div class="stat-value">28K+</div><div class="stat-label">Opportunities Scored</div></div>
  <div class="stat"><div class="stat-value">340</div><div class="stat-label">Agencies Tracked</div></div>
  <div class="stat"><div class="stat-value">&lt;2 min</div><div class="stat-label">Opportunity → Draft</div></div>
  <div class="stat"><div class="stat-value">100%</div><div class="stat-label">On-Chain Auditable</div></div>
</div>

<section id="how">
  <h2>From Notice to <span class="accent">Awarded</span> in 4 Steps</h2>
  <p class="section-sub">An autonomous pipeline that ingests, scores, drafts, and anchors — so your team pursues only what fits.</p>
  <div class="steps">
    <div class="step"><div class="step-num">01</div><h3>SAM.gov Ingestion</h3><p>Live ingestion of federal & state notices by NAICS, agency, and keyword. Nothing relevant slips past.</p></div>
    <div class="step"><div class="step-num">02</div><h3>AI Fit-Scoring</h3><p>Each opportunity scored 0–100 against your capabilities with plain-English reasoning and a pursue / monitor / skip call.</p></div>
    <div class="step"><div class="step-num">03</div><h3>Capability Drafting</h3><p>High-fit opportunities get an AI-drafted capability statement / proposal skeleton, ready for your reviewer.</p></div>
    <div class="step"><div class="step-num">04</div><h3>On-Chain Anchoring</h3><p>Claims, certifications, and Made-in-USA provenance are hash-anchored to Polygon for tamper-evident public proof.</p></div>
  </div>
</section>

<section id="pros">
  <h2>Particular <span class="accent">Advantages</span></h2>
  <p class="section-sub">What GovChain does that a SAM.gov search and a folder of PDFs can't.</p>
  <div class="pros-grid">
    <div class="pro"><div class="pro-icon">🎯</div><h3>Opportunity Radar + Fit-Scoring</h3><p>Stop reading 200 notices to find 3 worth pursuing. AI ranks every notice by fit so BD time goes only where it pays off.</p></div>
    <div class="pro"><div class="pro-icon">📝</div><h3>Auto-Drafted Capability Statements</h3><p>Turn a high-fit notice into a tailored capability statement in minutes, not days — your team edits instead of starting blank.</p></div>
    <div class="pro"><div class="pro-icon">🦅</div><h3>Made-in-USA / FTC Shield</h3><p>Cryptographic provenance seals for domestic-origin claims — defensible against FTC MUSA enforcement and EO 14392 scrutiny.</p></div>
    <div class="pro"><div class="pro-icon">🔎</div><h3>Transparent Public Datalog</h3><p>Every certification and contract claim is verifiable on-chain by COs, auditors, and citizens — trust without a login.</p></div>
    <div class="pro"><div class="pro-icon">⚖️</div><h3>Compliance-Ready Exports</h3><p>One-click evidence packages mapped to FAR/DFARS, NIST 800-171, and Section 889 — audit prep measured in clicks.</p></div>
    <div class="pro"><div class="pro-icon">🔔</div><h3>Deadline Watchdog</h3><p>Automated alerts when a high-fit proposal is within 48h of its deadline, so nothing winnable is missed.</p></div>
  </div>
</section>

<section id="sample">
  <h2>Sample <span class="accent">Scored Opportunity</span></h2>
  <p class="section-sub">Every notice arrives pre-analyzed and pursue-ready.</p>
  <div class="opp-card">
    <div class="opp-header">
      <div class="opp-title">Tamper-Evident Asset Tracking — Defense Logistics</div>
      <div class="opp-agency">Agency: DLA · NAICS 541512 · Notice ID W912-26-R-0042</div>
    </div>
    <div class="opp-body">
      <div class="opp-row"><span class="opp-label">AI Fit Score</span><span class="opp-value"><span class="fit">92 / 100 · Pursue</span></span></div>
      <div class="opp-row"><span class="opp-label">Set-Aside</span><span class="opp-value">Total Small Business</span></div>
      <div class="opp-row"><span class="opp-label">Response Deadline</span><span class="opp-value">14 days</span></div>
      <div class="opp-row"><span class="opp-label">Capability Draft</span><span class="opp-value" style="color:var(--blue)">Generated ✓</span></div>
      <div class="opp-row"><span class="opp-label">Provenance Anchor</span><span class="opp-value">Polygon · 0x9c…f4a1</span></div>
    </div>
  </div>
</section>

<section id="audit">
  <h2>4-Layer <span class="accent">Public Trust</span> Trail</h2>
  <p class="section-sub">From operational record to immutable chain anchor — verifiable end to end.</p>
  <div class="audit-pipeline">
    <div class="audit-layer"><div class="audit-icon">🗂️</div><div class="audit-name">SAM.gov</div><div class="audit-desc">Authoritative federal opportunity & entity source</div></div>
    <div class="audit-layer"><div class="audit-icon">🗄️</div><div class="audit-name">Supabase</div><div class="audit-desc">Scored opportunities, proposals & certifications</div></div>
    <div class="audit-layer"><div class="audit-icon">📌</div><div class="audit-name">IPFS</div><div class="audit-desc">Content-addressed evidence & document storage</div></div>
    <div class="audit-layer"><div class="audit-icon">⛓️</div><div class="audit-name">Polygon</div><div class="audit-desc">On-chain hash anchor · public, tamper-evident</div></div>
  </div>
</section>

<section id="compliance">
  <h2>Compliance <span class="accent">Coverage</span></h2>
  <p class="section-sub">Built around the standards federal buyers actually require.</p>
  <div class="compliance-grid">
    <div class="compliance-card"><h3>FAR / DFARS</h3><p>Evidence mapping for Federal Acquisition Regulation and defense supplement clauses, exportable per solicitation.</p></div>
    <div class="compliance-card"><h3>NIST SP 800-171</h3><p>Controlled Unclassified Information control tracking with an audit-ready evidence trail.</p></div>
    <div class="compliance-card"><h3>Buy American / Made in USA</h3><p>Cryptographic domestic-origin provenance defensible against FTC MUSA penalties and EO 14392.</p></div>
    <div class="compliance-card"><h3>Section 889 / Supply Chain</h3><p>Prohibited-source screening and supply-chain provenance anchored on-chain for prime/sub assurance.</p></div>
  </div>
</section>

<section id="pricing">
  <h2>Pricing</h2>
  <p class="section-sub">Per-organization. Unlimited opportunities. No per-bid fees.</p>
  <div class="pricing-grid">
    <div class="price-card"><h3>Contractor</h3><div class="price-amount">$299</div><div class="price-period">per month</div><ul class="price-features"><li>SAM.gov opportunity radar</li><li>AI fit-scoring</li><li>5 capability drafts / mo</li><li>Public datalog (read)</li></ul><a href="https://authichain-unified.vercel.app/onboard" class="btn btn-outline" style="width:100%;text-align:center">Start Trial</a></div>
    <div class="price-card featured"><h3>Agency</h3><div class="price-amount">$799</div><div class="price-period">per month</div><ul class="price-features"><li>Everything in Contractor</li><li>Unlimited capability drafts</li><li>Made-in-USA provenance seals</li><li>FAR/DFARS/NIST exports</li><li>Deadline watchdog alerts</li></ul><a href="https://authichain-unified.vercel.app/onboard" class="btn btn-primary" style="width:100%;text-align:center">Most Popular</a></div>
    <div class="price-card"><h3>Enterprise</h3><div class="price-amount">Custom</div><div class="price-period">prime & multi-team</div><ul class="price-features"><li>Multi-team workspaces</li><li>White-label public datalog</li><li>Sub-tier supply-chain anchoring</li><li>Dedicated compliance officer</li><li>SLA & SSO</li></ul><a href="https://authichain-unified.vercel.app/onboard" class="btn btn-outline" style="width:100%;text-align:center">Contact Sales</a></div>
  </div>
</section>

<div class="cta-section">
  <h2>Pursue smarter. Prove everything.</h2>
  <p style="color:var(--muted);margin:1rem 0 2rem">Join contractors using GovChain to find winnable federal work and anchor every claim on-chain.</p>
  <a href="https://authichain-unified.vercel.app/onboard" class="btn btn-primary" style="font-size:1.1rem;padding:1rem 2.5rem">Request Access</a>
</div>

<footer>
  <p>© 2026 GovChain · Powered by AuthiChain Protocol · <a href="https://authichain.com">authichain.com</a></p>
</footer>
</body></html>`;
    return new Response(html, { headers: { ...HTML_SECURITY_HEADERS, "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "public,max-age=300" } });
  },
};
