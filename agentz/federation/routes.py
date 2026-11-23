"""HTTP surface for AgentZ federation gossip.

Peer endpoints authenticate by signed request (member did:key, fresh
timestamp, one-time nonce), not by AGENT_SECRET, so members never share a
bearer token. With no key or no members configured the node is absent and
every endpoint answers 503: mounting this router changes nothing until the
owner opts in.

Configuration (environment):
  AGENTZ_KEY_DIR              holds agentz.ed25519.pem (this node's identity)
  AGENTZ_FEDERATION_MEMBERS   comma-separated did:keys allowed to gossip
  AGENTZ_FEDERATION_PEERS     comma-separated base URLs to dial (outbound rounds)
  AGENTZ_FEDERATION_STATE     directory for this node's own sequence counter
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request

from agentz.federation.gossip import FederationError, Node

KEY_FILE = "agentz.ed25519.pem"
DEFAULT_STATE = Path.home() / ".local/share/agentz/federation"

router = APIRouter(prefix="/federation", tags=["Federation"])
_node: Optional[Node] = None
_loaded = False


def _split(name: str) -> List[str]:
    return [v.strip() for v in os.environ.get(name, "").split(",") if v.strip()]


def load_node() -> Optional[Node]:
    """This process's node, or None when federation is not configured."""
    global _node, _loaded
    if _loaded:
        return _node
    _loaded = True
    key_dir, members = os.environ.get("AGENTZ_KEY_DIR"), _split("AGENTZ_FEDERATION_MEMBERS")
    if not key_dir or not members:
        return None
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    path = Path(key_dir) / KEY_FILE
    if not path.is_file():
        return None
    key = serialization.load_pem_private_key(path.read_bytes(), password=None)
    if not isinstance(key, Ed25519PrivateKey):
        return None
    state = Path(os.environ.get("AGENTZ_FEDERATION_STATE") or DEFAULT_STATE)
    _node = Node(key, members, state_dir=state)
    return _node


def set_node(node: Optional[Node]) -> None:
    """Inject a node (tests, or a process that builds its own)."""
    global _node, _loaded
    _node, _loaded = node, True


def _require() -> Node:
    node = load_node()
    if node is None:
        raise HTTPException(status_code=503, detail="federation not configured")
    return node


async def _call(request: Request, handler: str) -> Dict[str, Any]:
    node = _require()
    try:
        req = await request.json()
    except ValueError:
        raise HTTPException(status_code=400, detail="bad_request") from None
    try:
        return getattr(node, handler)(req)
    except FederationError as exc:
        code = 403 if exc.reason in ("not_a_member", "bad_signature") else 400
        raise HTTPException(status_code=code, detail=exc.reason) from None


@router.post("/exchange")
async def exchange(request: Request) -> Dict[str, Any]:
    return await _call(request, "handle_exchange")


@router.post("/push")
async def push(request: Request) -> Dict[str, Any]:
    return await _call(request, "handle_push")


def status() -> Dict[str, Any]:
    """Counts and vector only: no payloads. Served behind AGENT_SECRET in main.py."""
    node = load_node()
    if node is None:
        return {"configured": False}
    return {"configured": True, "did": node.did, "members": len(node.members),
            "peers": len(_split("AGENTZ_FEDERATION_PEERS")), "vector": node.vector(),
            "held": len(node.messages()), "equivocations": node.equivocations}


def httpx_post(timeout: float = 10.0):
    """A Post for gossip_round over HTTPS/HTTP with httpx."""
    import httpx

    def post(peer: str, path: str, body: Dict[str, Any]) -> Dict[str, Any]:
        resp = httpx.post(peer.rstrip("/") + path, json=body, timeout=timeout)
        resp.raise_for_status()
        return resp.json()

    return post
