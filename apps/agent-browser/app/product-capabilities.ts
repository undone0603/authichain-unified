/**
 * Closed action set for the Agent Browser UI.
 *
 * Public catalogue reads do not need an agent credential. Command execution,
 * file writes, and invented verification verdicts are denied. This file does
 * not create an identity system; an anonymous session stays anonymous.
 */
import {
  isPublicPlanId,
  publicCheckoutHref,
  type PublicPlanId,
} from "../../../src/lib/billing/live-catalog";
import {
  mentionedPlanId,
  publicSalesCheckout,
} from "../../../src/lib/sales-reply";
import { planById, planUsd, PUBLIC_PLAN_IDS } from "../../../src/lib/plans";

export interface CapabilityAudit {
  actor: "anonymous-browser";
  authenticated: false;
  authorized: boolean;
  revocable: true;
  reason: string;
}

export interface ProductCapabilityDecision {
  ok: boolean;
  action: "offers" | "checkout" | "verify" | "refuse";
  decision: "allow" | "deny";
  reply: string;
  checkout_url: string | null;
  verify_url: string | null;
  offers?: Array<{
    id: PublicPlanId;
    name: string;
    price: number;
    checkout_url: string;
  }>;
  audit: CapabilityAudit;
}

const SHELL =
  /<\s*\/?\s*(EXECUTE|WRITE_FILE|READ_FILE)\b|\b(execSync|child_process|sudo)\b|\brm\s+-/i;

const SAFE_ID = /^[A-Za-z0-9_.:-]{1,200}$/;

function deny(reply: string, reason: string): ProductCapabilityDecision {
  return {
    ok: false,
    action: "refuse",
    decision: "deny",
    reply,
    checkout_url: null,
    verify_url: null,
    audit: {
      actor: "anonymous-browser",
      authenticated: false,
      authorized: false,
      revocable: true,
      reason,
    },
  };
}

function allow(
  action: "offers" | "checkout" | "verify",
  reply: string,
  reason: string,
  extra: Partial<ProductCapabilityDecision> = {}
): ProductCapabilityDecision {
  return {
    ok: true,
    action,
    decision: "allow",
    reply,
    checkout_url: extra.checkout_url ?? null,
    verify_url: extra.verify_url ?? null,
    offers: extra.offers,
    audit: {
      actor: "anonymous-browser",
      authenticated: false,
      authorized: true,
      revocable: true,
      reason,
    },
  };
}

function offers(): ProductCapabilityDecision {
  const rows = PUBLIC_PLAN_IDS.map((id) => {
    const plan = planById(id);
    return {
      id,
      name: plan?.name ?? id,
      price: planUsd(id),
      checkout_url: publicCheckoutHref(id),
    };
  });
  const lines = rows.map(
    (row) => `${row.name} ($${row.price}): ${row.checkout_url}`
  );
  return allow(
    "offers",
    `Public offers:\n${lines.join("\n")}`,
    "public catalogue read",
    { offers: rows }
  );
}

function checkout(planId: string): ProductCapabilityDecision {
  const named = mentionedPlanId(planId) ?? planId.trim().toLowerCase();
  if (!isPublicPlanId(named)) {
    return deny("That plan is not a public offer.", "private or unknown plan");
  }
  const answer = publicSalesCheckout(named);
  return allow("checkout", answer.reply, "public checkout link", {
    checkout_url: answer.checkout_url,
  });
}

function verify(id: string | null): ProductCapabilityDecision {
  if (id != null && !SAFE_ID.test(id)) {
    return deny(
      "That record id is not accepted. Open https://authichain.com/api/verify and pass an id there.",
      "record id failed the public verifier character check"
    );
  }
  const verifyUrl = id
    ? `https://authichain.com/api/verify?id=${encodeURIComponent(id)}`
    : "https://authichain.com/api/verify";
  return allow(
    "verify",
    `This link opens the public verifier. This screen does not issue a verdict. ${verifyUrl}`,
    "public verifier link",
    { verify_url: verifyUrl }
  );
}

function fromPrompt(prompt: string): ProductCapabilityDecision {
  if (SHELL.test(prompt)) {
    return deny(
      "This interface does not run commands, read the workspace, or write files.",
      "command execution is not a public capability"
    );
  }
  const trimmed = prompt.trim();
  if (/^(offers|list offers|public offers)$/i.test(trimmed)) return offers();
  const checkoutMatch = trimmed.match(/^(?:checkout|buy)\s+([a-z0-9_-]+)$/i);
  if (checkoutMatch) return checkout(checkoutMatch[1]);
  const verifyMatch = trimmed.match(/^verify(?:\s+(\S+))?$/i);
  if (verifyMatch) return verify(verifyMatch[1] ?? null);
  return deny(
    "Say offers, checkout <public plan>, or verify <record id>.",
    "prompt is outside the public action set"
  );
}

export function decideProductCapability(
  input: unknown
): ProductCapabilityDecision {
  if (!input || typeof input !== "object") {
    return deny("Missing action.", "empty request");
  }
  const record = input as Record<string, unknown>;
  if (typeof record.action === "string") {
    if (record.action === "offers") return offers();
    if (record.action === "checkout") {
      return checkout(typeof record.plan === "string" ? record.plan : "");
    }
    if (record.action === "verify") {
      const id = typeof record.id === "string" ? record.id : null;
      return verify(id);
    }
    return deny("Unknown action.", "action is not in the public set");
  }
  if (typeof record.prompt === "string") {
    if (record.prompt.length > 2000) {
      return deny("Prompt is too long.", "prompt length");
    }
    return fromPrompt(record.prompt);
  }
  return deny("Missing action.", "empty request");
}
