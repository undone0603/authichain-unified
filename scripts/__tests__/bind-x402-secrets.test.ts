import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TOKENOMICS_PAY_TO } from "../lib/evm-chains.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const PAY_TO = TOKENOMICS_PAY_TO;
const FACILITATOR = "https://facilitator.payai.network";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const SISTERS = ["qron-space", "strainchain-io", "govchain-us"] as const;

function readWorkflow(name: string): string {
  return readFileSync(join(repoRoot, ".github", "workflows", name), "utf8");
}

function bindStep(yml: string, title: string): string {
  const start = yml.indexOf(`- name: ${title}`);
  expect(start).toBeGreaterThan(-1);
  const rest = yml.slice(start);
  const next = rest.search(/\n      - name: /);
  return next === -1 ? rest : rest.slice(0, next);
}

describe("x402 facilitator bind matches authichain-com", () => {
  it("uses the published payTo / PayAI facilitator / Base USDC pair", () => {
    const bind = readWorkflow("bind-x402-secrets.yml");
    const landing = readWorkflow("deploy-authichain-com.yml");
    const workers = readWorkflow("deploy-workers.yml");
    for (const yml of [bind, landing]) {
      expect(yml).toContain(PAY_TO);
      expect(yml).toContain(`'${FACILITATOR}'`);
      expect(yml).toContain(USDC);
      expect(yml).not.toMatch(
        /PAY_TO[^'\n]*['"]0xaebfa6b08fb25b59748c93273ab8880e20ffe437['"]/i // pragma: allowlist secret
      );
      expect(yml).not.toMatch(
        /FACILITATOR[^'\n]*['"]https:\/\/x402\.org\/facilitator['"]/
      );
    }
    expect(workers).toContain("--keep-vars");
    expect(workers).not.toContain("secret put X402_PAY_TO");
    expect(landing).toContain("--keep-vars");
    expect(landing).not.toContain("secret put X402_PAY_TO");
  });

  it("manual binder only targets one explicitly selected Worker", () => {
    const yml = readWorkflow("bind-x402-secrets.yml");
    const step = bindStep(
      yml,
      "Bind X402_PAY_TO + X402_FACILITATOR_URL + X402_USDC_ASSET"
    );
    expect(yml).toMatch(/workflow_dispatch:/);
    expect(yml).not.toMatch(/^  push:/m);
    expect(yml).toContain("production-cloudflare-x402-secrets");
    expect(yml).toContain("guard-production-secret-binding.mjs");
    expect(yml).toContain("inputs.expected_sha");
    expect(yml).toContain("AUTHICHAIN_X402_SECRET_BIND_CLOUDFLARE_API_TOKEN");
    expect(yml).not.toContain("secrets.CLOUDFLARE_API_TOKEN");
    expect(step).toContain("authichain-com|authichain-edge-router|qron-space|strainchain-io|govchain-us");
    expect(step).toContain('bind_pair "$WORKER"');
    expect(step).not.toMatch(/for name in authichain-com/);
    expect(step).toContain("Unreviewed pay-to destination refused");
    expect(step).toContain("Unreviewed facilitator refused");
    for (const sister of SISTERS) expect(step).toContain(sister);
    for (const name of ["X402_PAY_TO", "X402_FACILITATOR_URL", "X402_USDC_ASSET"]) {
      expect(step).toContain(`secret put ${name}`);
    }
  });

  it("a push deploy can retain but never rebind x402 payment-routing secrets", () => {
    const yml = readWorkflow("deploy-workers.yml");
    expect(yml).toContain("--keep-vars");
    expect(yml).not.toMatch(/secret put X402_PAY_TO/);
    expect(yml).not.toMatch(/secret put X402_FACILITATOR_URL/);
    expect(yml).not.toMatch(/secret put X402_USDC_ASSET/);
  });
});
