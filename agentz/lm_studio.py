"""LM Studio client — wraps the OpenAI-compatible REST API at localhost:1234."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any

LM_STUDIO_BASE_URL = "http://localhost:1234/v1"
DEFAULT_TIMEOUT = 120


@dataclass
class LMStudioClient:
    base_url: str = LM_STUDIO_BASE_URL
    timeout: int = DEFAULT_TIMEOUT
    model: str = "local-model"

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        data = json.dumps(payload).encode()
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return json.loads(resp.read())

    def _get(self, path: str) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())

    def health_check(self) -> bool:
        """Return True if LM Studio is reachable and has at least one model loaded."""
        try:
            data = self._get("/models")
            return bool(data.get("data"))
        except Exception:
            return False

    def list_models(self) -> list[str]:
        """Return IDs of all models currently loaded in LM Studio."""
        try:
            data = self._get("/models")
            return [m["id"] for m in data.get("data", [])]
        except Exception:
            return []

    def chat(
        self,
        messages: list[dict[str, str]],
        *,
        max_tokens: int = 1024,
        temperature: float = 0.3,
    ) -> str:
        """Send a chat request and return the assistant reply text."""
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        result = self._post("/chat/completions", payload)
        return result["choices"][0]["message"]["content"]
