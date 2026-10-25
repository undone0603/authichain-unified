# Email opt-in sender (authichain-com, PR #2013)

The confirmation email for the free-check email opt-in. **Nothing in this PR adds DNS records or secrets.** It stays off until a human does the steps below.

- Provider: Resend free tier ($0). Free-tier limits change, so check them on resend.com/pricing before turning this on.
- From: `AuthiChain <no-reply@mail.authichain.com>`. `mail.authichain.com` is a send-only subdomain, so the apex authichain.com mail setup is untouched. Never strainchain.io.
- Content: transactional only. It carries the confirm link, a visible unsubscribe link, and RFC 8058 `List-Unsubscribe` / `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers. Unsubscribe contact is authichain@mail.grokbot.com. No promo and no postal address.
- Code: `workers/authichain-com/src/email-optin.ts` (`sendOptinMail` / `sendConfirmEmail`). Update mail uses the same helper and is refused unless the row status is `confirmed`.

## 1. Add the domain in Resend

Resend dashboard → Domains → Add `mail.authichain.com`. Resend then shows the exact values. Copy them from there, because the values below are placeholders.

## 2. DNS records in the authichain.com Cloudflare zone (all DNS-only / grey cloud)

| Type | Name                                  | Value                                                           | Priority |
| ---- | ------------------------------------- | --------------------------------------------------------------- | -------- |
| TXT  | `resend._domainkey.mail`              | `<DKIM public key from Resend: p=MIGf...>`                      | –        |
| MX   | `send.mail`                           | `feedback-smtp.<region>.amazonses.com` (exact host from Resend) | 10       |
| TXT  | `send.mail`                           | `v=spf1 include:amazonses.com ~all` (exact value from Resend)   | –        |
| TXT  | `_dmarc.mail` (optional, recommended) | `v=DMARC1; p=none;`                                             | –        |

Don't add an MX on `mail.authichain.com` itself. It's send-only, and the `send.mail` MX is only Resend's bounce path.

## 3. Secrets / vars on authichain-com (owner action, values never printed)

- `RESEND_API_KEY`: a sending-only key scoped to `mail.authichain.com`. Set it from file via stdin: `wrangler secret put RESEND_API_KEY --name authichain-com < keyfile`.
- `EMAIL_OPTIN_SEND_ENABLED=true`: set this only after the domain shows Verified in Resend. Leave it unset or anything other than `true` to keep sending off.

Note: setting a secret creates and deploys a new Worker version right away.

## 4. Turn off / rollback

Delete `EMAIL_OPTIN_SEND_ENABLED` or set it to anything other than `true`. Sending stops, and rows stay `pending` and are purged after 30 days.
