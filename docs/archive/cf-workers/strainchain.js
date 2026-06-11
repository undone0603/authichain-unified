--09ac3c249b56986af0682c5fa6c36fdbc117ca62d9d3a92a53988612e121
Content-Disposition: form-data; name="worker.js"

// strainchain.io — StrainChain Website Worker v2.0
// Cannabis product provenance & QR verification platform

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-C85Y67MTQL"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-C85Y67MTQL');
</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>StrainChain — Cannabis Product Provenance from Seed to Sale</title>
<meta name="description" content="Authenticate cannabis products with QR verification and track provenance from seed to sale. Powered by AuthiChain Protocol.">
<meta property="og:image" content="https://images.unsplash.com/photo-1536819114556-1e10f967fb61?w=1200&q=80&auto=format">
<link rel="preconnect" href="https://images.unsplash.com">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #0a0f0a;
  --bg2: #111811;
  --bg3: #141f14;
  --green: #3ddc60;
  --green-dim: #2ca348;
  --green-glow: rgba(61,220,96,0.15);
  --amber: #f5c842;
  --amber-dim: #d4a82e;
  --text: #e8f0e8;
  --text-dim: #8a9e8a;
  --border: rgba(61,220,96,0.18);
  --border-dim: rgba(61,220,96,0.08);
  --mono: 'DM Mono', monospace;
  --display: 'Bebas Neue', sans-serif;
  --body: 'DM Sans', sans-serif;
}

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

/* ─── GRID NOISE BACKGROUND ─── */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(var(--border-dim) 1px, transparent 1px),
    linear-gradient(90deg, var(--border-dim) 1px, transparent 1px);
  background-size: 48px 48px;
  pointer-events: none;
  z-index: 0;
}

/* ─── NAV ─── */
nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 48px;
  background: rgba(10,15,10,0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-dim);
}

.nav-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
}

.nav-logo-mark {
  width: 36px; height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-logo-text {
  font-family: var(--display);
  font-size: 22px;
  letter-spacing: 2px;
  color: var(--text);
}

.nav-logo-text span { color: var(--green); }

.nav-links {
  display: flex;
  align-items: center;
  gap: 32px;
  list-style: none;
}

.nav-links a {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-dim);
  text-decoration: none;
  transition: color 0.2s;
}

.nav-links a:hover { color: var(--green); }

.nav-links .nav-authichain {
  font-size: 10px;
  opacity: 0.6;
  letter-spacing: 0.08em;
}

.nav-links .nav-authichain:hover { opacity: 1; }

.nav-cta {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #0a0f0a !important;
  background: var(--green);
  padding: 10px 20px;
  border-radius: 3px;
  text-decoration: none;
  transition: background 0.2s, transform 0.15s;
}

.nav-cta:hover { background: var(--green-dim); transform: translateY(-1px); }

/* ─── HERO ─── */
.hero {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  align-items: center;
  padding: 160px 48px 100px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(10,15,10,0.93) 0%, rgba(10,15,10,0.78) 50%, rgba(10,15,10,0.93) 100%), url('https://images.unsplash.com/photo-1536819114556-1e10f967fb61?w=1920&q=80&auto=format') center/cover no-repeat;
}

.hero-bg-glow {
  position: absolute;
  top: 20%;
  left: 35%;
  width: 600px;
  height: 600px;
  background: radial-gradient(ellipse, rgba(61,220,96,0.08) 0%, transparent 70%);
  pointer-events: none;
}

.hero-content {
  max-width: 680px;
  position: relative;
  z-index: 2;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--green);
  border: 1px solid var(--border);
  padding: 6px 14px;
  border-radius: 2px;
  margin-bottom: 32px;
  animation: fadeUp 0.6s ease both;
}

.hero-badge::before {
  content: '';
  width: 6px; height: 6px;
  background: var(--green);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.hero-title {
  font-family: var(--display);
  font-size: clamp(72px, 10vw, 128px);
  line-height: 0.92;
  letter-spacing: 3px;
  color: var(--text);
  margin-bottom: 28px;
  animation: fadeUp 0.6s 0.1s ease both;
}

.hero-title .accent { color: var(--green); }
.hero-title .line2 { display: block; color: var(--text-dim); }

.hero-sub {
  font-size: 18px;
  font-weight: 300;
  color: var(--text-dim);
  max-width: 520px;
  line-height: 1.7;
  margin-bottom: 48px;
  animation: fadeUp 0.6s 0.2s ease both;
}

.hero-actions {
  display: flex;
  gap: 16px;
  align-items: center;
  animation: fadeUp 0.6s 0.3s ease both;
}

.btn-primary {
  font-family: var(--mono);
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #0a0f0a;
  background: var(--green);
  padding: 16px 32px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn-primary:hover { background: var(--green-dim); transform: translateY(-2px); box-shadow: 0 8px 32px rgba(61,220,96,0.3); }

.btn-secondary {
  font-family: var(--mono);
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-dim);
  background: transparent;
  padding: 16px 32px;
  border: 1px solid var(--border);
  border-radius: 3px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
}

.btn-secondary:hover { border-color: var(--green); color: var(--green); }

/* ─── HERO STATS ─── */
.hero-stats {
  position: absolute;
  right: 48px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 2px;
  animation: fadeRight 0.8s 0.4s ease both;
}

.stat-card {
  background: rgba(17,24,17,0.85);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  padding: 24px 32px;
  min-width: 220px;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 3px;
  height: 100%;
  background: var(--green);
}

.stat-num {
  font-family: var(--display);
  font-size: 48px;
  letter-spacing: 2px;
  color: var(--green);
  line-height: 1;
  margin-bottom: 6px;
}

.stat-label {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-dim);
}

/* ─── SCAN DEMO ─── */
.scan-section {
  position: relative;
  z-index: 1;
  padding: 100px 48px;
  background: linear-gradient(180deg, rgba(17,24,17,0.95) 0%, rgba(17,24,17,0.88) 50%, rgba(17,24,17,0.95) 100%), url('https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=1920&q=80&auto=format') center/cover no-repeat;
  border-top: 1px solid var(--border-dim);
  border-bottom: 1px solid var(--border-dim);
}

.scan-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 80px;
  align-items: center;
}

.section-tag {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--green);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-tag::before {
  content: '';
  width: 24px;
  height: 1px;
  background: var(--green);
}

h2 {
  font-family: var(--display);
  font-size: clamp(40px, 5vw, 64px);
  letter-spacing: 2px;
  line-height: 1;
  margin-bottom: 24px;
}

h2 .accent { color: var(--green); }

.body-text {
  font-size: 16px;
  font-weight: 300;
  color: var(--text-dim);
  line-height: 1.8;
  margin-bottom: 32px;
}

/* QR Scanner Visual */
.qr-visual {
  position: relative;
  aspect-ratio: 1;
  max-width: 400px;
  margin: 0 auto;
}

.qr-frame {
  width: 100%;
  height: 100%;
  border: 1px solid var(--border);
  background: var(--bg3);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.qr-corner {
  position: absolute;
  width: 32px;
  height: 32px;
  border-color: var(--green);
  border-style: solid;
}

.qr-corner.tl { top: 16px; left: 16px; border-width: 2px 0 0 2px; }
.qr-corner.tr { top: 16px; right: 16px; border-width: 2px 2px 0 0; }
.qr-corner.bl { bottom: 16px; left: 16px; border-width: 0 0 2px 2px; }
.qr-corner.br { bottom: 16px; right: 16px; border-width: 0 2px 2px 0; }

.qr-scan-line {
  position: absolute;
  left: 24px; right: 24px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--green), transparent);
  animation: scanMove 2.5s ease-in-out infinite;
  box-shadow: 0 0 16px var(--green);
}

@keyframes scanMove {
  0% { top: 24px; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { top: calc(100% - 24px); opacity: 0; }
}

.qr-inner {
  padding: 40px;
  text-align: center;
}

.qr-code-art {
  font-family: var(--mono);
  font-size: 7px;
  line-height: 1.1;
  color: var(--green);
  letter-spacing: 1px;
  margin-bottom: 16px;
  opacity: 0.8;
}

.qr-label {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.qr-result {
  position: absolute;
  bottom: 0;
  left: 0; right: 0;
  background: rgba(10,15,10,0.95);
  border-top: 1px solid var(--green);
  padding: 20px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  animation: slideUp 0.5s 1.5s ease both;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.qr-verified-dot {
  width: 10px; height: 10px;
  background: var(--green);
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 12px var(--green);
}

.qr-result-text { flex: 1; }
.qr-result-title {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--green);
  margin-bottom: 2px;
}
.qr-result-sub {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-dim);
}

.qr-result-badge {
  font-family: var(--display);
  font-size: 20px;
  letter-spacing: 1px;
  color: var(--amber);
}

/* ─── HOW IT WORKS ─── */
.how-section {
  position: relative;
  z-index: 1;
  padding: 120px 48px;
}

.how-inner {
  max-width: 1200px;
  margin: 0 auto;
}

.how-header {
  text-align: center;
  margin-bottom: 80px;
}

.steps-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
}

.step {
  background: var(--bg2);
  border: 1px solid var(--border-dim);
  padding: 40px 32px;
  position: relative;
  transition: border-color 0.3s, background 0.3s;
}

.step:hover {
  border-color: var(--border);
  background: var(--bg3);
}

.step-num {
  font-family: var(--display);
  font-size: 80px;
  letter-spacing: 2px;
  line-height: 1;
  color: rgba(61,220,96,0.1);
  margin-bottom: 24px;
  transition: color 0.3s;
}

.step:hover .step-num { color: rgba(61,220,96,0.2); }

.step-icon {
  font-size: 28px;
  margin-bottom: 16px;
}

.step-title {
  font-family: var(--display);
  font-size: 24px;
  letter-spacing: 1px;
  margin-bottom: 12px;
}

.step-body {
  font-size: 14px;
  font-weight: 300;
  color: var(--text-dim);
  line-height: 1.7;
}

/* ─── TIERS ─── */
.tiers-section {
  position: relative;
  z-index: 1;
  padding: 100px 48px;
  background: var(--bg2);
  border-top: 1px solid var(--border-dim);
}

.tiers-inner {
  max-width: 1100px;
  margin: 0 auto;
}

.tiers-header {
  text-align: center;
  margin-bottom: 64px;
}

.tiers-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
}

.tier-card {
  background: var(--bg3);
  border: 1px solid var(--border-dim);
  padding: 48px 36px;
  position: relative;
  transition: border-color 0.3s;
}

.tier-card.featured {
  border-color: var(--green);
  background: rgba(61,220,96,0.04);
}

.tier-card.featured::before {
  content: 'MOST POPULAR';
  position: absolute;
  top: -1px;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  color: #0a0f0a;
  background: var(--green);
  padding: 4px 12px;
}

.tier-name {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-dim);
  margin-bottom: 16px;
}

.tier-price {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 8px;
}

.tier-price .currency {
  font-family: var(--mono);
  font-size: 18px;
  color: var(--text-dim);
}

.tier-price .amount {
  font-family: var(--display);
  font-size: 64px;
  letter-spacing: 2px;
  color: var(--text);
  line-height: 1;
}

.tier-price .period {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-dim);
}

.tier-features {
  list-style: none;
  margin: 32px 0 40px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tier-features li {
  font-size: 14px;
  color: var(--text-dim);
  display: flex;
  align-items: center;
  gap: 10px;
}

.tier-features li::before {
  content: '\u2713';
  color: var(--green);
  font-family: var(--mono);
  font-size: 12px;
  flex-shrink: 0;
}

.tier-features li.dim::before { content: '\u2014'; color: var(--border); }
.tier-features li.dim { opacity: 0.4; }

.tier-btn {
  display: block;
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-align: center;
  padding: 14px;
  border-radius: 2px;
  text-decoration: none;
  transition: all 0.2s;
}

.tier-btn.outline {
  border: 1px solid var(--border);
  color: var(--text-dim);
}

.tier-btn.outline:hover { border-color: var(--green); color: var(--green); }

.tier-btn.solid {
  background: var(--green);
  color: #0a0f0a;
  border: 1px solid var(--green);
}

.tier-btn.solid:hover { background: var(--green-dim); }

/* ─── TERMINAL ─── */
.terminal-section {
  position: relative;
  z-index: 1;
  padding: 120px 48px;
}

.terminal-inner {
  max-width: 900px;
  margin: 0 auto;
  text-align: center;
}

.terminal-window {
  background: #080d08;
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
  text-align: left;
  margin-top: 48px;
}

.terminal-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: var(--bg2);
  border-bottom: 1px solid var(--border-dim);
}

.terminal-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
}

.terminal-dot.red   { background: #ff5f57; }
.terminal-dot.amber { background: #ffbd2e; }
.terminal-dot.green { background: #28c840; }

.terminal-title {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-dim);
  margin-left: auto;
  letter-spacing: 0.05em;
}

.terminal-body {
  padding: 28px 32px;
  font-family: var(--mono);
  font-size: 13px;
  line-height: 2;
}

.t-prompt { color: var(--green); }
.t-cmd { color: var(--text); }
.t-comment { color: var(--text-dim); opacity: 0.5; }
.t-key { color: var(--amber); }
.t-val { color: #88c0d0; }
.t-success { color: var(--green); }
.t-line { display: block; }

/* ─── CTA BAND ─── */
.cta-section {
  position: relative;
  z-index: 1;
  padding: 120px 48px;
  background: linear-gradient(180deg, rgba(17,24,17,0.94) 0%, rgba(17,24,17,0.82) 50%, rgba(17,24,17,0.94) 100%), url('https://images.unsplash.com/photo-1603909223429-69bb7101f420?w=1920&q=80&auto=format') center/cover no-repeat;
  border-top: 1px solid var(--border-dim);
  text-align: center;
  overflow: hidden;
}

.cta-bg {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 800px; height: 400px;
  background: radial-gradient(ellipse, rgba(61,220,96,0.06) 0%, transparent 70%);
  pointer-events: none;
}

.cta-section h2 {
  font-size: clamp(48px, 7vw, 96px);
  margin-bottom: 24px;
}

.cta-section p {
  font-size: 18px;
  font-weight: 300;
  color: var(--text-dim);
  margin-bottom: 48px;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

/* ─── FOOTER ─── */
footer {
  position: relative;
  z-index: 1;
  border-top: 1px solid var(--border-dim);
  padding: 48px;
}

.footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.footer-links {
  display: flex;
  gap: 32px;
  list-style: none;
}

.footer-links a {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-dim);
  text-decoration: none;
  transition: color 0.2s;
}

.footer-links a:hover { color: var(--green); }

.footer-copy {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-dim);
  opacity: 0.5;
}

/* ─── ANIMATIONS ─── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fadeRight {
  from { opacity: 0; transform: translateX(32px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* ─── RESPONSIVE ─── */
@media (max-width: 1024px) {
  .hero-stats { display: none; }
  .steps-grid { grid-template-columns: 1fr 1fr; }
  .tiers-grid { grid-template-columns: 1fr; max-width: 480px; margin: 0 auto; }
  .scan-inner { grid-template-columns: 1fr; gap: 48px; }
}

@media (max-width: 768px) {
  nav { padding: 16px 24px; }
  .nav-links { display: none; }
  .hero { padding: 120px 24px 80px; }
  .hero-title { font-size: 64px; }
  .hero-actions { flex-direction: column; align-items: flex-start; }
  .steps-grid { grid-template-columns: 1fr; }
  .scan-section, .how-section, .tiers-section, .terminal-section, .cta-section { padding: 80px 24px; }
  footer { padding: 32px 24px; }
  .footer-inner { flex-direction: column; gap: 24px; text-align: center; }
}
</style>
</head>
<body>

<!-- NAV -->
<nav>
  <a class="nav-logo" href="/">
    <div class="nav-logo-mark"><svg width="36" height="36" viewBox="0 0 36 36" fill="none"><polygon points="18,1 33,9.5 33,26.5 18,35 3,26.5 3,9.5" fill="#3ddc60" opacity="0.15" stroke="#3ddc60" stroke-width="1.5"/><polygon points="18,5 30,11.5 30,24.5 18,31 6,24.5 6,11.5" fill="#0a0f0a" stroke="#3ddc60" stroke-width="0.5" opacity="0.6"/><path d="M18,10 Q14,15 18,18 Q22,21 18,26" stroke="#3ddc60" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M14,14 Q18,16 16,20" stroke="#3ddc60" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.6"/><path d="M22,16 Q18,18 20,22" stroke="#3ddc60" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.6"/><circle cx="18" cy="11" r="1.5" fill="#f5c842" opacity="0.7"/></svg></div>
    <span class="nav-logo-text">STRAIN<span>CHAIN</span></span>
  </a>
  <ul class="nav-links">
    <li><a href="#how">How it works</a></li>
    <li><a href="#pricing">Pricing</a></li>
    <li><a href="https://authichain-api.undone-k.workers.dev/">API</a></li>
    <li><a href="https://authichain.com" class="nav-authichain">Part of AuthiChain</a></li>
    <li><a href="https://buy.stripe.com/8x28wP5Zf1gWcKC4ba1Nu0x" class="nav-cta">Get started</a></li>
  </ul>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="hero-bg-glow"></div>
  <div class="hero-content">
    <div class="hero-badge">Cannabis Industry Vertical</div>
    <h1 class="hero-title">
      TRUTH ON<br>
      <span class="accent">THE CHAIN</span>
      <span class="line2">FROM SEED<br>TO SALE</span>
    </h1>
    <p class="hero-sub">StrainChain provides cannabis product tracking from seed to sale. Brands register products via our API, consumers verify via QR scan.</p>
    <div class="hero-actions">
      <a href="#how" class="btn-primary">
        How it works
      </a>
      <a href="#pricing" class="btn-secondary">View pricing</a>
    </div>
  </div>
  <div class="hero-stats">
    <div class="stat-card">
      <div class="stat-num">3</div>
      <div class="stat-label">Pricing Tiers</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">REST</div>
      <div class="stat-label">API Live</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">10+</div>
      <div class="stat-label">Industries</div>
    </div>
  </div>
</section>

<!-- SCAN DEMO -->
<section class="scan-section" id="scan">
  <div class="scan-inner">
    <div>
      <div class="section-tag">Authentication</div>
      <h2>SCAN <span class="accent">ONCE</span>,<br>KNOW FOREVER</h2>
      <p class="body-text">Every product ships with a tamper-evident QR code linked to a secure product record. One scan proves authenticity, shows the full supply chain, and returns verification results and product provenance.</p>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:center;gap:12px;font-family:var(--mono);font-size:13px;color:var(--text-dim);">
          <span style="color:var(--green)">01</span> Brand registers product with batch data
        </div>
        <div style="display:flex;align-items:center;gap:12px;font-family:var(--mono);font-size:13px;color:var(--text-dim);">
          <span style="color:var(--green)">02</span> QR code sealed to packaging at manufacture
        </div>
        <div style="display:flex;align-items:center;gap:12px;font-family:var(--mono);font-size:13px;color:var(--text-dim);">
          <span style="color:var(--green)">03</span> Consumer scans — verified — provenance returned
        </div>
        <div style="display:flex;align-items:center;gap:12px;font-family:var(--mono);font-size:13px;color:var(--text-dim);">
          <span style="color:var(--green)">04</span> Product gets verification certificate
        </div>
      </div>
    </div>
    <div class="qr-visual">
      <div class="qr-frame">
        <div class="qr-corner tl"></div>
        <div class="qr-corner tr"></div>
        <div class="qr-corner bl"></div>
        <div class="qr-corner br"></div>
        <div class="qr-scan-line"></div>
        <div class="qr-inner">
          <div class="qr-code-art">\u2588\u2580\u2580 \u2580\u2580\u2588 \u2588\u2591\u2591 \u2588\u2591\u2591<br>\u2580\u2580\u2588 \u2588\u2591\u2591 \u2588\u2591\u2591 \u2588\u2591\u2591<br>\u2580\u2580\u2580 \u2580\u2580\u2580 \u2580\u2580\u2580 \u2580\u2580\u2580<br>\u2588\u2591\u2591 \u2580\u2591\u2588 \u2588\u2591\u2591 \u2588\u2584\u2588<br>\u2580\u2580\u2580 \u2580\u2580\u2580 \u2580\u2580\u2580 \u2580\u2591\u2580</div>
          <div class="qr-label">Mountain High \u00b7 Wedding Cake<br>Batch #WC-2026-012</div>
        </div>
        <div class="qr-result">
          <div class="qr-verified-dot"></div>
          <div class="qr-result-text">
            <div class="qr-result-title">\u2713 Authentic — API Verified</div>
            <div class="qr-result-sub">THC 26.8% \u00b7 CBD 0.5% \u00b7 Batch WC-2026-012</div>
          </div>
          <div class="qr-result-badge">VERIFIED</div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- HOW IT WORKS -->
<section class="how-section" id="how">
  <div class="how-inner">
    <div class="how-header">
      <div class="section-tag" style="justify-content:center">Process</div>
      <h2>HOW <span class="accent">STRAINCHAIN</span> WORKS</h2>
    </div>
    <div class="steps-grid">
      <div class="step">
        <div class="step-num">01</div>
        <div class="step-icon">\ud83c\udfed</div>
        <div class="step-title">REGISTER</div>
        <p class="step-body">Cannabis brands onboard with license verification. Each product batch gets a unique cryptographic fingerprint stored in the AuthiChain database.</p>
      </div>
      <div class="step">
        <div class="step-num">02</div>
        <div class="step-icon">\ud83d\udd17</div>
        <div class="step-title">LINK</div>
        <p class="step-body">QR codes are generated and bound to the product record. Lab results, batch info, and supply chain events all attach to the product verification record.</p>
      </div>
      <div class="step">
        <div class="step-num">03</div>
        <div class="step-icon">\ud83d\udcf1</div>
        <div class="step-title">VERIFY</div>
        <p class="step-body">Consumers scan the QR at point of purchase. Authentication happens in under 2 seconds — API query, fake detection, and full provenance reveal.</p>
      </div>
      <div class="step">
        <div class="step-num">04</div>
        <div class="step-icon">\ud83d\udcdc</div>
        <div class="step-title">CERTIFY</div>
        <p class="step-body">Each verified scan generates a verification certificate with provenance data. Batch details, lab results, and supply chain events are all included.</p>
      </div>
    </div>
  </div>
</section>

<!-- PRICING TIERS -->
<section class="tiers-section" id="pricing">
  <div class="tiers-inner">
    <div class="tiers-header">
      <div class="section-tag" style="justify-content:center">Pricing</div>
      <h2>PLANS FOR <span class="accent">EVERY</span> OPERATOR</h2>
    </div>
    <div class="tiers-grid">
      <div class="tier-card">
        <div class="tier-name">Basic</div>
        <div class="tier-price">
          <span class="currency">$</span>
          <span class="amount">199</span>
          <span class="period">/mo</span>
        </div>
        <ul class="tier-features">
          <li>500 product scans/month</li>
          <li>1 brand registration</li>
          <li>QR verification</li>
          <li>Basic analytics</li>
          <li>Email support</li>
          <li class="dim">Advanced analytics</li>
          <li class="dim">White label</li>
        </ul>
        <a href="https://buy.stripe.com/14A4gz9brgbQdOG4ba1Nu0w" class="tier-btn outline">Get started</a>
      </div>
      <div class="tier-card featured">
        <div class="tier-name">Professional</div>
        <div class="tier-price">
          <span class="currency">$</span>
          <span class="amount">499</span>
          <span class="period">/mo</span>
        </div>
        <ul class="tier-features">
          <li>2,500 scans/month</li>
          <li>5 brand registrations</li>
          <li>QR verification + analytics</li>
          <li>Advanced analytics</li>
          <li>Compliance reports</li>
          <li>API access</li>
          <li class="dim">White label</li>
        </ul>
        <a href="https://buy.stripe.com/8x28wP5Zf1gWcKC4ba1Nu0x" class="tier-btn solid">Get started</a>
      </div>
      <div class="tier-card">
        <div class="tier-name">Enterprise</div>
        <div class="tier-price">
          <span class="currency">$</span>
          <span class="amount">999</span>
          <span class="period">/mo</span>
        </div>
        <ul class="tier-features">
          <li>Unlimited scans</li>
          <li>Unlimited brands</li>
          <li>Full verification suite</li>
          <li>Custom reporting</li>
          <li>White label options</li>
          <li>Dedicated support</li>
          <li>SLA guarantee</li>
        </ul>
        <a href="https://buy.stripe.com/aFaaEX9br4t8dOG8rq1Nu0y" class="tier-btn outline">Contact sales</a>
      </div>
    </div>
  </div>
</section>

<!-- API TERMINAL -->
<section class="terminal-section" id="api">
  <div class="terminal-inner">
    <div class="section-tag" style="justify-content:center">Developer API</div>
    <h2>BUILT FOR <span class="accent">BUILDERS</span></h2>
    <p class="body-text" style="margin:0 auto 0;max-width:500px;">Full REST API at authichain-api.undone-k.workers.dev. Verify products and query provenance data in any stack.</p>
    <div class="terminal-window">
      <div class="terminal-bar">
        <div class="terminal-dot red"></div>
        <div class="terminal-dot amber"></div>
        <div class="terminal-dot green"></div>
        <div class="terminal-title">strainchain api \u2014 verify product</div>
      </div>
      <div class="terminal-body">
        <span class="t-line"><span class="t-comment"># Verify a cannabis product via QR scan</span></span>
        <span class="t-line"><span class="t-prompt">$ </span><span class="t-cmd">curl -X POST https://authichain-api.undone-k.workers.dev/api/v1/verify \\</span></span>
        <span class="t-line">  <span class="t-cmd">-H </span><span class="t-val">"Content-Type: application/json"</span> <span class="t-cmd">\\</span></span>
        <span class="t-line">  <span class="t-cmd">-d </span><span class="t-val">'{"qrData":"BATCH_WC_012","product":"Wedding Cake"}'</span></span>
        <span class="t-line">&nbsp;</span>
        <span class="t-line"><span class="t-comment"># Response</span></span>
        <span class="t-line">{</span>
        <span class="t-line">  <span class="t-key">"success"</span>: <span class="t-val">true</span>,</span>
        <span class="t-line">  <span class="t-key">"mode"</span>: <span class="t-val">"demo"</span>,</span>
        <span class="t-line">  <span class="t-key">"verified"</span>: <span class="t-val">true</span>,</span>
        <span class="t-line">  <span class="t-key">"product"</span>: {</span>
        <span class="t-line">    <span class="t-key">"name"</span>: <span class="t-val">"Wedding Cake"</span>,</span>
        <span class="t-line">    <span class="t-key">"batch"</span>: <span class="t-val">"WC-2026-012"</span>,</span>
        <span class="t-line">    <span class="t-key">"brand"</span>: <span class="t-val">"Mountain High"</span></span>
        <span class="t-line">  },</span>
        <span class="t-line">  <span class="t-key">"provenance"</span>: {</span>
        <span class="t-line">    <span class="t-key">"thc"</span>: <span class="t-val">"26.8%"</span>,</span>
        <span class="t-line">    <span class="t-key">"cbd"</span>: <span class="t-val">"0.5%"</span>,</span>
        <span class="t-line">    <span class="t-key">"status"</span>: <span class="t-val">"<span class="t-success">authentic</span>"</span></span>
        <span class="t-line">  }</span>
        <span class="t-line">}</span>
      </div>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="cta-section">
  <div class="cta-bg"></div>
  <h2 class="accent">START VERIFYING</h2>
  <p>Start authenticating your products with QR-based verification and provenance tracking.</p>
  <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">
    <a href="https://buy.stripe.com/14A4gz9brgbQdOG4ba1Nu0w" class="btn-primary">Get Started \u2014 $199/mo</a>
    <a href="https://authichain-api.undone-k.workers.dev/" class="btn-secondary">View API</a>
  </div>
</section>

<!-- FOOTER -->
<footer>
  <div class="footer-inner">
    <div style="display:flex;align-items:center;gap:12px;">
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><polygon points="18,1 33,9.5 33,26.5 18,35 3,26.5 3,9.5" fill="#3ddc60" opacity="0.15" stroke="#3ddc60" stroke-width="1.5"/><polygon points="18,5 30,11.5 30,24.5 18,31 6,24.5 6,11.5" fill="#0a0f0a" stroke="#3ddc60" stroke-width="0.5" opacity="0.6"/><path d="M18,10 Q14,15 18,18 Q22,21 18,26" stroke="#3ddc60" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M14,14 Q18,16 16,20" stroke="#3ddc60" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.6"/><path d="M22,16 Q18,18 20,22" stroke="#3ddc60" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.6"/><circle cx="18" cy="11" r="1.5" fill="#f5c842" opacity="0.7"/></svg>
      <span style="font-family:var(--display);font-size:22px;letter-spacing:2px;color:var(--text);">STRAIN<span style="color:var(--green);">CHAIN</span></span>
    </div>
    <ul class="footer-links">
      <li><a href="https://authichain-api.undone-k.workers.dev/">API</a></li>
      <li><a href="#pricing">Pricing</a></li>
      <li><a href="https://authichain.com">AuthiChain</a></li>
      <li><a href="https://qron.space">QRON</a></li>
      <li><a href="https://authichain.com/govchain">GovChain</a></li>
    </ul>
    <div class="footer-copy">\u00a9 2026 StrainChain \u00b7 Powered by AuthiChain Protocol</div>
  </div>
</footer>

</body>
</html>`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS"
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    if (path === "/robots.txt") {
      return new Response(
        "User-agent: *\nAllow: /\nSitemap: https://strainchain.io/sitemap.xml\n",
        { headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=86400" } }
      );
    }

    if (path === "/sitemap.xml") {
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://strainchain.io/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
</urlset>`,
        { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=86400" } }
      );
    }

    return new Response(HTML, {
      headers: {
        ...cors,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600"
      }
    });
  }
};
--09ac3c249b56986af0682c5fa6c36fdbc117ca62d9d3a92a53988612e121--
