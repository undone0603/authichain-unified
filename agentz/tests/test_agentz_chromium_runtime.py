"""Hermetic tests for the AgentZ Playwright Chromium launcher."""
from __future__ import annotations

import json
import logging
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from agentz.core import chromium_runtime as runtime


def test_userns_args_skip_no_sandbox_and_always_disable_shm():
    args = runtime.chromium_launch_args(no_sandbox=False)
    assert "--disable-dev-shm-usage" in args
    assert "--disable-setuid-sandbox" in args
    assert "--no-sandbox" not in args


def test_no_sandbox_fallback_is_explicit():
    args = runtime.chromium_launch_args(no_sandbox=True)
    assert "--disable-dev-shm-usage" in args
    assert "--no-sandbox" in args


def test_forced_no_sandbox_skips_userns_attempt(monkeypatch):
    monkeypatch.setenv("AGENTZ_CHROMIUM_NO_SANDBOX", "1")
    attempts = runtime._launch_attempts()
    assert [mode for mode, _ in attempts] == ["no-sandbox"]


def test_default_attempts_prefer_userns(monkeypatch):
    monkeypatch.delenv("AGENTZ_CHROMIUM_NO_SANDBOX", raising=False)
    attempts = runtime._launch_attempts()
    assert [mode for mode, _ in attempts] == ["userns", "no-sandbox"]


class _FakeBrowser:
    def close(self):
        return None


def test_is_sandbox_error_matches_chromium_sandbox_failures_only():
    assert runtime.is_sandbox_error(RuntimeError("No usable sandbox!"))
    assert runtime.is_sandbox_error(
        RuntimeError(
            "Failed to move to new namespace: PID namespaces: Operation not permitted"
        )
    )
    assert runtime.is_sandbox_error(RuntimeError("The setuid sandbox is not running"))
    assert not runtime.is_sandbox_error(
        RuntimeError("Executable doesn't exist at /opt/ms-playwright/chrome")
    )
    assert not runtime.is_sandbox_error(RuntimeError("Browser closed"))
    assert not runtime.is_sandbox_error(RuntimeError("Timeout 30000ms exceeded"))


def test_launch_retries_no_sandbox_when_userns_fails(monkeypatch, caplog):
    monkeypatch.delenv("AGENTZ_CHROMIUM_NO_SANDBOX", raising=False)
    monkeypatch.setattr(runtime.shutil, "which", lambda _name: None)
    launches = []

    class Chromium:
        def launch(self, **kwargs):
            launches.append(kwargs)
            if "--no-sandbox" not in kwargs["args"]:
                raise RuntimeError("No usable sandbox!")
            return _FakeBrowser()

    with caplog.at_level(logging.WARNING, logger="agentz.core.chromium_runtime"):
        browser = runtime.launch_playwright_chromium(SimpleNamespace(chromium=Chromium()))
    assert isinstance(browser, _FakeBrowser)
    assert runtime.last_sandbox_mode() == "no-sandbox"
    assert len(launches) == 2
    assert "--no-sandbox" not in launches[0]["args"]
    assert "--no-sandbox" in launches[1]["args"]
    assert any("retrying with --no-sandbox" in rec.message for rec in caplog.records)


def test_launch_does_not_fallback_on_generic_error(monkeypatch, caplog):
    monkeypatch.delenv("AGENTZ_CHROMIUM_NO_SANDBOX", raising=False)
    monkeypatch.setattr(runtime.shutil, "which", lambda _name: None)
    launches = []

    class Chromium:
        def launch(self, **kwargs):
            launches.append(kwargs)
            raise RuntimeError("Executable doesn't exist at /opt/ms-playwright/chrome")

    with caplog.at_level(logging.WARNING, logger="agentz.core.chromium_runtime"):
        with pytest.raises(RuntimeError, match="Executable doesn't exist"):
            runtime.launch_playwright_chromium(SimpleNamespace(chromium=Chromium()))
    assert len(launches) == 1
    assert "--no-sandbox" not in launches[0]["args"]
    assert not any("retrying with --no-sandbox" in rec.message for rec in caplog.records)


def test_ensure_writable_runtime_dirs_creates_xdg_paths(tmp_path, monkeypatch):
    cfg = tmp_path / "config"
    monkeypatch.setenv("XDG_CONFIG_HOME", str(cfg))
    monkeypatch.setenv("XDG_CACHE_HOME", str(tmp_path / "cache"))
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path / "data"))
    monkeypatch.setenv("XDG_RUNTIME_DIR", str(tmp_path / "run"))
    monkeypatch.setenv("BROWSER_USE_CONFIG_DIR", str(cfg / "browseruse"))
    runtime.ensure_writable_runtime_dirs()
    assert (cfg / "browseruse").is_dir()
    assert (tmp_path / "cache").is_dir()
    assert (tmp_path / "data").is_dir()
    assert (tmp_path / "run").is_dir()


def test_smoke_flag_off_refuses_launch(monkeypatch):
    monkeypatch.setenv("AGENTZ_BROWSER_SMOKE", "0")
    with patch.object(runtime, "smoke_headless_launch", side_effect=AssertionError("must not launch")):
        assert runtime.main(["--smoke"]) == 2


def test_env_flag_runs_smoke(monkeypatch, capsys):
    monkeypatch.setenv("AGENTZ_BROWSER_SMOKE", "1")
    with patch.object(runtime, "smoke_headless_launch", return_value={"ok": True, "page": "about:blank"}):
        assert runtime.main([]) == 0
    out = capsys.readouterr().out
    payload = json.loads(out[out.rfind("{") :])
    assert payload["ok"] is True


def test_requirements_pin_playwright_160():
    text = open("requirements-agentz.txt", encoding="utf-8").read()
    assert "playwright==1.60.0" in text
    assert "playwright==" in text
    assert text.count("playwright==") == 1
