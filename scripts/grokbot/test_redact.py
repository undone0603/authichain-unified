"""Unit tests for grokbot.redact — fake secrets only, never real credentials."""
from __future__ import annotations

import base64
import re
from urllib.parse import quote

import pytest

from grokbot import (
    ASSIGNMENT_PATTERNS,
    MARKER,
    SECRET_PATTERNS,
    RedactResult,
    bip39_words,
    redact,
)


def _fake(prefix: str, body: str) -> str:
    """Join at runtime so the committed file never holds a contiguous token."""
    return f"{prefix}{body}"


def _luhn_complete(prefix: str, length: int = 16) -> str:
    body = prefix + "0" * (length - len(prefix) - 1)
    total = 0
    alt = True
    for ch in reversed(body):
        n = ord(ch) - 48
        if alt:
            n *= 2
            if n > 9:
                n -= 9
        total += n
        alt = not alt
    check = (10 - (total % 10)) % 10
    return body + str(check)


def _emitted(result: RedactResult) -> str:
    return "" if result.drop else result.text


def _assert_no_leak(sample: str, secret: str) -> RedactResult:
    result = redact(sample)
    assert secret not in _emitted(result)
    return result


SK_LIVE = _fake("sk_live_", "FakeLocalOnly51AbCdEfGhIj")
SK_TEST = _fake("sk_test_", "FakeLocalOnly51XyZ123456")
RK_LIVE = _fake("rk_live_", "FakeLocalOnlyRk0000001")
PK_TEST = _fake("pk_test_", "FakeLocalOnlyPk0000001")
WHSEC = _fake("whsec_", "FakeLocalOnlyWhsec0001")
GHP = _fake("ghp_", "FakeLocalOnlyToken0000000000000000")
GHO = _fake("gho_", "FakeLocalOnlyOauth000000000000000")
GHS = _fake("ghs_", "FakeLocalOnlyServer00000000000000")
GHU = _fake("ghu_", "FakeLocalOnlyUser0000000000000000")
GHR = _fake("ghr_", "FakeLocalOnlyRefresh000000000000")
GITHUB_PAT = _fake("github_pat_", "11AAAAAAA_FakeLocalOnly000000000000000")
XAI = _fake("xai-", "fakeLocalOnlyKey0000000001")
JWT = _fake("eyJ", "hbGciOiJIUzI1NiJ9") + "." + _fake("eyJ", "zdWIiOiJmYWtlIn0") + "." + ("c" * 16)
AKIA = _fake("AKIA", "FAKELOCALAWSKEY1")
ASIA = _fake("ASIA", "FAKELOCALAWSSTS1")
AIZA = _fake("AIza", "SyFakeLocalOnlyGoogleKey0000001AAAA")
XOXB = _fake("xoxb-", "12345678901-FakeSlack")
OPENAI = _fake("sk-", "fakeopenai00000000001")
OPENAI_PROJ = _fake("sk-proj-", "fakeproj0000000000001")
ANTHROPIC = _fake("sk-ant-", "api03-fakeanth00000000001")
RESEND = _fake("re_", "FakeResendKey0001")
BEARER_TOKEN = "faketokenvalue000000000"
BASIC_TOKEN = "ZmFrZTpmYWtlcGFzcw"
API_KEY_VALUE = "fake_api_key_value_123456"
PASSWORD_VALUE = "fake_local_only_password_value"
SHORT_KEY = "abcd"
PEM_BODY = "FAKEPEMLOCALONLYBODY0001"
PEM = "-----BEGIN " + "PRIVATE KEY-----\n" + PEM_BODY + "\n-----END " + "PRIVATE KEY-----"
ENC_PEM = (
    "-----BEGIN ENCRYPTED "
    + "PRIVATE KEY-----\n"
    + PEM_BODY
    + "\n-----END ENCRYPTED "
    + "PRIVATE KEY-----"
)
PGP = "-----BEGIN PGP " + "MESSAGE-----\n" + PEM_BODY + "\n-----END PGP " + "MESSAGE-----"
TRUNC_PEM = "-----BEGIN " + "PRIVATE KEY-----\n" + PEM_BODY + "\n"
HEX64 = _fake("0x", "ab" * 32)
EMAIL = _fake("probe.user", "@example.com")
PHONE = "555" + "-010" + "-0099"
SSN = "219" + "-09" + "-9999"
IPV4 = "192.0.2.1"
IPV6 = "2001:db8::1"
ADDRESS = "123 Fake Street, Springfield, IL 62701"
DB_PASS = "fakeDbPassOnly"
DB_URL = _fake("mysql://reviewer:", DB_PASS) + "@db.example.test/records"
MNEMONIC_12 = " ".join(sorted(bip39_words())[:12])
MNEMONIC_24 = " ".join(sorted(bip39_words())[:24])
CARD = _luhn_complete("4000")


GAP_CASES = [
    ("sk_live", f"stripe={SK_LIVE}", SK_LIVE),
    ("sk_test", f"stripe_key: {SK_TEST}", SK_TEST),
    ("rk_live", f"restricted={RK_LIVE}", RK_LIVE),
    ("pk_test", f"publishable={PK_TEST}", PK_TEST),
    ("whsec", f"webhook={WHSEC}", WHSEC),
    ("ghp", f"export GITHUB_TOKEN={GHP}", GHP),
    ("gho", f"oauth={GHO}", GHO),
    ("ghs", f"server={GHS}", GHS),
    ("ghu", f"user={GHU}", GHU),
    ("ghr", f"refresh={GHR}", GHR),
    ("github_pat", f"Authorization: token {GITHUB_PAT}", GITHUB_PAT),
    ("xai", f"XAI_API_KEY={XAI}", XAI),
    ("jwt", f"service_role={JWT}", JWT),
    ("akia", f"aws_key={AKIA}", AKIA),
    ("asia", f"sts_key={ASIA}", ASIA),
    ("aiza", f"google={AIZA}", AIZA),
    ("xoxb", f"slack={XOXB}", XOXB),
    ("openai_sk", f"openai={OPENAI}", OPENAI),
    ("openai_proj", f"openai={OPENAI_PROJ}", OPENAI_PROJ),
    ("anthropic", f"anthropic={ANTHROPIC}", ANTHROPIC),
    ("resend", f"email_key={RESEND}", RESEND),
    ("resend_key_short", f"RESEND_KEY={SHORT_KEY}", SHORT_KEY),
    ("private_key_assign", f"PRIVATE_KEY={SHORT_KEY}", SHORT_KEY),
    ("supabase_service_role", f"SUPABASE_SERVICE_ROLE_KEY={JWT}", JWT),
    ("database_url", f"DATABASE_URL={DB_URL}", DB_PASS),
    ("json_apiKey", f'{{"apiKey": "{API_KEY_VALUE}"}}', API_KEY_VALUE),
    ("json_stripe_secret_key", f'{{"stripe_secret_key": "{SK_TEST}"}}', SK_TEST),
    ("auth_bearer", f"Authorization: Bearer {BEARER_TOKEN}", BEARER_TOKEN),
    ("auth_basic", f"Authorization: Basic {BASIC_TOKEN}", BASIC_TOKEN),
    ("auth_token", f"Authorization: token {GITHUB_PAT}", GITHUB_PAT),
    ("pem", f"tls:\n{PEM}\n", PEM_BODY),
    ("encrypted_pem", f"tls:\n{ENC_PEM}\n", PEM_BODY),
    ("pgp", f"msg:\n{PGP}\n", PEM_BODY),
    ("truncated_pem", f"cfg:\n{TRUNC_PEM}", PEM_BODY),
    ("hex64", f"wallet={HEX64}", HEX64),
    ("bip39_12", f"seed={MNEMONIC_12}", MNEMONIC_12),
    ("bip39_24", f"seed={MNEMONIC_24}", MNEMONIC_24),
    ("url_userinfo", f"connect {DB_URL}", DB_PASS),
    ("email", f"contact {EMAIL} please", EMAIL),
    ("phone", f"call {PHONE}", PHONE),
    ("ssn", f"ssn {SSN}", SSN),
    ("card", f"pan {CARD}", CARD),
    ("ipv4", f"host {IPV4}", IPV4),
    ("ipv6", f"host {IPV6}", IPV6),
    ("us_address", f"mail {ADDRESS}", ADDRESS),
]


def research_probes() -> list[tuple[str, str, str]]:
    """Research's 39-probe set from the #1921 privacy gate."""
    return [
        ("sk_live", f"using {SK_LIVE}", SK_LIVE),
        ("ghp", f"token {GHP}", GHP),
        ("rk_live", f"key {RK_LIVE}", RK_LIVE),
        ("pk_test", f"key {PK_TEST}", PK_TEST),
        ("whsec", f"sig {WHSEC}", WHSEC),
        ("gho", f"tok {GHO}", GHO),
        ("ghs", f"tok {GHS}", GHS),
        ("ghu", f"tok {GHU}", GHU),
        ("ghr", f"tok {GHR}", GHR),
        ("jwt", f"jwt {JWT}", JWT),
        ("akia", f"id {AKIA}", AKIA),
        ("asia", f"id {ASIA}", ASIA),
        ("aiza", f"key {AIZA}", AIZA),
        ("xoxb", f"slack {XOXB}", XOXB),
        ("openai", f"key {OPENAI}", OPENAI),
        ("openai_proj", f"key {OPENAI_PROJ}", OPENAI_PROJ),
        ("anthropic", f"key {ANTHROPIC}", ANTHROPIC),
        ("resend", f"key {RESEND}", RESEND),
        ("resend_key", f"RESEND_KEY={SHORT_KEY}", SHORT_KEY),
        ("private_key", f"PRIVATE_KEY={SHORT_KEY}", SHORT_KEY),
        ("supabase", f"SUPABASE_SERVICE_ROLE_KEY={JWT}", JWT),
        ("database_url", f"DATABASE_URL={DB_URL}", DB_PASS),
        ("json_apiKey", f'{{"apiKey":"{API_KEY_VALUE}"}}', API_KEY_VALUE),
        ("json_stripe_secret", f'{{"stripe_secret_key":"{SK_TEST}"}}', SK_TEST),
        ("auth_basic", f"Authorization: Basic {BASIC_TOKEN}", BASIC_TOKEN),
        ("auth_token", f"Authorization: token {BEARER_TOKEN}", BEARER_TOKEN),
        ("encrypted_pem", ENC_PEM, PEM_BODY),
        ("pgp", PGP, PEM_BODY),
        ("truncated_pem", TRUNC_PEM, PEM_BODY),
        ("hex64", HEX64, HEX64),
        ("bip39", MNEMONIC_12, MNEMONIC_12),
        ("url_userinfo", DB_URL, DB_PASS),
        ("email", EMAIL, EMAIL),
        ("phone", PHONE, PHONE),
        ("ssn", SSN, SSN),
        ("card", CARD, CARD),
        ("ipv4", IPV4, IPV4),
        ("ipv6", IPV6, IPV6),
        ("us_address", ADDRESS, ADDRESS),
    ]


def test_research_probe_count_is_39() -> None:
    assert len(research_probes()) == 39


@pytest.mark.parametrize("label,sample,secret", research_probes(), ids=[p[0] for p in research_probes()])
def test_research_probes_leak_nothing(label: str, sample: str, secret: str) -> None:
    _assert_no_leak(sample, secret)


def test_research_probes_leak_count_is_zero() -> None:
    leaks = [
        label
        for label, sample, secret in research_probes()
        if secret in _emitted(redact(sample))
    ]
    assert leaks == [], f"{len(leaks)} leaks: {leaks}"


def test_every_compiled_pattern_has_a_case() -> None:
    samples = [sample for _, sample, _ in GAP_CASES + research_probes()]
    patterns = list(SECRET_PATTERNS) + list(ASSIGNMENT_PATTERNS)
    uncovered = [
        i
        for i, pattern in enumerate(patterns)
        if not any(pattern.search(sample) for sample in samples)
    ]
    assert uncovered == [], f"secret patterns missing coverage: {uncovered}"


@pytest.mark.parametrize("label,sample,secret", GAP_CASES, ids=[c[0] for c in GAP_CASES])
def test_each_gap_removes_the_secret(label: str, sample: str, secret: str) -> None:
    result = _assert_no_leak(sample, secret)
    if not result.drop:
        assert MARKER in result.text or result.changed


def test_full_match_capture_group_does_not_echo_secret() -> None:
    pattern = re.compile(r"(?i)(sk_live_[A-Za-z0-9]+)")
    assert pattern.groups == 1
    match = pattern.search(SK_LIVE)
    assert match is not None
    assert match.group(1) == match.group(0) == SK_LIVE

    result = redact(f"stripe={SK_LIVE}")
    assert SK_LIVE not in _emitted(result)
    assert f"{SK_LIVE}{MARKER}" not in result.text
    if not result.drop:
        assert result.text == f"stripe={MARKER}"


def test_assignment_prefix_survives_and_value_does_not() -> None:
    result = redact(f"password={PASSWORD_VALUE}")
    assert PASSWORD_VALUE not in _emitted(result)
    if not result.drop:
        assert result.text.startswith("password=")
        assert result.text == f"password={MARKER}"


def test_assignment_has_no_minimum_value_length() -> None:
    result = redact("API_KEY=ab")
    assert "ab" not in _emitted(result)
    if not result.drop:
        assert result.text == f"API_KEY={MARKER}"


def test_url_encoded_secret_redacts_original_span() -> None:
    encoded = quote(SK_LIVE, safe="")
    result = _assert_no_leak(f"k={encoded}", SK_LIVE)
    assert encoded not in _emitted(result)


def test_unicode_escaped_secret_redacts_original_span() -> None:
    escaped = "".join(f"\\u{ord(ch):04x}" for ch in SK_LIVE)
    result = _assert_no_leak(f"k={escaped}", SK_LIVE)
    assert escaped not in _emitted(result)


def test_split_across_lines_does_not_leak_tail() -> None:
    head, tail = SK_LIVE[:12], SK_LIVE[12:]
    sample = f"{head}\n{tail}"
    result = _assert_no_leak(sample, SK_LIVE)
    assert tail not in _emitted(result)


def test_base64_secret_redacts_original_run() -> None:
    blob = base64.b64encode(SK_LIVE.encode("utf-8")).decode("ascii")
    result = _assert_no_leak(f"blob={blob}", SK_LIVE)
    assert blob not in _emitted(result)


def test_blocklist_exact_match(tmp_path, monkeypatch) -> None:
    secret = "999 Example Court Unit 4"
    path = tmp_path / "pii-blocklist"
    path.write_text(secret + "\n", encoding="utf-8")
    monkeypatch.setenv("GROKBOT_PII_BLOCKLIST", str(path))
    result = redact(f"visit {secret} today")
    assert secret not in _emitted(result)
