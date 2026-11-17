"""
agentz.workflows.handlers.power_user_ops
----------------------------------------
Product-side power-user automations for AgentZ.

Five named automations in one registry workflow:

1. product_rails  — public GET/HEAD of farm checkout, x402, JWKS
2. revenue_stance — wait_buyer policy; never invents a buyer
3. x_draft_pack   — OpenClaw xurl pack (STATUS: DRAFT, no post)
4. openclaw_handoff — claw.authichain.com notify, dry-run unless asked
5. frozen_gates   — outreach freeze, autopilot off, no key rotation

Dry-run sends no HTTP. Live probes are read-only. This handler never
sends mail, never wrangler-deploys, never merges, never rotates
AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64, and never runs --mode auto
side-effects on money or outreach.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

from agentz.core.modes import ExecutionContext, Mode
from agentz.integrations.openclaw import OpenClawClient

USER_AGENT = "authichain-agentz-power-user/1.0"
PROBE_TIMEOUT_S = 12

FARM_CHECKOUT = "https://authichain.com/checkout/strainchain_farm"
FARM_PLAN_HEAD = "https://authichain.com/api/checkout/plan/strainchain_farm"
X402_QUOTE = "https://authichain.com/api/x402"
X402_HEALTH = "https://authichain.com/api/x402/health"
JWKS_JSON = "https://authichain.com/protocol/jwks.json"

LIVE_KID_PREFIX = "T3AL7c4w"
RETIRED_KID_PREFIX = "lue84wJN"

FOUNDER_EMAILS = ("undone.k@gmail.com", "authichain@gmail.com")


@dataclass(frozen=True)
class ProbeSpec:
    method: str
    url: str
    expect: int
    parse: str  # "none" | "jwks"


@dataclass(frozen=True)
class ProbeResult:
    status: int
    body: bytes = b""
    content_type: str = ""


RAILS: tuple[ProbeSpec, ...] = (
    ProbeSpec("GET", FARM_CHECKOUT, 200, "none"),
    ProbeSpec("HEAD", FARM_PLAN_HEAD, 204, "none"),
    ProbeSpec("GET", X402_QUOTE, 402, "none"),
    ProbeSpec("GET", X402_HEALTH, 200, "none"),
    ProbeSpec("GET", JWKS_JSON, 200, "jwks"),
)

FROZEN_GATES = (
    "outreach freeze: do not dispatch frozen workflows or guess inboxes",
    "Merge autopilot stays disabled_manually",
    "wait_buyer until a non-founder pays strainchain_farm",
    "do not rotate AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64",
    "do not python -m agentz.cli run --all --mode auto",
    "do not wrangler-deploy or merge HOLD/WIP from this workflow",
)


class RailsProbeError(RuntimeError):
    """A public product rail returned the wrong status or unreadable JWKS."""


def _probe(spec: ProbeSpec, timeout: float = PROBE_TIMEOUT_S) -> ProbeResult:
    headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    req = urllib.request.Request(spec.url, method=spec.method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read() if spec.method != "HEAD" else b""
            return ProbeResult(
                status=int(resp.status),
                body=body,
                content_type=str(resp.headers.get("Content-Type") or ""),
            )
    except urllib.error.HTTPError as exc:
        body = exc.read() if spec.method != "HEAD" and exc.fp else b""
        ctype = ""
        if exc.headers:
            ctype = str(exc.headers.get("Content-Type") or "")
        return ProbeResult(status=int(exc.code), body=body, content_type=ctype)


def _jwks_findings(result: ProbeResult) -> list[str]:
    findings: list[str] = []
    ctype = result.content_type.lower()
    if "json" not in ctype and not result.body.strip().startswith(b"{"):
        findings.append("JWKS is not JSON (likely landing HTML on the wrong route)")
        return findings
    try:
        payload = json.loads(result.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        findings.append(f"JWKS JSON parse failed: {exc}")
        return findings
    keys = payload.get("keys") if isinstance(payload, dict) else None
    if not isinstance(keys, list) or not keys:
        findings.append("JWKS has no keys[]")
        return findings
    kids = [str(k.get("kid") or "") for k in keys if isinstance(k, dict)]
    if any(k.startswith(RETIRED_KID_PREFIX) for k in kids):
        findings.append(f"retired kid {RETIRED_KID_PREFIX}… is published in JWKS")
    if not any(k.startswith(LIVE_KID_PREFIX) for k in kids):
        findings.append(f"live kid prefix {LIVE_KID_PREFIX} missing from JWKS")
    else:
        live = next(k for k in kids if k.startswith(LIVE_KID_PREFIX))
        findings.append(f"JWKS live kid {live[:8]}…")
    return findings


def probe_rails(probe_fn=None) -> tuple[list[str], list[str]]:
    """Run public rails. Returns (ok_lines, failure_lines)."""
    fn = probe_fn if probe_fn is not None else _probe
    ok: list[str] = []
    failures: list[str] = []
    for spec in RAILS:
        try:
            result = fn(spec)
        except Exception as exc:  # noqa: BLE001 — transport is a failed rail
            failures.append(f"{spec.method} {spec.url} transport: {exc}")
            continue
        line = f"{spec.method} {spec.url} -> {result.status} (expect {spec.expect})"
        if result.status != spec.expect:
            failures.append(line)
            continue
        ok.append(line)
        if spec.parse == "jwks":
            for finding in _jwks_findings(result):
                if "retired" in finding or "missing" in finding or "not JSON" in finding or "parse failed" in finding or "no keys" in finding:
                    failures.append(finding)
                else:
                    ok.append(finding)
    return ok, failures


def revenue_stance() -> str:
    return (
        "wait_buyer: livemode Stripe has no non-founder subscriber. "
        f"Founder inboxes {', '.join(FOUNDER_EMAILS)} do not count. "
        "Farm/x402 being live is not cash. Do not invent a buyer, charge, "
        "or workflow_dispatch from this stance."
    )


def build_x_pack(*, farm_ok: bool, x402_ok: bool, jwks_ok: bool) -> str:
    """STATUS: DRAFT pack for AgentZ OpenClaw xurl. This chat / CLI does not post."""
    facts = []
    if farm_ok:
        facts.append(f"Farm checkout answers at {FARM_CHECKOUT}")
    if x402_ok:
        facts.append("Unpaid /api/x402 returns HTTP 402 with a USDC-on-Base quote")
    if jwks_ok:
        facts.append("Protocol JWKS publishes the live Ed25519 kid")
    if not facts:
        facts.append("Authenticate goods in the open. Verify before you trust a label.")
    post = (
        f"{facts[0]}.\n\n"
        "Scan, verify, pay only if the record holds.\n"
        "https://authichain.com"
    )
    return "\n".join(
        [
            "STATUS: DRAFT",
            "WRITE_PATH: openclaw-xurl",
            "ACCOUNT: @Undone0603",
            "BRAND: AuthiChain",
            "WHY_NOW: public rails are the citeable fact; no invented customers",
            "",
            "POST:",
            post,
            "",
            "ALT_HOOK:",
            "A QR that does not verify is just a sticker.",
            "",
            "REPLY_TARGETS:",
            "- none",
            "",
            "DO_NOT_POST_IF:",
            "- copy claims a paid customer, subscriber, or agency award",
            "- xurl whoami is not @Undone0603",
            "",
            "HANDOFF_TO_AGENTZ_OPENCLAW:",
            "xurl auth status",
            "xurl whoami",
            f'xurl post "{post.splitlines()[0]}"',
            "Return the x.com status URL.",
        ]
    )


def _credential_lines() -> list[str]:
    from agentz.core.credentials import CRITICAL_CREDS, credential_snapshot

    snap = credential_snapshot()
    missing = snap.get("missing_credentials") or []
    if missing:
        return [
            f"critical credentials missing: {len(missing)} of {len(CRITICAL_CREDS)} "
            f"({', '.join(missing)}) — names only, values never logged"
        ]
    return [f"all {len(CRITICAL_CREDS)} critical credential names present"]


def run(ctx: ExecutionContext) -> str:
    ctx.step("power_user_ops: product rails + wait_buyer + X draft + OpenClaw handoff")
    lines: list[str] = ["POWER_USER_OPS"]

    ctx.step("1. product_rails")
    if ctx.mode == Mode.DRY_RUN:
        for spec in RAILS:
            ctx.step(f"{spec.method} {spec.url} (expect {spec.expect})")
        rails_ok = [f"dry-run plan {spec.method} {spec.url}" for spec in RAILS]
        rails_fail: list[str] = []
        farm_ok = x402_ok = jwks_ok = True
    else:
        rails_ok, rails_fail = probe_rails()
        for line in rails_ok:
            ctx.step(line)
        for line in rails_fail:
            ctx.step(f"FAIL {line}")
        farm_ok = any(FARM_CHECKOUT in line for line in rails_ok)
        x402_ok = any(X402_QUOTE in line for line in rails_ok)
        jwks_ok = any("JWKS live kid" in line for line in rails_ok)
        if rails_fail:
            raise RailsProbeError("; ".join(rails_fail))

    lines.append("RAILS: " + ("; ".join(rails_ok) if rails_ok else "none"))

    ctx.step("2. revenue_stance")
    stance = revenue_stance()
    ctx.step(stance)
    lines.append("REVENUE: " + stance)
    try:
        for cred_line in _credential_lines():
            ctx.step(cred_line)
            lines.append("CREDS: " + cred_line)
    except Exception as exc:  # noqa: BLE001 — missing dotenv must not crash dry-run
        ctx.step(f"CREDS: snapshot skipped ({exc})")
        lines.append(f"CREDS: snapshot skipped ({exc})")

    ctx.step("3. x_draft_pack")
    pack = build_x_pack(farm_ok=farm_ok, x402_ok=x402_ok, jwks_ok=jwks_ok)
    ctx.step("STATUS: DRAFT — AgentZ OpenClaw posts via xurl; this handler does not")
    lines.append(pack)

    ctx.step("4. openclaw_handoff")
    notify_live = bool(ctx.parameters.get("notify_openclaw")) and ctx.mode == Mode.AUTO
    client = OpenClawClient()
    result = client.notify(
        "power_user_ops complete\n" + stance,
        dry_run=not notify_live,
    )
    handoff = (
        f"openclaw notify dry_run={result.dry_run} ok={result.ok} "
        f"status={result.status_code}"
    )
    ctx.step(handoff)
    lines.append("OPENCLAW: " + handoff)

    ctx.step("5. frozen_gates")
    for gate in FROZEN_GATES:
        ctx.step(gate)
    lines.append("GATES: " + "; ".join(FROZEN_GATES))

    return "\n".join(lines)
