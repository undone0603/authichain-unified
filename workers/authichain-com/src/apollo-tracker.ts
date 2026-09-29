/**
 * Apollo.io website visitor tracker for authichain.com.
 * appId is the server-assigned referrer id from Manage Tracked Domain
 * (6ab2b3b358b37e000c06b0fa), not a guessed one.
 *
 * Also rewrites the homepage Made in America card so it cannot sell the
 * $299 DPP SKU. index.ts still hardcodes that form; this wrapper is the
 * HTML egress path every GET already uses.
 */
export const APOLLO_APP_ID = "6ab2b3b358b37e000c06b0fa";

export const APOLLO_SCRIPT_SRC =
  "https://assets.apollo.io/micro/website-tracker/tracker.iife.js";

const SKIP_PREFIXES = ["/api", "/telegram", "/miniapp"];

const MUSA_CHECKOUT = "https://authichain.com/checkout/musa_claim_file";
const DPP_CHECKOUT = "https://authichain.com/checkout/dpp_readiness";

export const APOLLO_SNIPPET = `<script>
function initApollo(){
  var n=Math.random().toString(36).substring(7);
  var o=document.createElement("script");
  o.src="${APOLLO_SCRIPT_SRC}?nocache="+n;
  o.async=true;
  o.defer=true;
  o.onload=function(){
    if (window.trackingFunctions && window.trackingFunctions.onLoad) {
      window.trackingFunctions.onLoad({appId:"${APOLLO_APP_ID}"});
    }
  };
  document.head.appendChild(o);
}
initApollo();
</script>`;

export function cspAllowApollo(csp: string): string {
  if (csp.includes("assets.apollo.io")) return csp;
  return csp.replace(
    "script-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' https://assets.apollo.io"
  );
}

/** Homepage origin card only. Do not touch other DPP forms. */
export function rewriteHomepageMusaCard(html: string): string {
  const marker = 'id="origin-musa-checkout"';
  const formStart = html.indexOf(marker);
  if (formStart < 0) return html;

  const tagStart = html.lastIndexOf("<form", formStart);
  const formEnd = html.indexOf("</form>", formStart);
  if (tagStart < 0 || formEnd < 0) return html;

  const formClose = formEnd + "</form>".length;
  let form = html.slice(tagStart, formClose);
  form = form
    .split(DPP_CHECKOUT)
    .join(MUSA_CHECKOUT)
    .replace(
      "Start EU DPP Readiness Audit — $299",
      "Start my claim file — $299"
    );

  let next = html.slice(0, tagStart) + form + html.slice(formClose);

  const after = tagStart + form.length;
  const nextArticle = next.indexOf("<article", after);
  const windowEnd = nextArticle >= 0 ? nextArticle : Math.min(next.length, after + 900);
  const window = next
    .slice(after, windowEnd)
    .split(DPP_CHECKOUT)
    .join(MUSA_CHECKOUT);
  next = next.slice(0, after) + window + next.slice(windowEnd);

  return next.replace(
    "start today with the $299 EU DPP Readiness Audit",
    "start today with the $299 Made in USA Claim File"
  );
}

export async function withApolloTracker(
  request: Request,
  response: Response
): Promise<Response> {
  if (request.method !== "GET") return response;
  const path = new URL(request.url).pathname;
  if (SKIP_PREFIXES.some(p => path === p || path.startsWith(p + "/"))) {
    return response;
  }
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("text/html")) return response;
  let html = await response.text();
  if (path === "/" || path === "") {
    html = rewriteHomepageMusaCard(html);
  }
  if (html.includes("assets.apollo.io")) {
    return new Response(html, response);
  }
  const next = html.includes("</head>")
    ? html.replace("</head>", `${APOLLO_SNIPPET}</head>`)
    : html;
  const headers = new Headers(response.headers);
  const csp = headers.get("content-security-policy");
  if (csp) headers.set("content-security-policy", cspAllowApollo(csp));
  return new Response(next, { status: response.status, headers });
}
