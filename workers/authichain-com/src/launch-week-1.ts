/**
 * Launch Week #1 landing section for the authichain.com homepage (AED-09).
 *
 * Copy comes word for word from the "Visual" section of the Launch Week #1
 * announcement draft (00-announcement.md, sha256 recorded in the PR). Do not
 * edit the strings here without changing that file first.
 *
 * Each ship condition is one line in LAUNCH_WEEK_1. The defaults are the
 * conservative text: the section is off, Monday is live, and Tuesday through
 * Thursday read "(planned)".
 * Turning `show` on is Zac's Tier 2 go, and not
 * before Oct 12, 2026.
 *
 * Styling reuses the estate CSS variables (Plus Jakarta Sans, --accent, ...).
 * No scripts, no external assets. The only link is /contact, and only once
 * the lead form is live.
 */

export interface LaunchWeek1Flags {
  /** Render the section on "/". Off until Zac's Tier 2 go (not before Oct 12, 2026). */
  show: boolean;
  /** Day 1 is live (npm package published and installs cleanly). Otherwise Monday stays "(planned)". */
  day1Live: boolean;
  /** Day 2 is live. Otherwise Tuesday stays "(planned)". */
  day2Live: boolean;
  /** The "Talk to us" lead form is live by Oct 12. Otherwise Wednesday reads "Talk to us (planned)". */
  leadFormLive: boolean;
  /** The battery passport gap check is live by Oct 15. Otherwise Thursday reads "Battery passport gap check (planned)". */
  day4Live: boolean;
}

export const LAUNCH_WEEK_1: LaunchWeek1Flags = {
  show: false,
  day1Live: true,
  day2Live: false,
  leadFormLive: false,
  day4Live: false,
};

export const LW1_HEADLINE = "Launch Week #1: Oct 12–16";
export const LW1_SUBLINE =
  "Digital Product Passport tooling, one piece a day as it ships, starting with an open-source verifier. Then a Friday recap.";
export const LW1_NO_AFFILIATION =
  "AuthiChain is an independent brand of Zachary Kietzman and is not affiliated with, endorsed by, or acting on behalf of any government agency.";

export interface LaunchWeek1Row {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri";
  label: string;
  planned: boolean;
  href?: string;
}

export function launchWeek1Rows(flags: LaunchWeek1Flags = LAUNCH_WEEK_1): LaunchWeek1Row[] {
  return [
    // If Day 1 slips, the verifier moves to "planned" (00-announcement.md, "If Day 1 slips").
    { day: "Mon", label: "Open verifier", planned: !flags.day1Live },
    // Day 2 stays "(planned)" until it ships.
    { day: "Tue", label: "A place for agents to ask", planned: !flags.day2Live },
    flags.leadFormLive
      ? { day: "Wed", label: "Talk to us", planned: false, href: "/contact" }
      : { day: "Wed", label: "Talk to us", planned: true },
    { day: "Thu", label: "Battery passport gap check", planned: !flags.day4Live },
    { day: "Fri", label: "The recap", planned: false },
  ];
}

const LW1_CSS = `
.lw1 { padding: 72px 20px; border-top: 1px solid var(--border); }
.lw1-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 56px; align-items: center; }
.lw1-title { font-family: var(--display); font-size: clamp(2.2rem, 5vw, 3rem); font-weight: 600; line-height: 1.08; letter-spacing: -0.03em; color: var(--ink); }
.lw1-sub { margin-top: 18px; max-width: 34rem; font-size: 1.05rem; color: var(--text-dim); }
.lw1-days { list-style: none; background: #fff; border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow); padding: 6px; }
.lw1-day { display: flex; align-items: center; gap: 14px; padding: 14px; }
.lw1-day + .lw1-day { border-top: 1px solid var(--border); }
.lw1-chip { flex: 0 0 auto; min-width: 40px; padding: 6px 8px; border-radius: 6px; background: var(--accent-soft); color: var(--accent); font-size: 0.72rem; font-weight: 600; text-align: center; }
.lw1-day:last-child .lw1-chip { background: var(--accent); color: var(--accent-ink); }
.lw1-sep { color: var(--muted); }
.lw1-label { color: var(--text); font-weight: 500; }
.lw1-label a { color: inherit; }
.lw1-planned { color: var(--muted); font-weight: 400; }
.lw1-nowrap { white-space: nowrap; }
.lw1-affiliation { grid-column: 2; margin: 12px 0 0; color: #64748b; font-size: 13px; text-align: left; }
@media (max-width: 767px) {
  .lw1 { padding: 48px 20px; }
  .lw1-grid { grid-template-columns: minmax(0, 1fr); gap: 32px; }
  .lw1-affiliation { grid-column: 1; }
}
`;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The section HTML, or "" while `show` is off. */
export function launchWeek1Section(flags: LaunchWeek1Flags = LAUNCH_WEEK_1): string {
  if (!flags.show) return "";
  const rows = launchWeek1Rows(flags)
    .map(r => {
      const text = r.href ? `<a href="${esc(r.href)}">${esc(r.label)}</a>` : esc(r.label);
      const planned = r.planned ? ` <span class="lw1-planned">(planned)</span>` : "";
      return `<li class="lw1-day"><span class="lw1-chip">${r.day}</span><span class="lw1-sep" aria-hidden="true">—</span><span class="lw1-label">${text}${planned}</span></li>`;
    })
    .join("\n        ");
  // Keep the dates on one line ("Launch Week #1:" / "Oct 12–16"); same text.
  const cut = LW1_HEADLINE.indexOf(": ") + 2;
  const headline = `${esc(LW1_HEADLINE.slice(0, cut))}<span class="lw1-nowrap">${esc(LW1_HEADLINE.slice(cut))}</span>`;
  return `<style>${LW1_CSS}</style>
  <section class="lw1" id="launch-week" aria-labelledby="lw1-heading">
    <div class="wrap lw1-grid">
      <div>
        <h2 class="lw1-title" id="lw1-heading">${headline}</h2>
        <p class="lw1-sub">${esc(LW1_SUBLINE)}</p>
      </div>
      <ol class="lw1-days">
        ${rows}
      </ol>
      <p class="lw1-affiliation">${esc(LW1_NO_AFFILIATION)}</p>
    </div>
  </section>`;
}
