/**
 * Gmail OAuth 2.0 routes for admin-level setup.
 *
 * Flow:
 *   1. Admin visits GET /api/gmail/connect  → redirected to Google consent page
 *   2. Google redirects to GET /api/gmail/callback?code=...
 *   3. Server exchanges code for tokens, stores refresh token in env comment + logs it
 *
 * After step 3 the operator copies GMAIL_REFRESH_TOKEN into .env (or the hosting
 * platform's secret store) and restarts the server. From that point the email-service
 * auto-refreshes access tokens using the stored refresh token — no further action needed.
 *
 * Required env vars (set these before starting):
 *   GMAIL_CLIENT_ID      – from Google Cloud Console OAuth 2.0 credentials
 *   GMAIL_CLIENT_SECRET  – same credentials
 *   GMAIL_FROM_EMAIL     – the Gmail address to send from
 *
 * The redirect URI registered in Google Cloud must be:
 *   https://authichain.com/api/gmail/callback   (production)
 *   http://localhost:PORT/api/gmail/callback     (local dev)
 */
import type { Express, Request, Response } from "express";
import { ENV } from "./env";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

function redirectUri(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] ?? req.protocol ?? "http";
  const host  = req.headers["x-forwarded-host"]  ?? req.get("host") ?? "localhost";
  return `${proto}://${host}/api/gmail/callback`;
}

export function registerGmailOAuthRoutes(app: Express) {
  // Step 1 — Start OAuth consent flow
  app.get("/api/gmail/connect", (req: Request, res: Response) => {
    if (!ENV.gmailClientId) {
      res.status(400).json({ error: "GMAIL_CLIENT_ID not configured" });
      return;
    }
    const params = new URLSearchParams({
      client_id:     ENV.gmailClientId,
      redirect_uri:  redirectUri(req),
      response_type: "code",
      scope:         SCOPES,
      access_type:   "offline",   // requests refresh_token
      prompt:        "consent",   // force refresh_token even if previously granted
    });
    res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  // Step 2 — Handle Google callback, exchange code for tokens
  app.get("/api/gmail/callback", async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!code) {
      res.status(400).send("Missing code parameter from Google");
      return;
    }

    if (!ENV.gmailClientId || !ENV.gmailClientSecret) {
      res.status(400).json({ error: "GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET not configured" });
      return;
    }

    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id:     ENV.gmailClientId,
          client_secret: ENV.gmailClientSecret,
          redirect_uri:  redirectUri(req),
          grant_type:    "authorization_code",
        }).toString(),
      });

      const data = await tokenRes.json().catch(() => ({})) as any;

      if (!tokenRes.ok || !data.refresh_token) {
        console.error("[gmail-oauth] token exchange failed:", data);
        res.status(500).send(
          `Token exchange failed: ${JSON.stringify(data)}\n\n` +
          "Make sure 'access_type=offline' and 'prompt=consent' are set, " +
          "and that this is the first time the account grants access (or revoke first).",
        );
        return;
      }

      // Log the refresh token so the operator can persist it
      console.log("\n========== GMAIL OAUTH SUCCESS ==========");
      console.log("Add this to your .env / secrets store:\n");
      console.log(`GMAIL_REFRESH_TOKEN=${data.refresh_token}`);
      console.log("=========================================\n");

      res.send(`
        <html><body style="font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px">
          <h2>✅ Gmail Connected</h2>
          <p>Copy the <strong>GMAIL_REFRESH_TOKEN</strong> from the server console into your
          <code>.env</code> file (or your hosting platform's secret store), then restart the server.</p>
          <pre style="background:#f4f4f4;padding:12px;border-radius:6px;overflow-x:auto">GMAIL_REFRESH_TOKEN=${data.refresh_token}</pre>
          <p style="color:#666;font-size:13px">This token does not expire — it will be used to obtain short-lived access tokens automatically.</p>
        </body></html>
      `);
    } catch (err: any) {
      console.error("[gmail-oauth] callback error:", err);
      res.status(500).json({ error: err.message });
    }
  });
}
