/**
 * Gmail OAuth Setup — fully automated using googleapis + open
 *
 * Usage:
 *   node scripts/gmail-oauth-setup.mjs
 *     → prints instructions to create OAuth credentials
 *
 *   GMAIL_CLIENT_ID=xxx GMAIL_CLIENT_SECRET=yyy node scripts/gmail-oauth-setup.mjs
 *     → starts local server, opens browser for consent, exchanges code,
 *       then pushes all secrets to Cloudflare via GitHub Actions automatically
 */

import { google } from "googleapis";
import open from "open";
import { createServer } from "http";
import { execSync } from "child_process";
import "dotenv/config";

const CLIENT_ID     = process.env.GMAIL_CLIENT_ID     || "";
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || "";
const REDIRECT_URI  = "http://localhost:9000/callback";
const REPO          = "undone0603/authichain-unified";
const FROM_EMAIL    = process.env.GMAIL_FROM_EMAIL || "Z@authichain.com";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
];

// ─── Step 0: No credentials yet ──────────────────────────────────────────────

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║         Gmail OAuth Setup — Step 1: Create Credentials          ║
╚══════════════════════════════════════════════════════════════════╝

1. Enable the Gmail API (if not already):
   https://console.cloud.google.com/apis/library/gmail.googleapis.com

2. Create an OAuth 2.0 Client ID:
   https://console.cloud.google.com/apis/credentials/oauthclient

   • Application type : Web application
   • Name             : AuthiChain Gmail
   • Redirect URI     : http://localhost:9000/callback

3. Click CREATE → copy the Client ID + Client Secret.

4. Re-run with your credentials:

   GMAIL_CLIENT_ID=<id> GMAIL_CLIENT_SECRET=<secret> node scripts/gmail-oauth-setup.mjs
`);
  process.exit(0);
}

// ─── Step 1: Build auth URL via googleapis ────────────────────────────────────

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline",
  prompt:      "consent",
  scope:       SCOPES,
});

console.log("\n[gmail-oauth] Opening consent page in your browser...");
console.log(`  ${authUrl}\n`);

await open(authUrl);

// ─── Step 2: Local HTTP server to catch callback ──────────────────────────────

console.log("[gmail-oauth] Waiting for Google to redirect to http://localhost:9000/callback ...\n");

const refreshToken = await new Promise((resolve, reject) => {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost:9000");
    if (url.pathname !== "/callback") { res.writeHead(404); res.end(); return; }

    const code  = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error || !code) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(`<h2 style="color:red">Error: ${error || "no code"}</h2>`);
      server.close(() => reject(new Error(error || "no code returned")));
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<h2 style="color:green;font-family:sans-serif">✓ Authorized! Check your terminal.</h2><p>You can close this tab.</p>`);

    console.log("[gmail-oauth] Authorization code received. Exchanging for tokens...");

    const { tokens } = await oAuth2Client.getToken(code);
    server.close();

    if (!tokens.refresh_token) {
      reject(new Error(
        "No refresh_token returned. Revoke access at https://myaccount.google.com/permissions " +
        "and re-run to force a new consent prompt."
      ));
      return;
    }

    resolve(tokens.refresh_token);
  });

  server.listen(9000);
  server.on("error", reject);
});

// ─── Step 3: Push secrets to Cloudflare via GitHub Actions ───────────────────

console.log("\n╔══════════════════════════════════════════════════════════════╗");
console.log("║         ✓ Tokens obtained. Pushing to Cloudflare...         ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");
console.log(`GMAIL_CLIENT_ID     = ${CLIENT_ID}`);
console.log(`GMAIL_CLIENT_SECRET = ${CLIENT_SECRET.slice(0, 6)}...`);
console.log(`GMAIL_REFRESH_TOKEN = ${refreshToken.slice(0, 12)}...`);
console.log(`GMAIL_FROM_EMAIL    = ${FROM_EMAIL}\n`);

execSync(
  [
    "gh workflow run set-worker-secrets.yml",
    `--repo ${REPO}`,
    `--field GMAIL_CLIENT_ID="${CLIENT_ID}"`,
    `--field GMAIL_CLIENT_SECRET="${CLIENT_SECRET}"`,
    `--field GMAIL_REFRESH_TOKEN="${refreshToken}"`,
  ].join(" "),
  { stdio: "inherit" }
);

console.log(`\n✓ Workflow dispatched!`);
console.log(`  Progress: https://github.com/${REPO}/actions/workflows/set-worker-secrets.yml`);
console.log(`\nGmail outreach is now fully configured for ${FROM_EMAIL}.`);
console.log(`Next: trigger a pipeline tick to send the first outbound email.\n`);
