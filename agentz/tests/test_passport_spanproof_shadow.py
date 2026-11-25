"""SpanProof runs beside Battery Passport extraction in shadow mode: it reports, it never changes the draft."""

from __future__ import annotations

import copy

from agentz.core import passport_extract as px
from agentz.tests.test_passport_extract import DOC, good_answers, span


def with_spans(answers: dict) -> dict:
    a = copy.deepcopy(answers)
    for name, text in {
        "rated_capacity_ah": "105.0 Ah", "nominal_voltage_v": "355.2 V", "weight_kg": "412.5 kg",
        "carbon_footprint_kgco2e_per_kwh": "61.3 kgCO2e/kWh", "recycled_cobalt_pct": "16.0 %",
        "recycled_nickel_pct": "6.0 %", "manufacturing_date": "2026-08-14",
    }.items():
        a[name]["span"] = span(text)
    return a


def transport_for(answers):
    return lambda payload: {"result": {"answers": answers}}


def test_fully_spanned_draft_passes_shadow_with_no_disagreements():
    d = px.extract(DOC, transport_for(with_spans(good_answers())))
    assert d.shadow["mode"] == "shadow"
    assert d.shadow["disagreements"] == []
    assert d.shadow["derived"] == "AUTHENTIC" and d.shadow["gate"] == "pass"
    assert d.shadow["accepted"] == sum(1 for f in d.fields.values() if f.status == px.ACCEPT)


def test_accepted_field_without_a_span_is_reported_uncovered():
    d = px.extract(DOC, transport_for(good_answers()))  # numbers carry no span in the base fixture
    assert "rated_capacity_ah" in d.shadow["uncovered"]
    assert d.shadow["gate"] == "block" and d.shadow["derived"] == "ABSTAIN"


def test_value_that_disagrees_with_its_span_is_tampered():
    a = with_spans(good_answers())
    a["weight_kg"]["value"] = 41.25  # span says 412.5 kg
    d = px.extract(DOC, transport_for(a))
    assert d.fields["weight_kg"].status == px.ACCEPT  # triage alone misses it
    assert d.shadow["tampered"] == ["weight_kg"]
    assert d.shadow["derived"] == "TAMPERED"


def test_shadow_never_changes_statuses_completeness_or_hashes():
    a = with_spans(good_answers())
    a["weight_kg"]["value"] = 41.25
    on = px.extract(DOC, transport_for(a))
    off = px.extract(DOC, transport_for(a), shadow=False)
    assert off.shadow is None
    assert {k: f.status for k, f in on.fields.items()} == {k: f.status for k, f in off.fields.items()}
    assert (on.complete, on.accepted_sha256, on.source_sha256) == (off.complete, off.accepted_sha256, off.source_sha256)
    assert px.ledger_receipt(on, "b-1") == px.ledger_receipt(off, "b-1")


def test_shadow_failure_is_contained(monkeypatch):
    def boom(*_a, **_k):
        raise RuntimeError("measurer crashed")

    monkeypatch.setattr(px, "spanproof_shadow", boom)
    d = px.extract(DOC, transport_for(good_answers()))
    assert d.shadow == {"mode": "shadow", "error": "RuntimeError"}
    assert d.summary()[px.ACCEPT] > 0
