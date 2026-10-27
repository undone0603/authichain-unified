// portal-template.ts
// Self-contained Living QR destination page for any PORTAL_MODES key.
// Includes viral footer. Escapes all dynamic strings. No external deps.

import { PORTAL_MODES, type PortalModeKey } from "./modes";

export interface PortalData {
  modeId: PortalModeKey;
  productName?: string;
  productPhotoUrl?: string;
  sealStatus?: "Verified" | "Pending" | "Flagged";
  timeline?: { label: string; timestamp: string }[];
  sku?: string;
  scarcity?: number;
  countdownIso?: string;
  coaSummary?: string;
  brandAccent?: string;
  verifyHref?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderViralFooter(modeId: string): string {
  const safeMode = encodeURIComponent(modeId || "stellar_seal_certificate");
  const href = `https://authichain.com/generate?mode=${safeMode}&utm_source=qr_footer&utm_medium=scan`;
  return `<div class="qron-footer" style="font-size:12px;color:#888;text-align:center;margin-top:2rem;padding:1rem 0;border-top:1px solid #27272a;">
  Create your own Living QR — <a href="${href}" rel="noopener" style="color:#10A37F;text-decoration:none;font-weight:600;">free to try</a>
</div>`;
}

export function renderPortalHtml(data: PortalData): string {
  const mode = PORTAL_MODES[data.modeId] ?? PORTAL_MODES.stellar_seal_certificate;
  const accent = data.brandAccent ?? "#10A37F";
  const status = data.sealStatus ?? "Pending";
  const statusColor =
    status === "Verified" ? "#10A37F" : status === "Flagged" ? "#EF4444" : "#F59E0B";
  const verifyHref = data.verifyHref ?? "/verify";
  const title = escapeHtml(data.productName ?? mode.name);

  const photo = data.productPhotoUrl
    ? `<img src="${escapeHtml(data.productPhotoUrl)}" alt="${title}" style="width:100%;max-width:480px;border-radius:12px;margin:1.5rem auto;display:block;object-fit:cover;" />`
    : "";

  const timelineHtml =
    data.timeline?.length
      ? `<section style="margin-top:1.75rem;">
          <h3 style="font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#a3a3a3;margin:0 0 0.5rem;">Chain of custody</h3>
          <ul style="list-style:none;padding:0;margin:0;font-size:13px;color:#d4d4d8;">
            ${data.timeline
              .map(
                (t) =>
                  `<li style="padding:0.5rem 0;border-bottom:1px solid #27272a;display:flex;justify-content:space-between;gap:1rem;">
                    <span>${escapeHtml(t.label)}</span>
                    <span style="color:#737373;white-space:nowrap;">${escapeHtml(t.timestamp)}</span>
                  </li>`
              )
              .join("")}
          </ul>
        </section>`
      : "";

  const scarcityHtml =
    data.modeId === "limited_edition_drop" && typeof data.scarcity === "number"
      ? `<div style="margin-top:1rem;font-size:14px;color:#d4d4d8;">Scarcity remaining: <strong style="color:${accent};">${Math.max(0, Math.min(100, data.scarcity))}%</strong></div>`
      : "";

  const countdownHtml =
    data.modeId === "limited_edition_drop" && data.countdownIso
      ? `<div id="countdown" data-iso="${escapeHtml(data.countdownIso)}" style="margin-top:0.75rem;font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${accent};"></div>
         <script>
           (function(){
             const el=document.getElementById("countdown");
             if(!el)return;
             const end=new Date(el.dataset.iso).getTime();
             function tick(){
               const d=Math.max(0,end-Date.now());
               const h=Math.floor(d/3600000);
               const m=Math.floor((d%3600000)/60000);
               const s=Math.floor((d%60000)/1000);
               el.textContent=String(h).padStart(2,"0")+"h "+String(m).padStart(2,"0")+"m "+String(s).padStart(2,"0")+"s";
               if(d>0)setTimeout(tick,1000);
             }
             tick();
           })();
         </script>`
      : "";

  const coaHtml =
    data.modeId === "strainchain_coa_jar" && data.coaSummary
      ? `<section style="margin-top:1.25rem;padding:1rem;background:#141416;border-radius:10px;font-size:13px;color:#e5e5e5;border:1px solid #27272a;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#a3a3a3;margin-bottom:0.4rem;">COA summary</div>
          ${escapeHtml(data.coaSummary)}
        </section>`
      : "";

  const batchHtml =
    data.modeId === "batch_product_verification"
      ? `<section style="margin-top:1.25rem;font-size:13px;color:#d4d4d8;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#a3a3a3;margin-bottom:0.4rem;">Batch sheet</div>
          SKU: ${escapeHtml(data.sku ?? "—")} · Status chips: Verified / Pending / Flagged
        </section>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title} — QRON</title>
  <meta name="robots" content="noindex" />
  <style>
    *,*::before,*::after{box-sizing:border-box;}
    body{margin:0;background:#0c0c0d;color:#f2efe8;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased;}
    .wrap{max-width:640px;margin:0 auto;padding:2rem 1.25rem 3rem;}
    h1{font-size:1.75rem;font-weight:800;letter-spacing:-0.025em;margin:0.5rem 0 0.25rem;line-height:1.15;}
    .sub{color:#a3a3a3;font-size:15px;margin:0;}
    .badge{display:inline-block;padding:0.3rem 0.85rem;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0.02em;background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}55;}
    .cta{display:inline-block;margin-top:1.75rem;padding:0.85rem 1.75rem;background:${accent};color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:0.01em;}
    .cta:hover{filter:brightness(1.08);}
    .disclaimer{font-size:11px;color:#737373;margin-top:2rem;line-height:1.45;}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="badge">${escapeHtml(status)}</div>
    <h1>${title}</h1>
    <p class="sub">${escapeHtml(mode.visualConcept)}</p>
    ${photo}
    ${timelineHtml}
    ${scarcityHtml}
    ${countdownHtml}
    ${coaHtml}
    ${batchHtml}
    <a class="cta" href="${escapeHtml(verifyHref)}">Verify</a>
    <p class="disclaimer">A scannable QR is not an authenticity proof. Signed verification is in development. This page displays claims you control.</p>
    ${renderViralFooter(data.modeId)}
  </div>
</body>
</html>`;
}
