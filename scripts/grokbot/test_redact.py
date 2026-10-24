"""Unit tests for grokbot.redact — fake secrets only, never real credentials."""
from __future__ import annotations

import re

import pytest

from grokbot import SECRET_PATTERNS, redact


def _fake(prefix: str, body: str) -> str:
    """Join at runtime so the committed file never holds a contiguous token."""
    return f"{prefix}{body}"


# Realistic-looking fakes. None of these are live credentials.
SK_LIVE = _fake("sk_live_", "FakeLocalOnly51AbCdEfGhIj")
SK_TEST = _fake("sk_test_", "FakeLocalOnly51XyZ123456")
GHP = _fake("ghp_", "FakeLocalOnlyToken0000000000000000")
GITHUB_PAT = _fake("github_pat_", "11AAAAAAA_FakeLocalOnly000000000000000")
XAI = _fake("xai-", "fakeLocalOnlyKey0000000001")
BEARER_TOKEN = "faketokenvalue000000000"
API_KEY_VALUE = "fake_api_key_value_123456"
PASSWORD_VALUE = "fake_local_only_password_value"
PEM_BODY = "FAKEPEMLOCALONLYBODY0001"
PEM = (
    "-----BEGIN PRIVATE KEY-----\n"
    f"{PEM_BODY}\n"
    "-----END PRIVATE KEY-----"
)

# One case per compiled pattern in SECRET_PATTERNS. `secret` is the substring
# that must disappear; `sample` is a realistic surrounding line.
PATTERN_CASES = [
    (
        "sk_live",
        f"STRIPE_SECRET_KEY={SK_LIVE}",
        SK_LIVE,
    ),
    (
        "sk_test",
        f"stripe_key: {SK_TEST}",
        SK_TEST,
    ),
    (
        "ghp",
        f"export GITHUB_TOKEN={GHP}",
        GHP,
    ),
    (
        "github_pat",
        f"Authorization: token {GITHUB_PAT}",
        GITHUB_PAT,
    ),
    (
        "xai",
        f"XAI_API_KEY={XAI}",
        XAI,
    ),
    (
        "bearer",
        f"Authorization: Bearer {BEARER_TOKEN}",
        BEARER_TOKEN,
    ),
    (
        "assignment_prefix",
        f'api_key="{API_KEY_VALUE}"',
        API_KEY_VALUE,
    ),
    (
        "private_key",
        f"tls:\n{PEM}\n",
        PEM_BODY,
    ),
]


def test_every_compiled_pattern_has_a_case() -> None:
    uncovered = [
        i
        for i, pattern in enumerate(SECRET_PATTERNS)
        if not any(pattern.search(sample) for _, sample, _ in PATTERN_CASES)
    ]
    assert uncovered == [], f"SECRET_PATTERNS missing coverage: {uncovered}"


@pytest.mark.parametrize("label,sample,secret", PATTERN_CASES, ids=[c[0] for c in PATTERN_CASES])
def test_each_secret_pattern_removes_the_secret(label: str, sample: str, secret: str) -> None:
    assert secret in sample
    out, changed = redact(sample)
    assert changed
    assert secret not in out
    assert "[REDACTED]" in out


def test_full_match_capture_group_does_not_echo_secret() -> None:
    """Regression: a sole capture group spanning the whole match used to
    put the credential back and append [REDACTED]."""
    pattern = re.compile(r"(?i)(sk_live_[A-Za-z0-9]+)")
    assert pattern.groups == 1
    match = pattern.search(SK_LIVE)
    assert match is not None
    assert match.group(1) == match.group(0) == SK_LIVE

    out, changed = redact(f"stripe={SK_LIVE}")
    assert changed
    assert SK_LIVE not in out
    assert f"{SK_LIVE}[REDACTED]" not in out
    assert out == "stripe=[REDACTED]"


def test_assignment_prefix_survives_and_value_does_not() -> None:
    out, changed = redact(f"password={PASSWORD_VALUE}")
    assert changed
    assert PASSWORD_VALUE not in out
    assert out.startswith("password=")
    assert out == "password=[REDACTED]"
