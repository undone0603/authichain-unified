/**
 * YouTube OAuth 2.0 Setup
 *
 * Usage:
 *   node scripts/youtube-oauth-setup.mjs
 *     → prints instructions to create OAuth credentials
 *
 *   YOUTUBE_CLIENT_ID=xxx YOUTUBE_CLIENT_SECRET=yyy node scripts/youtube-oauth-setup.mjs
 *     → starts local server on port 9002, opens Google consent,
 *       exchanges code for tokens, then pushes all secrets to
 *       Cloudflare via GitHub Actions automatically
 *
 *   YOUTUBE_CLIENT_ID=xxx YOUTUBE_CLIENT_SECRET=yyy YOUTUBE_CHANNEL=qron node scripts/youtube-oauth-setup.mjs
 *     → same flow but pushes YOUTUBE_QRON_* secrets (for the QRON channel)
 */

import { google } from "googleapis";
import open from "open";
import { createServer } from "http";
import { execSync } from "child_process";

const CLIENT_ID     = process.env.YOUTUBE_CLIENT_ID     || "";
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || "";
const CHANNEL       = (process.env.YOUTUBE_CHANNEL || "authichain").toLowerCase(); // "authichain" | "qron"
const REDIRECT_URI  = "http://localhost:9002/callback";
const REPO          = "undone0603/authichain-unified";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

// ─── Step 0: No credentials yet ──────────────────────────────────────────────

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║        YouTube OAuth Setup — Step 1: Create Credentials         ║
╚══════════════════════════════════════════════════════════════════╝

1. Enable the YouTube Data API v3:
   https://console.cloud.google.com/apis/library/youtube.googleapis.com

2. Create an OAuth 2.0 Client ID:
   https://console.cloud.google.com/apis/credentials/oauthclient

   • Application type : Web application
   • Name             : AuthiChain YouTube
   • Redirect URI     : http://localhost:9002/callback

3. Configure the OAuth consent screen:
   • Scopes: youtube.upload, youtube.readonly
   • Test users: add the YouTube account email

4. Click CREATE → copy the Client ID + Client Secret.

5. Re-run with your credentials:

   YOUTUBE_CLIENT_ID=<id> YOUTUBE_CLIENT_SECRET=<secret> node scripts/youtube-oauth-setup.mjs

   For the QRON channel (same client, different account):
   YOUTUBE_CLIENT_ID=<id> YOUTUBE_CLIENT_SECRET=<secret> YOUTUBE_CHANNEL=qron node scripts/youtube-oauth-setup.mjs
`);
  process.exit(0);
}

// ─── Step 1: Build auth URL via googleapis ────────────────────────────────────

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline",
  prompt:      "consent",     // force re-consent to always get a refresh_token
  scope:       SCOPES,
});

const label = CHANNEL === "qron" ? "QRON" : "AuthiChain";
console.log(`\n[youtube-oauth] Setting up ${label} channel. Opening Google consent page...`);
console.log(`  ${authUrl}\n`);
if (CHANNEL === "qron") {
  console.log("[youtube-oauth] Sign in with the QRON YouTube account (not your personal account).\n");
} else {
  console.log("[youtube-oauth] Sign in with the AuthiChain YouTube account.\n");
}

await open(authUrl);

// ─── Step 2: Local HTTP server to catch callback ──────────────────────────────

console.log("[youtube-oauth] Waiting for Google to redirect to http://localhost:9002/callback ...\n");

const { refreshToken, channelId } = await new Promise((resolve, reject) => {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost:9002");
    if (url.pathname !== "/callback") { res.writeHead(404); res.end(); return; }

    const code  = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error || !code) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(`<h2 style="color:red">Error: ${error || "no code"}</h2>`);
      server.close(() => reject(new Error(error || "no code returned")));
      return;
    }

    console.log("[youtube-oauth] Authorization code received. Exchanging for tokens...");

    let tokens;
    try {
      const result = await oAuth2Client.getToken(code);
      tokens = result.tokens;
    } catch (e) {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(`<h2 style="color:red">Token exchange failed: ${e.message}</h2>`);
      server.close(() => reject(e));
      return;
    }

    if (!tokens.refresh_token) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(`
        <h2 style="color:orange;font-family:sans-serif">No refresh token returned</h2>
        <p>Revoke app access at <a href="https://myaccount.google.com/permissions">Google Account Permissions</a>
        and re-run this script to force a new consent prompt.</p>
      `);
      server.close(() => reject(new Error(
        "No refresh_token returned. Revoke at https://myaccount.google.com/permissions and re-run."
      )));
      return;
    }

    // Fetch channel ID
    oAuth2Client.setCredentials(tokens);
    const yt = google.youtube({ version: "v3", auth: oAuth2Client });
    let channelId = "";
    try {
      const chRes = await yt.channels.list({ part: ["id", "snippet"], mine: true });
      channelId = chRes.data.items?.[0]?.id ?? "";
      const title = chRes.data.items?.[0]?.snippet?.title ?? "";
      console.log(`[youtube-oauth] Channel: ${title} (${channelId})`);
    } catch (e) {
      console.warn("[youtube-oauth] Could not fetch channel ID:", e.message);
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
      <h2 style="color:green;font-family:sans-serif">✓ ${label} YouTube Authorized!</h2>
      <p>Channel ID: <code>${channelId}</code></p>
      <p>You can close this tab and check your terminal.</p>
    `);
    server.close();
    resolve({ refreshToken: tokens.refresh_token, channelId });
  });

  server.listen(9002);
  server.on("error", reject);
});

// ─── Step 3: Push secrets to Cloudflare via GitHub Actions ───────────────────

console.log("\n╔══════════════════════════════════════════════════════════════╗");
console.log(`║   ✓ Tokens obtained (${label}). Pushing to Cloudflare...   ║`);
console.log("╚══════════════════════════════════════════════════════════════╝\n");
console.log(`YOUTUBE_CLIENT_ID      = ${CLIENT_ID}`);
console.log(`YOUTUBE_CLIENT_SECRET  = ${CLIENT_SECRET.slice(0, 6)}...`);

let fields;
if (CHANNEL === "qron") {
  console.log(`YOUTUBE_QRON_REFRESH_TOKEN = ${refreshToken.slice(0, 12)}...`);
  console.log(`YOUTUBE_QRON_CHANNEL_ID    = ${channelId}\n`);
  fields = [
    `--field YOUTUBE_CLIENT_ID="${CLIENT_ID}"`,
    `--field YOUTUBE_CLIENT_SECRET="${CLIENT_SECRET}"`,
    `--field YOUTUBE_QRON_REFRESH_TOKEN="${refreshToken}"`,
    `--field YOUTUBE_QRON_CHANNEL_ID="${channelId}"`,
  ].join(" ");
} else {
  console.log(`YOUTUBE_REFRESH_TOKEN  = ${refreshToken.slice(0, 12)}...`);
  console.log(`YOUTUBE_CHANNEL_ID     = ${channelId}\n`);
  fields = [
    `--field YOUTUBE_CLIENT_ID="${CLIENT_ID}"`,
    `--field YOUTUBE_CLIENT_SECRET="${CLIENT_SECRET}"`,
    `--field YOUTUBE_REFRESH_TOKEN="${refreshToken}"`,
    `--field YOUTUBE_CHANNEL_ID="${channelId}"`,
  ].join(" ");
}

execSync(
  `gh workflow run set-social-secrets.yml --repo ${REPO} ${fields}`,
  { stdio: "inherit" }
);

console.log(`\n✓ Workflow dispatched!`);
console.log(`  Progress: https://github.com/${REPO}/actions/workflows/set-social-secrets.yml`);
console.log(`\nYouTube uploads are now configured for the ${label} channel (${channelId}).\n`);

if (CHANNEL !== "qron") {
  console.log(`To set up the QRON channel, run:`);
  console.log(`  YOUTUBE_CLIENT_ID=${CLIENT_ID} YOUTUBE_CLIENT_SECRET=<secret> YOUTUBE_CHANNEL=qron node scripts/youtube-oauth-setup.mjs\n`);
}
