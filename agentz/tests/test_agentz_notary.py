"""AgentZ notary: signed SHA-256 records, OpenTimestamps proofs, L402-gated sale."""
import base64
import hashlib
import io
import json
from unittest.mock import patch

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient

import agentz.api.main as api
from agentz.core import identity, l402, notary

DIGEST_HEX = hashlib.sha256(b"example file").hexdigest()
CAL_TS = b"\xf0\x10" + b"\x11" * 16 + b"\x08\xf1\x04abcd\x00\x83\xdf\xe3\x0d\x2e\xf9\x0c\x8e\x05\x04test"


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

L402_ENV = {"L402_ROOT_KEY": "b2" * 32, "L402_BACKEND": "test", "NODE_ENV": "test",
            "L402_BTC_USD_CENTS": "9000000"}


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


def test_paid_stamp_is_off_until_a_backend_exists(client, monkeypatch):
    for name in L402_ENV:
        monkeypatch.delenv(name, raising=False)
    res = client.post("/agentz/notary/paid", json={"sha256": DIGEST_HEX})
    assert res.status_code == 503 and res.json() == {"error": "l402_not_enabled", "rail": "lightning"}


def test_paid_stamp_round_trip_one_token_one_stamp(client, monkeypatch, tmp_path):
    for name, value in L402_ENV.items():
        monkeypatch.setenv(name, value)
    monkeypatch.setenv("AGENTZ_L402_CLAIMS_DIR", str(tmp_path / "claims"))
    unpaid = client.post("/agentz/notary/paid", json={"sha256": DIGEST_HEX})
    assert unpaid.status_code == 402 and unpaid.json()["sats"] == 56  # $0.05 at $90,000/BTC
    header = unpaid.headers["www-authenticate"]
    mac = header.split('macaroon="')[1].split('"')[0]
    payment_hash = header.split('invoice="')[1].split('"')[0].split(":")[-1]
    auth = f"L402 {mac}:{l402.test_backend().preimage_for(payment_hash)}"

    seen = {}

    def fake_notarize(sha, paid=None):
        seen.update(sha=sha, paid=paid)
        return {"record": {"sha256": sha, "paid": paid}}

    with patch("agentz.core.notary.notarize", side_effect=RuntimeError("no_calendar_accepted")):
        down = client.post("/agentz/notary/paid", json={"sha256": DIGEST_HEX}, headers={"Authorization": auth})
    assert down.status_code == 503 and down.json()["retry_with_same_token"] is True

    with patch("agentz.core.notary.notarize", side_effect=fake_notarize):
        paid = client.post("/agentz/notary/paid", json={"sha256": DIGEST_HEX}, headers={"Authorization": auth})
        again = client.post("/agentz/notary/paid", json={"sha256": DIGEST_HEX}, headers={"Authorization": auth})
    assert paid.status_code == 200
    assert seen["paid"] == {"rail": "lightning", "payment_hash": payment_hash, "amount_msat": "56000"}
    assert again.status_code == 409


def test_paid_stamp_refuses_a_signals_token(client, monkeypatch, tmp_path):
    for name, value in L402_ENV.items():
        monkeypatch.setenv(name, value)
    cfg = l402.config()
    ch = l402.challenge(cfg, service="signals", capability="ping", resource=api.NOTARY_PAID_RESOURCE,
                        price_atomic_usd=10_000)
    auth = f"L402 {ch['macaroon']}:{l402.test_backend().preimage_for(ch['payment_hash'])}"
    res = client.post("/agentz/notary/paid", json={"sha256": DIGEST_HEX}, headers={"Authorization": auth})
    assert res.status_code == 402 and res.json()["error"] == "l402_wrong_services"
    assert res.headers["www-authenticate"].startswith("L402 macaroon=")
