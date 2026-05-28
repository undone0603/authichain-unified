/**
 * YouTube OAuth 2.0 Setup
 *
 * Usage:
 *   node scripts/youtube-oauth-setup.mjs
 *     -> prints instructions to create OAuth credentials
 *
 *   YOUTUBE_CLIENT_ID=xxx YOUTUBE_CLIENT_SECRET=yyy node scripts/youtube-oauth-setup.mjs
 *     -> starts local server on port 9002, opens Google consent,
 *        exchanges code for tokens, then pushes all secrets to
 *        Cloudflare via GitHub Actions automatically
 *
 *   YOUTUBE_CLIENT_ID=xxx YOUTUBE_CLIENT_SECRET=yyy YOUTUBE_CHANNEL=qron node scripts/youtube-oauth-setup.mjs
 *     -> same flow but pushes YOUTUBE_QRON_* secrets (for the QRON channel)
 */

import { google } from "googleapis";
import open from "open";
import { createServer } from "http";
import { execSync } from "child_process";

const CLIENT_ID     = process.env.YOUTUBE_CLIENT_ID     || "";
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || "";
const CHANNEL       = (process.env.YOUTUBE_CHANNEL || "authichain").toLowerCase(); // "authichain" | "qron"
const REDIRECT_URI  = "http://localhost:9002/callback";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube",
];

// HTML escape helper to prevent XSS in OAuth callback responses
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.log(`
==============================================================
  YOUTUBE OAUTH SETUP - AuthiChain
==============================================================

Step 1: Create OAuth 2.0 credentials in Google Cloud Console
  -> https://console.cloud.google.com/apis/credentials
  -> Application type: Web application
  -> Authorized redirect URIs: http://localhost:9002/callback

Step 2: Enable YouTube Data API v3
  -> https://console.cloud.google.com/apis/library/youtube.googleapis.com

Step 3: Run this script with your credentials:
  YOUTUBE_CLIENT_ID=<your-id> YOUTUBE_CLIENT_SECRET=<your-secret> node scripts/youtube-oauth-setup.mjs

Optional: Specify channel (default: authichain)
  YOUTUBE_CHANNEL=qron YOUTUBE_CLIENT_ID=<id> YOUTUBE_CLIENT_SECRET=<secret> node scripts/youtube-oauth-setup.mjs
==============================================================
`);
  process.exit(0);
}

const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const authUrl = auth.generateAuthUrl({ access_type: "offline", scope: SCOPES, prompt: "consent" });

console.log("\n Opening browser for Google OAuth consent...");
console.log(`Auth URL: ${authUrl}\n`);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:9002`);
  if (url.pathname !== "/callback") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const code  = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    // Sanitize error message to prevent reflected XSS
    const safeError = escapeHtml(error || "no code returned");
    res.end(`<h2 style="color:red">Error: ${safeError}</h2>`);
    server.close(() => reject(new Error(error || "no code returned")));
    return;
  }

  try {
    const { tokens } = await auth.getToken(code);
    auth.setCredentials(tokens);

    const prefix = CHANNEL === "qron" ? "YOUTUBE_QRON" : "YOUTUBE";

    const secrets = {
      [`${prefix}_CLIENT_ID`]:           CLIENT_ID,
      [`${prefix}_CLIENT_SECRET`]:       CLIENT_SECRET,
      [`${prefix}_ACCESS_TOKEN`]:        tokens.access_token,
      [`${prefix}_REFRESH_TOKEN`]:       tokens.refresh_token,
      [`${prefix}_TOKEN_EXPIRY`]:        String(tokens.expiry_date),
    };

    console.log("\n Tokens received. Pushing secrets to GitHub Actions...");

    const repoSlug = execSync("gh repo view --json nameWithOwner -q .nameWithOwner").toString().trim();

    for (const [key, value] of Object.entries(secrets)) {
      if (!value) { console.warn(`  Skipping ${key} (empty)`); continue; }
      execSync(`gh secret set ${key} --body "${value}" --repo ${repoSlug}`, { stdio: "inherit" });
      console.log(`  Set ${key}`);
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<h2 style="color:green">Success! Secrets pushed to GitHub. You can close this tab.</h2>`);
    server.close(() => resolve(tokens));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<h2 style="color:red">Internal error. Check console.</h2>`);
    server.close(() => reject(err));
  }
});

const tokens = await new Promise((resolve, reject) => {
  server.listen(9002, () => {
    console.log(" Listening on http://localhost:9002/callback");
    open(authUrl);
  });
});

console.log("\n YouTube OAuth setup complete!");
console.log(`Channel: ${CHANNEL}`);
console.log("Tokens:", tokens);
