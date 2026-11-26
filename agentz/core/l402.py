"""L402 (Lightning HTTP 402) for AgentZ: a second, independent implementation.

The protocol is defined in docs/strategy/LIGHTNING_L402.md, and this module
must reproduce shared/l402-vectors.json exactly, as src/lib/l402.ts does.
Standard library only.

    402 challenge  WWW-Authenticate: L402 macaroon="<base64>", invoice="<bolt11>"
    paid retry     Authorization: L402 <base64 macaroon>:<hex preimage>

Nothing here takes money. The only backend is TestBackend, whose invoices
cannot be paid, and challenge() refuses it unless the caller opts in. A live
backend lands once the owner chooses one (LIGHTNING_L402.md, "Owner gates").
"""
from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import os
import re
import secrets
import time
import urllib.request
from dataclasses import dataclass
from typing import Callable, Dict, List, Mapping, Optional, Tuple

IDENTIFIER_VERSION = 0
INVOICE_TTL_SECONDS = 600
MAX_TTL_SECONDS = 3600
SERVICES = ("signals", "notary", "dex")
LOCATION = "authichain.com"
_KEY_GENERATOR = b"macaroons-key-generator"
_EOS, _LOCATION, _IDENTIFIER, _SIGNATURE = 0, 1, 2, 6
_HEX32 = re.compile(r"^[0-9a-f]{64}$")
_AUTH = re.compile(r"^(?:L402|LSAT)\s+(\S+)$", re.IGNORECASE)
_B64 = re.compile(r"^[A-Za-z0-9+/_-]+={0,2}$")


# ---------------------------------------------------------------- prices

def usd_atomic_to_sats(price_atomic: int, btc_usd_cents: int) -> int:
    """sats = max(1, ceil(atomic * 10_000 / cents)); atomic USD has 6 decimals."""
    atomic, cents = int(price_atomic), int(btc_usd_cents)
    if atomic <= 0:
        raise ValueError("price must be positive")
    if cents <= 0:
        raise ValueError("btc price must be positive")
    return max(1, -(-(atomic * 10_000) // cents))


def usd_to_atomic(usd: float) -> int:
    return int(round(usd * 1_000_000))


# --------------------------------------------------------- macaroon V2

def _varint(n: int) -> bytes:
    out = bytearray()
    while True:
        byte = n & 0x7F
        n >>= 7
        out.append(byte | (0x80 if n else 0))
        if not n:
            return bytes(out)


def _field(kind: int, data: bytes) -> bytes:
    return _varint(kind) + _varint(len(data)) + data


@dataclass(frozen=True)
class Macaroon:
    location: str
    identifier: bytes
    caveats: Tuple[str, ...]
    signature: bytes


def serialize(m: Macaroon) -> bytes:
    out = bytearray([2])
    if m.location:
        out += _field(_LOCATION, m.location.encode())
    out += _field(_IDENTIFIER, m.identifier) + bytes([_EOS])
    for caveat in m.caveats:
        out += _field(_IDENTIFIER, caveat.encode()) + bytes([_EOS])
    out += bytes([_EOS]) + _field(_SIGNATURE, m.signature)
    return bytes(out)


def parse(raw: bytes) -> Optional[Macaroon]:
    """Strict V2 parser; None on anything unexpected, third-party caveats included."""
    pos = 0

    def varint() -> Optional[int]:
        nonlocal pos
        value = shift = 0
        while pos < len(raw) and shift <= 28:
            b = raw[pos]
            pos += 1
            value |= (b & 0x7F) << shift
            if not b & 0x80:
                return value
            shift += 7
        return None

    def field() -> Optional[Tuple[int, bytes]]:
        nonlocal pos
        kind = varint()
        if kind is None:
            return None
        if kind == _EOS:
            return kind, b""
        length = varint()
        if length is None or pos + length > len(raw):
            return None
        data = raw[pos:pos + length]
        pos += length
        return kind, data

    if not raw or raw[0] != 2:
        return None
    pos = 1
    f = field()
    location = ""
    if f and f[0] == _LOCATION:
        location = f[1].decode("utf-8", "replace")
        f = field()
    if not f or f[0] != _IDENTIFIER:
        return None
    identifier = f[1]
    end = field()
    if not end or end[0] != _EOS:
        return None
    caveats: List[str] = []
    while True:
        f = field()
        if not f:
            return None
        if f[0] == _EOS:
            break
        if f[0] != _IDENTIFIER:
            return None
        caveats.append(f[1].decode("utf-8", "replace"))
        end = field()
        if not end or end[0] != _EOS:
            return None
    f = field()
    if not f or f[0] != _SIGNATURE or len(f[1]) != 32 or pos != len(raw):
        return None
    return Macaroon(location, identifier, tuple(caveats), f[1])


def _hmac(key: bytes, data: bytes) -> bytes:
    return hmac.new(key, data, hashlib.sha256).digest()


def signature(root_key: bytes, identifier: bytes, caveats) -> bytes:
    sig = _hmac(_hmac(_KEY_GENERATOR, root_key), identifier)
    for caveat in caveats:
        sig = _hmac(sig, caveat.encode())
    return sig


def encode_identifier(payment_hash: bytes, token_id: bytes) -> bytes:
    if len(payment_hash) != 32 or len(token_id) != 32:
        raise ValueError("payment hash and token id must be 32 bytes")
    return IDENTIFIER_VERSION.to_bytes(2, "big") + payment_hash + token_id


def resource_digest(resource: str) -> str:
    return hashlib.sha256(resource.encode()).hexdigest()


def grant_caveats(service: str, capability: str, resource: str,
                  valid_until: int, price_msat: int) -> List[str]:
    return [
        f"services={service}:0",
        f"{service}_capabilities={capability}",
        f"{service}_resource={resource_digest(resource)}",
        f"{service}_valid_until={valid_until}",
        f"{service}_price_msat={price_msat}",
    ]


def mint(root_key: bytes, location: str, payment_hash: bytes, token_id: bytes,
         service: str, capability: str, resource: str, valid_until: int,
         price_msat: int) -> bytes:
    identifier = encode_identifier(payment_hash, token_id)
    caveats = grant_caveats(service, capability, resource, valid_until, price_msat)
    return serialize(Macaroon(location, identifier, tuple(caveats),
                              signature(root_key, identifier, caveats)))


# --------------------------------------------------------------- verify

def is_l402_authorization(header: Optional[str]) -> bool:
    return bool(re.match(r"^(L402|LSAT)\s+\S", (header or "").strip(), re.IGNORECASE))


def _b64decode(text: str) -> Optional[bytes]:
    if not _B64.match(text):
        return None
    std = text.replace("-", "+").replace("_", "/")
    try:
        raw = base64.b64decode(std + "=" * (-len(std) % 4))
    except (binascii.Error, ValueError):
        return None
    return raw or None


def verify(authorization: str, *, root_key: bytes, service: str, capability: str,
           resource: str, now_seconds: int) -> Dict[str, object]:
    """Same checks, same order and same reason codes as src/lib/l402.ts verifyL402."""
    m = _AUTH.match((authorization or "").strip())
    if not m:
        return {"ok": False, "reason": "l402_malformed"}
    token = m.group(1)
    sep = token.rfind(":")
    if sep < 1:
        return {"ok": False, "reason": "l402_malformed"}
    preimage_hex = token[sep + 1:].lower()
    if not _HEX32.match(preimage_hex):
        return {"ok": False, "reason": "l402_bad_preimage"}
    raw = _b64decode(token[:sep])
    mac = parse(raw) if raw else None
    if not mac:
        return {"ok": False, "reason": "l402_bad_macaroon"}
    if not hmac.compare_digest(signature(root_key, mac.identifier, mac.caveats), mac.signature):
        return {"ok": False, "reason": "l402_bad_signature"}
    ident = mac.identifier
    if len(ident) != 66 or int.from_bytes(ident[:2], "big") != IDENTIFIER_VERSION:
        return {"ok": False, "reason": "l402_bad_identifier"}
    payment_hash = ident[2:34]
    if not hmac.compare_digest(hashlib.sha256(bytes.fromhex(preimage_hex)).digest(), payment_hash):
        return {"ok": False, "reason": "l402_preimage_mismatch"}

    want = {
        "services": f"{service}:0",
        f"{service}_capabilities": capability,
        f"{service}_resource": resource_digest(resource),
    }
    valid_until = price_msat = None
    seen = set()
    for caveat in mac.caveats:
        key, eq, value = caveat.partition("=")
        if not eq or not key:
            return {"ok": False, "reason": "l402_bad_caveat"}
        if key in seen:
            return {"ok": False, "reason": "l402_duplicate_caveat"}
        seen.add(key)
        if key in want:
            if want[key] != value:
                return {"ok": False, "reason": f"l402_wrong_{key}"}
        elif key == f"{service}_valid_until":
            if not re.fullmatch(r"\d{1,12}", value):
                return {"ok": False, "reason": "l402_bad_caveat"}
            valid_until = int(value)
        elif key == f"{service}_price_msat":
            if not re.fullmatch(r"\d{1,18}", value):
                return {"ok": False, "reason": "l402_bad_caveat"}
            price_msat = int(value)
        else:
            return {"ok": False, "reason": "l402_unknown_caveat"}
    for key in want:
        if key not in seen:
            return {"ok": False, "reason": f"l402_missing_{key}"}
    if valid_until is None or price_msat is None:
        return {"ok": False, "reason": "l402_missing_caveat"}
    if now_seconds >= valid_until:
        return {"ok": False, "reason": "l402_expired"}
    return {"ok": True, "payment_hash": payment_hash.hex(), "service": service,
            "capability": capability, "valid_until": valid_until, "price_msat": price_msat}


def replay_key(payment_hash: str) -> str:
    return f"l402:ph:{payment_hash.lower()}"


class FileClaims:
    """One token, one call, for a process without KV: one file per payment hash.

    os.O_EXCL makes the claim atomic across workers sharing the directory.
    Claims outlive the token (1 h max), so only the directory's own lifetime
    bounds them; point AGENTZ_L402_CLAIMS_DIR at a persistent volume.
    """

    def __init__(self, directory: Optional[str] = None) -> None:
        self.dir = directory or os.environ.get("AGENTZ_L402_CLAIMS_DIR") or "/tmp/agentz-runtime/l402-claims"

    def _path(self, payment_hash: str) -> str:
        if not _HEX32.match(payment_hash):
            raise ValueError("bad payment hash")
        return os.path.join(self.dir, payment_hash)

    def claim(self, payment_hash: str) -> bool:
        """True if this call now owns the payment; False if it was already used."""
        os.makedirs(self.dir, mode=0o700, exist_ok=True)
        try:
            fd = os.open(self._path(payment_hash), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            return False
        os.close(fd)
        return True

    def release(self, payment_hash: str) -> None:
        try:
            os.unlink(self._path(payment_hash))
        except FileNotFoundError:
            pass


# ------------------------------------------------------- backend + config

class TestBackend:
    """In-memory invoices that cannot be paid. Hands preimages to tests only."""

    name = "test"
    live = False

    def __init__(self) -> None:
        self._preimages: Dict[str, str] = {}

    def create_invoice(self, amount_msat: int, memo: str, expiry_seconds: int) -> Dict[str, str]:
        preimage = secrets.token_bytes(32)
        payment_hash = hashlib.sha256(preimage).hexdigest()
        self._preimages[payment_hash] = preimage.hex()
        return {"bolt11": f"test-invoice-not-payable:{amount_msat}msat:{payment_hash}",
                "payment_hash": payment_hash}

    def preimage_for(self, payment_hash: str) -> Optional[str]:
        return self._preimages.get(payment_hash)


_TEST_BACKEND: Optional[TestBackend] = None


def test_backend() -> TestBackend:
    global _TEST_BACKEND
    if _TEST_BACKEND is None:
        _TEST_BACKEND = TestBackend()
    return _TEST_BACKEND


@dataclass
class Config:
    root_key: bytes
    backend: object
    allow_test_backend: bool
    btc_usd_cents: Callable[[], Optional[int]]


def root_key_from_hex(value: Optional[str]) -> Optional[bytes]:
    clean = (value or "").strip().lower()
    if not re.fullmatch(r"[0-9a-f]{64,}", clean) or len(clean) % 2:
        return None
    return bytes.fromhex(clean)


def config(env: Optional[Mapping[str, str]] = None) -> Optional[Config]:
    """None (L402 off) unless the root key, a backend and a price are all available."""
    env = os.environ if env is None else env
    root_key = root_key_from_hex(env.get("L402_ROOT_KEY"))
    if not root_key:
        return None
    # Only the test backend exists, and only in a test runtime.
    if env.get("L402_BACKEND", "").strip() != "test" or env.get("NODE_ENV") != "test":
        return None
    fixed = env.get("L402_BTC_USD_CENTS", "")
    price = (lambda: int(fixed)) if fixed.isdigit() and int(fixed) > 0 else live_btc_usd_cents
    return Config(root_key, test_backend(), True, price)


_PRICE_CACHE: Dict[str, float] = {}


def live_btc_usd_cents(opener=urllib.request.urlopen, now: Optional[float] = None) -> Optional[int]:
    """Coinbase public spot, cached 60 s, refused outside $1,000-$10,000,000."""
    now = time.time() if now is None else now
    if _PRICE_CACHE and now - _PRICE_CACHE["at"] < 60:
        return int(_PRICE_CACHE["cents"])
    req = urllib.request.Request("https://api.coinbase.com/v2/prices/BTC-USD/spot",
                                 headers={"Accept": "application/json"})
    try:
        with opener(req, timeout=5) as res:
            body = json.load(res)
        if body.get("data", {}).get("currency") != "USD":
            return None
        cents = round(float(body["data"]["amount"]) * 100)
    except (OSError, ValueError, KeyError, TypeError):
        return None
    if not 100_000 <= cents <= 1_000_000_000:
        return None
    _PRICE_CACHE.update(cents=cents, at=now)
    return cents


def challenge(cfg: Config, *, service: str, capability: str, resource: str,
              price_atomic_usd: int, now_seconds: Optional[int] = None,
              ttl_seconds: int = INVOICE_TTL_SECONDS) -> Optional[Dict[str, object]]:
    """A WWW-Authenticate challenge, or None when no BTC price is available."""
    if not getattr(cfg.backend, "live", False) and not cfg.allow_test_backend:
        raise RuntimeError("l402_backend_not_live")
    cents = cfg.btc_usd_cents()
    if not cents:
        return None
    now_seconds = int(time.time()) if now_seconds is None else now_seconds
    ttl = min(ttl_seconds, MAX_TTL_SECONDS)
    sats = usd_atomic_to_sats(price_atomic_usd, cents)
    invoice = cfg.backend.create_invoice(sats * 1000, f"{service}:{capability}", ttl)
    if not _HEX32.match(invoice["payment_hash"]):
        raise RuntimeError("bad payment hash")
    valid_until = now_seconds + ttl
    mac = base64.b64encode(mint(cfg.root_key, LOCATION, bytes.fromhex(invoice["payment_hash"]),
                                secrets.token_bytes(32), service, capability, resource,
                                valid_until, sats * 1000)).decode()
    return {"header": f'L402 macaroon="{mac}", invoice="{invoice["bolt11"]}"',
            "macaroon": mac, "invoice": invoice["bolt11"],
            "payment_hash": invoice["payment_hash"], "sats": sats, "valid_until": valid_until}
