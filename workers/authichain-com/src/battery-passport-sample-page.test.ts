import { describe, expect, it } from "vitest";
import {
  LIVE_JWKS_URL,
  SAMPLE_JSON_PATH,
  SAMPLE_JWS,
  SAMPLE_JWS_PATH,
  SAMPLE_JWKS,
  SAMPLE_JWKS_PATH,
  SAMPLE_LABEL,
  SAMPLE_PATH,
  SAMPLE_RECORD,
  SAMPLE_RECORD_PATH,
  buildSampleBundle,
  evaluateSampleVerification,
  isBatteryPassportSampleArtifactPath,
  isBatteryPassportSamplePath,
  renderBatteryPassportSamplePage,
  tryHandleBatteryPassportSample,
} from "./battery-passport-sample-page.ts";
import { renderBatteryPassportPage } from "./battery-passport-page.ts";
import { PROTOCOL_JWKS_KEYS } from "./protocol-jwks-route.ts";
import { ICP_SEO_SITEMAP_PATHS } from "./icp-seo-sitemap.ts";
import { planById } from "../../../src/lib/plans";
import {
  verifyAttestationJws,
  verifyRecord,
} from "../../../protocol/verifier.mjs";

const now = new Date("2026-11-06T12:00:00Z");

function req(path: string, method = "GET") {
  return new Request(`https://authichain.com${path}`, { method });
}

describe("battery passport demonstration sample", () => {
  it("matches HTML and artifact paths only", () => {
    expect(isBatteryPassportSamplePath(SAMPLE_PATH)).toBe(true);
    expect(isBatteryPassportSamplePath(`${SAMPLE_PATH}/`)).toBe(true);
    expect(isBatteryPassportSamplePath("/battery-passport")).toBe(false);
    expect(isBatteryPassportSamplePath("/battery-passport/sample-audit")).toBe(
      false
    );
    expect(isBatteryPassportSampleArtifactPath(SAMPLE_JSON_PATH)).toBe(true);
    expect(isBatteryPassportSampleArtifactPath(SAMPLE_RECORD_PATH)).toBe(true);
    expect(isBatteryPassportSampleArtifactPath(SAMPLE_JWKS_PATH)).toBe(true);
    expect(isBatteryPassportSampleArtifactPath(SAMPLE_JWS_PATH)).toBe(true);
  });

  it("is an Ed25519-signed fictional LMT record, not a live issuer signature", async () => {
    const recordResult = verifyRecord(SAMPLE_RECORD, null, { now });
    expect(recordResult.verdict).toBe("valid-unanchored");
    expect(recordResult.checks.signature).toBe(true);

    const pinnedDemo = verifyRecord(SAMPLE_RECORD, null, {
      now,
      jwks: SAMPLE_JWKS,
    });
    expect(pinnedDemo.verdict).toBe("valid-unanchored");
    expect(pinnedDemo.checks.issuerInJwks).toBe(true);

    const pinnedLive = verifyRecord(SAMPLE_RECORD, null, {
      now,
      jwks: { keys: PROTOCOL_JWKS_KEYS },
    });
    expect(pinnedLive.verdict).toBe("invalid");
    expect(pinnedLive.reasons).toContain("issuer_not_in_jwks");
    expect(pinnedLive.checks.signature).toBe(true);

    const jwsResult = verifyAttestationJws(SAMPLE_JWS, SAMPLE_JWKS, { now });
    expect(jwsResult.verdict).toBe("valid-offline");
    expect(jwsResult.checks.signature).toBe(true);

    const liveJws = verifyAttestationJws(
      SAMPLE_JWS,
      { keys: PROTOCOL_JWKS_KEYS },
      {
        now,
      }
    );
    expect(liveJws.verdict).toBe("invalid");
    expect(liveJws.reasons).toContain("kid_not_in_jwks");
  });

  it("page verification status matches the open-source verifier", async () => {
    const v = await evaluateSampleVerification(now);
    expect(v.recordSignature).toBe(true);
    expect(v.recordVerdict).toBe("valid-unanchored");
    expect(v.recordIssuerInDemoJwks).toBe(true);
    expect(v.recordIssuerInLiveJwks).toBe(false);
    expect(v.jwsSignature).toBe(true);
    expect(v.jwsVerdict).toBe("valid-offline");
    expect(v.recordReasons).toEqual([]);
    expect(v.jwsReasons).toEqual([]);
  });

  it("tampering the record invalidates the signature and the page will not claim it is signed", async () => {
    const tampered = structuredClone(SAMPLE_RECORD);
    tampered.credentialSubject.model = "TAMPERED";
    const result = verifyRecord(tampered, null, { now });
    expect(result.verdict).toBe("invalid");
    expect(result.reasons).toContain("signature_invalid");
    const v = await evaluateSampleVerification(now, tampered);
    expect(v.recordSignature).toBe(false);
    expect(v.recordVerdict).toBe("invalid");
    const bundle = await buildSampleBundle(now);
    expect(bundle.signatureStatus).toBe("signed");
    expect(bundle.verification.recordSignature).toBe(true);
  });

  it("renders the demonstration banner, estate chrome, and honest JWKS status", async () => {
    const html = await renderBatteryPassportSamplePage(now);
    const plan = planById("dpp_readiness")!;
    expect(html).toContain(SAMPLE_LABEL);
    expect(html).toContain("EXAMPLE-LMT-48V-14Ah");
    expect(html).toContain("Fictional Demonstration Brand");
    expect(html).toContain('id="lead-capture"');
    expect(html).toContain("estate-nav");
    expect(html).toContain("estate-footer");
    expect(html).toContain("issuer_not_in_jwks");
    expect(html).toContain("valid-unanchored");
    expect(html).toContain("valid-offline");
    expect(html).toContain(LIVE_JWKS_URL);
    expect(html).toContain("npx authichain-verify");
    expect(html).toContain("crypto.subtle.verify");
    expect(html).toContain(`$${plan.price}`);
    expect(html).toContain(
      'name="utm_campaign" value="battery-passport-sample"'
    );
    expect(html).not.toContain("50 workspace generations");
    expect(html).not.toContain("AuthiChain, Inc.");
    expect(html).not.toContain("never expire");
    expect(html).not.toMatch(
      /testimonial|trusted by|customers love|guarantee/i
    );
    expect(html).not.toContain("polygon-anchor-1");
    expect(JSON.stringify(SAMPLE_RECORD)).not.toMatch(/BEGIN PRIVATE KEY/);
    expect(
      (SAMPLE_JWKS.keys[0] as { d?: string } | undefined)?.d
    ).toBeUndefined();
  });

  it("serves HTML and downloadable artifacts", async () => {
    const html = await tryHandleBatteryPassportSample(req(SAMPLE_PATH));
    expect(html).not.toBeNull();
    expect(html!.status).toBe(200);
    expect(html!.headers.get("Content-Type")).toContain("text/html");
    expect(await html!.text()).toContain(SAMPLE_LABEL);

    const bundleRes = await tryHandleBatteryPassportSample(
      req(SAMPLE_JSON_PATH)
    );
    expect(bundleRes!.status).toBe(200);
    const bundle = (await bundleRes!.json()) as {
      signatureStatus: string;
      verification: { recordVerdict: string; recordIssuerInLiveJwks: boolean };
      record: { proof: { proofValue: string } };
    };
    expect(bundle.signatureStatus).toBe("signed");
    expect(bundle.verification.recordVerdict).toBe("valid-unanchored");
    expect(bundle.verification.recordIssuerInLiveJwks).toBe(false);
    expect(bundle.record.proof.proofValue.startsWith("z")).toBe(true);

    const recordRes = await tryHandleBatteryPassportSample(
      req(SAMPLE_RECORD_PATH)
    );
    expect(recordRes!.status).toBe(200);
    const record = (await recordRes!.json()) as typeof SAMPLE_RECORD;
    expect(verifyRecord(record, null, { now }).verdict).toBe(
      "valid-unanchored"
    );

    const jwsRes = await tryHandleBatteryPassportSample(req(SAMPLE_JWS_PATH));
    expect(jwsRes!.status).toBe(200);
    expect(jwsRes!.headers.get("Content-Type")).toContain("application/jose");
    expect((await jwsRes!.text()).trim()).toBe(SAMPLE_JWS);

    const head = await tryHandleBatteryPassportSample(
      req(SAMPLE_JSON_PATH, "HEAD")
    );
    expect(head!.status).toBe(200);
    expect(await head!.text()).toBe("");
    const post = await tryHandleBatteryPassportSample(req(SAMPLE_PATH, "POST"));
    expect(post!.status).toBe(405);
    expect(await tryHandleBatteryPassportSample(req("/pricing"))).toBeNull();
  });

  it("is linked from the offer page and listed in the sitemap", () => {
    expect(renderBatteryPassportPage(now)).toContain(`href="${SAMPLE_PATH}"`);
    expect(ICP_SEO_SITEMAP_PATHS).toContain(SAMPLE_PATH);
  });
});
