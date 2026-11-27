"""AgentZ notary: signed SHA-256 records and OpenTimestamps proofs (operator endpoint)."""
import base64
import hashlib
import http.client
import io
import json
from unittest.mock import patch

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient

import agentz.api.main as api
from agentz.core import identity, notary

DIGEST_HEX = hashlib.sha256(b"example file").hexdigest()
# Real pending timestamps returned by the three public calendars on 2026-11-26
# (each parsed by the official opentimestamps library before being copied here).
REAL_CALENDAR_TS = [bytes.fromhex(h) for h in (
    "f008b7e2899f699ef0d508f1209aaeff9f79fc4ca5f07ae425489a2fe5279008c7ae86023f438059608992faf408f120bc08f52c1a034f69108479c88832bf9c947f80745b5c932b0851bd63d2f75b5608f0104e93dfa750cce08e0470b917f07453cf08f12049dd8f5034a6aeb64689bc419c6ee0947bbc915bc5ab94e3478ef65230b03bd608f1046b0849cff00865341bce42f2cfd80083dfe30d2ef90c8e2e2d68747470733a2f2f616c6963652e6274632e63616c656e6461722e6f70656e74696d657374616d70732e6f7267",
    "f008b2e927d328ca53ef08f120089107fda1075c4e0d29a1c12ea7f176a83a9d1442f8020559c30f724d17967008f010448486d37accc6aaaf60a8855b7c5be308f0209d5ce0665ca2b6e3d21e169959ef1c5f1d21ff24f5e02d06ac439e5ae8397d3e08f120fdaa67d3c9143b1549cd61a643feb049bf32f48928d54caefa2043ec0d134cd508f1209331c76c00505d8ef1a327f6b8331d0c3e00996e81018abb4447d5d22f9866a408f1046b0849d0f00863f0a44a77bc00ae0083dfe30d2ef90c8e2c2b68747470733a2f2f626f622e6274632e63616c656e6461722e6f70656e74696d657374616d70732e6f7267",
    "f01064ff3fc1e7e21f411f4c7dc14a41c5af08f020e8478210ea9ece6d28941e87aa24c746ee26af51021b17b96e60ff3ab83504df08f0204d68b3cc26166072cb0fd73e60b84d94ea11d60d8d0aef05f525af25c7f3a90f08f020d174270383b5225099e7158c1ed3d242e0f7941022dfef702320b518bcd60d5008f0200f3fc3e650e8ad45203b27773dc926d20d7720fc8a66ed0c6b79853f6f2d40e008f020c4c2fc7002c2d46b8e71956d857aae1d138647187674372cb647e529b614dadf08f1046b0849d2f0088565829dcfa2dcea0083dfe30d2ef90c8e292868747470733a2f2f66696e6e65792e63616c656e6461722e657465726e69747977616c6c2e636f6d",
)]
CAL_TS = REAL_CALENDAR_TS[0]


def _pem(key):
    return key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                             serialization.NoEncryption())


@pytest.fixture
def key():
    k = Ed25519PrivateKey.generate()
    return k, _pem(k), identity.did_key_from_pem(_pem(k))


class _Res(io.BytesIO):
    def __init__(self, body, status=200):
        super().__init__(body)
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def opener(responses):
    """Fake urlopen: calendar URL prefix -> bytes body, or an exception to raise."""
    calls = []

    def _open(req, timeout=10):
        calls.append(req.full_url)
        for prefix, value in responses.items():
            if req.full_url.startswith(prefix):
                if isinstance(value, Exception):
                    raise value
                return _Res(value)
        raise OSError("unexpected url")
    _open.calls = calls
    return _open


def test_ots_file_layout():
    raw = notary.ots_file(bytes.fromhex(DIGEST_HEX), CAL_TS)
    assert raw.startswith(notary.OTS_MAGIC + b"\x01\x08")
    assert raw[len(notary.OTS_MAGIC) + 2:len(notary.OTS_MAGIC) + 34].hex() == DIGEST_HEX
    with pytest.raises(ValueError):
        notary.ots_file(b"short", CAL_TS)


def test_validator_accepts_real_calendar_timestamps_and_refuses_everything_else():
    for ts in REAL_CALENDAR_TS:
        assert notary.valid_calendar_timestamp(ts)
    pending_http = b"\x08\x00" + bytes.fromhex("83dfe30d2ef90c8e") + b"\x13\x12http://example.com/"
    for bad in (b"", b"<!DOCTYPE html><html><body>Service Unavailable</body></html>",
                CAL_TS[:-1], CAL_TS + b"\x00", b"\x08", b"\x99" + CAL_TS[1:], pending_http,
                b"\xf0\x00\x08" + CAL_TS[-50:]):
        assert not notary.valid_calendar_timestamp(bad), bad[:20]


def test_an_error_page_answered_with_200_is_a_refusal_not_a_proof():
    res = notary.submit(bytes.fromhex(DIGEST_HEX), ["https://a.example"],
                        opener=opener({"https://a.": b"<!DOCTYPE html><html>Service Unavailable</html>"}))
    assert res == [{"calendar": "https://a.example", "accepted": False, "error": "invalid_timestamp"}]


def test_a_truncated_response_is_a_refusal_and_the_other_calendars_still_run():
    class Truncated(_Res):
        def read(self, *a):
            raise http.client.IncompleteRead(b"\xf0\x10", 64)

    calls = []

    def _open(req, timeout=10):
        calls.append(req.full_url)
        return Truncated(b"") if "a.example" in req.full_url else _Res(CAL_TS)

    res = notary.submit(bytes.fromhex(DIGEST_HEX), ["https://a.example", "https://b.example"], opener=_open)
    assert [(r["calendar"], r["accepted"]) for r in res] == [("https://a.example", False), ("https://b.example", True)]
    assert res[0]["error"] == "IncompleteRead" and len(calls) == 2


def test_submit_keeps_accepted_proofs_and_reports_refusals():
    o = opener({"https://a.": CAL_TS, "https://b.": OSError("down"),
                "https://finney.": b"x" * (notary.MAX_CALENDAR_RESPONSE + 1)})
    res = notary.submit(bytes.fromhex(DIGEST_HEX), opener=o)
    assert [r["accepted"] for r in res] == [True, False, False]
    proof = base64.b64decode(res[0]["ots_base64"])
    assert res[0]["ots_sha256"] == hashlib.sha256(proof).hexdigest()
    assert all(url.endswith("/digest") for url in o.calls)


def test_notarize_signs_a_record_that_binds_each_proof(key):
    k, pem, did = key
    out = notary.notarize(DIGEST_HEX.upper(), key_pem=pem, expected_did_key=did,
                          opener=opener({"https://": CAL_TS}))
    rec = out["record"]
    assert rec["sha256"] == DIGEST_HEX and rec["issuer"] == notary.ISSUER and rec["did_key"] == did
    assert [a["ots_sha256"] for a in rec["anchors"]] == [p["ots_sha256"] for p in out["proofs"]]
    head, body, sig = out["jws"].split(".")
    pad = lambda s: s + "=" * (-len(s) % 4)
    assert json.loads(base64.urlsafe_b64decode(pad(head))) == {"alg": "EdDSA", "kid": notary.KID, "typ": "agentz-notary+jws"}
    assert json.loads(base64.urlsafe_b64decode(pad(body))) == rec
    k.public_key().verify(base64.urlsafe_b64decode(pad(sig)), f"{head}.{body}".encode())


def test_refuses_a_key_that_is_not_the_published_identity_before_any_network_call(key):
    _, pem, _ = key
    o = opener({"https://": CAL_TS})
    with pytest.raises(PermissionError):
        notary.notarize(DIGEST_HEX, key_pem=pem, opener=o)  # expected = published DID_KEY
    assert o.calls == []


def test_input_and_calendar_failures(key):
    _, pem, did = key
    with pytest.raises(ValueError):
        notary.notarize("not-a-hash", key_pem=pem, expected_did_key=did, opener=opener({}))
    with pytest.raises(RuntimeError, match="no_calendar_accepted"):
        notary.notarize(DIGEST_HEX, key_pem=pem, expected_did_key=did,
                        opener=opener({"https://": OSError("all down")}))


# ------------------------------------------------------------------ API

@pytest.fixture
def client():
    return TestClient(api.app)


def test_operator_stamp_requires_the_agent_token(client):
    with patch.object(api, "get", lambda key, *a, **k: "s3cret" if key == "agent_secret" else None):
        assert client.post("/agentz/notary", json={"sha256": DIGEST_HEX}).status_code == 401
        with patch("agentz.core.notary.notarize", return_value={"record": {"sha256": DIGEST_HEX}}):
            ok = client.post("/agentz/notary", json={"sha256": DIGEST_HEX},
                             headers={"Authorization": "Bearer s3cret"})
    assert ok.status_code == 200 and ok.json()["record"]["sha256"] == DIGEST_HEX
