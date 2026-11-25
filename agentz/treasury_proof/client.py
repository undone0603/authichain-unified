"""Authenticated Unix socket client; NOT an HTTP bridge or spending authority."""
from __future__ import annotations
import json
import os
from pathlib import Path
import socket
import struct

from .signer import ProofError, SERVICE_ID, MAX_FRAME


def request_proof(socket_path: Path, signer_uid: int, request: dict) -> dict:
    if signer_uid <= 0 or signer_uid == os.geteuid():
        raise ProofError("expected separate non-root signer UID")
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as sock:
        sock.settimeout(3)
        sock.connect(str(socket_path))
        pid, uid, gid = struct.unpack("3i", sock.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
        if uid != signer_uid or pid <= 0:
            raise ProofError("peer is not the expected signer service UID")
        outgoing = (json.dumps(request, separators=(",", ":")) + "\n").encode()
        if len(outgoing) > MAX_FRAME:
            raise ProofError("oversized request")
        sock.sendall(outgoing)
        response = bytearray()
        while len(response) <= MAX_FRAME * 2:
            buf = sock.recv(512)
            if not buf:
                break
            response += buf
            if buf.endswith(b"\n"):
                break
        if len(response) > MAX_FRAME * 2 or not response.endswith(b"\n"):
            raise ProofError("invalid signer response")
        parsed = json.loads(response)
        if not parsed.get("ok"):
            raise ProofError("signer rejected request")
        proof = parsed["proof"]
        if (proof.get("service") != SERVICE_ID or proof.get("signer_uid") != uid or
                proof.get("signer_pid") != pid or proof.get("authority") != "ownership-proof-only"):
            raise ProofError("signer response identity mismatch")
        # Independent host verification is mandatory for anything beyond
        # receipt of an ownership signature; NOT asserted by this client.
        if proof.get("host_observation_independently_verified") is not False:
            raise ProofError("false observation verification assertion")
        return proof
