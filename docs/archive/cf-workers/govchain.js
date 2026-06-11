--0590980dd1a250a6037f579d7fd27fc5cb39cb02dda2efd56996ce9f469a
Content-Disposition: form-data; name="worker.js"

// govchain.us — GovChain Website Worker v2.0
// Government document verification platform — honest rebuild

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
<title>GovChain — Government Document Verification Platform</title>
<meta name="description" content="Verify government documents, track procurement integrity, and authenticate public records with API-based verification. Built for agencies, built for trust.">
<meta property="og:title" content="GovChain — Government Document Verification Platform">
<meta property="og:description" content="Document verification, procurement tracking, and public record integrity for government agencies.">
<meta property="og:url" content="https://govchain.us">
<meta property="og:type" content="website">
<meta property="og:image" content="https://images.unsplash.com/photo-1501466044931-62695aada8e9?w=1200&q=80&auto=format">
<link rel="preconnect" href="https://images.unsplash.com">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #080c14;
  --bg2: #0c1220;
  --bg3: #101828;
  --blue: #4a90d9;
  --blue-dim: #3670b0;
  --blue-glow: rgba(74,144,217,0.15);
  --gold: #d4a843;
  --gold-dim: #b8912e;
  --red: #c0392b;
  --white: #f0f4f8;
  --text: #e0e8f0;
  --text-dim: #7a8da4;
  --border: rgba(74,144,217,0.18);
  --border-dim: rgba(74,144,217,0.08);
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

/* --- GRID BACKGROUND --- */
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

/* --- NAV --- */
nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 48px;
  background: rgba(8,12,20,0.88);
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
  background: var(--blue);
  clip-path: polygon(15% 0%, 85% 0%, 100% 50%, 85% 100%, 15% 100%, 0% 50%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 500;
  color: #080c14;
  letter-spacing: -0.5px;
}

.nav-logo-text {
  font-family: var(--display);
  font-size: 22px;
  letter-spacing: 2px;
  color: var(--text);
}

.nav-logo-text span { color: var(--blue); }

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

.nav-links a:hover { color: var(--blue); }

.nav-cta {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #080c14 !important;
  background: var(--blue);
  padding: 10px 20px;
  border-radius: 3px;
  text-decoration: none;
  transition: background 0.2s, transform 0.15s;
}

.nav-cta:hover { background: var(--blue-dim); transform: translateY(-1px); }

/* --- HERO --- */
.hero {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  align-items: center;
  padding: 160px 48px 100px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(8,12,20,0.93) 0%, rgba(8,12,20,0.78) 50%, rgba(8,12,20,0.93) 100%), url('https://images.unsplash.com/photo-1501466044931-62695aada8e9?w=1920&q=80&auto=format') center/cover no-repeat;
}

.hero-bg-glow {
  position: absolute;
  top: 20%;
  left: 35%;
  width: 600px;
  height: 600px;
  background: radial-gradient(ellipse, rgba(74,144,217,0.08) 0%, transparent 70%);
  pointer-events: none;
}

.hero-content {
  max-width: 720px;
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
  color: var(--gold);
  border: 1px solid rgba(212,168,67,0.3);
  padding: 6px 14px;
  border-radius: 2px;
  margin-bottom: 32px;
  animation: fadeUp 0.6s ease both;
}

.hero-badge::before {
  content: '';
  width: 6px; height: 6px;
  background: var(--gold);
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

.hero-title .accent { color: var(--blue); }
.hero-title .line2 { display: block; color: var(--text-dim); }

.hero-sub {
  font-size: 18px;
  font-weight: 300;
  color: var(--text-dim);
  max-width: 560px;
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
  color: #080c14;
  background: var(--blue);
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

.btn-primary:hover { background: var(--blue-dim); transform: translateY(-2px); box-shadow: 0 8px 32px rgba(74,144,217,0.3); }

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

.btn-secondary:hover { border-color: var(--blue); color: var(--blue); }

/* --- HERO STATS --- */
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
  background: rgba(12,18,32,0.85);
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
  background: var(--blue);
}

.stat-num {
  font-family: var(--display);
  font-size: 48px;
  letter-spacing: 2px;
  color: var(--blue);
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

/* --- VERIFY DEMO --- */
.scan-section {
  position: relative;
  z-index: 1;
  padding: 100px 48px;
  background: var(--bg2);
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
  color: var(--blue);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-tag::before {
  content: '';
  width: 24px;
  height: 1px;
  background: var(--blue);
}

h2 {
  font-family: var(--display);
  font-size: clamp(40px, 5vw, 64px);
  letter-spacing: 2px;
  line-height: 1;
  margin-bottom: 24px;
}

h2 .accent { color: var(--blue); }

.body-text {
  font-size: 16px;
  font-weight: 300;
  color: var(--text-dim);
  line-height: 1.8;
  margin-bottom: 32px;
}

/* Document Verification Visual */
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
  border-color: var(--blue);
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
  background: linear-gradient(90deg, transparent, var(--blue), transparent);
  animation: scanMove 2.5s ease-in-out infinite;
  box-shadow: 0 0 16px var(--blue);
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
  font-size: 8px;
  line-height: 1.2;
  color: var(--blue);
  letter-spacing: 1px;
  margin-bottom: 16px;
  opacity: 0.7;
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
  background: rgba(8,12,20,0.95);
  border-top: 1px solid var(--blue);
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
  background: var(--blue);
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 12px var(--blue);
}

.qr-result-text { flex: 1; }
.qr-result-title {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--blue);
  margin-bottom: 2px;
}
.qr-result-sub {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text-dim);
}

.qr-result-nft {
  font-family: var(--display);
  font-size: 18px;
  letter-spacing: 1px;
  color: var(--gold);
}

/* --- HOW IT WORKS --- */
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
  color: rgba(74,144,217,0.1);
  margin-bottom: 24px;
  transition: color 0.3s;
}

.step:hover .step-num { color: rgba(74,144,217,0.2); }

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

/* --- USE CASES --- */
.use-cases-section {
  position: relative;
  z-index: 1;
  padding: 100px 48px;
  background: linear-gradient(180deg, rgba(12,18,32,0.95) 0%, rgba(12,18,32,0.88) 50%, rgba(12,18,32,0.95) 100%), url('https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1920&q=80&auto=format') center/cover no-repeat;
  border-top: 1px solid var(--border-dim);
  border-bottom: 1px solid var(--border-dim);
}

.use-cases-inner {
  max-width: 1200px;
  margin: 0 auto;
}

.use-cases-header {
  text-align: center;
  margin-bottom: 64px;
}

.use-cases-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
}

.use-case-card {
  background: var(--bg3);
  border: 1px solid var(--border-dim);
  padding: 48px 36px;
  transition: border-color 0.3s;
}

.use-case-card:hover { border-color: var(--border); }

.use-case-icon {
  font-size: 32px;
  margin-bottom: 20px;
}

.use-case-title {
  font-family: var(--display);
  font-size: 28px;
  letter-spacing: 1px;
  margin-bottom: 16px;
}

.use-case-body {
  font-size: 14px;
  font-weight: 300;
  color: var(--text-dim);
  line-height: 1.8;
}

/* --- TIERS --- */
.tiers-section {
  position: relative;
  z-index: 1;
  padding: 100px 48px;
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
  border-color: var(--blue);
  background: rgba(74,144,217,0.04);
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
  color: #080c14;
  background: var(--blue);
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
  content: '\\2713';
  color: var(--blue);
  font-family: var(--mono);
  font-size: 12px;
  flex-shrink: 0;
}

.tier-features li.dim::before { content: '\\2014'; color: var(--border); }
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

.tier-btn.outline:hover { border-color: var(--blue); color: var(--blue); }

.tier-btn.solid {
  background: var(--blue);
  color: #080c14;
  border: 1px solid var(--blue);
}

.tier-btn.solid:hover { background: var(--blue-dim); }

/* --- COMPLIANCE BANNER --- */
.compliance-section {
  position: relative;
  z-index: 1;
  padding: 80px 48px;
  background: var(--bg2);
  border-top: 1px solid var(--border-dim);
  border-bottom: 1px solid var(--border-dim);
}

.compliance-inner {
  max-width: 1100px;
  margin: 0 auto;
  text-align: center;
}

.compliance-badges {
  display: flex;
  justify-content: center;
  gap: 48px;
  flex-wrap: wrap;
  margin-top: 40px;
}

.compliance-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.compliance-badge-icon {
  width: 64px; height: 64px;
  border: 1px solid var(--border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: var(--bg3);
}

.compliance-badge-label {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-dim);
}

/* --- TERMINAL --- */
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
  background: #060a10;
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

.t-prompt { color: var(--blue); }
.t-cmd { color: var(--text); }
.t-comment { color: var(--text-dim); opacity: 0.5; }
.t-key { color: var(--gold); }
.t-val { color: #88c0d0; }
.t-success { color: var(--blue); }
.t-line { display: block; }

/* --- CTA BAND --- */
.cta-section {
  position: relative;
  z-index: 1;
  padding: 120px 48px;
  background: linear-gradient(180deg, rgba(12,18,32,0.94) 0%, rgba(12,18,32,0.82) 50%, rgba(12,18,32,0.94) 100%), url('https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?w=1920&q=80&auto=format') center/cover no-repeat;
  border-top: 1px solid var(--border-dim);
  text-align: center;
  overflow: hidden;
}

.cta-bg {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 800px; height: 400px;
  background: radial-gradient(ellipse, rgba(74,144,217,0.06) 0%, transparent 70%);
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
  max-width: 560px;
  margin-left: auto;
  margin-right: auto;
}

/* --- FOOTER --- */
footer {
  position: relative;
  z-index: 1;
  border-top: 1px solid var(--border-dim);
  padding: 64px 48px 48px;
}

.footer-inner {
  max-width: 1200px;
  margin: 0 auto;
}

.footer-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr 1fr;
  gap: 48px;
  margin-bottom: 48px;
}

.footer-brand {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.footer-brand-desc {
  font-size: 14px;
  font-weight: 300;
  color: var(--text-dim);
  line-height: 1.7;
  max-width: 280px;
}

.footer-col-title {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--text);
  margin-bottom: 20px;
}

.footer-col-links {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.footer-col-links a {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  text-decoration: none;
  transition: color 0.2s;
}

.footer-col-links a:hover { color: var(--blue); }

.footer-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 32px;
  border-top: 1px solid var(--border-dim);
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

.footer-links a:hover { color: var(--blue); }

.footer-copy {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-dim);
  opacity: 0.5;
}

/* --- ANIMATIONS --- */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fadeRight {
  from { opacity: 0; transform: translateX(32px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* --- RESPONSIVE --- */
@media (max-width: 1024px) {
  .hero-stats { display: none; }
  .steps-grid { grid-template-columns: 1fr 1fr; }
  .tiers-grid { grid-template-columns: 1fr; max-width: 480px; margin: 0 auto; }
  .scan-inner { grid-template-columns: 1fr; gap: 48px; }
  .use-cases-grid { grid-template-columns: 1fr; max-width: 480px; margin: 0 auto; }
  .footer-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 768px) {
  nav { padding: 16px 24px; }
  .nav-links { display: none; }
  .hero { padding: 120px 24px 80px; }
  .hero-title { font-size: 64px; }
  .hero-actions { flex-direction: column; align-items: flex-start; }
  .steps-grid { grid-template-columns: 1fr; }
  .scan-section, .how-section, .tiers-section, .terminal-section, .cta-section, .use-cases-section, .compliance-section { padding: 80px 24px; }
  footer { padding: 48px 24px 32px; }
  .footer-grid { grid-template-columns: 1fr; gap: 32px; }
  .footer-bottom { flex-direction: column; gap: 16px; text-align: center; }
  .compliance-badges { gap: 24px; }
}
</style>
</head>
<body>

<!-- NAV -->
<nav>
  <a class="nav-logo" href="/">
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><polygon points="18,1 33,9.5 33,26.5 18,35 3,26.5 3,9.5" fill="#4a90d9" opacity="0.15" stroke="#4a90d9" stroke-width="1.5"/><polygon points="18,5 30,11.5 30,24.5 18,31 6,24.5 6,11.5" fill="#080c14" stroke="#4a90d9" stroke-width="0.5" opacity="0.6"/><path d="M12,24 L12,16 L18,11 L24,16 L24,24 Z" stroke="#4a90d9" stroke-width="1.5" fill="none"/><line x1="18" y1="11" x2="18" y2="8" stroke="#d4a843" stroke-width="1.5" stroke-linecap="round"/><rect x="15.5" y="18" width="5" height="6" rx="0.5" stroke="#4a90d9" stroke-width="1" fill="none" opacity="0.6"/><line x1="18" y1="19" x2="18" y2="22" stroke="#4a90d9" stroke-width="0.8" opacity="0.5"/></svg>
    <span class="nav-logo-text">GOV<span>CHAIN</span></span>
  </a>
  <ul class="nav-links">
    <li><a href="#how">How it works</a></li>
    <li><a href="#use-cases">Use cases</a></li>
    <li><a href="#pricing">Pricing</a></li>
    <li><a href="#api">API</a></li>
    <li><a href="/capability-statement">Capability Statement</a></li>
    <li><a href="mailto:hello@govchain.us" class="nav-cta">Request demo</a></li>
  </ul>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="hero-bg-glow"></div>
  <div class="hero-content">
    <div class="hero-badge">Government Vertical &mdash; SAM.gov Registered &mdash; Pilot Program</div>
    <h1 class="hero-title">
      TRUST ON<br>
      <span class="accent">THE CHAIN</span>
      <span class="line2">FROM RECORD<br>TO CITIZEN</span>
    </h1>
    <p class="hero-sub">GovChain brings API-based verification to government documents, procurement records, and public data. Authenticate instantly. Build trust through transparency.</p>
    <div class="hero-actions">
      <a href="#pricing" class="btn-primary">
        &#8599; Get started
      </a>
      <a href="#how" class="btn-secondary">How it works</a>
    </div>
  </div>
  <div class="hero-stats">
    <div class="stat-card">
      <div class="stat-num" style="font-size:20px;">SAM.gov</div>
      <div class="stat-label">Registered Entity</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">2</div>
      <div class="stat-label">AI Engines</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">3</div>
      <div class="stat-label">Government Use Cases</div>
    </div>
  </div>
</section>

<!-- VERIFY DEMO -->
<section class="scan-section" id="verify">
  <div class="scan-inner">
    <div>
      <div class="section-tag">Verification</div>
      <h2>VERIFY <span class="accent">ONCE</span>,<br>TRUST FOREVER</h2>
      <p class="body-text">Every government document is hashed and processed through our verification API. One scan proves authenticity, reveals the full audit trail, and confirms the chain of custody &mdash; in under 2 seconds.</p>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:center;gap:12px;font-family:var(--mono);font-size:13px;color:var(--text-dim);">
          <span style="color:var(--blue)">01</span> Agency issues document with cryptographic hash
        </div>
        <div style="display:flex;align-items:center;gap:12px;font-family:var(--mono);font-size:13px;color:var(--text-dim);">
          <span style="color:var(--blue)">02</span> Hash recorded with timestamp
        </div>
        <div style="display:flex;align-items:center;gap:12px;font-family:var(--mono);font-size:13px;color:var(--text-dim);">
          <span style="color:var(--blue)">03</span> Citizen or agency scans &#8594; instant verification
        </div>
        <div style="display:flex;align-items:center;gap:12px;font-family:var(--mono);font-size:13px;color:var(--text-dim);">
          <span style="color:var(--blue)">04</span> Full audit trail + tamper detection returned
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
          <div class="qr-code-art">&#9608;&#9600;&#9600; &#9600;&#9600;&#9608; &#9608;&#9617;&#9617; &#9608;&#9617;&#9617;<br>&#9600;&#9600;&#9608; &#9608;&#9617;&#9617; &#9608;&#9617;&#9617; &#9608;&#9617;&#9617;<br>&#9600;&#9600;&#9600; &#9600;&#9600;&#9600; &#9600;&#9600;&#9600; &#9600;&#9600;&#9600;<br>&#9608;&#9617;&#9617; &#9600;&#9617;&#9608; &#9608;&#9617;&#9617; &#9608;&#9604;&#9608;<br>&#9600;&#9600;&#9600; &#9600;&#9600;&#9600; &#9600;&#9600;&#9600; &#9600;&#9617;&#9600;</div>
          <div class="qr-label">Dept. of Commerce &middot; RFP-2026-0847<br>Procurement Contract #PC-0847-A</div>
        </div>
        <div class="qr-result">
          <div class="qr-verified-dot"></div>
          <div class="qr-result-text">
            <div class="qr-result-title">&#10003; Authentic &mdash; API Verified</div>
            <div class="qr-result-sub">Issued: 2026-03-14 &middot; Signatory: J. Martinez, GS-15</div>
          </div>
          <div class="qr-result-nft">SEALED</div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- CORE TECHNOLOGY -->
<section style="position:relative;z-index:1;padding:100px 48px;background:var(--bg2);border-top:1px solid var(--border-dim);border-bottom:1px solid var(--border-dim);" id="technology">
  <div style="max-width:1200px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:64px;">
      <div class="section-tag" style="justify-content:center">Core Technology</div>
      <h2>POWERED BY <span class="accent">TWO ENGINES</span></h2>
      <p class="body-text" style="max-width:600px;margin:0 auto;">GovChain runs on AuthiChain's proprietary AI AutoFlow&trade; classification engine and TrueMark&trade; verification seal system.</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;">
      <div style="background:var(--bg3);border:1px solid var(--border-dim);padding:48px 36px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <div style="width:48px;height:48px;background:rgba(74,144,217,0.1);border:1px solid var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:24px;">&#9881;</div>
          <div>
            <div style="font-family:var(--display);font-size:28px;letter-spacing:1px;color:var(--text);">AI AUTOFLOW&trade;</div>
            <div style="font-family:var(--mono);font-size:10px;letter-spacing:0.15em;color:var(--blue);text-transform:uppercase;">Classification Engine</div>
          </div>
        </div>
        <p style="font-size:14px;color:var(--text-dim);line-height:1.8;margin-bottom:20px;">GPT-4 Vision-powered universal classifier. Upload any document or asset &mdash; AI AutoFlow identifies the type, generates an authentication workflow, and assigns confidence scoring in under 3 seconds.</p>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;color:var(--text-dim);"><span style="color:var(--blue);">&#10003;</span> 10 industry classifications</div>
          <div style="display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;color:var(--text-dim);"><span style="color:var(--blue);">&#10003;</span> Auto-generated verification workflows</div>
          <div style="display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;color:var(--text-dim);"><span style="color:var(--blue);">&#10003;</span> 95%+ confidence scoring</div>
          <div style="display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;color:var(--text-dim);"><span style="color:var(--blue);">&#10003;</span> REST API &mdash; live now</div>
        </div>
      </div>
      <div style="background:var(--bg3);border:1px solid var(--border-dim);padding:48px 36px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <div style="width:48px;height:48px;background:rgba(212,168,67,0.1);border:1px solid rgba(212,168,67,0.3);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:24px;">&#128272;</div>
          <div>
            <div style="font-family:var(--display);font-size:28px;letter-spacing:1px;color:var(--text);">TRUEMARK&trade;</div>
            <div style="font-family:var(--mono);font-size:10px;letter-spacing:0.15em;color:var(--gold);text-transform:uppercase;">Verification Seal</div>
          </div>
        </div>
        <p style="font-size:14px;color:var(--text-dim);line-height:1.8;margin-bottom:20px;">Every verified document receives a unique TrueMark&trade; ID (e.g. TM-2026-DOC-A7B3). This seal is tamper-proof, scannable via QR, and queryable via API. Each TrueMark maps to a full chain-of-custody record.</p>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;color:var(--text-dim);"><span style="color:var(--gold);">&#10003;</span> Unique cryptographic seal per document</div>
          <div style="display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;color:var(--text-dim);"><span style="color:var(--gold);">&#10003;</span> QR code + API verification</div>
          <div style="display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;color:var(--text-dim);"><span style="color:var(--gold);">&#10003;</span> Full audit trail per seal</div>
          <div style="display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;color:var(--text-dim);"><span style="color:var(--gold);">&#10003;</span> ERC-721 certificate ready (blockchain optional)</div>
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
      <h2>HOW <span class="accent">GOVCHAIN</span> WORKS</h2>
    </div>
    <div class="steps-grid">
      <div class="step">
        <div class="step-num">01</div>
        <div class="step-icon">&#127963;</div>
        <div class="step-title">CLASSIFY</div>
        <p class="step-body">Agency submits document or asset. AI AutoFlow&trade; classifies the type, identifies the issuing authority, and generates an authentication workflow automatically.</p>
      </div>
      <div class="step">
        <div class="step-num">02</div>
        <div class="step-icon">&#128272;</div>
        <div class="step-title">SEAL</div>
        <p class="step-body">Document receives a unique TrueMark&trade; ID with cryptographic hash, timestamp, and signatory metadata. QR code generated for physical attachment.</p>
      </div>
      <div class="step">
        <div class="step-num">03</div>
        <div class="step-icon">&#128271;</div>
        <div class="step-title">VERIFY</div>
        <p class="step-body">Citizens or agencies verify any document in under 2 seconds. QR scan or API query returns full provenance, tamper detection, and TrueMark&trade; authentication status.</p>
      </div>
      <div class="step">
        <div class="step-num">04</div>
        <div class="step-icon">&#128202;</div>
        <div class="step-title">AUDIT</div>
        <p class="step-body">Complete audit trails for every TrueMark&trade; seal. FOIA-ready reporting, procurement transparency dashboards, and real-time anomaly detection across all records.</p>
      </div>
    </div>
  </div>
</section>

<!-- USE CASES -->
<section class="use-cases-section" id="use-cases">
  <div class="use-cases-inner">
    <div class="use-cases-header">
      <div class="section-tag" style="justify-content:center">Applications</div>
      <h2>BUILT FOR <span class="accent">GOVERNMENT</span></h2>
    </div>
    <div class="use-cases-grid">
      <div class="use-case-card">
        <div class="use-case-icon">&#128220;</div>
        <div class="use-case-title">PROCUREMENT</div>
        <p class="use-case-body">End-to-end transparency for RFPs, bids, contracts, and invoices. Every procurement action is timestamped and tamper-evident &mdash; eliminating fraud and ensuring fair competition.</p>
      </div>
      <div class="use-case-card">
        <div class="use-case-icon">&#127919;</div>
        <div class="use-case-title">CREDENTIALS</div>
        <p class="use-case-body">Licenses, permits, certifications, and diplomas verified instantly. No more phone calls to confirm authenticity &mdash; one scan proves it's real, current, and unaltered.</p>
      </div>
      <div class="use-case-card">
        <div class="use-case-icon">&#9878;&#65039;</div>
        <div class="use-case-title">PUBLIC RECORDS</div>
        <p class="use-case-body">Property deeds, court records, vital statistics, and regulatory filings secured in verified records. FOIA requests answered with documented proof of completeness and authenticity.</p>
      </div>
    </div>
  </div>
</section>

<!-- COMPLIANCE -->
<section class="compliance-section">
  <div class="compliance-inner">
    <div class="section-tag" style="justify-content:center">Compliance</div>
    <h2>TARGET <span class="accent">COMPLIANCE</span> FRAMEWORKS</h2>
    <p class="body-text" style="max-width:600px;margin:0 auto;">GovChain is designed to align with federal security and compliance frameworks. Certifications are planned milestones.</p>
    <div class="compliance-badges">
      <div class="compliance-badge">
        <div class="compliance-badge-icon">&#128274;</div>
        <div class="compliance-badge-label">FedRAMP (Planned)</div>
      </div>
      <div class="compliance-badge">
        <div class="compliance-badge-icon">&#128737;</div>
        <div class="compliance-badge-label">NIST 800-53 (Planned)</div>
      </div>
      <div class="compliance-badge">
        <div class="compliance-badge-icon">&#9989;</div>
        <div class="compliance-badge-label">SOC 2 Type II (Planned)</div>
      </div>
      <div class="compliance-badge">
        <div class="compliance-badge-icon">&#128506;</div>
        <div class="compliance-badge-label">FISMA (Planned)</div>
      </div>
      <div class="compliance-badge">
        <div class="compliance-badge-icon">&#127383;</div>
        <div class="compliance-badge-label">508 Compliant (Planned)</div>
      </div>
    </div>
  </div>
</section>

<!-- PRICING TIERS -->
<section class="tiers-section" id="pricing">
  <div class="tiers-inner">
    <div class="tiers-header">
      <div class="section-tag" style="justify-content:center">Pricing</div>
      <h2>PLANS FOR <span class="accent">EVERY</span> AGENCY</h2>
    </div>
    <div class="tiers-grid">
      <div class="tier-card">
        <div class="tier-name">Municipal</div>
        <div class="tier-price">
          <span class="currency">$</span>
          <span class="amount">499</span>
          <span class="period">/mo</span>
        </div>
        <ul class="tier-features">
          <li>5,000 document verifications/mo</li>
          <li>1 department registration</li>
          <li>QR + API verification</li>
          <li>Basic audit dashboard</li>
          <li>Email support</li>
          <li class="dim">Custom integrations</li>
          <li class="dim">Dedicated CSM</li>
        </ul>
        <a href="mailto:hello@govchain.us?subject=Municipal%20Plan" class="tier-btn outline">Get started</a>
      </div>
      <div class="tier-card featured">
        <div class="tier-name">State</div>
        <div class="tier-price">
          <span class="currency">$</span>
          <span class="amount">1,999</span>
          <span class="period">/mo</span>
        </div>
        <ul class="tier-features">
          <li>50,000 verifications/mo</li>
          <li>10 department registrations</li>
          <li>QR + API + bulk verify</li>
          <li>Advanced analytics + FOIA tools</li>
          <li>Procurement transparency suite</li>
          <li>API access + webhooks</li>
          <li class="dim">White label</li>
        </ul>
        <a href="mailto:hello@govchain.us?subject=State%20Plan" class="tier-btn solid">Get started</a>
      </div>
      <div class="tier-card">
        <div class="tier-name">Federal</div>
        <div class="tier-price">
          <span class="currency">$</span>
          <span class="amount">9,999</span>
          <span class="period">/mo</span>
        </div>
        <ul class="tier-features">
          <li>Unlimited verifications</li>
          <li>Unlimited departments</li>
          <li>Full API ecosystem</li>
          <li>Custom compliance reporting</li>
          <li>White label deployment</li>
          <li>Dedicated CSM + SLA</li>
          <li>On-premise option</li>
        </ul>
        <a href="mailto:hello@govchain.us?subject=Federal%20Plan" class="tier-btn outline">Contact sales</a>
      </div>
    </div>
  </div>
</section>

<!-- API TERMINAL -->
<section class="terminal-section" id="api">
  <div class="terminal-inner">
    <div class="section-tag" style="justify-content:center">Developer API</div>
    <h2>AI AUTOFLOW&trade; <span class="accent">IN ACTION</span></h2>
    <p class="body-text" style="margin:0 auto 0;max-width:540px;">Submit any government document to the classify endpoint. AI AutoFlow&trade; identifies the type, generates a verification workflow, and returns a TrueMark&trade; seal &mdash; all via REST API.</p>
    <div class="terminal-window">
      <div class="terminal-bar">
        <div class="terminal-dot red"></div>
        <div class="terminal-dot amber"></div>
        <div class="terminal-dot green"></div>
        <div class="terminal-title">authichain api &mdash; ai autoflow classify</div>
      </div>
      <div class="terminal-body">
        <span class="t-line"><span class="t-comment"># Step 1: Classify a government document via AI AutoFlow</span></span>
        <span class="t-line"><span class="t-prompt">$ </span><span class="t-cmd">curl -X POST https://authichain-api.undone-k.workers.dev/classify \\</span></span>
        <span class="t-line">  <span class="t-cmd">-H </span><span class="t-val">"Authorization: Bearer demo_test_key_2026"</span> <span class="t-cmd">\\</span></span>
        <span class="t-line">  <span class="t-cmd">-d </span><span class="t-val">'{"name":"RFP-2026-0847","description":"Federal procurement contract"}'</span></span>
        <span class="t-line">&nbsp;</span>
        <span class="t-line"><span class="t-comment"># AI AutoFlow Response</span></span>
        <span class="t-line">{</span>
        <span class="t-line">  <span class="t-key">"classification"</span>: <span class="t-val">"government_procurement"</span>,</span>
        <span class="t-line">  <span class="t-key">"confidence"</span>: <span class="t-val">0.97</span>,</span>
        <span class="t-line">  <span class="t-key">"workflow"</span>: <span class="t-val">"classify &rarr; hash &rarr; seal &rarr; verify"</span>,</span>
        <span class="t-line">  <span class="t-key">"truemark_id"</span>: <span class="t-val">"TM-2026-GOV-R7F4"</span>,</span>
        <span class="t-line">  <span class="t-key">"mode"</span>: <span class="t-val">"demo"</span>,</span>
        <span class="t-line">  <span class="t-key">"engine"</span>: <span class="t-val">"AI AutoFlow v1"</span></span>
        <span class="t-line">}</span>
        <span class="t-line">&nbsp;</span>
        <span class="t-line"><span class="t-comment"># Step 2: Verify TrueMark seal</span></span>
        <span class="t-line"><span class="t-prompt">$ </span><span class="t-cmd">curl https://authichain-api.undone-k.workers.dev/verify \\</span></span>
        <span class="t-line">  <span class="t-cmd">-d </span><span class="t-val">'{"truemark":"TM-2026-GOV-R7F4"}'</span></span>
        <span class="t-line">&nbsp;</span>
        <span class="t-line">{ <span class="t-key">"verified"</span>: <span class="t-success">true</span>, <span class="t-key">"status"</span>: <span class="t-val">"AUTHENTIC"</span>, <span class="t-key">"seal"</span>: <span class="t-val">"TRUEMARK_VALID"</span> }</span>
      </div>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="cta-section">
  <div class="cta-bg"></div>
  <h2 class="accent">REQUEST A PILOT PROGRAM</h2>
  <p>Explore government document verification with our API. Pilot programs available for qualified agencies.</p>
  <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">
    <a href="mailto:hello@govchain.us?subject=GovChain%20Demo%20Request" class="btn-primary">Request a demo</a>
    <a href="#api" class="btn-secondary">View API docs</a>
  </div>
</section>

<!-- FOOTER -->
<footer>
  <div class="footer-inner">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="nav-logo" href="/" style="text-decoration:none;">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><polygon points="18,1 33,9.5 33,26.5 18,35 3,26.5 3,9.5" fill="#4a90d9" opacity="0.15" stroke="#4a90d9" stroke-width="1.5"/><polygon points="18,5 30,11.5 30,24.5 18,31 6,24.5 6,11.5" fill="#080c14" stroke="#4a90d9" stroke-width="0.5" opacity="0.6"/><path d="M12,24 L12,16 L18,11 L24,16 L24,24 Z" stroke="#4a90d9" stroke-width="1.5" fill="none"/><line x1="18" y1="11" x2="18" y2="8" stroke="#d4a843" stroke-width="1.5" stroke-linecap="round"/><rect x="15.5" y="18" width="5" height="6" rx="0.5" stroke="#4a90d9" stroke-width="1" fill="none" opacity="0.6"/><line x1="18" y1="19" x2="18" y2="22" stroke="#4a90d9" stroke-width="0.8" opacity="0.5"/></svg>
          <span class="nav-logo-text">GOV<span>CHAIN</span></span>
        </a>
        <p class="footer-brand-desc">Government document verification powered by the AuthiChain Protocol. Edge-deployed, API-first infrastructure for public sector integrity.</p>
      </div>
      <div>
        <div class="footer-col-title">Protocol</div>
        <ul class="footer-col-links">
          <li><a href="https://authichain-api.undone-k.workers.dev/">API Gateway</a></li>
          <li><a href="#how">How it works</a></li>
          <li><a href="#api">Developer API</a></li>
          <li><a href="mailto:hello@govchain.us">Contact</a></li>
        </ul>
      </div>
      <div>
        <div class="footer-col-title">Verticals</div>
        <ul class="footer-col-links">
          <li><a href="https://authichain.com">AuthiChain</a></li>
          <li><a href="https://qron-portfolio.undone-k.workers.dev/">QRON</a></li>
          <li><a href="https://strainchain.io">StrainChain</a></li>
          <li><a href="/">GovChain</a></li>
        </ul>
      </div>
      <div>
        <div class="footer-col-title">Resources</div>
        <ul class="footer-col-links">
          <li><a href="#use-cases">Use Cases</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href="#verify">Verification Demo</a></li>
          <li><a href="mailto:hello@govchain.us?subject=GovChain%20Demo%20Request">Request Demo</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <ul class="footer-links">
        <li><a href="#api">API</a></li>
        <li><a href="#use-cases">Use cases</a></li>
        <li><a href="#pricing">Pricing</a></li>
        <li><a href="https://authichain.com">AuthiChain</a></li>
        <li><a href="https://qron-portfolio.undone-k.workers.dev/">QRON</a></li>
        <li><a href="https://strainchain.io">StrainChain</a></li>
      </ul>
      <div class="footer-copy">&copy; 2026 GovChain &middot; Powered by AuthiChain Protocol</div>
    </div>
  </div>
</footer>

</body>
</html>`;

const CAPABILITY_HTML = `<!DOCTYPE html>
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
<title>GovChain — Capability Statement</title>
<meta name="description" content="GovChain Capability Statement for government procurement. AI-powered document verification, SAM.gov registered.">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
  .page { box-shadow: none; margin: 0; max-width: 100%; }
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'DM Sans', sans-serif;
  background: #f5f7fa;
  color: #1a1a2e;
  line-height: 1.6;
  padding: 40px 20px;
}
.no-print {
  max-width: 850px;
  margin: 0 auto 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.no-print a {
  font-family: 'DM Mono', monospace;
  font-size: 13px;
  color: #4a90d9;
  text-decoration: none;
}
.no-print button {
  font-family: 'DM Mono', monospace;
  font-size: 13px;
  padding: 8px 20px;
  background: #4a90d9;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.page {
  max-width: 850px;
  margin: 0 auto;
  background: white;
  box-shadow: 0 2px 20px rgba(0,0,0,0.08);
  padding: 60px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 3px solid #4a90d9;
  padding-bottom: 24px;
  margin-bottom: 32px;
}
.header-left h1 {
  font-size: 32px;
  font-weight: 600;
  color: #4a90d9;
  letter-spacing: -0.5px;
}
.header-left .subtitle {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
}
.header-right {
  text-align: right;
  font-size: 13px;
  color: #666;
  line-height: 1.8;
}
.header-right strong { color: #1a1a2e; }
.sam-badge {
  display: inline-block;
  background: #4a90d9;
  color: white;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 3px;
  margin-top: 8px;
  letter-spacing: 0.05em;
}
.section { margin-bottom: 28px; }
.section-title {
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #4a90d9;
  border-bottom: 1px solid #e0e8f0;
  padding-bottom: 8px;
  margin-bottom: 14px;
}
.section p, .section li {
  font-size: 14px;
  color: #444;
  line-height: 1.7;
}
.section ul {
  list-style: none;
  padding: 0;
}
.section ul li {
  padding: 4px 0;
  padding-left: 18px;
  position: relative;
}
.section ul li::before {
  content: '\\25B8';
  position: absolute;
  left: 0;
  color: #4a90d9;
}
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
}
.naics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.naics-item {
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  background: #f0f4ff;
  padding: 8px 12px;
  border-radius: 4px;
  border-left: 3px solid #4a90d9;
}
.naics-item .code { font-weight: 600; color: #4a90d9; }
.naics-item .desc { color: #666; font-family: 'DM Sans', sans-serif; font-size: 11px; }
.tech-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.tech-card {
  background: #f8fafc;
  border: 1px solid #e0e8f0;
  border-radius: 6px;
  padding: 20px;
}
.tech-card h4 {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 6px;
}
.tech-card .tag {
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  color: #4a90d9;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.tech-card p {
  font-size: 13px;
  color: #666;
  margin-top: 8px;
  line-height: 1.6;
}
.footer-bar {
  margin-top: 32px;
  padding-top: 20px;
  border-top: 3px solid #4a90d9;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #888;
}
.footer-bar a { color: #4a90d9; text-decoration: none; }
</style>
</head>
<body>

<div class="no-print">
  <a href="/">&larr; Back to GovChain</a>
  <button onclick="window.print()">Print / Save as PDF</button>
</div>

<div class="page">
  <div class="header">
    <div class="header-left">
      <h1>GovChain</h1>
      <div class="subtitle">A Division of AuthiChain Protocol</div>
      <div class="subtitle">Government Document Verification &amp; Integrity Platform</div>
    </div>
    <div class="header-right">
      <strong>AuthiChain LLC</strong><br>
      hello@govchain.us<br>
      govchain.us<br>
      <span class="sam-badge">SAM.gov REGISTERED</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Company Overview</div>
    <p>GovChain, a vertical of AuthiChain Protocol, provides AI-powered document verification and integrity infrastructure for government agencies at municipal, state, and federal levels. Our platform combines GPT-4 Vision classification (AI AutoFlow&trade;) with cryptographic tamper-proof seals (TrueMark&trade;) to authenticate procurement documents, credentials, and public records in under 3 seconds via REST API.</p>
  </div>

  <div class="two-col">
    <div class="section">
      <div class="section-title">Core Competencies</div>
      <ul>
        <li>AI-powered document classification &amp; verification</li>
        <li>Cryptographic document sealing (TrueMark&trade;)</li>
        <li>QR-based instant verification for citizens</li>
        <li>Procurement integrity &amp; fraud detection</li>
        <li>FOIA-ready audit trail generation</li>
        <li>Edge-deployed API infrastructure (250+ global PoPs)</li>
        <li>Credential &amp; license authentication</li>
        <li>Public records tamper detection</li>
      </ul>
    </div>
    <div class="section">
      <div class="section-title">Differentiators</div>
      <ul>
        <li><strong>AI AutoFlow&trade;</strong> &mdash; GPT-4 Vision classifier supports 10 industries, 97%+ confidence</li>
        <li><strong>TrueMark&trade;</strong> &mdash; Unique cryptographic seal per document with full chain-of-custody</li>
        <li><strong>Sub-3-second verification</strong> &mdash; Classify, seal, and verify via single API call</li>
        <li><strong>Edge-first architecture</strong> &mdash; Cloudflare Workers, zero cold starts, global edge deployment</li>
        <li><strong>Blockchain-ready</strong> &mdash; ERC-721 smart contract deployed, on-chain sealing optional</li>
        <li><strong>API-first</strong> &mdash; REST endpoints integrate with any existing government system</li>
      </ul>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Core Technology</div>
    <div class="tech-grid">
      <div class="tech-card">
        <div class="tag">Classification Engine</div>
        <h4>AI AutoFlow&trade;</h4>
        <p>Universal document classifier powered by GPT-4 Vision. Automatically identifies document type, generates authentication workflow, assigns confidence score, and routes to appropriate verification pipeline. Supports 10 industry verticals including government, healthcare, defense, and infrastructure.</p>
      </div>
      <div class="tech-card">
        <div class="tag">Verification Seal</div>
        <h4>TrueMark&trade;</h4>
        <p>Each verified document receives a unique TrueMark ID (e.g., TM-2026-GOV-R7F4). The seal is tamper-proof, scannable via QR code, and queryable via REST API. Full audit trail tracks every access, verification attempt, and chain-of-custody event. Backed by ERC-721 smart contract for optional on-chain certification.</p>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">NAICS Codes</div>
    <div class="naics-grid">
      <div class="naics-item"><span class="code">541512</span><br><span class="desc">Computer Systems Design</span></div>
      <div class="naics-item"><span class="code">541511</span><br><span class="desc">Custom Programming</span></div>
      <div class="naics-item"><span class="code">541519</span><br><span class="desc">Other Computer Services</span></div>
      <div class="naics-item"><span class="code">518210</span><br><span class="desc">Data Processing &amp; Hosting</span></div>
      <div class="naics-item"><span class="code">541990</span><br><span class="desc">Other Professional Services</span></div>
      <div class="naics-item"><span class="code">561499</span><br><span class="desc">Other Business Support</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Government Use Cases</div>
    <div class="two-col">
      <div>
        <ul>
          <li><strong>Procurement Integrity</strong> &mdash; Verify RFPs, bids, contracts, and invoices with tamper-evident seals</li>
          <li><strong>Credential Authentication</strong> &mdash; Instantly verify licenses, permits, certifications, and diplomas</li>
          <li><strong>Public Records</strong> &mdash; Secure property deeds, court records, vital statistics, and regulatory filings</li>
        </ul>
      </div>
      <div>
        <ul>
          <li><strong>FOIA Compliance</strong> &mdash; Auto-generated audit trails for records requests</li>
          <li><strong>Import/Export Verification</strong> &mdash; CBP and ITAR document authentication</li>
          <li><strong>Interagency Trust</strong> &mdash; Shared verification layer across departments</li>
        </ul>
      </div>
    </div>
  </div>

  <div class="two-col">
    <div class="section">
      <div class="section-title">Target Compliance Frameworks</div>
      <ul>
        <li>FedRAMP (Planned)</li>
        <li>NIST 800-53 (Aligned, certification planned)</li>
        <li>SOC 2 Type II (Planned)</li>
        <li>FISMA (Planned)</li>
        <li>Section 508 Accessibility (Planned)</li>
      </ul>
    </div>
    <div class="section">
      <div class="section-title">Infrastructure</div>
      <ul>
        <li>Cloudflare Workers (250+ global edge PoPs)</li>
        <li>Zero cold starts, sub-50ms response time</li>
        <li>PostgreSQL (Supabase) &mdash; encrypted at rest</li>
        <li>REST API with bearer token auth</li>
        <li>ERC-721 smart contract (Polygon)</li>
        <li>Deployed across 19 edge workers</li>
      </ul>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Past Performance &amp; Ecosystem</div>
    <p>AuthiChain Protocol operates 4 industry verticals with live production infrastructure:</p>
    <ul>
      <li><strong>QRON Studio</strong> (qron-portfolio.undone-k.workers.dev) &mdash; AI-generated artistic QR codes for brands, 8 signature styles, 3 pricing tiers with live Stripe payment processing</li>
      <li><strong>StrainChain</strong> (strainchain.io) &mdash; Cannabis product provenance &amp; compliance platform, 3 pricing tiers with live payment processing</li>
      <li><strong>AuthiChain API</strong> (authichain-api.undone-k.workers.dev) &mdash; Universal classification &amp; verification REST API, 4 endpoints, live demo mode</li>
      <li><strong>GovChain</strong> (govchain.us) &mdash; Government document verification platform (pilot program)</li>
    </ul>
  </div>

  <div class="footer-bar">
    <div>GovChain &mdash; A Division of AuthiChain Protocol &bull; SAM.gov Registered &bull; <a href="https://govchain.us">govchain.us</a></div>
    <div>Capability Statement &bull; April 2026</div>
  </div>
</div>

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
        "User-agent: *\nAllow: /\nSitemap: https://govchain.us/sitemap.xml\n",
        { headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=86400" } }
      );
    }

    if (path === "/sitemap.xml") {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://govchain.us/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n  <url><loc>https://govchain.us/capability-statement</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>\n</urlset>',
        { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=86400" } }
      );
    }

    if (path === "/capability-statement") {
      return new Response(CAPABILITY_HTML, {
        headers: {
          ...cors,
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=3600"
        }
      });
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
--0590980dd1a250a6037f579d7fd27fc5cb39cb02dda2efd56996ce9f469a--
