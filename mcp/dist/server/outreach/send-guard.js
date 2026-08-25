// server/outreach/send-guard.ts
// Verified-only outbound guard. The core defense against blasting fabricated /
// pattern-guessed addresses (e.g. scraped "bernard.arnault@lvmh.com") is
// PROVENANCE, not deliverability: a guessed address passes an MX check because
// the domain is real. So we only send to recipients whose source is trusted
// (Apollo-verified, inbound opt-in, or a confirmed reply), with format + MX as a
// secondary gate, and a mandatory CAN-SPAM unsubscribe footer.
import { promises as dns } from "node:dns";
const TRUSTED_SOURCES = new Set([
    "apollo_verified",
    "reacher_verified",
    "inbound_optin",
    "confirmed_reply",
]);
// Generic/role inboxes — never a real decision-maker; reject so we don't hit
// support queues (the info@ auto-responder problem).
const ROLE_LOCALPARTS = new Set([
    "info", "support", "help", "contact", "sales", "admin", "hello",
    "billing", "noreply", "no-reply", "team", "office",
]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Pure provenance + format assessment (no network). */
export function assessRecipient(email, source) {
    const reasons = [];
    const normalized = (email || "").trim().toLowerCase();
    const validFormat = EMAIL_RE.test(normalized);
    if (!validFormat)
        reasons.push("invalid_format");
    const localPart = normalized.split("@")[0] ?? "";
    const isRoleInbox = ROLE_LOCALPARTS.has(localPart);
    if (isRoleInbox)
        reasons.push("role_inbox");
    const trustedSource = TRUSTED_SOURCES.has(source);
    if (!trustedSource)
        reasons.push(`untrusted_source:${source}`);
    const status = validFormat && trustedSource && !isRoleInbox ? "allow" : "reject";
    return { email: normalized, source, validFormat, trustedSource, isRoleInbox, status, reasons };
}
export function canSend(a) {
    return a.status === "allow";
}
/** Secondary gate: does the domain actually accept mail (has MX records)? */
export async function domainAcceptsMail(email) {
    const domain = email.split("@")[1];
    if (!domain)
        return false;
    try {
        const mx = await dns.resolveMx(domain);
        return mx.length > 0;
    }
    catch {
        return false;
    }
}
/** CAN-SPAM compliant footer — physical address + working unsubscribe are required. */
export function unsubscribeFooter(opts) {
    return `\n\n—\n${opts.company}\n${opts.address}\nUnsubscribe: ${opts.unsubscribeUrl}`;
}
/**
 * Send via Resend ONLY if the recipient passes the provenance guard + MX check.
 * Pattern-guessed/scraped addresses are rejected before any network call, so the
 * fabricated CRM contacts can never be emailed.
 */
export async function guardedSend(args) {
    const assessment = assessRecipient(args.to, args.source);
    if (!canSend(assessment)) {
        return { sent: false, reason: assessment.reasons.join(","), assessment };
    }
    if (!(await domainAcceptsMail(assessment.email))) {
        return { sent: false, reason: "no_mx", assessment };
    }
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey)
        return { sent: false, reason: "resend_not_configured", assessment };
    const footer = unsubscribeFooter({
        company: args.company ?? "AuthiChain",
        address: args.address ?? process.env.MAILING_ADDRESS ?? "AuthiChain, [physical address required]",
        unsubscribeUrl: args.unsubscribeUrl ?? process.env.UNSUBSCRIBE_URL ?? "https://authichain.com/unsubscribe",
    });
    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            from: args.from ?? process.env.RESEND_FROM ?? "AuthiChain <noreply@authichain.com>",
            to: assessment.email,
            subject: args.subject,
            text: args.body + footer,
        }),
    });
    return { sent: res.ok, reason: res.ok ? undefined : `resend_http_${res.status}`, assessment };
}
