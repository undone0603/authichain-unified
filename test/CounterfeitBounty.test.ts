/**
 * test/CounterfeitBounty.test.ts
 *
 * Adversarial tests for contracts/CounterfeitBounty.sol (value-holding escrow).
 *
 * hardhat.config.ts scopes `paths.sources` to ./contracts/ledger and Hardhat 3
 * accepts only source directories, so the contract (and an inline mock ERC20 built
 * on OpenZeppelin) are compiled here with solc, as scripts/compile-authichain-nft.cjs
 * does.
 *
 * Tests tagged FIXED were FINDING tests against the original contract (claims
 * with no evidence, owner self-pay, squatting, unchecked ERC20 returns,
 * fee-on-transfer insolvency, claims after expiry, renounce stranding funds).
 * Each now asserts the attack fails.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, it } from "node:test";
import hre from "hardhat";

const { ethers } = await hre.network.getOrCreate();
const require = createRequire(import.meta.url);

const MOCK_SRC = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockToken is ERC20 {
    uint256 public feeBps;          // fee burned on every transfer/transferFrom
    bool public softFail;           // when true, transfer/transferFrom return false instead of reverting
    constructor() ERC20("Mock", "MOCK") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
    function setFeeBps(uint256 b) external { feeBps = b; }
    function setSoftFail(bool s) external { softFail = s; }
    function _update(address from, address to, uint256 value) internal override {
        if (feeBps > 0 && from != address(0) && to != address(0)) {
            uint256 fee = (value * feeBps) / 10000;
            super._update(from, address(0), fee);
            super._update(from, to, value - fee);
        } else {
            super._update(from, to, value);
        }
    }
    function transfer(address to, uint256 v) public override returns (bool) {
        if (softFail) return false;
        return super.transfer(to, v);
    }
    function transferFrom(address f, address to, uint256 v) public override returns (bool) {
        if (softFail) return false;
        return super.transferFrom(f, to, v);
    }
}

// Re-enters CounterfeitBounty when it receives tokens (ERC777-style hook simulation).
interface IBounty {
    function releaseBounty(address brand, string memory c) external;
}
contract ReentrantToken is ERC20 {
    IBounty public bounty;
    address public brand;
    string public target;
    uint256 public reenterCount;
    uint256 public reenterBlocked;  // re-entries the bounty contract refused
    constructor() ERC20("Re", "RE") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
    function arm(address b, address br, string memory c) external { bounty = IBounty(b); brand = br; target = c; }
    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (address(bounty) != address(0) && from == address(bounty)) {
            reenterCount++;
            try bounty.releaseBounty(brand, target) {} catch { reenterBlocked++; }
        }
    }
}
`;

function compileSources(sources: Record<string, string>) {
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
    sources: Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, { content: v }])),
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  const errs = (out.errors ?? []).filter((e: any) => e.severity === "error");
  if (errs.length) throw new Error(errs.map((e: any) => e.formattedMessage).join("\n"));
  return out.contracts as Record<string, Record<string, any>>;
}

const bountyOut = compileSources({
  "CounterfeitBounty.sol": fs.readFileSync(path.join(process.cwd(), "contracts/CounterfeitBounty.sol"), "utf8"),
})["CounterfeitBounty.sol"]["CounterfeitBounty"];
const mockOut = compileSources({ "Mock.sol": MOCK_SRC })["Mock.sol"];

const art = (o: any) => ({ abi: o.abi, bytecode: "0x" + o.evm.bytecode.object });
const bountyArt = art(bountyOut);
const tokenArt = art(mockOut["MockToken"]);
const reTokenArt = art(mockOut["ReentrantToken"]);

const DAY = 86400;
const CERT = "CERT-0001";
const AMOUNT = 1_000n * 10n ** 18n;
const EVIDENCE = "0x" + "ab".repeat(32);

async function deploy() {
  const [owner, brand, consumer, mallory, other] = await ethers.getSigners();
  const bounty: any = await new ethers.ContractFactory(bountyArt.abi, bountyArt.bytecode, owner).deploy();
  await bounty.waitForDeployment();
  const token: any = await new ethers.ContractFactory(tokenArt.abi, tokenArt.bytecode, owner).deploy();
  await token.waitForDeployment();
  await (await token.mint(brand.address, AMOUNT * 10n)).wait();
  await (await token.mint(mallory.address, AMOUNT)).wait();
  return { bounty, token, owner, brand, consumer, mallory, other };
}

async function lock(ctx: any, cert = CERT, amount = AMOUNT, days = 30, who = ctx.brand, token = ctx.token) {
  await (await token.connect(who).approve(await ctx.bounty.getAddress(), amount)).wait();
  return (await ctx.bounty.connect(who).lockBounty(cert, await token.getAddress(), amount, days)).wait();
}

const get = (ctx: any, cert = CERT, brand = ctx.brand) => ctx.bounty.getBounty(brand.address, cert);
const claim = (ctx: any, to: string, cert = CERT, brand = ctx.brand, evidence = EVIDENCE) =>
  ctx.bounty.claimBounty(brand.address, cert, to, evidence);
const release = (ctx: any, cert = CERT, brand = ctx.brand) => ctx.bounty.releaseBounty(brand.address, cert);

async function timeTravel(seconds: number) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

const errIface = new ethers.Interface([
  "error OwnableUnauthorizedAccount(address account)",
  "error OwnableInvalidOwner(address owner)",
  "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
  "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
  "error SafeERC20FailedOperation(address token)",
  "error ReentrancyGuardReentrantCall()",
]);

/** Assert revert; `expect` is a custom-error name (selector match) or a require() reason string. */
async function reverts(p: Promise<any>, expect?: string) {
  try {
    await p;
  } catch (e: any) {
    if (expect) {
      const text = `${e?.data ?? ""} ${e?.message ?? ""} ${e?.shortMessage ?? ""}`;
      let ok = text.includes(expect);
      try {
        ok = ok || text.includes(errIface.getError(expect)!.selector);
      } catch {
        /* not a custom error name */
      }
      assert.ok(ok, `expected revert "${expect}", got: ${text.slice(0, 300)}`);
    }
    return;
  }
  assert.fail(`expected revert${expect ? ` "${expect}"` : ""} but call succeeded`);
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

describe("CounterfeitBounty: lockBounty", () => {
  it("escrows tokens, stores the bounty under the brand's namespace and emits BountyLocked", async () => {
    const ctx = await deploy();
    const { bounty, token, brand } = ctx;
    const before = await token.balanceOf(brand.address);
    const t0 = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    const rc = await lock(ctx);

    const e = events(bounty, rc, "BountyLocked")[0];
    assert.equal(e.args.certificateNumber, CERT);
    assert.equal(e.args.brand, brand.address);
    assert.equal(e.args.amount, AMOUNT);
    assert.equal(e.args.token, await token.getAddress());

    assert.equal(await token.balanceOf(await bounty.getAddress()), AMOUNT);
    assert.equal(await token.balanceOf(brand.address), before - AMOUNT);

    const b = await get(ctx);
    assert.equal(b.brand, brand.address);
    assert.equal(b.amount, AMOUNT);
    assert.equal(b.claimed, false);
    assert.equal(b.released, false);
    assert.ok(b.expiry > t0 + BigInt(30 * DAY) - 5n && b.expiry < t0 + BigInt(30 * DAY) + 60n);
  });

  it("rejects zero amount, empty certificate, and a duplicate live bounty", async () => {
    const ctx = await deploy();
    const addr = await ctx.token.getAddress();
    await reverts(ctx.bounty.connect(ctx.brand).lockBounty(CERT, addr, 0, 30), "Amount must be > 0");
    await reverts(ctx.bounty.connect(ctx.brand).lockBounty("", addr, AMOUNT, 30), "Certificate required");
    await lock(ctx);
    await reverts(lock(ctx), "Bounty already exists");
  });

  it("reverts when allowance or balance is insufficient (no state written)", async () => {
    const ctx = await deploy();
    const addr = await ctx.token.getAddress();
    await reverts(ctx.bounty.connect(ctx.brand).lockBounty(CERT, addr, AMOUNT, 30), "ERC20InsufficientAllowance");
    await (await ctx.token.connect(ctx.other).approve(await ctx.bounty.getAddress(), AMOUNT)).wait();
    await reverts(ctx.bounty.connect(ctx.other).lockBounty(CERT, addr, AMOUNT, 30), "ERC20InsufficientBalance");
    assert.equal((await get(ctx, CERT, ctx.other)).amount, 0n);
  });

  it("FIXED: a stranger cannot squat a brand's certificate (bounties are namespaced by brand)", async () => {
    const ctx = await deploy();
    await lock(ctx, CERT, 1n, 7, ctx.mallory);
    // Mallory's lock lives under Mallory; the brand still locks its own certificate.
    await lock(ctx, CERT, AMOUNT, 30, ctx.brand);
    assert.equal((await get(ctx, CERT, ctx.brand)).amount, AMOUNT);
    assert.equal((await get(ctx, CERT, ctx.mallory)).amount, 1n);
    assert.notEqual(
      await ctx.bounty.bountyKey(ctx.brand.address, CERT),
      await ctx.bounty.bountyKey(ctx.mallory.address, CERT),
    );
  });

  it("FIXED: a settled certificate can be locked again", async () => {
    const ctx = await deploy();
    await lock(ctx, CERT, AMOUNT, 7);
    await timeTravel(7 * DAY);
    await (await release(ctx)).wait();
    await lock(ctx, CERT, AMOUNT, 30);
    const b = await get(ctx);
    assert.equal(b.released, false);
    assert.equal(b.amount, AMOUNT);
  });

  it("FIXED: a token returning false cannot record an unfunded bounty", async () => {
    const ctx = await deploy();
    await (await ctx.token.setSoftFail(true)).wait();
    await reverts(
      ctx.bounty.connect(ctx.mallory).lockBounty(CERT, await ctx.token.getAddress(), AMOUNT, 30),
      "SafeERC20FailedOperation",
    );
    assert.equal((await get(ctx, CERT, ctx.mallory)).amount, 0n);
  });

  it("FIXED: fee-on-transfer tokens record what arrived, so every bounty stays payable", async () => {
    const ctx = await deploy();
    await (await ctx.token.setFeeBps(1000)).wait(); // 10% burned per transfer
    await lock(ctx, "A", 1000n, 30);
    await lock(ctx, "B", 1000n, 30);
    assert.equal(await ctx.token.balanceOf(await ctx.bounty.getAddress()), 1800n);
    assert.equal((await get(ctx, "A")).amount, 900n);
    assert.equal((await get(ctx, "B")).amount, 900n);
    await (await claim(ctx, ctx.consumer.address, "A")).wait();
    await (await claim(ctx, ctx.consumer.address, "B")).wait();
    assert.equal(await ctx.token.balanceOf(await ctx.bounty.getAddress()), 0n, "solvent to the last wei");
  });

  it("FIXED: the window is 7..3650 days, so a bounty is a real commitment", async () => {
    const ctx = await deploy();
    const addr = await ctx.token.getAddress();
    await (await ctx.token.connect(ctx.brand).approve(await ctx.bounty.getAddress(), AMOUNT)).wait();
    for (const days of [0n, 6n, 3651n, 2n ** 255n]) {
      await reverts(ctx.bounty.connect(ctx.brand).lockBounty(CERT, addr, AMOUNT, days), "Duration out of range");
    }
    await lock(ctx, CERT, AMOUNT, 7);
    await reverts(release(ctx), "Not expired yet");
  });

  it("an EOA used as the token address reverts", async () => {
    const ctx = await deploy();
    await reverts(ctx.bounty.connect(ctx.brand).lockBounty(CERT, ctx.other.address, AMOUNT, 30));
  });
});

describe("CounterfeitBounty: claimBounty", () => {
  it("arbiter pays a claimant: exact amount, flag set, evidence digest emitted", async () => {
    const ctx = await deploy();
    await lock(ctx);
    const rc = await (await claim(ctx, ctx.consumer.address)).wait();
    const e = events(ctx.bounty, rc, "BountyClaimed")[0];
    assert.equal(e.args.claimant, ctx.consumer.address);
    assert.equal(e.args.brand, ctx.brand.address);
    assert.equal(e.args.amount, AMOUNT);
    assert.equal(e.args.evidenceDigest, EVIDENCE);
    assert.equal(await ctx.token.balanceOf(ctx.consumer.address), AMOUNT);
    assert.equal(await ctx.token.balanceOf(await ctx.bounty.getAddress()), 0n);
    const b = await get(ctx);
    assert.equal(b.claimed, true);
    assert.equal(b.released, false);
  });

  it("non-owners (brand, consumer, stranger) cannot claim", async () => {
    const ctx = await deploy();
    await lock(ctx);
    for (const s of [ctx.brand, ctx.consumer, ctx.mallory]) {
      await reverts(
        ctx.bounty.connect(s).claimBounty(ctx.brand.address, CERT, s.address, EVIDENCE),
        "OwnableUnauthorizedAccount",
      );
    }
    assert.equal(await ctx.token.balanceOf(await ctx.bounty.getAddress()), AMOUNT);
  });

  it("cannot claim a missing bounty, double-claim, or claim after release", async () => {
    const ctx = await deploy();
    await reverts(claim(ctx, ctx.consumer.address, "nope"), "No bounty");

    await lock(ctx);
    await (await claim(ctx, ctx.consumer.address)).wait();
    await reverts(claim(ctx, ctx.consumer.address), "Already settled");
    assert.equal(await ctx.token.balanceOf(ctx.consumer.address), AMOUNT, "paid exactly once");

    await lock(ctx, "CERT-2", AMOUNT, 7);
    await timeTravel(8 * DAY);
    await (await release(ctx, "CERT-2")).wait();
    await reverts(claim(ctx, ctx.consumer.address, "CERT-2"), "Already settled");
  });

  it("FIXED: a claim must commit to evidence", async () => {
    const ctx = await deploy();
    await lock(ctx);
    await reverts(claim(ctx, ctx.consumer.address, CERT, ctx.brand, ethers.ZeroHash), "Evidence required");
    const fn = bountyArt.abi.find((x: any) => x.name === "claimBounty");
    assert.deepEqual(fn.inputs.map((i: any) => i.type), ["address", "string", "address", "bytes32"]);
  });

  it("FIXED: the arbiter cannot pay itself, the brand, or the zero address", async () => {
    const ctx = await deploy();
    await lock(ctx);
    for (const to of [ctx.owner.address, ctx.brand.address, ethers.ZeroAddress]) {
      await reverts(claim(ctx, to), "Invalid claimant");
    }
    assert.equal(await ctx.token.balanceOf(await ctx.bounty.getAddress()), AMOUNT);
  });

  it("FIXED: claims close with the window; the brand's release cannot be front-run", async () => {
    const ctx = await deploy();
    await lock(ctx, CERT, AMOUNT, 7);
    await timeTravel(7 * DAY);
    await reverts(claim(ctx, ctx.consumer.address), "Bounty expired");
    await (await release(ctx)).wait();
    assert.equal(await ctx.token.balanceOf(ctx.consumer.address), 0n);
  });

  it("FIXED: ownership moves in two steps and cannot be renounced", async () => {
    const ctx = await deploy();
    await lock(ctx);
    await (await ctx.bounty.transferOwnership(ctx.other.address)).wait();
    assert.equal(await ctx.bounty.owner(), ctx.owner.address, "still the owner until accepted");
    await (await claim(ctx, ctx.consumer.address)).wait();
    await reverts(ctx.bounty.connect(ctx.mallory).acceptOwnership(), "OwnableUnauthorizedAccount");
    await (await ctx.bounty.connect(ctx.other).acceptOwnership()).wait();
    assert.equal(await ctx.bounty.owner(), ctx.other.address);
    await reverts(ctx.bounty.connect(ctx.other).renounceOwnership(), "Renounce disabled");
    await reverts(ctx.bounty.connect(ctx.mallory).renounceOwnership(), "OwnableUnauthorizedAccount");
  });

  it("FIXED: a token returning false on payout reverts instead of marking the bounty claimed", async () => {
    const ctx = await deploy();
    await lock(ctx);
    await (await ctx.token.setSoftFail(true)).wait();
    await reverts(claim(ctx, ctx.consumer.address), "SafeERC20FailedOperation");
    assert.equal((await get(ctx)).claimed, false);
    assert.equal(await ctx.token.balanceOf(await ctx.bounty.getAddress()), AMOUNT, "funds still escrowed");
    await (await ctx.token.setSoftFail(false)).wait();
    await (await claim(ctx, ctx.consumer.address)).wait();
    assert.equal(await ctx.token.balanceOf(ctx.consumer.address), AMOUNT);
  });
});

describe("CounterfeitBounty: releaseBounty", () => {
  it("cannot release before expiry (anyone), nor a missing bounty", async () => {
    const ctx = await deploy();
    await reverts(release(ctx, "nope"), "No bounty");
    await lock(ctx, CERT, AMOUNT, 30);
    await reverts(ctx.bounty.connect(ctx.brand).releaseBounty(ctx.brand.address, CERT), "Not expired yet");
    await timeTravel(29 * DAY);
    await reverts(ctx.bounty.connect(ctx.mallory).releaseBounty(ctx.brand.address, CERT), "Not expired yet");
  });

  it("after expiry anyone can trigger release but funds go ONLY to the brand", async () => {
    const ctx = await deploy();
    const brandBefore = await ctx.token.balanceOf(ctx.brand.address);
    await lock(ctx, CERT, AMOUNT, 30);
    await timeTravel(30 * DAY + 1);

    const mBefore = await ctx.token.balanceOf(ctx.mallory.address);
    const rc = await (await ctx.bounty.connect(ctx.mallory).releaseBounty(ctx.brand.address, CERT)).wait();
    const e = events(ctx.bounty, rc, "BountyReleased")[0];
    assert.equal(e.args.brand, ctx.brand.address);
    assert.equal(e.args.amount, AMOUNT);
    assert.equal(await ctx.token.balanceOf(ctx.brand.address), brandBefore);
    assert.equal(await ctx.token.balanceOf(ctx.mallory.address), mBefore, "caller gains nothing");
    assert.equal(await ctx.token.balanceOf(await ctx.bounty.getAddress()), 0n);
    assert.equal((await get(ctx)).released, true);
  });

  it("double release and release-after-claim are prevented", async () => {
    const ctx = await deploy();
    await lock(ctx, CERT, AMOUNT, 7);
    await timeTravel(8 * DAY);
    await (await release(ctx)).wait();
    await reverts(release(ctx), "Already settled");

    await lock(ctx, "C2", AMOUNT, 7);
    await (await claim(ctx, ctx.consumer.address, "C2")).wait();
    await timeTravel(8 * DAY);
    await reverts(release(ctx, "C2"), "Already settled");
  });
});

describe("CounterfeitBounty: isolation and reentrancy", () => {
  it("settling one certificate does not touch another; multiple tokens are tracked independently", async () => {
    const ctx = await deploy();
    const token2: any = await new ethers.ContractFactory(tokenArt.abi, tokenArt.bytecode, ctx.owner).deploy();
    await token2.waitForDeployment();
    await (await token2.mint(ctx.brand.address, 500n)).wait();

    await lock(ctx, "A", 100n, 30);
    await lock(ctx, "B", 500n, 30, ctx.brand, token2);

    await (await claim(ctx, ctx.consumer.address, "B")).wait();
    assert.equal(await token2.balanceOf(ctx.consumer.address), 500n);
    assert.equal(await ctx.token.balanceOf(ctx.consumer.address), 0n);
    assert.equal(await ctx.token.balanceOf(await ctx.bounty.getAddress()), 100n);
    assert.equal((await get(ctx, "A")).claimed, false);
  });

  it("a re-entrant token cannot double-pay: every re-entry is refused (state is set before the transfer)", async () => {
    const ctx = await deploy();
    const re: any = await new ethers.ContractFactory(reTokenArt.abi, reTokenArt.bytecode, ctx.owner).deploy();
    await re.waitForDeployment();
    await (await re.mint(ctx.brand.address, AMOUNT)).wait();
    await (await re.arm(await ctx.bounty.getAddress(), ctx.brand.address, CERT)).wait();

    await lock(ctx, CERT, AMOUNT, 7, ctx.brand, re);
    await (await claim(ctx, ctx.consumer.address)).wait();

    assert.ok((await re.reenterCount()) >= 1n, "hook did re-enter");
    assert.equal(await re.reenterBlocked(), await re.reenterCount(), "every re-entry was refused");
    assert.equal(await re.balanceOf(ctx.consumer.address), AMOUNT);
    assert.equal(await re.balanceOf(ctx.brand.address), 0n);
    assert.equal(await re.balanceOf(await ctx.bounty.getAddress()), 0n);
  });

  it("only the deployer is the initial owner", async () => {
    const ctx = await deploy();
    assert.equal(await ctx.bounty.owner(), ctx.owner.address);
  });
});
