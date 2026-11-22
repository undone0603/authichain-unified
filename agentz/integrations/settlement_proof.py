"""Cryptographic, on-chain proof that an x402 payment settled.

Given a Base transaction hash, read the receipt and block from a public RPC
and check, without trusting the facilitator:

1. the transaction succeeded (receipt status 0x1) and is in a block whose hash
   matches the block returned for that number;
2. the receipt holds a USDC `Transfer` log to the payTo wallet, identified by
   topic0 = keccak256("Transfer(address,address,uint256)") computed here, not
   copied from a constant;
3. the receipt holds an EIP-3009 `AuthorizationUsed(authorizer, nonce)` log
   from the same USDC contract for the same payer, which shows the transfer
   consumed a payer-signed authorization rather than a direct send;
4. the transaction sender is one of the facilitator signers, when known.

Read-only. No keys, no writes.
"""
from __future__ import annotations

import json
from typing import Any

from eth_hash.auto import keccak

from agentz.integrations.x402_revenue import BASE_USDC, PAY_TO, Rpc, RevenueError, http_rpc

TRANSFER_SIGNATURE = "Transfer(address,address,uint256)"
AUTHORIZATION_USED_SIGNATURE = "AuthorizationUsed(address,bytes32)"


def event_topic(signature: str) -> str:
    """topic0 for a Solidity event: keccak-256 of its canonical signature."""
    return "0x" + keccak(signature.encode("ascii")).hex()


def function_selector(signature: str) -> str:
    """4-byte selector for a Solidity function: first 4 bytes of keccak-256."""
    return "0x" + keccak(signature.encode("ascii")).hex()[:8]


def _addr_from_topic(topic: str) -> str:
    return "0x" + topic[-40:].lower()


def prove_settlement(tx_hash: str, rpc: Rpc, pay_to: str = PAY_TO,
                     signers: frozenset[str] = frozenset(),
                     usdc: str = BASE_USDC) -> dict[str, Any]:
    if not (isinstance(tx_hash, str) and tx_hash.startswith("0x") and len(tx_hash) == 66):
        raise RevenueError("tx hash must be 0x + 64 hex characters")
    receipt = rpc("eth_getTransactionReceipt", [tx_hash])
    if not receipt:
        raise RevenueError("no receipt: transaction unknown or not yet mined")
    tx = rpc("eth_getTransactionByHash", [tx_hash]) or {}
    block = rpc("eth_getBlockByNumber", [receipt["blockNumber"], False]) or {}
    head = int(rpc("eth_blockNumber", []), 16)

    transfer_t = event_topic(TRANSFER_SIGNATURE)
    auth_t = event_topic(AUTHORIZATION_USED_SIGNATURE)
    usdc_l, pay_to_l = usdc.lower(), pay_to.lower()
    logs = [lg for lg in receipt.get("logs", []) if lg.get("address", "").lower() == usdc_l]
    transfers = [lg for lg in logs if lg["topics"] and lg["topics"][0].lower() == transfer_t
                 and len(lg["topics"]) == 3 and _addr_from_topic(lg["topics"][2]) == pay_to_l]
    payment = transfers[0] if len(transfers) == 1 else None
    payer = _addr_from_topic(payment["topics"][1]) if payment else None
    auths = [lg for lg in logs if lg["topics"] and lg["topics"][0].lower() == auth_t
             and len(lg["topics"]) == 3 and payer and _addr_from_topic(lg["topics"][1]) == payer]
    sender = (tx.get("from") or "").lower()

    checks = {
        "receipt_status_success": receipt.get("status") == "0x1",
        "block_hash_matches": bool(block) and block.get("hash") == receipt.get("blockHash"),
        "single_usdc_transfer_to_pay_to": payment is not None,
        "eip3009_authorization_used_by_payer": len(auths) == 1,
        "sender_is_facilitator_signer": (sender in signers) if signers else None,
    }
    required = [k for k, v in checks.items() if v is not None]
    return {
        "tx_hash": tx_hash,
        "block_number": int(receipt["blockNumber"], 16),
        "block_hash": receipt.get("blockHash"),
        "confirmations": head - int(receipt["blockNumber"], 16) + 1,
        "chain": "base (eip155:8453)",
        "usdc_contract": usdc,
        "pay_to": pay_to,
        "payer": payer,
        "amount_usdc": int(payment["data"], 16) / 1e6 if payment else None,
        "authorization_nonce": auths[0]["topics"][2] if len(auths) == 1 else None,
        "tx_sender": sender or None,
        "topics": {"Transfer": transfer_t, "AuthorizationUsed": auth_t},
        "checks": checks,
        "proven": all(checks[k] for k in required),
        "source": "public Base RPC receipt and block (read-only)",
    }


def cli_prove(tx_hash: str) -> int:
    from agentz.integrations.x402_revenue import facilitator_signers

    try:
        try:
            signers = facilitator_signers()
        except RevenueError:
            signers = frozenset()
        out = prove_settlement(tx_hash, http_rpc(), signers=signers)
        print(json.dumps(out, indent=2))
        return 0 if out["proven"] else 1
    except RevenueError as exc:
        print(json.dumps({"error": "proof_unavailable", "message": str(exc)}))
        return 2
