"""LMStudioClient must stay on loopback. LAN / public hosts are SSRF.

No network calls. Construction only.
"""

import pytest

from agentz.lm_studio import LMStudioClient


def test_loopback_constructs():
    client = LMStudioClient(base_url="http://127.0.0.1:1234/v1")
    assert client.base_url.endswith("/v1")


def test_localhost_constructs():
    client = LMStudioClient(base_url="http://localhost:1234/v1")
    assert "localhost" in client.base_url


@pytest.mark.parametrize(
    "url",
    [
        "http://192.168.254.10:1234/v1",
        "http://10.0.0.5:1234/v1",
        "http://example.com/v1",
    ],
)
def test_non_loopback_rejected(url):
    with pytest.raises(ValueError, match="localhost"):
        LMStudioClient(base_url=url)
