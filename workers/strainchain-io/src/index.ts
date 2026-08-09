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
      return Response.json({ status: "ok", domain: "strainchain.io", ts: Date.now() });
    }
    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>StrainChain — Cannabis Supply Chain on Blockchain</title>
<meta name="description" content="End-to-end cannabis supply chain tracking: strain NFTs, compliance automation, 4-layer audit trail from seed to shelf.">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#030c04;--surface:#071209;--border:#0f2b12;--green:#10b981;--gold:#f59e0b;--text:#e2e8f0;--muted:#64748b}
body{background:var(--bg);color:var(--text);font-family:'Inter',system-ui,sans-serif;line-height:1.6}
a{color:var(--green);text-decoration:none}
.nav{display:flex;justify-content:space-between;align-items:center;padding:1.2rem 2rem;border-bottom:1px solid var(--border);position:sticky;top:0;background:rgba(3,12,4,.95);backdrop-filter:blur(12px);z-index:100}
.logo{font-size:1.4rem;font-weight:700;background:linear-gradient(135deg,var(--green),var(--gold));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.nav-links{display:flex;gap:1.5rem;list-style:none}
.nav-links a{color:var(--muted);font-size:.9rem;transition:color .2s}
.nav-links a:hover{color:var(--green)}
.btn{display:inline-block;padding:.75rem 1.75rem;border-radius:.5rem;font-weight:600;font-size:.95rem;transition:all .2s;cursor:pointer;border:none}
.btn-primary{background:linear-gradient(135deg,var(--green),var(--gold));color:#fff}
.btn-primary:hover{opacity:.9;transform:translateY(-1px)}
.btn-outline{background:transparent;border:1px solid var(--green);color:var(--green)}
.btn-outline:hover{background:var(--green);color:var(--bg)}
.hero{text-align:center;padding:5rem 2rem 4rem;max-width:900px;margin:0 auto}
.hero-badge{display:inline-block;background:rgba(16,185,129,.1);border:1px solid var(--green);color:var(--green);padding:.4rem 1rem;border-radius:2rem;font-size:.85rem;margin-bottom:1.5rem}
.hero h1{font-size:clamp(2.5rem,6vw,4.5rem);font-weight:800;line-height:1.1;margin-bottom:1.5rem;background:linear-gradient(135deg,#fff 40%,var(--green));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero p{font-size:1.2rem;color:var(--muted);max-width:600px;margin:0 auto 2.5rem}
.hero-cta{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
.stats-bar{display:grid;grid-template-columns:repeat(4,1fr);gap:1.5rem;padding:2.5rem;background:var(--surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.stat{text-align:center}
.stat-value{font-size:1.8rem;font-weight:700;color:var(--green)}
.stat-label{font-size:.8rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-top:.25rem}
section{padding:5rem 2rem;max-width:1200px;margin:0 auto}
h2{font-size:clamp(1.75rem,4vw,2.5rem);font-weight:700;margin-bottom:1rem}
.section-sub{color:var(--muted);margin-bottom:3rem;max-width:600px}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:1.5rem}
.step{background:var(--surface);border:1px solid var(--border);border-radius:1rem;padding:1.75rem;position:relative}
.step-num{font-size:2.5rem;font-weight:800;color:var(--border);line-height:1;margin-bottom:.75rem}
.step h3{font-size:1rem;font-weight:600;margin-bottom:.5rem;color:var(--green)}
.step p{color:var(--muted);font-size:.85rem}
.nft-card{background:var(--surface);border:1px solid var(--border);border-radius:1.25rem;overflow:hidden;max-width:480px;margin:0 auto}
.nft-header{background:linear-gradient(135deg,rgba(16,185,129,.2),rgba(245,158,11,.1));padding:2rem;text-align:center}
.nft-emoji{font-size:4rem}
.nft-name{font-size:1.3rem;font-weight:700;margin-top:.75rem}
.nft-body{padding:1.5rem}
.nft-row{display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--border);font-size:.9rem}
.nft-row:last-child{border-bottom:none}
.nft-label{color:var(--muted)}
.nft-value{font-weight:600}
.compliance-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1.5rem}
.compliance-card{background:var(--surface);border:1px solid var(--border);border-radius:1rem;padding:1.5rem}
.compliance-card h3{font-size:1rem;font-weight:600;margin-bottom:.5rem;color:var(--gold)}
.compliance-card p{color:var(--muted);font-size:.85rem}
.audit-pipeline{display:flex;gap:0;overflow:hidden;border-radius:1rem;border:1px solid var(--border)}
.audit-layer{flex:1;padding:1.5rem 1rem;text-align:center;border-right:1px solid var(--border);background:var(--surface)}
.audit-layer:last-child{border-right:none}
.audit-icon{font-size:1.75rem;margin-bottom:.5rem}
.audit-name{font-size:.8rem;font-weight:600;color:var(--green);margin-bottom:.25rem}
.audit-desc{font-size:.75rem;color:var(--muted)}
.integrations{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem}
.integration{background:var(--surface);border:1px solid var(--border);border-radius:.75rem;padding:1.25rem;text-align:center;font-size:.85rem;font-weight:600}
.pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem}
.price-card{background:var(--surface);border:1px solid var(--border);border-radius:1rem;padding:2rem;text-align:center}
.price-card.featured{border-color:var(--green)}
.price-amount{font-size:2.5rem;font-weight:700;color:var(--green);margin:1rem 0}
.price-period{font-size:.85rem;color:var(--muted);margin-bottom:1.5rem}
.price-features{list-style:none;text-align:left;margin-bottom:2rem}
.price-features li{padding:.4rem 0;font-size:.9rem;color:var(--muted)}
.price-features li::before{content:"✓ ";color:var(--green)}
.cta-section{text-align:center;padding:5rem 2rem;background:linear-gradient(135deg,rgba(16,185,129,.05),rgba(245,158,11,.05));border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
footer{text-align:center;padding:2rem;color:var(--muted);font-size:.85rem;border-top:1px solid var(--border)}
@media(max-width:768px){.stats-bar,.steps,.compliance-grid,.integrations,.pricing-grid{grid-template-columns:1fr}.audit-pipeline{flex-direction:column}.audit-layer{border-right:none;border-bottom:1px solid var(--border)}}
</style></head><body>
<nav class="nav">
  <div class="logo">StrainChain</div>
  <ul class="nav-links">
    <li><a href="#how">How It Works</a></li>
    <li><a href="#advantages">Advantages</a></li>
    <li><a href="#compliance">Compliance</a></li>
    <li><a href="#audit">Audit Trail</a></li>
    <li><a href="#pricing">Pricing</a></li>
  </ul>
  <a href="https://authichain.com/dapp" class="btn btn-primary">Request Demo</a>
</nav>

<div class="hero">
  <div class="hero-badge">🌿 Cannabis Supply Chain · Blockchain-Verified</div>
  <h1>Seed-to-Shelf Tracking on Polygon</h1>
  <p>Immutable strain NFTs, automated compliance reporting, and a 4-layer audit trail that satisfies regulators in all 38 legal markets.</p>
  <div class="hero-cta">
    <a href="#how" class="btn btn-primary">See How It Works</a>
    <a href="#audit" class="btn btn-outline">View Audit Trail</a>
  </div>
</div>

<div class="stats-bar">
  <div class="stat"><div class="stat-value" id="sc-lab">1,000</div><div class="stat-label">Lab Tests Logged</div></div>
  <div class="stat"><div class="stat-value" id="sc-chain">6,000</div><div class="stat-label">Chain Events</div></div>
  <div class="stat"><div class="stat-value" id="sc-dispensary">1,000</div><div class="stat-label">Dispensary Receipts</div></div>
  <div class="stat"><div class="stat-value">$0.002</div><div class="stat-label">Per-Batch Audit Cost</div></div>
</div>
<script>
fetch('https://authichain-unified.vercel.app/api/strainchain/stats')
  .then(r=>r.json()).then(function(d){
    if(d.lab_tests!=null)document.getElementById('sc-lab').textContent=d.lab_tests.toLocaleString();
    if(d.total_chain_events!=null)document.getElementById('sc-chain').textContent=d.total_chain_events.toLocaleString();
    if(d.dispensary_receipts!=null)document.getElementById('sc-dispensary').textContent=d.dispensary_receipts.toLocaleString();
  }).catch(function(){});
</script>

<section id="how">
  <h2>From Seed to Shelf in 4 Steps</h2>
  <p class="section-sub">Every touch-point recorded on-chain. No gaps, no tampering, full regulator access.</p>
  <div class="steps">
    <div class="step"><div class="step-num">01</div><h3>Seed Registration</h3><p>Genetic fingerprint + cultivar data minted as ERC-721 NFT on Polygon. IPFS-pinned metadata.</p></div>
    <div class="step"><div class="step-num">02</div><h3>Cultivation Tracking</h3><p>IoT sensor data (temp, humidity, nutrients) anchored to chain every 6 hours via Chainlink oracle.</p></div>
    <div class="step"><div class="step-num">03</div><h3>Lab Testing</h3><p>COA (Certificate of Analysis) hashed and linked to NFT. THC/CBD/terpene profiles immutable on-chain.</p></div>
    <div class="step"><div class="step-num">04</div><h3>Retail Verification</h3><p>QR code on packaging resolves to on-chain record. Consumers and regulators verify in &lt;1 second.</p></div>
  </div>
</section>

<section id="nft">
  <h2>Sample Strain NFT</h2>
  <p class="section-sub">Every batch gets a unique on-chain identity with full provenance.</p>
  <div class="nft-card">
    <div class="nft-header"><div class="nft-emoji">🌿</div><div class="nft-name">Blue Dream × OG Kush F1 — Batch #2847</div></div>
    <div class="nft-body">
      <div class="nft-row"><span class="nft-label">THC Content</span><span class="nft-value">24.3%</span></div>
      <div class="nft-row"><span class="nft-label">CBD Content</span><span class="nft-value">0.8%</span></div>
      <div class="nft-row"><span class="nft-label">Lineage</span><span class="nft-value">Blue Dream × OG Kush</span></div>
      <div class="nft-row"><span class="nft-label">Cultivator</span><span class="nft-value">Green Valley Farms</span></div>
      <div class="nft-row"><span class="nft-label">Harvest Date</span><span class="nft-value">Apr 15, 2026</span></div>
      <div class="nft-row"><span class="nft-label">Compliance Status</span><span class="nft-value" style="color:var(--green)">✓ METRC Verified</span></div>
      <div class="nft-row"><span class="nft-label">IPFS Proof</span><span class="nft-value" style="font-size:.8rem">ipfs://Qm...4d7f</span></div>
      <div class="nft-row"><span class="nft-label">Token ID</span><span class="nft-value">#SC-2847 · Polygon</span></div>
    </div>
  </div>
</section>

<section id="advantages">
  <h2>Why StrainChain</h2>
  <p class="section-sub">The particular advantages over spreadsheets, generic seed-to-sale, and paper COAs.</p>
  <div class="compliance-grid">
    <div class="compliance-card"><h3>🌿 Unfakeable Strain Identity</h3><p>Each batch is an on-chain NFT carrying its genetic fingerprint and COA hash — relabeling or back-dating is mathematically impossible.</p></div>
    <div class="compliance-card"><h3>⚡ Zero Manual Data Entry</h3><p>Bidirectional METRC &amp; BioTrack sync flows tags and manifests automatically — no double-keying, no transcription errors.</p></div>
    <div class="compliance-card"><h3>🛡️ Regulator-Ready in One Click</h3><p>The 4-layer audit trail exports an inspection-ready evidence package on demand — turn an audit from days into minutes.</p></div>
    <div class="compliance-card"><h3>🔎 Consumer Trust at the Shelf</h3><p>A QR on the package resolves to full on-chain provenance in under a second — proof in the buyer's hand, not a claim on a label.</p></div>
  </div>
</section>

<section id="compliance">
  <h2>Compliance Layer</h2>
  <p class="section-sub">Pre-built integrations with every major state tracking system.</p>
  <div class="compliance-grid">
    <div class="compliance-card"><h3>METRC Integration</h3><p>Real-time tag sync. Automatic manifest generation. Zero manual data entry for 24 METRC states.</p></div>
    <div class="compliance-card"><h3>BioTrack THC</h3><p>Full WA, NH, NM, and HI compliance. Bidirectional sync with state seed-to-sale systems.</p></div>
    <div class="compliance-card"><h3>CCRS (California)</h3><p>Cannabis Cultivation Policy compliance. DCC reporting automated via API with on-chain backup.</p></div>
    <div class="compliance-card"><h3>SOC 2 Type II</h3><p>Annual audit trail export. Automated evidence collection. Regulator-ready reports in one click.</p></div>
  </div>
</section>

<section id="audit">
  <h2>4-Layer Audit Trail</h2>
  <p class="section-sub">Every event captured at 4 levels — from operational database to immutable blockchain.</p>
  <div class="audit-pipeline">
    <div class="audit-layer"><div class="audit-icon">📊</div><div class="audit-name">Airtable</div><div class="audit-desc">Operational records & staff-facing data entry</div></div>
    <div class="audit-layer"><div class="audit-icon">🗄️</div><div class="audit-name">Supabase</div><div class="audit-desc">Structured relational store + real-time subscriptions</div></div>
    <div class="audit-layer"><div class="audit-icon">📌</div><div class="audit-name">IPFS/Pinata</div><div class="audit-desc">Immutable content-addressed file storage</div></div>
    <div class="audit-layer"><div class="audit-icon">⛓️</div><div class="audit-name">Polygon</div><div class="audit-desc">On-chain hash anchor · tamper-evident forever</div></div>
  </div>
</section>

<section id="integrations">
  <h2>Integrations</h2>
  <p class="section-sub">Plug into your existing stack. No rip-and-replace.</p>
  <div class="integrations">
    <div class="integration">📊 METRC</div>
    <div class="integration">🌿 BioTrack</div>
    <div class="integration">🏛️ CCRS</div>
    <div class="integration">📦 LeafLogix</div>
    <div class="integration">🔬 SC Labs</div>
    <div class="integration">💊 Confident Cannabis</div>
    <div class="integration">🚚 BLAZE</div>
    <div class="integration">🔗 Dutchie</div>
  </div>
</section>

<section id="pricing">
  <h2>Pricing</h2>
  <p class="section-sub">Per-location pricing. No per-transaction fees. Unlimited batches.</p>
  <div class="pricing-grid">
    <div class="price-card"><h3>Grower</h3><div class="price-amount">$199</div><div class="price-period">per location / month</div><ul class="price-features"><li>Up to 500 strain NFTs/mo</li><li>METRC + BioTrack sync</li><li>4-layer audit trail</li><li>Basic compliance reports</li></ul><a href="https://authichain.com/dapp" class="btn btn-outline" style="width:100%;text-align:center">Start Free Trial</a></div>
    <div class="price-card featured"><h3>Operator</h3><div class="price-amount">$499</div><div class="price-period">per location / month</div><ul class="price-features"><li>Unlimited strain NFTs</li><li>All compliance integrations</li><li>IoT sensor integration</li><li>Real-time regulator dashboard</li><li>API access</li></ul><a href="https://authichain.com/dapp" class="btn btn-primary" style="width:100%;text-align:center">Most Popular</a></div>
    <div class="price-card"><h3>Enterprise</h3><div class="price-amount">$999</div><div class="price-period">per location / month</div><ul class="price-features"><li>Multi-state management</li><li>White-label portal</li><li>Custom compliance workflows</li><li>Dedicated compliance officer</li><li>SLA guarantee</li></ul><a href="https://authichain.com/dapp" class="btn btn-outline" style="width:100%;text-align:center">Contact Sales</a></div>
  </div>
</section>

<div class="cta-section">
  <h2>Ready for Regulator-Proof Tracking?</h2>
  <p style="color:var(--muted);margin:1rem 0 2rem">Join 847+ cannabis operators using StrainChain across 38 legal markets.</p>
  <a href="https://authichain.com/dapp" class="btn btn-primary" style="font-size:1.1rem;padding:1rem 2.5rem">Request Demo</a>
</div>

<footer>
  <p>© 2026 StrainChain · Powered by AuthiChain Protocol · <a href="https://authichain.com">authichain.com</a></p>
</footer>
</body></html>`;
    return new Response(html, { headers: { ...HTML_SECURITY_HEADERS, "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "public,max-age=300" } });
  },
};
