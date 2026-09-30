/**
 * GS1 Conformant Resolver 1.2 behaviour, one test per check in GS1's own
 * test suite (github.com/gs1/GS1DL-resolver-testsuite) that can be exercised
 * without the network, plus the honesty rules that must survive it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index.ts";
import GS1DigitalLinkToolkit from "./vendor/gs1-dl-toolkit.mjs";

const ORIGIN = "https://id.example.com";
const GTIN = "09506000134369";
const SERIAL = "SN123";
const DL = `${ORIGIN}/01/${GTIN}/21/${SERIAL}`;

const SEAL = {
  id: "seal-1",
  lookup_key: `gtin:${GTIN}:ser:${SERIAL}`,
  gtin: GTIN,
  lot: null,
  serial: SERIAL,
  cert_id: "AC-TEST-001",
  brand: "Acme",
  product_name: "Widget",
  issuer: "Acme Inc",
  chain: "polygon",
  contract: null,
  tx_hash: null,
  status: "active",
  status_reason: null,
  first_country: "US",
  first_activated_at: 1_700_000_000_000,
  scan_count: 3,
  last_scan_at: 1_700_000_000_000,
  metadata_json: null,
  created_at: 1_690_000_000_000,
};

/** D1 stand-in keyed on lookup_key, recording every statement. */
function env(statements: string[] = [], seals = [SEAL]) {
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    first: async () => {
      if (/COUNT\(\*\)/i.test(sql)) {
        const hits = seals.filter(s => s.gtin === args[0]);
        return {
          n: hits.length,
          brand: hits[0]?.brand ?? null,
          product_name: hits[0]?.product_name ?? null,
          issuer: hits[0]?.issuer ?? null,
        };
      }
      if (/FROM seals WHERE lookup_key/i.test(sql)) {
        return seals.find(s => s.lookup_key === args[0]) ?? null;
      }
      return null;
    },
    all: async () => ({ results: [] }),
    run: async () => ({ success: true }),
  });
  return {
    DB: {
      prepare(sql: string) {
        statements.push(sql.replace(/\s+/g, " ").trim());
        return stmt(sql);
      },
      batch: async (xs: unknown[]) => xs.map(() => ({ success: true })),
    },
    RESOLVER_ORIGIN: ORIGIN,
    PASSPORT_ORIGIN: "https://example.com",
  } as never;
}

const writes = (s: string[]) => s.filter(q => /^INSERT|^UPDATE/i.test(q));

async function get(
  url: string,
  init: RequestInit = {},
  statements: string[] = []
) {
  return worker.fetch(
    new Request(url, { redirect: "manual", ...init }),
    env(statements)
  );
}

test("methodsCheck / corsCheck: OPTIONS declares GET, HEAD and OPTIONS with CORS", async () => {
  const res = await get(DL, { method: "OPTIONS" });
  const methods = res.headers.get("access-control-allow-methods") ?? "";
  for (const m of ["GET", "HEAD", "OPTIONS"]) assert.ok(methods.includes(m), m);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
});

test("defaultTarget: a plain request 307s to the default link, exactly", async () => {
  const statements: string[] = [];
  const res = await get(DL, {}, statements);
  assert.equal(res.status, 307);
  assert.equal(
    res.headers.get("location"),
    `${ORIGIN}/verify/01/${GTIN}/21/${SERIAL}`
  );
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  assert.deepEqual(writes(statements), [], "resolving must not record a scan");
});

test("qsPassedOn: the query string is passed on when redirecting", async () => {
  const res = await get(`${DL}?foo=bar`);
  assert.equal(
    res.headers.get("location"),
    `${ORIGIN}/verify/01/${GTIN}/21/${SERIAL}?foo=bar`
  );
});

test("legacyLinkHeaders: the Link header carries the linkset, not gs1: links", async () => {
  const res = await get(DL);
  const link = res.headers.get("link") ?? "";
  assert.ok(link.includes('rel="linkset"'));
  assert.ok(!link.includes('rel="gs1:'));
});

test("reportWith400 / noErrorWith200: a malformed Digital Link is a 400", async () => {
  for (const bad of [
    `${DL}/foo`,
    `${ORIGIN}/01/09506000134368`, // wrong check digit
    `${ORIGIN}/01/${GTIN}/21/A/10/B`, // qualifiers out of order
  ]) {
    const res = await get(bad);
    assert.equal(res.status, 400, bad);
  }
});

test("trailingSlash: identical response with or without a trailing slash", async () => {
  const a = await get(DL);
  const b = await get(`${DL}/`);
  assert.equal(a.status, b.status);
  assert.equal(a.headers.get("location"), b.headers.get("location"));
});

test("HEAD answers like GET, with no body", async () => {
  const res = await get(DL, { method: "HEAD" });
  assert.equal(res.status, 307);
  assert.equal(await res.text(), "");
});

test("basicWalkUp: an unknown lot walks up to the GTIN", async () => {
  const res = await get(`${ORIGIN}/01/${GTIN}/10/KL8G`);
  assert.equal(res.status, 307);
  assert.equal(res.headers.get("location"), `${ORIGIN}/verify/01/${GTIN}`);
});

test("an unknown serial does NOT walk up: it is not_found", async () => {
  const res = await get(`${ORIGIN}/01/${GTIN}/21/NOPE`, {
    headers: { accept: "application/json" },
  });
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.status, "not_found");
  assert.ok(body.doesNotProve);
});

test("an unregistered GTIN is not_found", async () => {
  const res = await get(`${ORIGIN}/01/00012345678905`);
  assert.equal(res.status, 404);
});

const linksetSchemaOk = (ls: any) => {
  // The structural rules of gs1-linkset-schema.json.
  assert.ok(Array.isArray(ls.linkset));
  for (const entry of ls.linkset) {
    assert.match(entry.anchor, /^https?:\/\/[a-zA-Z0-9./]+/);
    for (const [k, v] of Object.entries(entry)) {
      if (k === "anchor" || k === "description" || k === "itemDescription")
        continue;
      assert.match(k, /^https?:\/\/[a-zA-Z0-9./]+$/, k);
      for (const lo of v as any[]) {
        assert.equal(typeof lo.href, "string");
        assert.equal(typeof lo.title, "string");
        for (const key of Object.keys(lo)) {
          assert.ok(
            [
              "href",
              "title",
              "hreflang",
              "type",
              "context",
              "fwqs",
              "public",
            ].includes(key),
            key
          );
        }
      }
    }
  }
};

for (const [name, url, init] of [
  ["ltLinksetNoRedirect: linkType=linkset", `${DL}?linkType=linkset`, {}],
  ["ltAllNoRedirect: linkType=all", `${DL}?linkType=all`, {}],
  [
    "ltAcceptHeader: Accept application/linkset+json",
    DL,
    { headers: { accept: "application/linkset+json" } },
  ],
] as const) {
  test(`${name} returns the linkset without redirecting`, async () => {
    const statements: string[] = [];
    const res = await get(url, init as RequestInit, statements);
    assert.equal(res.status, 200);
    assert.ok(
      res.headers.get("content-type")?.startsWith("application/linkset+json")
    );
    const link = res.headers.get("link") ?? "";
    assert.ok(link.includes('rel="http://www.w3.org/ns/json-ld#context"'));
    assert.ok(link.includes('type="application/ld+json"'));
    const ls = await res.json();
    linksetSchemaOk(ls);
    assert.deepEqual(writes(statements), []);
  });
}

test("linkset covers each level up to the primary key, one titled default link", async () => {
  const ls = await (await get(`${DL}?linkType=linkset`)).json();
  const anchors = ls.linkset.map((e: any) => e.anchor);
  assert.deepEqual(anchors, [DL, `${ORIGIN}/01/${GTIN}`]);
  const item = ls.linkset[0];
  const def = item["https://ref.gs1.org/voc/defaultLink"];
  assert.equal(def.length, 1);
  assert.deepEqual(Object.keys(def[0]).sort(), ["href", "title"]);
  assert.equal(
    item["https://ref.gs1.org/voc/certificationInfo"][0].href,
    "https://example.com/passport/AC-TEST-001"
  );
});

test("loFor: a requested linkType that exists redirects to it", async () => {
  for (const lt of [
    "gs1:certificationInfo",
    "https://gs1.org/voc/certificationInfo",
  ]) {
    const res = await get(`${DL}?linkType=${encodeURIComponent(lt)}`);
    assert.equal(res.status, 307, lt);
    const loc = res.headers.get("location") ?? "";
    assert.ok(
      loc.startsWith("https://example.com/passport/AC-TEST-001?linkType="),
      loc
    );
  }
});

test("specificLinkTypeNotFound: an unavailable linkType is a 404", async () => {
  const res = await get(`${DL}?linkType=gs1:nosuchlt`);
  assert.equal(res.status, 404);
});

test("compressed URIs decompress, with the uncompressed URI as owl:sameAs", async () => {
  const tk = new GS1DigitalLinkToolkit();
  const compressed = tk.compressGS1DigitalLink(
    DL,
    false,
    ORIGIN,
    false,
    true,
    false
  );
  assert.notEqual(compressed, DL);
  const res = await get(compressed);
  assert.equal(res.status, 307);
  assert.equal(
    res.headers.get("location"),
    `${ORIGIN}/verify/01/${GTIN}/21/${SERIAL}`
  );
  assert.ok(
    (res.headers.get("link") ?? "").includes(`<${DL}>; rel="owl:sameAs"`)
  );
});

test("the default link target records the scan on GET only", async () => {
  const onGet: string[] = [];
  const res = await get(
    `${ORIGIN}/verify/01/${GTIN}/21/${SERIAL}`,
    {
      headers: { accept: "application/json" },
    },
    onGet
  );
  assert.equal(res.status, 200);
  assert.ok(writes(onGet).some(q => /INSERT INTO scans/i.test(q)));

  const onHead: string[] = [];
  await get(
    `${ORIGIN}/verify/01/${GTIN}/21/${SERIAL}`,
    { method: "HEAD" },
    onHead
  );
  assert.deepEqual(writes(onHead), []);
});

test("the GTIN page says what is registered and verifies nothing", async () => {
  const statements: string[] = [];
  const res = await get(
    `${ORIGIN}/verify/01/${GTIN}`,
    {
      headers: { accept: "application/json" },
    },
    statements
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "product_registered");
  assert.equal(body.registeredItems, 1);
  assert.match(body.doesNotProve, /does not verify any single item/);
  assert.deepEqual(writes(statements), []);
});

test("the description file lists only link types the resolver serves", async () => {
  const body = await (await get(`${ORIGIN}/.well-known/gs1resolver`)).json();
  assert.equal(body.resolverRoot, ORIGIN);
  assert.deepEqual(Object.keys(body.activeLinkTypes.en).sort(), [
    "gs1:certificationInfo",
    "gs1:defaultLink",
  ]);
  assert.ok(!("gs1ConformantResolver" in body), "no self-declared conformance");
});
