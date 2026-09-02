// One-off compiler for contracts/AuthiChainNFT.sol using solc + node_modules import resolution.
// Writes artifacts/contracts/AuthiChainNFT.sol/AuthiChainNFT.json in Hardhat-artifact shape
// so scripts/deploy-authichain-nft-base.ts can consume it directly.
const fs = require("node:fs");
const path = require("node:path");
const solc = require("solc");

const contractPath = path.join(__dirname, "..", "contracts", "AuthiChainNFT.sol");
const source = fs.readFileSync(contractPath, "utf8");

function findImports(importPath) {
  const resolved = path.join(__dirname, "..", "node_modules", importPath);
  if (fs.existsSync(resolved)) {
    return { contents: fs.readFileSync(resolved, "utf8") };
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
  for (const e of output.errors) console.error(e.formattedMessage);
  process.exit(1);
}
for (const e of output.errors || []) console.warn(e.formattedMessage);

const contract = output.contracts["AuthiChainNFT.sol"]["AuthiChainNFT"];
const outDir = path.join(__dirname, "..", "artifacts", "contracts", "AuthiChainNFT.sol");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "AuthiChainNFT.json"),
  JSON.stringify(
    {
      contractName: "AuthiChainNFT",
      abi: contract.abi,
      bytecode: "0x" + contract.evm.bytecode.object,
    },
    null,
    2
  )
);
console.log("[compile] wrote artifacts/contracts/AuthiChainNFT.sol/AuthiChainNFT.json");
