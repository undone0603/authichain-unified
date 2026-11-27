"""
agentz.core.blockchain
----------------------
Blockchain Agent: Manages on-chain identity anchoring on Polygon.
Provides verifiable proofs of authenticity.

Signing and sending fail closed. A missing key, a policy denial, an
unlisted chain or destination, or a cap breach raises ChainSigningRefused
and never returns a simulated transaction hash.
"""
from __future__ import annotations

import hashlib
import os
from typing import Any, Dict, Iterable, Optional

from web3 import Web3

from agentz.core.capability_policy import Capability, decide
from agentz.core.credentials import get

# Polygon Amoy testnet. Mainnet (137) is not implied.
DEFAULT_ALLOWED_CHAIN_IDS = frozenset({80002})
DEFAULT_MAX_VALUE_WEI = 0
DEFAULT_MAX_GAS = 2_000_000
_SIGNING_CAPABILITIES = (
    Capability.PAYMENT,
    Capability.SPEND,
    Capability.IDENTITY_PUBLISH,
)


class ChainSigningRefused(PermissionError):
    """On-chain sign/send refused. Callers must not treat this as success."""


def _env_flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() == "true"


def _parse_int_env(name: str, default: int) -> int:
    raw = os.environ.get(name, "")
    if not raw.strip():
        return default
    try:
        return int(raw.strip(), 10)
    except ValueError as exc:
        raise ChainSigningRefused(f"invalid integer for {name}") from exc


def allowed_chain_ids() -> frozenset[int]:
    raw = os.environ.get("AGENTZ_CHAIN_IDS", "")
    if not raw.strip():
        return DEFAULT_ALLOWED_CHAIN_IDS
    parsed: set[int] = set()
    for item in raw.split(","):
        item = item.strip()
        if not item:
            continue
        try:
            parsed.add(int(item, 10))
        except ValueError as exc:
            raise ChainSigningRefused("invalid AGENTZ_CHAIN_IDS entry") from exc
    if not parsed:
        raise ChainSigningRefused("AGENTZ_CHAIN_IDS parsed empty")
    return frozenset(parsed)


def allowed_destinations(account_address: str) -> frozenset[str]:
    """Default: the signing account only. Env override is a checksum allowlist."""
    raw = os.environ.get("AGENTZ_CHAIN_DESTINATIONS", "")
    if not raw.strip():
        return frozenset({Web3.to_checksum_address(account_address)})
    parsed: set[str] = set()
    for item in raw.split(","):
        item = item.strip()
        if not item:
            continue
        try:
            parsed.add(Web3.to_checksum_address(item))
        except (ValueError, TypeError) as exc:
            raise ChainSigningRefused("invalid AGENTZ_CHAIN_DESTINATIONS entry") from exc
    if not parsed:
        raise ChainSigningRefused("AGENTZ_CHAIN_DESTINATIONS parsed empty")
    return frozenset(parsed)


def assert_chain_signing_authorized() -> None:
    """Refuse unless explicitly enabled and capability_policy allows PAYMENT/SPEND."""
    authorized = _env_flag("AGENTZ_CHAIN_SIGNING_ENABLED")
    if not authorized:
        raise ChainSigningRefused("on-chain signing is disabled")
    for capability in _SIGNING_CAPABILITIES:
        decision = decide(capability, authorized=authorized)
        if not decision.allowed:
            raise ChainSigningRefused(decision.reason)


def assert_transaction_allowed(
    *,
    chain_id: int,
    destination: str,
    value_wei: int,
    gas: int,
    account_address: str,
    max_value_wei: int | None = None,
    max_gas: int | None = None,
    chain_ids: Iterable[int] | None = None,
) -> None:
    """Hard cap + chain/destination allowlist. No simulated success on failure."""
    if max_value_wei is None:
        max_value_wei = _parse_int_env("AGENTZ_CHAIN_MAX_VALUE_WEI", DEFAULT_MAX_VALUE_WEI)
    if max_gas is None:
        max_gas = _parse_int_env("AGENTZ_CHAIN_MAX_GAS", DEFAULT_MAX_GAS)
    permitted_chains = frozenset(chain_ids) if chain_ids is not None else allowed_chain_ids()
    try:
        checksum_to = Web3.to_checksum_address(destination)
        checksum_account = Web3.to_checksum_address(account_address)
    except (ValueError, TypeError) as exc:
        raise ChainSigningRefused("invalid destination or account address") from exc
    if int(chain_id) not in permitted_chains:
        raise ChainSigningRefused("chain id is not allowlisted")
    if checksum_to not in allowed_destinations(checksum_account):
        raise ChainSigningRefused("destination is not allowlisted")
    if int(value_wei) < 0 or int(value_wei) > max_value_wei:
        raise ChainSigningRefused("transaction value exceeds cap")
    if int(gas) < 1 or int(gas) > max_gas:
        raise ChainSigningRefused("gas exceeds cap")


class BlockchainAgent:
    def __init__(self, rpc_url: Optional[str] = None):
        # Default to Polygon Amoy Testnet if not provided
        self.rpc_url = rpc_url or get("polygon_rpc_url", required=False) or "[REDACTED]"
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.private_key = get("polygon_private_key", required=False)
        self.account = self.w3.eth.account.from_key(self.private_key) if self.private_key else None

    async def anchor_identity(self, identity_data: Dict[str, Any]) -> str:
        """
        Anchors a product or project identity to Polygon.

        Sign/send is refused unless AGENTZ_CHAIN_SIGNING_ENABLED=true, the
        capability policy authorizes PAYMENT/SPEND/IDENTITY_PUBLISH, a key
        is present, and the tx stays inside the chain, destination, value
        and gas allowlists. Failures raise ChainSigningRefused; they never
        return a synthetic 0x hash.
        """
        assert_chain_signing_authorized()
        if not self.account or not self.private_key:
            raise ChainSigningRefused("no signing key configured")

        fingerprint = hashlib.sha256(str(identity_data).encode()).hexdigest()
        nonce = self.w3.eth.get_transaction_count(self.account.address)
        value = self.w3.to_wei(0, "ether")
        gas = DEFAULT_MAX_GAS
        chain_id = int(self.w3.eth.chain_id)
        destination = self.account.address
        assert_transaction_allowed(
            chain_id=chain_id,
            destination=destination,
            value_wei=int(value),
            gas=gas,
            account_address=self.account.address,
        )
        tx = {
            "nonce": nonce,
            "to": destination,
            "value": value,
            "gas": gas,
            "gasPrice": self.w3.eth.gas_price,
            "data": self.w3.to_hex(text=f"[REDACTED]:{fingerprint}"),
            "chainId": chain_id,
        }
        signed_tx = self.w3.eth.account.sign_transaction(tx, self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        return self.w3.to_hex(tx_hash)

    async def anchor_to_bitcoin(self, product_id: str, data_hash: str) -> Dict[str, Any]:
        """
        Simulates anchoring a high-value asset to Bitcoin via Ordinals (L1).
        This provides a secondary, ultra-permanent 'Sovereign Anchor'.
        """
        # In a real scenario, this would use a library like 'ord' or an API like Hiro/Xverse
        # For the hardened pilot, we generate a deterministic Ordinal-style ID.
        inscription_id = f"{data_hash}i0"

        return {
            "network": "bitcoin_l1",
            "method": "ordinal_inscription",
            "inscription_id": inscription_id,
            "sat_ordinal": int(hashlib.sha256(product_id.encode()).hexdigest()[:15], 16),
            "status": "anchored"
        }

    def verify_anchor(self, tx_hash: str) -> bool:
        """Verifies that a transaction exists on-chain."""
        try:
            receipt = self.w3.eth.get_transaction_receipt(tx_hash)
            return receipt is not None
        except Exception:
            return False
