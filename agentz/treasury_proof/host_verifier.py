"""Independent local readback of protected image, root observer, challenge and EIP-191.

This is a read-only auditor, not a signer or an HTTP bridge. Run on the real
Linux host under a trusted root verifier account. Do not accept process fields
copied from signed JSON: Docker and /proc are queried independently again.
An unpublished build receipt alone is never deployment or signer proof.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import stat
import subprocess

from .host_observer import (HostHold, capture, digest, observe_live,
                            protected_receipt, require)
from .signer import PURPOSE, SERVICE_ID, CHAIN_ID

WALLET = re.compile(r"0x[a-fA-F0-9]{40}\Z")
NONCE = re.compile(r"0x[a-fA-F0-9]{64}\Z")
CHALLENGE_KEYS = {"nonce", "expires_at", "expected_wallet", "purpose", "issued_at"}
MESSAGE_LINES = (
    "AuthiChain AgentZ Treasury Ownership Proof v1",
    "purpose: {purpose}",
    "chain_id: {chain_id}",
    "wallet: {wallet}",
    "nonce: {nonce}",
    "expires_at: {expires_at}",
    "signer_service: {service}",
    "signer_uid: {uid}",
    "signer_pid: {pid}",
    "host_observation_id: {oid}",
    "host_observation_sha256: {ohash}",
    "authority: ownership-proof-only; no transaction or delegation",
)

def _read_owned(path: Path, file_uid: int, file_gid: int | None,
                file_mode: int, directory_uid: int, directory_gid: int | None,
                directory_mode: int, maximum: int) -> bytes:
    directory = path.parent.lstat()
    require(stat.S_ISDIR(directory.st_mode) and directory.st_uid == directory_uid and
            stat.S_IMODE(directory.st_mode) == directory_mode and
            (directory_gid is None or directory.st_gid == directory_gid),
            "untrusted evidence parent directory")
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        meta = os.fstat(fd)
        require(stat.S_ISREG(meta.st_mode) and meta.st_uid == file_uid and
                stat.S_IMODE(meta.st_mode) == file_mode and meta.st_nlink == 1 and
                (file_gid is None or meta.st_gid == file_gid) and
                meta.st_size <= maximum, "untrusted evidence file")
        value = os.read(fd, maximum + 1)
        require(len(value) <= maximum, "evidence file oversized")
        return value
    finally:
        os.close(fd)

def issue_challenge(wallet: str, out_dir: Path) -> dict:
    """Root-only independent one-time challenge; do not take nonce from signer."""
    require(os.geteuid() == 0 and bool(WALLET.fullmatch(wallet)),
            "root and explicit expected wallet required")
    directory = out_dir.lstat()
    require(stat.S_ISDIR(directory.st_mode) and directory.st_uid == 0 and
            stat.S_IMODE(directory.st_mode) == 0o700, "challenge directory must be root 0700")
    now = datetime.now(timezone.utc)
    value = {"nonce": "0x" + secrets.token_hex(32),
             "expires_at": (now + timedelta(seconds=180)).strftime("%Y-%m-%dT%H:%M:%SZ"),
             "issued_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
             "expected_wallet": wallet.lower(), "purpose": PURPOSE}
    file = out_dir / "challenge.json"
    # Never replace an existing challenge: avoid accidental replay or downgrade.
    fd = os.open(file, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600)
    try:
        os.write(fd, json.dumps(value, sort_keys=True).encode())
        os.fsync(fd)
    finally:
        os.close(fd)
    return {"status": "CHALLENGE_CREATED_NOT_SIGNED", "path": str(file),
            "expires_at": value["expires_at"], "spend_authorized": False}

def verify(archive: Path, release_json: Path, pinned_github_receipt_digest: str,
           observation_path: Path, observer_gid: int, challenge_path: Path,
           proof_path: Path, expected_wallet: str, signer_unit: str) -> dict:
    require(os.geteuid() == 0, "trusted root verifier required")
    require(bool(WALLET.fullmatch(expected_wallet)), "invalid externally authorized wallet")
    require(bool(re.fullmatch(r"[a-zA-Z0-9_.@-]+\.service", signer_unit)),
            "explicit reviewed signer systemd service required")
    evidence = protected_receipt(archive, release_json, pinned_github_receipt_digest)
    live = observe_live(evidence)
    receipt_raw = _read_owned(observation_path, 0, observer_gid, 0o640,
                              0, observer_gid, 0o750, 16384)
    receipt = json.loads(receipt_raw)
    require(isinstance(receipt, dict) and set(receipt) ==
            {"observation_id", "observed_at", "host_process", "provenance"},
            "invalid root observer receipt schema")
    timestamp = datetime.strptime(receipt["observed_at"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    require(0 <= (datetime.now(timezone.utc) - timestamp).total_seconds() <= 300,
            "root observation stale or from future")
    require(receipt["host_process"] == live, "root observation differs from fresh host process")
    require(receipt["provenance"] == {"source_sha": evidence["source_sha"],
            "artifact_sha256": evidence["sha256"]}, "observation lacks protected archive match")
    challenge = json.loads(_read_owned(challenge_path, 0, None, 0o600,
                                       0, None, 0o700, 4096))
    require(isinstance(challenge, dict) and set(challenge) == CHALLENGE_KEYS,
            "invalid independently issued challenge")
    require(bool(NONCE.fullmatch(challenge["nonce"])) and challenge["purpose"] == PURPOSE and
            challenge["expected_wallet"] == expected_wallet.lower(),
            "wrong wallet or challenge domain")
    now = datetime.now(timezone.utc)
    issued = datetime.strptime(challenge["issued_at"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    expiry = datetime.strptime(challenge["expires_at"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    require(issued <= now < expiry <= issued + timedelta(seconds=300),
            "independent challenge expired, future, or oversized")
    proof = json.loads(proof_path.read_bytes())
    require(isinstance(proof, dict) and proof.get("purpose") == PURPOSE and
            proof.get("service") == SERVICE_ID and proof.get("authority") == "ownership-proof-only" and
            proof.get("chain_id") == CHAIN_ID and
            proof.get("host_observation_independently_verified") is False and
            proof.get("wallet", "").lower() == expected_wallet.lower(),
            "proof exceeds ownership-only authority or mismatches service")
    require(proof.get("host_observation_id") == receipt["observation_id"] and
            proof.get("host_observation_sha256") == hashlib.sha256(receipt_raw).hexdigest(),
            "signature does not bind trusted host receipt")
    pid, uid = proof.get("signer_pid"), proof.get("signer_uid")
    require(type(pid) is int and pid > 1 and type(uid) is int and uid > 0,
            "signer process identity invalid")
    # Corroborate the signer PID/UID against kernel and the approved service.
    require(Path(f"/proc/{pid}").stat().st_uid == uid,
            "signer kernel UID does not match signed identity")
    command = Path(f"/proc/{pid}/cmdline").read_bytes().replace(b"\x00", b" ")
    require(b"agentz.treasury_proof.signer" in command, "PID not executing ownership signer")
    try:
        proc = subprocess.run(["systemctl", "show", signer_unit,
                               "--property=MainPID,ActiveState,User"],
                              capture_output=True, text=True, timeout=5, check=True)
        properties = dict(line.split("=", 1) for line in proc.stdout.splitlines() if "=" in line)
    except (OSError, subprocess.SubprocessError) as exc:
        raise HostHold("trusted systemd signer identity unavailable") from exc
    require(properties.get("ActiveState") == "active" and
            properties.get("MainPID") == str(pid) and
            properties.get("User") not in ("", "root", "0"),
            "signer process not independently tied to approved active service")
    # Require the deterministic exact EIP-191 message, no unsigned extra claims.
    expected = "\n".join(line.format(
        purpose=PURPOSE, chain_id=CHAIN_ID, wallet=expected_wallet.lower(),
        nonce=challenge["nonce"].lower(), expires_at=challenge["expires_at"],
        service=SERVICE_ID, uid=uid, pid=pid, oid=receipt["observation_id"],
        ohash=hashlib.sha256(receipt_raw).hexdigest()) for line in MESSAGE_LINES) + "\n"
    require(proof.get("message") == expected, "signed message differs from trusted challenge/host")
    try:
        from eth_account import Account
        from eth_account.messages import encode_defunct
        recovered = Account.recover_message(encode_defunct(text=expected), signature=proof["signature"])
    except (ImportError, ValueError, KeyError, TypeError) as exc:
        raise HostHold("Ethereum-standard EIP-191 recovery failed or unavailable") from exc
    require(recovered.lower() == expected_wallet.lower(), "wrong recovered EIP-191 wallet")
    return {"status": "INDEPENDENT_HOST_AND_EIP191_OWNERSHIP_PROOF_MATCH",
            "host_pid": live["pid"], "signer_pid": pid,
            "source_sha": evidence["source_sha"], "image_id": live["image_id"],
            "archive_sha256": evidence["sha256"], "ownership_proof_only": True,
            "transaction_signing_authorized": False, "spend_authorized": False,
            "production_activation_authorized": False}

def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--issue-challenge", action="store_true")
    p.add_argument("--challenge-directory", type=Path)
    p.add_argument("--wallet", required=True)
    for name in ("archive", "release-json", "observation", "challenge", "proof"):
        p.add_argument("--" + name, type=Path)
    p.add_argument("--github-receipt-sha256")
    p.add_argument("--observer-gid", type=int)
    p.add_argument("--signer-unit")
    args = p.parse_args()
    try:
        if args.issue_challenge:
            require(args.challenge_directory is not None, "challenge directory required")
            result = issue_challenge(args.wallet, args.challenge_directory)
        else:
            require(all((args.archive, args.release_json, args.observation, args.challenge,
                         args.proof, args.github_receipt_sha256,
                         args.observer_gid is not None, args.signer_unit)),
                    "missing explicit independent evidence inputs")
            result = verify(args.archive, args.release_json, args.github_receipt_sha256,
                            args.observation, args.observer_gid, args.challenge,
                            args.proof, args.wallet, args.signer_unit)
        print(json.dumps(result, sort_keys=True))
    except (HostHold, OSError, ValueError, KeyError, TypeError, IndexError) as exc:
        print(json.dumps({"status": "HOLD", "reason": str(exc)}))
        raise SystemExit(1)

if __name__ == "__main__":
    main()
