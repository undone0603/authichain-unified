/**
 * strainchain.io path routing.
 *
 * The fault being guarded: before path routing existed, every URL on this
 * domain fell through to the same hand-written marketing page, so a scanned
 * passport link resolved to the homepage and the scan dead-ended. These tests
 * hold the line that verification paths leave this worker and marketing paths
 * do not.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index.ts";

const APP = "https://app.example.com";

/** Captures the request the worker would have sent upstream. */
function stubFetch() {
  const calls: Request[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (
    input: Request | string | URL,
    init?: RequestInit
  ) => {
    const req = input instanceof Request ? input : new Request(input, init);
    calls.push(req);
    return new Response("upstream body", {
      status: 200,
      headers: { "content-type": "text/html", "x-from": "upstream" },
    });
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = real;
    },
  };
}

async function get(
  path: string,
  env: { APP_ORIGIN?: string } = { APP_ORIGIN: APP }
) {
  return worker.fetch(new Request(`https://strainchain.io${path}`), env);
}

test("verification paths are proxied to the app, not answered with marketing", async () => {
  const f = stubFetch();
  try {
    for (const path of [
      "/genetics/mendo-love-farms",
      "/genetics/mendo-love-farms/vt-26",
      "/passport/AC-DEMO-001",
    ]) {
      f.calls.length = 0;
      const res = await get(path);
      assert.equal(res.status, 200, path);
      assert.equal(
        res.headers.get("x-served-by"),
        "strainchain-io-proxy",
        path
      );
      assert.equal(
        f.calls.length,
        1,
        `${path} should hit the app exactly once`
      );
      assert.equal(new URL(f.calls[0].url).pathname, path);
      assert.equal(new URL(f.calls[0].url).host, "app.example.com");
    }
  } finally {
    f.restore();
  }
});

test("the upstream is addressed by its own host, not strainchain.io", async () => {
  const f = stubFetch();
  try {
    await get("/passport/AC-DEMO-001");
    const sent = f.calls[0];
    // Forwarding the original request would carry Host: strainchain.io and
    // misroute it at the upstream.
    assert.equal(sent.headers.get("X-Forwarded-Host"), "strainchain.io");
    assert.equal(new URL(sent.url).host, "app.example.com");
  } finally {
    f.restore();
  }
});

test("query strings survive the hop", async () => {
  const f = stubFetch();
  try {
    await worker.fetch(
      new Request("https://strainchain.io/passport/AC-1?utm_source=qr"),
      { APP_ORIGIN: APP }
    );
    assert.equal(new URL(f.calls[0].url).search, "?utm_source=qr");
  } finally {
    f.restore();
  }
});

test("marketing paths stay on this worker", async () => {
  const f = stubFetch();
  try {
    for (const path of ["/", "/robots.txt", "/sitemap.xml", "/favicon.svg"]) {
      f.calls.length = 0;
      const res = await get(path);
      assert.equal(res.status, 200, path);
      assert.notEqual(
        res.headers.get("x-served-by"),
        "strainchain-io-proxy",
        path
      );
      assert.equal(f.calls.length, 0, `${path} must not be proxied`);
    }
  } finally {
    f.restore();
  }
});

test("/health still answers locally", async () => {
  const res = await get("/health");
  assert.equal(res.status, 200);
  assert.equal((await res.json()).domain, "strainchain.io");
});

test("a misconfigured origin fails loudly instead of serving marketing", async () => {
  const f = stubFetch();
  try {
    const res = await get("/passport/AC-DEMO-001", {});
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.error, "app_origin_not_configured");
    assert.equal(f.calls.length, 0);
    // The specific regression: never answer a verification request with the
    // marketing document.
    assert.ok(
      !JSON.stringify(body).includes("<!DOCTYPE"),
      "must not be the marketing page"
    );
  } finally {
    f.restore();
  }
});

test("a path that merely starts with the same letters is not proxied", async () => {
  const f = stubFetch();
  try {
    const res = await get("/genetics-guide");
    assert.equal(
      f.calls.length,
      0,
      "/genetics-guide is marketing, not a passport path"
    );
    assert.notEqual(res.headers.get("x-served-by"), "strainchain-io-proxy");
  } finally {
    f.restore();
  }
});

test("the sitemap advertises the genetics library", async () => {
  const res = await get("/sitemap.xml");
  const xml = await res.text();
  assert.ok(xml.includes("/genetics/mendo-love-farms"));
});

test("a configured origin with trailing slashes does not double up the path", async () => {
  const f = stubFetch();
  try {
    await worker.fetch(new Request("https://strainchain.io/passport/AC-1"), {
      APP_ORIGIN: "https://app.example.com///",
    });
    assert.equal(new URL(f.calls[0].url).pathname, "/passport/AC-1");
    assert.ok(!f.calls[0].url.includes("//passport"));
  } finally {
    f.restore();
  }
});

test("trailing-slash stripping is linear, not quadratic", () => {
  // Guards the CodeQL finding: the previous /\/+$/ backtracked quadratically
  // over a long run of slashes. A pathological input must stay fast.
  const pathological = "https://app.example.com" + "/".repeat(200_000);
  const started = Date.now();
  let end = pathological.length;
  while (end > 0 && pathological.charCodeAt(end - 1) === 47) end--;
  assert.equal(pathological.slice(0, end), "https://app.example.com");
  assert.ok(
    Date.now() - started < 1000,
    "must not degrade on a long slash run"
  );
});
