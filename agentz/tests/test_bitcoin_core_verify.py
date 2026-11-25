"""Offline regression tests; no live wallet, node, credentials, or network."""
import ast
import asyncio
import hashlib
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

CORE = Path(__file__).resolve().parents[1] / "core"
spec = importlib.util.spec_from_file_location("bitcoin_core_verify", CORE / "bitcoin_core_verify.py")
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)

# Public Bitcoin genesis block header: fixed, non-secret known-answer vector.
HEADER = (
    "01000000" + "00" * 32 +
    "3ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a" +
    "29ab5f49ffff001d1dac2b7c"
)
BLOCK_HASH = "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f"
MERKLE = bytes.fromhex(HEADER)[36:68]
TIP = {"chain": "main", "initialblockdownload": False, "blocks": 100,
       "headers": 100, "bestblockhash": "12" * 32}


class BitcoinCoreTests(unittest.TestCase):
    def rpc(self, method, *args):
        if method == "getblockchaininfo":
            return dict(TIP)
        if method == "getblockhash":
            self.assertEqual(args, (0,))
            return BLOCK_HASH
        if method == "getblockheader":
            self.assertEqual(args, (BLOCK_HASH, "false"))
            return HEADER
        self.fail("unexpected RPC method")

    def check(self, rpc=None, commitments=None, confirmations=6):
        return verifier._verify_commitments(
            [(0, MERKLE)] if commitments is None else commitments,
            confirmations, self.rpc if rpc is None else rpc)

    def test_valid_header(self):
        evidence = self.check()
        self.assertEqual(evidence[0]["confirmations"], 101)
        self.assertEqual(evidence[0]["hash"], BLOCK_HASH)

    def test_wrong_merkle(self):
        with self.assertRaises(verifier.VerificationError):
            self.check(commitments=[(0, b"\x00" * 32)])

    def test_no_attestations(self):
        with self.assertRaises(verifier.VerificationError):
            self.check(commitments=[])

    def test_insufficient_confirmations(self):
        with self.assertRaises(verifier.VerificationError):
            self.check(confirmations=102)

    def test_chain_state_rejections(self):
        for change in [{"chain": "test"}, {"initialblockdownload": True},
                       {"headers": 101}, {"bestblockhash": None},
                       {"blocks": True}, {"initialblockdownload": None}]:
            with self.subTest(change=change), self.assertRaises(verifier.VerificationError):
                self.check(rpc=lambda m, *a: {**TIP, **change})

    def test_reorg_or_tip_change(self):
        states = iter([TIP, {**TIP, "bestblockhash": "34" * 32}])
        def rpc(method, *args):
            return next(states) if method == "getblockchaininfo" else self.rpc(method, *args)
        with self.assertRaises(verifier.VerificationError):
            self.check(rpc=rpc)

    def test_wrong_hash(self):
        def rpc(method, *args):
            return "00" * 32 if method == "getblockhash" else HEADER if method == "getblockheader" else TIP
        with self.assertRaises(verifier.VerificationError):
            self.check(rpc=rpc)

    def test_tampered_header(self):
        def rpc(method, *args):
            return HEADER[:-2] + "00" if method == "getblockheader" else self.rpc(method, *args)
        with self.assertRaises(verifier.VerificationError):
            self.check(rpc=rpc)

    def test_invalid_pow(self):
        changed = HEADER[:-2] + "00"
        block_hash = hashlib.sha256(hashlib.sha256(bytes.fromhex(changed)).digest()).digest()[::-1].hex()
        def rpc(method, *args):
            return block_hash if method == "getblockhash" else changed if method == "getblockheader" else TIP
        with self.assertRaisesRegex(verifier.VerificationError, "proof of work"):
            self.check(rpc=rpc)

    def test_forbidden_rpc(self):
        with patch.object(verifier.subprocess, "run") as run:
            with self.assertRaises(verifier.VerificationError):
                verifier._core_rpc("sendrawtransaction", "00")
            run.assert_not_called()

    def test_cli_loopback_only(self):
        with patch.object(verifier.subprocess, "run") as run:
            run.return_value.stdout = BLOCK_HASH + "\n"
            self.assertEqual(verifier._core_rpc("getblockhash", 0), BLOCK_HASH)
            cmd = run.call_args.args[0]
            self.assertEqual(cmd, ["bitcoin-cli", "-chain=main", "-rpcconnect=127.0.0.1",
                                  "-rpcport=8332", "-rpcclienttimeout=10", "getblockhash", "0"])
            self.assertTrue(run.call_args.kwargs["check"])

    def test_unavailable_rpc(self):
        with patch.object(verifier.subprocess, "run", side_effect=FileNotFoundError):
            with self.assertRaises(verifier.VerificationError):
                verifier._core_rpc("getblockchaininfo")

    def test_simulation_cannot_claim_settlement(self):
        # Execute just the exact method AST, without initializing Polygon/web3.
        from typing import Dict, Any
        tree = ast.parse((CORE / "blockchain.py").read_text())
        cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == "BlockchainAgent")
        fn = next(n for n in cls.body if isinstance(n, ast.AsyncFunctionDef) and n.name == "anchor_to_bitcoin")
        scope = {"Dict": Dict, "Any": Any, "hashlib": hashlib}
        exec(compile(ast.Module(body=[fn], type_ignores=[]), "blockchain.py", "exec"), scope)
        result = asyncio.run(scope[fn.name](None, "test-product", "a" * 64))
        self.assertEqual(result["status"], "simulated")
        self.assertIsNone(result["inscription_id"])
        self.assertIsNone(result["sat_ordinal"])
        self.assertIs(result["on_chain"], False)
        self.assertIs(result["verified"], False)
        self.assertEqual(result["simulated_inscription_id"], "a" * 64 + "i0")

    def test_pending_proof_rejects_without_rpc(self):
        try:
            from opentimestamps.core.notary import PendingAttestation
            from opentimestamps.core.op import OpSHA256
            from opentimestamps.core.serialize import StreamSerializationContext
            from opentimestamps.core.timestamp import DetachedTimestampFile, Timestamp
        except ImportError:
            self.skipTest("optional opentimestamps dependency absent")
        import io
        data = b"synthetic pending proof"
        ts = Timestamp(hashlib.sha256(data).digest())
        ts.attestations.add(PendingAttestation("https://example.invalid"))
        stream = io.BytesIO()
        DetachedTimestampFile(OpSHA256(), ts).serialize(StreamSerializationContext(stream))
        with tempfile.TemporaryDirectory() as directory:
            a, p = Path(directory) / "artifact", Path(directory) / "proof.ots"
            a.write_bytes(data)
            p.write_bytes(stream.getvalue())
            with patch.object(verifier, "_core_rpc") as rpc:
                with self.assertRaisesRegex(verifier.VerificationError, "missing or excessive"):
                    verifier.verify(a, p)
                rpc.assert_not_called()
                a.write_bytes(b"wrong bytes")
                with self.assertRaisesRegex(verifier.VerificationError, "artifact digest mismatch"):
                    verifier.verify(a, p)
                rpc.assert_not_called()


if __name__ == "__main__":
    unittest.main()
