// Compiler for contracts/AuthiChainNFT.sol using solc + node_modules import resolution.
// Writes artifacts/contracts/AuthiChainNFT.sol/AuthiChainNFT.json in Hardhat-artifact shape
// so scripts/deploy-authichain-nft-base.ts / deploy-govchain-nft-base.yml can consume it.
//
// Hardhat sources stay scoped to contracts/ledger — do not expect `npx hardhat compile`
// to emit AuthiChainNFT. This file is the production compile path.
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");
const contractPath = path.join(repoRoot, "contracts", "AuthiChainNFT.sol");
const outDir = path.join(repoRoot, "artifacts", "contracts", "AuthiChainNFT.sol");
const outFile = path.join(outDir, "AuthiChainNFT.json");

function fail(message) {
  console.error(`[compile] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(contractPath)) {
  fail(`source missing: ${contractPath}`);
}

let solc;
try {
  solc = require("solc");
} catch {
  fail("solc is not installed. From the repo root: pnpm install");
}

const source = fs.readFileSync(contractPath, "utf8");

function findImports(importPath) {
  const candidates = [
    path.join(repoRoot, "node_modules", importPath),
    path.join(process.cwd(), "node_modules", importPath),
    path.join(repoRoot, "contracts", importPath),
    path.resolve(path.dirname(contractPath), importPath),
  ];
  for (const resolved of candidates) {
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return { contents: fs.readFileSync(resolved, "utf8") };
    }
  }
  return { error: `File not found: ${importPath}` };
}

const input = {
  language: "Solidity",
  sources: { "AuthiChainNFT.sol": { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "cancun",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

const errors = (output.errors || []).filter((e) => e.severity === "error");
if (errors.length) {
  for (const e of output.errors) console.error(e.formattedMessage || e.message);
  fail("solc reported errors");
}
for (const e of output.errors || []) {
  console.warn(e.formattedMessage || e.message);
}

const compiled = output.contracts && output.contracts["AuthiChainNFT.sol"] && output.contracts["AuthiChainNFT.sol"].AuthiChainNFT;
if (!compiled) {
  fail("solc did not emit AuthiChainNFT. Check contracts/AuthiChainNFT.sol and @openzeppelin/contracts");
}

const bytecodeObject = compiled.evm && compiled.evm.bytecode && compiled.evm.bytecode.object;
if (!bytecodeObject || bytecodeObject === "0x") {
  fail("compiled AuthiChainNFT bytecode is empty");
}

const bytecode = bytecodeObject.startsWith("0x") ? bytecodeObject : `0x${bytecodeObject}`;
const abi = compiled.abi;
if (!Array.isArray(abi) || abi.length < 10) {
  fail("compiled AuthiChainNFT ABI is missing or too small");
}

const required = [
  "mintProduct",
  "verifyManufacturer",
  "isManufacturerVerified",
  "MINTER_ROLE",
  "DEFAULT_ADMIN_ROLE",
  "hasRole",
];
const names = new Set(abi.map((item) => item.name).filter(Boolean));
const missing = required.filter((name) => !names.has(name));
if (missing.length) {
  fail(`compiled ABI missing: ${missing.join(", ")}`);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  outFile,
  JSON.stringify(
    {
      contractName: "AuthiChainNFT",
      abi,
      bytecode,
    },
    null,
    2
  )
);

const bytes = Math.floor((bytecode.length - 2) / 2);
if (bytes < 1000) {
  fail(`bytecode too small (${bytes} bytes)`);
}

console.log(`[compile] wrote ${path.relative(repoRoot, outFile)}`);
console.log(`[compile] bytecode_bytes=${bytes} abi_entries=${abi.length}`);
