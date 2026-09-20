/**
 * Claw ↔ AgentZ mode contract (mirrors agentz/api/mode_contract.py).
 *
 * Chat `run <id>` used to POST `{ mode: "confirm" }` with no query string.
 * FastAPI ignored the body. Honor mode end-to-end via `?mode=` + JSON, and
 * keep architect / cold-email dry-run unless `--live` is explicit.
 */

export const DEFAULT_MODE = "dry-run";
export const VALID_MODES = ["dry-run", "confirm", "auto"] as const;
export type AgentzMode = (typeof VALID_MODES)[number];

export function parseModeArgs(args: string[] | undefined): {
  mode: string;
  live: boolean;
} {
  const tokens = args ?? [];
  let mode = DEFAULT_MODE;
  let live = false;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === "--live" || token === "live") {
      live = true;
      continue;
    }
    if (token === "--mode" && tokens[i + 1]) {
      mode = tokens[++i];
      continue;
    }
    if ((VALID_MODES as readonly string[]).includes(token)) {
      mode = token;
    }
  }
  return { mode, live };
}

export function isFailClosedWorkflow(
  workflowId: string | undefined,
  endpoint: "workflow" | "architect" = "workflow"
): boolean {
  if (endpoint === "architect") return true;
  if (!workflowId) return false;
  const id = workflowId.trim().toLowerCase();
  return id === "architect_cycle" || id.includes("email");
}

export function resolveAgentzMode(opts: {
  requested: string;
  live?: boolean;
  failClosed?: boolean;
}): { mode: AgentzMode; coerced: boolean } {
  const requested = (VALID_MODES as readonly string[]).includes(opts.requested)
    ? (opts.requested as AgentzMode)
    : DEFAULT_MODE;
  if (opts.failClosed && requested !== DEFAULT_MODE && !opts.live) {
    return { mode: DEFAULT_MODE, coerced: true };
  }
  return { mode: requested, coerced: false };
}

export function withModeQuery(
  path: string,
  mode: string,
  live = false
): string {
  const params = new URLSearchParams();
  params.set("mode", mode);
  if (live) params.set("live", "true");
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${params.toString()}`;
}
