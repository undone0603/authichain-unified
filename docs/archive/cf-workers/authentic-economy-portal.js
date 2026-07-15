--dbaa92765ff7d10f94763450d2829a716558f8402aa0d653ae481f8be41e
Content-Disposition: form-data; name="index.js"

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var WORKERS = {
  consensus: { url: "https://authichain-consensus-engine.undone-k.workers.dev", name: "Consensus Engine", desc: "5-Agent AI Verification API" },
  pulse: { url: "https://authichain-ecosystem-pulse.undone-k.workers.dev", name: "Ecosystem Pulse", desc: "Health Monitor & Status" },
  nexus: { url: "https://authichain-autonomous-nexus.undone-k.workers.dev", name: "Autonomous Nexus", desc: "Living System Visualization" },
  qron: { url: "https://authichain-qron-agentz.undone-k.workers.dev", name: "$QRON & AgentZ", desc: "Token & Agent Operations" }
};
function renderPortalHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Authentic Economy \u2014 Ecosystem Portal</title>
<meta name="description" content="The Authentic Economy: Four platforms, one protocol, infinite trust. Powered by $QRON on Polygon.">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, 'SF Pro Display', 'Inter', sans-serif;
  background: #020205;
  color: #e8e8e8;
  min-height: 100vh;
  overflow-x: hidden;
}

/* Animated Background */
.bg-scene {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none; z-index: 0;
}
.bg-scene::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background:
    radial-gradient(ellipse 800px 600px at 20% 30%, rgba(0,212,255,0.06) 0%, transparent 70%),
    radial-gradient(ellipse 600px 800px at 80% 70%, rgba(123,47,255,0.05) 0%, transparent 70%),
    radial-gradient(ellipse 500px 500px at 50% 50%, rgba(0,255,136,0.03) 0%, transparent 70%);
  animation: bgPulse 12s ease-in-out infinite alternate;
}
@keyframes bgPulse { 0% { opacity: 0.7; } 100% { opacity: 1; } }
.grid-lines {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background-image:
    linear-gradient(rgba(0,212,255,0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,212,255,0.02) 1px, transparent 1px);
  background-size: 80px 80px;
  animation: gridScroll 30s linear infinite;
}
@keyframes gridScroll { to { background-position: 80px 80px; } }

.content { position: relative; z-index: 1; }

/* Hero Section */
.hero {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}
.hero-badge {
  display: inline-flex; align-items: center; gap: 8px;
  background: rgba(0,212,255,0.05);
  border: 1px solid rgba(0,212,255,0.2);
  border-radius: 24px;
  padding: 6px 16px;
  font-size: 0.8em;
  color: #00D4FF;
  margin-bottom: 24px;
  animation: fadeIn 1s ease 0.2s both;
}
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.hero-badge .pulse { width: 6px; height: 6px; background: #00FF88; border-radius: 50%; animation: pulse 2s infinite; }
@keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(0,255,136,0.7); } 70% { box-shadow: 0 0 0 8px rgba(0,255,136,0); } }

.hero-title {
  font-size: clamp(2.5em, 6vw, 5em);
  font-weight: 900;
  line-height: 1.1;
  letter-spacing: -3px;
  background: linear-gradient(135deg, #ffffff 0%, #00D4FF 25%, #7B2FFF 50%, #FF6B35 75%, #00FF88 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-size: 300% 300%;
  animation: heroGradient 10s ease infinite, fadeIn 1s ease 0.4s both;
}
@keyframes heroGradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

.hero-sub {
  font-size: clamp(1em, 2vw, 1.3em);
  color: #888;
  margin-top: 16px;
  max-width: 600px;
  line-height: 1.5;
  animation: fadeIn 1s ease 0.6s both;
}

.hero-stats {
  display: flex; gap: 32px; margin-top: 40px; flex-wrap: wrap; justify-content: center;
  animation: fadeIn 1s ease 0.8s both;
}
.hero-stat { text-align: center; }
.hero-stat-value { font-size: 2em; font-weight: 900; color: #00D4FF; }
.hero-stat-label { font-size: 0.75em; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }

/* Workers Section */
.section { padding: 80px 20px; max-width: 1200px; margin: 0 auto; }
.section-title {
  font-size: 2em; font-weight: 800; text-align: center; margin-bottom: 12px;
  background: linear-gradient(135deg, #00D4FF, #7B2FFF);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.section-sub { text-align: center; color: #666; margin-bottom: 40px; font-size: 0.95em; }

.workers-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
.worker-card {
  background: rgba(10,10,20,0.8);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 20px;
  padding: 28px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  display: block;
  position: relative;
  overflow: hidden;
}
.worker-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, var(--card-color), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}
.worker-card:hover::before { opacity: 1; }
.worker-card:hover {
  border-color: var(--card-color, rgba(0,212,255,0.3));
  transform: translateY(-4px);
  box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 40px color-mix(in srgb, var(--card-color) 10%, transparent);
}
.worker-name { font-size: 1.2em; font-weight: 700; margin-bottom: 6px; }
.worker-desc { font-size: 0.85em; color: #888; margin-bottom: 12px; }
.worker-url { font-family: monospace; font-size: 0.7em; color: #555; word-break: break-all; }
.worker-status { display: inline-flex; align-items: center; gap: 4px; font-size: 0.75em; color: #00FF88; margin-top: 10px; }
.worker-status .dot { width: 5px; height: 5px; background: #00FF88; border-radius: 50%; }

/* Platforms Section */
.platforms-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
@media (max-width: 768px) { .platforms-grid { grid-template-columns: repeat(2, 1fr); } }
.platform-tile {
  background: rgba(10,10,20,0.8);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 16px;
  padding: 24px 16px;
  text-align: center;
  transition: all 0.3s ease;
}
.platform-tile:hover { border-color: var(--p-color); transform: translateY(-3px); }
.platform-icon { font-size: 2.5em; margin-bottom: 10px; }
.platform-name { font-weight: 700; font-size: 1em; margin-bottom: 4px; }
.platform-domain { font-size: 0.75em; color: var(--p-color); }
.platform-desc { font-size: 0.7em; color: #666; margin-top: 6px; }

/* Tech Stack */
.tech-flow {
  display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap;
  padding: 30px 0;
}
.tech-node {
  background: rgba(10,10,20,0.8);
  border: 1px solid rgba(0,212,255,0.1);
  border-radius: 10px;
  padding: 10px 16px;
  font-size: 0.8em;
  color: #aaa;
  transition: all 0.3s ease;
}
.tech-node:hover { border-color: #00D4FF; color: #00D4FF; }
.tech-arrow { color: #333; font-size: 1.2em; }

/* CTA */
.cta-section {
  text-align: center;
  padding: 60px 20px;
  background: linear-gradient(180deg, transparent, rgba(0,212,255,0.02), transparent);
}
.cta-title { font-size: 1.8em; font-weight: 800; margin-bottom: 12px; }
.cta-sub { color: #888; font-size: 0.95em; max-width: 500px; margin: 0 auto 24px; }
.cta-buttons { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.cta-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.9em;
  text-decoration: none;
  transition: all 0.3s ease;
}
.cta-btn-primary {
  background: linear-gradient(135deg, #00D4FF, #7B2FFF);
  color: #fff;
}
.cta-btn-primary:hover { transform: scale(1.05); box-shadow: 0 8px 30px rgba(0,212,255,0.3); }
.cta-btn-secondary {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: #ccc;
}
.cta-btn-secondary:hover { border-color: #00D4FF; color: #00D4FF; }

/* Footer */
.portal-footer {
  text-align: center;
  padding: 40px 20px;
  border-top: 1px solid rgba(255,255,255,0.03);
  color: #444;
  font-size: 0.75em;
  line-height: 2;
}
.portal-footer a { color: #00D4FF; text-decoration: none; }
.portal-footer a:hover { text-decoration: underline; }
</style>
</head>
<body>
<div class="bg-scene"><div class="grid-lines"></div></div>
<div class="content">

<!-- Hero -->
<section class="hero">
<div class="hero-badge"><span class="pulse"></span> Autonomous System Online \u2014 All Agents Active</div>
<h1 class="hero-title">The Authentic<br>Economy</h1>
<p class="hero-sub">Four platforms. One protocol. Infinite trust. Powered by 5-Agent AI Consensus, $QRON token, and AgentZ autonomous operations on Polygon blockchain.</p>
<div class="hero-stats">
<div class="hero-stat"><div class="hero-stat-value">4</div><div class="hero-stat-label">Platforms</div></div>
<div class="hero-stat"><div class="hero-stat-value">5</div><div class="hero-stat-label">AI Agents</div></div>
<div class="hero-stat"><div class="hero-stat-value">$0.004</div><div class="hero-stat-label">Per Seal</div></div>
<div class="hero-stat"><div class="hero-stat-value">2.1s</div><div class="hero-stat-label">Consensus</div></div>
<div class="hero-stat"><div class="hero-stat-value">99.7%</div><div class="hero-stat-label">Accuracy</div></div>
</div>
</section>

<!-- Platforms -->
<section class="section">
<h2 class="section-title">Ecosystem Platforms</h2>
<p class="section-sub">Four specialized platforms, unified by one authentication protocol</p>
<div class="platforms-grid">
<div class="platform-tile" style="--p-color: #00D4FF;">
<div class="platform-icon">\u26D3\uFE0F</div>
<div class="platform-name">AuthiChain</div>
<div class="platform-domain">authichain.com</div>
<div class="platform-desc">Core blockchain authentication protocol</div>
</div>
<div class="platform-tile" style="--p-color: #7B2FFF;">
<div class="platform-icon">\u{1F3A8}</div>
<div class="platform-name">QRON Studio</div>
<div class="platform-domain">qron.space</div>
<div class="platform-desc">AI-generated QR art platform</div>
</div>
<div class="platform-tile" style="--p-color: #00FF88;">
<div class="platform-icon">\u{1F33F}</div>
<div class="platform-name">StrainChain</div>
<div class="platform-domain">strainchain.io</div>
<div class="platform-desc">Cannabis provenance, seed to sale</div>
</div>
<div class="platform-tile" style="--p-color: #FFD700;">
<div class="platform-icon">\u{1F3DB}\uFE0F</div>
<div class="platform-name">GovChain</div>
<div class="platform-domain">govchain.us</div>
<div class="platform-desc">Government document verification</div>
</div>
</div>
</section>

<!-- Workers -->
<section class="section">
<h2 class="section-title">Autonomous Workers</h2>
<p class="section-sub">Live Cloudflare Workers powering the ecosystem \u2014 click to explore</p>
<div class="workers-grid">
<a href="${WORKERS.consensus.url}" target="_blank" class="worker-card" style="--card-color: #00D4FF;">
<div class="worker-name">\u26A1 ${WORKERS.consensus.name}</div>
<div class="worker-desc">${WORKERS.consensus.desc}</div>
<div class="worker-url">${WORKERS.consensus.url}</div>
<div class="worker-status"><span class="dot"></span> Deployed & Live</div>
</a>
<a href="${WORKERS.pulse.url}" target="_blank" class="worker-card" style="--card-color: #00FF88;">
<div class="worker-name">\u{1F493} ${WORKERS.pulse.name}</div>
<div class="worker-desc">${WORKERS.pulse.desc}</div>
<div class="worker-url">${WORKERS.pulse.url}</div>
<div class="worker-status"><span class="dot"></span> Deployed & Live</div>
</a>
<a href="${WORKERS.nexus.url}" target="_blank" class="worker-card" style="--card-color: #7B2FFF;">
<div class="worker-name">\u{1F310} ${WORKERS.nexus.name}</div>
<div class="worker-desc">${WORKERS.nexus.desc}</div>
<div class="worker-url">${WORKERS.nexus.url}</div>
<div class="worker-status"><span class="dot"></span> Deployed & Live</div>
</a>
<a href="${WORKERS.qron.url}" target="_blank" class="worker-card" style="--card-color: #FF6B35;">
<div class="worker-name">\u{1F48E} ${WORKERS.qron.name}</div>
<div class="worker-desc">${WORKERS.qron.desc}</div>
<div class="worker-url">${WORKERS.qron.url}</div>
<div class="worker-status"><span class="dot"></span> Deployed & Live</div>
</a>
</div>
</section>

<!-- Tech Stack -->
<section class="section">
<h2 class="section-title">Technology Stack</h2>
<p class="section-sub">Enterprise-grade infrastructure powering autonomous verification</p>
<div class="tech-flow">
<span class="tech-node">Polygon</span>
<span class="tech-arrow">\u2192</span>
<span class="tech-node">ERC-721 NFTs</span>
<span class="tech-arrow">\u2192</span>
<span class="tech-node">5-Agent Consensus</span>
<span class="tech-arrow">\u2192</span>
<span class="tech-node">IPFS/Pinata</span>
<span class="tech-arrow">\u2192</span>
<span class="tech-node">Cloudflare Edge</span>
</div>
<div class="tech-flow">
<span class="tech-node">Supabase</span>
<span class="tech-arrow">\u2192</span>
<span class="tech-node">Neo4j Graph</span>
<span class="tech-arrow">\u2192</span>
<span class="tech-node">Alchemy RPC</span>
<span class="tech-arrow">\u2192</span>
<span class="tech-node">Ed25519</span>
<span class="tech-arrow">\u2192</span>
<span class="tech-node">Fal.ai</span>
</div>
</section>

<!-- CTA -->
<section class="cta-section">
<h2 class="cta-title">Experience the Consensus</h2>
<p class="cta-sub">Try a live verification through the 5-Agent AI Consensus Engine. See how Guardian, Sentinel, Archivist, Arbiter, and Scout work together.</p>
<div class="cta-buttons">
<a href="${WORKERS.consensus.url}/verify?product_id=DEMO-001&name=Test+Product&manufacturer=Demo+Corp" target="_blank" class="cta-btn cta-btn-primary">\u{1F50D} Run Live Verification</a>
<a href="${WORKERS.nexus.url}" target="_blank" class="cta-btn cta-btn-secondary">\u{1F310} View Autonomous Nexus</a>
</div>
</section>

<!-- Footer -->
<footer class="portal-footer">
<strong>The Authentic Economy</strong> \u2014 Built by AuthiChain<br>
<a href="https://authichain.com">authichain.com</a> \u2022
<a href="https://qron.space">qron.space</a> \u2022
<a href="https://strainchain.io">strainchain.io</a> \u2022
<a href="https://govchain.us">govchain.us</a><br><br>
Zachary Kietzman, CEO \u2022 Roscommon, Michigan<br>
SAM.gov Registered \u2022 UEI: R34XKWRJY9A5 \u2022 CAGE: 1PUJ6 \u2022 NAICS: 541519<br>
$QRON Contract: 0xAebfA6b08fb25b59748c93273aB8880e20FfE437 \u2022 Polygon (137)<br><br>
Powered by Cloudflare Workers \u2022 EU Digital Product Passport Compliant
</footer>
</div>
</body>
</html>`;
}
__name(renderPortalHTML, "renderPortalHTML");
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "X-Powered-By": "The Authentic Economy Portal",
      "X-Ecosystem": "AuthiChain | QRON | StrainChain | GovChain"
    };
    if (url.pathname === "/" || url.pathname === "/portal") {
      return new Response(renderPortalHTML(), {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }
      });
    }
    if (url.pathname === "/api/ecosystem") {
      return new Response(JSON.stringify({
        name: "The Authentic Economy",
        tagline: "Four platforms. One protocol. Infinite trust.",
        entity: {
          name: "AuthiChain",
          ceo: "Zachary Kietzman",
          location: "Roscommon, MI 48653",
          sam_gov: { uei: "R34XKWRJY9A5", cage: "1PUJ6", naics: "541519", psc: "7A20" }
        },
        platforms: {
          authichain: { domain: "authichain.com", role: "Core Protocol" },
          qron: { domain: "qron.space", role: "AI QR Art" },
          strainchain: { domain: "strainchain.io", role: "Cannabis Provenance" },
          govchain: { domain: "govchain.us", role: "Gov Verification" }
        },
        workers: WORKERS,
        token: {
          symbol: "$QRON",
          contract: "0xAebfA6b08fb25b59748c93273aB8880e20FfE437",
          chain: "Polygon (137)",
          standard: "ERC-20",
          supply: "1,000,000,000"
        },
        consensus_engine: {
          agents: 5,
          weights: { guardian: "35%", sentinel: "25%", archivist: "20%", arbiter: "12%", scout: "8%" },
          cost_per_seal: "$0.004",
          avg_time: "2.1s",
          accuracy: "99.7%",
          nft_standard: "ERC-721",
          eu_dpp_compliant: true
        },
        autonomous_agent: {
          name: "AgentZ",
          type: "Desktop-native browser-agent",
          embodiment: "Physics-based"
        },
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    return Response.redirect(url.origin + "/", 302);
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map

--dbaa92765ff7d10f94763450d2829a716558f8402aa0d653ae481f8be41e--
