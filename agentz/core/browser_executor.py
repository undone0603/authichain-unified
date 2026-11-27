"""Bounded, read-only browser task executor backed by local agent-browser CLI.

This is an execution adapter, not a public proxy or arbitrary shell endpoint.
"""
import os
import re
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path

_ALLOWED = {
    "github-environment-audit": "https://github.com/undone0603/authichain-unified/settings/environments",
    "github-workflow-inspect": "https://github.com/undone0603/authichain-unified/actions/workflows/deploy-authichain-com.yml",
    "github-main-protection-inspect": "https://github.com/undone0603/authichain-unified/settings/branches",
    "github-repository-rulesets-inspect": "https://github.com/undone0603/authichain-unified/settings/rules",
}
_SHA = re.compile(r"^[0-9a-f]{40}$")

# Allow only subprocess runtime/profile settings. Do not inherit unrelated
# production secrets, credentials or arbitrary configuration variables. The
# HOME/XDG browser profile still requires an isolated, unprivileged OS identity.
BROWSER_ENV_KEYS = frozenset({
    "PATH", "HOME", "LANG", "LC_ALL", "LC_CTYPE", "TMPDIR",
    "XDG_RUNTIME_DIR", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_DATA_HOME",
})
_BROWSER_ENV_KEYS = BROWSER_ENV_KEYS

# Where the browser runs: the fail-closed AGENTZ_BROWSER_BIN wrapper
# (agentz/runtime/agentz-browser) picks the local isolated CDP host or a cloud
# browser provider from these. They are browser-provider settings only; no other
# credentials are passed through.
_BROWSER_CONNECTION_KEYS = frozenset({
    "AGENTZ_BROWSER_CDP_URL",
    "BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID",
    "BROWSER_USE_API_KEY",
})


def browser_subprocess_env(extra: dict[str, str] | None = None) -> dict[str, str]:
    """Minimal env for a browser CLI: runtime keys plus browser-provider settings.

    Service keys and operator tokens stay out.
    """
    env = {
        key: value for key, value in os.environ.items()
        if key in BROWSER_ENV_KEYS or key in _BROWSER_CONNECTION_KEYS
    }
    if extra:
        env.update(extra)
    return env


def execute_browser_task(task: str, *, timeout: int = 60) -> dict:
    """Execute a fixed, non-mutating browser inspection and retain evidence."""
    from agentz.core.capability_policy import decide
    if not decide("browser_read").allowed:
        raise PermissionError("browser inspection not permitted")
    if task not in _ALLOWED:
        raise ValueError("task is not allowlisted")
    if not isinstance(timeout, int) or not 1 <= timeout <= 120:
        raise ValueError("invalid timeout")
    executable = os.environ.get("AGENTZ_BROWSER_BIN")
    if not executable or not Path(executable).is_file():
        raise RuntimeError("AGENTZ_BROWSER_BIN must point to installed local agent-browser CLI")
    evidence_dir = Path(os.environ.get("AGENTZ_BROWSER_EVIDENCE_DIR", ""))
    if not evidence_dir.is_absolute() or not evidence_dir.is_dir():
        raise RuntimeError("existing absolute evidence directory required")
    run_id = uuid.uuid4().hex
    stamp = datetime.now(timezone.utc).isoformat()
    url = _ALLOWED[task]
    # A separate session prevents cross-task browser state leakage. CLI is
    # intentionally invoked with a fixed argv, never a shell or user command.
    session = "agentz-" + run_id
    env = browser_subprocess_env({"AGENT_BROWSER_SESSION": session})
    def call(*args):
        return subprocess.run(
            [executable, *args], capture_output=True, text=True,
            timeout=timeout, check=False, env=env,
        )
    try:
        opened = call("open", url)
        if opened.returncode:
            raise RuntimeError("browser open failed: " + opened.stderr[:300])
        snapshot = call("snapshot")
        if snapshot.returncode:
            raise RuntimeError("browser snapshot failed: " + snapshot.stderr[:300])
        output = snapshot.stdout[:100_000]
        path = evidence_dir / (run_id + ".txt")
        # Avoid accidentally publishing a signed-in snapshot. Owner-only file.
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(f"task={task}\nurl={url}\nutc={stamp}\n\n{output}")
        return {"run_id": run_id, "task": task, "status": "observed",
                "observed_at": stamp, "evidence_path": str(path),
                "verified": False}
    finally:
        try:
            call("close")
        except (OSError, subprocess.TimeoutExpired):
            pass
