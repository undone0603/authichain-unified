"""Fail-closed security regressions for ownership signer and host-attestation boundary.

All host and Docker evidence in these tests is synthetic. A passing fixture
must never be reported as live deployment evidence. The privileged socket
test in test_treasury_signer_review.py must run under isolated Docker sudo.
"""
from __future__ import annotations
from collections import deque
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import socket
import struct
import subprocess
import time
from types import SimpleNamespace

from cryptography.hazmat.primitives.asymmetric import ec
from eth_account import Account
from eth_account.messages import encode_defunct
import pytest

from agentz.treasury_proof import signer, host_observer, host_verifier


def _now(offset=0):
    return (datetime.now(timezone.utc) + timedelta(seconds=offset)).strftime("%Y-%m-%dT%H:%M:%SZ")


def test_real_standard_ethereum_eip191_library_interoperability():
    # Disposable secp256k1 key: recover signed message via eth-account, not custom EC math.
    for _ in range(3):
        private_key = ec.generate_private_key(ec.SECP256K1())
        wallet = signer.account_address(private_key)
        message = "AuthiChain ownership-only proof: " + os.urandom(32).hex()
        actual = signer.eip191_sign(private_key, message)
        assert Account.recover_message(encode_defunct(text=message), signature=actual).lower() == wallet
        assert Account.recover_message(encode_defunct(text=message+"tampered"), signature=actual).lower() != wallet
        # Common Ethereum library signs the same EIP-191 format.
        bytes_key = private_key.private_numbers().private_value.to_bytes(32,"big")
        other = Account.sign_message(encode_defunct(text=message), private_key=bytes_key)
        assert Account.recover_message(encode_defunct(text=message), signature=other.signature).lower() == wallet


def test_protected_build_receipt_refuses_tamper_and_wrong_pin(tmp_path):
    archive = tmp_path / "agentz-linux-arm64.tar.gz"
    archive.write_bytes(b"disposable-test-image")
    data = {"repository": host_observer.REPO, "platform": "linux/arm64",
            "source_sha": "a"*40, "image_id": "sha256:"+"b"*64,
            "sha256": host_observer.digest(archive), "run_id": "123",
            "filename": archive.name}
    receipt = tmp_path / "release.json"
    receipt.write_text(json.dumps(data))
    pin = host_observer.digest(receipt)
    assert host_observer.protected_receipt(archive, receipt, pin) == data
    with pytest.raises(host_observer.HostHold):
        host_observer.protected_receipt(archive, receipt, "0"*64)
    archive.write_bytes(b"tampered")
    with pytest.raises(host_observer.HostHold):
        host_observer.protected_receipt(archive, receipt, pin)


def test_forged_or_stale_host_receipt_refused_before_any_signature(monkeypatch, tmp_path):
    import agentz.treasury_proof.host_verifier as auditor
    monkeypatch.setattr(auditor.os, "geteuid", lambda: 0)
    release = {"source_sha":"a"*40,"sha256":"b"*64,"image_id":"sha256:"+"c"*64}
    live = {"pid": 1234, "start_time_utc": _now(-60),
            "image_id":release["image_id"],"health_status":"healthy"}
    monkeypatch.setattr(auditor, "protected_receipt", lambda *a: release)
    monkeypatch.setattr(auditor, "observe_live", lambda _: live)
    observed = {"observation_id":"host-synthetic-12345", "observed_at":_now(-600),
                "host_process":live,
                "provenance":{"source_sha":release["source_sha"],"artifact_sha256":release["sha256"]}}
    monkeypatch.setattr(auditor, "_read_owned", lambda *a: json.dumps(observed).encode())
    args = (tmp_path/"archive", tmp_path/"release", "a"*64, tmp_path/"obs", 63010,
            tmp_path/"challenge", tmp_path/"proof", "0x"+"a"*40, "authichain-ownership.service")
    with pytest.raises(host_observer.HostHold, match="stale"):
        auditor.verify(*args)
    observed["observed_at"] = _now()
    observed["host_process"] = {**live, "pid": 99999}
    with pytest.raises(host_observer.HostHold, match="differs"):
        auditor.verify(*args)
    observed["host_process"] = live
    observed["provenance"]["artifact_sha256"] = "f"*64
    with pytest.raises(host_observer.HostHold, match="protected archive"):
        auditor.verify(*args)


def test_wrong_wallet_and_service_identity_are_refused_with_valid_fixture(monkeypatch, tmp_path):
    import agentz.treasury_proof.host_verifier as auditor
    monkeypatch.setattr(auditor.os, "geteuid", lambda: 0)
    release = {"source_sha":"a"*40,"sha256":"b"*64,"image_id":"sha256:"+"c"*64}
    live = {"pid": 1234, "start_time_utc": _now(-60),
            "image_id":release["image_id"],"health_status":"healthy"}
    monkeypatch.setattr(auditor, "protected_receipt", lambda *a: release)
    monkeypatch.setattr(auditor, "observe_live", lambda _: live)
    observed = {"observation_id":"host-synthetic-12345", "observed_at":_now(),
                "host_process":live, "provenance":{"source_sha":release["source_sha"],
                                                  "artifact_sha256":release["sha256"]}}
    nonce = "0x"+"d"*64
    right_key = Account.create()
    wrong_key = Account.create()
    wallet = right_key.address.lower()
    challenge = {"nonce":nonce,"purpose":signer.PURPOSE,
                 "expires_at":_now(160), "issued_at":_now(-20),
                 "expected_wallet":wallet}
    receipt_bytes = json.dumps(observed).encode()
    mock_reads = lambda path,*args: receipt_bytes if path.name == "obs" else json.dumps(challenge).encode()
    monkeypatch.setattr(auditor, "_read_owned", mock_reads)
    uid, pid = 61041, 61042
    expected = "\n".join(line.format(purpose=signer.PURPOSE,chain_id=signer.CHAIN_ID,
                        wallet=wallet,nonce=nonce,expires_at=challenge["expires_at"],
                        service=signer.SERVICE_ID,uid=uid,pid=pid,
                        oid=observed["observation_id"],ohash=hashlib.sha256(receipt_bytes).hexdigest())
                        for line in auditor.MESSAGE_LINES) + "\n"
    proof = {"service":signer.SERVICE_ID,"purpose":signer.PURPOSE,"authority":"ownership-proof-only",
             "chain_id":signer.CHAIN_ID,"wallet":wallet, "signer_uid":uid,"signer_pid":pid,
             "host_observation_independently_verified":False,
             "host_observation_id":observed["observation_id"],
             "host_observation_sha256":hashlib.sha256(receipt_bytes).hexdigest(),
             "message":expected,
             "signature":Account.sign_message(encode_defunct(text=expected),
                                             private_key=wrong_key.key).signature.hex()}
    file = tmp_path/"proof"
    file.write_text(json.dumps(proof))
    original_stat = Path.stat
    original_bytes = Path.read_bytes
    monkeypatch.setattr(Path,"stat",lambda self,*a,**kw:
                        SimpleNamespace(st_uid=uid) if str(self)==f"/proc/{pid}" else original_stat(self,*a,**kw))
    monkeypatch.setattr(Path,"read_bytes",lambda self:
                        b"python -m agentz.treasury_proof.signer" if str(self)==f"/proc/{pid}/cmdline"
                        else original_bytes(self))
    monkeypatch.setattr(auditor.subprocess,"run",lambda *a,**kw:
                        SimpleNamespace(stdout=f"MainPID={pid}\nActiveState=active\nUser=authichain-signer\n"))
    args=(tmp_path/"archive",tmp_path/"release","a"*64,tmp_path/"obs",63010,
          tmp_path/"challenge",file,wallet,"authichain-ownership.service")
    with pytest.raises(host_observer.HostHold, match="recovered EIP-191 wallet"):
        auditor.verify(*args)
    # Genuine disposable wallet passes the mocked evidence checks.
    proof["signature"] = Account.sign_message(encode_defunct(text=expected),
                                              private_key=right_key.key).signature.hex()
    file.write_text(json.dumps(proof))
    assert auditor.verify(*args)["spend_authorized"] is False
    proof["service"] = "untrusted-service"
    file.write_text(json.dumps(proof))
    with pytest.raises(host_observer.HostHold, match="service"):
        auditor.verify(*args)


def test_nonce_db_disk_pressure_clock_rollback_and_retention(tmp_path, monkeypatch):
    d=tmp_path/"nonce"
    d.mkdir(mode=0o700)
    cfg=signer.Config(os.geteuid(),os.getegid(),63001,63002,"0x"+"a"*40,
                      d,d,d/"key",d/"used.sqlite",d,d/"receipt")
    monkeypatch.setattr(signer.shutil, "disk_usage", lambda _:SimpleNamespace(free=0))
    with pytest.raises(signer.ProofError,match="free space"):
        signer._use_nonce(cfg,"0x"+"a"*64,int(time.time())+30)
    monkeypatch.undo()
    now=int(time.time())
    signer._use_nonce(cfg,"0x"+"b"*64,now+120)
    with pytest.raises(signer.ProofError,match="replayed"):
        signer._use_nonce(cfg,"0x"+"b"*64,now+120)
    with pytest.MonkeyPatch.context() as m:
        m.setattr(signer.time,"time",lambda:now-100)
        with pytest.raises(signer.ProofError,match="clock"):
            signer._use_nonce(cfg,"0x"+"c"*64,now+120)


def test_socket_rate_limits_authorized_requests_and_denies_other_uid(monkeypatch,tmp_path):
    import agentz.treasury_proof.signer as target
    from collections import deque
    uid=61242
    cfg=signer.Config(61241,61245,uid,61246,"0x"+"a"*40,
                      tmp_path,tmp_path,tmp_path/"key",tmp_path/"db",tmp_path,tmp_path/"receipt")
    monkeypatch.setattr(target,"sign_proof",lambda *a:{"authority":"ownership-proof-only"})
    monkeypatch.setattr(target.time,"monotonic",lambda:100.0)
    class FakeSocket:
        def __init__(self,peer_uid): self.uid=peer_uid;self.output=b"";self.once=True
        def settimeout(self,_):pass
        def getsockopt(self,*args):return struct.pack("3i",777,self.uid,61245)
        def recv(self,n):
            if self.once:
                self.once=False
                return b'{"nonce":"sample"}\n'
            return b""
        def sendall(self,raw):self.output=raw
    history=deque()
    for _ in range(6):
        conn=FakeSocket(uid)
        target._client(conn,cfg,history)
        assert json.loads(conn.output)["ok"] is True
    rejected=FakeSocket(uid)
    target._client(rejected,cfg,history)
    assert json.loads(rejected.output)["ok"] is False
    untrusted=FakeSocket(uid+1)
    target._client(untrusted,cfg,deque())
    assert json.loads(untrusted.output)["ok"] is False
