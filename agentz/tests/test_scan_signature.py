"""/scan signature check: protocol/verifier.mjs decides the signature, and it
only counts for a trusted signing key on a record about this product."""

from __future__ import annotations

import asyncio
import copy
import json
import shutil
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import agentz.api.main as api
from agentz.core import signature as sig
from agentz.tests.test_scan_redeem_auth import SECRET, _secret, _supabase

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="needs node")

REPO = Path(__file__).resolve().parents[2]
FIXTURES = REPO / "protocol" / "conformance" / "fixtures"
VALID = json.loads((FIXTURES / "valid-unanchored.json").read_text())["record"]
ISSUER = VALID["issuer"]
SUBJECT = VALID["credentialSubject"]["id"]

# Signed by the fixture IMPOSTOR key (seed ...02) naming itself in
# verificationMethod, while `issuer` claims the trusted ISSUER.
FORGE = r"""
import { createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { signingBytes } from './protocol/verifier.mjs';
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const b58 = (buf) => { let n = BigInt('0x' + buf.toString('hex')), o = '';
  while (n > 0n) { o = B58[Number(n % 58n)] + o; n /= 58n; } return o; };
const key = createPrivateKey({ key: Buffer.concat([
  Buffer.from('302e020100300506032b657004220420', 'hex'),
  Buffer.from('00'.repeat(31) + '02', 'hex')]), format: 'der', type: 'pkcs8' });
const raw = createPublicKey(key).export({ format: 'der', type: 'spki' }).subarray(-32);
const did = 'did:key:z' + b58(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
const rec = JSON.parse(process.argv[1]);
rec.proof.verificationMethod = did + '#key-1';
rec.proof.proofValue = 'z' + b58(sign(null, signingBytes(rec), key));
process.stdout.write(JSON.stringify(rec));
"""


@pytest.fixture
def trusted(monkeypatch):
    monkeypatch.setenv("AGENTZ_TRUSTED_ISSUERS", ISSUER)


def check(record, subject=SUBJECT, anchor=None):
    return asyncio.run(sig.check_scan_signature(record, anchor, subject))


def test_valid_record_from_trusted_issuer_about_this_product(trusted):
    res = check(VALID)
    assert res["signature_valid"] is True
    assert res["verdict"] == "valid-unanchored"


def test_tampered_record_is_invalid(trusted):
    rec = copy.deepcopy(VALID)
    rec["credentialSubject"]["serial"] = "OTHER"
    res = check(rec)
    assert res["signature_valid"] is False
    assert "signature_invalid" in res["reason"]


def test_untrusted_issuer_is_invalid(monkeypatch):
    monkeypatch.setenv("AGENTZ_TRUSTED_ISSUERS", "did:key:z6MkSomeoneElse")
    assert check(VALID)["reason"] == "issuer_not_trusted"


def test_trusted_issuer_name_signed_by_another_key_is_invalid(trusted):
    forged = json.loads(
        subprocess.run(
            ["node", "--input-type=module", "-e", FORGE, json.dumps(VALID)],
            cwd=REPO, capture_output=True, text=True, check=True,
        ).stdout
    )
    # The verifier alone accepts it: the signature matches verificationMethod.
    raw = asyncio.run(sig.run_verifier(forged, None))
    assert raw["checks"]["signature"] is True
    res = check(forged)
    assert res["signature_valid"] is False
    assert res["reason"] == "issuer_not_trusted"


def test_record_for_another_product_is_invalid(trusted):
    res = check(VALID, subject="https://id.gs1.org/01/09506000134352/21/OTHER")
    assert res == {**res, "signature_valid": False, "reason": "subject_mismatch"}


@pytest.mark.parametrize(
    "record,subject,reason",
    [(None, SUBJECT, "no_record"), (VALID, None, "product_has_no_subject_id")],
)
def test_incomplete_inputs_are_not_checked(trusted, record, subject, reason):
    assert check(record, subject) == {**check(record, subject), "signature_valid": None, "reason": reason}


def test_no_trusted_issuers_is_not_checked(monkeypatch):
    monkeypatch.delenv("AGENTZ_TRUSTED_ISSUERS", raising=False)
    assert check(VALID)["reason"] == "no_trusted_issuers"
    assert check(VALID)["signature_valid"] is None


def test_missing_node_is_not_checked(trusted, monkeypatch):
    monkeypatch.setenv("AGENTZ_NODE_BIN", "/nonexistent/node")
    res = check(VALID)
    assert res["signature_valid"] is None
    assert res["reason"] == "verifier_unavailable"


def _scan(record, subject_id):
    sb = _supabase(
        product={
            "qron_id": 7,
            "metadata": {"target_market": "US", "subject_id": subject_id},
            "authenticity_score": 100.0,
        }
    )
    api.app.dependency_overrides[api.get_supabase] = lambda: sb
    try:
        with _secret(SECRET):
            return TestClient(api.app).post(
                "/scan",
                json={"product_id": "prod-1", "wallet": "0xabc", "record": record},
                headers={"Authorization": f"Bearer {SECRET}"},
            )
    finally:
        api.app.dependency_overrides.clear()


def test_scan_route_verifies_a_signed_record(trusted, monkeypatch):
    monkeypatch.setattr("agentz.core.media.generate_story_mode", _async(None))
    body = _scan(VALID, SUBJECT).json()
    assert body["checks"]["signature"] == "valid"
    assert body["checks"]["signature_reason"] == "ok"
    assert body["verified"] is True


def test_scan_route_without_record_stays_unverified(trusted, monkeypatch):
    monkeypatch.setattr("agentz.core.media.generate_story_mode", _async(None))
    body = _scan(None, SUBJECT).json()
    assert body["checks"]["signature"] == "not_checked"
    assert body["verified"] is False
    assert body["reward"] is None


def _async(value):
    async def f(*a, **k):
        return value
    return f
