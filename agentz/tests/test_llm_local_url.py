"""LOCAL_MODEL_URL is env-driven and defaults to loopback."""

from agentz.core.llm import (
    DEFAULT_LOCAL_MODEL_URL,
    LimitProofLLM,
    LMStudioManager,
    local_model_url,
)


def test_local_model_url_defaults_to_loopback(monkeypatch):
    monkeypatch.delenv("LOCAL_MODEL_URL", raising=False)
    assert DEFAULT_LOCAL_MODEL_URL == "http://127.0.0.1:1234"
    assert local_model_url() == "http://127.0.0.1:1234"
    assert LimitProofLLM._local_base_url() == "http://127.0.0.1:1234/v1"
    assert LMStudioManager().base_url == "http://127.0.0.1:1234"


def test_local_model_url_comes_from_env(monkeypatch):
    monkeypatch.setenv("LOCAL_MODEL_URL", "http://127.0.0.1:5555/v1")
    assert local_model_url() == "http://127.0.0.1:5555"
    assert LimitProofLLM._local_base_url() == "http://127.0.0.1:5555/v1"
    assert LMStudioManager().base_url == "http://127.0.0.1:5555"


def test_load_and_unload_post_to_local_model_url(monkeypatch):
    monkeypatch.setenv("LOCAL_MODEL_URL", "http://127.0.0.1:5555")
    seen: list[str] = []

    class FakeClient:
        def __init__(self, headers=None):
            self.headers = headers

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def post(self, url, json=None, timeout=None):
            seen.append(url)

            class Response:
                def raise_for_status(self):
                    return None

            return Response()

    monkeypatch.setattr("agentz.core.llm.httpx.Client", FakeClient)
    manager = LMStudioManager()
    manager.load_model("google/gemma-4-e4b")
    manager.unload_model("google/gemma-4-e4b")
    assert seen == [
        "http://127.0.0.1:5555/api/v1/models/load",
        "http://127.0.0.1:5555/api/v1/models/unload",
    ]
