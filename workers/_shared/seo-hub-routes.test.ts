import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SEO_ROOT_REDIRECT_SLUGS,
  isSeoPassportPath,
  tryRedirectSeoRootCanonical,
} from "./seo-hub-routes.ts";

test("isSeoPassportPath matches /p and /p/<slug>, not /pricing", () => {
  assert.equal(isSeoPassportPath("/p"), true);
  assert.equal(isSeoPassportPath("/p/"), true);
  assert.equal(isSeoPassportPath("/p/cannabis-blockchain-provenance"), true);
  assert.equal(isSeoPassportPath("/pricing"), false);
  assert.equal(isSeoPassportPath("/passport"), false);
  assert.equal(isSeoPassportPath("/partner-program"), false);
  assert.equal(isSeoPassportPath("/onboard"), false);
});

test("tryRedirectSeoRootCanonical 301s seed roots to /p/<slug>", () => {
  const res = tryRedirectSeoRootCanonical(
    new Request("https://strainchain.io/cannabis-blockchain-provenance")
  );
  assert.ok(res);
  assert.equal(res.status, 301);
  assert.equal(
    res.headers.get("location"),
    "https://strainchain.io/p/cannabis-blockchain-provenance"
  );
});

test("tryRedirectSeoRootCanonical keeps query strings and strips a trailing slash", () => {
  const res = tryRedirectSeoRootCanonical(
    new Request("https://qron.space/ai-qr-code-art-generator/?utm_source=seed")
  );
  assert.ok(res);
  assert.equal(res.status, 301);
  assert.equal(
    res.headers.get("location"),
    "https://qron.space/p/ai-qr-code-art-generator?utm_source=seed"
  );
});

test("authentic-agentic-economy is not in the redirect set", () => {
  assert.ok(
    !SEO_ROOT_REDIRECT_SLUGS.includes(
      "authentic-agentic-economy" as (typeof SEO_ROOT_REDIRECT_SLUGS)[number]
    )
  );
  assert.equal(
    tryRedirectSeoRootCanonical(
      new Request("https://authichain.com/authentic-agentic-economy")
    ),
    null
  );
});

test("tryRedirectSeoRootCanonical ignores unknown paths, nested paths, and POST", () => {
  assert.equal(
    tryRedirectSeoRootCanonical(new Request("https://govchain.us/nope")),
    null
  );
  assert.equal(
    tryRedirectSeoRootCanonical(
      new Request(
        "https://govchain.us/government-document-verification-blockchain/extra"
      )
    ),
    null
  );
  assert.equal(
    tryRedirectSeoRootCanonical(
      new Request("https://authichain.com/what-is-a-digital-product-passport", {
        method: "POST",
      })
    ),
    null
  );
  assert.equal(
    tryRedirectSeoRootCanonical(new Request("https://strainchain.io/")),
    null
  );
});

test("every listed slug redirects on GET and HEAD", () => {
  for (const slug of SEO_ROOT_REDIRECT_SLUGS) {
    for (const method of ["GET", "HEAD"] as const) {
      const res = tryRedirectSeoRootCanonical(
        new Request(`https://authichain.com/${slug}`, { method })
      );
      assert.ok(res, `${method} /${slug}`);
      assert.equal(res.status, 301, `${method} /${slug}`);
      assert.equal(
        res.headers.get("location"),
        `https://authichain.com/p/${slug}`,
        `${method} /${slug}`
      );
    }
  }
});
