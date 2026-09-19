/**
 * govchain.us path routing.
 *
 * The fault being guarded: every URL on this domain used to fall through to the
 * same marketing page at HTTP 200, so an unknown path, a mistyped notice id and
 * a real opportunity were indistinguishable to a crawler or an uptime check.
 * The homepage's own live feed suffered the same bug from the other side — it
 * fetched /api/govchain/* and got HTML back, so it always rendered its fallback.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index.ts";

const ENV = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon-test-key",
  APP_ORIGIN: "https://app.example.com",
};

type StubRow = Record<string, unknown>;

/** Serves canned PostgREST responses and records the URLs asked for. */
function stubSupabase(rows: StubRow[], count = rows.length) {
  const calls: string[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: Request | string | URL) => {
    const href = input instanceof Request ? input.url : String(input);
    calls.push(href);
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "content-range": `0-0/${count}`,
      },
    });
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = real;
    },
  };
}

async function get(path: string, env: Partial<typeof ENV> = ENV) {
  return worker.fetch(
    new Request(`https://govchain.us${path}`),
    env as typeof ENV
  );
}

const ROW = {
  notice_id: "ABC123",
  title: "Cyber support services",
  agency: "GSA",
  deadline: "2026-11-01T00:00:00Z",
  naics_code: "541512",
  fit_score: 88,
  sam_url: "https://sam.gov/opp/ABC123/view",
  status: "scored",
};

test("an unknown path is a 404, not the homepage at 200", async () => {
  for (const path of ["/nope-xyz123", "/pricing", "/deep/unknown/path"]) {
    const res = await get(path);
    assert.equal(res.status, 404, `${path} should 404`);
    const body = await res.text();
    assert.match(body, /does not exist/);
    assert.doesNotMatch(body, /Federal Contract Intelligence &/);
  }
});

test("the apex still renders the marketing page", async () => {
  const res = await get("/");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Federal Contract Intelligence/);
  assert.match(html, /href="\/onboard"/);
  assert.match(html, /--bg: #ffffff/);
});

test("the sitemap lists only real URLs and no fragments", async () => {
  const res = await get("/sitemap.xml");
  const xml = await res.text();
  assert.equal(res.status, 200);
  assert.ok(!xml.includes("/#"), "fragment URLs are not distinct pages");
  assert.ok(xml.includes("<loc>https://govchain.us/opportunities</loc>"));
  assert.ok(xml.includes("<loc>https://govchain.us/onboard</loc>"));
});

test("IndexNow key file is served as short-cache plain text", async () => {
  const res = await get("/authichain2026indexnow.txt");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(res.headers.get("cache-control"), "public, max-age=3600");
  assert.equal(await res.text(), "authichain2026indexnow");
  assert.equal((await get("/authichain2026indexnow.txt/")).status, 404);
});

test("robots and sitemap still answer after the IndexNow route", async () => {
  const robots = await get("/robots.txt");
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Sitemap: https:\/\/govchain.us\/sitemap.xml/);
  const sitemap = await get("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(await sitemap.text(), /<urlset/);
});

test("/onboard is proxied to the app, not answered with a 404", async () => {
  const real = globalThis.fetch;
  const calls: Request[] = [];
  globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    calls.push(req);
    return new Response("onboard", { status: 200 });
  }) as typeof fetch;
  try {
    const res = await get("/onboard");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-served-by"), "govchain-us-proxy");
    assert.equal(calls.length, 1);
    assert.equal(new URL(calls[0].url).pathname, "/onboard");
  } finally {
    globalThis.fetch = real;
  }
});

test("/api/govchain/opportunities returns JSON the homepage can parse", async () => {
  const f = stubSupabase([ROW]);
  try {
    const res = await get("/api/govchain/opportunities?min_fit=70&limit=6");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    const body = (await res.json()) as { opportunities: StubRow[] };
    assert.equal(body.opportunities.length, 1);
    assert.equal(body.opportunities[0].notice_id, "ABC123");
    assert.ok(
      f.calls[0].includes("fit_score=gte.70"),
      "min_fit reaches PostgREST"
    );
    assert.ok(f.calls[0].includes("limit=6"), "limit reaches PostgREST");
  } finally {
    f.restore();
  }
});

test("/api/govchain/stats reads exact counts from Content-Range", async () => {
  const f = stubSupabase([ROW], 42);
  try {
    const res = await get("/api/govchain/stats");
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, number>;
    assert.equal(body.opportunities_scored, 42);
    assert.equal(body.high_fit, 42);
    assert.equal(body.proposals_drafted, 42);
  } finally {
    f.restore();
  }
});

test("/opportunities renders rows server-side", async () => {
  const f = stubSupabase([ROW]);
  try {
    const res = await get("/opportunities");
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Cyber support services/);
    assert.match(html, /Fit 88/);
    assert.match(html, /\/opportunities\/ABC123/);
  } finally {
    f.restore();
  }
});

test("a notice id with no row is a 404, not an empty page at 200", async () => {
  const f = stubSupabase([]);
  try {
    const res = await get("/opportunities/NOSUCHID");
    assert.equal(res.status, 404);
  } finally {
    f.restore();
  }
});

test("an unconfigured Supabase surfaces as 503, never as marketing HTML", async () => {
  const res = await get("/api/govchain/opportunities", {});
  assert.equal(res.status, 503);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, "supabase_not_configured");

  const page = await get("/opportunities", {});
  assert.equal(page.status, 503);
});

test("row text is escaped, so a hostile title cannot inject markup", async () => {
  const f = stubSupabase([{ ...ROW, title: "<script>alert(1)</script>" }]);
  try {
    const html = await (await get("/opportunities")).text();
    assert.ok(
      !html.includes("<script>alert(1)</script>"),
      "title must be escaped"
    );
    assert.match(html, /&lt;script&gt;/);
  } finally {
    f.restore();
  }
});

test("a non-https sam_url is not rendered as a link", async () => {
  const f = stubSupabase([{ ...ROW, sam_url: "javascript:alert(1)" }]);
  try {
    const html = await (await get("/opportunities")).text();
    assert.ok(
      !html.includes("javascript:alert(1)"),
      "only https links are rendered"
    );
  } finally {
    f.restore();
  }
});

test("reads go through the public views, never the base tables", async () => {
  // The base tables are deny-all for anon and hold contact_email, raw and
  // recommended_action. Querying them directly is both broken (empty 200) and
  // a PII exposure if a policy were ever added to "fix" the emptiness.
  const f = stubSupabase([ROW], 7);
  try {
    await get("/api/govchain/opportunities");
    await get("/api/govchain/stats");
    assert.ok(f.calls.length > 0, "should have queried Supabase");
    for (const url of f.calls) {
      const table = new URL(url).pathname.split("/rest/v1/")[1] ?? "";
      assert.ok(
        table.startsWith("gov_opportunities_public") || table.startsWith("gov_proposals_public"),
        `query hit ${table}, expected a *_public view`,
      );
    }
  } finally {
    f.restore();
  }
});
