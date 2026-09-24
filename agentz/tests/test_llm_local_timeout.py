"""LOCAL_MODEL_TIMEOUT bounds how long the provider waterfall waits on the local model."""

import pytest

from agentz.core.llm import LimitProofLLM


@pytest.mark.parametrize(
    "raw, expected",
    [
        (None, 40.0),
        ("25", 25.0),
        ("2", 5.0),
        ("900", 120.0),
        ("not-a-number", 40.0),
    ],
)
def test_local_timeout(monkeypatch, raw, expected):
    if raw is None:
        monkeypatch.delenv("LOCAL_MODEL_TIMEOUT", raising=False)
    else:
        monkeypatch.setenv("LOCAL_MODEL_TIMEOUT", raw)
    assert LimitProofLLM._local_timeout() == expected


def test_local_clients_use_the_timeout(monkeypatch):
    monkeypatch.setenv("LOCAL_MODEL_TIMEOUT", "30")
    monkeypatch.setenv("LOCAL_MODEL_URL", "http://127.0.0.1:58303")
    llm = LimitProofLLM()
    for client in (llm._get_lmstudio(), llm._get_lmstudio_fallback()):
        assert client.request_timeout == 30.0
        assert str(client.openai_api_base) == "http://127.0.0.1:58303/v1"
