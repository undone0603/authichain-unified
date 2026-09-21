/**
 * Public genetics surfaces for StrainChain / AuthiChain.
 *
 * Why this lives on the apex worker: src/app/genetics/* is Next RSC that is
 * not deployed on authichain-edge-router. strainchain.io proxies /genetics
 * and /passport to APP_ORIGIN=https://authichain.com; without a handler here
 * those paths returned AuthiChain-branded 404s (2026-09-20).
 *
 * Totals come from src/lib/genetics.ts (derived at render). Do not hardcode
 * a stored peak. LT-63 has no panel — show "—", never 0.00%.
 */

import {
  DECARB,
  getCultivar,
  getDossier,
  listFarms,
  toSlug,
  type CultivarView,
  type DerivedCertificate,
  type Provenance,
} from "../../../src/lib/genetics";

const HTML_SECURITY_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=300",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data: https:; frame-ancestors 'none'",
};

const CHECKOUT =
  "https://authichain.com/api/checkout/plan/strainchain_passport";
const MENDO_MICRO = "https://authichain.com/m/mendo";

const PROVENANCE_LABEL: Record<Provenance, string> = {
  confirmed_in_writing: "Confirmed in writing",
  inferred: "Inferred",
  claimed: "Claimed",
  none: "No evidence on file",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pct(n: number | null | undefined, dp = 3): string {
  return n == null ? "—" : `${n.toFixed(dp)}%`;
}

function verificationBadge(cert: DerivedCertificate): string {
  if (cert.derived.mismatch) {
    return '<span class="badge warn">Panel incomplete</span>';
  }
  if (cert.derived.totalThcvPct == null) {
    return '<span class="badge">Totals only</span>';
  }
  return '<span class="badge ok">Recomputed</span>';
}

function shell(opts: {
  title: string;
  description: string;
  canonical: string;
  body: string;
  updated: string;
}): string {
  const { title, description, canonical, body, updated } = opts;
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
:root{--bg:#030c04;--card:#071209;--border:#0f2b12;--green:#10b981;--text:#e2e8f0;--muted:#64748b;--warn:#f87171;--viz:#38bdf8}
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
.n{text-align:right;font-variant-numeric:tabular-nums}
.cta{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.25rem}
.btn{display:inline-block;padding:.75rem 1.25rem;border-radius:.5rem;font-weight:700;text-decoration:none}
.btn-primary{background:var(--green);color:#03120a}
.btn-primary:hover{text-decoration:none;filter:brightness(1.05)}
.btn-outline{border:1px solid var(--border);color:var(--text)}
.btn-outline:hover{border-color:var(--green);text-decoration:none}
footer{margin-top:2.5rem;padding-top:1.25rem;border-top:1px solid var(--border);color:var(--muted);font-size:.8rem}
code{font-size:.85em;background:rgba(148,163,184,.1);padding:.1rem .35rem;border-radius:.25rem}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.commit{border-color:#115e59;background:#042f2e}
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
  Totals are recomputed from the source panel at page load (decarb ${DECARB}), never transcribed. Last reconciled ${esc(updated)}. LT-63 has no panel yet.
</footer>
</div>
</body>
</html>`;
}

function checkoutCard(): string {
  return `<div class="card">
  <h2>StrainChain Passport — $49</h2>
  <p>One cultivar genetics passport: CoA chemistry with totals derived at render, lineage edges tagged by evidence, public verify URL. LT-63 still has no panel — Passport publishes the first verified lot when it arrives.</p>
  <div class="cta">
    <a class="btn btn-primary" href="${CHECKOUT}">Passport checkout — $49</a>
    <a class="btn btn-outline" href="${MENDO_MICRO}">LT-63 licensing microsite</a>
    <a class="btn btn-outline" href="https://strainchain.io/onboard">Farm onboard</a>
  </div>
</div>`;
}

function neverBreed(): string {
  return `<div class="card commit">
  <h2>StrainChain does not breed</h2>
  <p>We do not breed, sell, license, or take any option on the genetics recorded here. This record exists so the breeder can prove what they held and when. Export or revoke at any time.</p>
</div>`;
}

function farmPage(farmSlug: string): string | null {
  const d = getDossier(farmSlug);
  if (!d) return null;
  const views = d.cultivars
    .map(c => getCultivar(farmSlug, toSlug(c.id)))
    .filter((v): v is CultivarView => v != null)
    .sort((a, b) => (b.peakThcvPct ?? -1) - (a.peakThcvPct ?? -1));

  const rows = views
    .map(v => {
      const peak = pct(v.peakThcvPct);
      const coa =
        v.certificates.length === 0
          ? '<span class="badge warn">0 CoA</span>'
          : `<span class="badge ok">${v.certificates.length} CoA</span>`;
      const href = `/genetics/${esc(farmSlug)}/${esc(v.slug)}`;
      const note = v.cultivar.description ?? v.cultivar.role;
      return `<tr><td><strong><a href="${href}">${esc(v.cultivar.id)}</a></strong><br><span style="color:var(--muted);font-size:.8rem">${esc(v.cultivar.role)}</span></td><td class="n">${peak}</td><td>${coa}</td><td style="color:var(--muted)">${esc(note)}</td></tr>`;
    })
    .join("");

  const body = `
<span class="badge">Genetics library</span>
<h1>${esc(d.farm.name)}</h1>
<p class="lede">Public cultivar index. Every peak THCV on this page is recomputed from the source CoA panel, not copied from a stored headline. This is a breeder-owned defensive record — not AuthiChain claiming the genetics as inventory.</p>

<div class="card gap">
  <h2>Commercial gap (honest)</h2>
  <p>LT-63 is the licensable cultivar and has no CoA / no passport yet. Do not treat any page as a live LT-63 seal.</p>
  <p style="margin-top:.5rem">Mike confirmed in writing (2026-09-10): VT-26 × VT-41 produced LT males LT-11 / LT-17 / LT-57 and females LT-35 / LT-63. LT-35 retained for breeding; LT-63 offered for licensing.</p>
</div>

<div class="card">
  <h2>Cultivars on file</h2>
  <p>${d.certificates.length} distinct SC Labs CoAs in the committed library. Open a cultivar to see CoA ids, derived totals, and lineage provenance.</p>
  <table>
    <thead><tr><th>Cultivar</th><th class="n">Peak total THCV</th><th>CoAs</th><th>Note</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>

<div class="card">
  <h2>Open questions</h2>
  <p>${d.openQuestions.length} items the lab data cannot settle, recorded rather than guessed.</p>
  ${d.openQuestions
    .map(
      q =>
        `<p style="margin-top:.65rem"><strong style="color:var(--text)">${esc(q.question)}</strong><br><span style="color:var(--muted)">Blocks: ${esc(q.blocks)}</span></p>`
    )
    .join("")}
</div>

<div class="card">
  <h2>Scope of this record</h2>
  <p>${esc(d.provenanceWarning)}</p>
</div>
${neverBreed()}
${checkoutCard()}
`;

  return shell({
    title: `${d.farm.name} genetics · StrainChain`,
    description: `VT/LT THCV genetics library for ${d.farm.name}. CoA-backed where panels exist; LT-63 licensing gap stated plainly. Totals derived at render.`,
    canonical: `https://strainchain.io/genetics/${farmSlug}`,
    body,
    updated: d.updated,
  });
}

function cultivarPage(farmSlug: string, cultivarSlug: string): string | null {
  const view = getCultivar(farmSlug, cultivarSlug);
  const d = getDossier(farmSlug);
  if (!view || !d) return null;
  const { cultivar: c, certificates } = view;
  const empty = certificates.length === 0;

  const ledgerRows = empty
    ? `<tr><td colspan="7" style="color:var(--warn)">No CoA in library. Passport cannot publish chemistry until a panel arrives. Sibling chemistry is not a substitute.</td></tr>`
    : certificates
        .map(cert => {
          const thcv = pct(cert.derived.totalThcvPct);
          const thc = pct(cert.derived.totalThcPct);
          const ratio =
            cert.derived.ratio == null && cert.ratio_thcv_thc == null
              ? "—"
              : `${(cert.derived.ratio ?? cert.ratio_thcv_thc).toFixed(2)}:1`;
          return `<tr>
            <td>${esc(cert.sample_name_on_coa)}</td>
            <td class="mono">${esc(cert.coa_id)}</td>
            <td class="mono">${esc(cert.collected)}</td>
            <td class="n">${thcv}</td>
            <td class="n">${thc}</td>
            <td class="n">${ratio}</td>
            <td>${verificationBadge(cert)}</td>
          </tr>`;
        })
        .join("");

  const mismatchNotes = certificates
    .filter(cert => cert.derived.mismatch)
    .map(cert => {
      const m = cert.derived.mismatch!;
      return `<p style="margin-top:.65rem"><strong style="color:var(--text)">${esc(cert.sample_name_on_coa)}</strong>: published ${pct(m.published, 2)} total ${esc(m.field.toUpperCase())}, derived ${pct(m.derived)}. We show the discrepancy rather than picking a side. Pending recovery of the full panel from <code>${esc(cert.coa_id)}</code>.</p>`;
    })
    .join("");

  const parentage = [...view.parentEdges, ...view.childEdges]
    .map(e => {
      const parents = e.parents ?? (e.parent ? [e.parent] : []);
      const label = e.child === c.id ? "Parentage" : "Descendant";
      const others = label === "Parentage" ? parents : [e.child];
      const links = others
        .map(
          o =>
            `<a href="/genetics/${esc(farmSlug)}/${esc(toSlug(o))}">${esc(o)}</a>`
        )
        .join(" × ");
      return `<p style="margin-top:.65rem"><span class="badge">${esc(label)}</span> <strong style="color:var(--text)">${others.length ? links : "Unknown"}</strong> · ${esc(PROVENANCE_LABEL[e.provenance])}<br><span style="color:var(--muted)">${esc(e.evidence)}</span></p>`;
    })
    .join("");

  const awards = (c.awards ?? [])
    .map(
      a =>
        `<p style="margin-top:.65rem"><strong style="color:var(--text)">${esc(a.name)} (${a.year})</strong> · ${esc(PROVENANCE_LABEL[a.provenance])}<br><span style="color:var(--muted)">${esc(a.evidence)}</span></p>`
    )
    .join("");

  const questions = view.openQuestions
    .map(
      q =>
        `<p style="margin-top:.65rem"><strong style="color:var(--text)">${esc(q.question)}</strong><br><span style="color:var(--muted)">Blocks: ${esc(q.blocks)}</span></p>`
    )
    .join("");

  const terpCert = certificates.find(x => x.terpenes_pct);
  const terpRows = terpCert?.terpenes_pct
    ? Object.entries(terpCert.terpenes_pct)
        .sort((a, b) => b[1] - a[1])
        .map(
          ([name, value]) =>
            `<tr><td>${esc(name.replace(/_/g, "-"))}</td><td class="n">${value.toFixed(3)}%</td></tr>`
        )
        .join("")
    : "";

  const gap = empty
    ? `<div class="card gap">
  <h2>LT-63 status</h2>
  <p>No CoA in library yet, so there is no live seal and no chemistry figure for this cultivar. Do not quote a stored LT-63 total. The $49 Passport is the instrument that publishes the first verified lot when the panel arrives.</p>
</div>`
    : "";

  const body = `
<span class="badge">Genetics passport</span>
<p class="lede" style="margin-bottom:.35rem"><a href="/genetics/${esc(farmSlug)}">${esc(d.farm.name)}</a></p>
<h1>${esc(c.id)}</h1>
<p class="lede">${esc(c.description ?? c.role)}. Peak total THCV ${pct(view.peakThcvPct)} · ${certificates.length} certificate${certificates.length === 1 ? "" : "s"} · rank ${view.thcvRank} of ${view.totalCultivars}. Figures above with a panel are recomputed at load using decarb ${DECARB}.</p>
${gap}
<div class="card">
  <h2>Certificate ledger</h2>
  <p>Newest first. Totals in this table are derived from the raw panel when the compounds are on file.</p>
  <table>
    <thead><tr><th>Sample</th><th>CoA</th><th>Collected</th><th class="n">Total THCV</th><th class="n">Total THC</th><th class="n">Ratio</th><th>Verification</th></tr></thead>
    <tbody>${ledgerRows}</tbody>
  </table>
  ${mismatchNotes}
</div>
${
  terpRows
    ? `<div class="card">
  <h2>Terpene profile</h2>
  <p>From <code>${esc(terpCert!.coa_id)}</code>, collected ${esc(terpCert!.collected)}. ${terpCert!.terpenes_tested_count ?? Object.keys(terpCert!.terpenes_pct!).length} terpenoids tested · ${pct(terpCert!.terpenes_total_pct)} total.</p>
  <table><thead><tr><th>Compound</th><th class="n">%</th></tr></thead><tbody>${terpRows}</tbody></table>
</div>`
    : ""
}
<div class="card">
  <h2>Lineage</h2>
  <p>Each relation carries how it is known. An inferred edge is never shown as a confirmed one.</p>
  ${parentage || "<p>No lineage relations recorded for this cultivar.</p>"}
</div>
${awards ? `<div class="card"><h2>Recognition</h2>${awards}</div>` : ""}
${
  questions
    ? `<div class="card"><h2>Open questions</h2><p>Recorded rather than guessed.</p>${questions}</div>`
    : ""
}
${neverBreed()}
${checkoutCard()}
`;

  return shell({
    title: `${c.id} · ${d.farm.name} · StrainChain`,
    description: empty
      ? `${c.id} is recorded for licensing and has no CoA yet. No chemistry figure is published.`
      : `Genetics passport for ${c.id} — ${certificates.length} CoA(s) with totals recomputed from the source panel.`,
    canonical: `https://strainchain.io/genetics/${farmSlug}/${cultivarSlug}`,
    body,
    updated: d.updated,
  });
}

function geneticsIndex(): string {
  const farms = listFarms()
    .map(slug => {
      const d = getDossier(slug);
      if (!d) return "";
      return `<div class="card">
  <h2><a href="/genetics/${esc(slug)}">${esc(d.farm.name)}</a></h2>
  <p>${d.certificates.length} CoAs on file · ${d.cultivars.length} cultivars · LT-63 licensing cultivar still missing a panel.</p>
</div>`;
    })
    .join("");

  const body = `
<span class="badge">Genetics</span>
<h1>StrainChain genetics libraries</h1>
<p class="lede">Public, CoA-reconciled cultivar indexes. Farms keep ownership; AuthiChain publishes the defensive record. Totals are derived at render.</p>
${farms}
<div class="cta">
  <a class="btn btn-primary" href="${CHECKOUT}">Passport checkout — $49</a>
  <a class="btn btn-outline" href="${MENDO_MICRO}">Mendo / LT-63 microsite</a>
</div>
`;
  const d = getDossier("mendo-love-farms");
  return shell({
    title: "Genetics libraries · StrainChain",
    description: "Public genetics passport libraries on StrainChain.",
    canonical: "https://strainchain.io/genetics",
    body,
    updated: d?.updated ?? "",
  });
}

function passportIndex(): string {
  const d = getDossier("mendo-love-farms");
  const body = `
<span class="badge">Passport</span>
<h1>StrainChain Passport</h1>
<p class="lede">One-cultivar genetics passport — $49. Publish CoA-backed chemistry and provenance-tagged lineage for a single cultivar.</p>
<div class="card gap">
  <h2>LT-63 status</h2>
  <p>The Mendo Love Farms licensing cultivar (LT-63) has <strong style="color:var(--text)">no CoA in library yet</strong>, so there is no live passport URL for it. When Mike sends the panel, Passport is the instrument to publish it. See the empty <a href="/genetics/mendo-love-farms/lt-63">LT-63 dossier</a>.</p>
</div>
<div class="card">
  <h2>See the library</h2>
  <p>Cultivars that already have panels are linked from the farm index. Totals there are recomputed, not transcribed.</p>
  <p style="margin-top:.5rem"><a href="/genetics/mendo-love-farms">${esc(d?.farm.name ?? "Mendo Love Farms")} genetics →</a></p>
</div>
<div class="cta">
  <a class="btn btn-primary" href="${CHECKOUT}">Passport checkout — $49</a>
  <a class="btn btn-outline" href="/genetics/mendo-love-farms">Open Mendo library</a>
  <a class="btn btn-outline" href="${MENDO_MICRO}">LT-63 licensing microsite</a>
</div>
`;
  return shell({
    title: "StrainChain Passport · $49",
    description:
      "One-cultivar genetics passport. CoA-backed chemistry; LT-63 gap documented.",
    canonical: "https://strainchain.io/passport",
    body,
    updated: d?.updated ?? "",
  });
}

function html(status: number, body: string): Response {
  return new Response(body, { status, headers: HTML_SECURITY_HEADERS });
}

/** Returns a Response if this worker owns the path; otherwise null. */
export function tryHandleGeneticsRoutes(request: Request): Response | null {
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/+$/, "") || "/";
  const parts = p.split("/").filter(Boolean);

  if (p === "/genetics") {
    return html(200, geneticsIndex());
  }
  if (p === "/passport") {
    return html(200, passportIndex());
  }
  if (p.startsWith("/passport/")) {
    return Response.redirect(new URL("/passport", url).toString(), 302);
  }
  if (parts[0] === "genetics" && parts.length === 2) {
    const page = farmPage(parts[1]);
    return page ? html(200, page) : html(404, geneticsIndex());
  }
  if (parts[0] === "genetics" && parts.length === 3) {
    const page = cultivarPage(parts[1], parts[2]);
    if (!page) {
      const farm = farmPage(parts[1]);
      return farm ? html(404, farm) : html(404, geneticsIndex());
    }
    return html(200, page);
  }
  return null;
}
