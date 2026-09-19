/**
 * AgentZ FastAPI paths. There is no `/api` prefix on agentz.api.main.
 * The claw Worker must call these exact paths on AGENTZ_API_URL.
 */
export const AGENTZ_PATHS = {
  agents: "/agents",
  workflows: "/workflows",
  runWorkflow: (id: string) => `/workflows/${encodeURIComponent(id)}/run`,
  architectCycle: "/architect/cycle",
} as const;
