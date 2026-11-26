"""Offline OTS parsing + read-only, loopback Bitcoin Core RPC verification.

No wallet operations, calendar requests, explorer fallback or transaction broadcast.
A successful result establishes a match to the configured node, not operator
independence or the node's historical validation provenance.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import subprocess
from pathlib import Path

MAX_PROOF_BYTES = 1024 * 1024
MAX_ATTESTATIONS = 64
HEX64 = re.compile(r"[0-9a-f]{64}")
RPC_METHODS = frozenset({"getblockchaininfo", "getblockhash", "getblockheader"})


class VerificationError(Exception):
    """Verification could not establish the requested chain commitment."""


def _core_rpc(method, *args):
    if method not in RPC_METHODS:
        raise VerificationError("RPC method not allowed")
    try:
        result = subprocess.run(
            ["bitcoin-cli", "-chain=main", "-rpcconnect=127.0.0.1",
             "-rpcport=8332", "-rpcclienttimeout=10", method, *map(str, args)],
            capture_output=True, text=True, timeout=15, check=True,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise VerificationError("local Bitcoin Core RPC unavailable") from exc
    output = result.stdout.strip()
    if method == "getblockchaininfo":
        try:
            return json.loads(output)
        except ValueError as exc:
            raise VerificationError("invalid blockchain info") from exc
    return output


def _chain_state(info):
    if not isinstance(info, dict) or info.get("chain") != "main":
        raise VerificationError("mainnet required")
    if info.get("initialblockdownload") is not False:
        raise VerificationError("initial block download incomplete")
    blocks, headers = info.get("blocks"), info.get("headers")
    tip = info.get("bestblockhash")
    if (type(blocks) is not int or type(headers) is not int or
            blocks < 0 or blocks != headers or not isinstance(tip, str) or
            not HEX64.fullmatch(tip)):
        raise VerificationError("node not synchronized or invalid tip")
    return blocks, tip


def _verify_commitments(attestations, min_confirmations, rpc):
    if type(min_confirmations) is not int or min_confirmations < 1:
        raise VerificationError("positive confirmation threshold required")
    if not 1 <= len(attestations) <= MAX_ATTESTATIONS:
        raise VerificationError("missing or excessive Bitcoin attestations")
    tip, best = _chain_state(rpc("getblockchaininfo"))
    evidence = []
    for height, merkle in attestations:
        if (type(height) is not int or height < 0 or height > tip or
                not isinstance(merkle, bytes) or len(merkle) != 32):
            raise VerificationError("invalid Bitcoin commitment")
        confirmations = tip - height + 1
        if confirmations < min_confirmations:
            raise VerificationError("insufficient confirmations")
        block_hash = rpc("getblockhash", height)
        if not isinstance(block_hash, str) or not HEX64.fullmatch(block_hash):
            raise VerificationError("invalid block hash")
        raw = rpc("getblockheader", block_hash, "false")
        if not isinstance(raw, str) or not re.fullmatch(r"[0-9a-f]{160}", raw):
            raise VerificationError("invalid block header")
        header = bytes.fromhex(raw)
        actual_hash = hashlib.sha256(hashlib.sha256(header).digest()).digest()[::-1].hex()
        if actual_hash != block_hash or header[36:68] != merkle:
            raise VerificationError("block hash or Merkle commitment mismatch")
        bits = int.from_bytes(header[72:76], "little")
        exponent, mantissa = bits >> 24, bits & 0x007fffff
        if bits & 0x00800000 or not 3 <= exponent <= 32 or mantissa == 0:
            raise VerificationError("invalid compact target")
        target = mantissa << (8 * (exponent - 3))
        pow_limit = 0x00ffff << (8 * (0x1d - 3))
        if target > pow_limit or int(actual_hash, 16) > target:
            raise VerificationError("invalid proof of work")
        evidence.append({"height": height, "hash": block_hash,
                         "header_hex": raw, "confirmations": confirmations})
    if _chain_state(rpc("getblockchaininfo")) != (tip, best):
        raise VerificationError("chain tip changed; retry verification")
    return evidence


def verify(artifact: Path, proof: Path, min_confirmations: int = 6):
    """Verify every Bitcoin attestation in an existing detached OTS proof."""
    try:
        from opentimestamps.core.notary import BitcoinBlockHeaderAttestation
        from opentimestamps.core.op import OpSHA256
        from opentimestamps.core.serialize import StreamDeserializationContext
        from opentimestamps.core.timestamp import DetachedTimestampFile
    except ImportError as exc:
        raise VerificationError("optional opentimestamps dependency unavailable") from exc
    try:
        with proof.open("rb") as f:
            raw = f.read(MAX_PROOF_BYTES + 1)
        if len(raw) > MAX_PROOF_BYTES:
            raise VerificationError("proof exceeds size limit")
        stream = io.BytesIO(raw)
        detached = DetachedTimestampFile.deserialize(StreamDeserializationContext(stream))
        if stream.read(1):
            raise VerificationError("trailing proof data")
        if not isinstance(detached.file_hash_op, OpSHA256):
            raise VerificationError("SHA-256 detached proof required")
        digest = hashlib.sha256()
        with artifact.open("rb") as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b""):
                digest.update(chunk)
        if digest.digest() != detached.file_digest:
            raise VerificationError("artifact digest mismatch")
        commitments = [(a.height, msg) for msg, a in detached.timestamp.all_attestations()
                       if isinstance(a, BitcoinBlockHeaderAttestation)]
        blocks = _verify_commitments(commitments, min_confirmations, _core_rpc)
        return {"status": "verified_against_local_node",
                "artifact_sha256": digest.hexdigest(),
                "proof_sha256": hashlib.sha256(raw).hexdigest(),
                "blocks": blocks, "operator_independence": "unverified",
                "node_validation_provenance": "unverified"}
    except VerificationError:
        raise
    except Exception as exc:
        raise VerificationError("artifact or proof could not be verified") from exc


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("artifact", type=Path)
    parser.add_argument("proof", type=Path)
    parser.add_argument("--min-confirmations", type=int, default=6)
    args = parser.parse_args()
    try:
        print(json.dumps(verify(args.artifact, args.proof, args.min_confirmations),
                         sort_keys=True))
        return 0
    except VerificationError as exc:
        print(json.dumps({"status": "unverified", "reason": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
