# AgentZ port of AI Adapt research build 2026-11-12 ReadGate (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-11-12-readgate-budgeted-reading.md
import pytest
from agentz.core.read_gate import ReadGate, ReadIntent, ChunkReader, HeadingReader, sha256

DOC = """Battery passport overview. This document covers many topics.

The carbon footprint of the cell is 61 kg CO2e per kWh, measured at the plant.

Recycled content: cobalt 16 percent, lithium 6 percent, nickel 6 percent.

Unrelated marketing copy about the brand and the team and the office dog.
""" + ("Filler paragraph about nothing in particular.\n\n" * 40)

INTENT = {"carbon": "carbon footprint co2e kwh", "recycled": "recycled content cobalt lithium nickel"}


def gate(budget=2000, **kw):
    return ReadGate(ReadIntent.from_facets("passport facts", INTENT), [ChunkReader()], budget, **kw)


def test_sparse_read_returns_only_relevant_spans():
    g = gate()
    r = g.read("doc1", DOC)
    assert r.mode == "SPARSE"
    joined = " ".join(s.text for s in r.spans)
    assert "61 kg" in joined and "cobalt 16" in joined and "office dog" not in joined
    assert r.exposed_chars < len(DOC) / 5


def test_spans_are_verbatim_with_offsets():
    g = gate()
    r = g.read("doc1", DOC)
    for s in r.spans:
        assert DOC[s.start:s.end] == s.text


def test_intent_coverage_closes_facets():
    g = gate()
    g.read("doc1", DOC)
    assert g.intent.done
    assert g.intent.covered["carbon"] == ["doc1"]


def test_full_fallback_when_nothing_found_and_small():
    g = gate()
    small = "Short note with no matching words."
    r = g.read("note", small)
    assert r.mode == "FULL_FALLBACK" and r.spans[0].text == small


def test_denied_when_nothing_found_and_too_big():
    g = gate(budget=100)
    r = g.read("big", "nothing relevant here. " * 50)
    assert r.mode == "DENIED_BUDGET" and r.exposed_chars == 0


def test_fallback_cap_denies_large_unmatched_source_even_with_budget():
    g = gate(budget=5000, fallback_max_chars=50)
    r = g.read("mid", "nothing relevant here. " * 10)
    assert r.mode == "DENIED_NOTHING_FOUND"


def test_budget_is_never_exceeded_across_reads():
    g = gate(budget=120)
    for i in range(5):
        g.read(f"d{i}", DOC)
    assert g.used <= 120


def test_heading_reader_preferred_when_listed_first():
    md = "# Intro\nhello\n\n# Carbon footprint\n61 kg CO2e per kWh\n\n# Team\nbios"
    g = ReadGate(ReadIntent.from_facets("x", {"carbon": "carbon footprint"}),
                 [HeadingReader(), ChunkReader()], 1000)
    r = g.read("md", md)
    assert r.mode == "SPARSE" and g.ledger[0].reader == "heading"
    assert r.spans[0].text.startswith("# Carbon footprint")


def test_ledger_records_hash_and_offsets():
    g = gate()
    g.read("doc1", DOC)
    e = g.ledger[0]
    assert e.source_sha256 == sha256(DOC) and e.offsets and e.exposed_chars == g.used


def test_verify_detects_changed_and_missing_sources():
    g = gate()
    g.read("doc1", DOC)
    g.read("note", "tiny")
    assert g.verify({"doc1": DOC, "note": "tiny"}) == []
    probs = g.verify({"doc1": DOC + "edited"})
    assert any("changed" in p for p in probs) and any("unavailable" in p for p in probs)


def test_summary_reports_savings():
    g = gate()
    g.read("doc1", DOC)
    s = g.summary()
    assert s["savings_ratio"] > 0.8 and s["open_facets"] == [] and s["modes"] == ["SPARSE"]
