"""
Regression test for agentz.dashboard's "Revenue Siphon" data source.

Prior bug: the entire Revenue Siphon page was hardcoded literals (a fake
"172" deal backlog, a fake "$1.46M" SaaS target, a "$250,000... LVMH +
Hermes" metric naming real companies, and a bar chart commented "# Live
data from HubSpot probe" that was actually a fixed [72,50,35,10,5] array)
-- none of it was ever queried from anywhere. This test targets the new
load_deal_pipeline() loader, which must reflect the real HubSpot data
returned by get_all_deals(), following the same real-data-loading
convention already used correctly by load_federal_pipeline() in the same
file.

Note: Streamlit gracefully no-ops (with a stderr warning) when a script
runs outside a real ScriptRunContext, so importing dashboard.py directly
in "bare mode" is safe -- no need to mock every st.* call.
"""
from __future__ import annotations

import sys
import importlib
from unittest.mock import patch

import streamlit as st


def _load_dashboard_module():
    if "agentz.dashboard" in sys.modules:
        del sys.modules["agentz.dashboard"]
    st.cache_data.clear()  # st.cache_data's store is process-global, not per-module-import
    return importlib.import_module("agentz.dashboard")


def test_load_deal_pipeline_reflects_real_hubspot_deals_not_hardcoded_numbers():
    fake_deals = [
        {"id": "1", "name": "Real Deal A", "amount": "5000", "stage": "negotiation"},
        {"id": "2", "name": "Real Deal B", "amount": "12000", "stage": "contacted"},
    ]

    async def _fake_get_all_deals(*args, **kwargs):
        return fake_deals

    with patch("agentz.core.hubspot.get_all_deals", new=_fake_get_all_deals):
        module = _load_dashboard_module()
        df = module.load_deal_pipeline()

    assert len(df) == 2
    assert set(df["name"]) == {"Real Deal A", "Real Deal B"}
    assert "LVMH" not in df.to_string()


def test_load_deal_pipeline_returns_empty_dataframe_on_failure():
    async def _raise(*args, **kwargs):
        raise RuntimeError("HubSpot unreachable")

    with patch("agentz.core.hubspot.get_all_deals", new=_raise):
        module = _load_dashboard_module()
        df = module.load_deal_pipeline()

    assert df.empty
