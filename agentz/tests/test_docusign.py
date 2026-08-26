"""
Regression tests for agentz.core.docusign.

Prior bug: create_envelope_from_markdown returned status:"sent" with a
fake envelope_id even when docusign_token was present and the actual
DocuSign API call was commented out ("Real API Logic Placeholder") --
there was no real send at all, but only the no-token path was honestly
labeled as simulation. Callers had no way to distinguish a real send
from a fake one when a token happened to be configured.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest

from agentz.core import docusign


@pytest.mark.asyncio
async def test_never_reports_sent_when_no_real_api_call_is_made_without_token(tmp_path):
    agreement = tmp_path / "agreement.md"
    agreement.write_text("Agreement body.", encoding="utf-8")

    with patch("agentz.core.docusign.get", return_value=None):
        result = await docusign.create_envelope_from_markdown(str(agreement), "someone@example.com")

    assert result["status"] != "sent"


@pytest.mark.asyncio
async def test_never_reports_sent_when_token_present_but_api_call_still_not_implemented(tmp_path):
    agreement = tmp_path / "agreement.md"
    agreement.write_text("Agreement body.", encoding="utf-8")

    # A real docusign_token is configured, but the actual DocuSign HTTP
    # call is still a commented-out placeholder in this module -- nothing
    # was really transmitted, so this must not claim "sent" either.
    with patch("agentz.core.docusign.get", return_value="real-token-abc"):
        result = await docusign.create_envelope_from_markdown(str(agreement), "someone@example.com")

    assert result["status"] != "sent"


@pytest.mark.asyncio
async def test_missing_agreement_file_is_reported_as_an_error(tmp_path):
    with patch("agentz.core.docusign.get", return_value="real-token-abc"):
        result = await docusign.create_envelope_from_markdown(str(tmp_path / "does_not_exist.md"), "someone@example.com")

    assert result["status"] == "error"
