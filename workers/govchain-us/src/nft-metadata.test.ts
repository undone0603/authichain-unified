/**
 * ERC-721 metadata for the five founder-held ACPT seals on Base.
 *
 * The fault being guarded: tokenURI on 0x34370EDA… points at
 * /api/nft-metadata/<hash> and live govchain.us 404'd that path as HTML.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index.ts";
import {
  ACPT_CHAIN,
  ACPT_CONTRACT,
  ACPT_SEALS,
  lookupAcptSeal,
  nftMetadataImageUrl,
  nftMetadataUrl,
  renderAcptMetadata,
  tryHandleNftMetadata,
} from "./nft-metadata.ts";

const ENV = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon-test-key",
  APP_ORIGIN: "https://app.example.com",
};

async function get(path: string, method = "GET") {
  return worker.fetch(
    new Request(`https://govchain.us${path}`, { method }),
    ENV as typeof ENV
  );
}

const KNOWN = ACPT_SEALS.map(seal => seal.slug);

test("unknown slug is 404 JSON, not marketing HTML", async () => {
  for (const path of [
    "/api/nft-metadata/ffffffffffffffffffffffffffffffff",
    "/api/nft-metadata/not-a-hash",
    "/api/nft-metadata/",
    "/api/nft-metadata",
    // Standup-note typos — on-chain tokenURI uses e5e916… and dc3889…84
    "/api/nft-metadata/e5e9316fa87a24cedab57f5cfe98fed39",
    "/api/nft-metadata/dc3839c65807442691049747fd06bc884",
  ]) {
    const res = await get(path);
    assert.equal(res.status, 404, path);
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "not_found", path);
    const text = JSON.stringify(body);
    assert.doesNotMatch(text, /Federal Contract Intelligence/);
  }
});

test("HEAD unknown slug is 404 JSON content-type", async () => {
  const res = await get(
    "/api/nft-metadata/ffffffffffffffffffffffffffffffff",
    "HEAD"
  );
  assert.equal(res.status, 404);
  assert.match(res.headers.get("content-type") ?? "", /application\/json/);
  assert.equal(await res.text(), "");
});

test("each of the five on-chain hashes is 200 ERC-721 metadata", async () => {
  assert.equal(ACPT_SEALS.length, 5);
  for (const seal of ACPT_SEALS) {
    const path = `/api/nft-metadata/${seal.slug}`;
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.match(
      res.headers.get("content-type") ?? "",
      /application\/json/,
      path
    );
    const body = (await res.json()) as ReturnType<typeof renderAcptMetadata>;
    assert.equal(
      body.name,
      `AuthiChain Product #${seal.tokenId} — ${seal.shortAgency}`,
      path
    );
    assert.match(body.description, /GovChain DoD\/DLA pilot seal/);
    assert.match(body.description, /gov-engine/);
    assert.match(body.description, /not a public drop/);
    assert.equal(body.image, nftMetadataImageUrl(seal.slug), path);
    assert.match(body.image, /^https:\/\/govchain\.us\//);
    assert.equal(body.external_url, "https://govchain.us");

    const attrs = Object.fromEntries(
      body.attributes.map(a => [a.trait_type, a.value])
    );
    assert.equal(attrs.agency, seal.agency, path);
    assert.equal(attrs.fit_score, seal.fitScore, path);
    assert.equal(attrs.source, "gov-engine");
    assert.equal(attrs.brand, "GovChain");
    assert.equal(attrs.token_id, seal.tokenId);
    assert.equal(attrs.contract, ACPT_CONTRACT);
    assert.equal(attrs.chain, ACPT_CHAIN);
    assert.equal(attrs.tx, seal.tx);
    assert.equal(attrs.product_hash, seal.slug);
    assert.match(String(attrs.tx), /^0x[0-9a-f]{64}$/);
  }
});

test("token 5 agency is the calldata DLA Aviation string, not invented", async () => {
  const seal = lookupAcptSeal("dc3889c65807442691049747fd06bc84");
  assert.ok(seal);
  assert.equal(seal.tokenId, 5);
  assert.match(seal.agency, /DLA AVIATION AT PHILADELPHIA, PA/);
  assert.match(seal.agency, /DEFENSE LOGISTICS AGENCY/);
  assert.doesNotMatch(seal.agency, /GovChain pilot/);
  assert.doesNotMatch(seal.shortAgency, /GovChain pilot/);

  const res = await get("/api/nft-metadata/dc3889c65807442691049747fd06bc84");
  const body = (await res.json()) as {
    attributes: Array<{ trait_type: string; value: unknown }>;
    name: string;
  };
  const agency = body.attributes.find(a => a.trait_type === "agency")?.value;
  assert.equal(agency, seal.agency);
  assert.match(body.name, /DLA Aviation at Philadelphia/);
});

test("HEAD known slug is 200 JSON with empty body", async () => {
  const slug = KNOWN[0];
  const res = await get(`/api/nft-metadata/${slug}`, "HEAD");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /application\/json/);
  assert.equal(await res.text(), "");
});

test("same-origin seal image is SVG for known slugs and 404 for unknown", async () => {
  const slug = KNOWN[0];
  const res = await get(`/api/nft-metadata/${slug}/image`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /image\/svg\+xml/);
  const svg = await res.text();
  assert.match(svg, /<svg /);
  assert.match(svg, /ACPT #1/);

  const miss = await get(
    "/api/nft-metadata/ffffffffffffffffffffffffffffffff/image"
  );
  assert.equal(miss.status, 404);
  assert.match(miss.headers.get("content-type") ?? "", /application\/json/);
});

test("POST on the metadata path is 405, not the HTML 404", async () => {
  const res = await get(`/api/nft-metadata/${KNOWN[0]}`, "POST");
  assert.equal(res.status, 405);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, "method_not_allowed");
});

test("tryHandleNftMetadata ignores unrelated paths", () => {
  assert.equal(
    tryHandleNftMetadata(new Request("https://govchain.us/opportunities")),
    null
  );
  assert.equal(
    tryHandleNftMetadata(new Request("https://govchain.us/api/govchain/stats")),
    null
  );
});

test("tokenURI helpers match the on-chain form", () => {
  for (const seal of ACPT_SEALS) {
    assert.equal(
      nftMetadataUrl(seal.slug),
      `https://govchain.us/api/nft-metadata/${seal.slug}`
    );
  }
});
