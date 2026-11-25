"""Tests for the read-only x402 revenue counter. No network."""
import pytest

from agentz.integrations import x402_revenue as r

PAYER_A = "0x" + "0" * 24 + "a" * 40
PAYER_B = "0x" + "0" * 24 + "b" * 40


class FakeRpc:
    def __init__(self, head=10_000_000, logs_by_call=None, block_time=0.2):
        self.head = head
        self.logs_by_call = list(logs_by_call or [])
        self.ranges = []
        self.filters = []
        self.senders = {}
        self.authorized = {}
        self.block_time = block_time

    def __call__(self, method, params):
        if method == "eth_blockNumber":
            return hex(self.head)
        if method == "eth_getBlockByNumber":
            n = int(params[0], 16)
            return {"timestamp": hex(int(1_800_000_000 + n * self.block_time))}
        if method == "eth_getTransactionReceipt":
            h = params[0]
            logs = []
            if h in self.authorized:
                logs.append({"address": r.BASE_USDC, "topics": [
                    r.AUTHORIZATION_USED_TOPIC, self.authorized[h], "0x" + "9" * 64]})
            return {"status": "0x1", "from": self.senders.get(h, "0xowner"), "logs": logs}
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
    # Two authorized settlements: one by a PayAI signer, one by another facilitator.
    rpc.authorized = {first[0]["transactionHash"]: PAYER_A, first[1]["transactionHash"]: PAYER_A}
    rpc.senders = {first[0]["transactionHash"]: "0xfac"}
    out = r.payments(1, rpc, pause=lambda _s: None, signers=frozenset({"0xfac"}))
    assert out["incoming_transfers"] == 3
    assert out["usdc_received"] == 1.1
    assert out["x402_settlements"] == 2 and out["x402_at_list_price"] == 2
    assert out["x402_usdc"] == 0.1
    assert out["x402_by_facilitator"] == {"payai": 1, "other_facilitator": 1}
    assert out["distinct_payers"] == 2


def test_plain_owner_send_is_not_an_x402_settlement():
    rpc = FakeRpc(logs_by_call=[[log(1_000_000, PAYER_A)]])
    out = r.payments(0.1, rpc, pause=lambda _s: None, signers=frozenset({"0xfac"}))
    assert out["incoming_transfers"] == 1 and out["usdc_received"] == 1.0
    assert out["x402_settlements"] == 0 and out["x402_usdc"] == 0


def test_authorization_by_a_different_address_does_not_count():
    lg = log(50_000, PAYER_A)
    rpc = FakeRpc(logs_by_call=[[lg]])
    rpc.authorized = {lg["transactionHash"]: PAYER_B}
    out = r.payments(0.1, rpc, pause=lambda _s: None)
    assert out["x402_settlements"] == 0


def test_coinbase_style_settlement_counts_without_known_signers():
    lg = log(50_000, PAYER_A)
    rpc = FakeRpc(logs_by_call=[[lg]])
    rpc.authorized = {lg["transactionHash"]: PAYER_A}
    rpc.senders = {lg["transactionHash"]: "0x8cda367232d78c067116e3260da881d2da8ffa39"}
    out = r.payments(0.1, rpc, pause=lambda _s: None, signers=frozenset({"0xfac"}))
    assert out["x402_settlements"] == 1 and out["x402_by_facilitator"] == {"other_facilitator": 1}


def test_scan_ranges_are_contiguous_and_bounded():
    rpc = FakeRpc()
    r.payments(1, rpc, pause=lambda _s: None)
    span = int(86_400 / rpc.block_time)
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


@pytest.mark.parametrize("block_time,expected_blocks", [(2.0, 43_200), (0.2, 432_000)])
def test_window_follows_measured_block_time(block_time, expected_blocks):
    rpc = FakeRpc(block_time=block_time)
    out = r.payments(1, rpc, pause=lambda _s: None)
    assert out["blocks_scanned"] == expected_blocks
    assert out["block_time_s"] == block_time
    assert rpc.ranges[-1][0] == rpc.head - expected_blocks + 1


def test_http_rpc_rotates_endpoints_on_throttling():
    import io
    import json as _json
    import urllib.error
    seen = []

    def opener(req, timeout):
        seen.append(req.full_url)
        if len(seen) < 3:
            raise urllib.error.HTTPError(req.full_url, 403, "forbidden", {}, None)
        return io.BytesIO(_json.dumps({"result": "0x10"}).encode())

    call = r.http_rpc(sleep=lambda _s: None, opener=opener)
    assert call("eth_blockNumber", []) == "0x10"
    assert len(set(seen)) == 3


def test_http_rpc_gives_up_after_bounded_rotation():
    import urllib.error

    def opener(req, timeout):
        raise urllib.error.HTTPError(req.full_url, 429, "slow down", {}, None)

    call = r.http_rpc(sleep=lambda _s: None, opener=opener)
    with pytest.raises(r.RevenueError):
        call("eth_blockNumber", [])


def test_http_rpc_rotates_on_server_errors_and_retryable_rpc_errors():
    import io
    import json as _json
    import urllib.error
    calls = []

    def opener(req, timeout):
        calls.append(req.full_url)
        if len(calls) == 1:
            raise urllib.error.HTTPError(req.full_url, 500, "boom", {}, None)
        if len(calls) == 2:
            return io.BytesIO(_json.dumps({"error": {"message": "exceed maximum block range: 50000"}}).encode())
        return io.BytesIO(_json.dumps({"result": []}).encode())

    call = r.http_rpc(sleep=lambda _s: None, opener=opener)
    assert call("eth_getLogs", [{}]) == []
    assert len(calls) == 3


def test_http_rpc_does_not_retry_real_rpc_errors():
    import io
    import json as _json

    def opener(req, timeout):
        return io.BytesIO(_json.dumps({"error": {"message": "invalid argument 0"}}).encode())

    call = r.http_rpc(sleep=lambda _s: None, opener=opener)
    with pytest.raises(r.RevenueError):
        call("eth_getLogs", [{}])
