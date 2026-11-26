"""agentz.core.l402 must reproduce shared/l402-vectors.json exactly, like src/lib/l402.ts."""
import base64
import hashlib
import json
import unittest
from pathlib import Path

from agentz.core import l402

VECTORS = json.loads((Path(__file__).resolve().parents[2] / "shared/l402-vectors.json").read_text())
M = VECTORS["macaroon"]
ROOT = bytes.fromhex(M["rootKeyHex"])


class VectorTests(unittest.TestCase):
    def test_pricing(self):
        for p in VECTORS["pricing"]:
            self.assertEqual(str(l402.usd_atomic_to_sats(int(p["priceAtomicUsd"]), p["btcUsdCents"])), p["sats"])

    def test_mint_is_byte_identical_to_the_typescript_implementation(self):
        g = M["grant"]
        mac = l402.mint(ROOT, M["location"], bytes.fromhex(M["paymentHashHex"]), bytes.fromhex(M["tokenIdHex"]),
                        g["service"], g["capability"], g["resource"], g["validUntil"], int(g["priceMsat"]))
        self.assertEqual(base64.b64encode(mac).decode(), M["macaroonBase64"])
        self.assertEqual(l402.grant_caveats(g["service"], g["capability"], g["resource"], g["validUntil"],
                                            int(g["priceMsat"])), M["caveats"])
        ident = l402.encode_identifier(bytes.fromhex(M["paymentHashHex"]), bytes.fromhex(M["tokenIdHex"]))
        self.assertEqual(ident.hex(), M["identifierHex"])
        self.assertEqual(l402.signature(ROOT, ident, M["caveats"]).hex(), M["signatureHex"])
        self.assertEqual(hashlib.sha256(bytes.fromhex(M["preimageHex"])).hexdigest(), M["paymentHashHex"])

    def test_every_verify_case_gives_the_same_verdict(self):
        for case in VECTORS["verify"]:
            with self.subTest(case["name"]):
                e = case["expect"]
                got = l402.verify(case["authorization"], root_key=bytes.fromhex(case["rootKeyHex"]),
                                  service=e["service"], capability=e["capability"],
                                  resource=e["resource"], now_seconds=e["nowSeconds"])
                want = case["result"]
                if want["ok"]:
                    self.assertTrue(got["ok"], got)
                    self.assertEqual(got["payment_hash"], want["paymentHash"])
                    self.assertEqual(got["valid_until"], want["validUntil"])
                    self.assertEqual(str(got["price_msat"]), want["priceMsat"])
                else:
                    self.assertEqual(got, {"ok": False, "reason": want["reason"]})

    def test_parse_round_trip_and_strictness(self):
        raw = base64.b64decode(M["macaroonBase64"])
        self.assertEqual(l402.serialize(l402.parse(raw)), raw)
        self.assertIsNone(l402.parse(raw + b"\x00"))
        self.assertIsNone(l402.parse(b"\x01" + raw[1:]))
        self.assertIsNone(l402.parse(b""))


class ConfigAndChallengeTests(unittest.TestCase):
    ENV = {"L402_ROOT_KEY": "a1" * 32, "L402_BACKEND": "test", "NODE_ENV": "test", "L402_BTC_USD_CENTS": "9000000"}

    def test_off_unless_root_key_backend_and_test_runtime(self):
        self.assertIsNone(l402.config({}))
        self.assertIsNone(l402.config({**self.ENV, "L402_ROOT_KEY": "abcd"}))
        self.assertIsNone(l402.config({**self.ENV, "NODE_ENV": "production"}))
        self.assertIsNone(l402.config({**self.ENV, "L402_BACKEND": "strike"}))
        self.assertIsNotNone(l402.config(self.ENV))

    def test_challenge_pays_and_verifies_for_the_notary(self):
        cfg = l402.config(self.ENV)
        ch = l402.challenge(cfg, service="notary", capability="stamp", resource="/agentz/notary/paid",
                            price_atomic_usd=50_000, now_seconds=1_767_225_000)
        self.assertEqual(ch["sats"], 56)
        self.assertEqual(ch["valid_until"], 1_767_225_600)
        preimage = l402.test_backend().preimage_for(ch["payment_hash"])
        got = l402.verify(f"L402 {ch['macaroon']}:{preimage}", root_key=cfg.root_key, service="notary",
                          capability="stamp", resource="/agentz/notary/paid", now_seconds=1_767_225_010)
        self.assertTrue(got["ok"], got)
        self.assertEqual(got["price_msat"], 56_000)
        self.assertEqual(l402.replay_key(ch["payment_hash"].upper()), f"l402:ph:{ch['payment_hash']}")

    def test_refuses_a_backend_that_cannot_take_money_without_opt_in(self):
        cfg = l402.config(self.ENV)
        cfg.allow_test_backend = False
        with self.assertRaises(RuntimeError):
            l402.challenge(cfg, service="notary", capability="stamp", resource="/x", price_atomic_usd=1)

    def test_live_price_bounds(self):
        import io
        l402._PRICE_CACHE.clear()

        def opener(body):
            class R(io.BytesIO):
                def __enter__(self):
                    return self

                def __exit__(self, *a):
                    return False
            return lambda req, timeout=5: R(json.dumps(body).encode())

        self.assertEqual(l402.live_btc_usd_cents(opener({"data": {"amount": "90000.01", "currency": "USD"}}), now=0), 9_000_001)
        l402._PRICE_CACHE.clear()
        self.assertIsNone(l402.live_btc_usd_cents(opener({"data": {"amount": "5", "currency": "USD"}}), now=0))
        self.assertIsNone(l402.live_btc_usd_cents(opener({"data": {"amount": "90000", "currency": "EUR"}}), now=0))
        l402._PRICE_CACHE.clear()


if __name__ == "__main__":
    unittest.main()
