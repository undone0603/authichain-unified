"""Fail-closed on-chain signing: policy, allowlist, cap, no simulated success."""
from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from agentz.core.blockchain import (
    ChainSigningRefused,
    BlockchainAgent,
    DEFAULT_ALLOWED_CHAIN_IDS,
    assert_chain_signing_authorized,
    assert_transaction_allowed,
)
from agentz.core.capability_policy import Decision

ACCOUNT = "0x1111111111111111111111111111111111111111"
OTHER = "0x2222222222222222222222222222222222222222"


@pytest.fixture(autouse=True)
def _isolate_signing_env(monkeypatch):
    monkeypatch.delenv("AGENTZ_CHAIN_SIGNING_ENABLED", raising=False)
    monkeypatch.delenv("AGENTZ_CHAIN_IDS", raising=False)
    monkeypatch.delenv("AGENTZ_CHAIN_DESTINATIONS", raising=False)
    monkeypatch.delenv("AGENTZ_CHAIN_MAX_VALUE_WEI", raising=False)
    monkeypatch.delenv("AGENTZ_CHAIN_MAX_GAS", raising=False)
    monkeypatch.delenv("POLYGON_PRIVATE_KEY", raising=False)
    monkeypatch.delenv("POLYGON_RPC_URL", raising=False)


def test_default_chain_allowlist_is_amoy_only():
    assert DEFAULT_ALLOWED_CHAIN_IDS == frozenset({80002})


def test_signing_disabled_without_enable_flag():
    with pytest.raises(ChainSigningRefused, match="disabled"):
        assert_chain_signing_authorized()


def test_enabled_signing_still_requires_capability_policy(monkeypatch):
    monkeypatch.setenv("AGENTZ_CHAIN_SIGNING_ENABLED", "true")
    denied = Decision(False, "explicit scoped authorization required")
    with patch("agentz.core.blockchain.decide", return_value=denied):
        with pytest.raises(ChainSigningRefused, match="explicit scoped authorization"):
            assert_chain_signing_authorized()


def test_policy_denial_is_not_a_simulated_hash(monkeypatch):
    monkeypatch.setenv("AGENTZ_CHAIN_SIGNING_ENABLED", "true")
    denied = Decision(False, "payment refused")
    agent = BlockchainAgent(rpc_url="http://127.0.0.1:9")
    with patch("agentz.core.blockchain.decide", return_value=denied):
        with pytest.raises(ChainSigningRefused, match="payment refused") as raised:
            asyncio.run(agent.anchor_identity({"id": "prod"}))
    assert not str(raised.value).startswith("0x")


def test_no_key_refuses_instead_of_sha256_hash(monkeypatch):
    monkeypatch.setenv("AGENTZ_CHAIN_SIGNING_ENABLED", "true")
    agent = BlockchainAgent(rpc_url="http://127.0.0.1:9")
    agent.account = None
    agent.private_key = None
    with pytest.raises(ChainSigningRefused, match="no signing key"):
        asyncio.run(agent.anchor_identity({"id": "prod"}))


def test_transaction_bounds_reject_unlisted_chain_and_destination():
    with pytest.raises(ChainSigningRefused, match="chain id"):
        assert_transaction_allowed(
            chain_id=137,
            destination=ACCOUNT,
            value_wei=0,
            gas=21_000,
            account_address=ACCOUNT,
        )
    with pytest.raises(ChainSigningRefused, match="destination"):
        assert_transaction_allowed(
            chain_id=80002,
            destination=OTHER,
            value_wei=0,
            gas=21_000,
            account_address=ACCOUNT,
        )


def test_transaction_bounds_reject_value_and_gas_over_cap():
    with pytest.raises(ChainSigningRefused, match="value"):
        assert_transaction_allowed(
            chain_id=80002,
            destination=ACCOUNT,
            value_wei=1,
            gas=21_000,
            account_address=ACCOUNT,
        )
    with pytest.raises(ChainSigningRefused, match="gas"):
        assert_transaction_allowed(
            chain_id=80002,
            destination=ACCOUNT,
            value_wei=0,
            gas=2_000_001,
            account_address=ACCOUNT,
        )


def test_self_send_zero_value_on_amoy_is_allowed():
    assert_transaction_allowed(
        chain_id=80002,
        destination=ACCOUNT,
        value_wei=0,
        gas=2_000_000,
        account_address=ACCOUNT,
    )


def test_anchor_identity_does_not_sign_when_destination_not_allowlisted(monkeypatch):
    monkeypatch.setenv("AGENTZ_CHAIN_SIGNING_ENABLED", "true")
    monkeypatch.setenv("AGENTZ_CHAIN_DESTINATIONS", OTHER)
    agent = BlockchainAgent(rpc_url="http://127.0.0.1:9")
    agent.private_key = "present-but-not-used"
    agent.account = SimpleNamespace(address=ACCOUNT)
    agent.w3 = SimpleNamespace(
        eth=SimpleNamespace(
            get_transaction_count=lambda _addr: 0,
            chain_id=80002,
            gas_price=1,
            account=SimpleNamespace(sign_transaction=lambda *a, **k: (_ for _ in ()).throw(AssertionError("signed"))),
            send_raw_transaction=lambda *_: (_ for _ in ()).throw(AssertionError("sent")),
        ),
        to_wei=lambda _n, _u: 0,
        to_hex=lambda **k: "0x00",
    )
    with pytest.raises(ChainSigningRefused, match="destination"):
        asyncio.run(agent.anchor_identity({"id": "prod"}))
