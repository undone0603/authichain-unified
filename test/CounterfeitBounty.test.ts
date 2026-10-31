/**
 * test/CounterfeitBounty.test.ts
 *
 * Adversarial tests for contracts/CounterfeitBounty.sol (value-holding escrow).
 *
 * hardhat.config.ts scopes `paths.sources` to ./contracts/ledger and Hardhat 3
 * accepts only source directories, so the contract (and an inline mock ERC20 built
 * on OpenZeppelin) are compiled here with solc, as scripts/compile-authichain-nft.cjs
 * does. No .sol file in the repo is added or modified.
 *
 * Tests tagged FINDING assert what the contract ACTUALLY does today. They document
 * trust-boundary / correctness weaknesses; a fix will make them fail loudly.
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
    function releaseBounty(string memory c) external;
    function claimBounty(string memory c, address claimant) external;
}
contract ReentrantToken is ERC20 {
    IBounty public bounty;
    string public target;
    uint256 public reenterCount;
    constructor() ERC20("Re", "RE") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
    function arm(address b, string memory c) external { bounty = IBounty(b); target = c; }
    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (address(bounty) != address(0) && from == address(bounty)) {
            reenterCount++;
            try bounty.releaseBounty(target) {} catch {}
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

async function timeTravel(seconds: number) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

const errIface = new ethers.Interface([
  "error OwnableUnauthorizedAccount(address account)",
  "error OwnableInvalidOwner(address owner)",
  "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
  "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
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
  it("escrows tokens, stores the bounty and emits BountyLocked", async () => {
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

    const b = await bounty.productBounties(CERT);
    assert.equal(b.brand, brand.address);
    assert.equal(b.amount, AMOUNT);
    assert.equal(b.claimed, false);
    assert.equal(b.released, false);
    assert.ok(b.expiry > t0 + BigInt(30 * DAY) - 5n && b.expiry < t0 + BigInt(30 * DAY) + 60n);
  });

  it("rejects zero amount and duplicate certificate", async () => {
    const ctx = await deploy();
    await reverts(ctx.bounty.connect(ctx.brand).lockBounty(CERT, await ctx.token.getAddress(), 0, 30), "Amount must be > 0");
    await lock(ctx);
    await reverts(lock(ctx), "Bounty already exists");
  });

  it("reverts when allowance or balance is insufficient (no state written)", async () => {
    const ctx = await deploy();
    const addr = await ctx.token.getAddress();
    await reverts(ctx.bounty.connect(ctx.brand).lockBounty(CERT, addr, AMOUNT, 30), "ERC20InsufficientAllowance");
    await (await ctx.token.connect(ctx.other).approve(await ctx.bounty.getAddress(), AMOUNT)).wait();
    await reverts(ctx.bounty.connect(ctx.other).lockBounty(CERT, addr, AMOUNT, 30), "ERC20InsufficientBalance");
    assert.equal((await ctx.bounty.productBounties(CERT)).amount, 0n);
  });

  it("FINDING: anyone can lock a bounty for ANY certificate number (no binding to certificate ownership) and squat the id", async () => {
    const ctx = await deploy();
    // Mallory is not the brand and has no relation to CERT; locks 1 wei with 0 days.
    await lock(ctx, CERT, 1n, 0, ctx.mallory);
    const b = await ctx.bounty.productBounties(CERT);
    assert.equal(b.brand, ctx.mallory.address);
    // The real brand can no longer lock a bounty for its own certificate.
    await reverts(lock(ctx, CERT, AMOUNT, 30, ctx.brand), "Bounty already exists");
  });

  it("FINDING: a settled certificate id can never be re-used (amount is never cleared)", async () => {
    const ctx = await deploy();
    await lock(ctx, CERT, AMOUNT, 0);
    await (await ctx.bounty.releaseBounty(CERT)).wait();
    await reverts(lock(ctx), "Bounty already exists");
  });

  it("FINDING: lockBounty ignores the ERC20 return value - a token returning false records a bounty with no funds", async () => {
    const ctx = await deploy();
    await (await ctx.token.setSoftFail(true)).wait();
    await (await ctx.bounty.connect(ctx.mallory).lockBounty(CERT, await ctx.token.getAddress(), AMOUNT, 30)).wait();
    const b = await ctx.bounty.productBounties(CERT);
    assert.equal(b.amount, AMOUNT, "bounty recorded");
    assert.equal(await ctx.token.balanceOf(await ctx.bounty.getAddress()), 0n, "but nothing was escrowed");
  });

  it("FINDING: fee-on-transfer tokens make the contract insolvent (records nominal amount, receives less)", async () => {
    const ctx = await deploy();
    await (await ctx.token.setFeeBps(1000)).wait(); // 10%
    await lock(ctx, "A", 1000n, 30);
    await lock(ctx, "B", 1000n, 30);
    assert.equal(await ctx.token.balanceOf(await ctx.bounty.getAddress()), 1800n);
    // Owner claims A in full (900 of the 1000 recorded cannot be honoured twice over): the second payout reverts.
    await (await ctx.bounty.claimBounty("A", ctx.consumer.address)).wait();
    await reverts(ctx.bounty.claimBounty("B", ctx.consumer.address));
  });

  it("an EOA used as the token address reverts (compiler extcodesize check on the high-level call)", async () => {
    const ctx = await deploy();
    await reverts(ctx.bounty.connect(ctx.brand).lockBounty(CERT, ctx.other.address, AMOUNT, 30));
  });

  it("very large duration overflows and reverts (checked arithmetic) rather than wrapping", async () => {
    const ctx = await deploy();
    await (await ctx.token.connect(ctx.brand).approve(await ctx.bounty.getAddress(), AMOUNT)).wait();
    await reverts(
      ctx.bounty.connect(ctx.brand).lockBounty(CERT, await ctx.token.getAddress(), AMOUNT, 2n ** 255n)
    );
  });
});

describe("CounterfeitBounty: claimBounty", () => {
  it("owner can claim to a claimant: exact amount transferred, flag set, event emitted", async () => {
    const ctx = await deploy();
    await lock(ctx);
    const rc = await (await ctx.bounty.claimBounty(CERT, ctx.consumer.address)).wait();
    const e = events(ctx.bounty, rc, "BountyClaimed")[0];
    assert.equal(e.args.claimant, ctx.consumer.address);
    assert.equal(e.args.amount, AMOUNT);
    assert.equal(await ctx.token.balanceOf(ctx.consumer.address), AMOUNT);
    assert.equal(await ctx.token.balanceOf(await ctx.bounty.getAddress()), 0n);
    const b = await ctx.bounty.productBounties(CERT);
    assert.equal(b.claimed, true);
    assert.equal(b.released, false);
  });

  it("non-owners (brand, consumer, stranger) cannot claim", async () => {
    const ctx = await deploy();
    await lock(ctx);
    for (const s of [ctx.brand, ctx.consumer, ctx.mallory]) {
      await reverts(ctx.bounty.connect(s).claimBounty(CERT, s.address), "OwnableUnauthorizedAccount");
    }
    assert.equal(await ctx.token.balanceOf(await ctx.bounty.getAddress()), AMOUNT);
  });

  it("cannot claim a missing bounty, double-claim, or claim after release", async () => {
    const ctx = await deploy();
    await reverts(ctx.bounty.claimBounty("nope", ctx.consumer.address), "No bounty");

    await lock(ctx);
    await (await ctx.bounty.claimBounty(CERT, ctx.consumer.address)).wait();
    await reverts(ctx.bounty.claimBounty(CERT, ctx.consumer.address), "Already settled");
    assert.equal(await ctx.token.balanceOf(ctx.consumer.address), AMOUNT, "paid exactly once");

    await lock(ctx, "CERT-2", AMOUNT, 1);
    await timeTravel(2 * DAY);
    await (await ctx.bounty.releaseBounty("CERT-2")).wait();
    await reverts(ctx.bounty.claimBounty("CERT-2", ctx.consumer.address), "Already settled");
  });

  it("FINDING: claim is purely owner-discretionary - no proof, no consensus, no binding to any AuthiChain verification record", async () => {
    const ctx = await deploy();
    await lock(ctx);
    // The owner supplies an arbitrary payee and no evidence argument exists at all.
    const fn = bountyArt.abi.find((x: any) => x.name === "claimBounty");
    assert.deepEqual(fn.inputs.map((i: any) => i.type), ["string", "address"]);
    await (await ctx.bounty.claimBounty(CERT, ctx.other.address)).wait();
    assert.equal(await ctx.token.balanceOf(ctx.other.address), AMOUNT);
  });

  it("FINDING: the owner can drain any brand's escrow to itself - no timelock, no brand consent", async () => {
    const ctx = await deploy();
    await lock(ctx);
    const before = await ctx.token.balanceOf(ctx.owner.address);
    await (await ctx.bounty.claimBounty(CERT, ctx.owner.address)).wait();
    assert.equal((await ctx.token.balanceOf(ctx.owner.address)) - before, AMOUNT);
  });

  it("FINDING: claim ignores expiry - owner can claim after the bounty expired, front-running the brand's release", async () => {
    const ctx = await deploy();
    await lock(ctx, CERT, AMOUNT, 1);
    await timeTravel(5 * DAY);
    await (await ctx.bounty.claimBounty(CERT, ctx.consumer.address)).wait();
    assert.equal(await ctx.token.balanceOf(ctx.consumer.address), AMOUNT);
    await reverts(ctx.bounty.releaseBounty(CERT), "Already settled");
  });

  it("FINDING: ownership transfer moves total control of all escrows; renounceOwnership permanently disables claims", async () => {
    const ctx = await deploy();
    await lock(ctx);
    await (await ctx.bounty.transferOwnership(ctx.mallory.address)).wait();
    await reverts(ctx.bounty.claimBounty(CERT, ctx.consumer.address), "OwnableUnauthorizedAccount");
    await (await ctx.bounty.connect(ctx.mallory).claimBounty(CERT, ctx.mallory.address)).wait();
    assert.equal(await ctx.token.balanceOf(ctx.mallory.address), AMOUNT * 2n);

    await lock(ctx, "C2");
    await (await ctx.bounty.connect(ctx.mallory).renounceOwnership()).wait();
    await reverts(ctx.bounty.connect(ctx.mallory).claimBounty("C2", ctx.mallory.address), "OwnableUnauthorizedAccount");
  });

  it("claiming to the zero address is rejected by the token (funds not burned)", async () => {
    const ctx = await deploy();
    await lock(ctx);
    await reverts(ctx.bounty.claimBounty(CERT, ethers.ZeroAddress));
    assert.equal((await ctx.bounty.productBounties(CERT)).claimed, false);
  });

  it("FINDING: claimBounty ignores the transfer return value - with a returns-false token it marks the bounty claimed without paying", async () => {
    const ctx = await deploy();
    await lock(ctx);
    await (await ctx.token.setSoftFail(true)).wait();
    await (await ctx.bounty.claimBounty(CERT, ctx.consumer.address)).wait();
    assert.equal((await ctx.bounty.productBounties(CERT)).claimed, true);
    assert.equal(await ctx.token.balanceOf(ctx.consumer.address), 0n);
    assert.equal(await ctx.token.balanceOf(await ctx.bounty.getAddress()), AMOUNT, "funds stranded forever");
    await reverts(ctx.bounty.claimBounty(CERT, ctx.consumer.address), "Already settled");
  });
});

describe("CounterfeitBounty: releaseBounty", () => {
  it("cannot release before expiry (anyone), nor a missing bounty", async () => {
    const ctx = await deploy();
    await reverts(ctx.bounty.releaseBounty("nope"), "No bounty");
    await lock(ctx, CERT, AMOUNT, 30);
    await reverts(ctx.bounty.connect(ctx.brand).releaseBounty(CERT), "Not expired yet");
    await timeTravel(29 * DAY);
    await reverts(ctx.bounty.connect(ctx.mallory).releaseBounty(CERT), "Not expired yet");
  });

  it("after expiry anyone can trigger release but funds go ONLY to the brand; event + balances correct", async () => {
    const ctx = await deploy();
    const brandBefore = await ctx.token.balanceOf(ctx.brand.address);
    await lock(ctx, CERT, AMOUNT, 30);
    await timeTravel(30 * DAY + 1);

    const mBefore = await ctx.token.balanceOf(ctx.mallory.address);
    const rc = await (await ctx.bounty.connect(ctx.mallory).releaseBounty(CERT)).wait();
    const e = events(ctx.bounty, rc, "BountyReleased")[0];
    assert.equal(e.args.brand, ctx.brand.address);
    assert.equal(e.args.amount, AMOUNT);
    assert.equal(await ctx.token.balanceOf(ctx.brand.address), brandBefore);
    assert.equal(await ctx.token.balanceOf(ctx.mallory.address), mBefore, "caller gains nothing");
    assert.equal(await ctx.token.balanceOf(await ctx.bounty.getAddress()), 0n);
    assert.equal((await ctx.bounty.productBounties(CERT)).released, true);
  });

  it("double release and release-after-claim are prevented", async () => {
    const ctx = await deploy();
    await lock(ctx, CERT, AMOUNT, 1);
    await timeTravel(2 * DAY);
    await (await ctx.bounty.releaseBounty(CERT)).wait();
    await reverts(ctx.bounty.releaseBounty(CERT), "Already settled");

    await lock(ctx, "C2", AMOUNT, 1);
    await (await ctx.bounty.claimBounty("C2", ctx.consumer.address)).wait();
    await timeTravel(2 * DAY);
    await reverts(ctx.bounty.releaseBounty("C2"), "Already settled");
  });

  it("zero-day bounty is immediately releasable (expiry == lock time)", async () => {
    const ctx = await deploy();
    await lock(ctx, CERT, AMOUNT, 0);
    await (await ctx.bounty.releaseBounty(CERT)).wait();
    assert.equal((await ctx.bounty.productBounties(CERT)).released, true);
  });

  it("FINDING: no consumer-side protection - a brand can lock with 0 days and release immediately, so the 'bounty' is not credibly committed", async () => {
    const ctx = await deploy();
    const addr = await ctx.token.getAddress();
    await (await ctx.token.connect(ctx.brand).approve(await ctx.bounty.getAddress(), AMOUNT)).wait();
    const before = await ctx.token.balanceOf(ctx.brand.address);
    await (await ctx.bounty.connect(ctx.brand).lockBounty(CERT, addr, AMOUNT, 0)).wait();
    await (await ctx.bounty.connect(ctx.brand).releaseBounty(CERT)).wait();
    assert.equal(await ctx.token.balanceOf(ctx.brand.address), before);
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

    await (await ctx.bounty.claimBounty("B", ctx.consumer.address)).wait();
    assert.equal(await token2.balanceOf(ctx.consumer.address), 500n);
    assert.equal(await ctx.token.balanceOf(ctx.consumer.address), 0n);
    assert.equal(await ctx.token.balanceOf(await ctx.bounty.getAddress()), 100n);
    assert.equal((await ctx.bounty.productBounties("A")).claimed, false);
  });

  it("reentrant token cannot double-pay: state is updated before the external transfer (checks-effects-interactions)", async () => {
    const ctx = await deploy();
    const re: any = await new ethers.ContractFactory(reTokenArt.abi, reTokenArt.bytecode, ctx.owner).deploy();
    await re.waitForDeployment();
    await (await re.mint(ctx.brand.address, AMOUNT)).wait();
    await (await re.arm(await ctx.bounty.getAddress(), CERT)).wait();

    await lock(ctx, CERT, AMOUNT, 0, ctx.brand, re);
    await (await ctx.bounty.claimBounty(CERT, ctx.consumer.address)).wait();

    assert.ok((await re.reenterCount()) >= 1n, "hook did re-enter");
    // The re-entrant releaseBounty hit 'Already settled'; exactly one payout happened.
    assert.equal(await re.balanceOf(ctx.consumer.address), AMOUNT);
    assert.equal(await re.balanceOf(ctx.brand.address), 0n);
    assert.equal(await re.balanceOf(await ctx.bounty.getAddress()), 0n);
  });

  it("only the deployer is the initial owner", async () => {
    const ctx = await deploy();
    assert.equal(await ctx.bounty.owner(), ctx.owner.address);
  });
});
