"""
agentz.workflows.handlers.gha_port
----------------------------------
Describe candidate GitHub Actions ports without executing them on the host.

Filename and environment filters are not a process or filesystem sandbox.
Dry-run describes the candidate command, but confirm and auto both fail
closed until a separately tested isolated executor with immutable, trusted
source and credential separation is implemented. Keep the existing GitHub
workflows enabled according to their existing operator holds.
"""
from __future__ import annotations

import os
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path

from agentz.core.modes import ExecutionContext, Mode

# Words that mark a release or outbound path. Matched against the whole argv.
REFUSED = re.compile(
    r"deploy|publish|release|promot|rollback|wrangler|vercel|secret|send|outreach|mint|"
    r"stripe|charge|payout|post-|social|email|resend|migrat",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class Port:
    source: str  # the GitHub workflow this replaces
    script: str  # repo-relative path under scripts/
    args: tuple[str, ...] = ()
    env: dict[str, str] = field(default_factory=dict)  # fixed values
    pass_env: tuple[str, ...] = ()  # copied from the AgentZ env if set
    timeout_s: int = 300


PORTS: dict[str, Port] = {
    "gha_honest_launch_gate": Port(
        source=".github/workflows/honest-launch-gate.yml",
        script="scripts/launch/honest-launch-gate.mjs",
        timeout_s=180,
    ),
    "gha_autonomy_manifest_check": Port(
        source=".github/workflows/autonomy-reconcile.yml (check job)",
        script="scripts/autonomy/reconcile.mjs",
        args=("--check",),
        timeout_s=60,
    ),
}


def repo_root(start: Path | None = None) -> Path:
    here = (start or Path(__file__)).resolve()
    for candidate in (here, *here.parents):
        if (candidate / "agentz" / "workflows" / "registry.yaml").is_file():
            return candidate
    raise FileNotFoundError("authichain-unified checkout not found")


def find_node() -> str | None:
    """AGENTZ_NODE wins; then PATH; then the newest nvm install."""
    explicit = os.environ.get("AGENTZ_NODE")
    if explicit and Path(explicit).is_file():
        return explicit
    found = shutil.which("node")
    if found:
        return found
    nvm = Path.home() / ".nvm" / "versions" / "node"
    if nvm.is_dir():
        bins = sorted(nvm.glob("v*/bin/node"))
        if bins:
            return str(bins[-1])
    return None


def check_port(port: Port, root: Path) -> list[str]:
    """Check basic paths and names; success does not authorize execution."""
    problems = []
    if not port.script.startswith("scripts/"):
        problems.append(f"script {port.script} is not under scripts/")
    if ".." in Path(port.script).parts:
        problems.append(f"script {port.script} leaves the repo")
    script_path = root / port.script
    if not script_path.is_file():
        problems.append(f"script {port.script} does not exist in {root}")
    else:
        try:
            script_path.resolve(strict=True).relative_to(root.resolve(strict=True))
        except (OSError, RuntimeError, ValueError):
            problems.append(f"script {port.script} resolves outside the repo or cannot be resolved")
    argv = " ".join((port.script, *port.args))
    if REFUSED.search(argv):
        problems.append(f"refused: '{argv}' matches a release/outbound word")
    for name in (*port.env, *port.pass_env):
        if REFUSED.search(name) or name.endswith(("_KEY", "_TOKEN", "_SECRET")):
            problems.append(f"refused: env {name} looks like a credential")
    return problems


def child_env(port: Port) -> dict[str, str]:
    # Environment filtering alone does not isolate filesystem credentials.
    env = {k: os.environ[k] for k in ("PATH", "HOME") if k in os.environ}
    env.update(port.env)
    for name in port.pass_env:
        if name in os.environ:
            env[name] = os.environ[name]
    return env


def run(ctx: ExecutionContext) -> str:
    # A returned "red" string is reported as successful by some callers.
    # Raise before any lookup or prompt so every non-dry-run fails visibly.
    if ctx.mode != Mode.DRY_RUN:
        raise RuntimeError("host execution disabled until an isolated executor is verified")
    port = PORTS.get(ctx.workflow_id)
    if port is None:
        return f"red: no port defined for {ctx.workflow_id}"
    root = repo_root()
    problems = check_port(port, root)
    if problems:
        return "red: port refused\n" + "\n".join(f"- {p}" for p in problems)
    node = find_node()
    if node is None:
        return "red: node not found (set AGENTZ_NODE or install node)"
    shown = " ".join(["node", port.script, *port.args])
    ctx.step(f"Describe `{shown}` (candidate replacement for {port.source})")
    return f"dry-run: would run `{shown}` in {root} (host execution disabled)"
