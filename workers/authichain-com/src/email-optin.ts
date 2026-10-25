/**
 * Optional email opt-in for the free checks (PM P2, Advisor YES 2026-10-23 9:08 PM ET).
 *
 * - Optional: the free checks never call this; it is a separate POST.
 * - Consent must be explicitly "yes" (box starts unchecked in the UI).
 * - Stores email, optional ISO 3166-1 alpha-2 country, consent timestamp,
 *   status (pending|confirmed|unsubscribed), a SHA-256 hash of the
 *   confirmation token, and a per-row unsubscribe token in AuthiChain's D1
 *   (authichain-db), not QRON-v2. Country is validated server-side.
 * - Unconfirmed rows older than 30 days are purged on every write.
 * - Double opt-in email (PM ruling 2026-10-23): Resend free tier, from
 *   no-reply@mail.authichain.com (send-only subdomain; never strainchain.io).
 *   Sent ONLY when EMAIL_OPTIN_SEND_ENABLED === "true" AND RESEND_API_KEY is
 *   set. Default off: rows stay "pending" and nothing sends. Strictly
 *   transactional: confirm link only. DNS setup: docs/email-optin-sender.md.
 * - Every confirmation or update email goes through sendOptinMail, which
 *   always adds a visible unsubscribe link plus RFC 8058 List-Unsubscribe
 *   and List-Unsubscribe-Post headers. Update mail is refused unless the
 *   row status is confirmed. Contact: authichain@mail.grokbot.com.
 */

export const EMAIL_OPTIN_PATH = "/api/email-optin";
export const EMAIL_OPTIN_CONFIRM_PATH = "/api/email-optin/confirm";
/** Unsubscribe: GET shows a confirm button; POST (button or RFC 8058 List-Unsubscribe-Post) unsubscribes. */
export const EMAIL_UNSUBSCRIBE_PATH = "/email/unsubscribe";
export const EMAIL_UNSUBSCRIBE_BASE =
  "https://authichain.com/email/unsubscribe?token=";
export const EMAIL_UNSUBSCRIBE_MAILTO = "authichain@mail.grokbot.com";

/** Research gate PR2013 @ b2dbd98d, FIX 1, verbatim. */
export const EMAIL_OPTIN_CONSENT_TEXT =
  "Optional: email me AuthiChain product updates, at most once a month. We will first send one email asking you to confirm. To unsubscribe at any time, email authichain@mail.grokbot.com.";
/** /is-this-real (also POSTs /api/leads/capture). Research FIX 2 Option B, verbatim. */
export const EMAIL_OPTIN_PRIVACY_LINE_IS_THIS_REAL =
  'If you tick the box, we store your email, the first seal ID you check, the page address, your country if you give it, when you agreed, and whether you confirmed. We send updates only after you confirm, and the confirm link expires after 30 days. Your email, seal ID and page address are saved in our Supabase lead list (lead_captures), and your email, country if you give it, when you agreed and whether you confirmed are saved in AuthiChain\'s Cloudflare D1 database. Unconfirmed sign-ups may be removed from our mailing list after 30 days; we keep the Supabase copy until you ask us to delete it at authichain@mail.grokbot.com. See the <a href="/privacy">privacy policy</a>.';
/** /dpp-check (email-optin only). Research: keep the current line here. */
export const EMAIL_OPTIN_PRIVACY_LINE =
  'We store only your email, your country if you give it, when you agreed, and whether you confirmed. We send updates only after you confirm, and the confirm link expires after 30 days. Unconfirmed sign-ups may be deleted after 30 days, and you can ask us to delete yours at any time at authichain@mail.grokbot.com. See the <a href="/privacy">privacy policy</a>.';

/*
 * MARKETING RULE (Research gate, PR #2013): only email_optins rows with
 * status = 'confirmed' may EVER receive updates/marketing. Never send
 * marketing from lead_captures (source "is-this-real") or from pending rows.
 * Every email carries a one-click unsubscribe link + List-Unsubscribe headers
 * (unsubscribed rows must never be emailed). Still needed before any update:
 * a Zac-approved postal address (CAN-SPAM).
 */

export const EMAIL_OPTIN_FROM = "AuthiChain <no-reply@mail.authichain.com>";
export const EMAIL_OPTIN_SUBJECT = "Confirm your email for AuthiChain";
export const EMAIL_OPTIN_CONFIRM_BASE =
  "https://authichain.com/api/email-optin/confirm?token=";

export interface EmailOptinEnv {
  DB?: D1Like;
  RESEND_API_KEY?: string;
  EMAIL_OPTIN_SEND_ENABLED?: string;
  /** Optional secret name only. Unset or empty: store NULL, never an unsalted hash. */
  IP_HASH_SALT?: string;
}

export function optinSendEnabled(env: EmailOptinEnv): boolean {
  return env.EMAIL_OPTIN_SEND_ENABLED === "true" && !!env.RESEND_API_KEY;
}

/** Transactional only. Research gate FIX 3, verbatim. */
export function confirmEmailText(token: string): string {
  return `Someone entered this email address on authichain.com and asked for AuthiChain product updates (at most once a month).

To confirm, open this link (valid for 30 days):

${EMAIL_OPTIN_CONFIRM_BASE}${token}

If you did not ask for this, ignore this email. Unless you confirm, we will not send you anything else.`;
}

/** Plain-text footer added to every email: a visible one-click unsubscribe link. */
export function unsubscribeFooter(unsubToken: string): string {
  return `\n\n--\nTo unsubscribe, open this link: ${EMAIL_UNSUBSCRIBE_BASE}${unsubToken}`;
}

/** RFC 2369 / RFC 8058 headers for every email. HTTPS URI is listed first (RFC 8058 §3.2). */
export function unsubscribeHeaders(unsubToken: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${EMAIL_UNSUBSCRIBE_BASE}${unsubToken}>, <mailto:${EMAIL_UNSUBSCRIBE_MAILTO}?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Marketing is allowed only for confirmed rows. Pending and unsubscribed never qualify. */
export function canReceiveMarketing(status: string): boolean {
  return status === "confirmed";
}

export type OptinMailKind = "confirm" | "update";

/** Body + RFC 8058 headers for any confirmation or update email. */
export function buildOptinMail(
  text: string,
  unsubToken: string
): { text: string; headers: Record<string, string> } {
  return {
    text: text + unsubscribeFooter(unsubToken),
    headers: unsubscribeHeaders(unsubToken),
  };
}

/**
 * Single send path for confirmation and update mail. Update mail is refused
 * unless status is confirmed. Always attaches List-Unsubscribe headers and
 * a visible unsubscribe link. Does not invent marketing copy.
 */
export async function sendOptinMail(
  env: EmailOptinEnv,
  opts: {
    to: string;
    subject: string;
    text: string;
    unsubToken: string;
    kind: OptinMailKind;
    status?: string;
  },
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  if (opts.kind === "update" && !canReceiveMarketing(opts.status ?? ""))
    return false;
  if (!optinSendEnabled(env)) return false;
  const mail = buildOptinMail(opts.text, opts.unsubToken);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      signal: ctl.signal,
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_OPTIN_FROM,
        to: [opts.to],
        subject: opts.subject,
        text: mail.text,
        headers: mail.headers,
      }),
    });
    if (!res.ok)
      console.log(
        JSON.stringify({ event: "email_optin_send_failed", status: res.status })
      );
    return res.ok;
  } catch {
    console.log(
      JSON.stringify({ event: "email_optin_send_failed", status: "network" })
    );
    return false;
  } finally {
    clearTimeout(t);
  }
}

export async function sendConfirmEmail(
  env: EmailOptinEnv,
  to: string,
  token: string,
  unsubToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  return sendOptinMail(
    env,
    {
      to,
      subject: EMAIL_OPTIN_SUBJECT,
      text: confirmEmailText(token),
      unsubToken,
      kind: "confirm",
    },
    fetchImpl
  );
}

/** Future update mail. Refuses unless the row is confirmed. Not wired to a public route. */
export async function sendUpdateEmail(
  env: EmailOptinEnv,
  opts: {
    to: string;
    subject: string;
    text: string;
    unsubToken: string;
    status: string;
  },
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  return sendOptinMail(env, { ...opts, kind: "update" }, fetchImpl);
}

export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      first?<T = Record<string, unknown>>(): Promise<T | null>;
    };
  };
}

export const PURGE_SQL =
  "DELETE FROM email_optins WHERE status = 'pending' AND consent_at < datetime('now','-30 days')";
/** 10-minute resend floor: an existing pending row is only refreshed (and re-sent) after 10 min. */
export const UPSERT_SQL =
  "INSERT INTO email_optins (email, consent_at, status, token_hash, country, unsub_token) VALUES (?1, ?2, 'pending', ?3, ?4, ?5) " +
  "ON CONFLICT(email) DO UPDATE SET consent_at = excluded.consent_at, token_hash = excluded.token_hash, " +
  "country = excluded.country, unsub_token = excluded.unsub_token " +
  "WHERE email_optins.status = 'pending' AND email_optins.consent_at <= datetime(?2,'-10 minutes')";
const CONFIRM_SQL =
  "UPDATE email_optins SET status = 'confirmed', token_hash = NULL WHERE token_hash = ?1 AND status = 'pending' AND consent_at >= datetime('now','-30 days')";
/** One-click unsubscribe. Matches any status so a repeat click still succeeds. */
export const UNSUBSCRIBE_SQL =
  "UPDATE email_optins SET status = 'unsubscribed', token_hash = NULL, country = NULL WHERE unsub_token = ?1";
/** Only confirmed rows. Never use this (or any send) against pending or unsubscribed. */
export const CONFIRMED_FOR_MARKETING_SQL =
  "SELECT email, country, unsub_token FROM email_optins WHERE status = 'confirmed'";
/** Per-IP fixed window (hashed IP, 1 hour, max RATE_MAX). Same D1, $0. */
export const RATE_MAX = 5;
export const RATE_SQL =
  "INSERT INTO email_optin_rate (ip_hash, window_start, hits) VALUES (?1, ?2, 1) " +
  "ON CONFLICT(ip_hash) DO UPDATE SET " +
  "hits = CASE WHEN email_optin_rate.window_start <= datetime(?2,'-1 hour') THEN 1 ELSE email_optin_rate.hits + 1 END, " +
  "window_start = CASE WHEN email_optin_rate.window_start <= datetime(?2,'-1 hour') THEN ?2 ELSE email_optin_rate.window_start END " +
  "RETURNING hits";
export const RATE_PURGE_SQL =
  "DELETE FROM email_optin_rate WHERE window_start < datetime('now','-1 day')";
export const ALLOWED_ORIGINS = [
  "https://authichain.com",
  "https://www.authichain.com",
];

/** Strip a trailing slash so /email/unsubscribe/ matches the tokenized endpoint. */
export function normalizeOptinPath(p: string): string {
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

export function isEmailOptinPath(p: string): boolean {
  const n = normalizeOptinPath(p);
  return (
    n === EMAIL_OPTIN_PATH ||
    n === EMAIL_OPTIN_CONFIRM_PATH ||
    n === EMAIL_UNSUBSCRIBE_PATH
  );
}

function changes(r: unknown): number {
  const m = (r as { meta?: { changes?: number } } | null)?.meta;
  return typeof m?.changes === "number" ? m.changes : 0;
}

/** Optional ISO 3166-1 alpha-2 code. Returns null when empty, undefined when invalid. */
export function normalizeCountry(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return undefined;
  const c = v.trim().toUpperCase();
  if (c === "") return null;
  return /^[A-Z]{2}$/.test(c) ? c : undefined;
}

const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,24}$/i;

export function isValidEmail(v: unknown): v is string {
  return typeof v === "string" && v.length <= 254 && EMAIL_RE.test(v);
}

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Rate-limit IP hash. Salted as sha256(IP_HASH_SALT + ':' + ip).
 * Unset or empty salt: NULL (fail closed — never store an unsalted hash).
 */
export async function hashOptinIp(
  salt: string | undefined,
  ip: string
): Promise<string | null> {
  if (typeof salt !== "string" || salt === "") return null;
  return sha256Hex(salt + ":" + ip);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function html(body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>AuthiChain</title></head><body>${body}</body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}

/** Returns null when the path is not ours. Datetimes are SQLite UTC text. */
export async function tryHandleEmailOptin(
  request: Request,
  env: EmailOptinEnv,
  now: Date = new Date(),
  fetchImpl: typeof fetch = fetch
): Promise<Response | null> {
  const db = env.DB;
  const url = new URL(request.url);
  const pathname = normalizeOptinPath(url.pathname);
  if (pathname === EMAIL_OPTIN_CONFIRM_PATH) {
    if (request.method === "GET" || request.method === "HEAD") {
      // GET never confirms (link scanners prefetch). It shows a button that POSTs.
      const token = url.searchParams.get("token") || "";
      if (!/^[a-f0-9]{64}$/.test(token))
        return html("<p>This link is not valid.</p>", 400);
      return html(
        `<form method="post" action="${EMAIL_OPTIN_CONFIRM_PATH}"><input type="hidden" name="token" value="${token}"><button type="submit">Confirm my email</button></form>`
      );
    }
    if (request.method !== "POST")
      return json({ error: "method_not_allowed" }, 405);
    let token = "";
    try {
      token = String((await request.formData()).get("token") || "");
    } catch {
      /* fallthrough */
    }
    if (!/^[a-f0-9]{64}$/.test(token))
      return html("<p>This link is not valid.</p>", 400);
    if (!db) return json({ ok: false }, 503);
    try {
      await db
        .prepare(CONFIRM_SQL)
        .bind(await sha256Hex(token))
        .run();
    } catch {
      return json({ ok: false }, 503);
    }
    // Same reply whether or not a row matched: no email enumeration.
    return html(
      "<p>Thanks. If this link was valid, your email is confirmed.</p>"
    );
  }
  if (pathname === EMAIL_UNSUBSCRIBE_PATH) {
    if (
      request.method !== "GET" &&
      request.method !== "HEAD" &&
      request.method !== "POST"
    )
      return json({ error: "method_not_allowed" }, 405);
    if (request.method !== "POST") {
      // GET never unsubscribes (link scanners prefetch). It shows a button that POSTs.
      // Same page for known and unknown tokens: no DB read or write here.
      const token = url.searchParams.get("token") || "";
      if (!/^[a-f0-9]{64}$/.test(token))
        return html("<p>This unsubscribe link is not valid.</p>", 400);
      return html(
        `<h1>Unsubscribe</h1><p>Click the button to stop emails to this address.</p><form method="post" action="${EMAIL_UNSUBSCRIBE_PATH}"><input type="hidden" name="token" value="${token}"><button type="submit">Unsubscribe</button></form>`
      );
    }
    // POST: from the confirm button (form token) or RFC 8058 one-click (query token,
    // body "List-Unsubscribe=One-Click").
    let token = url.searchParams.get("token") || "";
    if (!token) {
      try {
        const t = new URLSearchParams(await request.text()).get("token");
        if (t) token = t;
      } catch {
        /* fall through to 400 */
      }
    }
    if (!/^[a-f0-9]{64}$/.test(token))
      return html("<p>This unsubscribe link is not valid.</p>", 400);
    if (!db)
      return html(
        "<p>This page is unavailable right now. Please try again later.</p>",
        503
      );
    let n = 0;
    try {
      n = changes(await db.prepare(UNSUBSCRIBE_SQL).bind(token).run());
    } catch {
      return html(
        "<p>This page is unavailable right now. Please try again later.</p>",
        503
      );
    }
    if (n === 0) return html("<p>This unsubscribe link is not valid.</p>", 404);
    return html(
      "<p>You are unsubscribed. We will not send you more emails at this address.</p>"
    );
  }
  if (pathname !== EMAIL_OPTIN_PATH) return null;
  if (request.method !== "POST")
    return json({ error: "method_not_allowed" }, 405);
  if (!ALLOWED_ORIGINS.includes(request.headers.get("origin") || ""))
    return json({ ok: false, error: "forbidden_origin" }, 403);
  const ct = request.headers.get("content-type") || "";
  const isForm = !ct.includes("application/json");
  // Plain form posts (no JS) get a small HTML page, never raw JSON.
  const reply = (ok: boolean, status: number, error?: string) =>
    isForm
      ? html(
          ok
            ? '<p>Saved. Your email is not confirmed yet.</p><p><a href="/dpp-check">Back to the check</a></p>'
            : '<p>We could not save your email. Please go back and try again.</p><p><a href="/dpp-check">Back to the check</a></p>',
          status
        )
      : json(
          ok
            ? { ok: true, status: "pending" }
            : { ok: false, ...(error ? { error } : {}) },
          status
        );
  let body: Record<string, unknown> = {};
  try {
    if (!isForm) body = (await request.json()) as Record<string, unknown>;
    else body = Object.fromEntries((await request.formData()).entries());
  } catch {
    return reply(false, 400, "bad_request");
  }
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isValidEmail(email)) return reply(false, 400, "invalid_email");
  if (body.consent !== "yes" && body.consent !== true && body.consent !== "on")
    return reply(false, 400, "consent_required");
  const country = normalizeCountry(body.country);
  if (country === undefined) return reply(false, 400, "invalid_country");
  if (!db) return reply(false, 503, "unavailable");
  const consentAt = now.toISOString().replace("T", " ").slice(0, 19);
  const raw = [...crypto.getRandomValues(new Uint8Array(32))]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  const unsub = [...crypto.getRandomValues(new Uint8Array(32))]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  let fresh = false;
  try {
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const rate = await db
      .prepare(RATE_SQL)
      .bind(await hashOptinIp(env.IP_HASH_SALT, ip), consentAt)
      .first?.<{ hits: number }>();
    if (rate && rate.hits > RATE_MAX) return reply(false, 429, "rate_limited");
    await db.prepare(RATE_PURGE_SQL).bind().run();
    await db.prepare(PURGE_SQL).bind().run();
    fresh =
      changes(
        await db
          .prepare(UPSERT_SQL)
          .bind(email, consentAt, await sha256Hex(raw), country, unsub)
          .run()
      ) > 0;
  } catch {
    return reply(false, 503, "unavailable");
  }
  // Send only when a row was actually written/refreshed (meta.changes > 0).
  if (fresh) await sendConfirmEmail(env, email, raw, unsub, fetchImpl);
  return reply(true, 202);
}

/** Small optional block for free-check pages. Separate form: the check never depends on it. */
export function emailOptinBlock(id: string): string {
  return `<form class="email-optin" id="${id}" action="${EMAIL_OPTIN_PATH}" method="post">
  <label for="${id}-email">Email (optional)</label>
  <input type="email" id="${id}-email" name="email" maxlength="254" autocomplete="email">
  <label for="${id}-country">Country (optional, 2-letter code, e.g. US)</label>
  <input type="text" id="${id}-country" name="country" maxlength="2" pattern="[A-Za-z]{2}" autocomplete="country" style="text-transform:uppercase">
  <label class="small"><input type="checkbox" name="consent" value="yes"> ${EMAIL_OPTIN_CONSENT_TEXT}</label>
  <p class="small">${EMAIL_OPTIN_PRIVACY_LINE}</p>
  <button type="submit">Save my email</button>
  <p class="small" role="status" aria-live="polite"></p>
</form>
<script>(function(){var f=document.getElementById("${id}");if(!f||!window.fetch)return;f.addEventListener("submit",function(e){e.preventDefault();var st=f.querySelector("[role=status]");
if(!f.consent.checked){st.textContent="To save your email, tick the box.";return}
fetch(f.action,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:f.email.value.trim(),country:f.country.value.trim().toUpperCase(),consent:"yes"})})
.then(function(r){st.textContent=r.ok?"Saved. Your email is not confirmed yet.":"We could not save your email. Please try again."})
.catch(function(){st.textContent="We could not save your email. Please try again."})})})();</script>`;
}
