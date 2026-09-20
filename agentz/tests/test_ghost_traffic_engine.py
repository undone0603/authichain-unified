"""Light-probe ghost-traffic handler — no live network."""

from __future__ import annotations

from agentz.core.modes import ExecutionContext, Mode
from agentz.workflows.handlers import ghost_traffic_engine as gte


class _Ctx(ExecutionContext):
    def __init__(self, mode: Mode):
        super().__init__(mode=mode, workflow_id="ghost_traffic_engine", verbose=False)
        self.steps: list[str] = []

    def step(self, description, action=None):
        self.steps.append(description)
        return None


def test_dry_run_sends_no_http(monkeypatch):
    def boom(*_a, **_k):
        raise AssertionError("dry-run must not probe")

    monkeypatch.setattr(gte, "_probe", boom)
    ctx = _Ctx(Mode.DRY_RUN)
    result = gte.run(ctx)
    assert result.startswith("dry-run:")
    assert any("authichain.com" in s for s in ctx.steps)


def test_auto_logs_status_codes(monkeypatch):
    def fake_probe(method, url, timeout=12):
        if url.endswith("/api/funnel"):
            return 400
        if "x402" in url:
            return 200
        return 200

    monkeypatch.setattr(gte, "_probe", fake_probe)
    ctx = _Ctx(Mode.AUTO)
    result = gte.run(ctx)
    assert "No unexpected 5xx" in result
    assert any("-> 200" in s for s in ctx.steps)
    assert any("-> 400" in s for s in ctx.steps)


def test_unexpected_5xx_raises(monkeypatch):
    def fake_probe(method, url, timeout=12):
        if url.rstrip("/").endswith("govchain.us"):
            return 503
        return 200

    monkeypatch.setattr(gte, "_probe", fake_probe)
    ctx = _Ctx(Mode.AUTO)
    try:
        gte.run(ctx)
        raise AssertionError("expected UnexpectedServerError")
    except gte.UnexpectedServerError as exc:
        assert "503" in str(exc)


def test_probe_targets_are_estate_plus_money_hooks():
    assert "https://authichain.com/" in gte.ESTATE_APEXES
    assert "https://strainchain.io/" in gte.ESTATE_APEXES
    assert "https://govchain.us/" in gte.ESTATE_APEXES
    assert "https://qron.space/" in gte.ESTATE_APEXES
    assert len(gte.ESTATE_APEXES) == 4
    paths = {url for _method, url in gte.API_PROBES}
    assert "https://authichain.com/api/x402/health" in paths
    assert "https://authichain.com/api/funnel" in paths
