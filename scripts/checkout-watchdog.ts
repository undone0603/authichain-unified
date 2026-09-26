/**
 * Checkout watchdog: does every pricing card on the live sites still lead to
 * a plan we sell? Runs hourly from .github/workflows/checkout-watchdog.yml.
 *
 * Read-only. Pages and /checkout/<plan> confirm pages are GETs that render
 * HTML and never open a Stripe session (see src/lib/checkout-gate.ts). Stripe
 * is only read (prices, products, payment links). HEAD on /api/checkout/*
 * always answers 204, so it proves nothing about a plan; that is why this
 * exists alongside scripts/production-smoke-gate.ts.
 *
 * What it checks, per live pricing page:
 *   - the page answers 200;
 *   - every checkout link on it names a plan `listedPlans()` still lists
 *     (a card selling an unlisted plan is how Theater went stale);
 *   - every listed paid plan for that brand has a checkout link (a card that
 *     vanished loses sales just as quietly);
 *   - each linked /checkout/<plan> confirm page answers 200 with the price.
 * And, when a live Stripe key is present, per listed paid plan:
 *   - the price and its product are active, the amount matches plans.ts, and
 *     the billing type matches stripe_mode;
 *   - the plan's buy.stripe.com Payment Link (if any) is active.
 *
 * `--fix` applies the only repairs that need no judgement to src/lib/plans.ts:
 * a plan whose Stripe price or product is archived gets `listed: false` (its
 * card comes off every pricing page), and an inactive Payment Link is removed
 * from its plan. The workflow opens a draft PR with that diff. A wrong
 * amount, a missing card, or a page that is down is reported, never guessed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  listedPlans,
  planById,
  type Plan,
  type PlanId,
} from "../src/lib/plans";

export type PricingPage = {
  origin: "authichain" | "qron" | "strainchain";
  url: string;
  brand: "qron" | "strainchain";
};

export const PRICING_PAGES: PricingPage[] = [
  {
    origin: "authichain",
    url: "https://authichain.com/pricing",
    brand: "qron",
  },
  { origin: "qron", url: "https://qron.space/pricing", brand: "qron" },
  {
    origin: "strainchain",
    url: "https://strainchain.io/pricing",
    brand: "strainchain",
  },
];

export type FindingKind =
  | "page_down"
  | "unlisted_plan_on_page"
  | "unknown_checkout_link"
  | "listed_plan_missing"
  | "confirm_page_broken"
  | "price_inactive"
  | "product_inactive"
  | "price_mismatch"
  | "stripe_error"
  | "payment_link_inactive"
  | "payment_link_missing";

export type Finding = {
  kind: FindingKind;
  planId?: string;
  url?: string;
  detail: string;
  /** A --fix repair exists for this finding. */
  fixable: boolean;
};

const UA =
  "authichain-checkout-watchdog (+https://github.com/undone0603/authichain-unified)";

/** Paid plans a brand's pricing page should carry a checkout link for. */
export function expectedPlanIds(brand: "qron" | "strainchain"): PlanId[] {
  return listedPlans(brand)
    .filter(p => p.price > 0)
    .map(p => p.id);
}

export type PageLinks = { planIds: string[]; paymentLinks: string[] };

/**
 * Checkout targets in a rendered pricing page: /checkout/<plan> and
 * /api/checkout/plan/<plan> (href or form action, any origin) and raw
 * buy.stripe.com Payment Links.
 */
export function extractCheckoutLinks(html: string): PageLinks {
  const planIds = new Set<string>();
  const paymentLinks = new Set<string>();
  for (const m of html.matchAll(/(?:href|action)\s*=\s*["']([^"']+)["']/gi)) {
    const raw = m[1].replace(/&amp;/g, "&");
    let u: URL;
    try {
      u = new URL(raw, "https://authichain.com");
    } catch {
      continue;
    }
    if (u.hostname === "buy.stripe.com") {
      paymentLinks.add(`https://buy.stripe.com${u.pathname}`);
      continue;
    }
    const p = u.pathname.replace(/\/+$/, "");
    const hit =
      p.match(/^\/checkout\/([A-Za-z0-9_-]+)$/) ??
      p.match(/^\/api\/checkout\/plan\/([A-Za-z0-9_-]+)$/);
    if (hit) planIds.add(hit[1]);
  }
  return {
    planIds: [...planIds].sort(),
    paymentLinks: [...paymentLinks].sort(),
  };
}

/** Compare one page's links with the catalogue. Pure. */
export function checkPageLinks(page: PricingPage, links: PageLinks): Finding[] {
  const findings: Finding[] = [];
  const listed = new Map(listedPlans(page.brand).map(p => [p.id as string, p]));
  const anyListed = new Set(
    [...listedPlans("qron"), ...listedPlans("strainchain")].map(
      p => p.id as string
    )
  );
  for (const id of links.planIds) {
    // /checkout/dpp and friends are aliases the gate canonicalises.
    if (anyListed.has(id) || id === "dpp") continue;
    findings.push({
      kind: planById(id as PlanId)
        ? "unlisted_plan_on_page"
        : "unknown_checkout_link",
      planId: id,
      url: page.url,
      detail: planById(id as PlanId)
        ? `${page.url} links /checkout/${id}, which plans.ts no longer lists. The live page is older than main: redeploy it.`
        : `${page.url} links /checkout/${id}, which is not a plan in plans.ts.`,
      fixable: false,
    });
  }
  const catalogueLinks = new Map(
    [...listedPlans("qron"), ...listedPlans("strainchain")]
      .filter(p => p.stripe_payment_link)
      .map(p => [p.stripe_payment_link as string, p.id])
  );
  for (const link of links.paymentLinks) {
    if (catalogueLinks.has(link)) continue;
    findings.push({
      kind: "unknown_checkout_link",
      url: link,
      detail: `${page.url} links ${link}, which is not the Payment Link of any listed plan.`,
      fixable: false,
    });
  }
  const linked = new Set(
    links.planIds.map(id => (id === "dpp" ? "dpp_readiness" : id))
  );
  for (const id of expectedPlanIds(page.brand)) {
    if (linked.has(id)) continue;
    const plan = listed.get(id);
    findings.push({
      kind: "listed_plan_missing",
      planId: id,
      url: page.url,
      detail: `${page.url} has no checkout link for ${plan?.name ?? id} ($${plan?.price}), which plans.ts lists.`,
      fixable: false,
    });
  }
  return findings;
}

function priceText(plan: Plan): string {
  return `$${plan.price.toLocaleString("en-US")}`;
}

async function getText(url: string, fetchImpl: typeof fetch) {
  const res = await fetchImpl(url, {
    method: "GET",
    redirect: "follow",
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  return { status: res.status, body: await res.text() };
}

export async function checkLivePages(
  fetchImpl: typeof fetch = fetch,
  pages: PricingPage[] = PRICING_PAGES
): Promise<{ findings: Finding[]; linked: Record<string, PageLinks> }> {
  const findings: Finding[] = [];
  const linked: Record<string, PageLinks> = {};
  const confirmIds = new Set<string>();
  for (const page of pages) {
    let res: { status: number; body: string };
    try {
      res = await getText(page.url, fetchImpl);
    } catch (err) {
      findings.push({
        kind: "page_down",
        url: page.url,
        detail: `${page.url} did not answer: ${err instanceof Error ? err.message : String(err)}`,
        fixable: false,
      });
      continue;
    }
    if (res.status !== 200) {
      findings.push({
        kind: "page_down",
        url: page.url,
        detail: `${page.url} answered ${res.status}.`,
        fixable: false,
      });
      continue;
    }
    const links = extractCheckoutLinks(res.body);
    linked[page.url] = links;
    findings.push(...checkPageLinks(page, links));
    for (const id of links.planIds)
      confirmIds.add(id === "dpp" ? "dpp_readiness" : id);
  }
  for (const id of [...confirmIds].sort()) {
    const plan = planById(id as PlanId);
    if (!plan) continue;
    const url = `https://authichain.com/checkout/${id}`;
    try {
      const res = await getText(url, fetchImpl);
      if (res.status !== 200 || !res.body.includes(priceText(plan))) {
        findings.push({
          kind: "confirm_page_broken",
          planId: id,
          url,
          detail:
            res.status !== 200
              ? `${url} answered ${res.status}; buyers clicking the card reach no checkout.`
              : `${url} does not show ${priceText(plan)}, the price on the card.`,
          fixable: false,
        });
      }
    } catch (err) {
      findings.push({
        kind: "confirm_page_broken",
        planId: id,
        url,
        detail: `${url} did not answer: ${err instanceof Error ? err.message : String(err)}`,
        fixable: false,
      });
    }
  }
  return { findings, linked };
}

type StripeGet = (path: string) => Promise<{ status: number; json: any }>;

export function stripeGetter(
  key: string,
  fetchImpl: typeof fetch = fetch
): StripeGet {
  return async path => {
    const res = await fetchImpl(`https://api.stripe.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${key}`, "User-Agent": UA },
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  };
}

/** Test-mode keys see none of the live prices; never judge the catalogue with one. */
export function isLiveStripeKey(key: string | undefined): key is string {
  return Boolean(key && /^(sk|rk)_live_/.test(key));
}

export async function checkStripe(get: StripeGet): Promise<Finding[]> {
  const findings: Finding[] = [];
  const plans = [...listedPlans("qron"), ...listedPlans("strainchain")].filter(
    p => p.price > 0
  );
  for (const plan of plans) {
    if (!plan.stripe_price_id) continue;
    const { status, json } = await get(
      `prices/${encodeURIComponent(plan.stripe_price_id)}?expand[]=product`
    );
    if (status !== 200) {
      findings.push({
        kind: "stripe_error",
        planId: plan.id,
        detail: `Stripe answered ${status} for ${plan.name}'s price ${plan.stripe_price_id}: ${json?.error?.message ?? "no message"}`,
        fixable: false,
      });
      continue;
    }
    if (json.active === false) {
      findings.push({
        kind: "price_inactive",
        planId: plan.id,
        detail: `${plan.name}'s Stripe price ${plan.stripe_price_id} is archived, so its card cannot be paid.`,
        fixable: true,
      });
      continue;
    }
    if (
      json.product &&
      typeof json.product === "object" &&
      json.product.active === false
    ) {
      findings.push({
        kind: "product_inactive",
        planId: plan.id,
        detail: `${plan.name}'s Stripe product ${json.product.id} is archived, so its card cannot be paid.`,
        fixable: true,
      });
      continue;
    }
    const wantType =
      plan.stripe_mode === "subscription" ? "recurring" : "one_time";
    const problems: string[] = [];
    if (json.unit_amount !== plan.price * 100)
      problems.push(
        `Stripe charges ${json.unit_amount / 100} ${json.currency}, the card says $${plan.price}`
      );
    if (json.currency && json.currency !== "usd")
      problems.push(`currency is ${json.currency}`);
    if (plan.stripe_mode && json.type && json.type !== wantType)
      problems.push(
        `Stripe bills ${json.type}, plans.ts says ${plan.stripe_mode}`
      );
    if (problems.length) {
      findings.push({
        kind: "price_mismatch",
        planId: plan.id,
        detail: `${plan.name}: ${problems.join("; ")}.`,
        fixable: false,
      });
    }
  }

  const wanted = plans.filter(p => p.stripe_payment_link);
  if (wanted.length) {
    const byUrl = new Map<string, { active: boolean; id: string }>();
    let after = "";
    for (let page = 0; page < 20; page++) {
      const { status, json } = await get(
        `payment_links?limit=100${after ? `&starting_after=${after}` : ""}`
      );
      if (status !== 200) {
        findings.push({
          kind: "stripe_error",
          detail: `Stripe answered ${status} listing Payment Links: ${json?.error?.message ?? "no message"}`,
          fixable: false,
        });
        return findings;
      }
      for (const link of json.data ?? [])
        byUrl.set(link.url, { active: link.active, id: link.id });
      if (!json.has_more || !json.data?.length) break;
      after = json.data[json.data.length - 1].id;
    }
    for (const plan of wanted) {
      const link = byUrl.get(plan.stripe_payment_link as string);
      if (!link) {
        findings.push({
          kind: "payment_link_missing",
          planId: plan.id,
          url: plan.stripe_payment_link,
          detail: `${plan.name}'s Payment Link ${plan.stripe_payment_link} is not in this Stripe account.`,
          fixable: false,
        });
      } else if (!link.active) {
        findings.push({
          kind: "payment_link_inactive",
          planId: plan.id,
          url: plan.stripe_payment_link,
          detail: `${plan.name}'s Payment Link ${plan.stripe_payment_link} is deactivated in Stripe.`,
          fixable: true,
        });
      }
    }
  }
  return findings;
}

/**
 * Refuse to auto-fix when too much looks broken at once. Every price archived
 * at the same moment is far likelier a wrong Stripe account than a real
 * catalogue change, and hiding every card would take the store down.
 */
export function safeToAutoFix(findings: Finding[]): boolean {
  const paid = [...listedPlans("qron"), ...listedPlans("strainchain")].filter(
    p => p.price > 0
  );
  const hidden = new Set(
    findings
      .filter(f => f.kind === "price_inactive" || f.kind === "product_inactive")
      .map(f => f.planId)
  );
  return hidden.size * 2 < paid.length;
}

/** Locate a plan's object literal in plans.ts source. */
function planBlock(
  src: string,
  id: string
): { start: number; end: number } | null {
  const idAt = src.indexOf(`id: "${id}",`);
  if (idAt < 0) return null;
  const start = src.lastIndexOf("\n  {", idAt);
  const end = src.indexOf("\n  },", idAt);
  if (start < 0 || end < 0) return null;
  return { start, end };
}

/** Apply the fixable findings to plans.ts source. Pure. */
export function applyFixes(
  src: string,
  findings: Finding[]
): { src: string; applied: Finding[] } {
  const applied: Finding[] = [];
  let out = src;
  for (const f of findings) {
    if (!f.fixable || !f.planId) continue;
    const block = planBlock(out, f.planId);
    if (!block) continue;
    let body = out.slice(block.start, block.end);
    if (f.kind === "price_inactive" || f.kind === "product_inactive") {
      if (/\n\s+listed: false,/.test(body)) continue;
      body = /\n\s+listed: true,/.test(body)
        ? body.replace(/(\n\s+)listed: true,/, "$1listed: false,")
        : `${body}\n    listed: false,`;
    } else if (f.kind === "payment_link_inactive") {
      const next = body.replace(/\n\s+stripe_payment_link: "[^"]*",/, "");
      if (next === body) continue;
      body = next;
    } else continue;
    out = out.slice(0, block.start) + body + out.slice(block.end);
    applied.push(f);
  }
  return { src: out, applied };
}

export function renderReport(
  findings: Finding[],
  meta: { stripe: string }
): string {
  const lines = [
    `### Checkout watchdog: ${findings.length ? "RED" : "green"}`,
    "",
    `Pages: ${PRICING_PAGES.map(p => p.url).join(", ")}. Stripe: ${meta.stripe}.`,
    "",
  ];
  if (!findings.length) {
    lines.push("Every pricing card leads to a listed, active plan.");
  } else {
    lines.push("| | finding | plan | detail |", "|---|---|---|---|");
    for (const f of findings)
      lines.push(
        `| ${f.fixable ? "auto-fix" : "needs a person"} | ${f.kind} | ${f.planId ?? ""} | ${f.detail.replace(/\|/g, "\\|")} |`
      );
  }
  return lines.join("\n");
}

export async function runWatchdog(
  opts: {
    fetchImpl?: typeof fetch;
    stripeKey?: string;
  } = {}
) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const { findings, linked } = await checkLivePages(fetchImpl);
  let stripe = "skipped (no live key)";
  if (isLiveStripeKey(opts.stripeKey)) {
    try {
      findings.push(
        ...(await checkStripe(stripeGetter(opts.stripeKey, fetchImpl)))
      );
      stripe = "checked";
    } catch (err) {
      findings.push({
        kind: "stripe_error",
        detail: `Stripe check failed: ${err instanceof Error ? err.message : String(err)}`,
        fixable: false,
      });
      stripe = "failed";
    }
  } else if (opts.stripeKey) {
    stripe = "skipped (test-mode key)";
  }
  return { ok: findings.length === 0, findings, linked, stripe };
}

if (process.argv.includes("--run")) {
  const report = await runWatchdog({
    stripeKey: process.env.STRIPE_READ_KEY || process.env.STRIPE_SECRET_KEY,
  });
  const md = renderReport(report.findings, { stripe: report.stripe });
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`, { flag: "a" });
  }
  let applied: Finding[] = [];
  if (process.argv.includes("--fix") && report.findings.some(f => f.fixable)) {
    if (safeToAutoFix(report.findings)) {
      const path = new URL("../src/lib/plans.ts", import.meta.url);
      const res = applyFixes(readFileSync(path, "utf8"), report.findings);
      if (res.applied.length) writeFileSync(path, res.src);
      applied = res.applied;
    } else {
      console.log(
        "Too many plans look archived at once; not auto-fixing. Check which Stripe account the key belongs to."
      );
    }
  }
  const out = process.env.WATCHDOG_REPORT;
  if (out) {
    writeFileSync(
      out,
      JSON.stringify({ ...report, applied, markdown: md }, null, 2)
    );
  }
  for (const f of report.findings)
    console.log(`::error title=Checkout ${f.kind}::${f.detail}`);
  if (!report.ok) process.exit(1);
}
