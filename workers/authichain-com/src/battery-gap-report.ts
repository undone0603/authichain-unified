/**
 * Written EU battery passport gap report — the $950 deliverable
 * (plans.ts battery_gap_report, + $350 per extra model).
 *
 * The page promises: "which Annex XIII data you have, which is missing, and
 * who in your supply chain should supply it", by email as a written document.
 * This module renders exactly that from an intake the customer filled in.
 *
 * Pure functions only. The item list, layers and operator wording come from
 * battery-gap-map.ts, so the paid report and the free self-check can never
 * disagree about what Annex XIII asks for.
 *
 * Truth rules (same as the gap map, plus):
 * - Figures are the customer's own, shown as typed. Nothing is verified.
 * - "You report this exists" is recorded in the customer's words and is not
 *   reviewed. No document is judged sufficient.
 * - No identifier, passport ID, score, ranking or deadline beyond the
 *   regulation's own date is invented.
 * - Readiness only: not a conformity assessment, not legal advice, not an
 *   issued passport.
 */
import {
  CONSISTENCY_TOLERANCE,
  annexXiiiRows,
  scorePack,
  type AnnexRow,
  type PackInput,
  type Placing,
} from "./battery-gap-map.ts";
import {
  APPLICABILITY_LABEL,
  CHEMISTRY_IDS,
  CHEMISTRY_PROFILES,
  chemistryRows,
  isChemistryId,
  type ChemistryId,
  type ChemistryRow,
} from "./battery-chemistry-profiles.ts";

export const REPORT_DISCLAIMER =
  "Readiness assessment only. Not a conformity assessment, not legal advice, and not an issued battery passport. Figures and document statements are the customer's own and were not verified. Confirm obligations against Regulation (EU) 2023/1542 and with counsel.";

export const APPLIES_FROM = "18 February 2027";

const MAX_TEXT = 300;
const MAX_MODELS = 21; // first model + up to 20 extra (plans.ts adjustable_quantity max)

export interface ModelIntake extends PackInput {
  /** Row id (from annexXiiiRows) → the customer's own description of what they hold. */
  available?: Record<string, string>;
  /** Cell chemistry; selects which Art. 48 / Art. 8 / Art. 7 obligations apply. */
  chemistry?: ChemistryId;
}

export interface GapReportIntake {
  orderRef: string;
  company: string;
  /** ISO date (YYYY-MM-DD) the report is issued. Passed in, never read from a clock. */
  preparedOn: string;
  /** Models paid for: 1 + extra-model quantity. */
  modelsPaid: number;
  models: ModelIntake[];
}

export type ReportStatus =
  | "have_figure"
  | "have_reported"
  | "missing"
  | "restricted_prepared"
  | "restricted"
  | "outside";

export interface ReportRow extends AnnexRow {
  reportStatus: ReportStatus;
  customerStatement?: string;
}

export interface ModelReport {
  model: string;
  placing: Placing;
  /** Chemistry-dependent obligations, or null when the intake gave no chemistry. */
  chemistry: { label: string; rows: ChemistryRow[] } | null;
  consistency: string;
  rows: ReportRow[];
  counts: Record<ReportStatus, number>;
  errors: string[];
}

export interface GapReport {
  markdown: string;
  html: string;
  models: ModelReport[];
}

const clean = (s: unknown, max = MAX_TEXT): string =>
  typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** Throws with every problem listed, so an intake is fixed in one pass. */
export function validateIntake(intake: GapReportIntake): void {
  const problems: string[] = [];
  const src = (intake ?? {}) as Partial<GapReportIntake>;
  if (!clean(src.orderRef))
    problems.push("orderRef is required (Stripe session or invoice id).");
  if (!clean(src.company)) problems.push("company is required.");
  if (
    typeof src.preparedOn !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(src.preparedOn) ||
    Number.isNaN(Date.parse(src.preparedOn))
  )
    problems.push("preparedOn must be an ISO date, YYYY-MM-DD.");
  const models = Array.isArray(src.models) ? src.models : [];
  if (models.length === 0)
    problems.push("models must list at least one battery model.");
  models.forEach((m, i) => {
    const c = (m as Partial<ModelIntake>)?.chemistry;
    if (c !== undefined && !isChemistryId(c))
      problems.push(
        `models[${i}].chemistry must be one of: ${CHEMISTRY_IDS.join(", ")}.`
      );
  });
  if (models.length > MAX_MODELS)
    problems.push(`at most ${MAX_MODELS} models per report.`);
  const paid = Number.isInteger(src.modelsPaid)
    ? (src.modelsPaid as number)
    : 0;
  if (paid < 1)
    problems.push("modelsPaid must be a whole number of at least 1.");
  else if (models.length > paid)
    problems.push(
      `${models.length} models submitted but ${paid} paid for; collect $350 per extra model first.`
    );

  models.forEach((m, i) => {
    const label = `models[${i}]${clean(m?.model) ? ` (${clean(m.model)})` : ""}`;
    const s = scorePack(m);
  const isSupplied = (v: unknown): boolean =>
    v !== undefined && v !== null && String(v).trim() !== "";
  for (const e of s.errors) {
    if (e.startsWith("Cycle")) continue;
    if (e.startsWith("Stated energy (Wh)") && !isSupplied(m?.statedWh)) continue;
    if (e.startsWith("Capacity (Ah)") && !isSupplied(m?.capacityAh)) continue;
    if (e.startsWith("Nominal voltage (V)") && !isSupplied(m?.nominalV)) continue;
    problems.push(`${label}: ${e}`);
  }
    const rows = annexXiiiRows(m);
    const allowed = new Set(
      rows
        .filter(r => r.status === "needs_operator" || r.status === "not_public")
        .map(r => r.id)
    );
    for (const [id, text] of Object.entries(m?.available ?? {})) {
      if (!allowed.has(id))
        problems.push(
          `${label}: available.${id} is not an item the customer supplies (allowed: ${[...allowed].join(", ")}).`
        );
      else if (!clean(text))
        problems.push(
          `${label}: available.${id} needs the customer's description of what they hold.`
        );
    }
  });
  if (problems.length)
    throw new Error(
      `Gap report intake is not ready:\n- ${problems.join("\n- ")}`
    );
}

function consistencyLine(m: PackInput): string {
  const s = scorePack(m);
  if (s.deviation === null || s.vTimesAh === null)
    return "Cannot check: stated Wh, Ah and nominal V are needed.";
  const pct = (s.deviation * 100).toFixed(2);
  return s.consistent
    ? `Consistent: ${s.nominalV} V × ${s.ah} Ah = ${s.vTimesAh} Wh against ${s.statedWh} Wh stated (${pct}% apart, within ${CONSISTENCY_TOLERANCE * 100}%).`
    : `Recheck before publishing: ${s.nominalV} V × ${s.ah} Ah = ${s.vTimesAh} Wh, but ${s.statedWh} Wh is stated (${pct}% apart, over ${CONSISTENCY_TOLERANCE * 100}%).`;
}

export function modelReport(m: ModelIntake): ModelReport {
  const s = scorePack(m);
  const available = m.available ?? {};
  const rows: ReportRow[] = annexXiiiRows(m).map(r => {
    const said = clean(available[r.id]);
    if (r.status === "user_provided")
      return { ...r, reportStatus: "have_figure" };
    if (r.status === "needs_operator")
      return said
        ? { ...r, reportStatus: "have_reported", customerStatement: said }
        : { ...r, reportStatus: "missing" };
    if (r.status === "not_public")
      return said
        ? { ...r, reportStatus: "restricted_prepared", customerStatement: said }
        : { ...r, reportStatus: "restricted" };
    return { ...r, reportStatus: "outside" };
  });
  const counts = {
    have_figure: 0,
    have_reported: 0,
    missing: 0,
    restricted_prepared: 0,
    restricted: 0,
    outside: 0,
  } as Record<ReportStatus, number>;
  for (const r of rows) counts[r.reportStatus]++;
  return {
    model: s.model,
    placing: s.placing,
    chemistry: isChemistryId(m.chemistry)
      ? {
          label: CHEMISTRY_PROFILES[m.chemistry].label,
          rows: chemistryRows(m.chemistry),
        }
      : null,
    consistency: consistencyLine(m),
    rows,
    counts,
    errors: s.errors,
  };
}

const PLACING_TEXT: Record<Placing, string> = {
  self: "You place this battery on the EU market.",
  cell_maker: "Your cell maker places this battery on the EU market.",
  unknown: "Not yet confirmed who places this battery on the EU market.",
};

function mdCell(s: string): string {
  return s.replace(/\|/g, "\\|");
}

function modelMarkdown(r: ModelReport, n: number): string {
  const have = r.rows.filter(
    x => x.reportStatus === "have_figure" || x.reportStatus === "have_reported"
  );
  const missing = r.rows.filter(x => x.reportStatus === "missing");
  const restricted = r.rows.filter(
    x =>
      x.reportStatus === "restricted" ||
      x.reportStatus === "restricted_prepared"
  );
  const outside = r.rows.filter(x => x.reportStatus === "outside");
  const out: string[] = [];
  out.push(`## ${n}. ${r.model}`, "");
  out.push(`- Placing on the EU market: ${PLACING_TEXT[r.placing]}`);
  out.push(`- Energy check: ${r.consistency}`);
  out.push(
    `- Public-layer items: ${have.length} you have, ${missing.length} missing.`,
    ""
  );

  if (r.chemistry) {
    out.push(`### Chemistry-dependent obligations (${r.chemistry.label})`, "");
    out.push("| Obligation | Status | Basis |", "|---|---|---|");
    out.push(
      `| Battery passport (Art. 77) | Applies | From ${APPLIES_FROM} for industrial batteries over 2 kWh, EV and LMT batteries, every chemistry. |`
    );
    for (const c of r.chemistry.rows)
      out.push(
        `| ${mdCell(c.item)} | ${APPLICABILITY_LABEL[c.status]} | ${mdCell(c.note)} |`
      );
    out.push("");
  }

  out.push("### What you have", "");
  if (have.length === 0) out.push("Nothing yet recorded.", "");
  else {
    out.push("| Item | Annex XIII layer | What you gave us |", "|---|---|---|");
    for (const x of have)
      out.push(
        `| ${mdCell(x.item)} | ${mdCell(x.layer)} | ${mdCell(x.reportStatus === "have_figure" ? `${x.value} (as you gave it; not verified)` : `You report: "${x.customerStatement}" (not reviewed)`)} |`
      );
    out.push("");
  }

  out.push("### What is missing, and who supplies it", "");
  if (missing.length === 0)
    out.push("No public-layer item is missing from what you told us.", "");
  else {
    out.push("| Item | Who supplies it |", "|---|---|");
    for (const x of missing)
      out.push(`| ${mdCell(x.item)} | ${mdCell(x.note)} |`);
    out.push("");
  }

  out.push("### Restricted layers (prepare, but not public)", "");
  for (const x of restricted)
    out.push(
      `- **${x.item}** (${x.layer}): ${x.reportStatus === "restricted_prepared" ? `you report: "${x.customerStatement}" (not reviewed). ` : "not yet prepared. "}${x.note}`
    );
  out.push("");
  out.push("### Outside the Art. 77 passport", "");
  for (const x of outside) out.push(`- ${x.item}: ${x.note}`);
  out.push("");
  if (r.errors.length) out.push(`Intake notes: ${r.errors.join(" ")}`, "");
  return out.join("\n");
}

export function buildGapReport(intake: GapReportIntake): GapReport {
  validateIntake(intake);
  const models = intake.models.map(modelReport);
  const md: string[] = [];
  md.push(`# EU Battery Passport gap report — ${clean(intake.company)}`, "");
  md.push(
    `Prepared by AuthiChain on ${intake.preparedOn}. Order ${clean(intake.orderRef)}. ${models.length} battery model${models.length === 1 ? "" : "s"}.`,
    ""
  );
  md.push(`> ${REPORT_DISCLAIMER}`, "");
  md.push("## Scope", "");
  md.push(
    `Regulation (EU) 2023/1542, Art. 77, requires a battery passport for LMT batteries, industrial batteries over 2 kWh and EV batteries placed on the EU market from ${APPLIES_FROM}. Annex XIII sets what the passport holds, in layers: public, interested persons, authorities, and legitimate interest.`,
    ""
  );
  md.push(
    "For each model this report lists which Annex XIII items you have, which are missing, and who in your supply chain supplies each missing item. It is built from the figures and statements in your intake. Where you told us a document exists, we record your words; we did not review the document.",
    ""
  );
  md.push(
    "## Summary",
    "",
    "| Model | You have | Missing | Energy check |",
    "|---|---|---|---|"
  );
  for (const r of models)
    md.push(
      `| ${mdCell(r.model)} | ${r.counts.have_figure + r.counts.have_reported} | ${r.counts.missing} | ${r.consistency.startsWith("Consistent") ? "Consistent" : r.consistency.startsWith("Recheck") ? "Recheck" : "Cannot check"} |`
    );
  md.push("");
  models.forEach((r, i) => md.push(modelMarkdown(r, i + 1)));
  md.push("## Next steps", "");
  md.push(
    "1. Confirm who places each battery on the EU market; that operator issues the passport and supplies operator-only items."
  );
  md.push("2. Request each missing item from the party named in its row.");
  md.push(
    "3. Fix any energy figures marked Recheck before they go into a passport."
  );
  md.push(
    "4. Prepare the restricted-layer data; it is shared only with the parties named, not published."
  );
  md.push("");
  md.push("---", "", REPORT_DISCLAIMER, "");
  const markdown = md.join("\n");
  return { markdown, html: markdownToHtml(markdown), models };
}

/**
 * Plain-text questions to email a buyer after payment. Built from the same
 * Annex XIII rows as the report, so each answer maps to one intake field.
 */
export function intakeQuestionnaire(): string {
  // Every figure filled in, so only items the customer supplies as documents remain.
  const rows = annexXiiiRows({
    model: "x",
    statedWh: 1,
    ah: 1,
    nominalV: 1,
    cyclesLow: 1,
    cyclesHigh: 1,
    placing: "unknown",
  });
  const ask = rows.filter(
    r => r.status === "needs_operator" || r.status === "not_public"
  );
  const out: string[] = [
    "Thank you for ordering the EU Battery Passport gap report. To write it, we need the following for each battery model. Answer what you can; anything you leave blank is reported as missing.",
    "",
    "Per model:",
    "1. Model designation [model]",
    "2. Stated energy in Wh [statedWh]",
    "3. Rated capacity in Ah [ah]",
    "4. Nominal voltage in V [nominalV]",
    "5. Expected lifetime in cycles, as a range if you have one [cyclesLow, cyclesHigh]",
    "6. Who places this battery on the EU market: you, your cell maker, or not yet confirmed? [placing: self | cell_maker | unknown]",
    `7. Cell chemistry [chemistry: ${CHEMISTRY_IDS.join(" | ")}]`,
    "",
    'For each item below, tell us whether you hold it and briefly what it is (for example, "declaration of conformity, draft rev B"). We record your answer in your words and do not review the documents.',
  ];
  ask.forEach((r, i) => out.push(`${i + 8}. ${r.item} [available.${r.id}]`));
  out.push("", REPORT_DISCLAIMER, "");
  return out.join("\n");
}

const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const inline = (s: string): string =>
  esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

/** Minimal renderer for the markdown this module emits (headings, tables, lists, quotes). */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith("|")) {
      const cells = (row: string) =>
        row
          .slice(1, -1)
          .split(/(?<!\\)\|/)
          .map(c => c.trim().replace(/\\\|/g, "|"));
      const head = cells(l);
      i += 2; // header + separator
      const body: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|"))
        body.push(cells(lines[i++]));
      out.push(
        `<table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body
          .map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`
      );
      continue;
    }
    if (/^- /.test(l) || /^\d+\. /.test(l)) {
      const ordered = /^\d+\. /.test(l);
      const items: string[] = [];
      while (
        i < lines.length &&
        (ordered ? /^\d+\. /.test(lines[i]) : /^- /.test(lines[i]))
      )
        items.push(lines[i++].replace(ordered ? /^\d+\. / : /^- /, ""));
      const tag = ordered ? "ol" : "ul";
      out.push(
        `<${tag}>${items.map(t => `<li>${inline(t)}</li>`).join("")}</${tag}>`
      );
      continue;
    }
    const h = /^(#{1,3}) (.*)$/.exec(l);
    if (h) out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
    else if (l.startsWith("> "))
      out.push(`<blockquote>${inline(l.slice(2))}</blockquote>`);
    else if (l === "---") out.push("<hr>");
    else if (l.trim()) out.push(`<p>${inline(l)}</p>`);
    i++;
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>EU Battery Passport gap report</title><style>body{font:15px/1.5 system-ui,sans-serif;max-width:860px;margin:2rem auto;padding:0 16px;color:#111}table{border-collapse:collapse;width:100%;margin:.5rem 0 1rem}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f3f3f3}blockquote{border-left:4px solid #999;margin:1rem 0;padding:.25rem 1rem;background:#f8f8f8}</style></head><body>${out.join("\n")}</body></html>\n`;
}
