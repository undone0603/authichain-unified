/**
 * test/AuthiChainNFT.test.ts
 *
 * Adversarial tests for contracts/AuthiChainNFT.sol (production ERC-721 on
 * Polygon, 0x4da4D2675e52374639C9c954f4f653887A9972BE).
 *
 * hardhat.config.ts scopes `paths.sources` to ./contracts/ledger, and Hardhat 3
 * can only take source directories (no per-file selection), so the contract is
 * compiled here with solc directly - the same approach as
 * scripts/compile-authichain-nft.cjs (solc + node_modules import resolution,
 * evmVersion cancun, optimizer 200 runs). The .sol file is not modified.
 *
 * Tests tagged FINDING document real behaviour that is arguably a defect; they
 * assert what the contract ACTUALLY does today so a fix will make them fail
 * loudly and force a deliberate update.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, it } from "node:test";
import hre from "hardhat";

const { ethers } = await hre.network.getOrCreate();
const require = createRequire(import.meta.url);

function compile(file: string, name: string) {
  const solc = require("solc");
  const root = process.cwd();
  const findImports = (p: string) => {
    const resolved = path.join(root, "node_modules", p);
    return fs.existsSync(resolved)
      ? { contents: fs.readFileSync(resolved, "utf8") }
      : { error: `File not found: ${p}` };
  };
  const input = {
    language: "Solidity",
    sources: { [path.basename(file)]: { content: fs.readFileSync(path.join(root, file), "utf8") } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  const errs = (out.errors ?? []).filter((e: any) => e.severity === "error");
  if (errs.length) throw new Error(errs.map((e: any) => e.formattedMessage).join("\n"));
  const c = out.contracts[path.basename(file)][name];
  return { abi: c.abi, bytecode: "0x" + c.evm.bytecode.object };
}

const nft = compile("contracts/AuthiChainNFT.sol", "AuthiChainNFT");

const MINTER_ROLE = ethers.id("MINTER_ROLE");
const UPDATER_ROLE = ethers.id("UPDATER_ROLE");
const PAUSER_ROLE = ethers.id("PAUSER_ROLE");
const ADMIN_ROLE = ethers.ZeroHash;
const URI = "ipfs://bafy-product-1";

async function deploy() {
  const [admin, alice, bob, mallory, brand] = await ethers.getSigners();
  const factory = new ethers.ContractFactory(nft.abi, nft.bytecode, admin);
  const c: any = await factory.deploy();
  await c.waitForDeployment();
  return { c, admin, alice, bob, mallory, brand };
}

async function mint(c: any, to: string, id = "SKU-1", uri = URI, serial = "SN-1") {
  const tx = await c.mintProduct(to, id, "Acme", "Model-X", serial, "{}", uri);
  return tx.wait();
}

const errIface = new ethers.Interface([
  "error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)",
  "error ProductAlreadyExists(string productIdentifier)",
  "error ProductDoesNotExist(uint256 tokenId)",
  "error EmptyProductIdentifier()",
  "error UnauthorizedManufacturer(address manufacturer)",
  "error ProductNotActive(uint256 tokenId)",
  "error InvalidTokenURI()",
  "error EnforcedPause()",
  "error ExpectedPause()",
  "error ERC721InvalidReceiver(address receiver)",
  "error ERC721NonexistentToken(uint256 tokenId)",
  "error ERC721InsufficientApproval(address operator, uint256 tokenId)",
]);

/** Assert a promise reverts; optionally with a specific custom error (matched by selector). */
async function reverts(p: Promise<any>, name?: string) {
  try {
    await p;
  } catch (e: any) {
    if (name) {
      const text = `${e?.data ?? ""} ${e?.message ?? ""}`;
      const selector = errIface.getError(name)!.selector;
      assert.ok(text.includes(selector), `expected revert "${name}" (${selector}), got: ${text.slice(0, 300)}`);
    }
    return;
  }
  assert.fail(`expected revert${name ? ` "${name}"` : ""} but call succeeded`);
}

function events(c: any, rc: any, name: string) {
  return rc.logs
    .map((l: any) => {
      try {
        return c.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .filter((e: any) => e?.name === name);
}

describe("AuthiChainNFT: deployment and roles", () => {
  it("grants all roles to the deployer, verifies it as manufacturer, and exposes ERC-721 metadata", async () => {
    const { c, admin } = await deploy();
    for (const r of [ADMIN_ROLE, MINTER_ROLE, UPDATER_ROLE, PAUSER_ROLE]) {
      assert.equal(await c.hasRole(r, admin.address), true);
    }
    assert.equal(await c.isManufacturerVerified(admin.address), true);
    assert.equal(await c.name(), "AuthiChainProduct");
    assert.equal(await c.symbol(), "ACPT");
    assert.equal(await c.totalSupply(), 0n);
    assert.equal(await c.paused(), false);
  });

  it("supports ERC721, ERC721Metadata, ERC721Enumerable and AccessControl interfaces", async () => {
    const { c } = await deploy();
    for (const id of ["0x80ac58cd", "0x5b5e139f", "0x780e9d63", "0x7965db0b"]) {
      assert.equal(await c.supportsInterface(id), true, id);
    }
    assert.equal(await c.supportsInterface("0xffffffff"), false);
  });

  it("a non-admin cannot grant the admin role or any other role", async () => {
    const { c, mallory } = await deploy();
    await reverts(c.connect(mallory).grantRole(ADMIN_ROLE, mallory.address), "AccessControlUnauthorizedAccount");
    await reverts(c.connect(mallory).grantRole(MINTER_ROLE, mallory.address), "AccessControlUnauthorizedAccount");
    assert.equal(await c.hasRole(ADMIN_ROLE, mallory.address), false);

    // Even MINTER/UPDATER/PAUSER holders are not admins.
    const { c: c2, admin, bob } = await deploy();
    for (const r of [MINTER_ROLE, UPDATER_ROLE, PAUSER_ROLE]) await (await c2.grantRole(r, bob.address)).wait();
    await reverts(c2.connect(bob).grantRole(ADMIN_ROLE, bob.address), "AccessControlUnauthorizedAccount");
    await reverts(c2.connect(bob).revokeRole(MINTER_ROLE, admin.address), "AccessControlUnauthorizedAccount");
    assert.equal(await c2.hasRole(ADMIN_ROLE, bob.address), false);
  });

  it("admin can grant the admin role and the new admin can then grant roles", async () => {
    const { c, alice, bob } = await deploy();
    await (await c.grantRole(ADMIN_ROLE, alice.address)).wait();
    await (await c.connect(alice).grantRole(MINTER_ROLE, bob.address)).wait();
    assert.equal(await c.hasRole(MINTER_ROLE, bob.address), true);
  });
});

describe("AuthiChainNFT: minting", () => {
  it("mints with expected events, state, tokenURI, history and enumeration", async () => {
    const { c, admin, alice } = await deploy();
    const rc = await mint(c, alice.address);

    const minted = events(c, rc, "ProductMinted");
    assert.equal(minted.length, 1);
    assert.equal(minted[0].args.tokenId, 1n);
    assert.equal(minted[0].args.productIdentifier, "SKU-1");
    assert.equal(minted[0].args.manufacturer, admin.address);
    const transfer = events(c, rc, "Transfer");
    assert.equal(transfer.length, 1);
    assert.equal(transfer[0].args.from, ethers.ZeroAddress);
    assert.equal(transfer[0].args.to, alice.address);

    assert.equal(await c.ownerOf(1n), alice.address);
    assert.equal(await c.balanceOf(alice.address), 1n);
    assert.equal(await c.totalSupply(), 1n);
    assert.equal(await c.tokenByIndex(0), 1n);
    assert.equal(await c.tokenOfOwnerByIndex(alice.address, 0), 1n);
    assert.equal(await c.tokenURI(1n), URI);
    assert.equal(await c.getTokenIdByProductIdentifier("SKU-1"), 1n);

    const info = await c.getProductInfo(1n);
    assert.equal(info.productIdentifier, "SKU-1");
    assert.equal(info.manufacturer, "Acme");
    assert.equal(info.isActive, true);
    assert.ok(info.manufactureDate > 0n);

    const hist = await c.getSupplyChainHistory(1n);
    assert.equal(hist.length, 1);
    assert.equal(hist[0].eventType, "manufactured");
    assert.equal(hist[0].actor, admin.address);
  });

  it("ids are sequential starting at 1 and unknown identifiers map to 0", async () => {
    const { c, alice } = await deploy();
    assert.equal(await c.getTokenIdByProductIdentifier("nope"), 0n);
    await mint(c, alice.address, "A", URI, "1");
    await mint(c, alice.address, "B", URI, "2");
    assert.equal(await c.getTokenIdByProductIdentifier("B"), 2n);
    assert.equal(await c.totalSupply(), 2n);
  });

  it("reverts for callers without MINTER_ROLE", async () => {
    const { c, mallory, alice } = await deploy();
    await reverts(
      c.connect(mallory).mintProduct(alice.address, "X", "m", "mo", "s", "", URI),
      "AccessControlUnauthorizedAccount"
    );
    assert.equal(await c.totalSupply(), 0n);
  });

  it("reverts on duplicate productIdentifier (ProductAlreadyExists) and leaves state intact", async () => {
    const { c, alice, bob } = await deploy();
    await mint(c, alice.address, "DUP");
    await reverts(mint(c, bob.address, "DUP", URI, "other-serial"), "ProductAlreadyExists");
    assert.equal(await c.totalSupply(), 1n);
    assert.equal(await c.ownerOf(1n), alice.address);
  });

  it("reverts on empty identifier and empty URI", async () => {
    const { c, alice } = await deploy();
    await reverts(mint(c, alice.address, ""), "EmptyProductIdentifier");
    await reverts(mint(c, alice.address, "OK", ""), "InvalidTokenURI");
    assert.equal(await c.totalSupply(), 0n);
  });

  it("reverts when minting to the zero address and to a contract that is not an ERC721 receiver", async () => {
    const { c } = await deploy();
    await reverts(mint(c, ethers.ZeroAddress, "Z"), "ERC721InvalidReceiver");
    // The NFT contract itself does not implement onERC721Received.
    await reverts(mint(c, await c.getAddress(), "C"), "ERC721InvalidReceiver");
  });

  it("FINDING: MINTER_ROLE alone is not enough - a role granted via grantRole cannot mint until verifyManufacturer", async () => {
    const { c, brand, alice } = await deploy();
    await (await c.grantRole(MINTER_ROLE, brand.address)).wait();
    assert.equal(await c.hasRole(MINTER_ROLE, brand.address), true);
    // Passes the role check but fails the second, undocumented gate.
    await reverts(
      c.connect(brand).mintProduct(alice.address, "B1", "m", "mo", "s", "", URI),
      "UnauthorizedManufacturer"
    );
    await (await c.verifyManufacturer(brand.address)).wait();
    await (await c.connect(brand).mintProduct(alice.address, "B1", "m", "mo", "s", "", URI)).wait();
    assert.equal(await c.totalSupply(), 1n);
  });

  it("verifyManufacturer / revokeManufacturer are admin-only, emit events and toggle minting", async () => {
    const { c, admin, mallory, brand, alice } = await deploy();
    await reverts(c.connect(mallory).verifyManufacturer(mallory.address), "AccessControlUnauthorizedAccount");
    await reverts(c.connect(mallory).revokeManufacturer(admin.address), "AccessControlUnauthorizedAccount");

    const rc = await (await c.verifyManufacturer(brand.address)).wait();
    assert.equal(events(c, rc, "ManufacturerVerified")[0].args.manufacturer, brand.address);
    assert.equal(await c.isManufacturerVerified(brand.address), true);
    assert.equal(await c.hasRole(MINTER_ROLE, brand.address), true);
    await (await c.connect(brand).mintProduct(alice.address, "B1", "m", "mo", "s", "", URI)).wait();

    const rc2 = await (await c.revokeManufacturer(brand.address)).wait();
    assert.equal(events(c, rc2, "ManufacturerRevoked")[0].args.manufacturer, brand.address);
    assert.equal(await c.isManufacturerVerified(brand.address), false);
    await reverts(
      c.connect(brand).mintProduct(alice.address, "B2", "m", "mo", "s", "", URI),
      "AccessControlUnauthorizedAccount"
    );
  });

  it("FINDING: serial numbers are not unique and identifiers are case/whitespace sensitive", async () => {
    const { c, alice } = await deploy();
    await mint(c, alice.address, "SKU-9", URI, "SAME-SERIAL");
    // Same serial, different identifier: accepted.
    await mint(c, alice.address, "SKU-10", URI, "SAME-SERIAL");
    // Visually identical identifiers that differ by case / trailing space: accepted.
    await mint(c, alice.address, "sku-9", URI, "x");
    await mint(c, alice.address, "SKU-9 ", URI, "y");
    assert.equal(await c.totalSupply(), 4n);
  });

  it("FINDING: two tokens may share the same tokenURI (no URI uniqueness)", async () => {
    const { c, alice } = await deploy();
    await mint(c, alice.address, "U1", URI, "1");
    await mint(c, alice.address, "U2", URI, "2");
    assert.equal(await c.tokenURI(1n), await c.tokenURI(2n));
  });

  it("tokenURI / getters revert for nonexistent tokens", async () => {
    const { c } = await deploy();
    await reverts(c.tokenURI(1n), "ERC721NonexistentToken");
    await reverts(c.getProductInfo(1n), "ProductDoesNotExist");
    await reverts(c.getSupplyChainHistory(1n), "ProductDoesNotExist");
    await reverts(c.isProductActive(1n), "ProductDoesNotExist");
  });
});

describe("AuthiChainNFT: updates and deactivation", () => {
  it("UPDATER can add supply-chain events (event + history); others cannot", async () => {
    const { c, alice, mallory, bob } = await deploy();
    await mint(c, alice.address);
    await reverts(c.connect(mallory).addSupplyChainEvent(1n, "shipped", "NYC", "n"), "AccessControlUnauthorizedAccount");

    await (await c.grantRole(UPDATER_ROLE, bob.address)).wait();
    const rc = await (await c.connect(bob).addSupplyChainEvent(1n, "shipped", "NYC", "left dock")).wait();
    const e = events(c, rc, "SupplyChainEventAdded")[0];
    assert.equal(e.args.tokenId, 1n);
    assert.equal(e.args.eventType, "shipped");
    assert.equal(e.args.actor, bob.address);

    const hist = await c.getSupplyChainHistory(1n);
    assert.equal(hist.length, 2);
    assert.equal(hist[1].location, "NYC");
    assert.equal(hist[1].actor, bob.address);
  });

  it("addSupplyChainEvent reverts for nonexistent token", async () => {
    const { c } = await deploy();
    await reverts(c.addSupplyChainEvent(42n, "x", "y", "z"), "ProductDoesNotExist");
  });

  it("updateProductDetails is UPDATER-gated, emits ProductDetailsUpdated and changes state", async () => {
    const { c, alice, mallory } = await deploy();
    await mint(c, alice.address);
    await reverts(c.connect(mallory).updateProductDetails(1n, "evil"), "AccessControlUnauthorizedAccount");
    // The token OWNER has no special rights either.
    await reverts(c.connect(alice).updateProductDetails(1n, "mine"), "AccessControlUnauthorizedAccount");

    const rc = await (await c.updateProductDetails(1n, "new details")).wait();
    assert.equal(events(c, rc, "ProductDetailsUpdated").length, 1);
    assert.equal((await c.getProductInfo(1n)).additionalDetails, "new details");
    await reverts(c.updateProductDetails(99n, "x"), "ProductDoesNotExist");
  });

  it("deactivateProduct is admin-only, emits event, flips isProductActive and blocks new supply-chain events", async () => {
    const { c, alice, mallory } = await deploy();
    await mint(c, alice.address);
    await reverts(c.connect(mallory).deactivateProduct(1n), "AccessControlUnauthorizedAccount");
    await reverts(c.connect(alice).deactivateProduct(1n), "AccessControlUnauthorizedAccount");
    await reverts(c.deactivateProduct(9n), "ProductDoesNotExist");

    const rc = await (await c.deactivateProduct(1n)).wait();
    assert.equal(events(c, rc, "ProductDeactivated")[0].args.tokenId, 1n);
    assert.equal(await c.isProductActive(1n), false);
    await reverts(c.addSupplyChainEvent(1n, "sold", "x", "y"), "ProductNotActive");
  });

  it("FINDING: updateProductDetails still works on a deactivated product, deactivated tokens remain transferable, deactivation is irreversible", async () => {
    const { c, alice, bob } = await deploy();
    await mint(c, alice.address);
    await (await c.deactivateProduct(1n)).wait();
    // No isActive check in updateProductDetails (unlike addSupplyChainEvent).
    await (await c.updateProductDetails(1n, "edited after deactivation")).wait();
    assert.equal((await c.getProductInfo(1n)).additionalDetails, "edited after deactivation");
    // Transfers are not blocked either.
    await (await c.connect(alice).transferFrom(alice.address, bob.address, 1n)).wait();
    assert.equal(await c.ownerOf(1n), bob.address);
    // No reactivate function exists in the ABI.
    assert.equal(nft.abi.some((x: any) => x.name === "reactivateProduct" || x.name === "activateProduct"), false);
    // Deactivated identifiers stay reserved forever.
    await reverts(mint(c, alice.address, "SKU-1", URI, "n"), "ProductAlreadyExists");
  });
});

describe("AuthiChainNFT: pause", () => {
  it("only PAUSER can pause/unpause; pause blocks mint, updates, events and transfers", async () => {
    const { c, alice, bob, mallory } = await deploy();
    await mint(c, alice.address);
    await reverts(c.connect(mallory).pause(), "AccessControlUnauthorizedAccount");

    await (await c.grantRole(PAUSER_ROLE, bob.address)).wait();
    await (await c.connect(bob).pause()).wait();
    assert.equal(await c.paused(), true);

    await reverts(mint(c, alice.address, "P2", URI, "2"), "EnforcedPause");
    await reverts(c.addSupplyChainEvent(1n, "x", "y", "z"), "EnforcedPause");
    await reverts(c.updateProductDetails(1n, "x"), "EnforcedPause");
    await reverts(c.connect(alice).transferFrom(alice.address, bob.address, 1n), "EnforcedPause");
    await reverts(
      c.connect(alice)["safeTransferFrom(address,address,uint256)"](alice.address, bob.address, 1n),
      "EnforcedPause"
    );
    assert.equal(await c.ownerOf(1n), alice.address);

    await reverts(c.connect(mallory).unpause(), "AccessControlUnauthorizedAccount");
    await (await c.connect(bob).unpause()).wait();
    await (await c.connect(alice).transferFrom(alice.address, bob.address, 1n)).wait();
    assert.equal(await c.ownerOf(1n), bob.address);
  });

  it("pause twice / unpause when not paused revert", async () => {
    const { c } = await deploy();
    await reverts(c.unpause(), "ExpectedPause");
    await (await c.pause()).wait();
    await reverts(c.pause(), "EnforcedPause");
  });

  it("FINDING: deactivateProduct and verify/revokeManufacturer still work while paused", async () => {
    const { c, alice, brand } = await deploy();
    await mint(c, alice.address);
    await (await c.pause()).wait();
    await (await c.deactivateProduct(1n)).wait();
    await (await c.verifyManufacturer(brand.address)).wait();
    await (await c.revokeManufacturer(brand.address)).wait();
    assert.equal(await c.isProductActive(1n), false);
  });
});

describe("AuthiChainNFT: transfers", () => {
  it("owner transfer works, appends a 'transferred' history entry, and updates enumeration", async () => {
    const { c, alice, bob } = await deploy();
    await mint(c, alice.address);
    const rc = await (await c.connect(alice).transferFrom(alice.address, bob.address, 1n)).wait();
    assert.equal(events(c, rc, "Transfer")[0].args.to, bob.address);
    assert.equal(await c.balanceOf(alice.address), 0n);
    assert.equal(await c.tokenOfOwnerByIndex(bob.address, 0), 1n);

    const hist = await c.getSupplyChainHistory(1n);
    assert.equal(hist.length, 2);
    assert.equal(hist[1].eventType, "transferred");
    // Note: history records the RECIPIENT as `actor`, not the sender/operator.
    assert.equal(hist[1].actor, bob.address);
  });

  it("non-owner / non-approved cannot transfer; approved operator can", async () => {
    const { c, alice, bob, mallory } = await deploy();
    await mint(c, alice.address);
    await reverts(c.connect(mallory).transferFrom(alice.address, mallory.address, 1n), "ERC721InsufficientApproval");
    await (await c.connect(alice).approve(bob.address, 1n)).wait();
    await (await c.connect(bob).transferFrom(alice.address, bob.address, 1n)).wait();
    assert.equal(await c.ownerOf(1n), bob.address);
  });

  it("the admin has no special power to move a user's token", async () => {
    const { c, admin, alice } = await deploy();
    await mint(c, alice.address);
    await reverts(c.connect(admin).transferFrom(alice.address, admin.address, 1n), "ERC721InsufficientApproval");
  });

  it("transfer does not alter the product identifier mapping or tokenURI", async () => {
    const { c, alice, bob } = await deploy();
    await mint(c, alice.address);
    await (await c.connect(alice).transferFrom(alice.address, bob.address, 1n)).wait();
    assert.equal(await c.getTokenIdByProductIdentifier("SKU-1"), 1n);
    assert.equal(await c.tokenURI(1n), URI);
  });
});
