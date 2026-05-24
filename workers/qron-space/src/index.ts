export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", domain: "qron.space", ts: Date.now() });
    }
    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>$QRON Token Hub — Stake, Govern, Bridge</title>
<meta name="description" content="The $QRON token powers staking, governance, and cross-chain bridge for the AuthiChain ecosystem.">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#020817;--surface:#0d1425;--border:#1e2d4a;--cyan:#06b6d4;--purple:#8b5cf6;--text:#e2e8f0;--muted:#64748b}
body{background:var(--bg);color:var(--text);font-family:'Inter',system-ui,sans-serif;line-height:1.6}
a{color:var(--cyan);text-decoration:none}
.nav{display:flex;justify-content:space-between;align-items:center;padding:1.2rem 2rem;border-bottom:1px solid var(--border);position:sticky;top:0;background:rgba(2,8,23,.95);backdrop-filter:blur(12px);z-index:100}
.logo{font-size:1.4rem;font-weight:700;background:linear-gradient(135deg,var(--cyan),var(--purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.nav-links{display:flex;gap:1.5rem;list-style:none}
.nav-links a{color:var(--muted);font-size:.9rem;transition:color .2s}
.nav-links a:hover{color:var(--cyan)}
.btn{display:inline-block;padding:.75rem 1.75rem;border-radius:.5rem;font-weight:600;font-size:.95rem;transition:all .2s;cursor:pointer;border:none}
.btn-primary{background:linear-gradient(135deg,var(--cyan),var(--purple));color:#fff}
.btn-primary:hover{opacity:.9;transform:translateY(-1px)}
.btn-outline{background:transparent;border:1px solid var(--cyan);color:var(--cyan)}
.btn-outline:hover{background:var(--cyan);color:var(--bg)}
.hero{text-align:center;padding:5rem 2rem 4rem;max-width:900px;margin:0 auto}
.hero-badge{display:inline-block;background:rgba(6,182,212,.1);border:1px solid var(--cyan);color:var(--cyan);padding:.4rem 1rem;border-radius:2rem;font-size:.85rem;margin-bottom:1.5rem}
.hero h1{font-size:clamp(2.5rem,6vw,4.5rem);font-weight:800;line-height:1.1;margin-bottom:1.5rem;background:linear-gradient(135deg,#fff 40%,var(--cyan));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero p{font-size:1.2rem;color:var(--muted);max-width:600px;margin:0 auto 2.5rem}
.hero-cta{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
.stats-bar{display:grid;grid-template-columns:repeat(4,1fr);gap:1.5rem;padding:2.5rem;background:var(--surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.stat{text-align:center}
.stat-value{font-size:1.8rem;font-weight:700;color:var(--cyan)}
.stat-label{font-size:.8rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-top:.25rem}
section{padding:5rem 2rem;max-width:1200px;margin:0 auto}
h2{font-size:clamp(1.75rem,4vw,2.5rem);font-weight:700;margin-bottom:1rem}
.section-sub{color:var(--muted);margin-bottom:3rem;max-width:600px}
.grid-3{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem}
.card{background:var(--surface);border:1px solid var(--border);border-radius:1rem;padding:1.75rem;transition:border-color .2s}
.card:hover{border-color:var(--cyan)}
.card-icon{font-size:2rem;margin-bottom:1rem}
.card h3{font-size:1.15rem;font-weight:600;margin-bottom:.75rem}
.card p{color:var(--muted);font-size:.9rem}
.staking-panel{background:var(--surface);border:1px solid var(--border);border-radius:1.25rem;overflow:hidden}
.staking-header{padding:1.75rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
.staking-tiers{display:grid;grid-template-columns:repeat(3,1fr)}
.tier{padding:1.5rem;border-right:1px solid var(--border);text-align:center}
.tier:last-child{border-right:none}
.tier-name{font-size:.8rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:.5rem}
.tier-apy{font-size:2rem;font-weight:700;color:var(--cyan);margin-bottom:.25rem}
.tier-lock{font-size:.85rem;color:var(--muted)}
.gov-list{display:flex;flex-direction:column;gap:1rem}
.proposal{background:var(--surface);border:1px solid var(--border);border-radius:.75rem;padding:1.25rem;display:flex;justify-content:space-between;align-items:center}
.proposal-title{font-weight:600;font-size:.95rem}
.proposal-meta{font-size:.8rem;color:var(--muted);margin-top:.25rem}
.badge{display:inline-block;padding:.25rem .75rem;border-radius:2rem;font-size:.75rem;font-weight:600}
.badge-active{background:rgba(6,182,212,.15);color:var(--cyan);border:1px solid var(--cyan)}
.badge-passed{background:rgba(34,197,94,.15);color:#22c55e;border:1px solid #22c55e}
.tokenomics{display:grid;grid-template-columns:1fr 1fr;gap:2rem;align-items:center}
.token-chart{aspect-ratio:1;max-width:320px;background:conic-gradient(var(--cyan) 0% 40%,var(--purple) 40% 65%,#f59e0b 65% 80%,#22c55e 80% 92%,var(--muted) 92% 100%);border-radius:50%;margin:auto}
.token-legend{display:flex;flex-direction:column;gap:.75rem}
.legend-item{display:flex;align-items:center;gap:.75rem;font-size:.9rem}
.legend-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0}
.bridge-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem}
.chain-card{background:var(--surface);border:1px solid var(--border);border-radius:.75rem;padding:1.25rem;text-align:center}
.chain-name{font-weight:600;margin:.5rem 0 .25rem}
.chain-meta{font-size:.8rem;color:var(--muted)}
.pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem}
.price-card{background:var(--surface);border:1px solid var(--border);border-radius:1rem;padding:2rem;text-align:center}
.price-card.featured{border-color:var(--cyan);position:relative}
.price-amount{font-size:2.5rem;font-weight:700;color:var(--cyan);margin:1rem 0}
.price-period{font-size:.85rem;color:var(--muted);margin-bottom:1.5rem}
.price-features{list-style:none;text-align:left;margin-bottom:2rem}
.price-features li{padding:.4rem 0;font-size:.9rem;color:var(--muted)}
.price-features li::before{content:"✓ ";color:var(--cyan)}
.cta-section{text-align:center;padding:5rem 2rem;background:linear-gradient(135deg,rgba(6,182,212,.05),rgba(139,92,246,.05));border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
footer{text-align:center;padding:2rem;color:var(--muted);font-size:.85rem;border-top:1px solid var(--border)}
@media(max-width:768px){.stats-bar,.staking-tiers,.tokenomics,.bridge-grid,.pricing-grid{grid-template-columns:1fr}.tier{border-right:none;border-bottom:1px solid var(--border)}}
</style></head><body>
<nav class="nav">
  <div class="logo">$QRON</div>
  <ul class="nav-links">
    <li><a href="#staking">Staking</a></li>
    <li><a href="#governance">Governance</a></li>
    <li><a href="#bridge">Bridge</a></li>
    <li><a href="#tokenomics">Tokenomics</a></li>
  </ul>
  <a href="https://authichain.com/dapp" class="btn btn-primary">Connect Wallet</a>
</nav>

<div class="hero">
  <div class="hero-badge">🔷 $QRON Token — Polygon PoS + ERC-20</div>
  <h1>Power the AuthiChain Ecosystem</h1>
  <p>Stake $QRON to earn yield, govern protocol upgrades, and bridge seamlessly across Polygon, Ethereum, and Base.</p>
  <div class="hero-cta">
    <a href="#staking" class="btn btn-primary">Start Staking</a>
    <a href="#tokenomics" class="btn btn-outline">View Tokenomics</a>
  </div>
</div>

<div class="stats-bar">
  <div class="stat"><div class="stat-value">$4.2M</div><div class="stat-label">Total Value Locked</div></div>
  <div class="stat"><div class="stat-value">42.1%</div><div class="stat-label">Max APY</div></div>
  <div class="stat"><div class="stat-value">12,847</div><div class="stat-label">Token Holders</div></div>
  <div class="stat"><div class="stat-value">99.97%</div><div class="stat-label">Bridge Uptime</div></div>
</div>

<section id="staking">
  <h2>Staking Tiers</h2>
  <p class="section-sub">Lock $QRON for higher yield. All staking secured by Polygon PoS smart contracts.</p>
  <div class="staking-panel">
    <div class="staking-header">
      <div><strong>Active Staking Pool</strong><div style="color:var(--muted);font-size:.85rem">Contract: 0xAebf...E437 · Verified on Polygonscan</div></div>
      <a href="https://authichain.com/dapp" class="btn btn-primary">Stake Now</a>
    </div>
    <div class="staking-tiers">
      <div class="tier"><div class="tier-name">Flexible</div><div class="tier-apy">18.7%</div><div class="tier-lock">30-day lock · No penalty</div></div>
      <div class="tier"><div class="tier-name">Standard</div><div class="tier-apy">28.4%</div><div class="tier-lock">90-day lock · 2% early exit</div></div>
      <div class="tier"><div class="tier-name">Power</div><div class="tier-apy">42.1%</div><div class="tier-lock">180-day lock · 5% early exit</div></div>
    </div>
  </div>
</section>

<section id="governance">
  <h2>Governance</h2>
  <p class="section-sub">$QRON holders vote on protocol parameters, treasury allocations, and ecosystem upgrades.</p>
  <div class="gov-list">
    <div class="proposal">
      <div><div class="proposal-title">QIP-048: Increase Flexible Staking APY to 22%</div><div class="proposal-meta">Ends May 20, 2026 · 8,421 votes cast</div></div>
      <span class="badge badge-active">Active</span>
    </div>
    <div class="proposal">
      <div><div class="proposal-title">QIP-047: Deploy QRON Bridge to Base Network</div><div class="proposal-meta">Ended May 5, 2026 · 11,203 votes cast</div></div>
      <span class="badge badge-passed">Passed</span>
    </div>
    <div class="proposal">
      <div><div class="proposal-title">QIP-046: Treasury Allocation Q2 2026</div><div class="proposal-meta">Ended Apr 28, 2026 · 9,876 votes cast</div></div>
      <span class="badge badge-passed">Passed</span>
    </div>
  </div>
</section>

<section id="bridge">
  <h2>Cross-Chain Bridge</h2>
  <p class="section-sub">Move $QRON across networks with sub-2-minute finality and sub-$0.10 fees.</p>
  <div class="bridge-grid">
    <div class="chain-card"><div style="font-size:2rem">⬡</div><div class="chain-name">Polygon PoS</div><div class="chain-meta">Primary · ~2s finality</div></div>
    <div class="chain-card"><div style="font-size:2rem">⟠</div><div class="chain-name">Ethereum</div><div class="chain-meta">Bridge live · ~12s finality</div></div>
    <div class="chain-card"><div style="font-size:2rem">🔵</div><div class="chain-name">Base</div><div class="chain-meta">QIP-047 · Deploying Q2 2026</div></div>
  </div>
</section>

<section id="tokenomics">
  <h2>Tokenomics</h2>
  <p class="section-sub">Total supply: 100,000,000 $QRON · Deflationary via fee burn</p>
  <div class="tokenomics">
    <div class="token-chart"></div>
    <div class="token-legend">
      <div class="legend-item"><div class="legend-dot" style="background:var(--cyan)"></div><strong>40%</strong> — Staking Rewards</div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--purple)"></div><strong>25%</strong> — Ecosystem Fund</div>
      <div class="legend-item"><div class="legend-dot" style="background:#f59e0b"></div><strong>15%</strong> — Team (4yr vest)</div>
      <div class="legend-item"><div class="legend-dot" style="background:#22c55e"></div><strong>12%</strong> — Public Sale</div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--muted)"></div><strong>8%</strong> — Treasury / DAO</div>
    </div>
  </div>
</section>

<section id="pricing">
  <h2>Membership Tiers</h2>
  <p class="section-sub">Unlock premium features and higher staking multipliers.</p>
  <div class="pricing-grid">
    <div class="price-card"><h3>Starter</h3><div class="price-amount">$39</div><div class="price-period">per month</div><ul class="price-features"><li>100 $QRON monthly airdrop</li><li>Flexible staking access</li><li>Governance voting</li><li>Bridge access</li></ul><a href="https://authichain.com/dapp" class="btn btn-outline" style="width:100%;text-align:center">Get Started</a></div>
    <div class="price-card featured"><h3>Pro</h3><div class="price-amount">$49</div><div class="price-period">per month</div><ul class="price-features"><li>500 $QRON monthly airdrop</li><li>All staking tiers</li><li>2x governance voting weight</li><li>Priority bridge queue</li><li>Analytics dashboard</li></ul><a href="https://authichain.com/dapp" class="btn btn-primary" style="width:100%;text-align:center">Most Popular</a></div>
    <div class="price-card"><h3>Enterprise</h3><div class="price-amount">$99</div><div class="price-period">per month</div><ul class="price-features"><li>2,000 $QRON monthly airdrop</li><li>Custom staking pools</li><li>5x governance weight</li><li>White-label bridge</li><li>Dedicated support</li></ul><a href="https://authichain.com/dapp" class="btn btn-outline" style="width:100%;text-align:center">Contact Sales</a></div>
  </div>
</section>

<div class="cta-section">
  <h2>Ready to stake $QRON?</h2>
  <p style="color:var(--muted);margin:1rem 0 2rem">Connect your wallet and start earning yield on Polygon today.</p>
  <a href="https://authichain.com/dapp" class="btn btn-primary" style="font-size:1.1rem;padding:1rem 2.5rem">Launch dApp</a>
</div>

<footer>
  <p>© 2026 QRON / AuthiChain Protocol · <a href="https://authichain.com">authichain.com</a> · Contract: 0xAebfA6b08fb25b59748c93273aB8880e20FfE437</p>
</footer>
</body></html>`;
    return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "public,max-age=300" } });
  },
};
