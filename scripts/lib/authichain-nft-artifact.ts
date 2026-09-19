/** Canonical AuthiChainNFT Hardhat-shaped artifact used by Base deploy + mint. */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const AUTHICHAIN_NFT_ARTIFACT_REL = join(
  "artifacts",
  "contracts",
  "AuthiChainNFT.sol",
  "AuthiChainNFT.json"
);

export const REQUIRED_NFT_ABI_NAMES = [
  "mintProduct",
  "verifyManufacturer",
  "isManufacturerVerified",
  "MINTER_ROLE",
  "DEFAULT_ADMIN_ROLE",
  "hasRole",
] as const;

export interface AuthiChainNftArtifact {
  contractName?: string;
  abi: Array<{ name?: string; type?: string }>;
  bytecode: string;
}

export function defaultArtifactPath(cwd = process.cwd()): string {
  return (process.env.ARTIFACT_PATH || join(cwd, AUTHICHAIN_NFT_ARTIFACT_REL)).trim();
}

export function bytecodeByteLength(bytecode: string): number {
  const hex = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
  return Math.floor(hex.length / 2);
}

export function loadAuthiChainNftArtifact(file = defaultArtifactPath()): AuthiChainNftArtifact {
  if (!existsSync(file)) {
    throw new Error(
      `AuthiChainNFT artifact missing at ${file}. Compile with: node scripts/compile-authichain-nft.cjs`
    );
  }
  const artifact = JSON.parse(readFileSync(file, "utf8")) as AuthiChainNftArtifact;
  if (!artifact.bytecode || artifact.bytecode === "0x") {
    throw new Error(`AuthiChainNFT artifact at ${file} has empty bytecode`);
  }
  if (bytecodeByteLength(artifact.bytecode) < 1000) {
    throw new Error(`AuthiChainNFT artifact at ${file} bytecode is too small to be a real deploy`);
  }
  if (!Array.isArray(artifact.abi) || artifact.abi.length < 10) {
    throw new Error(`AuthiChainNFT artifact at ${file} has an invalid ABI`);
  }
  const names = new Set(artifact.abi.map((item) => item.name).filter(Boolean));
  const missing = REQUIRED_NFT_ABI_NAMES.filter((name) => !names.has(name));
  if (missing.length) {
    throw new Error(`AuthiChainNFT artifact at ${file} missing ABI: ${missing.join(", ")}`);
  }
  return artifact;
}

export function isEmptyBytecode(code: string | null | undefined): boolean {
  if (!code) return true;
  const normalized = code.trim().toLowerCase();
  return normalized === "0x" || normalized === "0x0" || normalized === "";
}
