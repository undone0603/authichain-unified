import { closeOrder, daysStale, money, nextAction, staleLeads } from "./metrics";
import { STAGE_LABEL, type Lead } from "./types";

export const CLOSER_HELLO =
  "AgentZ on the wire. I close from this board — pilots, seals, METRC, DPP, and federal fit. Ask a pricing, pilot, or domain question, or name a company.";

const REPLIES: Array<{ test: RegExp; text: string }> = [
  {
    test: /\b(price|pricing|cost|how much|sku|pack)\b/i,
    text: "Public SKUs stay $0-budget clean: QRON packs from $299, EU DPP fulfillment $299, AuthiChain seals ~$0.004 each. Enterprise pilots are founder-led. Do not invent GovChain SKUs.",
  },
  {
    test: /\b(pilot|zapbox|199|demo)\b/i,
    text: "Single-project pilot is the wedge: one SKU, public verify page, Ed25519 certificate, 14 days. Cannabis wants METRC coexistence, not replacement. Government wants originals on-prem + public <2s verify.",
  },
  {
    test: /\b(qron|living|scan|card|harper)\b/i,
    text: "QRON is the living code: scannable art, on-chain cert, StoryMode. Close with a generated sample, not a deck.",
  },
  {
    test: /\b(strain|metrc|cannabis|trulieve|curaleaf|cresco|thcv|dispensary)\b/i,
    text: "StrainChain pitch: seals beside METRC, anti-diversion, dispensary verify. Do not claim we replace the state system. Do not invent MSO customers.",
  },
  {
    test: /\b(gov|federal|nist|fedramp|sam|gsa|deed|credential)\b/i,
    text: "GovChain: originals stay on-prem, TruMark seal + public verify, NIST 800-53 / FedRAMP-ready language, no invented SKUs. Import the local SAM catalog only.",
  },
  {
    test: /\b(lvmh|hermes|hermès|rolex|luxury|seal|authentic)\b/i,
    text: "Luxury is AuthiChain Command. Authenticate global goods to save lives, positioned in the USA. Do not invent contracted logos.",
  },
  {
    test: /\b(moderna|medical|fda|eudamed|pharma)\b/i,
    text: "Speak packaging seals, lot-level verify, EUDAMED/FDA adjacency — never claim we are a cleared medical device.",
  },
  {
    test: /\b(budget|zero|spend|ads)\b/i,
    text: "Hard cap is $0 paid channels. Autonomous work is email drafts, scoring, stage advance, local SAM import, and founder digest.",
  },
];

function namedLead(leads: Lead[], prompt: string): Lead | undefined {
  const q = prompt.toLowerCase();
  const ranked = [...leads].sort((a, b) => b.company.length - a.company.length);
  return ranked.find((l) => {
    const company = l.company.toLowerCase();
    const first = l.name.split(" ")[0]?.toLowerCase() ?? "";
    return (company.length > 2 && q.includes(company)) || (first.length > 3 && q.includes(first));
  });
}

export function closerReply(prompt: string, leads: Lead[] = []): string {
  const named = namedLead(leads, prompt);
  if (named) {
    return `${named.company} — ${named.name} (${named.title}), ${STAGE_LABEL[named.stage]}, score ${named.score}, ${money(named.value)}. Next: ${nextAction(named)}. ${named.notes}`;
  }
  if (/\b(stale|follow-?up|quiet)\b/i.test(prompt)) {
    const stale = staleLeads(leads).slice(0, 6);
    if (!stale.length) return "No stale paper. Follow-up job waits for three quiet days.";
    return `Follow-up queue: ${stale.map((l) => `${l.company} (${daysStale(l)}d, ${STAGE_LABEL[l.stage]})`).join("; ")}.`;
  }
  if (/\b(close|hot|intent|who|next)\b/i.test(prompt)) {
    const hot = closeOrder(leads, 5);
    if (!hot.length) return "Nothing open to close. Capture or run a cycle.";
    return `Close order from this board: ${hot.map((l) => `${l.company} (${STAGE_LABEL[l.stage]}, ${l.score}) — ${nextAction(l)}`).join("; ")}.`;
  }
  if (/\b(digest|standup|briefing)\b/i.test(prompt)) {
    return "Compile the leadership digest from Ops. Local copy only — no Slack webhook.";
  }
  const hit = REPLIES.find((r) => r.test.test(prompt));
  if (hit) return hit.text;
  return "I can brief pricing, the 14-day pilot, QRON cards, StrainChain METRC, GovChain NIST, or luxury seals. Name a company on the board and I will tell you the next honest move.";
}
