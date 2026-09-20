"""govchain_grant_proposal: local Ollama dry-run, get_llm kwargs, no Gemini gate."""
from __future__ import annotations

import inspect
import sys
import textwrap
import types
from pathlib import Path

import agentz.core.grants_pipeline as gp
from agentz.core.llm import LLMProxy, LimitProofLLM, _is_ollama_model, get_llm
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.runner import load_registry
from agentz.workflows.handlers import govchain_proposal


def test_get_llm_signature_accepts_base_url_and_kwargs():
    sig = inspect.signature(get_llm)
    assert "base_url" in sig.parameters
    assert any(p.kind is inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values())
    llm = get_llm(model="gpt-4o", base_url="http://localhost:11434", extra="ignored")
    assert llm is not None
    assert isinstance(llm, LLMProxy)
    assert isinstance(llm._llm, LimitProofLLM)


def test_is_ollama_model_routing():
    assert _is_ollama_model("llama3.2")
    assert _is_ollama_model("llama3.2:latest")
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
    assert captured["base_url"] == "http://localhost:11434"


def test_govchain_grant_proposal_requires_no_gemini_key():
    wf = load_registry()["govchain_grant_proposal"]
    assert wf.requires == []
    assert "gemini_api_key" not in wf.requires


def test_proposal_model_prefers_ollama_env(monkeypatch):
    monkeypatch.setenv("OLLAMA_MODEL", "llama3.2")
    monkeypatch.setenv("LLM_MODEL", "google/gemma-4-e4b:2")
    assert govchain_proposal._proposal_model() == "llama3.2"
    monkeypatch.delenv("OLLAMA_MODEL", raising=False)
    assert govchain_proposal._proposal_model() == "google/gemma-4-e4b:2"
    monkeypatch.delenv("LLM_MODEL", raising=False)
    assert govchain_proposal._proposal_model() == "llama3.2"


def test_dry_run_drafts_locally_and_skips_ledger(tmp_path: Path, monkeypatch):
    csv = tmp_path / "gov_pursue_list.csv"
    csv.write_text(
        textwrap.dedent(
            """\
            notice_id,title,agency,deadline,fit_score
            top,Top Opp,DOD,2099-01-01T00:00:00-04:00,95
            """
        ),
        encoding="utf-8",
    )
    ledger = tmp_path / "pipeline_ledger.json"
    monkeypatch.setattr(gp, "DEFAULT_CSV", csv)
    monkeypatch.setattr(gp, "DEFAULT_LEDGER", ledger)

    class _FakeLLM:
        def invoke(self, prompt):
            class R:
                content = "# dry-run stub proposal"

            return R()

    monkeypatch.setattr(govchain_proposal, "_draft_llm", lambda: _FakeLLM())
    proposals_dir = tmp_path / "content_grants"
    monkeypatch.setattr(govchain_proposal, "PROPOSALS_DIR", proposals_dir)

    ctx = ExecutionContext(mode=Mode.DRY_RUN, workflow_id="test_govchain", verbose=False)
    out = govchain_proposal.run(ctx)

    assert "top" in out
    assert "dry-run" in out
    assert (proposals_dir / "top.md").read_text(encoding="utf-8") == "# dry-run stub proposal"
    assert not ledger.exists()
    assert gp.status_of("top", ledger) is None
