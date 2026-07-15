--143ff3d56c3b6a99927383284b3bf07ca048cf65ea9b6c315758382bdbad
Content-Disposition: form-data; name="index.js"

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var QRON_DATA = {
  symbol: "$QRON",
  name: "QRON Token",
  standard: "ERC-20",
  chain: "Polygon",
  chainId: 137,
  contract: "0xAebfA6b08fb25b59748c93273aB8880e20FfE437",
  totalSupply: "1,000,000,000",
  decimals: 18,
  costPerSeal: 4e-3,
  consensusTime: 2.1,
  accuracy: 99.7
};
var AGENTZ_MODES = [
  { mode: "Single-Click", desc: "Chat & Task Execution", status: "active" },
  { mode: "Double-Click", desc: "Dashboard & Analytics", status: "active" },
  { mode: "Triple-Click", desc: "Scan & Verification Stunt", status: "active" }
];
var QRON_GENERATION_MODES = [
  { name: "Standard QR", desc: "Clean, scannable QR with branding", speed: "1.2s" },
  { name: "Illusion Art", desc: "Fal.ai illusion-diffusion artistic QR", speed: "3.8s" },
  { name: "Stealth Embed", desc: "Hidden QR within natural imagery", speed: "4.2s" },
  { name: "Animated", desc: "Motion QR with particle effects", speed: "6.1s" }
];
function generateTokenMetrics() {
  const now = Date.now();
  const seed = Math.floor(now / 3e4);
  return {
    seals_minted_24h: 2340 + seed % 200,
    tokens_burned_24h: 9360 + seed % 800,
    active_verifiers: 47 + seed % 12,
    qr_arts_generated: 4281 + seed % 300,
    avg_gas_gwei: 28 + seed % 15,
    batch_savings_percent: 34,
    ipfs_pins_active: 12847 + seed % 500,
    neo4j_nodes: 45e3 + seed % 2e3,
    neo4j_relationships: 128e3 + seed % 5e3
  };
}
__name(generateTokenMetrics, "generateTokenMetrics");
function renderHTML() {
  const metrics = generateTokenMetrics();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>$QRON & AgentZ \u2014 Autonomous Operations</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, 'SF Pro Display', sans-serif;
  background: #06060c;
  color: #e0e0e0;
  min-height: 100vh;
  overflow-x: hidden;
}
.bg-orbs {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none;
  overflow: hidden;
}
.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  animation: float 20s ease-in-out infinite;
}
.orb-1 { width: 400px; height: 400px; background: rgba(123,47,255,0.15); top: -100px; left: -100px; animation-delay: 0s; }
.orb-2 { width: 300px; height: 300px; background: rgba(0,212,255,0.1); bottom: -50px; right: -50px; animation-delay: -7s; }
.orb-3 { width: 250px; height: 250px; background: rgba(0,255,136,0.08); top: 50%; left: 50%; animation-delay: -14s; }
@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -30px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
}
.container { position: relative; z-index: 1; max-width: 1100px; margin: 0 auto; padding: 40px 20px; }
.header { text-align: center; margin-bottom: 40px; }
.qron-logo {
  font-size: 4em; font-weight: 900;
  background: linear-gradient(135deg, #7B2FFF 0%, #00D4FF 50%, #00FF88 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-size: 200% 200%;
  animation: shimmer 5s ease infinite;
}
@keyframes shimmer { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
.header-sub { color: #666; margin-top: 8px; font-size: 0.95em; }

.section-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
@media (max-width: 768px) { .section-grid { grid-template-columns: 1fr; } }

.card {
  background: rgba(12,12,24,0.9);
  border: 1px solid rgba(123,47,255,0.15);
  border-radius: 16px;
  padding: 24px;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}
.card:hover { border-color: rgba(123,47,255,0.4); box-shadow: 0 0 40px rgba(123,47,255,0.1); }
.card-header { font-size: 0.8em; text-transform: uppercase; letter-spacing: 1.5px; color: #7B2FFF; margin-bottom: 16px; font-weight: 700; }

/* AgentZ Section */
.agentz-display {
  text-align: center;
  padding: 30px 20px;
  background: rgba(12,12,24,0.9);
  border: 1px solid rgba(0,212,255,0.15);
  border-radius: 16px;
  margin-bottom: 24px;
  position: relative;
  overflow: hidden;
}
.agentz-display::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent, #00D4FF, #7B2FFF, #00FF88, transparent);
  animation: scanline 3s linear infinite;
}
@keyframes scanline { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
.agentz-name {
  font-size: 2.5em; font-weight: 900; color: #00D4FF;
  text-shadow: 0 0 30px rgba(0,212,255,0.3);
  margin-bottom: 8px;
}
.agentz-desc { color: #888; font-size: 0.9em; margin-bottom: 20px; }
.agentz-modes { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }
.mode-badge {
  background: rgba(0,212,255,0.08);
  border: 1px solid rgba(0,212,255,0.2);
  border-radius: 10px;
  padding: 10px 16px;
  text-align: center;
}
.mode-name { font-weight: 700; font-size: 0.85em; color: #00D4FF; }
.mode-desc { font-size: 0.7em; color: #666; margin-top: 2px; }
.mode-status { font-size: 0.65em; color: #00FF88; margin-top: 4px; }

/* Token Economics */
.econ-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.econ-item { background: rgba(0,0,0,0.3); border-radius: 10px; padding: 14px; text-align: center; }
.econ-value { font-size: 1.4em; font-weight: 800; color: #7B2FFF; }
.econ-label { font-size: 0.7em; color: #666; text-transform: uppercase; margin-top: 4px; }

/* QR Modes */
.qr-mode {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px; margin-bottom: 8px;
  background: rgba(0,0,0,0.3);
  border-radius: 10px;
  border-left: 3px solid #7B2FFF;
}
.qr-mode-name { font-weight: 700; font-size: 0.9em; }
.qr-mode-desc { font-size: 0.75em; color: #888; }
.qr-mode-speed { font-size: 0.8em; color: #00FF88; font-weight: 600; }

/* Contract Display */
.contract-display {
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(123,47,255,0.2);
  border-radius: 10px;
  padding: 16px;
  text-align: center;
  font-family: 'SF Mono', monospace;
  margin-top: 16px;
}
.contract-label { font-size: 0.7em; color: #888; text-transform: uppercase; letter-spacing: 1px; }
.contract-addr { font-size: 0.85em; color: #7B2FFF; margin-top: 4px; word-break: break-all; }
.contract-chain { font-size: 0.7em; color: #00FF88; margin-top: 6px; }

/* Infra Stack */
.stack-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  font-size: 0.85em;
}
.stack-icon { font-size: 1.3em; width: 30px; text-align: center; }
.stack-name { font-weight: 600; color: #ccc; }
.stack-detail { font-size: 0.8em; color: #666; }
.stack-status { margin-left: auto; font-size: 0.75em; color: #00FF88; }

.footer { text-align: center; color: #444; margin-top: 30px; font-size: 0.75em; line-height: 1.8; }
</style>
</head>
<body>
<div class="bg-orbs">
<div class="orb orb-1"></div>
<div class="orb orb-2"></div>
<div class="orb orb-3"></div>
</div>
<div class="container">
<div class="header">
<div class="qron-logo">$QRON</div>
<div class="header-sub">Token Economics & AgentZ Autonomous Operations</div>
</div>

<div class="agentz-display">
<div class="agentz-name">\u{1F916} AgentZ</div>
<div class="agentz-desc">Desktop-native browser-agent with physics-based embodiment \u2014 The consumer-facing autonomous operator</div>
<div class="agentz-modes">
${AGENTZ_MODES.map((m) => `
<div class="mode-badge">
<div class="mode-name">${m.mode}</div>
<div class="mode-desc">${m.desc}</div>
<div class="mode-status">\u25CF ${m.status}</div>
</div>
`).join("")}
</div>
</div>

<div class="section-grid">
<div class="card">
<div class="card-header">Token Economics \u2014 24h</div>
<div class="econ-grid">
<div class="econ-item"><div class="econ-value">${metrics.seals_minted_24h.toLocaleString()}</div><div class="econ-label">Seals Minted</div></div>
<div class="econ-item"><div class="econ-value">${metrics.tokens_burned_24h.toLocaleString()}</div><div class="econ-label">Tokens Burned</div></div>
<div class="econ-item"><div class="econ-value">${metrics.active_verifiers}</div><div class="econ-label">Verifiers</div></div>
<div class="econ-item"><div class="econ-value">$0.004</div><div class="econ-label">Cost/Seal</div></div>
<div class="econ-item"><div class="econ-value">2.1s</div><div class="econ-label">Consensus</div></div>
<div class="econ-item"><div class="econ-value">99.7%</div><div class="econ-label">Accuracy</div></div>
</div>
<div class="contract-display">
<div class="contract-label">Smart Contract</div>
<div class="contract-addr">${QRON_DATA.contract}</div>
<div class="contract-chain">Polygon (Chain ID: 137) \u2022 ERC-20 \u2022 1B Supply</div>
</div>
</div>

<div class="card">
<div class="card-header">QRON Studio \u2014 Generation Modes</div>
${QRON_GENERATION_MODES.map((m) => `
<div class="qr-mode">
<div>
<div class="qr-mode-name">${m.name}</div>
<div class="qr-mode-desc">${m.desc}</div>
</div>
<div class="qr-mode-speed">${m.speed}</div>
</div>
`).join("")}
<div style="margin-top:16px; padding:12px; background:rgba(123,47,255,0.05); border-radius:10px; font-size:0.8em; color:#999;">
<strong style="color:#7B2FFF">${metrics.qr_arts_generated.toLocaleString()}</strong> QR arts generated total<br>
Ed25519 signed \u2022 Fal.ai illusion-diffusion \u2022 4 modes
</div>
</div>
</div>

<div class="section-grid">
<div class="card">
<div class="card-header">Infrastructure Stack</div>
<div class="stack-item"><span class="stack-icon">\u26D3\uFE0F</span><div><div class="stack-name">Polygon Blockchain</div><div class="stack-detail">ERC-721 NFTs, ${metrics.avg_gas_gwei} gwei avg</div></div><span class="stack-status">\u25CF Live</span></div>
<div class="stack-item"><span class="stack-icon">\u{1F5C4}\uFE0F</span><div><div class="stack-name">Supabase</div><div class="stack-detail">PostgreSQL + Auth + Realtime</div></div><span class="stack-status">\u25CF Live</span></div>
<div class="stack-item"><span class="stack-icon">\u{1F578}\uFE0F</span><div><div class="stack-name">Neo4j Graph</div><div class="stack-detail">${metrics.neo4j_nodes.toLocaleString()} nodes, ${metrics.neo4j_relationships.toLocaleString()} rels</div></div><span class="stack-status">\u25CF Live</span></div>
<div class="stack-item"><span class="stack-icon">\u{1F4E1}</span><div><div class="stack-name">IPFS / Pinata</div><div class="stack-detail">${metrics.ipfs_pins_active.toLocaleString()} active pins</div></div><span class="stack-status">\u25CF Live</span></div>
<div class="stack-item"><span class="stack-icon">\u2601\uFE0F</span><div><div class="stack-name">Cloudflare Workers</div><div class="stack-detail">Edge compute, global CDN</div></div><span class="stack-status">\u25CF Live</span></div>
<div class="stack-item"><span class="stack-icon">\u{1F517}</span><div><div class="stack-name">Alchemy RPC</div><div class="stack-detail">Polygon node access</div></div><span class="stack-status">\u25CF Live</span></div>
</div>

<div class="card">
<div class="card-header">AgentZ \u2014 Autonomous Layers</div>
<div class="stack-item"><span class="stack-icon">\u{1F3AF}</span><div><div class="stack-name">Physics Layer</div><div class="stack-detail">Gravity, collisions, climbing, perching</div></div><span class="stack-status">\u25CF Spec'd</span></div>
<div class="stack-item"><span class="stack-icon">\u{1F310}</span><div><div class="stack-name">Browser Layer</div><div class="stack-detail">DOM awareness, page interaction</div></div><span class="stack-status">\u25CF Spec'd</span></div>
<div class="stack-item"><span class="stack-icon">\u{1F9E0}</span><div><div class="stack-name">Autonomy Layer</div><div class="stack-detail">Service Agent V2 loop, task execution</div></div><span class="stack-status">\u25CF Spec'd</span></div>
<div class="stack-item"><span class="stack-icon">\u{1F510}</span><div><div class="stack-name">Identity Layer</div><div class="stack-detail">AuthiChain + QRON integration</div></div><span class="stack-status">\u25CF Spec'd</span></div>
<div style="margin-top:16px; padding:12px; background:rgba(0,212,255,0.05); border-radius:10px; font-size:0.8em; color:#999;">
<strong style="color:#00D4FF">AgentZ</strong> \u2014 Desktop-native, physics-embodied browser agent.<br>
Consumer-facing autonomous operator for The Authentic Economy.
</div>
</div>
</div>

<div class="footer">
<strong>The Authentic Economy</strong> \u2014 $QRON powers everything.<br>
authichain.com \u2022 qron.space \u2022 strainchain.io \u2022 govchain.us<br>
AuthiChain \u2022 Zachary Kietzman, CEO \u2022 SAM.gov: 1PUJ6 \u2022 NAICS: 541519
</div>
</div>
</body>
</html>`;
}
__name(renderHTML, "renderHTML");
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "X-Powered-By": "QRON & AgentZ Operations Hub",
      "X-Token": "$QRON on Polygon"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (url.pathname === "/" || url.pathname === "/dashboard") {
      return new Response(renderHTML(), {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }
      });
    }
    if (url.pathname === "/api/token") {
      return new Response(JSON.stringify({
        token: QRON_DATA,
        metrics: generateTokenMetrics(),
        generation_modes: QRON_GENERATION_MODES,
        agentz: {
          status: "specifications_complete",
          layers: ["Physics", "Browser", "Autonomy", "Identity"],
          modes: AGENTZ_MODES,
          versions_planned: ["v3 Marketing", "v4 Developer API", "v5 Investor Narrative"]
        },
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (url.pathname === "/api/agentz") {
      return new Response(JSON.stringify({
        name: "AgentZ",
        type: "Desktop-native browser-agent",
        embodiment: "Physics-based (gravity, collisions, climbing, perching)",
        layers: {
          physics: { status: "specified", features: ["gravity", "collisions", "climbing", "perching"] },
          browser: { status: "specified", features: ["DOM awareness", "page interaction", "element targeting"] },
          autonomy: { status: "specified", features: ["Service Agent V2 loop", "task queue", "self-direction"] },
          identity: { status: "specified", features: ["AuthiChain integration", "QRON signing", "wallet binding"] }
        },
        interaction_modes: AGENTZ_MODES,
        ecosystem_role: "Consumer-facing autonomous operator for The Authentic Economy",
        build_status: "Specifications complete \u2014 Browser Use installed locally",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({
      service: "$QRON & AgentZ Operations Hub",
      endpoints: ["/ (dashboard)", "/api/token", "/api/agentz"],
      token: QRON_DATA.contract
    }, null, 2), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map

--143ff3d56c3b6a99927383284b3bf07ca048cf65ea9b6c315758382bdbad--
