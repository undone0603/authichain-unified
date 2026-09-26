/**
 * Email copy for scripts/b2b-cold-outreach.ts, kept apart from the script
 * (which runs its main routine at import time) so tests can render every
 * template against every target and run it through the claim checker.
 *
 * Rules for editing, learned from what the previous copy said:
 *
 * - State only what a recipient can check on a public page or in
 *   src/lib/plans.ts. Earlier versions told defence contractors that "C3PAOs
 *   are increasingly flagging" a gap and promised a "DFARS 252.204-7012 /
 *   NIST 800-171 audit trail"; told cannabis MSOs about a "METRC sync" and an
 *   "ISO 18013-5" passport export (18013-5 is the mobile driving licence
 *   standard); and offered QRON's "white-label API from $0.002/QR", which no
 *   price in the catalogue backs. None of that was true.
 * - Prices and payment links come from plans.ts. The old StrainChain link
 *   ("StrainChain Basic", buy.stripe.com/9B6cN5...) is not a plan anywhere in
 *   the catalogue.
 * - Research notes are for us, not for the recipient. The partner email used
 *   to paste `notes` into the body, which put lines like "Published contact@
 *   and 734-999-4010 on existosolutions.com. Channel for StrainChain, not an
 *   MSO end-buyer." in front of the prospect.
 * - Greet a person by first name only when the target's name is a person.
 *   "Hi Head," and "Hi Dr.," were both possible before.
 *
 * guardedSend runs server/outreach/claims.ts on every send, so a regression
 * here is refused at send time; the tests catch it before that.
 */
import { paymentLinkWithPrefilledEmail } from "../../src/lib/checkout-email";
import { planPaymentLink } from "../../src/lib/plans";

export interface EmailDraft {
  subject: string;
  html: string;
}

export interface CopyTarget {
  company: string;
  name?: string;
  email: string;
}

const CALENDLY = process.env.CALENDLY_LINK ?? "https://app.authichain.com/book";

const SENDER = process.env.OUTREACH_SENDER_NAME ?? "Zachary Kietzman";

const HONORIFICS = /^(dr|mr|mrs|ms|mx|prof)\.?$/i;
const NOT_A_PERSON =
  /\b(head|team|director|manager|lead|officer|chief|vp|president|compliance|product|sales|franchise|innovation|department|desk|support|accelerator|solutions|consulting|signs|inc|llc|ltd|corp|company)\b/i;

/** First name when `name` is a person's name, otherwise null. */
export function personFirstName(name: string | undefined): string | null {
  const n = (name ?? "").trim();
  if (!n || /[@\d]/.test(n) || NOT_A_PERSON.test(n)) return null;
  const parts = n.split(/\s+/).filter(p => !HONORIFICS.test(p));
  if (parts.length < 2) return null; // a single word is usually a company
  return /^[\p{L}][\p{L}'’-]*$/u.test(parts[0]) ? parts[0] : null;
}

function greeting(t: CopyTarget): string {
  const first = personFirstName(t.name);
  return first ? `Hi ${first},` : "Hello,";
}

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!
  );
}

function wrap(paragraphs: string[]): string {
  return `
<div style="font-family:sans-serif;max-width:600px;line-height:1.6;color:#1f2937">
${paragraphs.map(p => `  <p>${p}</p>`).join("\n")}
</div>`;
}

function signature(product: string, site: string): string {
  return `${esc(SENDER)}<br>${product} / AuthiChain<br><a href="https://${site}">${site}</a>`;
}

const CLOSE =
  "If this is not relevant to you, a one-line reply is enough and I won't follow up.";

function bookLink(t: CopyTarget, label: string): string {
  const q = new URLSearchParams({ company: t.company });
  if (personFirstName(t.name)) q.set("name", t.name!);
  return `<a href="${CALENDLY}?${q}">${label}</a>`;
}

export function govchainEmail(t: CopyTarget): EmailDraft {
  return {
    subject: `Signed custody records for ${t.company} deliverables`,
    html: wrap([
      greeting(t),
      `I'm ${esc(SENDER)}, and I'm building GovChain (<a href="https://govchain.us">govchain.us</a>), part of a small company called AuthiChain.`,
      `GovChain keeps a signed, time-stamped record of who produced a deliverable and each time it changed hands, so that history can be checked later without taking anyone's word for it.`,
      `I'm writing to ask whether proving that kind of chain of custody, for your own work or your subcontractors', is a problem ${esc(t.company)} actually has. If it is, I'd value 20 minutes to hear how you handle it today: ${bookLink(t, "pick a time here")}, or just reply.`,
      CLOSE,
      signature("GovChain", "govchain.us"),
    ]),
  };
}

export function strainchainEmail(t: CopyTarget): EmailDraft {
  const passport = planPaymentLink("strainchain_passport");
  const passportLink = passport
    ? ` A single passport is $49 per cultivar if you would rather <a href="${paymentLinkWithPrefilledEmail(
        `${passport}?utm_source=email&utm_medium=b2b&utm_campaign=strainchain`,
        t.email
      )}">try one yourself</a>.`
    : "";
  return {
    subject: `Genetics passports built from ${t.company}'s lab certificates`,
    html: wrap([
      greeting(t),
      `I'm ${esc(SENDER)}, and I'm building StrainChain (<a href="https://strainchain.io">strainchain.io</a>), part of a small company called AuthiChain.`,
      `StrainChain publishes a genetics passport for a cultivar, built from the certificates of analysis you already have. It shows the full cannabinoid and terpene panel, recomputes every total from the source panel instead of copying it, and comes with a QR code and a link you can put on packaging or a menu.`,
      `Would that be useful for ${esc(t.company)}? I'd be glad to walk through one with you: ${bookLink(t, "book 20 minutes")}, or reply.${passportLink}`,
      CLOSE,
      signature("StrainChain", "strainchain.io"),
    ]),
  };
}

export function qronEmail(t: CopyTarget): EmailDraft {
  const creator = planPaymentLink("creator");
  const creatorLink = creator
    ? ` If you'd rather try it on real jobs, the <a href="${paymentLinkWithPrefilledEmail(
        `${creator}?utm_source=email&utm_medium=b2b&utm_campaign=qron`,
        t.email
      )}">Creator Pack</a> is $99 for 500 generations.`
    : "";
  return {
    subject: `Styled QR codes for ${t.company}`,
    html: wrap([
      greeting(t),
      `I'm ${esc(SENDER)}, and I'm building QRON (<a href="https://qron.space">qron.space</a>), part of a small company called AuthiChain.`,
      `QRON generates styled QR codes from a text prompt, and each code is signed so a scan can show where it came from. You can try it at <a href="https://qron.space/demo">qron.space/demo</a> and judge the result yourself.`,
      `I'm writing because ${esc(t.company)} prints for a lot of businesses, and I'd like to know whether styled QR codes are something their customers ask for. ${bookLink(t, "Book 10 minutes")} or reply.${creatorLink}`,
      CLOSE,
      signature("QRON", "qron.space"),
    ]),
  };
}

export interface PartnerCopyTarget extends CopyTarget {
  segment: "govchain" | "qron" | "strainchain";
}

export function partnerEmail(t: PartnerCopyTarget): EmailDraft {
  const product =
    t.segment === "govchain"
      ? "GovChain"
      : t.segment === "qron"
        ? "QRON"
        : "StrainChain";
  return {
    subject: `Partnership question: ${product} and ${t.company}`,
    html: wrap([
      greeting(t),
      `I'm ${esc(SENDER)}, founder of AuthiChain, a small company that builds ${product}.`,
      `${esc(t.company)} works with the kind of businesses ${product} is built for, so I'm asking whether a referral or implementation partnership would make sense to you. It is a partnership question, not a sales pitch.`,
      `If it's worth a conversation, ${bookLink(t, "book 15 minutes")} or reply. If there is a better person to ask, I'd be grateful for their name.`,
      CLOSE,
      signature(product, "authichain.com"),
    ]),
  };
}
