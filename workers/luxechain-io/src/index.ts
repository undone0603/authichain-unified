/**
 * luxechain.io microsite — retired to a permanent redirect.
 *
 * The luxechain.io domain no longer resolves (it is not a zone in this
 * Cloudflare account), so this Worker was only reachable on workers.dev, with a
 * canonical pointing at the dead domain. Its landing copy also claimed
 * customers, integrations and SLAs that nothing in this repository backs
 * (charter truth rule). Every request now 301s to the matching AuthiChain
 * industry page, which keeps any inbound links useful at $0.
 *
 * The previous landing page is in git history if the domain is re-registered.
 */
const TARGET = "https://authichain.com/p/blockchain-qr-code-for-luxury";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", worker: "luxechain-io", mode: "redirect", target: TARGET });
    }
    if (url.pathname === "/robots.txt") {
      return new Response("User-agent: *\nAllow: /\n", {
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" },
      });
    }
    const target = new URL(TARGET);
    url.searchParams.forEach((v, k) => {
      if (k.startsWith("utm_")) target.searchParams.set(k, v);
    });
    if (!target.searchParams.has("utm_source")) target.searchParams.set("utm_source", "luxechain");
    return Response.redirect(target.toString(), 301);
  },
};
