"""Power-user ops: dry-run is read-only; rails and X pack stay citeable."""

from __future__ import annotations

import json
from pathlib import Path

import yaml

from agentz.core.modes import ExecutionContext, Mode
from agentz.workflows.handlers import power_user_ops as puo

REPO = Path(__file__).resolve().parents[2]


class _Ctx(ExecutionContext):
    def __init__(self, mode: Mode, parameters=None):
        super().__init__(
            mode=mode,
            workflow_id="power_user_ops",
            verbose=False,
            parameters=parameters or {},
        )
        self.steps: list[str] = []

    def step(self, description, action=None):
        self.steps.append(description)
        return None


def _ok_result(spec: puo.ProbeSpec) -> puo.ProbeResult:
    if spec.parse == "jwks":
        body = json.dumps(
            {
                "keys": [
                    {
                        "kty": "OKP",
                        "crv": "Ed25519",
                        "kid": "T3AL7c4wZVoXk1IXvpaaHGUmoZHZ3k1mTommJu9wToQ",
                        "x": "T36jnq2kAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                    }
                ]
            }
        ).encode("utf-8")
        return puo.ProbeResult(status=200, body=body, content_type="application/json")
    return puo.ProbeResult(status=spec.expect, body=b"", content_type="text/html")


def test_dry_run_sends_no_http(monkeypatch):
    def boom(*_a, **_k):
        raise AssertionError("dry-run must not probe")

    monkeypatch.setattr(puo, "_probe", boom)
    ctx = _Ctx(Mode.DRY_RUN)
    result = puo.run(ctx)
    assert "STATUS: DRAFT" in result
    assert "wait_buyer" in result
    assert any("GET https://authichain.com/checkout/strainchain_farm" in s for s in ctx.steps)
    assert any("HEAD https://authichain.com/api/checkout/plan/strainchain_farm" in s for s in ctx.steps)


def test_dry_run_openclaw_notify_is_dry(monkeypatch):
    monkeypatch.setattr(puo, "_probe", lambda *_a, **_k: (_ for _ in ()).throw(AssertionError("no HTTP")))
    ctx = _Ctx(Mode.DRY_RUN)
    result = puo.run(ctx)
    assert "openclaw notify dry_run=True" in result


def test_auto_probes_expected_statuses(monkeypatch):
    monkeypatch.setattr(puo, "_probe", _ok_result)
    ctx = _Ctx(Mode.AUTO)
    result = puo.run(ctx)
    assert "GET https://authichain.com/checkout/strainchain_farm -> 200" in result
    assert "JWKS live kid T3AL7c4w" in result
    assert "STATUS: DRAFT" in result


def test_auto_fails_on_wrong_status(monkeypatch):
    def bad(spec: puo.ProbeSpec) -> puo.ProbeResult:
        return puo.ProbeResult(status=500, body=b"nope", content_type="text/plain")

    monkeypatch.setattr(puo, "_probe", bad)
    ctx = _Ctx(Mode.AUTO)
    try:
        puo.run(ctx)
        raise AssertionError("expected RailsProbeError")
    except puo.RailsProbeError as exc:
        assert "500" in str(exc)


def test_retired_jwks_kid_fails(monkeypatch):
    def retired(spec: puo.ProbeSpec) -> puo.ProbeResult:
        if spec.parse != "jwks":
            return _ok_result(spec)
        body = json.dumps(
            {"keys": [{"kid": "lue84wJN-stale", "kty": "OKP", "crv": "Ed25519"}]}
        ).encode("utf-8")
        return puo.ProbeResult(status=200, body=body, content_type="application/json")

    monkeypatch.setattr(puo, "_probe", retired)
    ctx = _Ctx(Mode.AUTO)
    try:
        puo.run(ctx)
        raise AssertionError("expected RailsProbeError")
    except puo.RailsProbeError as exc:
        assert "retired kid" in str(exc)


def test_x_pack_never_claims_a_buyer():
    pack = puo.build_x_pack(farm_ok=True, x402_ok=True, jwks_ok=True)
    post = pack.split("POST:", 1)[1].split("ALT_HOOK:", 1)[0].lower()
    assert "STATUS: DRAFT" in pack
    assert "subscriber" not in post
    assert "customer" not in post
    assert "xurl post" in pack
    assert "@Undone0603" in pack


def test_revenue_stance_names_founder_exclusion():
    stance = puo.revenue_stance()
    assert "wait_buyer" in stance
    assert "undone.k@gmail.com" in stance
    assert "Do not invent a buyer" in stance


def test_registry_registers_workflow():
    raw = yaml.safe_load(
        (REPO / "agentz/workflows/registry.yaml").read_text(encoding="utf-8")
    )
    matches = [item for item in raw["workflows"] if item["id"] == "power_user_ops"]
    assert len(matches) == 1
    workflow = matches[0]
    assert workflow["handler"] == "handlers.power_user_ops"
    assert workflow["requires"] == []
    assert workflow["risk_class"] == "low"
    assert workflow["blocks_revenue"] is False
    assert workflow["requires_human_approval"] is False
    assert workflow["confirm_before_run"] is False
