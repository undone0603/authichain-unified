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


def test_passport_scan_script_is_genuine_only_when_anchored():
    script = r"""
import { generateKeyPairSync, createHash } from 'node:crypto';
import { signPassport } from './protocol/passport.mjs';
import { signingBytes } from './protocol/verifier.mjs';
import { scanRecord } from './agentz/core/verify_record.mjs';
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const b58 = (buf) => { let n = BigInt('0x' + buf.toString('hex')), o = '';
  while (n > 0n) { o = B58[Number(n % 58n)] + o; n /= 58n; }
  for (const b of buf) { if (b !== 0) break; o = '1' + o; } return o; };
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
const issuer = 'did:key:z' + b58(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
const record = signPassport({ digitalIdentity: 'urn:authichain:item:example-1', privateKey, issuer });
const anchor = {
  recordHash: 'sha256:' + createHash('sha256').update(signingBytes(record)).digest('hex'),
  chain: 'polygon:137', txHash: '0x' + 'ab'.repeat(32), anchoredAt: '2026-01-01T00:05:00Z',
};
process.stdout.write(JSON.stringify({
  proved: scanRecord(record, anchor).genuine,
  open: scanRecord(record, null).genuine,
  gtin: record.credentialSubject.gtin ?? null,
}));
"""
    out = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=REPO, capture_output=True, text=True, check=True,
    )
    assert json.loads(out.stdout) == {"proved": True, "open": False, "gtin": None}


def test_unanchored_passport_is_not_a_genuine_scan(trusted, monkeypatch):
    rec = copy.deepcopy(VALID)
    rec["type"] = ["VerifiableCredential", "DigitalProductPassport"]

    async def fake(record, anchor):
        return {"genuine": False, "verdict": "valid-unanchored", "reasons": [], "digitalIdentity": SUBJECT}

    monkeypatch.setattr(sig, "run_verifier", fake)
    res = check(rec)
    assert res["signature_valid"] is False
    assert res["verdict"] == "valid-unanchored"


def test_genuine_passport_for_this_product_is_valid(trusted, monkeypatch):
    rec = copy.deepcopy(VALID)
    rec["type"] = ["VerifiableCredential", "DigitalProductPassport"]

    async def fake(record, anchor):
        return {"genuine": True, "verdict": "verified", "reasons": [], "digitalIdentity": SUBJECT}

    monkeypatch.setattr(sig, "run_verifier", fake)
    res = check(rec)
    assert res["signature_valid"] is True
    assert res["verdict"] == "verified"


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


def _passport(identity="urn:authichain:item:example-1"):
    rec = copy.deepcopy(VALID)
    rec["type"] = ["VerifiableCredential", "DigitalProductPassport"]
    rec["credentialSubject"] = {**rec["credentialSubject"], "id": identity}
    rec["credentialSubject"].pop("gtin", None)
    return rec


def test_stored_passport_is_the_scan_when_the_request_omits_a_record():
    passport = _passport()
    anchor = {"chain": "polygon:137", "txHash": "0x" + "ab" * 32}
    record, resolved_anchor, subject = sig.resolve_scan_inputs(
        None,
        None,
        {"story": "kept", "passport": {"record": passport, "anchor": anchor}},
    )
    assert record == passport
    assert resolved_anchor == anchor
    assert subject == "urn:authichain:item:example-1"
    assert record["credentialSubject"].get("gtin") is None
    assert sig.resolve_scan_inputs(None, None, {"status": "active"}) == (None, None, None)
    assert sig.resolve_scan_inputs(None, None, {"passport": {"record": VALID}})[0] is None


def test_submitted_record_does_not_supply_the_product_identity():
    stored = _passport("urn:authichain:item:stored")
    submitted = _passport("urn:authichain:item:other")
    record, anchor, subject = sig.resolve_scan_inputs(
        submitted,
        {"chain": "eip155:1"},
        {"passport": {"record": stored, "anchor": {"chain": "polygon:137"}}},
    )
    assert record is submitted
    assert anchor == {"chain": "eip155:1"}
    assert subject == "urn:authichain:item:stored"
    named, _, named_subject = sig.resolve_scan_inputs(
        submitted, None, {"subject_id": SUBJECT, "passport": {"record": stored}}
    )
    assert named is submitted
    assert named_subject == SUBJECT


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
    assert "digitalIdentity" not in body


def _scan_metadata(metadata, body):
    sb = _supabase(
        product={
            "qron_id": 7,
            "metadata": metadata,
            "authenticity_score": 100.0,
        }
    )
    api.app.dependency_overrides[api.get_supabase] = lambda: sb
    try:
        with _secret(SECRET):
            return TestClient(api.app).post(
                "/scan",
                json={"product_id": "prod-1", "wallet": "0xabc", **body},
                headers={"Authorization": f"Bearer {SECRET}"},
            )
    finally:
        api.app.dependency_overrides.clear()


def test_scan_route_uses_stored_passport_for_this_identity(trusted, monkeypatch):
    passport = _passport()
    seen = {}

    async def fake(record, anchor):
        seen["id"] = record["credentialSubject"]["id"]
        seen["anchor"] = anchor
        return {
            "genuine": True,
            "verdict": "verified",
            "reasons": [],
            "digitalIdentity": record["credentialSubject"]["id"],
        }

    monkeypatch.setattr(sig, "run_verifier", fake)
    monkeypatch.setattr("agentz.core.media.generate_story_mode", _async(None))
    response = _scan_metadata(
        {
            "target_market": "US",
            "passport": {
                "record": passport,
                "anchor": {"chain": "polygon:137", "txHash": "0x" + "ab" * 32},
            },
        },
        {},
    )
    body = response.json()
    assert response.status_code == 200
    assert seen["id"] == "urn:authichain:item:example-1"
    assert seen["anchor"]["chain"] == "polygon:137"
    assert body["checks"]["signature"] == "valid"
    assert body["checks"]["signature_reason"] == "ok"
    assert body["verified"] is True
    assert body["digitalIdentity"] == "urn:authichain:item:example-1"
    assert body["reward"]["simulated"] is True
    assert body["reward"]["token"] == "QRON"


def test_unanchored_stored_passport_stays_unverified(trusted, monkeypatch):
    passport = _passport()

    async def fake(record, anchor):
        return {
            "genuine": False,
            "verdict": "valid-unanchored",
            "reasons": [],
            "digitalIdentity": record["credentialSubject"]["id"],
        }

    monkeypatch.setattr(sig, "run_verifier", fake)
    monkeypatch.setattr("agentz.core.media.generate_story_mode", _async(None))
    body = _scan_metadata(
        {"target_market": "US", "passport": {"record": passport}},
        {},
    ).json()
    assert body["checks"]["signature"] == "invalid"
    assert body["verified"] is False
    assert body["reward"] is None
    assert body["digitalIdentity"] == "urn:authichain:item:example-1"


def test_active_product_without_a_passport_is_not_genuine(trusted, monkeypatch):
    monkeypatch.setattr("agentz.core.media.generate_story_mode", _async(None))
    body = _scan_metadata(
        {"target_market": "US", "status": "active"},
        {},
    ).json()
    assert body["checks"]["signature"] == "not_checked"
    assert body["verified"] is False
    assert body["reward"] is None
    assert "digitalIdentity" not in body


def test_submitted_record_must_match_the_stored_identity(trusted, monkeypatch):
    monkeypatch.setattr("agentz.core.media.generate_story_mode", _async(None))
    body = _scan_metadata(
        {
            "target_market": "US",
            "passport": {"record": _passport("urn:authichain:item:stored")},
        },
        {"record": VALID},
    ).json()
    assert body["checks"]["signature"] == "invalid"
    assert body["checks"]["signature_reason"] == "subject_mismatch"
    assert body["verified"] is False
    assert body["reward"] is None


def _async(value):
    async def f(*a, **k):
        return value
    return f
