/**
 * HTML egress wrapper for authichain.com.
 *
 * The Apollo.io website visitor tracker that used to be injected here was
 * removed from every authichain.com page (AE-20261002-CFD-09): no third-party
 * visitor-tracking script and no CSP allowance for assets.apollo.io.
 *
 * Still rewrites the homepage Made in America card so it cannot sell the
 * $299 DPP SKU. index.ts still hardcodes that form; this wrapper is the
 * HTML egress path every GET already uses. That behaviour is unchanged.
 */
const SKIP_PREFIXES = ["/api", "/telegram", "/miniapp"];

const MUSA_CHECKOUT = "https://authichain.com/checkout/musa_claim_file";
const DPP_CHECKOUT = "https://authichain.com/checkout/dpp_readiness";

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
  const windowEnd =
    nextArticle >= 0 ? nextArticle : Math.min(next.length, after + 900);
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

export async function withHtmlEgress(
  request: Request,
  response: Response
): Promise<Response> {
  if (request.method !== "GET") return response;
  const path = new URL(request.url).pathname;
  if (SKIP_PREFIXES.some(p => path === p || path.startsWith(p + "/"))) {
    return response;
  }
  if (path !== "/" && path !== "") return response;
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("text/html")) return response;
  const html = rewriteHomepageMusaCard(await response.text());
  return new Response(html, response);
}
