"""Tests for agentz.core.verifier (independent post-run checks, fail-closed)."""

import http.server
import json
import os
import threading
import time

import pytest

from agentz.core import verifier as v


def test_no_checks_means_nothing_to_verify():
    for empty in (None, [], ()):
        result = v.run_checks(empty)
        assert result.ok is True and result.configured is False
    assert "nothing to verify" in v.run_checks(None).summary()


def test_file_exists_pass_and_fail(tmp_path):
    present = tmp_path / "a.txt"
    present.write_text("x")
    assert v.run_checks([{"type": "file_exists", "path": str(present)}]).ok
    assert not v.run_checks([{"type": "file_exists", "path": str(tmp_path / "nope")}]).ok


def test_file_contains(tmp_path):
    f = tmp_path / "out.txt"
    f.write_text("status: DONE\n")
    assert v.run_checks([{"type": "file_contains", "path": str(f), "text": "DONE"}]).ok
    assert not v.run_checks([{"type": "file_contains", "path": str(f), "text": "FAILED"}]).ok
    assert not v.run_checks([{"type": "file_contains", "path": str(tmp_path / "gone"), "text": "x"}]).ok


def test_file_fresh(tmp_path):
    f = tmp_path / "fresh.txt"
    f.write_text("x")
    assert v.run_checks([{"type": "file_fresh", "path": str(f), "max_age_seconds": 60}]).ok
    old = time.time() - 3600
    os.utime(f, (old, old))
    assert not v.run_checks([{"type": "file_fresh", "path": str(f), "max_age_seconds": 60}]).ok


def test_json_field_presence_equality_and_list_index(tmp_path):
    f = tmp_path / "r.json"
    f.write_text(json.dumps({"a": {"b": [10, {"c": "ok"}]}, "n": 3}))
    p = str(f)
    assert v.run_checks([{"type": "json_field", "path": p, "key": "a.b.1.c", "equals": "ok"}]).ok
    assert v.run_checks([{"type": "json_field", "path": p, "key": "n"}]).ok
    assert not v.run_checks([{"type": "json_field", "path": p, "key": "n", "equals": 4}]).ok
    assert not v.run_checks([{"type": "json_field", "path": p, "key": "a.zzz"}]).ok
    assert not v.run_checks([{"type": "json_field", "path": p, "key": "a.b.9"}]).ok


def test_malformed_json_fails_closed(tmp_path):
    f = tmp_path / "bad.json"
    f.write_text("{not json")
    result = v.run_checks([{"type": "json_field", "path": str(f), "key": "a"}])
    assert not result.ok and "error" in result.results[0].detail


@pytest.mark.parametrize(
    "spec",
    [
        {"type": "no_such_check"},
        {"path": "x"},
        {"type": "file_exists"},
        {"type": "file_contains", "path": "x"},
        "file_exists",
        42,
    ],
)
def test_unknown_or_malformed_checks_fail_closed(spec):
    result = v.run_checks([spec])
    assert result.ok is False and result.configured is True


def test_non_list_verify_block_fails_closed():
    assert not v.run_checks("file_exists").ok
    assert not v.run_checks({"type": "file_exists", "path": "x"}).ok


def test_all_checks_must_pass(tmp_path):
    f = tmp_path / "a.txt"
    f.write_text("x")
    result = v.run_checks(
        [{"type": "file_exists", "path": str(f)}, {"type": "file_exists", "path": str(tmp_path / "missing")}]
    )
    assert result.ok is False
    assert [r.ok for r in result.results] == [True, False]
    assert "FAIL" in result.summary() and "1/2" in result.summary()


class _Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        self.send_response(200 if self.path == "/ok" else 503)
        self.end_headers()
        self.wfile.write(b"x")

    def log_message(self, *args):
        pass


@pytest.fixture
def base_url():
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield "http://127.0.0.1:%d" % server.server_address[1]
    server.shutdown()
    server.server_close()


def test_http_status(base_url):
    assert v.run_checks([{"type": "http_status", "url": base_url + "/ok"}]).ok
    assert not v.run_checks([{"type": "http_status", "url": base_url + "/down"}]).ok
    assert v.run_checks([{"type": "http_status", "url": base_url + "/down", "expect": 503}]).ok


def test_http_status_rejects_non_http_schemes_and_dead_hosts(tmp_path):
    assert not v.run_checks([{"type": "http_status", "url": "file://" + str(tmp_path)}]).ok
    assert not v.run_checks([{"type": "http_status", "url": "http://127.0.0.1:1/", "timeout": 1}]).ok
