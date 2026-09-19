import { test } from "node:test";
import assert from "node:assert/strict";
import { AGENTZ_PATHS } from "./agentz-paths.ts";

test("AgentZ paths have no /api prefix", () => {
  assert.equal(AGENTZ_PATHS.agents, "/agents");
  assert.equal(AGENTZ_PATHS.workflows, "/workflows");
  assert.equal(AGENTZ_PATHS.architectCycle, "/architect/cycle");
  assert.equal(
    AGENTZ_PATHS.runWorkflow("stripe_mcp"),
    "/workflows/stripe_mcp/run"
  );
  for (const path of [
    AGENTZ_PATHS.agents,
    AGENTZ_PATHS.workflows,
    AGENTZ_PATHS.architectCycle,
    AGENTZ_PATHS.runWorkflow("x"),
  ]) {
    assert.equal(
      path.startsWith("/api/"),
      false,
      `erroneous /api prefix: ${path}`
    );
  }
});
