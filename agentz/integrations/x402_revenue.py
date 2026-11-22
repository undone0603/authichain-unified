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
DEFAULT_RPC = "https://base-rpc.publicnode.com"
BLOCKS_PER_DAY = 43_200  # Base targets 2 s blocks
STEP = 10_000
MAX_DAYS = 31
PRICE_ATOMIC = 50_000  # $0.05 per paid evidence check

Rpc = Callable[[str, list[Any]], Any]


class RevenueError(Exception):
    pass


def http_rpc(url: str = DEFAULT_RPC, timeout: float = 30.0,
             sleep: Callable[[float], None] = time.sleep) -> Rpc:
    def call(method: str, params: list[Any]) -> Any:
        body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method,
                           "params": params}).encode()
        for attempt in range(4):
            req = urllib.request.Request(url, body, {"content-type": "application/json",
                                                     "user-agent": "agentz-readonly/1"})
            try:
                data = json.load(urllib.request.urlopen(req, timeout=timeout))
            except urllib.error.HTTPError as exc:
                if exc.code != 429 or attempt == 3:
                    raise RevenueError(f"rpc http {exc.code}") from None
                sleep(2 * (attempt + 1))
                continue
            except (urllib.error.URLError, TimeoutError) as exc:
                raise RevenueError(f"rpc unreachable: {type(exc).__name__}") from None
            if "error" in data:
                raise RevenueError(f"rpc error: {str(data['error'])[:200]}")
            return data["result"]
        raise RevenueError("rpc rate limited")
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


def payments(days: float, rpc: Rpc, pay_to: str = PAY_TO,
             pause: Callable[[float], None] = time.sleep,
             signers: frozenset[str] = frozenset()) -> dict[str, Any]:
    """Count incoming USDC. Only transfers submitted by a facilitator signer count as
    x402 settlements; plain wallet sends (including the owner's own) do not."""
    if not 0 < days <= MAX_DAYS:
        raise RevenueError(f"days must be in (0, {MAX_DAYS}]")
    head = int(rpc("eth_blockNumber", []), 16)
    to_topic = "0x" + "0" * 24 + pay_to.lower().removeprefix("0x")
    span = int(days * BLOCKS_PER_DAY)
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
    for log in logs:
        tx = rpc("eth_getTransactionByHash", [log["transactionHash"]])
        if signers and (tx or {}).get("from", "").lower() in signers:
            settled.append(int(log["data"], 16))
    return {
        "pay_to": pay_to,
        "days": days,
        "head_block": head,
        "blocks_scanned": span,
        "incoming_transfers": len(amounts),
        "usdc_received": round(sum(amounts) / 1e6, 6),
        "x402_settlements": len(settled),
        "x402_usdc": round(sum(settled) / 1e6, 6),
        "x402_at_list_price": sum(1 for a in settled if a == PRICE_ATOMIC),
        "signers_known": bool(signers),
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
