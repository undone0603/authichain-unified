/**
 * Reserved path. Not a certificate number.
 *
 * authichain.com owns /verify/* and proxies it to the edge router, which
 * treats the path segment as a registry id. That made /verify/manufacturer
 * a 404 "No record found" for the id "manufacturer".
 * Answer it here, before APP_PREFIXES. The history reader is a separate
 * route and may be absent. This page does not invent a role.
 */

export function isVerifyManufacturerPath(pathname: string): boolean {
  const bare = pathname.replace(/\/+$/, "") || "/";
  return bare.toLowerCase() === "/verify/manufacturer";
}

export function renderVerifyManufacturerPage(): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Manufacturer role history | AuthiChain</title>
<meta name="description" content="This path is not a certificate number. It does not look up a product and it does not grant a manufacturer role.">
<link rel="canonical" href="https://authichain.com/verify/manufacturer">
<meta name="robots" content="noindex">
</head><body>
<main>
<h1>Manufacturer role history</h1>
<p>This path is not a certificate number. Nothing was looked up in the product registry.</p>
<p>RoleGranted and RoleRevoked events for one address are read from <code>GET /api/manufacturer-status/{address}/history</code>. This page does not call that reader and does not invent a role when the reader is absent.</p>
<p>An empty history is not proof that an address holds no role. A role event is not proof that a product is genuine. This page does not sell a role.</p>
<p><a href="/verify">Look up a certificate</a></p>
</main>
</body></html>`;
}
