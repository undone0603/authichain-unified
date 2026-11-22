"""Keccak-256 vectors and on-chain settlement proof logic. No network."""
import pytest
from eth_hash.auto import keccak

from agentz.integrations import settlement_proof as sp
from agentz.integrations import x402_revenue as rev

# ---- keccak-256 known-answer tests -------------------------------------------------


def test_keccak256_empty_string_vector():
    # Ethereum Keccak-256 (not NIST SHA3-256) of the empty input.
    assert keccak(b"").hex() == "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"


def test_keccak256_differs_from_sha3_256():
    import hashlib
    assert keccak(b"").hex() != hashlib.sha3_256(b"").hexdigest()


@pytest.mark.parametrize("signature,selector", [
    ("transfer(address,uint256)", "0xa9059cbb"),
    ("balanceOf(address)", "0x70a08231"),
    ("approve(address,uint256)", "0x095ea7b3"),
    ("transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)",
     "0xe3ee160e"),
])
def test_function_selectors(signature, selector):
    assert sp.function_selector(signature) == selector


def test_event_topics_match_known_values():
    assert sp.event_topic(sp.TRANSFER_SIGNATURE) == (
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef")
    assert sp.event_topic(sp.AUTHORIZATION_USED_SIGNATURE) == (
        "0x98de503528ee59b575ef0c0a2576a82497bfc029a5685b209e9ec333479b10a5")


def test_hardcoded_constants_are_the_keccak_values():
    # x402_revenue filters logs with a literal topic and reads balances with a
    # literal selector; both must equal their keccak derivations.
    assert rev.TRANSFER_TOPIC == sp.event_topic("Transfer(address,address,uint256)")
    assert sp.function_selector("balanceOf(address)") == "0x70a08231"


# ---- settlement proof ---------------------------------------------------------------

PAYER = "0x" + "c" * 40
FAC = "0x" + "f" * 40
TX = "0x" + "1" * 64
BLOCK_HASH = "0x" + "b" * 64


def topic_addr(a):
    return "0x" + "0" * 24 + a[2:].lower()


def transfer_log(to=rev.PAY_TO, frm=PAYER, amount=10_000, address=rev.BASE_USDC):
    return {"address": address, "data": hex(amount),
            "topics": [sp.event_topic(sp.TRANSFER_SIGNATURE), topic_addr(frm), topic_addr(to)]}


def auth_log(authorizer=PAYER, nonce="0x" + "9" * 64):
    return {"address": rev.BASE_USDC, "data": "0x",
            "topics": [sp.event_topic(sp.AUTHORIZATION_USED_SIGNATURE), topic_addr(authorizer), nonce]}


class Rpc:
    def __init__(self, logs, status="0x1", sender=FAC, block_hash=BLOCK_HASH, receipt=True):
        self.logs, self.status, self.sender = logs, status, sender
        self.block_hash, self.receipt = block_hash, receipt

    def __call__(self, method, params):
        if method == "eth_getTransactionReceipt":
            return {"status": self.status, "blockNumber": hex(100), "blockHash": BLOCK_HASH,
                    "logs": self.logs} if self.receipt else None
        if method == "eth_getTransactionByHash":
            return {"from": self.sender}
        if method == "eth_getBlockByNumber":
            return {"hash": self.block_hash}
        if method == "eth_blockNumber":
            return hex(109)
        raise AssertionError(method)


SIGNERS = frozenset({FAC})


def test_facilitator_settlement_is_proven():
    out = sp.prove_settlement(TX, Rpc([auth_log(), transfer_log()]), signers=SIGNERS)
    assert out["proven"] is True
    assert out["payer"] == PAYER and out["amount_usdc"] == 0.01
    assert out["confirmations"] == 10 and out["authorization_nonce"] == "0x" + "9" * 64


def test_direct_wallet_send_is_not_proven():
    out = sp.prove_settlement(TX, Rpc([transfer_log()], sender=PAYER), signers=SIGNERS)
    assert out["checks"]["eip3009_authorization_used_by_payer"] is False
    assert out["checks"]["sender_is_facilitator_signer"] is False
    assert out["proven"] is False


@pytest.mark.parametrize("rpc,failed", [
    (Rpc([auth_log(), transfer_log()], status="0x0"), "receipt_status_success"),
    (Rpc([auth_log(), transfer_log()], block_hash="0x" + "e" * 64), "block_hash_matches"),
    (Rpc([auth_log(), transfer_log(), transfer_log()]), "single_usdc_transfer_to_pay_to"),
    (Rpc([auth_log(), transfer_log(address="0x" + "d" * 40)]), "single_usdc_transfer_to_pay_to"),
    (Rpc([auth_log(authorizer="0x" + "a" * 40), transfer_log()]), "eip3009_authorization_used_by_payer"),
])
def test_each_check_can_fail(rpc, failed):
    out = sp.prove_settlement(TX, rpc, signers=SIGNERS)
    assert out["checks"][failed] is False and out["proven"] is False


def test_unknown_signers_do_not_block_proof():
    out = sp.prove_settlement(TX, Rpc([auth_log(), transfer_log()]))
    assert out["checks"]["sender_is_facilitator_signer"] is None
    assert out["proven"] is True


@pytest.mark.parametrize("bad", ["", "0x12", "1" * 66, None])
def test_malformed_tx_hash_refused(bad):
    with pytest.raises(rev.RevenueError):
        sp.prove_settlement(bad, Rpc([]))


def test_missing_receipt_refused():
    with pytest.raises(rev.RevenueError):
        sp.prove_settlement(TX, Rpc([], receipt=False))
