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
    for (const yml of [bind, landing, workers]) {
      expect(yml).toContain(PAY_TO);
      expect(yml).toContain(`'${FACILITATOR}'`);
      expect(yml).toContain(USDC);
      expect(yml).not.toMatch(
        /PAY_TO[^'\n]*['"]0x5db511706FB6317cd23A7655F67450c5AC6e6AA2['"]/
      );
      expect(yml).not.toMatch(
        /FACILITATOR[^'\n]*['"]https:\/\/x402\.org\/facilitator['"]/
      );
    }
  });

  it("bind-x402-secrets.yml puts the pair on sisters as well as the landing pair", () => {
    const yml = readWorkflow("bind-x402-secrets.yml");
    const step = bindStep(
      yml,
      "Bind X402_PAY_TO + X402_FACILITATOR_URL + X402_USDC_ASSET"
    );
    expect(step).toContain(
      "authichain-com|authichain-edge-router|qron-space|strainchain-io|govchain-us"
    );
    expect(step).toMatch(
      /for name in authichain-com authichain-edge-router qron-space strainchain-io govchain-us/
    );
    for (const sister of SISTERS) {
      expect(step).toContain(sister);
    }
    expect(step).toContain("secret put X402_PAY_TO");
    expect(step).toContain("secret put X402_FACILITATOR_URL");
    expect(step).toContain("secret put X402_USDC_ASSET");
    expect(step).toContain("values not logged");
    expect(step).not.toMatch(/continue-on-error:/);
  });

  it("Deploy Workers re-puts the same pair on sister apexes after wrangler deploy", () => {
    const yml = readWorkflow("deploy-workers.yml");
    const step = bindStep(
      yml,
      "Bind X402_PAY_TO + X402_FACILITATOR_URL + X402_USDC_ASSET"
    );
    expect(step).toContain("matrix.worker == 'qron-space'");
    expect(step).toContain("matrix.worker == 'strainchain-io'");
    expect(step).toContain("matrix.worker == 'govchain-us'");
    expect(step).toContain("secret put X402_PAY_TO");
    expect(step).toContain("secret put X402_FACILITATOR_URL");
    expect(step).toContain("secret put X402_USDC_ASSET");
    expect(step).toContain("values not logged");
    expect(step).not.toMatch(/continue-on-error:/);
    expect(step).not.toMatch(/versions upload/);
  });
});
