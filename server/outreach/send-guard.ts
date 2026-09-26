// server/outreach/send-guard.ts
// Verified-only outbound guard. The core defense against blasting fabricated /
// pattern-guessed addresses (e.g. scraped "bernard.arnault@lvmh.com") is
// PROVENANCE, not deliverability: a guessed address passes an MX check because
// the domain is real. So we only send to recipients whose source is trusted
// (Apollo-verified, inbound opt-in, or a confirmed reply), with format + MX as a
// secondary gate, and a mandatory CAN-SPAM unsubscribe footer.
import { promises as dns } from "node:dns";
import { recordDryRunSend } from "../email-service";
import { checkClaims, htmlToText } from "./claims";
import { signedUnsubscribeUrl } from "./unsubscribe-link";

import {
  assessRecipient,
  canSend,
  type RecipientAssessment,
  type VerificationSource,
} from "./recipient-rules";

// The provenance rules live in ./recipient-rules so Cloudflare Workers can
// share them without pulling in node:dns. Re-exported here so existing
// importers of send-guard keep working unchanged.
export {
  assessRecipient,
  canSend,
  isGovernmentOrMilitaryAddress,
  isRoleInboxEmail,
  TRUSTED_SOURCES,
  type AssessRecipientOptions,
  type RecipientAssessment,
  type VerificationSource,
} from "./recipient-rules";

/** Secondary gate: does the domain actually accept mail (has MX records)? */
export async function domainAcceptsMail(email: string): Promise<boolean> {
  const domain = email.split("@")[1];
  if (!domain) return false;
  try {
    const mx = await dns.resolveMx(domain);
    return mx.length > 0;
  } catch {
    return false;
  }
}

/**
 * Where the unsubscribe link points when the caller configures nothing.
 *
 * This used to default to https://authichain.com/unsubscribe, a route that has
 * never existed, so every guarded send carried a dead opt-out link. A reply
 * address is a valid CAN-SPAM opt-out mechanism only if someone reads the
 * inbox: worker/outreach-loop.ts can classify "unsubscribe" replies, but it is
 * not wired to any deployed route, so guardedSend refuses a mailto-only send
 * unless OUTREACH_ALLOW_MAILTO_OPTOUT=true (see optOutIsRecordable). Prefer
 * OUTREACH_UNSUBSCRIBE_SECRET, which gives every send a signed one-click link.
 */
export function defaultUnsubscribeUrl(replyTo: string): string {
  // "Name <addr@x>" → "addr@x", without a backtracking regex.
  const open = replyTo.lastIndexOf("<");
  const close = replyTo.indexOf(">", open);
  const address = (
    open >= 0 && close > open ? replyTo.slice(open + 1, close) : replyTo
  ).trim();
  return `mailto:${address}?subject=unsubscribe`;
}

export type OptOutKind = "signed_link" | "configured_url" | "mailto";

/**
 * Which opt-out a send carries, most recordable first:
 *
 * 1. an explicit `unsubscribeUrl` from the caller;
 * 2. a per-recipient signed link, when OUTREACH_UNSUBSCRIBE_SECRET is set. The
 *    edge router verifies it and writes guardrail_suppression_list, the table
 *    the send gate reads (worker-app/unsubscribe-routes.ts);
 * 3. UNSUBSCRIBE_URL, a page the operator says records opt-outs;
 * 4. `mailto:<reply-to>`, which nothing deployed processes automatically.
 */
export async function resolveUnsubscribeUrl(opts: {
  explicit?: string;
  email: string;
  replyTo: string;
  env?: Record<string, string | undefined>;
}): Promise<{ url: string; kind: OptOutKind }> {
  const env = opts.env ?? process.env;
  const kindOf = (url: string): OptOutKind =>
    url.startsWith("mailto:") ? "mailto" : "configured_url";
  if (opts.explicit) return { url: opts.explicit, kind: kindOf(opts.explicit) };
  const secret = env.OUTREACH_UNSUBSCRIBE_SECRET;
  if (secret) {
    return {
      url: await signedUnsubscribeUrl({
        secret,
        email: opts.email,
        origin: env.UNSUBSCRIBE_ORIGIN,
      }),
      kind: "signed_link",
    };
  }
  if (env.UNSUBSCRIBE_URL) {
    return { url: env.UNSUBSCRIBE_URL, kind: kindOf(env.UNSUBSCRIBE_URL) };
  }
  return { url: defaultUnsubscribeUrl(opts.replyTo), kind: "mailto" };
}

/**
 * A mailto opt-out is only acceptable when someone has said they process that
 * inbox by hand (OUTREACH_ALLOW_MAILTO_OPTOUT=true). CAN-SPAM gives ten business
 * days to honor an opt-out; an unread inbox honors none.
 */
export function optOutIsRecordable(
  kind: OptOutKind,
  env: Record<string, string | undefined> = process.env
): boolean {
  return kind !== "mailto" || env.OUTREACH_ALLOW_MAILTO_OPTOUT === "true";
}

/** CAN-SPAM compliant footer — physical address + working unsubscribe are required. */
export function unsubscribeFooter(opts: {
  company: string;
  address: string;
  unsubscribeUrl: string;
}): string {
  return `\n\n—\n${opts.company}\n${opts.address}\nUnsubscribe: ${opts.unsubscribeUrl}`;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!
  );
}

/**
 * HTML twin of `unsubscribeFooter`. An HTML message whose postal address only
 * exists in the plain-text alternative is not compliant for the recipients who
 * read the HTML part — which is nearly all of them.
 */
export function unsubscribeFooterHtml(opts: {
  company: string;
  address: string;
  unsubscribeUrl: string;
}): string {
  return (
    `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px">` +
    `<p style="font-size:12px;color:#9ca3af;line-height:1.5;margin:0">` +
    `${escapeHtml(opts.company)}<br>${escapeHtml(opts.address)}<br>` +
    `<a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#9ca3af">Unsubscribe</a>` +
    `</p>`
  );
}

export interface GuardedSendResult {
  sent: boolean;
  reason?: string;
  /** Resend message id, present only on a successful send. */
  id?: string;
  assessment: RecipientAssessment;
}

/**
 * Whether a guardedSend result should count against MAX_LIVE_SENDS.
 * Immediate policy refuses (role_inbox, untrusted source, no MX, missing
 * config) must not burn the cap — only a real Resend attempt does.
 */
export function countsAsLiveSendAttempt(res: GuardedSendResult): boolean {
  if (res.sent) return true;
  const reason = res.reason ?? "";
  return reason.startsWith("resend_http_");
}

/**
 * Send via Resend ONLY if the recipient passes the provenance guard + MX check.
 * Pattern-guessed/scraped addresses are rejected before any network call, so the
 * fabricated CRM contacts can never be emailed.
 */
export async function guardedSend(args: {
  to: string;
  source: VerificationSource;
  subject: string;
  /** Plain-text body. Optional only when `html` is supplied. */
  body?: string;
  /** HTML body. The CAN-SPAM footer is appended to this too, not just to text. */
  html?: string;
  from?: string;
  replyTo?: string;
  company?: string;
  address?: string;
  unsubscribeUrl?: string;
  /**
   * Credential to send with. The verified sending domains are split across two
   * Resend accounts, so the caller resolves which one owns `from` (see
   * scripts/lib/resend-preflight.ts) and passes it here. Falls back to
   * RESEND_API_KEY for callers that only ever use the first account.
   */
  apiKey?: string;
  /** See AssessRecipientOptions.allowRoleInbox — partners only. */
  allowRoleInbox?: boolean;
}): Promise<GuardedSendResult> {
  const assessment = assessRecipient(args.to, args.source, {
    allowRoleInbox: args.allowRoleInbox === true,
  });
  if (!canSend(assessment)) {
    return { sent: false, reason: assessment.reasons.join(","), assessment };
  }
  if (!(await domainAcceptsMail(assessment.email))) {
    return { sent: false, reason: "no_mx", assessment };
  }

  const apiKey = args.apiKey ?? process.env.RESEND_API_KEY;
  if (!apiKey)
    return { sent: false, reason: "resend_not_configured", assessment };

  // CAN-SPAM requires a valid physical postal address in every commercial email.
  // Fail CLOSED if none is configured, rather than ship a placeholder — so
  // autopilot can never send a non-compliant message.
  const address = args.address ?? process.env.MAILING_ADDRESS;
  if (!address) {
    return {
      sent: false,
      reason: "mailing_address_not_configured",
      assessment,
    };
  }
  const replyTo =
    args.replyTo ?? process.env.RESEND_REPLY_TO ?? "hello@authichain.com";
  const optOut = await resolveUnsubscribeUrl({
    explicit: args.unsubscribeUrl,
    email: assessment.email,
    replyTo,
  });
  const unsubscribeUrl = optOut.url;

  const footerOpts = {
    company: args.company ?? "AuthiChain",
    address,
    unsubscribeUrl,
  };
  const footer = unsubscribeFooter(footerOpts);

  if (args.body === undefined && args.html === undefined) {
    return { sent: false, reason: "no_body", assessment };
  }

  // Refuse copy that states awards, customers, statistics, certifications or
  // prior contact that nobody can back. See ./claims.ts for the rules and the
  // emails that prompted each one.
  const visibleText = [args.body ?? "", args.html ? htmlToText(args.html) : ""]
    .join("\n")
    .trim();
  const violations = checkClaims(args.subject, visibleText);
  if (violations.length > 0) {
    return {
      sent: false,
      reason: violations.map(v => `claim:${v.rule}:${v.match}`).join(","),
      assessment,
    };
  }

  // An opt-out nobody records is not an opt-out. Checked before the dry-run
  // stop so a dry run reports this the way a live run would.
  if (!optOutIsRecordable(optOut.kind)) {
    return { sent: false, reason: "optout_not_recordable", assessment };
  }

  // Last stop before the network. Placed after every guard above so a dry run
  // reports what a live run would really do: a recipient rejected by
  // assessRecipient(), a domain with no MX, or a missing postal address is
  // reported as blocked rather than as "would send".
  if (
    recordDryRunSend({
      to: assessment.email,
      subject: args.subject,
      body: args.body ?? args.html ?? "",
    })
  ) {
    return { sent: false, reason: "dry_run", assessment };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // A cold email from noreply@ with no reply-to cannot be replied to at all,
      // and mailbox providers treat the combination as a spam signal. Outreach has
      // recorded zero replies ever against a 16% bounce rate; this is part of why.
      // RESEND_FROM should be a human, monitored address on an authenticated
      // sending domain — see docs/outreach-deliverability-runbook.md.
      from:
        args.from ??
        process.env.RESEND_FROM ??
        "AuthiChain <hello@authichain.com>",
      reply_to: replyTo,
      to: assessment.email,
      subject: args.subject,
      ...(args.body !== undefined ? { text: args.body + footer } : {}),
      ...(args.html !== undefined
        ? { html: args.html + unsubscribeFooterHtml(footerOpts) }
        : {}),
      // List-Unsubscribe (RFC 2369). The One-Click POST header (RFC 8058) is
      // only valid alongside an https URI that accepts the POST, so a mailto
      // opt-out goes without it.
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        ...(unsubscribeUrl.startsWith("https://")
          ? { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
          : {}),
      },
    }),
  });

  if (!res.ok)
    return { sent: false, reason: `resend_http_${res.status}`, assessment };

  const payload = (await res.json().catch(() => ({}))) as { id?: string };
  return { sent: true, id: payload.id, assessment };
}
