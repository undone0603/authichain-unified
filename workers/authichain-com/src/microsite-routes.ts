/**
 * Targeted money-path microsites.
 *
 * HTML lives in content/microsites/<slug>/index.html and is embedded by
 * scripts/sync-microsite-packs.mjs. /p is already the product-passport
 * prefix (APP_WORKER). These pages are /m/<slug> on authichain-com —
 * the worker that actually serves authichain.com.
 */
import { checkoutEmailFormHtml } from "../../../src/lib/checkout-email";
import { MICROSITE_HTML } from "./microsite-packs.ts";

export const PASSPORT_CHECKOUT =
  "https://authichain.com/api/checkout/plan/strainchain_passport";
export const DPP_CHECKOUT = "https://authichain.com/api/checkout/dpp";

export type MicrositePackId = "mendo" | "trumark" | "musa" | "strainchain";

export interface MicrositeDef {
  pack: MicrositePackId;
  canonicalPath: string;
  aliases: string[];
  hosts: string[];
}

export const MICROSITES: Record<string, MicrositeDef> = {
  mendo: {
    pack: "mendo",
    canonicalPath: "/m/mendo",
    aliases: ["/m/realthcv", "/m/lt-63"],
    hosts: ["mendo.authichain.com", "realthcv.authichain.com"],
  },
  trumark: {
    pack: "trumark",
    canonicalPath: "/m/trumark",
    aliases: [],
    hosts: ["trumark.authichain.com"],
  },
  musa: {
    pack: "musa",
    canonicalPath: "/m/musa",
    aliases: ["/m/made-in-america"],
    hosts: ["musa.authichain.com"],
  },
  strainchain: {
    pack: "strainchain",
    canonicalPath: "/m/strainchain",
    aliases: [],
    hosts: ["strainchain.authichain.com"],
  },
};

const PATH_TO_PACK = new Map<string, MicrositePackId>();
const HOST_TO_PACK = new Map<string, MicrositePackId>();

for (const def of Object.values(MICROSITES)) {
  PATH_TO_PACK.set(def.canonicalPath, def.pack);
  for (const alias of def.aliases) PATH_TO_PACK.set(alias, def.pack);
  for (const host of def.hosts) HOST_TO_PACK.set(host, def.pack);
}

export function micrositeSitemapUrls(): string[] {
  return [
    "https://authichain.com/m",
    ...Object.values(MICROSITES).map(
      def => `https://authichain.com${def.canonicalPath}`
    ),
  ];
}

export function resolveMicrositePack(
  pathname: string,
  hostname?: string
): MicrositePackId | null {
  if (hostname) {
    const hostPack = HOST_TO_PACK.get(hostname.toLowerCase());
    if (hostPack) return hostPack;
  }
  const p = pathname.replace(/\/+$/, "") || "/";
  return PATH_TO_PACK.get(p) ?? null;
}

const HTML_HEADERS: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=300",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data: https:; frame-ancestors 'none'",
};

function renderHub(): string {
  const cards = Object.values(MICROSITES)
    .map(def => {
      const title =
        def.pack === "mendo"
          ? "Mendo / RealTHCV / LT-63"
          : def.pack === "trumark"
            ? "TruMark seal"
            : def.pack === "musa"
              ? "Made in America"
              : "StrainChain genetics hub";
      const cta =
        def.pack === "musa" ? "DPP checkout — $299" : "Passport checkout — $49";
      const action =
        def.pack === "musa"
          ? "/api/checkout/dpp"
          : "/api/checkout/plan/strainchain_passport";
      return `<article class="card"><h2><a href="${def.canonicalPath}">${title}</a></h2>${checkoutEmailFormHtml(
        {
          action,
          label: cta,
          inputId: `hub-${def.pack}-email`,
          formId: `hub-${def.pack}-checkout`,
          extraClass: "hub-checkout",
        }
      )}</article>`;
    })
    .join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Money-path microsites | AuthiChain</title>
<meta name="description" content="Targeted AuthiChain microsites. Passport $49 and EU DPP Readiness $299. Self-serve — no call.">
<link rel="canonical" href="https://authichain.com/m">
<style>
body{font-family:"Plus Jakarta Sans",system-ui,sans-serif;margin:0;color:#0f172a;background:#fff}
.wrap{width:min(880px,calc(100% - 32px));margin:0 auto;padding:48px 0}
a{color:#4F46E5}
.card{border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:12px 0}
.btn{display:inline-block;margin-top:8px;font-weight:700;text-decoration:none;border:0;cursor:pointer;font:inherit;padding:12px 20px;border-radius:8px;background:#4F46E5;color:#fff}
.checkout-email-form{display:flex;flex-direction:column;gap:8px;max-width:22rem;margin:1rem 0 0;text-align:left}
.checkout-email-label{display:flex;flex-direction:column;gap:6px;font-size:.85rem;font-weight:600}
.checkout-email-form input[type=email]{padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}
.checkout-email-hint{font-size:.82rem;opacity:.8;margin:0}
footer{color:#64748b;font-size:.85rem;margin-top:32px}
</style>
</head>
<body>
<main class="wrap">
  <p>Targeted microsites · async only</p>
  <h1>Checkout is the next click.</h1>
  <p>Passport $49 and EU DPP Readiness $299. No call booking. AuthiChain is a brand; the SAM legal entity is ZACHARY KIETZMAN.</p>
  ${cards}
  ${checkoutEmailFormHtml({
    action: "/api/checkout/plan/strainchain_passport",
    label: "Passport checkout — $49",
    inputId: "hub-footer-passport-email",
    formId: "hub-footer-passport-checkout",
  })}
  ${checkoutEmailFormHtml({
    action: "/api/checkout/dpp",
    label: "DPP checkout — $299",
    inputId: "hub-footer-dpp-email",
    formId: "hub-footer-dpp-checkout",
  })}
  <footer>ZACHARY KIETZMAN · brand AuthiChain · not a corporation.</footer>
</main>
</body>
</html>`;
}

export function tryHandleMicrosite(request: Request): Response | null {
  const url = new URL(request.url);
  const hostPack = HOST_TO_PACK.get(url.hostname.toLowerCase());
  if (hostPack) {
    const html = MICROSITE_HTML[hostPack];
    if (!html) return null;
    return new Response(html, { headers: HTML_HEADERS });
  }

  const p = url.pathname.replace(/\/+$/, "") || "/";
  if (p === "/m") {
    return new Response(renderHub(), { headers: HTML_HEADERS });
  }
  const pack = PATH_TO_PACK.get(p);
  if (!pack) return null;
  const html = MICROSITE_HTML[pack];
  if (!html) return null;
  return new Response(html, { headers: HTML_HEADERS });
}
