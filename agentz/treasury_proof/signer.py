"""A local-only, identity-limited EIP-191 proof signer (never signs transactions).

Linux SO_PEERCRED authenticates the operator UID. Socket filesystem access is
controlled independently by a narrow Unix group. Keys and used nonces live in
a signer-UID-only directory. A separately privileged host observer creates a
root-owned receipt, whose exact bytes are bound into the signed message.

This code MUST NOT be imported by or exposed through AgentZ's HTTP API.
"""
from __future__ import annotations

import argparse
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import shutil
import socket
import sqlite3
import stat
import struct
import subprocess
import time

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec, utils

SERVICE_ID = "authichain.agentz.ownership-signer.v1"
PURPOSE = "wallet-ownership-only"
CHAIN_ID = 8453
CURVE_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
NONCE_RE = re.compile(r"0x[0-9a-fA-F]{64}\Z")
WALLET_RE = re.compile(r"0x[0-9a-fA-F]{40}\Z")
HASH_RE = re.compile(r"[0-9a-f]{64}\Z")
MAX_FUTURE = 300  # seconds
MAX_OBSERVATION_AGE = 300
MAX_FRAME = 4096
# Strongly bounded, local proof-only service, not a trading or wallet API.
MAX_PROOFS_PER_MINUTE = 6
MIN_NONCE_STORE_FREE_BYTES = 2 * 1024 * 1024
NONCE_RETENTION_SECONDS = 90 * 24 * 60 * 60
CLOCK_BACKWARD_TOLERANCE = 2
SOFTWARE_KEY_TEST_FLAG = "yes-disposable-only"


class ProofError(Exception):
    """A rejected request, invalid privilege boundary, or unavailable evidence."""


@dataclass(frozen=True)
class Config:
    signer_uid: int
    socket_gid: int
    operator_uid: int
    observer_gid: int
    expected_wallet: str
    socket_dir: Path
    private_dir: Path
    key_file: Path
    nonce_db: Path
    observation_dir: Path
    observation_file: Path


def _check_dir(path: Path, uid: int, gid: int | None, mode: int) -> None:
    st = path.lstat()
    if not stat.S_ISDIR(st.st_mode) or st.st_uid != uid or stat.S_IMODE(st.st_mode) != mode:
        raise ProofError(f"unsafe directory permissions: {path}")
    if gid is not None and st.st_gid != gid:
        raise ProofError(f"unsafe directory group: {path}")


def _read_checked_file(path: Path, uid: int, gid: int | None, mode: int, limit: int) -> bytes:
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        st = os.fstat(fd)
        if (not stat.S_ISREG(st.st_mode) or st.st_uid != uid or
                stat.S_IMODE(st.st_mode) != mode or st.st_nlink != 1 or
                (gid is not None and st.st_gid != gid) or st.st_size > limit):
            raise ProofError(f"unsafe file permissions: {path}")
        data = os.read(fd, limit + 1)
        if len(data) > limit:
            raise ProofError("file exceeds limit")
        return data
    finally:
        os.close(fd)


def keccak256(data: bytes) -> bytes:
    """OpenSSL's KECCAK-256 (not SHA3-256); input is always public data."""
    try:
        result = subprocess.run(
            ["/usr/bin/openssl", "dgst", "-binary", "-KECCAK-256"],
            input=data, capture_output=True, timeout=2, check=True,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise ProofError("Keccak-256 unavailable") from exc
    if len(result.stdout) != 32:
        raise ProofError("unsupported OpenSSL Keccak implementation")
    return result.stdout


def personal_hash(message: str) -> bytes:
    payload = message.encode("utf-8")
    return keccak256(b"\x19Ethereum Signed Message:\n" + str(len(payload)).encode("ascii") + payload)


def account_address(key: ec.EllipticCurvePrivateKey) -> str:
    pub = key.public_key().public_numbers()
    return "0x" + keccak256(pub.x.to_bytes(32, "big") + pub.y.to_bytes(32, "big"))[-20:].hex()


def eip191_sign(key: ec.EllipticCurvePrivateKey, message: str) -> str:
    """ECDSA secp256k1 + Ethereum recoverable v=27/28 + low-s normalization.

    OpenSSL performs the EC multiplication and randomized ECDSA signing; no
    custom EC scalar multiplication implementation is used in production.
    """
    digest = personal_hash(message)
    der = key.sign(digest, ec.ECDSA(utils.Prehashed(hashes.SHA256())))
    r, s = utils.decode_dss_signature(der)
    if not (1 <= r < CURVE_ORDER and 1 <= s < CURVE_ORDER):
        raise ProofError("invalid ECDSA signature")
    s = min(s, CURVE_ORDER - s)
    # Recover the actual nonce scalar to obtain R.y parity via OpenSSL EC
    # multiplication, rather than taking the parity from an untrusted source.
    d = key.private_numbers().private_value
    z = int.from_bytes(digest, "big")
    k = ((z + r * d) * pow(s, -1, CURVE_ORDER)) % CURVE_ORDER
    if k == 0:
        raise ProofError("invalid ephemeral signing scalar")
    point = ec.derive_private_key(k, ec.SECP256K1()).public_key().public_numbers()
    if point.x % CURVE_ORDER != r or point.x >= CURVE_ORDER:
        # The overflow recovery IDs 2/3 cannot be encoded by standard 27/28.
        raise ProofError("nonstandard recovery id")
    v = 27 + (point.y & 1)
    # Independent local ECDSA verification of the normalized signature.
    key.public_key().verify(
        utils.encode_dss_signature(r, s), digest,
        ec.ECDSA(utils.Prehashed(hashes.SHA256())),
    )
    return "0x" + (r.to_bytes(32, "big") + s.to_bytes(32, "big") + bytes([v])).hex()


def _parse_expiry(value: object, now: datetime) -> int:
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", value):
        raise ProofError("expires_at must be a UTC ISO8601 second timestamp")
    try:
        ts = int(datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp())
    except (ValueError, OverflowError) as exc:
        raise ProofError("invalid expires_at") from exc
    if not (int(now.timestamp()) < ts <= int(now.timestamp()) + MAX_FUTURE):
        raise ProofError("challenge expired or outside five-minute window")
    return ts


def _load_observation(cfg: Config, now: datetime) -> tuple[str, str]:
    if cfg.observer_gid == cfg.socket_gid:
        raise ProofError("observer group must not be the operator socket group")
    _check_dir(cfg.observation_dir, 0, cfg.observer_gid, 0o750)
    raw = _read_checked_file(cfg.observation_file, 0, cfg.observer_gid, 0o640, 16384)
    try:
        receipt = json.loads(raw)
        if not isinstance(receipt, dict):
            raise ValueError("not an object")
        if set(receipt) != {"observation_id", "observed_at", "host_process", "provenance"}:
            raise ValueError("unexpected host observation fields")
        oid = receipt["observation_id"]
        if not isinstance(oid, str) or not re.fullmatch(r"[A-Za-z0-9_-]{12,96}", oid):
            raise ValueError("invalid observation ID")
        host = receipt["host_process"]
        provenance = receipt["provenance"]
        if (not isinstance(host, dict) or
                set(host) != {"pid", "start_time_utc", "image_id", "health_status"} or
                not isinstance(host["pid"], int) or host["pid"] <= 0 or
                not isinstance(host["image_id"], str) or
                not re.fullmatch(r"sha256:[0-9a-f]{64}", host["image_id"]) or
                host["health_status"] != "healthy" or
                not isinstance(provenance, dict) or
                set(provenance) != {"source_sha", "artifact_sha256"} or
                not isinstance(provenance["source_sha"], str) or
                not re.fullmatch(r"[0-9a-f]{40}", provenance["source_sha"]) or
                not isinstance(provenance["artifact_sha256"], str) or
                not HASH_RE.fullmatch(provenance["artifact_sha256"])):
            raise ValueError("missing or malformed process/provenance evidence")
        started = datetime.strptime(host["start_time_utc"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        observed = datetime.strptime(receipt["observed_at"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        if started > observed:
            raise ValueError("process started after observation")
        age = (now - observed).total_seconds()
        if not (0 <= age <= MAX_OBSERVATION_AGE):
            raise ValueError("stale or future observation")
    except (KeyError, ValueError, TypeError) as exc:
        raise ProofError("untrusted, malformed or stale host observation") from exc
    return hashlib.sha256(raw).hexdigest(), oid


def _use_nonce(cfg: Config, nonce: str, expires: int) -> None:
    _check_dir(cfg.nonce_db.parent, cfg.signer_uid, None, 0o700)
    # Refuse a low-space store rather than signing without durable replay state.
    if shutil.disk_usage(cfg.nonce_db.parent).free < MIN_NONCE_STORE_FREE_BYTES:
        raise ProofError("insufficient free space for durable replay protection")
    db = cfg.nonce_db
    if db.exists() or db.is_symlink():
        st = db.lstat()
        if (not stat.S_ISREG(st.st_mode) or st.st_uid != cfg.signer_uid or
                stat.S_IMODE(st.st_mode) != 0o600 or st.st_nlink != 1):
            raise ProofError("unsafe durable nonce database permissions")
    old_mask = os.umask(0o077)
    try:
        con = sqlite3.connect(db, timeout=2, isolation_level=None)
        try:
            con.execute("PRAGMA synchronous=FULL")
            con.execute("PRAGMA journal_mode=DELETE")
            con.execute("BEGIN IMMEDIATE")
            con.execute("CREATE TABLE IF NOT EXISTS used_nonce (nonce TEXT PRIMARY KEY, expires INTEGER NOT NULL, used_at INTEGER NOT NULL)")
            con.execute("CREATE TABLE IF NOT EXISTS replay_clock (name TEXT PRIMARY KEY, highest_utc INTEGER NOT NULL)")
            now_utc = int(time.time())
            clock = con.execute("SELECT highest_utc FROM replay_clock WHERE name='utc'").fetchone()
            if clock and now_utc + CLOCK_BACKWARD_TOLERANCE < clock[0]:
                raise ProofError("system clock regressed: replay store held")
            con.execute("INSERT INTO replay_clock VALUES ('utc', ?) ON CONFLICT(name) DO UPDATE SET highest_utc=MAX(highest_utc, excluded.highest_utc)", (now_utc,))
            # Expired challenges cannot be accepted again; retain records for 90 days.
            # Storage is durable across restarts, and old records are pruned in the same transaction.
            con.execute("DELETE FROM used_nonce WHERE expires < ? AND used_at < ?",
                        (now_utc - NONCE_RETENTION_SECONDS, now_utc - NONCE_RETENTION_SECONDS))
            con.execute("INSERT INTO used_nonce VALUES (?, ?, ?)", (nonce.lower(), expires, now_utc))
            con.execute("COMMIT")
        except ProofError:
            try:
                con.execute("ROLLBACK")
            except sqlite3.Error:
                pass
            raise
        except (sqlite3.Error, OSError) as exc:
            try:
                con.execute("ROLLBACK")
            except sqlite3.Error:
                pass
            raise ProofError("replayed nonce or durable nonce store unavailable") from exc
        finally:
            con.close()
    finally:
        os.umask(old_mask)
    st = db.lstat()
    if not stat.S_ISREG(st.st_mode) or st.st_uid != cfg.signer_uid or stat.S_IMODE(st.st_mode) != 0o600:
        raise ProofError("unsafe nonce database permissions")


def sign_proof(cfg: Config, request: dict, now: datetime | None = None) -> dict:
    if os.geteuid() != cfg.signer_uid or os.getegid() != cfg.socket_gid:
        raise ProofError("signer process identity does not match configuration")
    if cfg.signer_uid == 0 or cfg.operator_uid in (0, cfg.signer_uid):
        raise ProofError("signer and operator must be distinct non-root UIDs")
    if not isinstance(request, dict) or set(request) != {"nonce", "expires_at", "expected_wallet", "purpose"}:
        raise ProofError("request must contain only four ownership-proof fields")
    nonce, wallet = request["nonce"], request["expected_wallet"]
    if not isinstance(nonce, str) or not NONCE_RE.fullmatch(nonce):
        raise ProofError("nonce must be 32 bytes of hex")
    if not isinstance(wallet, str) or not WALLET_RE.fullmatch(wallet) or wallet.lower() != cfg.expected_wallet.lower():
        raise ProofError("wrong wallet")
    if request["purpose"] != PURPOSE:
        raise ProofError("only non-transactional ownership proof is permitted")
    now = now or datetime.now(timezone.utc)
    expires = _parse_expiry(request["expires_at"], now)
    _check_dir(cfg.private_dir, cfg.signer_uid, None, 0o700)
    # This implementation supports disposable software keys for offline tests only.
    # Real treasury keys must never be installed here. A hardware-backed,
    # nonexportable ownership-only provider must be security-reviewed separately.
    if os.environ.get("AGENTZ_TREASURY_SOFTWARE_KEY_FIXTURE_ONLY") != SOFTWARE_KEY_TEST_FLAG:
        raise ProofError("software private-key signing disabled outside disposable tests")
    if os.path.commonpath(("/tmp", str(cfg.private_dir.resolve()))) != "/tmp":
        raise ProofError("disposable key directory must be under /tmp")
    key_bytes = _read_checked_file(cfg.key_file, cfg.signer_uid, None, 0o600, 128).strip()
    if not re.fullmatch(rb"(?:0x)?[a-fA-F0-9]{64}", key_bytes):
        raise ProofError("invalid private key encoding")
    key = ec.derive_private_key(int(key_bytes.removeprefix(b"0x"), 16), ec.SECP256K1())
    if account_address(key).lower() != cfg.expected_wallet.lower():
        raise ProofError("configured key does not match expected wallet")
    observation_hash, oid = _load_observation(cfg, now)
    message = "\n".join([
        "AuthiChain AgentZ Treasury Ownership Proof v1",
        f"purpose: {PURPOSE}", f"chain_id: {CHAIN_ID}",
        f"wallet: {wallet.lower()}", f"nonce: {nonce.lower()}",
        f"expires_at: {request['expires_at']}",
        f"signer_service: {SERVICE_ID}", f"signer_uid: {cfg.signer_uid}",
        f"signer_pid: {os.getpid()}",
        f"host_observation_id: {oid}",
        f"host_observation_sha256: {observation_hash}",
        "authority: ownership-proof-only; no transaction or delegation",
    ]) + "\n"
    # Commit nonce before signing; any crash or failed operation consumes it.
    _use_nonce(cfg, nonce, expires)
    signature = eip191_sign(key, message)
    return {"service": SERVICE_ID, "purpose": PURPOSE, "chain_id": CHAIN_ID,
            "wallet": wallet.lower(), "message": message, "signature": signature,
            "host_observation_sha256": observation_hash, "host_observation_id": oid,
            "signer_uid": cfg.signer_uid, "signer_pid": os.getpid(),
            "authority": "ownership-proof-only", "host_observation_independently_verified": False}


def _client(conn: socket.socket, cfg: Config, attempts: deque[float]) -> None:
    conn.settimeout(1)
    try:
        pid, uid, gid = struct.unpack("3i", conn.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
        if uid != cfg.operator_uid or uid in (0, cfg.signer_uid):
            raise ProofError("unauthorized peer UID")
        now_tick = time.monotonic()
        while attempts and now_tick - attempts[0] >= 60:
            attempts.popleft()
        if len(attempts) >= MAX_PROOFS_PER_MINUTE:
            raise ProofError("proof request rate limit exceeded")
        attempts.append(now_tick)  # charge rejected requests too
        buf = bytearray()
        while len(buf) <= MAX_FRAME:
            chunk = conn.recv(min(512, MAX_FRAME + 1 - len(buf)))
            if not chunk:
                break
            buf.extend(chunk)
            if b"\n" in chunk:
                break
        if len(buf) > MAX_FRAME or buf.count(b"\n") != 1 or not buf.endswith(b"\n"):
            raise ProofError("invalid bounded single-line request")
        request = json.loads(buf)
        response = {"ok": True, "proof": sign_proof(cfg, request)}
    except (ProofError, ValueError, TypeError, socket.timeout, OSError) as exc:
        response = {"ok": False, "error": "proof request refused"}  # Do not leak key paths or host details.
    try:
        conn.sendall((json.dumps(response, separators=(",", ":")) + "\n").encode())
    except OSError:
        pass  # A disconnected client must not terminate the signer service.


def serve(cfg: Config) -> None:
    if os.name != "posix" or not hasattr(socket, "SO_PEERCRED"):
        raise ProofError("requires Linux peer credentials")
    if os.geteuid() != cfg.signer_uid or os.getegid() != cfg.socket_gid:
        raise ProofError("wrong signer service identity")
    if cfg.operator_uid in (0, cfg.signer_uid) or cfg.signer_uid == 0:
        raise ProofError("operator and signer must be distinct nonroot identities")
    _check_dir(cfg.socket_dir, cfg.signer_uid, cfg.socket_gid, 0o750)
    _check_dir(cfg.private_dir, cfg.signer_uid, None, 0o700)
    _check_dir(cfg.nonce_db.parent, cfg.signer_uid, None, 0o700)
    _check_dir(cfg.observation_dir, 0, cfg.observer_gid, 0o750)
    sock_path = cfg.socket_dir / "ownership.sock"
    if sock_path.exists() or sock_path.is_symlink():
        raise ProofError("socket path already exists: refuse unlinking unknown file")
    old_mask = os.umask(0o117)
    previous_term = signal.getsignal(signal.SIGTERM)
    previous_int = signal.getsignal(signal.SIGINT)
    def _shutdown(_sig, _frame):
        raise SystemExit(0)  # unwind socket and remove owned path on graceful stop
    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as listener:
            listener.bind(str(sock_path))
            os.chmod(sock_path, 0o660)
            st = sock_path.lstat()
            if (not stat.S_ISSOCK(st.st_mode) or st.st_uid != cfg.signer_uid or
                    st.st_gid != cfg.socket_gid or stat.S_IMODE(st.st_mode) != 0o660):
                raise ProofError("socket owner, group or mode not enforced")
            listener.listen(4)
            attempts: deque[float] = deque()
            try:
                while True:
                    conn, _ = listener.accept()
                    with conn:
                        _client(conn, cfg, attempts)
            finally:
                sock_path.unlink()
    finally:
        signal.signal(signal.SIGTERM, previous_term)
        signal.signal(signal.SIGINT, previous_int)
        os.umask(old_mask)


def main() -> None:
    parser = argparse.ArgumentParser(description="Disabled-by-default ownership-only signer")
    parser.add_argument("--signer-uid", type=int, required=True)
    parser.add_argument("--socket-gid", type=int, required=True)
    parser.add_argument("--operator-uid", type=int, required=True)
    parser.add_argument("--observer-gid", type=int, required=True)
    parser.add_argument("--wallet", required=True)
    parser.add_argument("--socket-dir", type=Path, required=True)
    parser.add_argument("--private-dir", type=Path, required=True)
    parser.add_argument("--key-file", type=Path, required=True)
    parser.add_argument("--nonce-db", type=Path, required=True)
    parser.add_argument("--observation-dir", type=Path, required=True)
    parser.add_argument("--observation-file", type=Path, required=True)
    args = parser.parse_args()
    if not WALLET_RE.fullmatch(args.wallet):
        parser.error("invalid expected wallet")
    cfg = Config(args.signer_uid, args.socket_gid, args.operator_uid, args.observer_gid,
                 args.wallet, args.socket_dir, args.private_dir, args.key_file,
                 args.nonce_db, args.observation_dir, args.observation_file)
    serve(cfg)


if __name__ == "__main__":
    main()
