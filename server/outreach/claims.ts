// server/outreach/claims.ts
// Claim checker for outbound email. Runs on the fully rendered subject + body
// before anything is sent, and blocks the send on any match. Pure (no Node or
// network imports) so the Node scripts, via guardedSend, and the
// authichain-outreach-engine Worker apply the same rules.
//
// Every rule below corresponds to something this project actually emailed to a
// real organisation: "Would you like to see our SBIR Phase 1 results?" to DEA
// and CBP addresses, "Active enterprise contracts in..." and "Thank you again
// for taking the time for the demo" to Pfizer, "reduces audit costs by 90%",
// "scannable in 2.1 seconds", "DoD-level supply chains", and a first-touch
// subject line starting "Re:". None of those statements was backed by anything.
//
// The checker is deliberately conservative: a truthful sentence that trips a
// rule gets rephrased; a false one that slips through reaches a real inbox.

export interface ClaimViolation {
  rule: string;
  match: string;
  why: string;
}

interface ClaimRule {
  rule: string;
  pattern: RegExp;
  why: string;
}

const RULES: ClaimRule[] = [
  {
    rule: "unverified_award",
    pattern:
      /\b(SBIR|STTR|OTA)\b|\bphase\s*(I{1,2}|1|2)\b|\b(grant|award|contract)(ed|s)?\s+(from|by|with)\b/i,
    why: "Claims a grant, award or government contract. Only state awards that exist and can be cited.",
  },
  {
    rule: "unverified_traction",
    pattern:
      /\b(used|trusted|relied on|adopted)\s+by\b|\bactive\s+(enterprise\s+)?(contracts?|customers?|clients?|pilots?|deployments?)\b|\bour\s+(customers|clients|partners)\b|\bleading\s+(brands|companies|manufacturers)\s+(use|rely|trust)\b|\bdeployed\s+(at|by|with|across)\b/i,
    why: "Claims customers, contracts or adoption. Name real customers only with their permission.",
  },
  {
    rule: "fabricated_engagement",
    pattern:
      /\bthank(s| you)\b[^.\n]{0,40}\bfor\b[^.\n]{0,40}\b(demo|call|meeting|chat|time)\b|\b(as|like)\s+(we\s+)?discussed\b|\bfollowing\s+up\s+on\s+our\b|\byou\s+(recently\s+)?(completed|viewed|visited|started|explored|downloaded|requested|signed up)\b|\bI\s+(noticed|saw|came across)\b/i,
    why: "Implies prior contact or observed behaviour. A first email must not suggest a meeting, demo or activity that did not happen.",
  },
  {
    rule: "unverified_statistic",
    pattern:
      /\d+(\.\d+)?\s?%|\b\d+(\.\d+)?\s?x\s+(faster|cheaper|more|better|lower)\b|\bin\s+(under\s+)?\d+(\.\d+)?\s+seconds?\b|\b\d+(\.\d+)?\s+(million|billion)\b/i,
    why: "States a number (percentage, multiplier, timing or market size). Numbers need a cited source, so they stay out of cold email.",
  },
  {
    rule: "compliance_or_grade_claim",
    pattern:
      /\b(DoD|military|government|bank|enterprise)[- ]?(level|grade)\b|\b(FDA|DEA|CBP|DoD|NIST|ISO|GS1|SOC\s?2)[- ]?(approved|certified|compliant|validated|endorsed)\b|\b(certified|approved|endorsed)\s+by\b|\bfully\s+compliant\b/i,
    why: "Claims a certification, approval or security grade. Only state certifications that exist and can be cited.",
  },
  {
    rule: "absolute_claim",
    pattern:
      /\b(eliminat\w*|end|stop)\s+(all\s+)?counterfeit\w*|\b100\s?%|\bunhackable\b|\btamper[- ]proof\b|\bimpossible\s+to\s+(fake|forge|counterfeit|copy)\b|\bguarantee(d|s)?\b|\bzero[- ]trust\s+integrity\b/i,
    why: "Absolute promise that cannot be backed. Describe what the product does instead.",
  },
  {
    rule: "fake_reply_subject",
    pattern: /^\s*(re|fwd?|fw)\s*:/i,
    why: "Subject pretends to continue an existing thread. Deceptive subject lines are prohibited by CAN-SPAM.",
  },
  {
    rule: "unrendered_placeholder",
    pattern: /\{\{[^}]*\}\}/,
    why: "A template placeholder was not filled in.",
  },
];

/** Check rendered email text. `subject` is checked separately so subject-only rules apply to it alone. */
export function checkClaims(subject: string, body: string): ClaimViolation[] {
  const violations: ClaimViolation[] = [];
  for (const r of RULES) {
    const targets = r.rule === "fake_reply_subject" ? [subject] : [subject, body];
    for (const text of targets) {
      const m = r.pattern.exec(text);
      if (m) {
        violations.push({ rule: r.rule, match: m[0], why: r.why });
        break;
      }
    }
  }
  return violations;
}

/** Visible text of an HTML email, for claim checking. Comments, styles and tags are dropped. */
export function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*/g, "\n")
    .trim();
}
