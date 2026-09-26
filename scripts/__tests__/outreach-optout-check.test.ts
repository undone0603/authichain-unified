// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { checkOptOut } from "../outreach-optout-check";
import {
  registerUnsubscribeRoutes,
  type UnsubscribeBindings,
} from "../../worker-app/unsubscribe-routes";

const EDGE: UnsubscribeBindings = {
  OUTREACH_UNSUBSCRIBE_SECRET: "shared-secret",
  SUPABASE_URL: "https://db.example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
};

/** A fetch that answers from the real edge routes, with the given Worker env. */
function edgeFetch(env: UnsubscribeBindings) {
  const app = new Hono<{
    Bindings: UnsubscribeBindings;
    Variables: Record<string, never>;
  }>();
  registerUnsubscribeRoutes(app);
  return (async (input: string | URL) => {
    const u = new URL(String(input));
    return app.request(u.pathname + u.search, {}, env);
  }) as typeof fetch;
}

describe("checkOptOut", () => {
  it("is ready when GitHub and the edge hold the same secret", async () => {
    const r = await checkOptOut(
      { OUTREACH_UNSUBSCRIBE_SECRET: "shared-secret" },
      edgeFetch(EDGE)
    );
    expect(r).toMatchObject({ ready: true, kind: "signed_link" });
  });

  it("is not ready when the secrets differ", async () => {
    const r = await checkOptOut(
      { OUTREACH_UNSUBSCRIBE_SECRET: "github-only-value" },
      edgeFetch(EDGE)
    );
    expect(r.ready).toBe(false);
    expect(r.reason).toMatch(/different OUTREACH_UNSUBSCRIBE_SECRET/);
  });

  it("is not ready when the edge has no secret bound", async () => {
    const r = await checkOptOut(
      { OUTREACH_UNSUBSCRIBE_SECRET: "shared-secret" },
      edgeFetch({ ...EDGE, OUTREACH_UNSUBSCRIBE_SECRET: undefined })
    );
    expect(r.ready).toBe(false);
    expect(r.reason).toMatch(/would 503/);
  });

  it("is not ready when the route isn't deployed", async () => {
    const r = await checkOptOut(
      { OUTREACH_UNSUBSCRIBE_SECRET: "shared-secret" },
      (async () => new Response("Not Found", { status: 404 })) as typeof fetch
    );
    expect(r.ready).toBe(false);
    expect(r.reason).toMatch(/HTTP 404/);
  });

  it("is not ready when the edge can't be reached", async () => {
    const r = await checkOptOut(
      { OUTREACH_UNSUBSCRIBE_SECRET: "shared-secret" },
      (async () => {
        throw new Error("connect ECONNREFUSED");
      }) as typeof fetch
    );
    expect(r.ready).toBe(false);
    expect(r.reason).toMatch(/unreachable/);
  });

  it("accepts an operator-attested https page or hand-processed mailto", async () => {
    expect(
      (await checkOptOut({ UNSUBSCRIBE_URL: "https://example.com/optout" }))
        .kind
    ).toBe("configured_url");
    expect(
      (await checkOptOut({ OUTREACH_ALLOW_MAILTO_OPTOUT: "true" })).kind
    ).toBe("mailto");
  });

  it("is not ready with nothing configured", async () => {
    expect(await checkOptOut({})).toMatchObject({ ready: false, kind: "none" });
    // A mailto: UNSUBSCRIBE_URL is not an https page.
    expect((await checkOptOut({ UNSUBSCRIBE_URL: "mailto:x@y.z" })).ready).toBe(
      false
    );
  });
});
