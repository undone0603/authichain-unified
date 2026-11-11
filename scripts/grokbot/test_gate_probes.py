"""Research's 39-probe set from the #1921 privacy gate (fake values only)."""
from __future__ import annotations

import base64
import urllib.parse

import pytest

from grokbot import redact


def _core() -> str:
    return "Zq9Xw7Lm2Np4Rt6Vy8Bc1Df3Gh5Jk0Mn"


def gate_probes() -> list[tuple[str, str]]:
    """Rebuild the gate probes at runtime so no contiguous token is committed."""
    fake = _core()
    hex64 = "a3f1" * 16
    jwt = (
        "eyJ" + "hbGciOiJIUzI1NiJ9"
        + "."
        + "eyJ" + "yb2xlIjoic2VydmljZV9yb2xlIn0."
        + fake
    )
    return [
        ("stripe sk", "sk_live_" + fake),
        ("stripe rk", "rk_live_" + fake),
        ("stripe pk", "pk_test_" + fake),
        ("whsec", "whsec_" + fake),
        ("ghp", "ghp_" + fake + "abcd"),
        ("gho", "gho_" + fake + "abcd"),
        ("ghs", "ghs_" + fake + "abcd"),
        ("github_pat", "github_pat_" + fake + "_" + fake),
        ("jwt", jwt),
        ("aws akid", "AKIA" + "QWERTYUIOPASDFGH"),
        ("aws secret", "aws_secret_access_key = " + fake + "/xYz"),
        ("google", "AIza" + fake + "abc"),
        ("slack", "xoxb-1234567890-" + fake),
        ("openai", "sk-proj-" + fake + fake),
        ("anthropic", "sk-ant-api03-" + fake + fake),
        ("resend", "re_" + fake),
        ("xai", "xai-" + fake),
        ("RESEND_KEY env", "RESEND_KEY=" + fake),
        ("PRIVATE_KEY env", "PRIVATE_KEY=" + fake),
        ("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY=" + fake),
        ("DATABASE_URL", "DATABASE_URL=[REDACTED]://u:" + fake + "@db.example.com/x"),
        ("short value", "API_TOKEN=Zq9X7Lm2"),
        ("json apiKey", '{"apiKey": "' + fake + '"}'),
        ("json stripe_secret_key", '{"stripe_secret_key":"' + fake + '"}'),
        ("basic auth", "Authorization: Basic " + fake),
        ("token auth", "Authorization: token " + fake),
        (
            "PEM encrypted",
            "-----BEGIN ENCRYPTED PRIVATE KEY-----\n" + fake + "\n-----END ENCRYPTED PRIVATE KEY-----",
        ),
        ("PEM truncated", "-----BEGIN RSA PRIVATE KEY-----\n" + fake + "\n"),
        ("wallet hex", "0x" + hex64),
        (
            "bip39",
            "abandon ability able about above absent absorb abstract absurd abuse access accident",
        ),
        ("url creds", "https://admin:" + fake + "@example.com/"),
        ("email", "contact jane.doe.fake@example.org now"),
        ("phone", "call (555) 867-5309"),
        ("ssn", "ssn " + "078" + "-05" + "-1120"),
        ("card", "card " + "4111" + " 1111" + " 1111" + " 1111"),
        ("street addr", "123 Maple Street Springfield IL 62704"),
        ("base64", "blob " + base64.b64encode(("sk_live_" + fake).encode()).decode()),
        (
            "urlenc",
            "q=" + urllib.parse.quote("sk_live_" + fake, safe="").replace("_", "%5F"),
        ),
        (
            "split+jsonesc",
            "sk_live_" + fake[:12] + "\\\n" + fake[12:] + ' and "\\u0073k_live_' + fake + '"',
        ),
    ]


def _cores() -> dict[str, str]:
    return {
        "bip39": "accident",
        "email": "jane.doe.fake",
        "phone": "867-5309",
        "ssn": "078-05-1120",
        "card": "1111 1111",
        "street addr": "123 Maple",
        "wallet hex": ("a3f1" * 16)[:16],
        "aws akid": "QWERTYUIOP",
        "short value": "Zq9X7Lm2",
    }


def _is_leak(label: str, sample: str) -> bool:
    result = redact(sample)
    if result.drop:
        return False
    fake = _core()
    core = _cores().get(label, fake[-10:])
    text = result.text
    if core in text:
        return True
    if label not in _cores() and any(fake[i : i + 8] in text for i in range(len(fake) - 7)):
        return True
    return False


def test_gate_probe_count_is_39() -> None:
    assert len(gate_probes()) == 39


@pytest.mark.parametrize("label,sample", gate_probes(), ids=[p[0] for p in gate_probes()])
def test_gate_probes_leak_nothing(label: str, sample: str) -> None:
    assert not _is_leak(label, sample), f"leak: {label}"


def test_gate_probes_leak_count_is_zero() -> None:
    leaks = [label for label, sample in gate_probes() if _is_leak(label, sample)]
    assert leaks == [], f"{len(leaks)} leaks: {leaks}"


def test_split_and_json_escape_is_dropped_without_leak() -> None:
    """Regression: a \\u0073k_live_ escape plus a backslash-newline split."""
    fake = _core()
    sample = "sk_live_" + fake[:12] + "\\\n" + fake[12:] + ' and "\\u0073k_live_' + fake + '"'
    result = redact(sample)
    emitted = "" if result.drop else result.text
    assert result.drop
    assert fake not in emitted
    assert fake[-10:] not in emitted
    assert fake[12:] not in emitted
