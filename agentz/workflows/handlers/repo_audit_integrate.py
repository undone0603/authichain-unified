"""Deterministic repo-integration agent.

Audits a local checkout of authichain-unified. Outside dry-run it may
rewrite only:

- the canonical banner in docs/NETWORK.md
- docs/operations/REPO-INTEGRATION-AUDIT.md

It does not deploy, delete Workers, disable workflows, rotate tokens,
publish packages, transfer the repository, or send email, charges, or posts.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from agentz.core.modes import ExecutionContext

CANONICAL_START = "<!-- repo-audit-integrate:canonical:start -->"
CANONICAL_END = "<!-- repo-audit-integrate:canonical:end -->"
NETWORK_REL = Path("docs/NETWORK.md")
AUDIT_REL = Path("docs/operations/REPO-INTEGRATION-AUDIT.md")
LEDGER_REL = Path("config/cloudflare-estate.json")
WORKSPACE_REL = Path("pnpm-workspace.yaml")
SKIP_DIRS = {"node_modules", ".git", "dist", "build", ".next"}

REFUSED = (
    "delete or retire Cloudflare Workers",
    "disable GitHub workflows",
    "rotate CLOUDFLARE_API_TOKEN or any other secret",
    "merge pull requests, including the authichain-verify npm publish",
    "npm publish",
    "transfer the repository to an organization",
    "send email, create a Stripe charge, or post to social",
)


@dataclass
class Finding:
    severity: str
    code: str
    detail: str


@dataclass
class AuditReport:
    generated_at: str
    findings: list[Finding] = field(default_factory=list)
    counts: dict[str, int] = field(default_factory=dict)


def repo_root(start: Path | None = None) -> Path:
    here = (start or Path(__file__)).resolve()
    for candidate in (here, *here.parents):
        if (candidate / "agentz" / "workflows" / "registry.yaml").is_file():
            return candidate
    raise FileNotFoundError("authichain-unified checkout not found")


def _wrangler_names(root: Path) -> dict[str, list[str]]:
    found: dict[str, list[str]] = {}
    for path in root.rglob("wrangler.toml"):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        match = re.search(r'^name\s*=\s*"([^"]+)"', text, re.M)
        if not match:
            continue
        found.setdefault(match.group(1), []).append(path.relative_to(root).as_posix())
    return found


def _on_block(text: str) -> str:
    lines: list[str] = []
    for line in text.splitlines():
        if line.strip().startswith("#"):
            continue
        lines.append(line)
    body = "\n".join(lines) + "\n"
    match = re.search(r"^on:\n(?P<body>(?:^[ \t].*\n)*)", body, re.M)
    return match.group("body") if match else ""


def pushes_every_main_commit(text: str) -> bool:
    block = _on_block(text)
    return "push:" in block and re.search(r"-\s+main\b", block) is not None and "paths:" not in block


def canonical_banner() -> str:
    return "\n".join(
        [
            "# AuthiChain Network Map",
            "",
            "Refreshed by `repo_audit_integrate`. This banner is the deploy authority for this file. The July 15, 2026 inventory below is historical.",
            "",
            "| Surface | Authority |",
            "|---|---|",
            "| Code | `undone0603/authichain-unified` |",
            "| Runtime | Cloudflare Workers. See `docs/ESTATE.md`, `docs/operations/CLOUDFLARE_FIRST_BASELINE.md`, and `config/cloudflare-estate.json`. |",
            "| Deploys | `deploy-workers.yml` (`workers/**`), `deploy-cloudflare.yml`, `deploy-edge-worker.yml`, `deploy-authichain-com.yml`, `deploy-verifier-web.yml`. `deploy-qron-ai-api.yml` is manual. |",
            "| Not a deploy | Vercel. `scripts/guard-vercel-deploy.mjs` fails a workflow that adds a Vercel deploy step. |",
            "| Data | Drizzle migrations into Supabase Postgres. D1 is not a second product schema. |",
            "| Workspace | `pnpm-workspace.yaml` includes `apps/*`, `packages/*`, `workers/*`, `worker`, and `mcp`. |",
            "| This agent | `python -m agentz.cli run repo_audit_integrate --mode dry-run` |",
            "",
            "Moving the repo to `AuthiChain2026/authichain-unified` is optional hygiene, not a launch gate. Worker retirement stays a dashboard decision after `node scripts/cloudflare/audit-estate.mjs`.",
        ]
    )


def apply_canonical_banner(text: str) -> str:
    newline = "\r\n" if "\r\n" in text else "\n"
    normalized = text.replace("\r\n", "\n")
    block = f"{CANONICAL_START}\n{canonical_banner().strip()}\n{CANONICAL_END}\n"
    if CANONICAL_START in normalized and CANONICAL_END in normalized:
        _, rest = normalized.split(CANONICAL_START, 1)
        _, post = rest.split(CANONICAL_END, 1)
        updated = block + "\n" + post.lstrip("\n")
    else:
        demoted = normalized.replace("# AuthiChain Network Map\n", "## Historical inventory (2026-07-15)\n", 1)
        updated = block + "\n" + demoted
    if newline == "\r\n":
        updated = updated.replace("\n", "\r\n")
    return updated


def audit(root: Path) -> AuditReport:
    report = AuditReport(generated_at=datetime.now(timezone.utc).replace(microsecond=0).isoformat())
    findings = report.findings
    network_path = root / NETWORK_REL
    network = network_path.read_text(encoding="utf-8") if network_path.is_file() else ""
    if CANONICAL_START not in network or CANONICAL_END not in network:
        findings.append(
            Finding(
                "drift",
                "network_map_stale",
                "docs/NETWORK.md has no repo-audit-integrate banner, so the July 2026 Vercel inventory still reads as current.",
            )
        )
    else:
        findings.append(
            Finding(
                "ok",
                "network_map_marked",
                "docs/NETWORK.md carries the Cloudflare canonical banner. The July inventory is historical.",
            )
        )

    workspace_path = root / WORKSPACE_REL
    workspace = workspace_path.read_text(encoding="utf-8") if workspace_path.is_file() else ""
    historical = network.split(CANONICAL_END, 1)[-1] if CANONICAL_END in network else network
    if "apps/*" in workspace and "not in any pnpm workspace" in historical:
        severity = "note" if CANONICAL_START in network else "drift"
        findings.append(
            Finding(
                severity,
                "workspace_history",
                "pnpm-workspace.yaml includes apps/*, but the July network map still says those trees are outside the workspace.",
            )
        )

    workflow_dir = root / ".github" / "workflows"
    workflow_files = sorted(workflow_dir.glob("*.yml")) if workflow_dir.is_dir() else []
    scheduled = 0
    unfiltered: list[str] = []
    for path in workflow_files:
        text = path.read_text(encoding="utf-8", errors="replace")
        if re.search(r"^\s*schedule:\s*$", text, re.M):
            scheduled += 1
        if path.name.startswith("deploy-") and pushes_every_main_commit(text):
            unfiltered.append(path.name)
    report.counts["workflows"] = len(workflow_files)
    report.counts["scheduled_workflows"] = scheduled
    findings.append(
        Finding(
            "note",
            "scheduled_workflow_load",
            f"{scheduled} of {len(workflow_files)} workflows declare a schedule. This agent does not disable any of them.",
        )
    )
    if unfiltered:
        findings.append(
            Finding(
                "note",
                "deploy_push_overlap",
                "These deploy workflows run on every push to main, with no path filter: " + ", ".join(unfiltered) + ".",
            )
        )

    names = _wrangler_names(root)
    ledger: dict[str, dict] = {}
    ledger_path = root / LEDGER_REL
    if ledger_path.is_file():
        payload = json.loads(ledger_path.read_text(encoding="utf-8"))
        ledger = payload.get("workers") or {}
    missing = sorted(set(names) - set(ledger))
    duplicates = sorted(
        name
        for name, paths in names.items()
        if len(paths) > 1 and (ledger.get(name) or {}).get("status") != "duplicate-transitional"
    )
    report.counts["wrangler_identities"] = len(names)
    report.counts["ledger_workers"] = len(ledger)
    report.counts["wrangler_not_in_ledger"] = len(missing)
    if missing:
        findings.append(
            Finding(
                "note",
                "wrangler_not_in_ledger",
                f"{len(missing)} Wrangler identities are not in {LEDGER_REL.as_posix()}: " + ", ".join(missing) + ".",
            )
        )
    if duplicates:
        findings.append(
            Finding(
                "drift",
                "duplicate_wrangler_identity",
                "Wrangler name declared more than once and not marked duplicate-transitional: " + ", ".join(duplicates) + ".",
            )
        )
    collisions = sorted(name for name, entry in ledger.items() if entry.get("status") == "identity-collision")
    if collisions:
        findings.append(
            Finding(
                "note",
                "ledger_identity_collision",
                "Ledger marks an identity collision. Confirm in Cloudflare before any retirement: " + ", ".join(collisions) + ".",
            )
        )

    gitmodules = root / ".gitmodules"
    if gitmodules.is_file() and "opensam" in gitmodules.read_text(encoding="utf-8").lower():
        findings.append(
            Finding(
                "note",
                "opensam_submodule",
                "libs/opensam is an external submodule and is not part of the verification path. Vendor a pin or remove it; this agent does neither.",
            )
        )

    findings.append(
        Finding(
            "ok",
            "mutations_refused",
            "Refused on every run: " + "; ".join(REFUSED) + ".",
        )
    )
    return report


def render_report(report: AuditReport) -> str:
    lines = [
        "# Repo integration audit",
        "",
        f"Generated by `repo_audit_integrate` at {report.generated_at}.",
        "",
        "This file is the agent's latest local audit. It is not a Cloudflare API listing and it does not authorize a delete.",
        "",
        "## Counts",
        "",
        "| Count | Value |",
        "|---|---|",
    ]
    for key, value in report.counts.items():
        lines.append(f"| {key} | {value} |")
    lines.extend(["", "## Findings", ""])
    for finding in report.findings:
        lines.append(f"- **{finding.severity}** `{finding.code}` — {finding.detail}")
    lines.extend(
        [
            "",
            "## Run again",
            "",
            "```bash",
            "python -m agentz.cli run repo_audit_integrate --mode dry-run",
            "python -m agentz.cli run repo_audit_integrate --mode auto",
            "```",
            "",
            "`auto` rewrites this report and the banner in `docs/NETWORK.md` only.",
            "",
        ]
    )
    return "\n".join(lines)


def _write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def run(ctx: ExecutionContext) -> str:
    root = repo_root()
    network_path = root / NETWORK_REL

    def _write_banner() -> str:
        updated = apply_canonical_banner(network_path.read_text(encoding="utf-8"))
        _write_text(network_path, updated)
        return "wrote network banner"

    ctx.step(
        "Rewrite the canonical banner in docs/NETWORK.md",
        _write_banner,
    )
    report = audit(root)
    rendered = render_report(report)

    def _write_report() -> str:
        _write_text(root / AUDIT_REL, rendered)
        return "wrote audit report"

    ctx.step(
        "Write docs/operations/REPO-INTEGRATION-AUDIT.md",
        _write_report,
    )
    print(rendered)
    return rendered
