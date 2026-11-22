"""Read-only, on-chain count of x402 USDC payments into the AuthiChain payTo wallet.

This is the only revenue number AgentZ reports for the agent rail: settled USDC
Transfer logs on Base, read from a public RPC. It does not read Stripe, does not
hold keys, and cannot move funds. A payment here is money received; it says
nothing about whether the buyer was satisfied or which call it paid for.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from typing import Any, Callable

PAY_TO = "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2"
BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
# keccak256("AuthorizationUsed(address,bytes32)"): EIP-3009 consumed a payer-signed
# authorization. Present in every x402 exact settlement, whatever the facilitator.
AUTHORIZATION_USED_TOPIC = "0x98de503528ee59b575ef0c0a2576a82497bfc029a5685b209e9ec333479b10a5"
DEFAULT_RPC = "https://base-rpc.publicnode.com"
# Base block time is not fixed (2 s at launch, 0.2 s by 2026-11). It is
# measured from block timestamps on every run; never assume it.
SAMPLE_BLOCKS = 200_000
STEP = 50_000  # public Base RPC maximum eth_getLogs range
MAX_DAYS = 31
PRICE_ATOMIC = 50_000  # $0.05 per paid evidence check

Rpc = Callable[[str, list[Any]], Any]


class RevenueError(Exception):
    pass


PUBLIC_RPCS = ("https://base-rpc.publicnode.com", "https://mainnet.base.org",
               "https://base.llamarpc.com")
THROTTLED = frozenset({403, 429, 500, 502, 503, 504})
RETRYABLE_RPC_HINTS = ("rate", "limit", "range", "too many", "timeout", "busy")


def http_rpc(url: str | None = None, timeout: float = 30.0,
             sleep: Callable[[float], None] = time.sleep,
             opener: Callable[..., Any] = urllib.request.urlopen) -> Rpc:
    """JSON-RPC over public Base endpoints. Throttled or unreachable endpoints
    rotate to the next one with growing back-off; nothing is retried forever."""
    urls = [url] if url else list(PUBLIC_RPCS)
    state = {"i": 0}

    def call(method: str, params: list[Any]) -> Any:
        body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method,
                           "params": params}).encode()
        last = "no attempt"
        for attempt in range(3 * len(urls)):
            endpoint = urls[state["i"] % len(urls)]
            req = urllib.request.Request(endpoint, body, {"content-type": "application/json",
                                                          "user-agent": "agentz-readonly/1"})
            try:
                data = json.load(opener(req, timeout=timeout))
            except urllib.error.HTTPError as exc:
                if exc.code not in THROTTLED:
                    raise RevenueError(f"rpc http {exc.code}") from None
                last = f"http {exc.code}"
            except (urllib.error.URLError, TimeoutError) as exc:
                last = f"unreachable: {type(exc).__name__}"
            else:
                if "error" in data:
                    msg = str(data["error"])
                    if not any(h in msg.lower() for h in RETRYABLE_RPC_HINTS):
                        raise RevenueError(f"rpc error: {msg[:200]}")
                    last = f"rpc error: {msg[:120]}"
                else:
                    return data["result"]
            state["i"] += 1
            sleep(min(8.0, 0.5 * (attempt + 1)))
        raise RevenueError(f"rpc unavailable after rotation: {last}")
    return call


def facilitator_signers(url: str = "https://authichain.com/api/x402/health",
                        timeout: float = 15.0) -> frozenset[str]:
    """Addresses the configured facilitator settles from, as published by health."""
    req = urllib.request.Request(url, headers={"user-agent": "agentz-readonly/1"})
    try:
        data = json.load(urllib.request.urlopen(req, timeout=timeout))
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise RevenueError(f"health unreachable: {type(exc).__name__}") from None
    signers = (((data.get("facilitator") or {}).get("supported") or {})
               .get("signers") or {})
    return frozenset(a.lower() for addrs in signers.values() for a in addrs)


def block_timestamp(rpc: Rpc, number: int) -> int:
    return int(rpc("eth_getBlockByNumber", [hex(number), False])["timestamp"], 16)


def measured_block_time(rpc: Rpc, head: int, sample: int = SAMPLE_BLOCKS) -> float:
    """Average seconds per block over the last `sample` blocks."""
    sample = max(1, min(sample, head))
    seconds = block_timestamp(rpc, head) - block_timestamp(rpc, head - sample)
    if seconds <= 0:
        raise RevenueError("could not measure block time")
    return seconds / sample


def payments(days: float, rpc: Rpc, pay_to: str = PAY_TO,
             pause: Callable[[float], None] = time.sleep,
             signers: frozenset[str] = frozenset()) -> dict[str, Any]:
    """Count incoming USDC. A transfer counts as an x402 settlement when its tx
    consumed the payer's EIP-3009 authorization (any facilitator: PayAI, Coinbase
    CDP, XPay). Plain wallet sends, including the owner's own, do not. Known PayAI
    signers only label the facilitator; they no longer decide what counts."""
    if not 0 < days <= MAX_DAYS:
        raise RevenueError(f"days must be in (0, {MAX_DAYS}]")
    head = int(rpc("eth_blockNumber", []), 16)
    to_topic = "0x" + "0" * 24 + pay_to.lower().removeprefix("0x")
    block_time = measured_block_time(rpc, head)
    span = min(head, int(days * 86_400 / block_time))
    logs: list[dict[str, Any]] = []
    hi = head
    while hi > head - span:
        lo = max(hi - STEP + 1, head - span + 1)
        logs += rpc("eth_getLogs", [{"fromBlock": hex(lo), "toBlock": hex(hi),
                                     "address": BASE_USDC,
                                     "topics": [TRANSFER_TOPIC, None, to_topic]}])
        hi = lo - 1
        pause(0.3)
    amounts = [int(log["data"], 16) for log in logs]
    settled = []
    by_facilitator: dict[str, int] = {}
    for log in logs:
        receipt = rpc("eth_getTransactionReceipt", [log["transactionHash"]]) or {}
        payer_topic = log["topics"][1].lower()
        authorized = any(
            (lg.get("address") or "").lower() == BASE_USDC.lower()
            and len(lg.get("topics") or []) >= 2
            and lg["topics"][0].lower() == AUTHORIZATION_USED_TOPIC
            and lg["topics"][1].lower() == payer_topic
            for lg in receipt.get("logs") or [])
        if not authorized or receipt.get("status") != "0x1":
            continue
        settled.append(int(log["data"], 16))
        sender = (receipt.get("from") or "").lower()
        label = "payai" if sender in signers else "other_facilitator"
        by_facilitator[label] = by_facilitator.get(label, 0) + 1
    return {
        "pay_to": pay_to,
        "days": days,
        "head_block": head,
        "blocks_scanned": span,
        "block_time_s": round(block_time, 4),
        "incoming_transfers": len(amounts),
        "usdc_received": round(sum(amounts) / 1e6, 6),
        "x402_settlements": len(settled),
        "x402_usdc": round(sum(settled) / 1e6, 6),
        "x402_at_list_price": sum(1 for a in settled if a == PRICE_ATOMIC),
        "x402_by_facilitator": by_facilitator,
        "classification": "EIP-3009 AuthorizationUsed by the payer in the same tx",
        "distinct_payers": len({log["topics"][1] for log in logs}),
        "source": "Base USDC Transfer logs via public RPC (read-only)",
    }


def cli_revenue(days: float) -> int:
    try:
        print(json.dumps(payments(days, http_rpc(), signers=facilitator_signers()), indent=2))
        return 0
    except RevenueError as exc:
        print(json.dumps({"error": "revenue_unavailable", "message": str(exc)}))
        return 2
