"""Browser handoff exchange: open -> taken -> done, addressed, expiring, owner-only."""
import io
import json
import os
import stat
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from agentz.core import browser_handoff as bh

URL = "https://example.com/login"


class HandoffTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name) / "handoff"
        self._env = patch.dict(os.environ, {"AGENTZ_HANDOFF_DIR": str(self.root)})
        self._env.start()

    def tearDown(self):
        self._env.stop()
        self._tmp.cleanup()

    def test_full_lifecycle_is_addressed_to_the_other_party(self):
        offered = bh.offer("agentz", URL, "captcha on sign-in")
        self.assertEqual((offered["from"], offered["to"], offered["state"]),
                         ("agentz", "operator", "open"))
        self.assertFalse(offered["trusted"])
        self.assertEqual([h["id"] for h in bh.list_handoffs(for_party="operator")], [offered["id"]])
        self.assertEqual(bh.list_handoffs(for_party="agentz"), [])

        taken = bh.take(offered["id"], "operator")
        self.assertEqual((taken["state"], taken["taken_by"]), ("taken", "operator"))
        closed = bh.done(offered["id"], "operator", "signed in; page reachable")
        self.assertEqual((closed["state"], closed["result"]), ("done", "signed in; page reachable"))
        self.assertEqual(bh.list_handoffs(), [])
        self.assertEqual([h["state"] for h in bh.list_handoffs(include_closed=True)], ["done"])

    def test_only_the_addressee_can_take_and_only_once(self):
        offered = bh.offer("operator", URL)
        with self.assertRaisesRegex(bh.HandoffError, "addressed to agentz"):
            bh.take(offered["id"], "operator")
        bh.take(offered["id"], "agentz")
        with self.assertRaisesRegex(bh.HandoffError, "taken, not open"):
            bh.take(offered["id"], "agentz")

    def test_only_the_taker_can_close(self):
        offered = bh.offer("agentz", URL)
        with self.assertRaisesRegex(bh.HandoffError, "open, not taken"):
            bh.done(offered["id"], "operator")
        bh.take(offered["id"], "operator")
        with self.assertRaisesRegex(bh.HandoffError, "taken by operator"):
            bh.done(offered["id"], "agentz")

    def test_expired_handoffs_cannot_be_acted_on_and_are_hidden(self):
        offered = bh.offer("agentz", URL, ttl_minutes=1)
        later = datetime.now(timezone.utc) + timedelta(minutes=2)
        with patch.object(bh, "_now", return_value=later):
            self.assertEqual(bh.list_handoffs(), [])
            self.assertEqual([h["state"] for h in bh.list_handoffs(include_closed=True)], ["expired"])
            with self.assertRaisesRegex(bh.HandoffError, "expired, not open"):
                bh.take(offered["id"], "operator")

    def test_private_and_non_https_urls_are_refused(self):
        for url in ("http://example.com/", "https://127.0.0.1/", "https://localhost/",
                    "https://10.0.0.5/admin", "https://169.254.169.254/latest", "https://user:pw@example.com/"):
            with self.assertRaises(bh.HandoffError, msg=url):
                bh.offer("agentz", url)
        self.assertEqual(list(self.root.glob("*.json")), [])

    def test_input_bounds(self):
        with self.assertRaises(bh.HandoffError):
            bh.offer("someone-else", URL)
        with self.assertRaises(bh.HandoffError):
            bh.offer("agentz", URL, "x" * (bh.MAX_NOTE_CHARS + 1))
        with self.assertRaises(bh.HandoffError):
            bh.offer("agentz", URL, "bell\x07")
        for ttl in (0, bh.MAX_TTL_MINUTES + 1, "60"):
            with self.assertRaises(bh.HandoffError):
                bh.offer("agentz", URL, ttl_minutes=ttl)
        for bad_id in ("../etc/passwd", "ABC", "", "0" * 31):
            with self.assertRaises(bh.HandoffError):
                bh.take(bad_id, "operator")
        offered = bh.offer("agentz", URL)
        bh.take(offered["id"], "operator")
        with self.assertRaises(bh.HandoffError):
            bh.done(offered["id"], "operator", "y" * (bh.MAX_RESULT_CHARS + 1))

    def test_open_handoffs_are_capped(self):
        with patch.object(bh, "MAX_OPEN", 2):
            bh.offer("agentz", URL)
            bh.offer("operator", URL)
            with self.assertRaisesRegex(bh.HandoffError, "already open"):
                bh.offer("agentz", URL)

    def test_files_are_owner_only_and_damaged_files_are_skipped(self):
        offered = bh.offer("agentz", URL)
        self.assertEqual(stat.S_IMODE(self.root.stat().st_mode), 0o700)
        path = self.root / f"{offered['id']}.json"
        self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
        (self.root / ("f" * 32 + ".json")).write_text("{not json")
        self.assertEqual([h["id"] for h in bh.list_handoffs()], [offered["id"]])

    def test_relative_exchange_dir_is_refused(self):
        with patch.dict(os.environ, {"AGENTZ_HANDOFF_DIR": "relative/dir"}):
            with self.assertRaises(bh.HandoffError):
                bh.list_handoffs()

    def test_cli_round_trip_prints_json(self):
        out = io.StringIO()
        with redirect_stdout(out):
            self.assertEqual(bh.main(["offer", "--from", "agentz", "--url", URL, "--note", "n"]), 0)
        handoff_id = json.loads(out.getvalue())["id"]
        for argv in (["list", "--for", "operator"], ["take", handoff_id, "--by", "operator"],
                     ["done", handoff_id, "--by", "operator", "--result", "ok"]):
            out = io.StringIO()
            with redirect_stdout(out):
                self.assertEqual(bh.main(argv), 0, argv)
            json.loads(out.getvalue())
        err = io.StringIO()
        with redirect_stderr(err):
            self.assertEqual(bh.main(["take", handoff_id, "--by", "operator"]), 1)
        self.assertFalse(json.loads(err.getvalue())["ok"])


if __name__ == "__main__":
    unittest.main()
