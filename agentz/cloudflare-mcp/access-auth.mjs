/**
 * Verify Cloudflare Access user assertions before allowing OAuth-backed chat reads.
 * This intentionally does not authenticate with a shared MCP bearer token.
 * Fail closed if the resource audience/issuer/owner are not configured.
 */
const ACCESS_CERTS_PATH = "/cdn-cgi/access/certs";

export function accessChatConfigured(env) {
  return Boolean(
    env.AGENTZ_ACCESS_ISSUER &&
    env.AGENTZ_ACCESS_AUD &&
    env.AGENTZ_ACCESS_OWNER_EMAIL
  );
}

function decodeBase64Url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid base64url");
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}

function parsePart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

function safeIssuer(raw) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("invalid issuer");
  }
  // Never follow a token-supplied issuer or JWKS URL; only this configured Access team domain.
  if (!url.hostname.endsWith(".cloudflareaccess.com")) throw new Error("not a Cloudflare Access issuer");
  return url.origin;
}

/**
 * @param {string} assertion from Cf-Access-Jwt-Assertion
 * @param {Record<string, string>} env trusted Worker environment config
 * @param {typeof fetch} jwksFetch provided only for deterministic tests
 * @returns {Promise<boolean>}
 */
export async function verifyAccessChatAssertion(assertion, env, jwksFetch = fetch) {
  try {
    if (!accessChatConfigured(env) || typeof assertion !== "string" || assertion.length > 16000) return false;
    const parts = assertion.split(".");
    if (parts.length !== 3) return false;
    const header = parsePart(parts[0]);
    const claims = parsePart(parts[1]);
    if (header?.alg !== "RS256" || typeof header.kid !== "string" || header.kid.length > 200) return false;
    const issuer = safeIssuer(env.AGENTZ_ACCESS_ISSUER);
    if (claims.iss !== issuer) return false;
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(env.AGENTZ_ACCESS_AUD)) return false;
    const owner = String(env.AGENTZ_ACCESS_OWNER_EMAIL).trim().toLowerCase();
    if (typeof claims.email !== "string" || claims.email.toLowerCase() !== owner) return false;
    if (typeof claims.sub !== "string" || !claims.sub || typeof claims.iat !== "number") return false;
    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.exp !== "number" || claims.exp <= now - 30 || claims.iat > now + 30) return false;
    if (typeof claims.nbf === "number" && claims.nbf > now + 30) return false;
    // Bound the authorization grant: unexpected extremely long-lived JWTs do not open chat access.
    if (claims.exp - claims.iat > 86400 + 60) return false;
    const response = await jwksFetch(issuer + ACCESS_CERTS_PATH, { redirect: "error" });
    if (!response.ok) return false;
    const document = await response.json();
    const key = document?.keys?.find(k => k.kid === header.kid && k.kty === "RSA");
    if (!key) return false;
    const publicKey = await crypto.subtle.importKey(
      "jwk", key, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
    );
    const message = new TextEncoder().encode(parts[0] + "." + parts[1]);
    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", publicKey, decodeBase64Url(parts[2]), message
    );
  } catch {
    return false;
  }
}
