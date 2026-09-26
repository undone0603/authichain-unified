// Outreach templates. These live in code, not in the D1 `templates` table, so
// every word that reaches a prospect goes through code review, and the tests
// run each one through the claim checker.
//
// Rules for editing:
// - Say only what the linked public pages show. The recipient can check
//   https://authichain.com/protocol and https://authichain.com/anchor themselves.
// - No customers, contracts, awards, certifications or statistics. See claims.ts.
// - One email per lead, no automated follow-ups, so "I won't follow up" is true.
//   If follow-ups are ever added, that sentence has to change with them.

export type Segment = "pharma" | "luxury" | "cannabis" | "general";

export interface Template {
  segment: Segment;
  subject: string;
  body: string;
}

const CORE = [
  "I'm {{sender_name}}, founder of AuthiChain, a small company building product-authentication tools.",
  "",
  "AuthiChain gives each product or batch a QR code that opens a verification record anyone can check in a browser. How the verification works is published at https://authichain.com/protocol, so you can evaluate it yourself, and you can anchor a first product for free at https://authichain.com/anchor.",
].join("\n");

const CLOSE = [
  "",
  "If that is not relevant, a one-word reply is enough and I won't follow up.",
  "",
  "{{sender_name}}",
  "AuthiChain",
].join("\n");

function body(problemLine: string): string {
  return ["Hi {{first_name}},", "", "{{personal_note}}" + CORE, "", problemLine, CLOSE].join(
    "\n"
  );
}

export const TEMPLATES: Record<Segment, Template> = {
  pharma: {
    segment: "pharma",
    subject: "Batch-level authenticity records for {{company}}",
    body: body(
      "If verifying that a lot is genuine, or tracing where it went, is a problem {{company}} is working on, would a 15-minute call be useful?"
    ),
  },
  luxury: {
    segment: "luxury",
    subject: "Authenticity records for {{company}} products",
    body: body(
      "If counterfeits or grey-market resale affect {{company}}'s products, would a 15-minute call be useful?"
    ),
  },
  cannabis: {
    segment: "cannabis",
    subject: "Verifiable product records for {{company}}",
    body: body(
      "If showing customers or retailers that a {{company}} product is genuine and matches its lab results would help, would a 15-minute call be useful?"
    ),
  },
  general: {
    segment: "general",
    subject: "Product authenticity records for {{company}}",
    body: body(
      "If counterfeits, or proving where a product came from, matter to {{company}}, would a 15-minute call be useful?"
    ),
  },
};

export function segmentFor(industry: string | null | undefined): Segment {
  const i = (industry ?? "").toLowerCase();
  if (/pharma|health|medical|biotech|drug/.test(i)) return "pharma";
  if (/luxury|watch|jewel|fashion|apparel|collect/.test(i)) return "luxury";
  if (/cannabis|hemp|dispensar|thc|cbd/.test(i)) return "cannabis";
  return "general";
}

export interface RenderValues {
  first_name: string;
  company: string;
  sender_name: string;
  /** A human-written, sourced note. Rendered as its own paragraph with the source link. */
  personal_note?: { text: string; source_url: string } | null;
}

export interface Rendered {
  subject: string;
  body: string;
}

function fill(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : whole
  );
}

/**
 * Fill a template. Unknown or missing values are left as `{{...}}` on purpose:
 * the claim checker's unrendered_placeholder rule then blocks the send, rather
 * than quietly substituting "there" or "your company".
 */
export function renderTemplate(t: Template, v: RenderValues): Rendered {
  const note = v.personal_note
    ? `${v.personal_note.text.trim()} (${v.personal_note.source_url.trim()})\n\n`
    : "";
  const values: Record<string, string> = { personal_note: note };
  if (v.first_name.trim()) values.first_name = v.first_name.trim();
  if (v.company.trim()) values.company = v.company.trim();
  if (v.sender_name.trim()) values.sender_name = v.sender_name.trim();
  return { subject: fill(t.subject, values), body: fill(t.body, values) };
}
