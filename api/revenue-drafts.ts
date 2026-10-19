/**
 * Safe port of 40516a11's "autonomous outbound loop" (deployed as 5df56664).
 *
 * What 40516a11 did on an hourly cron: asked Anthropic for an EU Digital
 * Product Passport (DPP) JSON payload, created a Stripe Checkout session
 * for a hard-coded lead, and logged it as "outbound".
 *
 * What this port does instead, on demand only (POST /outbound/draft, behind
 * WORKER_API_KEY), with no network calls at all:
 * - builds the DPP payload from a fixed, deterministic template (no LLM);
 * - builds an outreach email as a DRAFT object that is returned to the
 *   caller. Nothing is sent: there is no email provider, no Stripe call and
 *   no scheduled() handler. A human reviews and sends drafts elsewhere.
 */

export const LIMITS = { company: 120, product: 120, email: 254, name: 100 } as const;

export function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;

export interface DppPayload {
  schema: "eu-dpp/draft-1";
  status: "draft";
  passport_id: string;
  economic_operator: { name: string };
  product: { name: string; category: string };
  required_sections: string[];
  authichain: { seal: "pending"; verify_url: string };
}

export interface OutreachDraft {
  status: "draft";
  sent: false;
  to: string;
  subject: string;
  body: string;
}

async function stableId(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildDppPayload(
  company: string,
  product: string,
  appUrl: string
): Promise<DppPayload> {
  const id = await stableId(`${company.toLowerCase()}|${product.toLowerCase()}`);
  return {
    schema: "eu-dpp/draft-1",
    status: "draft",
    passport_id: `dpp_${id}`,
    economic_operator: { name: company },
    product: { name: product, category: "unspecified" },
    // Sections the ESPR DPP asks for; values are filled in with the brand.
    required_sections: [
      "unique_product_identifier",
      "materials_and_substances",
      "manufacturing_origin",
      "repair_and_end_of_life",
      "compliance_documentation",
    ],
    authichain: { seal: "pending", verify_url: `${appUrl}/verify` },
  };
}

export function buildOutreachDraft(input: {
  email: string;
  name: string;
  company: string;
  product: string;
  passportId: string;
  appUrl: string;
}): OutreachDraft {
  const first = input.name.split(" ")[0] || "there";
  return {
    status: "draft",
    sent: false,
    to: input.email,
    subject: `${input.company}: a draft Digital Product Passport for ${input.product}`,
    body: [
      `Hi ${first},`,
      "",
      `We put together a draft EU Digital Product Passport outline for ${input.product} (ref ${input.passportId}). It lists the sections the passport needs and links each unit to an AuthiChain authenticity seal.`,
      "",
      `Plans and pricing: ${input.appUrl}/pricing`,
      "",
      "Happy to walk through it if useful.",
    ].join("\n"),
  };
}

export async function handleOutboundDraft(
  req: Request,
  env: { NEXT_PUBLIC_APP_URL: string }
): Promise<Response> {
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const email = clean(body.email, LIMITS.email).toLowerCase();
  const company = clean(body.company, LIMITS.company);
  const product = clean(body.product, LIMITS.product) || "flagship product";
  const name = clean(body.name, LIMITS.name);
  if (!EMAIL_RE.test(email) || !company)
    return json({ error: "email and company are required" }, 400);

  const appUrl = (env.NEXT_PUBLIC_APP_URL || "https://authichain.com").replace(/\/+$/, "");
  const passport = await buildDppPayload(company, product, appUrl);
  const draft = buildOutreachDraft({
    email,
    name,
    company,
    product,
    passportId: passport.passport_id,
    appUrl,
  });
  return json({ passport, draft });
}
