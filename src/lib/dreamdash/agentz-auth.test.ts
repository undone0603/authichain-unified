import { describe, expect, it } from "vitest";
import { isAgentzRequest } from "./agentz-auth";

describe("isAgentzRequest", () => {
  const env = { AGENTZ_WEBHOOK_SECRET: "hook-secret", AGENT_SECRET: "agent-secret" };

  it("rejects anonymous requests", () => {
    expect(isAgentzRequest(new Headers(), env)).toBe(false);
  });

  it("accepts x-agentz-secret", () => {
    expect(isAgentzRequest(new Headers({ "x-agentz-secret": "hook-secret" }), env)).toBe(true);
  });

  it("accepts Bearer AGENT_SECRET", () => {
    expect(isAgentzRequest(new Headers({ authorization: "Bearer agent-secret" }), env)).toBe(true);
  });

  it("rejects a wrong secret", () => {
    expect(isAgentzRequest(new Headers({ "x-agentz-secret": "nope" }), env)).toBe(false);
  });

  it("fails closed when no secrets are configured", () => {
    expect(isAgentzRequest(new Headers({ "x-agentz-secret": "hook-secret" }), {})).toBe(false);
  });
});
