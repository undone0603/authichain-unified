/**
 * Apollo.io website visitor tracker for authichain.com.
 * appId is the server-assigned referrer id from Manage Tracked Domain
 * (6ab2b3b358b37e000c06b0fa), not a guessed one.
 */
export const APOLLO_APP_ID = "6ab2b3b358b37e000c06b0fa";

export const APOLLO_SCRIPT_SRC =
  "https://assets.apollo.io/micro/website-tracker/tracker.iife.js";

const SKIP_PREFIXES = ["/api", "/telegram", "/miniapp"];

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
  const html = await response.text();
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
