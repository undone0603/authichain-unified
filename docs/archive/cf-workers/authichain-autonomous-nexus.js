--33010363216b0545017a67a42d99bb80db869aeac7c1920d8a06a1cd0891
Content-Disposition: form-data; name="index.js"

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
function renderNexusHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Authentic Economy \u2014 Autonomous Nexus</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow-x: hidden; }
body {
  font-family: -apple-system, 'SF Pro Display', 'Inter', sans-serif;
  background: #030308;
  color: #e0e0e0;
}

/* Canvas Background */
#nexus-canvas {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  z-index: 0; opacity: 0.7;
}

/* Overlay Content */
.overlay {
  position: relative; z-index: 1;
  min-height: 100vh;
  padding: 30px 20px;
}

/* Header */
.nexus-header {
  text-align: center;
  margin-bottom: 40px;
  animation: fadeInDown 1s ease;
}
@keyframes fadeInDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
.nexus-title {
  font-size: 3em;
  font-weight: 900;
  background: linear-gradient(135deg, #00D4FF 0%, #7B2FFF 30%, #FF6B35 60%, #00FF88 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-size: 300% 300%;
  animation: gradientFlow 8s ease infinite;
  letter-spacing: -2px;
}
@keyframes gradientFlow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
.nexus-subtitle { color: #666; font-size: 1em; margin-top: 8px; letter-spacing: 2px; text-transform: uppercase; }
.autonomous-badge {
  display: inline-flex; align-items: center; gap: 8px;
  background: linear-gradient(135deg, rgba(0,212,255,0.1), rgba(123,47,255,0.1));
  border: 1px solid rgba(0,212,255,0.3);
  border-radius: 24px; padding: 6px 18px; margin-top: 16px;
  font-size: 0.85em; color: #00D4FF;
  animation: pulseGlow 3s ease-in-out infinite;
}
@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 10px rgba(0,212,255,0.2); }
  50% { box-shadow: 0 0 25px rgba(0,212,255,0.4); }
}
.autonomous-badge .dot { width: 8px; height: 8px; background: #00FF88; border-radius: 50%; animation: blink 1.2s infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }

/* Main Grid */
.nexus-grid {
  display: grid;
  grid-template-columns: 1fr 1.5fr 1fr;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
}
@media (max-width: 1024px) { .nexus-grid { grid-template-columns: 1fr; } }

/* Cards */
.nexus-card {
  background: rgba(10, 10, 20, 0.85);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 20px;
  padding: 24px;
  backdrop-filter: blur(20px);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.nexus-card:hover {
  border-color: rgba(0,212,255,0.3);
  transform: translateY(-3px);
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}
.card-title {
  font-size: 0.85em;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: #888;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-title .indicator { width: 6px; height: 6px; border-radius: 50%; animation: blink 2s infinite; }

/* Consensus Visualization */
.consensus-viz {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.agent-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(0,0,0,0.3);
  border-radius: 10px;
  transition: all 0.3s ease;
}
.agent-row:hover { background: rgba(0,212,255,0.05); }
.agent-icon { font-size: 1.4em; width: 36px; text-align: center; }
.agent-info { flex: 1; }
.agent-name { font-weight: 700; font-size: 0.9em; }
.agent-role { font-size: 0.7em; color: #666; }
.agent-bar {
  height: 4px;
  border-radius: 2px;
  margin-top: 4px;
  animation: barGrow 2s ease-out forwards;
  transform-origin: left;
}
@keyframes barGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.agent-score { font-weight: 800; font-size: 1.1em; }

/* Activity Feed */
.activity-feed { max-height: 400px; overflow-y: auto; }
.activity-feed::-webkit-scrollbar { width: 3px; }
.activity-feed::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.3); border-radius: 3px; }
.activity-item {
  display: flex; gap: 10px; padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  animation: slideIn 0.5s ease;
  font-size: 0.85em;
}
@keyframes slideIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
.activity-time { color: #444; font-size: 0.75em; white-space: nowrap; font-family: monospace; }
.activity-text { color: #aaa; line-height: 1.4; }
.activity-text strong { color: #00D4FF; font-weight: 600; }

/* Platform Nodes */
.platform-nodes { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.platform-node {
  background: rgba(0,0,0,0.4);
  border: 1px solid var(--node-color, rgba(255,255,255,0.05));
  border-radius: 12px;
  padding: 14px;
  text-align: center;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}
.platform-node::after {
  content: '';
  position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
  background: radial-gradient(circle, var(--node-color) 0%, transparent 70%);
  opacity: 0.03;
}
.platform-node:hover { transform: scale(1.03); border-color: var(--node-color); }
.node-icon { font-size: 1.8em; margin-bottom: 6px; }
.node-name { font-weight: 700; font-size: 0.85em; }
.node-status { font-size: 0.7em; color: #00FF88; margin-top: 4px; }
.node-metric { font-size: 0.7em; color: #666; margin-top: 2px; }

/* Token Pulse */
.token-pulse {
  text-align: center;
  padding: 20px;
}
.token-symbol {
  font-size: 2.5em;
  font-weight: 900;
  background: linear-gradient(135deg, #7B2FFF, #00D4FF);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: tokenPulse 3s ease-in-out infinite;
}
@keyframes tokenPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
.token-contract {
  font-family: monospace;
  font-size: 0.65em;
  color: #555;
  margin-top: 8px;
  word-break: break-all;
}
.token-stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px; }
.token-stat { background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px; }
.token-stat-val { font-size: 1.2em; font-weight: 800; color: #7B2FFF; }
.token-stat-lbl { font-size: 0.65em; color: #666; text-transform: uppercase; }

/* Verification Flow */
.flow-steps { position: relative; padding-left: 20px; }
.flow-step {
  position: relative;
  padding: 12px 0 12px 20px;
  border-left: 2px solid rgba(0,212,255,0.2);
  font-size: 0.82em;
  color: #999;
  transition: all 0.3s ease;
}
.flow-step.active { color: #00D4FF; border-left-color: #00D4FF; }
.flow-step::before {
  content: '';
  position: absolute; left: -5px; top: 16px;
  width: 8px; height: 8px;
  background: rgba(0,212,255,0.3);
  border-radius: 50%;
}
.flow-step.active::before { background: #00D4FF; box-shadow: 0 0 10px #00D4FF; }

/* Footer */
.nexus-footer {
  text-align: center;
  margin-top: 40px;
  padding: 20px;
  color: #444;
  font-size: 0.75em;
}
.nexus-footer a { color: #00D4FF; text-decoration: none; }

/* Seal Counter */
.seal-counter {
  text-align: center;
  margin: 20px 0;
}
.seal-number {
  font-size: 3em;
  font-weight: 900;
  color: #00D4FF;
  font-family: monospace;
  text-shadow: 0 0 30px rgba(0,212,255,0.3);
}
.seal-label { font-size: 0.8em; color: #666; text-transform: uppercase; letter-spacing: 2px; }
</style>
</head>
<body>
<canvas id="nexus-canvas"></canvas>
<div class="overlay">
<div class="nexus-header">
<div class="nexus-title">The Authentic Economy</div>
<div class="nexus-subtitle">Autonomous Nexus \u2014 Living System Display</div>
<div class="autonomous-badge">
<span class="dot"></span>
AUTONOMOUS MODE ACTIVE \u2014 5 AI Agents Online \u2014 AgentZ Operational
</div>
</div>

<div class="nexus-grid">
<!-- Left Column -->
<div style="display:flex; flex-direction:column; gap:20px;">
<div class="nexus-card">
<div class="card-title"><span class="indicator" style="background:#00D4FF"></span>Platform Nodes</div>
<div class="platform-nodes">
<div class="platform-node" style="--node-color: #00D4FF;">
<div class="node-icon">\u26D3\uFE0F</div>
<div class="node-name">AuthiChain</div>
<div class="node-status">\u25CF Online</div>
<div class="node-metric">Core Protocol</div>
</div>
<div class="platform-node" style="--node-color: #7B2FFF;">
<div class="node-icon">\u{1F3A8}</div>
<div class="node-name">QRON</div>
<div class="node-status">\u25CF Online</div>
<div class="node-metric">AI QR Art</div>
</div>
<div class="platform-node" style="--node-color: #00FF88;">
<div class="node-icon">\u{1F33F}</div>
<div class="node-name">StrainChain</div>
<div class="node-status">\u25CF Online</div>
<div class="node-metric">Cannabis Track</div>
</div>
<div class="platform-node" style="--node-color: #FFD700;">
<div class="node-icon">\u{1F3DB}\uFE0F</div>
<div class="node-name">GovChain</div>
<div class="node-status">\u25CF Online</div>
<div class="node-metric">Gov Verify</div>
</div>
</div>
</div>

<div class="nexus-card">
<div class="card-title"><span class="indicator" style="background:#7B2FFF"></span>$QRON Token</div>
<div class="token-pulse">
<div class="token-symbol">$QRON</div>
<div class="token-contract">0xAebfA6b08fb25b59748c93273aB8880e20FfE437</div>
<div class="token-stats-grid">
<div class="token-stat"><div class="token-stat-val">1B</div><div class="token-stat-lbl">Supply</div></div>
<div class="token-stat"><div class="token-stat-val">ERC-20</div><div class="token-stat-lbl">Standard</div></div>
<div class="token-stat"><div class="token-stat-val">137</div><div class="token-stat-lbl">Chain ID</div></div>
</div>
</div>
</div>
</div>

<!-- Center Column -->
<div style="display:flex; flex-direction:column; gap:20px;">
<div class="nexus-card">
<div class="card-title"><span class="indicator" style="background:#FF6B35"></span>5-Agent Consensus Engine \u2014 Live</div>
<div class="consensus-viz">
<div class="agent-row">
<div class="agent-icon">\u{1F6E1}\uFE0F</div>
<div class="agent-info">
<div class="agent-name">Guardian</div>
<div class="agent-role">Primary Authentication & Trust</div>
<div class="agent-bar" style="width:35%; background: linear-gradient(90deg, #00D4FF, #0099cc);"></div>
</div>
<div class="agent-score" style="color:#00D4FF">35%</div>
</div>
<div class="agent-row">
<div class="agent-icon">\u{1F441}\uFE0F</div>
<div class="agent-info">
<div class="agent-name">Sentinel</div>
<div class="agent-role">Anomaly Detection & Threats</div>
<div class="agent-bar" style="width:25%; background: linear-gradient(90deg, #FF6B35, #cc4400);"></div>
</div>
<div class="agent-score" style="color:#FF6B35">25%</div>
</div>
<div class="agent-row">
<div class="agent-icon">\u{1F4DC}</div>
<div class="agent-info">
<div class="agent-name">Archivist</div>
<div class="agent-role">Historical Provenance Chain</div>
<div class="agent-bar" style="width:20%; background: linear-gradient(90deg, #7B2FFF, #5500cc);"></div>
</div>
<div class="agent-score" style="color:#7B2FFF">20%</div>
</div>
<div class="agent-row">
<div class="agent-icon">\u2696\uFE0F</div>
<div class="agent-info">
<div class="agent-name">Arbiter</div>
<div class="agent-role">Conflict Resolution & Judgment</div>
<div class="agent-bar" style="width:12%; background: linear-gradient(90deg, #FFD700, #cc9900);"></div>
</div>
<div class="agent-score" style="color:#FFD700">12%</div>
</div>
<div class="agent-row">
<div class="agent-icon">\u{1F52D}</div>
<div class="agent-info">
<div class="agent-name">Scout</div>
<div class="agent-role">Network Intelligence & Edge</div>
<div class="agent-bar" style="width:8%; background: linear-gradient(90deg, #00FF88, #00cc66);"></div>
</div>
<div class="agent-score" style="color:#00FF88">8%</div>
</div>
</div>
<div class="seal-counter">
<div class="seal-number" id="seal-count">24,847</div>
<div class="seal-label">Authenticity Seals Minted</div>
</div>
</div>

<div class="nexus-card">
<div class="card-title"><span class="indicator" style="background:#00FF88"></span>Verification Flow \u2014 Active</div>
<div class="flow-steps" id="flow-steps">
<div class="flow-step active">\u2460 Product data ingested via API or scan</div>
<div class="flow-step">\u2461 Guardian initiates trust scoring (35% weight)</div>
<div class="flow-step">\u2462 Sentinel scans for anomalies in parallel</div>
<div class="flow-step">\u2463 Archivist traces provenance chain history</div>
<div class="flow-step">\u2464 Arbiter resolves inter-agent conflicts</div>
<div class="flow-step">\u2465 Scout validates external network intelligence</div>
<div class="flow-step">\u2466 Weighted consensus \u2192 ERC-721 Seal minted</div>
<div class="flow-step">\u2467 IPFS pin + Polygon confirmation (2.1s avg)</div>
</div>
</div>
</div>

<!-- Right Column -->
<div style="display:flex; flex-direction:column; gap:20px;">
<div class="nexus-card">
<div class="card-title"><span class="indicator" style="background:#00FF88"></span>AgentZ \u2014 Autonomous Feed</div>
<div class="activity-feed" id="activity-feed"></div>
</div>

<div class="nexus-card">
<div class="card-title"><span class="indicator" style="background:#FFD700"></span>Entity</div>
<div style="font-size:0.85em; color:#999; line-height:1.8;">
<strong style="color:#FFD700">AuthiChain</strong><br>
Zachary Kietzman, CEO<br>
109 N 4th St, Roscommon, MI 48653<br>
SAM.gov Registered \u2713<br>
CAGE: 1PUJ6 | UEI: R34XKWRJY9A5<br>
NAICS: 541519<br>
PSC: 7A20
</div>
</div>
</div>
</div>

<div class="nexus-footer">
<strong>The Authentic Economy</strong> \u2014 Four platforms, one protocol, infinite trust.<br>
<a href="https://authichain.com">authichain.com</a> \u2022
<a href="https://qron.space">qron.space</a> \u2022
<a href="https://strainchain.io">strainchain.io</a> \u2022
<a href="https://govchain.us">govchain.us</a><br><br>
Powered by Cloudflare Workers \u2022 Polygon Blockchain \u2022 $QRON Token<br>
EU Digital Product Passport Compliant \u2022 Cost per seal: $0.004
</div>
</div>

<script>
// Particle Network Canvas
const canvas = document.getElementById('nexus-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
let connections = [];

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

const colors = ['#00D4FF', '#7B2FFF', '#FF6B35', '#00FF88', '#FFD700'];

class Particle {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.radius = Math.random() * 2 + 1;
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.alpha = Math.random() * 0.5 + 0.2;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
    if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.alpha;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

for (let i = 0; i < 80; i++) particles.push(new Particle());

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  for (let i = 0; i < particles.length; i++) {
    particles[i].update();
    particles[i].draw();
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150) {
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.strokeStyle = particles[i].color;
        ctx.globalAlpha = (1 - dist / 150) * 0.15;
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }
  requestAnimationFrame(animate);
}
animate();

// Autonomous Activity Feed
const activities = [
  { icon: '\u{1F6E1}\uFE0F', text: '<strong>Guardian</strong> verified product SEAL-Ax7k9mP2 \u2014 confidence 0.97' },
  { icon: '\u{1F3A8}', text: '<strong>QRON Studio</strong> generated QR art #4,281 via Fal.ai illusion-diffusion' },
  { icon: '\u{1F33F}', text: '<strong>StrainChain</strong> tracked batch MI-DISP-0847 from cultivator to shelf' },
  { icon: '\u{1F3DB}\uFE0F', text: '<strong>GovChain</strong> authenticated document DOC-FED-2847 \u2014 tamper-free' },
  { icon: '\u{1F441}\uFE0F', text: '<strong>Sentinel</strong> cleared anomaly scan \u2014 0 threats detected across network' },
  { icon: '\u{1F4DC}', text: '<strong>Archivist</strong> indexed 47 new provenance nodes in Neo4j graph' },
  { icon: '\u2696\uFE0F', text: '<strong>Arbiter</strong> resolved consensus conflict \u2014 Guardian+Sentinel aligned' },
  { icon: '\u{1F52D}', text: '<strong>Scout</strong> validated 12 external data sources \u2014 all corroborated' },
  { icon: '\u26D3\uFE0F', text: '<strong>Polygon</strong> confirmed block #67,284,019 \u2014 3 seals finalized' },
  { icon: '\u{1F916}', text: '<strong>AgentZ</strong> completed autonomous task #156 \u2014 zero human intervention' },
  { icon: '\u{1F48E}', text: '<strong>$QRON</strong> utility: 2,340 tokens burned for seal minting today' },
  { icon: '\u{1F4E1}', text: '<strong>IPFS</strong> pinned 28 new authenticity proofs via Pinata gateway' },
  { icon: '\u{1F6E1}\uFE0F', text: '<strong>Guardian</strong> trust score recalibrated \u2014 network confidence 99.7%' },
  { icon: '\u{1F3A8}', text: '<strong>QRON</strong> Ed25519 signature batch: 89 QR codes signed this hour' },
  { icon: '\u{1F33F}', text: '<strong>StrainChain</strong> METRC sync complete \u2014 12 Michigan dispensaries updated' },
  { icon: '\u{1F3DB}\uFE0F', text: '<strong>GovChain</strong> EU DPP compliance check passed \u2014 all standards met' },
  { icon: '\u{1F916}', text: '<strong>AgentZ</strong> physics engine: navigating DOM tree autonomously' },
  { icon: '\u26A1', text: '<strong>Consensus</strong> achieved in 1.8s \u2014 below 2.1s target \u2014 optimized' },
];

const feed = document.getElementById('activity-feed');
let activityIndex = 0;

function addActivity() {
  const activity = activities[activityIndex % activities.length];
  const now = new Date();
  const time = now.toLocaleTimeString();
  
  const item = document.createElement('div');
  item.className = 'activity-item';
  item.innerHTML = \`
    <span class="activity-time">\${time}</span>
    <span class="activity-text">\${activity.icon} \${activity.text}</span>
  \`;
  
  feed.insertBefore(item, feed.firstChild);
  if (feed.children.length > 20) feed.removeChild(feed.lastChild);
  
  activityIndex++;
}

// Initial feed
for (let i = 0; i < 8; i++) { addActivity(); }
setInterval(addActivity, 4000);

// Verification Flow Animation
const steps = document.querySelectorAll('.flow-step');
let currentStep = 0;
setInterval(() => {
  steps.forEach(s => s.classList.remove('active'));
  steps[currentStep].classList.add('active');
  currentStep = (currentStep + 1) % steps.length;
}, 2500);

// Seal Counter Animation
const sealEl = document.getElementById('seal-count');
let sealCount = 24847;
setInterval(() => {
  sealCount += Math.floor(Math.random() * 3) + 1;
  sealEl.textContent = sealCount.toLocaleString();
}, 8000);
<\/script>
</body>
</html>`;
}
__name(renderNexusHTML, "renderNexusHTML");
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "X-Powered-By": "AuthiChain Autonomous Nexus",
      "X-Ecosystem": "The Authentic Economy"
    };
    if (url.pathname === "/" || url.pathname === "/nexus") {
      return new Response(renderNexusHTML(), {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }
      });
    }
    if (url.pathname === "/api/heartbeat") {
      return new Response(JSON.stringify({
        system: "Autonomous Nexus",
        status: "alive",
        agents_online: 5,
        platforms_active: 4,
        seals_minted_today: Math.floor(Math.random() * 500) + 2e3,
        consensus_avg_ms: 2100,
        token: "$QRON",
        autonomous_tasks_completed: Math.floor(Math.random() * 50) + 150,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({
      nexus: "The Authentic Economy Autonomous Nexus",
      endpoints: ["/ (visual dashboard)", "/api/heartbeat"],
      ecosystem: ["authichain.com", "qron.space", "strainchain.io", "govchain.us"]
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

--33010363216b0545017a67a42d99bb80db869aeac7c1920d8a06a1cd0891--
