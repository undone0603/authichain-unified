export const SI_FEED_SOURCES = ["agentz", "automation", "github"] as const;

export type SiFeedSource = (typeof SI_FEED_SOURCES)[number];

export type AutomationLog = {
  id: string;
  workflow_name: string;
  trigger_type: string;
  status: string;
  created_at: string;
};

export type SiFeedEvent = {
  id: string;
  timestamp: string;
  source: SiFeedSource;
  transport: string;
  type: string;
  severity: string;
  entity: string;
  summary: string;
  data: { status: string };
  status: string;
  agent: string | null;
};

const FAILED_STATUSES = new Set(["failure", "failed", "error", "critical"]);
const COMPLETED_STATUSES = new Set([
  "success",
  "succeeded",
  "complete",
  "completed",
]);

export function isSiFeedSource(value: string): value is SiFeedSource {
  return SI_FEED_SOURCES.includes(value as SiFeedSource);
}

export function normalizeAutomationLog(row: AutomationLog): SiFeedEvent {
  const name = row.workflow_name;
  const status = row.status.toLowerCase();
  const failed = FAILED_STATUSES.has(status);
  const completed = COMPLETED_STATUSES.has(status);
  const github = name.startsWith("github.");
  const agentz = name.toLowerCase().startsWith("agentz_");
  const [githubType, githubEntity] = github
    ? [name.split("|", 1)[0], name.split("|").slice(1).join("|")]
    : ["", ""];
  const source: SiFeedSource = github
    ? "github"
    : agentz
      ? "agentz"
      : "automation";
  const entity = github ? githubEntity || "GitHub" : name;
  const outcome = failed
    ? "run_failed"
    : completed
      ? "run_completed"
      : "run_updated";

  return {
    id: row.id,
    timestamp: row.created_at,
    source,
    transport:
      row.trigger_type === "webhook"
        ? "webhook"
        : row.trigger_type === "cron"
          ? "schedule"
          : "event-log",
    type: github ? githubType : `automation.${outcome}`,
    severity: failed ? "warning" : "info",
    entity,
    summary: github
      ? `GitHub ${githubType.replace(/^github\./, "").replaceAll(".", " ")} · ${entity}`
      : `${name.replace(/[_-]/g, " ")} ${
          failed
            ? "reported a failure"
            : completed
              ? "completed"
              : `updated · ${row.status}`
        }`,
    data: { status: row.status },
    status: row.status,
    agent: agentz ? "AgentZ" : null,
  };
}

export function applyFeedFilters(
  events: SiFeedEvent[],
  filters: {
    source?: string | null;
    agent?: string | null;
    severity?: string | null;
    entity?: string | null;
  }
): SiFeedEvent[] {
  const entity = filters.entity?.trim().toLowerCase();
  return events.filter(
    event =>
      (!filters.source ||
        filters.source === "all" ||
        event.source === filters.source) &&
      (!filters.agent ||
        filters.agent === "all" ||
        event.agent?.toLowerCase() === filters.agent.toLowerCase()) &&
      (!filters.severity ||
        filters.severity === "all" ||
        event.severity === filters.severity) &&
      (!entity || event.entity.toLowerCase().includes(entity))
  );
}
