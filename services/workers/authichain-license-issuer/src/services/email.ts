import type { Env } from '../index'

/**
 * Send a transactional email via Resend.
 * Set RESEND_API_KEY via: wrangler secret put RESEND_API_KEY
 */
async function sendEmail(
  apiKey: string,
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'AuthiChain <licenses@authichain.com>',
      to,
      subject,
      html,
    }),
  })
  return res.ok
}

/**
 * Deliver a license key via email as a fallback when Telegram is not connected.
 */
export async function deliverKeyViaEmail(
  env: Env,
  email: string,
  tier: string,
  key: string
): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;max-width:600px;margin:40px auto;padding:0 24px;color:#111">
  <img src="https://authichain.com/logo.png" alt="AuthiChain" style="height:32px;margin-bottom:32px">
  <h1 style="font-size:24px;font-weight:700;margin-bottom:8px">Your agent-browser Pro License</h1>
  <p style="color:#555;margin-bottom:24px">Thanks for subscribing to <strong>${tier}</strong>. Here is your license key:</p>

  <div style="background:#f4f4f5;border-radius:8px;padding:16px 20px;margin-bottom:24px">
    <code style="font-size:13px;word-break:break-all;color:#111">${key}</code>
  </div>

  <h2 style="font-size:16px;margin-bottom:12px">Activate in 1 step:</h2>
  <pre style="background:#18181b;color:#e4e4e7;border-radius:8px;padding:16px;font-size:13px;overflow-x:auto">agent-browser license set ${key}</pre>

  <p style="color:#555;margin-top:24px">Or set as an environment variable:</p>
  <pre style="background:#18181b;color:#e4e4e7;border-radius:8px;padding:16px;font-size:13px">AGENT_BROWSER_LICENSE_KEY=${key}</pre>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
  <p style="color:#888;font-size:13px">
    Tier: <strong>${tier}</strong> — unlimited concurrent sessions<br>
    Docs: <a href="https://github.com/Z-kie/agent-browser" style="color:#10b981">github.com/Z-kie/agent-browser</a><br>
    Support: <a href="mailto:support@authichain.com" style="color:#10b981">support@authichain.com</a>
  </p>
  <p style="color:#bbb;font-size:12px;margin-top:8px">
    💡 Connect Telegram for future key deliveries: start a chat with @AuthiChainBot and send <code>/connect ${email}</code>
  </p>
</body>
</html>
`.trim()

  return sendEmail(
    env.RESEND_API_KEY,
    email,
    `Your agent-browser ${tier} license key`,
    html
  )
}
