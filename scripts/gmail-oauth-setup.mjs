/**
 * Gmail OAuth Setup — two-step credential bootstrapper
 *
 * Step 1 (first run — no args):
 *   node scripts/gmail-oauth-setup.mjs
 *   Opens https://console.cloud.google.com pre-filled URL.
 *   Paste your client_id and client_secret when prompted, OR
 *   pass them as environment variables:
 *     GMAIL_CLIENT_ID=xxx GMAIL_CLIENT_SECRET=yyy node scripts/gmail-oauth-setup.mjs
 *
 * Step 2 (second run — after pasting credentials):
 *   The script starts a local HTTP server on port 9000,
 *   opens the Google consent page in your browser,
 *   catches the callback, exchanges the code for tokens,
 *   then calls:  gh workflow run set-worker-secrets.yml
 *   to push everything to Cloudflare automatically.
 *
 * Requirements: gh CLI authenticated (already is for this repo)
 */

import { createServer } from "http";
import { execSync, exec } from "child_process";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, "..");

const CLIENT_ID     = process.env.GMAIL_CLIENT_ID     || "";
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || "";
const REDIRECT_URI  = "http://localhost:9000/callback";
const REPO          = "undone0603/authichain-unified";
const FROM_EMAIL    = process.env.GMAIL_FROM_EMAIL || "Z@authichain.com";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

// ─── Step 0: Check if we have credentials ────────────────────────────────────

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║          Gmail OAuth Setup — Step 1: Create Credentials          ║
╚══════════════════════════════════════════════════════════════════╝

You need a Google OAuth 2.0 Client ID.  It takes ~90 seconds:

1. Open this URL in your browser:
   https://console.cloud.google.com/apis/credentials/oauthclient

2. If prompted, create a project (name it "authichain").

3. Application type: Web application
   Name: AuthiChain Gmail
   Authorized redirect URIs → Add: http://localhost:9000/callback

4. Click CREATE — you'll see the client_id and client_secret.

5. Re-run this script with the credentials:

   GMAIL_CLIENT_ID=<id> GMAIL_CLIENT_SECRET=<secret> node scripts/gmail-oauth-setup.mjs

Also make sure the Gmail API is enabled:
   https://console.cloud.google.com/apis/library/gmail.googleapis.com
`);
  process.exit(0);
}

// ─── Step 1: Start local callback server, open consent URL ───────────────────

console.log("\n[gmail-oauth] Starting local callback server on port 9000...");

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id",     CLIENT_ID);
authUrl.searchParams.set("redirect_uri",  REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope",         SCOPES);
authUrl.searchParams.set("access_type",   "offline");
authUrl.searchParams.set("prompt",        "consent");

console.log(`[gmail-oauth] Opening consent URL:\n  ${authUrl}\n`);

// Try to open browser
try {
  const opener = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
  exec(`${opener} "${authUrl.toString()}"`);
} catch { /* ignore */ }

// Local HTTP server to catch the OAuth callback
await new Promise((resolve, reject) => {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost:9000");
    if (url.pathname !== "/callback") {
      res.writeHead(404); res.end("not found"); return;
    }

    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error || !code) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(`<h2 style="color:red">Error: ${error || "no code"}</h2>`);
      server.close();
      reject(new Error(error || "no code returned"));
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<h2 style="color:green">✓ Authorized! Check the terminal.</h2><p>You can close this tab.</p>`);
    server.close();

    console.log("[gmail-oauth] Got authorization code. Exchanging for tokens...");

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri:  REDIRECT_URI,
        grant_type:    "authorization_code",
      }).toString(),
    });

    const data = await tokenRes.json();
    if (!tokenRes.ok || !data.refresh_token) {
      console.error("[gmail-oauth] Token exchange failed:", JSON.stringify(data, null, 2));
      reject(new Error("token exchange failed: " + JSON.stringify(data)));
      return;
    }

    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║       ✓ Gmail OAuth tokens obtained successfully          ║");
    console.log("╚══════════════════════════════════════════════════════════╝\n");
    console.log(`GMAIL_CLIENT_ID     = ${CLIENT_ID}`);
    console.log(`GMAIL_CLIENT_SECRET = ${CLIENT_SECRET}`);
    console.log(`GMAIL_REFRESH_TOKEN = ${data.refresh_token}`);
    console.log(`GMAIL_FROM_EMAIL    = ${FROM_EMAIL}`);
    console.log("\nPushing secrets to Cloudflare Worker via GitHub Actions...\n");

    // Trigger the set-worker-secrets workflow
    try {
      execSync([
        "gh workflow run set-worker-secrets.yml",
        `--repo ${REPO}`,
        `--field "GMAIL_CLIENT_ID=${CLIENT_ID}"`,
        `--field "GMAIL_CLIENT_SECRET=${CLIENT_SECRET}"`,
        `--field "GMAIL_REFRESH_TOKEN=${data.refresh_token}"`,
      ].join(" "), { stdio: "inherit" });

      console.log(`\n✓ Workflow dispatched!`);
      console.log(`  Watch: https://github.com/${REPO}/actions/workflows/set-worker-secrets.yml`);
      console.log(`\nGmail outreach is now fully configured for ${FROM_EMAIL}.`);
    } catch (e) {
      console.error("Failed to trigger workflow:", e.message);
      console.log("\nRun manually:");
      console.log(`  bash scripts/set-gmail-secrets.sh "${CLIENT_ID}" "${CLIENT_SECRET}" "${data.refresh_token}"`);
    }

    resolve();
  });

  server.listen(9000, () => {
    console.log("[gmail-oauth] Waiting for Google to redirect to http://localhost:9000/callback ...");
    console.log("             (Open the consent URL above in your browser if it didn't open automatically)\n");
  });

  server.on("error", reject);
});
