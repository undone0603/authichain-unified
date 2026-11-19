"""AgentZ's own identity: which Agent ID it is, and whether it can prove it.

The identity is published on authichain.com (workers/authichain-com/src/
bot-identities.ts): a did:web document whose key is the did:key below. This
module binds the running service to that identity and reports, without
revealing any secret, whether the private key it was given matches it.

Possession is proven only by deriving the did:key from the key file at
AGENTZ_KEY_DIR/agentz.ed25519.pem and comparing it with the published one.
A claimed identity without that match is reported as "unproven", never as
verified. No key is ever generated here: a new key is a different identity.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

AGENT_ID = "agent:authichain:agentz"
DID_WEB = "did:web:authichain.com:agents:agentz"
DID_KEY = "did:key:z6MkryvgqPJq6qE7zWnw7T62biPzJrLPML3EMSSXxLUoKN82"
DID_DOCUMENT_URL = "https://authichain.com/agents/agentz/did.json"
PROFILE_URL = "https://authichain.com/agents/agentz"
VALID_UNTIL = "2027-01-17T18:00:00Z"
KEY_FILE = "agentz.ed25519.pem"

_B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def _b58(data: bytes) -> str:
    n = int.from_bytes(data, "big")
    out = ""
    while n:
        n, r = divmod(n, 58)
        out = _B58[r] + out
    return "1" * (len(data) - len(data.lstrip(b"\0"))) + out


def did_key_from_pem(pem: bytes) -> str:
    """did:key for an Ed25519 private key in PEM (PKCS#8). Raises ValueError otherwise."""
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    key = serialization.load_pem_private_key(pem, password=None)
    if not isinstance(key, Ed25519PrivateKey):
        raise ValueError("not an Ed25519 key")
    raw = key.public_key().public_bytes(serialization.Encoding.Raw,
                                        serialization.PublicFormat.Raw)
    return "did:key:z" + _b58(b"\xed\x01" + raw)


def _key_possession(key_dir: Optional[str]) -> Dict[str, Any]:
    if not key_dir:
        return {"status": "unproven", "reason": "AGENTZ_KEY_DIR not set"}
    path = Path(key_dir) / KEY_FILE
    if not path.is_file():
        return {"status": "unproven", "reason": f"{KEY_FILE} not found in AGENTZ_KEY_DIR"}
    try:
        derived = did_key_from_pem(path.read_bytes())
    except (ValueError, TypeError, OSError) as exc:
        return {"status": "unproven", "reason": f"key file unreadable: {type(exc).__name__}"}
    if derived != DID_KEY:
        return {"status": "mismatch", "reason": "key file is a different identity"}
    return {"status": "proven", "reason": "key file matches the published did:key"}


def identity_status(now: Optional[datetime] = None) -> Dict[str, Any]:
    """Public identity plus possession and trust status. Contains no secrets."""
    from agentz.core.signature import trusted_issuers

    now = now or datetime.now(timezone.utc)
    expires = datetime.fromisoformat(VALID_UNTIL.replace("Z", "+00:00"))
    possession = _key_possession(os.environ.get("AGENTZ_KEY_DIR"))
    return {
        "agent_id": AGENT_ID,
        "did": DID_WEB,
        "did_key": DID_KEY,
        "did_document": DID_DOCUMENT_URL,
        "profile": PROFILE_URL,
        "valid_until": VALID_UNTIL,
        "expired": now >= expires,
        "key_possession": possession,
        "trusts_own_signatures": DID_KEY in trusted_issuers(),
        "can_sign_as_self": possession["status"] == "proven" and now < expires,
    }
