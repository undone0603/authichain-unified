"""Tests for the read-only x402 revenue counter. No network."""
import pytest

from agentz.integrations import x402_revenue as r

PAYER_A = "0x" + "0" * 24 + "a" * 40
PAYER_B = "0x" + "0" * 24 + "b" * 40


class FakeRpc:
    def __init__(self, head=1_000_000, logs_by_call=None):
        self.head = head
        self.logs_by_call = list(logs_by_call or [])
        self.ranges = []
        self.filters = []
        self.senders = {}

    def __call__(self, method, params):
        if method == "eth_blockNumber":
            return hex(self.head)
        if method == "eth_getTransactionByHash":
            return {"from": self.senders.get(params[0], "0xowner")}
        f = params[0]
        self.ranges.append((int(f["fromBlock"], 16), int(f["toBlock"], 16)))
        self.filters.append(f)
        return self.logs_by_call.pop(0) if self.logs_by_call else []


_n = iter(range(10**6))


def log(amount, payer):
    return {"data": hex(amount), "topics": [r.TRANSFER_TOPIC, payer, "x"],
            "transactionHash": f"0x{next(_n):064x}"}


def test_counts_payments_payers_and_list_price():
    rpc = FakeRpc(logs_by_call=[[log(50_000, PAYER_A), log(50_000, PAYER_A)],
                                [log(1_000_000, PAYER_B)]])
    first = rpc.logs_by_call[0]
    rpc.senders = {first[0]["transactionHash"]: "0xFAC", first[1]["transactionHash"]: "0xfac"}
    out = r.payments(1, rpc, pause=lambda _s: None, signers=frozenset({"0xfac"}))
    assert out["incoming_transfers"] == 3
    assert out["usdc_received"] == 1.1
    assert out["x402_settlements"] == 2 and out["x402_at_list_price"] == 2
    assert out["x402_usdc"] == 0.1
    assert out["distinct_payers"] == 2


def test_plain_owner_send_is_not_an_x402_settlement():
    rpc = FakeRpc(logs_by_call=[[log(1_000_000, PAYER_A)]])
    out = r.payments(0.1, rpc, pause=lambda _s: None, signers=frozenset({"0xfac"}))
    assert out["incoming_transfers"] == 1 and out["usdc_received"] == 1.0
    assert out["x402_settlements"] == 0 and out["x402_usdc"] == 0


def test_scan_ranges_are_contiguous_and_bounded():
    rpc = FakeRpc()
    r.payments(1, rpc, pause=lambda _s: None)
    span = r.BLOCKS_PER_DAY
    assert rpc.ranges[0][1] == rpc.head
    assert rpc.ranges[-1][0] == rpc.head - span + 1
    for (lo, _), (_, hi_next) in zip(rpc.ranges, rpc.ranges[1:]):
        assert hi_next == lo - 1
    assert all(hi - lo + 1 <= r.STEP for lo, hi in rpc.ranges)


def test_filter_targets_usdc_transfers_to_pay_to():
    rpc = FakeRpc()
    r.payments(0.1, rpc, pause=lambda _s: None)
    f = rpc.filters[0]
    assert f["address"] == r.BASE_USDC
    assert f["topics"][0] == r.TRANSFER_TOPIC and f["topics"][1] is None
    assert f["topics"][2].endswith(r.PAY_TO.lower()[2:])


@pytest.mark.parametrize("days", [0, -1, r.MAX_DAYS + 1])
def test_days_out_of_range_refused(days):
    with pytest.raises(r.RevenueError):
        r.payments(days, FakeRpc(), pause=lambda _s: None)
