"""get_llm factory: accept base_url/**kwargs and route llama/local to ChatOllama."""
from __future__ import annotations

import inspect
import sys
import types

from agentz.core.llm import LLMProxy, LimitProofLLM, _is_ollama_model, get_llm
from agentz.core.runner import load_registry


def test_get_llm_signature_accepts_base_url_and_kwargs():
    sig = inspect.signature(get_llm)
    assert "base_url" in sig.parameters
    assert any(p.kind is inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values())
    # The original failure: TypeError: get_llm() got an unexpected keyword argument 'base_url'
    llm = get_llm(model="gpt-4o", base_url="http://localhost:11434", extra="ignored")
    assert llm is not None
    assert isinstance(llm, LLMProxy)
    assert isinstance(llm._llm, LimitProofLLM)


def test_is_ollama_model_routing():
    assert _is_ollama_model("llama3.2")
    assert _is_ollama_model("llama3.2:latest")
    assert _is_ollama_model("meta-llama/Llama-3.1-8B")
    assert _is_ollama_model("local-model")
    assert _is_ollama_model("ollama/llama3")
    assert not _is_ollama_model("gpt-4o")
    assert not _is_ollama_model("gemini-2.0-flash")
    assert not _is_ollama_model("limit-proof")


def test_get_llm_routes_llama_to_chat_ollama(monkeypatch):
    captured: dict = {}

    class FakeOllama:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    fake_mod = types.ModuleType("langchain_ollama")
    fake_mod.ChatOllama = FakeOllama
    monkeypatch.setitem(sys.modules, "langchain_ollama", fake_mod)

    llm = get_llm(
        model="llama3.2",
        temperature=0.2,
        base_url="http://localhost:11434",
    )
    assert isinstance(llm, LLMProxy)
    assert isinstance(llm._llm, FakeOllama)
    assert captured["model"] == "llama3.2"
    assert captured["temperature"] == 0.2
    assert captured["base_url"] == "http://localhost:11434"


def test_govchain_grant_proposal_requires_no_gemini_key():
    wf = load_registry()["govchain_grant_proposal"]
    assert wf.requires == []
    assert "gemini_api_key" not in wf.requires


def test_proposal_model_prefers_ollama_env(monkeypatch):
    from agentz.workflows.handlers.govchain_proposal import _proposal_model

    monkeypatch.setenv("OLLAMA_MODEL", "llama3.2")
    monkeypatch.setenv("LLM_MODEL", "google/gemma-4-e4b:2")
    assert _proposal_model() == "llama3.2"
    monkeypatch.delenv("OLLAMA_MODEL", raising=False)
    assert _proposal_model() == "google/gemma-4-e4b:2"
    monkeypatch.delenv("LLM_MODEL", raising=False)
    assert _proposal_model() == "llama3.2"
