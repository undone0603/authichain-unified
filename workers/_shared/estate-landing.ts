/**
 * Shared light-enterprise marketing system for the four AuthiChain estate
 * landings (authichain.com, qron.space, govchain.us, strainchain.io).
 *
 * Workers stay self-contained after wrangler/esbuild inlines this module.
 * Do not invent metrics or customer logos here — only product claims and
 * conversion paths that already exist in the estate.
 */

import { emailCheckoutWithPaymentLinkHtml } from "../../src/lib/checkout-email";

export type EstateBrandId = "authichain" | "qron" | "govchain" | "strainchain";

export interface EstateBrand {
  id: EstateBrandId;
  name: string;
  domain: string;
  url: string;
  wordmark: string;
  tagline: string;
  /** WCAG-AA accent on white */
  accent: string;
  accentInk: string;
  accentSoft: string;
  ink: string;
}

export const ESTATE_BRANDS: Record<EstateBrandId, EstateBrand> = {
  authichain: {
    id: "authichain",
    name: "AuthiChain",
    domain: "authichain.com",
    url: "https://authichain.com",
    wordmark: "AuthiChain",
    tagline: "The authentic agentic economy",
    accent: "#4F46E5",
    accentInk: "#ffffff",
    accentSoft: "#eef2ff",
    ink: "#0f172a",
  },
  qron: {
    id: "qron",
    name: "QRON",
    domain: "qron.space",
    url: "https://qron.space",
    wordmark: "QRON",
    tagline: "Living QR codes that scan",
    accent: "#b45309",
    accentInk: "#ffffff",
    accentSoft: "#ffedd5",
    ink: "#0f172a",
  },
  govchain: {
    id: "govchain",
    name: "GovChain",
    domain: "govchain.us",
    url: "https://govchain.us",
    wordmark: "GovChain",
    tagline: "Federal contract intelligence",
    accent: "#1d4ed8",
    accentInk: "#ffffff",
    accentSoft: "#dbeafe",
    ink: "#0f172a",
  },
  strainchain: {
    id: "strainchain",
    name: "StrainChain",
    domain: "strainchain.io",
    url: "https://strainchain.io",
    wordmark: "StrainChain",
    tagline: "Seed-to-sale provenance",
    accent: "#15803d",
    accentInk: "#ffffff",
    accentSoft: "#dcfce7",
    ink: "#0f172a",
  },
};

export const ESTATE_FONTS_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">`;

export interface EstateLink {
  href: string;
  label: string;
}

export interface EstateCta extends EstateLink {
  primary?: boolean;
}

export function estateCssVars(brand: EstateBrandId): string {
  const b = ESTATE_BRANDS[brand];
  const shadow =
    brand === "authichain"
      ? "0 1px 2px rgba(79, 70, 229, 0.06), 0 16px 40px rgba(79, 70, 229, 0.10)"
      : "0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04)";
  return `:root {
  --bg: #ffffff;
  --bg2: #f8fafc;
  --bg3: #f1f5f9;
  --ink: ${b.ink};
  --text: #0f172a;
  --text-dim: #475569;
  --muted: #64748b;
  --border: #e2e8f0;
  --border-strong: #cbd5e1;
  --accent: ${b.accent};
  --accent-ink: ${b.accentInk};
  --accent-soft: ${b.accentSoft};
  --violet: #7C3AED;
  --primary: ${b.accent};
  --primary-dim: ${b.accent};
  --primary-glow: transparent;
  --secondary: ${brand === "authichain" ? "#7C3AED" : b.accent};
  --display: "Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif;
  --body: "Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  --radius: 10px;
  --shadow: ${shadow};
}`;
}

/** Shared light-enterprise chrome used by all four brand landings. */
export const ESTATE_BASE_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--body);
  font-size: 16px;
  line-height: 1.6;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}
img { max-width: 100%; display: block; }
a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 2px; }
a:hover { text-decoration: underline; }
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
.skip-link {
  position: absolute;
  left: 12px;
  top: -48px;
  z-index: 2000;
  background: var(--ink);
  color: #fff;
  padding: 8px 12px;
  border-radius: 6px;
  text-decoration: none;
}
.skip-link:focus { top: 12px; }
.wrap { width: min(1120px, calc(100% - 32px)); margin: 0 auto; }
nav.estate-nav, .nav {
  position: sticky;
  top: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 20px;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
.nav-logo, .logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: var(--display);
  font-weight: 600;
  font-size: 1.15rem;
  letter-spacing: -0.02em;
  color: var(--ink);
  text-decoration: none;
}
.nav-logo:hover, .logo:hover { text-decoration: none; color: var(--ink); }
.nav-mark {
  width: 28px; height: 28px; border-radius: 6px;
  background: var(--accent); color: var(--accent-ink);
  display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--body); font-size: 11px; font-weight: 700;
}
.nav-links { display: flex; align-items: center; gap: 8px 18px; list-style: none; }
.nav-links a, .nav-link {
  color: var(--text-dim);
  text-decoration: none;
  font-size: 0.92rem;
  font-weight: 500;
}
.nav-links a:hover, .nav-link:hover { color: var(--ink); text-decoration: none; }
.nav-menu { display: none; }
.nav-menu summary {
  list-style: none;
  cursor: pointer;
  font-weight: 600;
  color: var(--ink);
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.nav-menu summary::-webkit-details-marker { display: none; }
@media (max-width: 767px) {
  .nav-links { display: none; }
  .nav-menu { display: block; position: relative; }
  .nav-menu[open] .nav-menu-panel {
    display: flex;
    flex-direction: column;
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    min-width: 220px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow);
    padding: 10px;
    gap: 4px;
  }
  .nav-menu-panel a { padding: 8px 10px; text-decoration: none; color: var(--text); }
}
.btn, .btn-primary, .btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 8px;
  font-family: var(--body);
  font-size: 0.95rem;
  font-weight: 600;
  text-decoration: none;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}
.btn:hover, .btn-primary:hover, .btn-outline:hover { text-decoration: none; transform: translateY(-1px); }
.btn-primary, .btn.btn-primary {
  background: var(--accent);
  color: var(--accent-ink);
  border-color: var(--accent);
}
.btn-primary:hover { filter: brightness(0.95); color: var(--accent-ink); }
.btn-outline, .btn.btn-outline {
  background: #fff;
  color: var(--ink);
  border-color: var(--border-strong);
}
.btn-outline:hover { border-color: var(--accent); color: var(--accent); }
.btn-sm { padding: 8px 14px; font-size: 0.85rem; width: auto; }
button.btn { font: inherit; }
.checkout-email-form {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  min-width: min(100%, 22rem);
  text-align: left;
}
.hero-cta .checkout-email-form,
.estate-actions .checkout-email-form { flex: 1 1 100%; max-width: 22rem; }
.price-card .checkout-email-form { width: 100%; }
.price-card .checkout-email-form .btn { width: 100%; }
.checkout-email-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-dim);
}
.checkout-email-form input[type="email"] {
  padding: 10px 12px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  font: inherit;
  background: #fff;
  color: var(--text);
}
.checkout-email-hint {
  font-size: 0.82rem;
  color: var(--muted);
  margin: 0;
}
.checkout-need-email {
  display: none;
  max-width: 36rem;
  margin: 0 auto 16px;
  padding: 12px 16px;
  border: 1px solid #f59e0b;
  border-radius: 10px;
  background: rgba(245, 158, 11, 0.12);
  color: #92400e;
  font-size: 0.92rem;
}
.checkout-need-email.is-visible { display: block; }
.hero, .estate-hero {
  padding: 72px 20px 56px;
  text-align: left;
}
.estate-hero .wrap, .hero .wrap { max-width: 760px; margin: 0; }
.hero-content { max-width: 760px; }
.hero-badge, .estate-badge {
  display: inline-block;
  background: var(--accent-soft);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 18px;
}
.hero h1, .estate-hero h1, .hero-title {
  font-family: var(--display);
  font-size: clamp(2.15rem, 5vw, 3.4rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.12;
  color: var(--ink);
  margin-bottom: 16px;
}
.hero-title .accent, .accent { color: var(--accent); }
.hero p, .hero-sub, .estate-lede {
  font-size: 1.125rem;
  color: var(--text-dim);
  max-width: 640px;
  margin-bottom: 28px;
}
.hero-cta, .hero-actions, .estate-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.trust, .stats-bar, .estate-trust {
  background: var(--bg2);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 28px 20px;
}
.estate-trust-grid, .stats-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  width: min(1120px, 100%);
  margin: 0 auto;
}
.stat, .estate-trust-item { text-align: left; }
.stat-value, .estate-trust-item strong {
  display: block;
  font-family: var(--display);
  font-size: 1.25rem;
  color: var(--ink);
  font-weight: 600;
}
.stat-label, .estate-trust-item span {
  display: block;
  margin-top: 4px;
  font-size: 0.82rem;
  color: var(--muted);
}
section, .estate-section { padding: 72px 20px; }
section > .wrap, .estate-section .wrap { max-width: 1120px; }
h2 {
  font-family: var(--display);
  font-size: clamp(1.6rem, 3.4vw, 2.15rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--ink);
  margin-bottom: 10px;
  line-height: 1.2;
}
.section-tag {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 10px;
}
.section-sub { color: var(--text-dim); max-width: 640px; margin-bottom: 32px; }
.grid, .grid-3, .pros-grid, .estate-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 768px) {
  .grid, .grid-3, .pros-grid, .estate-grid { grid-template-columns: repeat(2, 1fr); }
  .hero, .estate-hero { padding: 96px 20px 72px; }
}
@media (min-width: 1024px) {
  .grid, .grid-3, .pros-grid, .estate-grid { grid-template-columns: repeat(3, 1fr); }
}
.card, .pro, .glass, .step, .compliance-card, .price-card, .estate-card {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
  box-shadow: var(--shadow);
}
.card h3, .pro h3, .estate-card h3, .step h3, .compliance-card h3 {
  font-size: 1.05rem;
  font-weight: 650;
  margin-bottom: 8px;
  color: var(--ink);
}
.card p, .pro p, .estate-card p, .step p, .compliance-card p { color: var(--text-dim); font-size: 0.95rem; }
.steps, .pricing-grid, .compliance-grid, .bridge-grid, .integrations {
  display: grid;
  gap: 16px;
}
.steps { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.pricing-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.compliance-grid, .bridge-grid { grid-template-columns: repeat(2, 1fr); }
.integrations { grid-template-columns: repeat(4, 1fr); }
.step-num {
  font-family: var(--display);
  font-size: 1.6rem;
  color: var(--accent);
  margin-bottom: 8px;
}
.price-card { text-align: left; }
.price-card.featured { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.price-amount { font-family: var(--display); font-size: 2rem; font-weight: 650; color: var(--ink); margin: 12px 0 4px; }
.price-period { font-size: 0.85rem; color: var(--muted); margin-bottom: 16px; }
.price-features { list-style: none; margin-bottom: 20px; }
.price-features li { padding: 6px 0; color: var(--text-dim); font-size: 0.92rem; }
.price-features li::before { content: "✓ "; color: var(--accent); font-weight: 700; }
.cta-section, .estate-cta {
  text-align: left;
  padding: 72px 20px;
  background: var(--bg2);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.cta-section .wrap, .estate-cta .wrap { max-width: 760px; }
footer, .estate-footer {
  padding: 48px 20px 28px;
  background: #fff;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 0.9rem;
}
.footer-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 28px;
  width: min(1120px, 100%);
  margin: 0 auto 28px;
}
@media (min-width: 900px) {
  .footer-grid { grid-template-columns: 1.4fr 1fr 1fr 1fr; }
}
.footer-heading {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-dim);
  margin-bottom: 12px;
}
.footer-links { list-style: none; }
.footer-links li { margin-bottom: 8px; }
.footer-links a { color: var(--text-dim); text-decoration: none; }
.footer-links a:hover { color: var(--accent); }
.estate-legal {
  width: min(1120px, 100%);
  margin: 0 auto;
  padding-top: 20px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 0.82rem;
}
.audit-pipeline { display: flex; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.audit-layer { flex: 1; padding: 18px 14px; background: #fff; border-right: 1px solid var(--border); text-align: left; }
.audit-layer:last-child { border-right: none; }
.audit-name { font-weight: 650; color: var(--accent); margin-bottom: 4px; }
.audit-desc { font-size: 0.8rem; color: var(--muted); }
.fit {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  background: var(--accent-soft);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--border));
}
.banner {
  background: var(--accent-soft);
  color: var(--ink);
  text-align: center;
  padding: 10px 16px;
  font-size: 0.88rem;
  font-weight: 600;
  border-bottom: 1px solid var(--border);
}
.banner a { color: var(--accent); font-weight: 700; }
.video-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 24px; }
.video-card { background: #fff; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow); }
.video-frame { position: relative; width: 100%; padding-top: 56.25%; }
.video-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.video-card h3 { font-size: 1rem; margin: 12px 16px 4px; }
.video-card time { display: block; font-size: 0.8rem; color: var(--muted); margin: 0 16px 14px; }
.estate-field {
  width: 100%;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  background: #fff;
  color: var(--text);
  font: inherit;
}
@media (max-width: 768px) {
  .stats-bar, .estate-trust-grid, .steps, .pricing-grid, .compliance-grid, .bridge-grid, .integrations { grid-template-columns: 1fr; }
  .audit-pipeline { flex-direction: column; }
  .audit-layer { border-right: none; border-bottom: 1px solid var(--border); }
  .hero, .estate-hero { text-align: left; }
}
section[id] { scroll-margin-top: 84px; }
`;

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function estateMark(brand: EstateBrandId): string {
  return `<span class="nav-mark" aria-hidden="true">${esc(ESTATE_BRANDS[brand].name.charAt(0))}</span>`;
}

export function estateNav(
  brand: EstateBrandId,
  links: EstateLink[],
  primary: EstateCta
): string {
  const b = ESTATE_BRANDS[brand];
  const items = links
    .map(l => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`)
    .join("");
  const mobile = [
    ...links.map(l => `<a href="${esc(l.href)}">${esc(l.label)}</a>`),
    `<a class="btn btn-primary" href="${esc(primary.href)}">${esc(primary.label)}</a>`,
  ].join("");
  return `<nav class="estate-nav nav" aria-label="Primary">
  <a class="nav-logo logo" href="/">${estateMark(brand)}${esc(b.wordmark)}</a>
  <ul class="nav-links">${items}</ul>
  <a class="btn btn-primary btn-sm" href="${esc(primary.href)}">${esc(primary.label)}</a>
  <details class="nav-menu">
    <summary>Menu</summary>
    <div class="nav-menu-panel">${mobile}</div>
  </details>
</nav>`;
}

export function estateHero(opts: {
  eyebrow: string;
  title: string;
  lede: string;
  lead?: EstateCta;
  actions: EstateCta[];
  emailCheckout?: {
    action: string;
    label: string;
  };
}): string {
  const emailForm = opts.emailCheckout
    ? emailCheckoutWithPaymentLinkHtml({
        action: opts.emailCheckout.action,
        label: opts.emailCheckout.label,
        formId: "hero-checkout",
        inputId: "hero-checkout-email",
      })
    : "";
  const lead = opts.lead
    ? `<a class="btn btn-primary" href="${esc(opts.lead.href)}">${esc(opts.lead.label)}</a>`
    : "";
  const actions = opts.actions
    .map(
      a =>
        `<a class="btn ${a.primary === false ? "btn-outline" : "btn-primary"}" href="${esc(a.href)}">${esc(a.label)}</a>`
    )
    .join("");
  return `<header class="estate-hero hero" id="hero">
  <div class="wrap hero-content">
    <p class="estate-badge hero-badge">${esc(opts.eyebrow)}</p>
    <h1>${opts.title}</h1>
    <p class="estate-lede hero-sub">${opts.lede}</p>
    <div class="estate-actions hero-cta">${lead}${emailForm}${actions}</div>
  </div>
</header>`;
}

export function estateTrust(
  items: Array<{ value: string; label: string; id?: string }>
): string {
  const cells = items
    .map(it => {
      const value = it.id
        ? `<strong class="stat-value" id="${esc(it.id)}">${esc(it.value)}</strong>`
        : `<strong class="stat-value">${esc(it.value)}</strong>`;
      return `<div class="estate-trust-item stat">${value}<span class="stat-label">${esc(it.label)}</span></div>`;
    })
    .join("");
  return `<section class="estate-trust trust stats-bar" aria-label="Product capabilities">
  <div class="estate-trust-grid">${cells}</div>
</section>`;
}

export function estateSteps(
  heading: string,
  sub: string,
  steps: Array<{ title: string; body: string }>,
  id = "how"
): string {
  const cards = steps
    .map(
      (s, i) =>
        `<div class="step"><div class="step-num">${String(i + 1).padStart(2, "0")}</div><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></div>`
    )
    .join("");
  return `<section class="estate-section" id="${esc(id)}">
  <div class="wrap">
    <h2>${esc(heading)}</h2>
    <p class="section-sub">${esc(sub)}</p>
    <div class="steps">${cards}</div>
  </div>
</section>`;
}

export function estateFeatures(
  heading: string,
  sub: string,
  features: Array<{ title: string; body: string }>,
  id = "features"
): string {
  const cards = features
    .map(
      f =>
        `<article class="estate-card card"><h3>${esc(f.title)}</h3><p>${esc(f.body)}</p></article>`
    )
    .join("");
  return `<section class="estate-section" id="${esc(id)}">
  <div class="wrap">
    <h2>${heading}</h2>
    <p class="section-sub">${sub}</p>
    <div class="estate-grid">${cards}</div>
  </div>
</section>`;
}

export function estateCtaBand(opts: {
  title: string;
  lede: string;
  actions: EstateCta[];
  emailCheckout?: {
    action: string;
    label: string;
  };
}): string {
  const emailForm = opts.emailCheckout
    ? emailCheckoutWithPaymentLinkHtml({
        action: opts.emailCheckout.action,
        label: opts.emailCheckout.label,
        formId: "cta-checkout",
        inputId: "cta-checkout-email",
      })
    : "";
  const actions = opts.actions
    .map(
      a =>
        `<a class="btn ${a.primary === false ? "btn-outline" : "btn-primary"}" href="${esc(a.href)}">${esc(a.label)}</a>`
    )
    .join("");
  return `<section class="estate-cta cta-section" id="get-started">
  <div class="wrap">
    <h2>${opts.title}</h2>
    <p class="section-sub">${opts.lede}</p>
    <div class="estate-actions">${emailForm}${actions}</div>
  </div>
</section>`;
}

export function estateFooter(
  brand: EstateBrandId,
  columns: Array<{ heading: string; links: EstateLink[] }>,
  note: string
): string {
  const b = ESTATE_BRANDS[brand];
  const cols = columns
    .map(col => {
      const lis = col.links
        .map(l => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`)
        .join("");
      return `<div><div class="footer-heading">${esc(col.heading)}</div><ul class="footer-links">${lis}</ul></div>`;
    })
    .join("");
  return `<footer class="estate-footer">
  <div class="footer-grid">
    <div>
      <a class="nav-logo" href="/">${estateMark(brand)}${esc(b.wordmark)}</a>
      <p style="margin-top:12px;max-width:280px">${esc(b.tagline)}. Part of the AuthiChain estate.</p>
    </div>
    ${cols}
  </div>
  <div class="estate-legal">
    <p>© 2026 ${esc(b.name)}</p>
    <p>${note}</p>
  </div>
</footer>`;
}

export function estateSkipLink(): string {
  return `<a class="skip-link" href="#main">Skip to content</a>`;
}

export const ESTATE_SISTER_LINKS: EstateLink[] = [
  { href: "https://authichain.com", label: "AuthiChain" },
  { href: "https://qron.space", label: "QRON" },
  { href: "https://govchain.us", label: "GovChain" },
  { href: "https://strainchain.io", label: "StrainChain" },
];

/**
 * IndexNow ownership key. Public by design — matches
 * `public/authichain2026indexnow.txt`. Search engines fetch
 * `/{key}.txt` on each estate apex to verify submissions.
 */
export const ESTATE_INDEXNOW_KEY = "authichain2026indexnow";
export const ESTATE_INDEXNOW_PATH = `/${ESTATE_INDEXNOW_KEY}.txt`;

/** Short-cache text response used by all four estate landing workers. */
export function estateIndexNowResponse(): Response {
  return new Response(ESTATE_INDEXNOW_KEY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

/**
 * Serve GET `/authichain2026indexnow.txt` from every estate landing.
 * Exact path only — a trailing slash or other method is left to the worker.
 */
export function tryHandleEstateIndexNow(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const pathname = new URL(request.url).pathname;
  if (pathname !== ESTATE_INDEXNOW_PATH) return null;
  return estateIndexNowResponse();
}
