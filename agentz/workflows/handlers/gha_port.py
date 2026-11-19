"""
agentz.workflows.handlers.gha_port
----------------------------------
Run a GitHub Actions job's own repo script on the AgentZ host instead.

Each port is one registry workflow (`gha_<name>`) that maps to one entry in
PORTS below: the script the GitHub workflow already runs, the env vars it may
see, and a timeout. Nothing is passed through a shell. The child process gets
PATH and HOME plus only the listed env vars.

Only read-only jobs are ported here. A port is refused if its command or
script path looks like a deploy, publish, send, mint, charge or secret write,
so a later edit cannot quietly turn this into a release path. Those jobs stay
on GitHub behind their protected environments (docs/OPERATING_CHARTER.md).

Dry-run only describes the command. auto runs it from the checkout this
handler lives in (the pinned AgentZ worktree) and returns the exit code and
the tail of its output. A non-zero exit is reported as red, never hidden.
See docs/operations/AGENTZ-WORKFLOW-MIGRATION.md.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

from agentz.core.modes import ExecutionContext

OUTPUT_TAIL_CHARS = 4000

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
    """Reasons this port must not run. Empty means it may."""
    problems = []
    if not port.script.startswith("scripts/"):
        problems.append(f"script {port.script} is not under scripts/")
    if ".." in Path(port.script).parts:
        problems.append(f"script {port.script} leaves the repo")
    if not (root / port.script).is_file():
        problems.append(f"script {port.script} does not exist in {root}")
    argv = " ".join((port.script, *port.args))
    if REFUSED.search(argv):
        problems.append(f"refused: '{argv}' matches a release/outbound word")
    for name in (*port.env, *port.pass_env):
        if REFUSED.search(name) or name.endswith(("_KEY", "_TOKEN", "_SECRET")):
            problems.append(f"refused: env {name} looks like a credential")
    return problems


def child_env(port: Port) -> dict[str, str]:
    env = {k: os.environ[k] for k in ("PATH", "HOME") if k in os.environ}
    env.update(port.env)
    for name in port.pass_env:
        if name in os.environ:
            env[name] = os.environ[name]
    return env


def run(ctx: ExecutionContext) -> str:
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
    # Absolute path: the scripts only run main() when
    # import.meta.url === `file://${process.argv[1]}`.
    argv = [node, str(root / port.script), *port.args]
    shown = " ".join(["node", port.script, *port.args])

    def _run() -> str:
        try:
            proc = subprocess.run(
                argv,
                cwd=root,
                env=child_env(port),
                capture_output=True,
                text=True,
                timeout=port.timeout_s,
                check=False,
            )
        except subprocess.TimeoutExpired:
            return f"red: timed out after {port.timeout_s}s"
        out = (proc.stdout + proc.stderr)[-OUTPUT_TAIL_CHARS:]
        verdict = "green" if proc.returncode == 0 else "red"
        return f"{verdict}: exit {proc.returncode}\n{out}"

    result = ctx.step(f"Run `{shown}` (replaces {port.source})", _run)
    if result is None:
        return f"dry-run: would run `{shown}` in {root} (replaces {port.source})"
    return result
