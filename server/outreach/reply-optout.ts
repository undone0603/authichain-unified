// server/outreach/reply-optout.ts
//
// Decide whether an inbound reply to cold email is an opt-out, and who sent
// it. Pure functions, no Node imports: used by the edge router's Resend inbound
// webhook (worker-app/inbound-routes.ts).
//
// Only the new part of the reply is read. Every cold email carries
// "Unsubscribe: <link>" in its footer, so a reply that quotes the original
// would otherwise always look like an opt-out.

/**
 * Same intent as worker/outreach-loop.ts's negative-reply rule: an explicit
 * opt-out, or a plain "don't contact me". Either way the address is not
 * emailed again.
 */
export const OPT_OUT_REPLY =
  /\b(?:unsubscribe|opt[\s-]?out|remove me|take me off|stop (?:emailing|e-mailing|sending|contacting)|do not (?:email|e-mail|contact)|don['’]?t (?:email|e-mail|contact)|not interested|no thanks|wrong person|leave me alone)\b/i;

const QUOTE_START = [
  /^On .{0,200}wrote:\s*$/i, // Gmail / Apple Mail
  /^-{2,}\s*Original Message\s*-{2,}/i, // Outlook
  /^_{5,}\s*$/, // Outlook separator line
  /^From:\s.+/i, // forwarded/quoted header block
  /^Sent from my /i, // mobile signature
];

/** The part of a plain-text reply the sender wrote, without quoted history. */
export function newReplyText(text: string): string {
  const out: string[] = [];
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (QUOTE_START.some(re => re.test(trimmed))) break;
    if (trimmed.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}

/** Crude HTML to text for replies that arrive without a text part. */
export function htmlReplyToText(html: string): string {
  return String(html ?? "")
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "\n")
    .replace(/<div class="gmail_quote"[\s\S]*$/i, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

export function wantsOptOut(reply: {
  subject?: string | null;
  text?: string | null;
  html?: string | null;
}): boolean {
  const subject = String(reply.subject ?? "").replace(
    /^\s*((re|fw|fwd)\s*:\s*)+/i,
    ""
  );
  // A mailto opt-out arrives with subject "unsubscribe". None of the outbound
  // subjects in scripts/lib/b2b-templates.ts use these words, so "Re: <ours>"
  // doesn't match.
  if (OPT_OUT_REPLY.test(subject)) return true;
  const body = reply.text?.trim()
    ? newReplyText(reply.text)
    : newReplyText(htmlReplyToText(reply.html ?? ""));
  // Only the first few hundred characters: an opt-out is short and early.
  return OPT_OUT_REPLY.test(body.slice(0, 600));
}

/** Address from "Name <addr@x>", "<addr@x>", "addr@x" or { email }. */
export function senderAddress(from: unknown): string | null {
  const raw =
    typeof from === "string"
      ? from
      : from && typeof from === "object" && "email" in from
        ? String((from as { email: unknown }).email ?? "")
        : "";
  const open = raw.lastIndexOf("<");
  const close = raw.indexOf(">", open);
  const addr = (open >= 0 && close > open ? raw.slice(open + 1, close) : raw)
    .trim()
    .toLowerCase();
  return /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(addr) ? addr : null;
}
