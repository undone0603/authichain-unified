"""Microsite Agent publishes to the Cloudflare MICROSITES_KV namespace, not Vercel."""
import asyncio

import pytest

from agentz.core import microsites


class _Resp:
    def __init__(self, status_code=200, body=None):
        self.status_code = status_code
        self._body = {"success": True} if body is None else body

    def json(self):
        return self._body


class _FakeClient:
    calls = []
    response = _Resp()

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def put(self, url, headers=None, content=None):
        _FakeClient.calls.append({"url": url, "headers": headers, "content": content})
        return _FakeClient.response

    async def post(self, *args, **kwargs):  # pragma: no cover - must never happen
        raise AssertionError("microsites must not POST anywhere (no Vercel alias calls)")


@pytest.fixture(autouse=True)
def fake_cloudflare(monkeypatch):
    creds = {"cloudflare_api_token": "tok", "cloudflare_account": "acct"}
    monkeypatch.setattr(microsites, "get", lambda key, required=True: creds.get(key))
    monkeypatch.setattr(microsites.httpx, "AsyncClient", _FakeClient)
    _FakeClient.calls = []
    _FakeClient.response = _Resp()
    return creds


def _publish(lead):
    return asyncio.run(microsites.deploy_sales_microsite(lead))


def test_publishes_to_the_key_the_worker_router_reads():
    url = _publish({"slug": "Acme Labs", "name": "Acme"})
    assert url == "https://acme-labs.authichain.com"
    (call,) = _FakeClient.calls
    # worker/index.ts serves `${subdomain}${path}` → "acme-labs/index.html"
    assert call["url"] == (
        "https://api.cloudflare.com/client/v4/accounts/acct/storage/kv/namespaces/"
        f"{microsites.DEFAULT_MICROSITES_KV_NAMESPACE}/values/acme-labs%2Findex.html"
    )
    assert call["headers"]["Authorization"] == "Bearer tok"
    assert b"Acme" in call["content"]


def test_namespace_override(fake_cloudflare):
    fake_cloudflare["cloudflare_microsites_kv_namespace"] = "ns-override"
    _publish({"slug": "acme"})
    assert "/namespaces/ns-override/values/" in _FakeClient.calls[0]["url"]


def test_lead_fields_are_html_escaped():
    _publish({"slug": "acme", "name": "<script>alert(1)</script>", "amount": '"><img>'})
    body = _FakeClient.calls[0]["content"].decode()
    assert "<script>alert(1)</script>" not in body
    assert "&lt;script&gt;" in body
    assert '"><img>' not in body


@pytest.mark.parametrize("slug", ["www", "app", "verify", "API", "", "---", None])
def test_reserved_or_empty_slugs_are_refused(slug):
    assert _publish({"slug": slug}) is None
    assert _FakeClient.calls == []


def test_overlong_slug_is_trimmed_to_a_dns_label():
    assert microsites.microsite_slug("a" * 80) == "a" * 63


@pytest.mark.parametrize("resp", [_Resp(500), _Resp(200, {"success": False})])
def test_failed_write_returns_none_not_a_dead_url(resp):
    _FakeClient.response = resp
    assert _publish({"slug": "acme"}) is None


def test_missing_credentials_returns_none(fake_cloudflare):
    fake_cloudflare.clear()
    assert _publish({"slug": "acme"}) is None
    assert _FakeClient.calls == []


def test_no_vercel_left_in_the_agent():
    import inspect

    source = inspect.getsource(microsites)
    assert "vercel.com" not in source
    assert not hasattr(microsites, "trigger_redeploy")
