/**
 * LinkedIn OAuth 2.0 Setup
 *
 * Usage:
 *   node scripts/linkedin-oauth-setup.mjs
 *     → prints instructions to create OAuth credentials
 *
 *   LINKEDIN_CLIENT_ID=xxx LINKEDIN_CLIENT_SECRET=yyy node scripts/linkedin-oauth-setup.mjs
 *     → starts local server on port 9001, opens LinkedIn consent,
 *       exchanges code for tokens, then pushes all secrets to
 *       Cloudflare via GitHub Actions automatically
 *
 * Scopes granted:
 *   r_liteprofile   — read basic profile (to get person URN)
 *   w_member_social — post updates on behalf of the user
 *   r_emailaddress  — read email (optional, for verification)
 */

import open from "open";
import { createServer } from "http";
import { execSync } from "child_process";

const CLIENT_ID     = process.env.LINKEDIN_CLIENT_ID     || "";
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || "";
const REDIRECT_URI  = "http://localhost:9001/callback";
const REPO          = "undone0603/authichain-unified";

const SCOPES = [
  "openid",
  "profile",
  "email",
  "w_member_social",
].join(" ");

// ─── Step 0: No credentials yet ──────────────────────────────────────────────

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║       LinkedIn OAuth Setup — Step 1: Create App Credentials     ║
╚══════════════════════════════════════════════════════════════════╝

1. Go to the LinkedIn Developer Portal:
   https://www.linkedin.com/developers/apps/new

2. Create an app:
   • App name     : AuthiChain
   • LinkedIn Page: (create or use existing company page)
   • Logo         : upload authichain logo

3. Under "Auth" tab:
   • Add Authorized Redirect URL: http://localhost:9001/callback
   • Note your Client ID and Client Secret

4. Under "Products" tab:
   • Request "Share on LinkedIn" (grants w_member_social)
   • Request "Sign In with LinkedIn" (grants r_liteprofile + r_emailaddress)

5. Re-run with your credentials:

   LINKEDIN_CLIENT_ID=<id> LINKEDIN_CLIENT_SECRET=<secret> node scripts/linkedin-oauth-setup.mjs
`);
  process.exit(0);
}

// ─── Step 1: Build LinkedIn OAuth URL ────────────────────────────────────────

// Generate a random state for CSRF protection
const state = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("client_id",     CLIENT_ID);
authUrl.searchParams.set("redirect_uri",  REDIRECT_URI);
authUrl.searchParams.set("state",         state);
authUrl.searchParams.set("scope",         SCOPES);

console.log("\n[linkedin-oauth] Opening LinkedIn consent page in your browser...");
console.log(`  ${authUrl.toString()}\n`);
console.log("[linkedin-oauth] Sign in as undone.k@gmail.com when prompted.\n");

await open(authUrl.toString());

// ─── Step 2: Local HTTP server to catch callback ──────────────────────────────

console.log("[linkedin-oauth] Waiting for LinkedIn to redirect to http://localhost:9001/callback ...\n");

const { accessToken, refreshToken, personUrn } = await new Promise((resolve, reject) => {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost:9001");
    if (url.pathname !== "/callback") { res.writeHead(404); res.end(); return; }

    const code       = url.searchParams.get("code");
    const errorParam = url.searchParams.get("error");
    const retState   = url.searchParams.get("state");

    if (errorParam || !code) {
      const safe = String(errorParam || "no code").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(`<h2 style="color:red">Error: ${safe}</h2>`);
      server.close(() => reject(new Error(errorParam || "no code returned")));
      return;
    }

    if (retState !== state) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end("<h2 style='color:red'>State mismatch — possible CSRF</h2>");
      server.close(() => reject(new Error("state mismatch")));
      return;
    }

    // Exchange code for tokens
    console.log("[linkedin-oauth] Authorization code received. Exchanging for tokens...");

    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "authorization_code",
        code,
        redirect_uri:  REDIRECT_URI,
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(`<h2 style="color:red">Token exchange failed: ${errText}</h2>`);
      server.close(() => reject(new Error(`Token exchange failed: ${errText}`)));
      return;
    }

    const tokens = await tokenRes.json();
    const accessToken  = tokens.access_token;
    const refreshToken = tokens.refresh_token ?? "";   // LinkedIn may not return a refresh token on basic products

    // Fetch person URN via OpenID Connect userinfo endpoint
    let personUrn = "";
    try {
      // Try OpenID Connect userinfo first (modern API)
      const userinfoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userinfoRes.ok) {
        const userinfo = await userinfoRes.json();
        // sub is the person ID in OIDC responses
        personUrn = userinfo.sub?.startsWith("urn:li:person:")
          ? userinfo.sub
          : `urn:li:person:${userinfo.sub}`;
        console.log(`[linkedin-oauth] Person URN: ${personUrn} (${userinfo.name ?? userinfo.email ?? ""})`);
      } else {
        // Fallback: classic /v2/me endpoint
        const meRes = await fetch("https://api.linkedin.com/v2/me", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Restli-Protocol-Version": "2.0.0",
          },
        });
        if (meRes.ok) {
          const me = await meRes.json();
          personUrn = `urn:li:person:${me.id}`;
          console.log(`[linkedin-oauth] Person URN: ${personUrn}`);
        }
      }
    } catch (e) {
      console.warn("[linkedin-oauth] Could not fetch profile URN:", e.message);
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
      <h2 style="color:green;font-family:sans-serif">✓ LinkedIn Authorized!</h2>
      <p>Person URN: <code>${personUrn}</code></p>
      <p>You can close this tab and check your terminal.</p>
    `);
    server.close();
    resolve({ accessToken, refreshToken, personUrn });
  });

  server.listen(9001);
  server.on("error", reject);
});

// ─── Step 3: Push secrets to Cloudflare via GitHub Actions ───────────────────

console.log("\n╔══════════════════════════════════════════════════════════════╗");
console.log("║    ✓ Tokens obtained. Pushing to Cloudflare via GitHub...   ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");
console.log(`LINKEDIN_CLIENT_ID     = ${CLIENT_ID}`);
console.log(`LINKEDIN_CLIENT_SECRET = ${CLIENT_SECRET.slice(0, 6)}...`);
console.log(`LINKEDIN_ACCESS_TOKEN  = ${accessToken.slice(0, 12)}...`);
console.log(`LINKEDIN_REFRESH_TOKEN = ${refreshToken ? refreshToken.slice(0, 12) + "..." : "(none — token is long-lived 60 days)"}`);
console.log(`LINKEDIN_PERSON_URN    = ${personUrn}\n`);

const fields = [
  `--field LINKEDIN_CLIENT_ID="${CLIENT_ID}"`,
  `--field LINKEDIN_CLIENT_SECRET="${CLIENT_SECRET}"`,
  `--field LINKEDIN_ACCESS_TOKEN="${accessToken}"`,
  `--field LINKEDIN_PERSON_URN="${personUrn}"`,
  ...(refreshToken ? [`--field LINKEDIN_REFRESH_TOKEN="${refreshToken}"`] : []),
].join(" ");

execSync(
  `gh workflow run set-social-secrets.yml --repo ${REPO} ${fields}`,
  { stdio: "inherit" }
);

console.log(`\n✓ Workflow dispatched!`);
console.log(`  Progress: https://github.com/${REPO}/actions/workflows/set-social-secrets.yml`);
console.log(`\nLinkedIn posting is now configured for ${personUrn}.`);
console.log(`\nNOTE: If "Sign In with LinkedIn using OpenID Connect" product is not approved yet,`);
console.log(`the token may expire in 60 days. Re-run this script before expiry to refresh.\n`);
