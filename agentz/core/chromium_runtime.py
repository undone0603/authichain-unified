"""AgentZ Playwright Chromium launcher for locked-down containers.

AgentZ browser workflows import the Playwright Python package
(``playwright==1.60.0`` in ``requirements-agentz.txt``) and ``browser-use``
(which drives Playwright Chromium). This module is the AgentZ-side launcher
for the first-party Playwright path. It does not download browsers at
runtime and does not call paid browser providers.

Sandbox (non-root, ``--cap-drop ALL``, ``--security-opt no-new-privileges``):
  Chromium's setuid sandbox needs a setuid helper and extra capabilities, so
  it cannot run here. The launcher first tries the user-namespace sandbox
  (``--disable-setuid-sandbox`` so Chromium uses userns) which needs no extra
  Docker capabilities when the host allows unprivileged user namespaces. If
  that launch fails with a *sandbox* error (``No usable sandbox``, namespace
  or setuid sandbox failures), it retries once with ``--no-sandbox`` and logs
  a WARN. Generic launch errors (missing binary, timeout, crash) do not
  trigger that fallback. Chosen mode is ``last_sandbox_mode()`` and
  ``sandbox_mode`` in smoke JSON.

  ``browser-use`` 0.11.13 is a separate path: when ``IN_DOCKER=1`` it always
  appends ``--no-sandbox`` itself. This launcher does not.

/dev/shm:
  Default Docker ``/dev/shm`` is 64 MB and Chromium will crash there. Always
  pass ``--disable-dev-shm-usage``. Alternatively run the container with
  ``--shm-size=1g``. The image smoke does not require a larger shm.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import shutil
import sys
from pathlib import Path
from typing import Any, Literal

SandboxMode = Literal["userns", "no-sandbox"]

_LAUNCH_TIMEOUT_MS = 30_000
_LAST_SANDBOX_MODE: SandboxMode | None = None
_LOGGER = logging.getLogger(__name__)

# Chromium / Playwright phrasing that means the *sandbox* is what failed.
# Do not treat missing binaries, timeouts, or generic "Browser closed" as
# a reason to disable the sandbox.
_SANDBOX_ERROR_MARKERS = (
    "no usable sandbox",
    "failed to move to new namespace",
    "namespace sandbox",
    "setuid sandbox",
    "suid sandbox",
    "sandbox helper",
    "zygote_host_impl_linux",
    "running as root without --no-sandbox",
    "pid namespaces",
    "user namespace",
)

_RUNTIME_DIR_ENV = (
    "XDG_CONFIG_HOME",
    "XDG_CACHE_HOME",
    "XDG_DATA_HOME",
    "XDG_RUNTIME_DIR",
    "BROWSER_USE_CONFIG_DIR",
)


def no_sandbox_forced() -> bool:
    """Operator override: skip userns and use --no-sandbox immediately."""
    return os.environ.get("AGENTZ_CHROMIUM_NO_SANDBOX") == "1"


def last_sandbox_mode() -> SandboxMode | None:
    """Sandbox mode of the most recent successful launch, if any."""
    return _LAST_SANDBOX_MODE


def is_sandbox_error(exc: BaseException) -> bool:
    """True when Chromium failed because its sandbox could not start."""
    text = str(exc).lower()
    cause = getattr(exc, "__cause__", None)
    if cause is not None:
        text = f"{text}\n{cause}".lower()
    return any(marker in text for marker in _SANDBOX_ERROR_MARKERS)


def ensure_writable_runtime_dirs() -> None:
    """Create XDG / browser-use dirs so a missing host HOME cannot break launch.

    Image ENV pins these to ``/app/.xdg/...`` and ``/tmp/agentz-runtime``.
    Host ``HOME=/home/<user>`` that does not exist in the image is ignored.
    """
    for key in _RUNTIME_DIR_ENV:
        path = os.environ.get(key)
        if path:
            Path(path).mkdir(parents=True, exist_ok=True)


def chromium_launch_args(*, no_sandbox: bool) -> list[str]:
    """CLI flags for a single Chromium launch attempt.

    ``--disable-setuid-sandbox`` skips the setuid helper (unusable as
    non-root under ``--cap-drop ALL``). Without ``--no-sandbox``, Chromium
    then uses its user-namespace sandbox. ``--no-sandbox`` is the fallback
    when userns is blocked by a sandbox error; keep it off the first attempt.
    """
    args = ["--disable-dev-shm-usage", "--disable-setuid-sandbox"]
    if no_sandbox:
        # Tradeoff: process isolation is weaker than userns/SUID sandboxing.
        # Accepted only because this process is already non-root, has no
        # extra capabilities, and cannot gain new privileges. Do not copy
        # this flag into unrelated binaries or a Docker --sysctl.
        args.append("--no-sandbox")
    return args


def _launch_attempts() -> list[tuple[SandboxMode, list[str]]]:
    if no_sandbox_forced():
        return [("no-sandbox", chromium_launch_args(no_sandbox=True))]
    return [
        ("userns", chromium_launch_args(no_sandbox=False)),
        ("no-sandbox", chromium_launch_args(no_sandbox=True)),
    ]


def launch_playwright_chromium(playwright: Any, *, headless: bool = True) -> Any:
    """Launch bundled Playwright Chromium, then system Chromium if needed."""
    global _LAST_SANDBOX_MODE
    ensure_writable_runtime_dirs()
    last_error: BaseException | None = None
    binaries: list[str | None] = [None]
    system = shutil.which("chromium") or shutil.which("chromium-browser")
    if system:
        binaries.append(system)

    for executable_path in binaries:
        for mode, args in _launch_attempts():
            kwargs: dict[str, Any] = {
                "headless": headless,
                "args": args,
                "timeout": _LAUNCH_TIMEOUT_MS,
            }
            if executable_path:
                kwargs["executable_path"] = executable_path
            try:
                browser = playwright.chromium.launch(**kwargs)
            except Exception as exc:  # Playwright wraps Chromium spawn failures
                last_error = exc
                if mode == "userns" and is_sandbox_error(exc):
                    _LOGGER.warning(
                        "Chromium user-namespace sandbox failed (%s); "
                        "retrying with --no-sandbox (weaker isolation, still non-root)",
                        exc,
                    )
                    continue
                break
            _LAST_SANDBOX_MODE = mode
            return browser

    if last_error is not None:
        raise last_error
    raise RuntimeError("Playwright Chromium launch produced no browser")


def smoke_headless_launch() -> dict[str, Any]:
    """Import Playwright and launch headless Chromium to about:blank."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        browser = launch_playwright_chromium(playwright, headless=True)
        try:
            page = browser.new_page()
            page.goto("about:blank")
            return {
                "ok": True,
                "headless": True,
                "sandbox_mode": last_sandbox_mode(),
                "page": "about:blank",
                "title": page.title(),
            }
        finally:
            browser.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--smoke",
        action="store_true",
        help="Import Playwright and launch headless Chromium (about:blank).",
    )
    args = parser.parse_args(argv)
    if os.environ.get("AGENTZ_BROWSER_SMOKE") == "0":
        print("AGENTZ_BROWSER_SMOKE=0; refusing to launch Chromium", file=sys.stderr)
        return 2
    if not args.smoke and os.environ.get("AGENTZ_BROWSER_SMOKE") != "1":
        parser.print_help()
        return 2
    result = smoke_headless_launch()
    print(json.dumps(result, sort_keys=True))
    return 0 if result.get("ok") is True else 1


if __name__ == "__main__":
    raise SystemExit(main())
