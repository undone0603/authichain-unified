"""Signed anti-entropy gossip between AgentZ federation members.

Every message is an envelope signed by its origin's Ed25519 key and numbered
per origin (seq 1, 2, 3, ...). Nodes accept envelopes only from members (an
explicit did:key allowlist), keep them per origin, and summarise what they
hold as a version vector: origin -> highest contiguous seq. A gossip round is
push-pull: send your vector, receive what you lack, send back what the peer
lacks. Repeated rounds with random peers converge every member.

Transport-agnostic: Node.handle_exchange / handle_push take and return plain
dicts, so HTTP (agentz.federation.routes) and tests share the same logic.

Gossip carries data only. A payload may name a capability, but nothing here
executes it; advisory() reports what capability_policy would decide.
"""
from __future__ import annotations

import base64
import json
import os
import random
import re
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

from agentz.core.capability_policy import decide
from agentz.core.identity import _B58, _b58

VERSION = 1
TOPIC = re.compile(r"^[a-z0-9][a-z0-9_.-]{0,63}$")
MAX_PAYLOAD_BYTES = 16 * 1024
MAX_BATCH = 200            # envelopes per exchange/push; later rounds send the rest
MAX_FUTURE_SKEW_S = 300    # reject envelopes/requests dated this far ahead
REQUEST_MAX_AGE_S = 300    # signed requests older than this are stale
RETENTION_PER_ORIGIN = 500

Clock = Callable[[], float]


class FederationError(Exception):
    """A refused request or envelope. `reason` is stable for callers and tests."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


# ---- encoding helpers -------------------------------------------------------

def canonical(obj: Dict[str, Any]) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _unb58(text: str) -> bytes:
    n = 0
    for ch in text:
        n = n * 58 + _B58.index(ch)
    raw = n.to_bytes((n.bit_length() + 7) // 8, "big")
    return b"\0" * (len(text) - len(text.lstrip("1"))) + raw


def did_key_of(key: Ed25519PrivateKey) -> str:
    raw = key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    return "did:key:z" + _b58(b"\xed\x01" + raw)


def public_key_of(did: str) -> Ed25519PublicKey:
    """Ed25519 public key from a did:key. Raises FederationError if it is not one."""
    if not did.startswith("did:key:z"):
        raise FederationError("bad_did")
    try:
        raw = _unb58(did[len("did:key:z"):])
    except ValueError:
        raise FederationError("bad_did") from None
    if len(raw) != 34 or raw[:2] != b"\xed\x01":
        raise FederationError("bad_did")
    return Ed25519PublicKey.from_public_bytes(raw[2:])


def _iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _parse_iso(text: Any) -> float:
    try:
        return datetime.fromisoformat(str(text).replace("Z", "+00:00")).timestamp()
    except ValueError:
        raise FederationError("bad_timestamp") from None


def _verify(did: str, signed: Dict[str, Any], sig: Any) -> None:
    if not isinstance(sig, str):
        raise FederationError("bad_signature")
    try:
        public_key_of(did).verify(_unb64(sig), canonical(signed))
    except (InvalidSignature, ValueError):
        raise FederationError("bad_signature") from None


# ---- the node ---------------------------------------------------------------

class Node:
    """One federation member: holds envelopes, signs its own, verifies others'."""

    def __init__(self, key: Ed25519PrivateKey, members: Iterable[str], *,
                 state_dir: Optional[Path] = None, clock: Clock = time.time,
                 retention: int = RETENTION_PER_ORIGIN):
        self._key = key
        self.did = did_key_of(key)
        self.members = set(members) | {self.did}
        for did in self.members:
            public_key_of(did)  # fail at startup on a malformed member, not mid-gossip
        self._clock = clock
        self._retention = retention
        self._state_dir = Path(state_dir) if state_dir else None
        self._held: Dict[str, Dict[int, Dict[str, Any]]] = {}
        self._floor: Dict[str, int] = {}     # seqs <= floor were pruned or predate us
        self._nonces: Dict[str, float] = {}  # request replay cache
        self.equivocations: List[Dict[str, Any]] = []
        self._own_seq = self._load_seq()

    # -- own sequence survives restarts so peers never see a reused seq
    def _seq_file(self) -> Optional[Path]:
        return self._state_dir / "own_seq.json" if self._state_dir else None

    def _load_seq(self) -> int:
        path = self._seq_file()
        if path and path.is_file():
            data = json.loads(path.read_text(encoding="utf-8"))
            if data.get("did") == self.did:
                return int(data["seq"])
        return 0

    def _save_seq(self) -> None:
        path = self._seq_file()
        if not path:
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps({"did": self.did, "seq": self._own_seq}), encoding="utf-8")
        os.replace(tmp, path)

    # -- publishing
    def publish(self, topic: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        if not TOPIC.match(topic or ""):
            raise FederationError("bad_topic")
        if not isinstance(payload, dict) or len(canonical(payload)) > MAX_PAYLOAD_BYTES:
            raise FederationError("bad_payload")
        self._own_seq += 1
        self._save_seq()
        body = {"v": VERSION, "origin": self.did, "seq": self._own_seq,
                "ts": _iso(self._clock()), "topic": topic, "payload": payload}
        envelope = {**body, "sig": _b64(self._key.sign(canonical(body)))}
        self._store(envelope)
        return envelope

    # -- state
    def vector(self) -> Dict[str, int]:
        """origin -> highest seq such that every seq above the floor up to it is held."""
        out = {}
        for origin, held in self._held.items():
            n = self._floor.get(origin, 0)
            while n + 1 in held:
                n += 1
            out[origin] = n
        return out

    def messages(self, topic: Optional[str] = None) -> List[Dict[str, Any]]:
        msgs = [e for held in self._held.values() for e in held.values()]
        if topic:
            msgs = [e for e in msgs if e["topic"] == topic]
        return sorted(msgs, key=lambda e: (e["ts"], e["origin"], e["seq"]))

    def missing_for(self, vector: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Envelopes a peer with this vector lacks, oldest first, capped at MAX_BATCH."""
        out = []
        for origin, held in self._held.items():
            have = vector.get(origin, 0) if isinstance(vector.get(origin, 0), int) else 0
            out.extend(e for s, e in sorted(held.items()) if s > have)
        out.sort(key=lambda e: (e["seq"], e["origin"]))
        return out[:MAX_BATCH]

    # -- ingest
    def _check(self, env: Any) -> Dict[str, Any]:
        if not isinstance(env, dict) or env.get("v") != VERSION:
            raise FederationError("bad_envelope")
        origin = env.get("origin")
        if origin not in self.members:
            raise FederationError("untrusted_origin")
        seq = env.get("seq")
        if not isinstance(seq, int) or isinstance(seq, bool) or seq < 1:
            raise FederationError("bad_seq")
        if not TOPIC.match(str(env.get("topic", ""))):
            raise FederationError("bad_topic")
        if not isinstance(env.get("payload"), dict) or len(canonical(env["payload"])) > MAX_PAYLOAD_BYTES:
            raise FederationError("bad_payload")
        if _parse_iso(env.get("ts")) > self._clock() + MAX_FUTURE_SKEW_S:
            raise FederationError("future_timestamp")
        body = {k: env[k] for k in ("v", "origin", "seq", "ts", "topic", "payload")}
        _verify(origin, body, env.get("sig"))
        return {**body, "sig": env["sig"]}

    def _store(self, env: Dict[str, Any]) -> None:
        origin, seq = env["origin"], env["seq"]
        held = self._held.setdefault(origin, {})
        held[seq] = env
        if len(held) > self._retention:
            for old in sorted(held)[: len(held) - self._retention]:
                del held[old]
                self._floor[origin] = max(self._floor.get(origin, 0), old)

    def ingest(self, envelopes: Any) -> Dict[str, Any]:
        result: Dict[str, Any] = {"accepted": 0, "duplicate": 0, "rejected": []}
        if not isinstance(envelopes, list):
            result["rejected"].append({"reason": "bad_batch"})
            return result
        checked = []
        for raw in envelopes[:MAX_BATCH]:
            try:
                checked.append(self._check(raw))
            except FederationError as exc:
                result["rejected"].append({"reason": exc.reason,
                                           "origin": raw.get("origin") if isinstance(raw, dict) else None})
        # A late joiner adopts the oldest seq it is first offered as its history start.
        for origin in {e["origin"] for e in checked}:
            if origin not in self._held and origin not in self._floor:
                self._floor[origin] = min(e["seq"] for e in checked if e["origin"] == origin) - 1
        for env in checked:
            origin, seq = env["origin"], env["seq"]
            existing = self._held.get(origin, {}).get(seq)
            if existing is not None:
                if existing["sig"] == env["sig"]:
                    result["duplicate"] += 1
                else:
                    # Two validly signed, different messages at one seq: the key is misused.
                    self.equivocations.append({"origin": origin, "seq": seq})
                    result["rejected"].append({"reason": "equivocation", "origin": origin})
                continue
            if seq <= self._floor.get(origin, 0):
                result["duplicate"] += 1
                continue
            self._store(env)
            result["accepted"] += 1
        return result

    # -- authenticated requests between members
    def sign_request(self, kind: str, body: Dict[str, Any]) -> Dict[str, Any]:
        req = {"kind": kind, "from": self.did, "ts": _iso(self._clock()),
               "nonce": secrets.token_hex(16), "body": body}
        return {**req, "sig": _b64(self._key.sign(canonical(req)))}

    def verify_request(self, req: Any, kind: str) -> str:
        if not isinstance(req, dict) or req.get("kind") != kind:
            raise FederationError("bad_request")
        sender = req.get("from")
        if sender not in self.members or sender == self.did:
            raise FederationError("not_a_member")
        now = self._clock()
        ts = _parse_iso(req.get("ts"))
        if ts > now + MAX_FUTURE_SKEW_S or ts < now - REQUEST_MAX_AGE_S:
            raise FederationError("stale_request")
        nonce = req.get("nonce")
        if not isinstance(nonce, str) or not nonce:
            raise FederationError("bad_request")
        self._nonces = {n: t for n, t in self._nonces.items() if t > now - 2 * REQUEST_MAX_AGE_S}
        if f"{sender}:{nonce}" in self._nonces:
            raise FederationError("replayed_request")
        signed = {k: req.get(k) for k in ("kind", "from", "ts", "nonce", "body")}
        _verify(sender, signed, req.get("sig"))
        self._nonces[f"{sender}:{nonce}"] = now
        return sender

    def handle_exchange(self, req: Any) -> Dict[str, Any]:
        self.verify_request(req, "exchange")
        vector = req["body"].get("vector") if isinstance(req.get("body"), dict) else None
        if not isinstance(vector, dict):
            raise FederationError("bad_request")
        return {"from": self.did, "vector": self.vector(), "envelopes": self.missing_for(vector)}

    def handle_push(self, req: Any) -> Dict[str, Any]:
        self.verify_request(req, "push")
        body = req.get("body") if isinstance(req.get("body"), dict) else {}
        return self.ingest(body.get("envelopes"))


# ---- a gossip round ---------------------------------------------------------

Post = Callable[[str, str, Dict[str, Any]], Dict[str, Any]]  # (peer, path, json) -> json


def gossip_round(node: Node, peers: List[str], post: Post, *, fanout: int = 2,
                 rng: Optional[random.Random] = None) -> List[Dict[str, Any]]:
    """Push-pull with up to `fanout` random peers. One failing peer never stops the round."""
    rng = rng or random.Random()
    report = []
    for peer in rng.sample(peers, min(fanout, len(peers))):
        entry: Dict[str, Any] = {"peer": peer}
        try:
            resp = post(peer, "/federation/exchange", node.sign_request("exchange", {"vector": node.vector()}))
            pulled = node.ingest(resp.get("envelopes", []))
            mine = node.missing_for(resp.get("vector") or {})
            pushed = post(peer, "/federation/push", node.sign_request("push", {"envelopes": mine})) if mine else {}
            entry.update(pulled=pulled["accepted"], rejected=len(pulled["rejected"]),
                         pushed=pushed.get("accepted", 0))
        except Exception as exc:  # network, peer refusal, malformed reply
            entry["error"] = getattr(exc, "reason", type(exc).__name__)
        report.append(entry)
    return report


def advisory(envelope: Dict[str, Any]) -> Dict[str, Any]:
    """What capability_policy would say about a gossiped capability. Never executes it."""
    capability = (envelope.get("payload") or {}).get("capability")
    if not capability:
        return {"capability": None, "allowed": None, "reason": "no capability named", "executed": False}
    decision = decide(capability)
    return {"capability": capability, "allowed": decision.allowed,
            "reason": decision.reason, "executed": False}
