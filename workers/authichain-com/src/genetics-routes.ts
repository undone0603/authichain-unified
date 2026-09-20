/**
 * Public genetics surfaces for StrainChain / AuthiChain.
 *
 * Why this lives on the apex worker: src/app/genetics/* is Next RSC that is
 * not deployed on authichain-edge-router. strainchain.io proxies /genetics
 * and /passport to APP_ORIGIN=https://authichain.com; without a handler here
 * those paths returned AuthiChain-branded 404s (2026-09-20).
 *
 * Data snapshot: content/strainchain/mendo-love-farms/certificates.json
 * (updated 2026-09-11). No invented CoA numbers. LT-63 gap stated plainly.
 */

const HTML_SECURITY_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=300",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data: https:; frame-ancestors 'none'",
};

type Cultivar = {
  id: string;
  role: string;
  peak: number | null;
  coaCount: number;
  blurb: string;
};

const MENDO = {
  farmSlug: "mendo-love-farms",
  farmName: "Mendo Love Farms / RealTHCV",
  updated: "2026-09-11",
  distinctCoas: 12,
  lineageNote:
    "Mike confirmed in writing (2026-09-10): VT-26 × VT-41 produced LT males LT-11 / LT-17 / LT-57 and females LT-35 / LT-63. LT-35 retained for breeding; LT-63 offered for licensing.",
  commercialGap:
    "LT-63 is the licensable cultivar and has no CoA / no passport yet. Do not treat any page as a live LT-63 seal.",
  cultivars: [
    { id: "VT-26", role: "flagship parent", peak: 11.618, coaCount: 2, blurb: "Highest total THCV on file (11.618%)." },
    { id: "VT-41", role: "parent", peak: 6.899, coaCount: 2, blurb: "Pollen parent in the LT line." },
    { id: "LT-11", role: "breeding male 2025", peak: 6.244, coaCount: 1, blurb: "VT-26 × VT-41 male." },
    { id: "LT-17", role: "breeding male 2025", peak: 7.714, coaCount: 1, blurb: "VT-26 × VT-41 male." },
    { id: "LT-57", role: "breeding male 2025", peak: 7.977, coaCount: 1, blurb: "VT-26 × VT-41 male." },
    { id: "LT-35", role: "female 2025 — retained", peak: 11.233, coaCount: 2, blurb: "Second-highest THCV; kept for breeding, not the licensing offer." },
    { id: "VT-26×LT-11", role: "F1 selections 2026", peak: 8.814, coaCount: 3, blurb: "F1 panel set on file." },
    { id: "LT-63", role: "female 2025 — licensable", peak: null, coaCount: 0, blurb: "Licensing cultivar. No CoA in library yet — Passport cannot publish chemistry until a panel arrives." },
  ] as Cultivar[],
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(opts: {
  title: string;
  description: string;
  canonical: string;
  body: string;
}): string {
  const { title, description, canonical, body } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<style>
:root{--bg:#030c04;--card:#071209;--border:#0f2b12;--green:#10b981;--text:#e2e8f0;--muted:#64748b;--warn:#f87171}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:Inter,system-ui,sans-serif;line-height:1.55;min-height:100vh}
a{color:var(--green);text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:880px;margin:0 auto;padding:1.5rem 1.25rem 3rem}
nav{display:flex;gap:1rem;flex-wrap:wrap;align-items:center;margin-bottom:2rem;font-size:.9rem}
nav .brand{font-weight:800;color:var(--text);letter-spacing:.02em}
.badge{display:inline-block;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:.2rem .5rem;border-radius:.25rem;border:1px solid var(--border);color:var(--muted)}
.badge.warn{border-color:var(--warn);color:var(--warn)}
.badge.ok{border-color:var(--green);color:var(--green)}
h1{font-size:clamp(1.6rem,4vw,2.2rem);font-weight:800;margin:.5rem 0 .75rem;letter-spacing:-.02em}
.lede{color:var(--muted);margin-bottom:1.5rem;max-width:62ch}
.card{background:var(--card);border:1px solid var(--border);border-radius:.75rem;padding:1.1rem 1.25rem;margin:1rem 0}
.card h2{font-size:1.05rem;margin-bottom:.5rem}
.card p{color:var(--muted);font-size:.95rem}
.gap{border-color:#7f1d1d;background:#1a0a0a}
table{width:100%;border-collapse:collapse;font-size:.9rem;margin-top:.75rem}
th,td{text-align:left;padding:.55rem .4rem;border-bottom:1px solid var(--border);vertical-align:top}
th{color:var(--muted);font-weight:600;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em}
td strong{color:var(--text)}
.cta{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.25rem}
.btn{display:inline-block;padding:.75rem 1.25rem;border-radius:.5rem;font-weight:700;text-decoration:none}
.btn-primary{background:var(--green);color:#03120a}
.btn-primary:hover{text-decoration:none;filter:brightness(1.05)}
.btn-outline{border:1px solid var(--border);color:var(--text)}
.btn-outline:hover{border-color:var(--green);text-decoration:none}
footer{margin-top:2.5rem;padding-top:1.25rem;border-top:1px solid var(--border);color:var(--muted);font-size:.8rem}
code{font-size:.85em;background:rgba(148,163,184,.1);padding:.1rem .35rem;border-radius:.25rem}
</style>
</head>
<body>
<div class="wrap">
<nav>
  <a class="brand" href="https://strainchain.io">StrainChain</a>
  <a href="https://authichain.com/pricing">Pricing</a>
  <a href="https://strainchain.io/onboard">Onboard</a>
  <a href="https://authichain.com">AuthiChain</a>
</nav>
${body}
<footer>
  AuthiChain brand · StrainChain genetics passports · Legal entity ZACHARY KIETZMAN (sole proprietor; AuthiChain is a brand, not a corporation).<br>
  Totals transcribed from the committed CoA library (updated ${esc(MENDO.updated)}); LT-63 has no panel yet.
</footer>
</div>
</body>
</html>`;
}

function farmPage(): string {
  const rows = MENDO.cultivars
    .map((c) => {
      const peak = c.peak == null ? "—" : `${c.peak}%`;
      const coa =
        c.coaCount === 0
          ? '<span class="badge warn">0 CoA</span>'
          : `<span class="badge ok">${c.coaCount} CoA</span>`;
      return `<tr><td><strong>${esc(c.id)}</strong><br><span style="color:var(--muted);font-size:.8rem">${esc(c.role)}</span></td><td>${peak}</td><td>${coa}</td><td style="color:var(--muted)">${esc(c.blurb)}</td></tr>`;
    })
    .join("");

  const body = `
<span class="badge">Genetics library · demo</span>
<h1>${esc(MENDO.farmName)}</h1>
<p class="lede">Public cultivar index for the VT / LT THCV library. Chemistry is CoA-backed where panels exist. This is a breeder-owned defensive record surface — not AuthiChain claiming the genetics as inventory.</p>

<div class="card gap">
  <h2>Commercial gap (honest)</h2>
  <p>${esc(MENDO.commercialGap)}</p>
  <p style="margin-top:.5rem">${esc(MENDO.lineageNote)}</p>
</div>

<div class="card">
  <h2>Cultivars on file</h2>
  <p>${MENDO.distinctCoas} distinct SC Labs CoAs in the committed library (14 PDF attachments across the warm thread; attachment count ≠ certificate count).</p>
  <table>
    <thead><tr><th>Cultivar</th><th>Peak total THCV</th><th>CoAs</th><th>Note</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>

<div class="card">
  <h2>StrainChain Passport — $49</h2>
  <p>One cultivar genetics passport: CoA chemistry with totals derived at render, lineage edges tagged by evidence, public verify URL. First dollar for LT-63 (or any one cultivar) when the panel is in hand.</p>
  <div class="cta">
    <a class="btn btn-primary" href="https://authichain.com/api/checkout/plan/strainchain_passport">Passport checkout — $49</a>
    <a class="btn btn-outline" href="https://authichain.com/m/mendo">LT-63 licensing microsite</a>
    <a class="btn btn-outline" href="https://strainchain.io/onboard">Farm onboard</a>
  </div>
</div>
`;

  return shell({
    title: `${MENDO.farmName} genetics · StrainChain`,
    description:
      "VT/LT THCV genetics library for Mendo Love Farms / RealTHCV. CoA-backed where panels exist; LT-63 licensing gap stated plainly.",
    canonical: `https://strainchain.io/genetics/${MENDO.farmSlug}`,
    body,
  });
}

function geneticsIndex(): string {
  const body = `
<span class="badge">Genetics</span>
<h1>StrainChain genetics libraries</h1>
<p class="lede">Public, CoA-reconciled cultivar indexes. Farms keep ownership; AuthiChain publishes the defensive record.</p>
<div class="card">
  <h2><a href="/genetics/${MENDO.farmSlug}">${esc(MENDO.farmName)}</a></h2>
  <p>VT / LT THCV line · ${MENDO.distinctCoas} CoAs on file · LT-63 licensing cultivar still missing a panel.</p>
</div>
<div class="cta">
  <a class="btn btn-primary" href="https://authichain.com/api/checkout/plan/strainchain_passport">Passport checkout — $49</a>
  <a class="btn btn-outline" href="https://authichain.com/m/mendo">Mendo / LT-63 microsite</a>
</div>
`;
  return shell({
    title: "Genetics libraries · StrainChain",
    description: "Public genetics passport libraries on StrainChain.",
    canonical: "https://strainchain.io/genetics",
    body,
  });
}

function passportIndex(): string {
  const body = `
<span class="badge">Passport</span>
<h1>StrainChain Passport</h1>
<p class="lede">One-cultivar genetics passport — $49. Publish CoA-backed chemistry and provenance-tagged lineage for a single cultivar.</p>
<div class="card gap">
  <h2>LT-63 status</h2>
  <p>The Mendo Love Farms licensing cultivar (LT-63) has <strong style="color:var(--text)">no CoA in library yet</strong>, so there is no live passport URL for it. When Mike sends the panel, Passport is the instrument to publish it.</p>
</div>
<div class="card">
  <h2>See the library</h2>
  <p>Cultivars that already have panels:</p>
  <p style="margin-top:.5rem"><a href="/genetics/${MENDO.farmSlug}">${esc(MENDO.farmName)} genetics →</a></p>
</div>
<div class="cta">
  <a class="btn btn-primary" href="https://authichain.com/api/checkout/plan/strainchain_passport">Passport checkout — $49</a>
  <a class="btn btn-outline" href="/genetics/${MENDO.farmSlug}">Open Mendo library</a>
  <a class="btn btn-outline" href="https://authichain.com/m/mendo">LT-63 licensing microsite</a>
</div>
`;
  return shell({
    title: "StrainChain Passport · $49",
    description: "One-cultivar genetics passport. CoA-backed chemistry; LT-63 gap documented.",
    canonical: "https://strainchain.io/passport",
    body,
  });
}

/** Returns a Response if this worker owns the path; otherwise null. */
export function tryHandleGeneticsRoutes(request: Request): Response | null {
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/+$/, "") || "/";

  if (p === "/genetics") {
    return new Response(geneticsIndex(), { headers: HTML_SECURITY_HEADERS });
  }
  if (p === `/genetics/${MENDO.farmSlug}`) {
    return new Response(farmPage(), { headers: HTML_SECURITY_HEADERS });
  }
  if (p === "/passport") {
    return new Response(passportIndex(), { headers: HTML_SECURITY_HEADERS });
  }
  if (p.startsWith("/passport/")) {
    return Response.redirect(new URL("/passport", url).toString(), 302);
  }
  return null;
}
