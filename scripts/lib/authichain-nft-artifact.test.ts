import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AUTHICHAIN_NFT_ARTIFACT_REL,
  REQUIRED_NFT_ABI_NAMES,
  bytecodeByteLength,
  defaultArtifactPath,
  isEmptyBytecode,
  loadAuthiChainNftArtifact,
} from "./authichain-nft-artifact.ts";

describe("AuthiChainNFT artifact", () => {
  it("loads the committed Hardhat-shaped artifact with mint + grant ABI", () => {
    const artifact = loadAuthiChainNftArtifact();
    expect(defaultArtifactPath()).toContain(AUTHICHAIN_NFT_ARTIFACT_REL);
    expect(artifact.bytecode.startsWith("0x")).toBe(true);
    expect(bytecodeByteLength(artifact.bytecode)).toBeGreaterThan(10_000);
    const names = new Set(artifact.abi.map((item) => item.name));
    for (const required of REQUIRED_NFT_ABI_NAMES) {
      expect(names.has(required)).toBe(true);
    }
  });

  it("treats 0x as empty bytecode", () => {
    expect(isEmptyBytecode("0x")).toBe(true);
    expect(isEmptyBytecode("0x0")).toBe(true);
    expect(isEmptyBytecode("")).toBe(true);
    expect(isEmptyBytecode("0x608060")).toBe(false);
  });

  it("matches the on-disk JSON the deploy workflow compiles into", () => {
    const raw = JSON.parse(readFileSync(defaultArtifactPath(), "utf8"));
    expect(raw.contractName).toBe("AuthiChainNFT");
    expect(Array.isArray(raw.abi)).toBe(true);
  });
});
