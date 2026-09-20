"""Light-probe ghost-traffic handler — no live network."""

from __future__ import annotations

import urllib.error
import urllib.request

from agentz.core.modes import ExecutionContext, Mode
from agentz.workflows.handlers import ghost_traffic_engine as gte


class _Ctx(ExecutionContext):
    def __init__(self, mode: Mode):
        super().__init__(mode=mode, workflow_id="ghost_traffic_engine", verbose=False)
        self.steps: list[str] = []

    def step(self, description, action=None):
        self.steps.append(description)
        return None


EXPECTED_MONEY_PATHS = (
    "https://authichain.com/pricing",
    "https://authichain.com/dpp",
    "https://authichain.com/x402",
    "https://authichain.com/onboard",
    "https://authichain.com/api/checkout/dpp",
    "https://strainchain.io/pricing",
    "https://strainchain.io/onboard",
    "https://qron.space/pricing",
    "https://qron.space/generate",
    "https://govchain.us/onboard",
)


def _ok_status(url: str) -> int:
    if url.rstrip("/").endswith("/api/funnel"):
        return 400
    if url.endswith("/api/checkout/dpp"):
        return 303
    return 200


def test_dry_run_sends_no_http(monkeypatch):
    def boom(*_a, **_k):
        raise AssertionError("dry-run must not probe")

    monkeypatch.setattr(gte, "_probe", boom)
    ctx = _Ctx(Mode.DRY_RUN)
    result = gte.run(ctx)
    assert result.startswith("dry-run:")
    assert any("authichain.com" in s for s in ctx.steps)


def test_dry_run_lists_all_money_paths(monkeypatch):
    monkeypatch.setattr(gte, "_probe", lambda *_a, **_k: (_ for _ in ()).throw(AssertionError("no HTTP")))
    ctx = _Ctx(Mode.DRY_RUN)
    gte.run(ctx)
    joined = "\n".join(ctx.steps)
    for url in EXPECTED_MONEY_PATHS:
        assert f"GET {url}" in joined


def test_auto_logs_status_codes(monkeypatch):
    def fake_probe(method, url, timeout=12):
        return _ok_status(url)

    monkeypatch.setattr(gte, "_probe", fake_probe)
    ctx = _Ctx(Mode.AUTO)
    result = gte.run(ctx)
    assert "No unexpected 5xx" in result
    assert any("-> 200" in s for s in ctx.steps)
    assert any("-> 400" in s for s in ctx.steps)
    assert any("checkout/dpp" in s and "-> 303" in s for s in ctx.steps)


def test_unexpected_5xx_raises(monkeypatch):
    def fake_probe(method, url, timeout=12):
        if url.rstrip("/").endswith("govchain.us"):
            return 503
        return _ok_status(url)

    monkeypatch.setattr(gte, "_probe", fake_probe)
    ctx = _Ctx(Mode.AUTO)
    try:
        gte.run(ctx)
        raise AssertionError("expected UnexpectedServerError")
    except gte.UnexpectedServerError as exc:
        assert "503" in str(exc)


def test_money_path_5xx_raises(monkeypatch):
    def fake_probe(method, url, timeout=12):
        if url.endswith("/pricing") and "authichain.com" in url:
            return 502
        return _ok_status(url)

    monkeypatch.setattr(gte, "_probe", fake_probe)
    ctx = _Ctx(Mode.AUTO)
    try:
        gte.run(ctx)
        raise AssertionError("expected UnexpectedServerError")
    except gte.UnexpectedServerError as exc:
        assert "502" in str(exc)
        assert "authichain.com/pricing" in str(exc)


def test_checkout_303_is_success(monkeypatch):
    def fake_probe(method, url, timeout=12):
        return _ok_status(url)

    monkeypatch.setattr(gte, "_probe", fake_probe)
    ctx = _Ctx(Mode.AUTO)
    result = gte.run(ctx)
    assert "No unexpected 5xx" in result


def test_checkout_302_is_success(monkeypatch):
    def fake_probe(method, url, timeout=12):
        if url.endswith("/api/checkout/dpp"):
            return 302
        return _ok_status(url)

    monkeypatch.setattr(gte, "_probe", fake_probe)
    ctx = _Ctx(Mode.AUTO)
    result = gte.run(ctx)
    assert "No unexpected 5xx" in result


def test_checkout_200_html_is_failure(monkeypatch):
    def fake_probe(method, url, timeout=12):
        if url.endswith("/api/checkout/dpp"):
            return 200
        return _ok_status(url)

    monkeypatch.setattr(gte, "_probe", fake_probe)
    ctx = _Ctx(Mode.AUTO)
    try:
        gte.run(ctx)
        raise AssertionError("expected UnexpectedServerError")
    except gte.UnexpectedServerError as exc:
        assert "checkout/dpp" in str(exc)
        assert "200" in str(exc)


def test_checkout_5xx_is_failure(monkeypatch):
    def fake_probe(method, url, timeout=12):
        if url.endswith("/api/checkout/dpp"):
            return 503
        return _ok_status(url)

    monkeypatch.setattr(gte, "_probe", fake_probe)
    ctx = _Ctx(Mode.AUTO)
    try:
        gte.run(ctx)
        raise AssertionError("expected UnexpectedServerError")
    except gte.UnexpectedServerError as exc:
        assert "checkout/dpp" in str(exc)
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
    money = set(gte.MONEY_PATHS)
    for url in EXPECTED_MONEY_PATHS:
        assert url in money
    assert gte.CHECKOUT_DPP_URL == "https://authichain.com/api/checkout/dpp"
    assert gte.CHECKOUT_OK_STATUSES == frozenset({302, 303})


def test_no_redirect_handler_surfaces_303():
    handler = gte._NoRedirect()
    req = urllib.request.Request(gte.CHECKOUT_DPP_URL)
    try:
        handler.redirect_request(
            req, None, 303, "See Other", {}, "https://checkout.stripe.com/c/pay/cs_test"
        )
        raise AssertionError("expected HTTPError")
    except urllib.error.HTTPError as exc:
        assert exc.code == 303


def test_probe_does_not_follow_checkout_redirect(monkeypatch):
    seen: list[tuple[str, str]] = []

    class _Ok:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *_a):
            return False

    def fake_urlopen(req, timeout=None):
        seen.append(("follow", req.full_url))
        return _Ok()

    def fake_open(req, timeout=None):
        seen.append(("no-follow", req.full_url))
        raise urllib.error.HTTPError(req.full_url, 303, "See Other", {}, None)

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    monkeypatch.setattr(gte._OPENER, "open", fake_open)

    assert gte._probe("GET", gte.CHECKOUT_DPP_URL) == 303
    assert gte._probe("GET", "https://authichain.com/pricing") == 200
    assert seen == [
        ("no-follow", gte.CHECKOUT_DPP_URL),
        ("follow", "https://authichain.com/pricing"),
    ]
