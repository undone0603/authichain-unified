"""Bounded navigation with public HTTPS URL checks.

The browser host must additionally block private network access at the network
layer, including redirects and DNS rebinding. This function alone is not SSRF
protection for a publicly exposed service.
"""
import ipaddress
import os
import subprocess
import uuid
from pathlib import Path
from urllib.parse import urlsplit


def validate_public_url(url: str) -> str:
    if not isinstance(url, str) or len(url) > 2048:
        raise ValueError("invalid URL")
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("public HTTPS URL required")
    host = parsed.hostname.lower().rstrip(".")
    if host in ("localhost", "metadata.google.internal") or host.endswith((".local", ".internal", ".localhost")):
        raise ValueError("private hostname forbidden")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        if "." not in host or not all(c.isascii() and (c.isalnum() or c in ".-") for c in host):
            raise ValueError("invalid public hostname")
    else:
        if not address.is_global:
            raise ValueError("private IP forbidden")
    return url


def navigate_public(url: str, *, timeout: int = 45) -> dict:
    """Browse a user-supplied public URL; never execute page instructions."""
    from agentz.core.capability_policy import decide
    if not decide("browser_read").allowed:
        raise PermissionError("browser read disabled")
    validate_public_url(url)
    if not isinstance(timeout, int) or timeout < 1 or timeout > 90:
        raise ValueError("invalid timeout")
    if os.environ.get("AGENTZ_BROWSER_NETWORK_ISOLATED") != "true":
        raise RuntimeError("network-isolated browser host required")
    executable = os.environ.get("AGENTZ_BROWSER_BIN", "")
    if not executable or not Path(executable).is_file():
        raise RuntimeError("local agent-browser CLI unavailable")
    session = "agentz-public-" + uuid.uuid4().hex
    env = {**os.environ, "AGENT_BROWSER_SESSION": session}
    def run(*argv):
        return subprocess.run([executable, *argv], env=env, text=True,
                              capture_output=True, timeout=timeout, check=False)
    try:
        opened = run("open", url)
        if opened.returncode:
            raise RuntimeError("navigation failed")
        snap = run("snapshot")
        if snap.returncode:
            raise RuntimeError("snapshot failed")
        # Output is untrusted page content, not instructions or authorization.
        return {"url": url, "snapshot": snap.stdout[:40000],
                "trusted": False, "session": session}
    finally:
        try:
            run("close")
        except (OSError, subprocess.TimeoutExpired):
            pass
