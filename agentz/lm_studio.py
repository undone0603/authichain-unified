"""LM Studio client — OpenAI-compatible REST API at localhost:1234.

Local inference plane for AgentZ / Trust Kernel. Cloud models stay fallback.
This client never executes tools and never leaves loopback.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any

LM_STUDIO_BASE_URL = "http://127.0.0.1:1234/v1"
DEFAULT_TIMEOUT = 120
_ALLOWED_HOSTS = {"localhost", "127.0.0.1", "::1"}


def _validate_base_url(base_url: str) -> str:
    """Restrict requests to loopback addresses to prevent SSRF."""
    parsed = urllib.parse.urlparse(base_url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Unsupported scheme: {parsed.scheme!r}")
    hostname = parsed.hostname or ""
    if hostname not in _ALLOWED_HOSTS:
        raise ValueError(
            f"LMStudioClient only connects to localhost, got: {hostname!r}"
        )
    return base_url.rstrip("/")


@dataclass(frozen=True)
class ChatResult:
    """One chat/completions turn. tool_calls are proposals, not executed."""

    content: str
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    finish_reason: str = ""
    model: str = ""
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def has_tool_calls(self) -> bool:
        return bool(self.tool_calls)


@dataclass
class LMStudioClient:
    base_url: str = LM_STUDIO_BASE_URL
    timeout: int = DEFAULT_TIMEOUT
    model: str = "local-model"
    embedding_model: str | None = None
    api_key: str | None = None

    def __post_init__(self) -> None:
        self.base_url = _validate_base_url(self.base_url)
        if self.api_key is None:
            self.api_key = os.environ.get("LM_STUDIO_API_TOKEN") or os.environ.get(
                "LM_API_TOKEN"
            )

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        data = json.dumps(payload).encode()
        req = urllib.request.Request(
            url,
            data=data,
            headers=self._headers(),
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return json.loads(resp.read())

    def _get(self, path: str) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        req = urllib.request.Request(url, headers=self._headers(), method="GET")
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
            return [m["id"] for m in data.get("data", []) if "id" in m]
        except Exception:
            return []

    def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        max_tokens: int = 1024,
        temperature: float = 0.3,
        tools: list[dict[str, Any]] | None = None,
        tool_choice: str | dict[str, Any] | None = None,
        response_format: dict[str, Any] | None = None,
    ) -> str:
        """Send a chat request and return assistant text.

        If the model returns tool_calls and no content, returns "".
        Use complete() when the caller must inspect tool_calls.
        """
        result = self.complete(
            messages,
            max_tokens=max_tokens,
            temperature=temperature,
            tools=tools,
            tool_choice=tool_choice,
            response_format=response_format,
        )
        return result.content

    def complete(
        self,
        messages: list[dict[str, Any]],
        *,
        max_tokens: int = 1024,
        temperature: float = 0.3,
        tools: list[dict[str, Any]] | None = None,
        tool_choice: str | dict[str, Any] | None = None,
        response_format: dict[str, Any] | None = None,
        model: str | None = None,
    ) -> ChatResult:
        """One /v1/chat/completions turn. Does not execute tools."""
        payload: dict[str, Any] = {
            "model": model or self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = tool_choice or "auto"
        if response_format:
            payload["response_format"] = response_format

        raw = self._post("/chat/completions", payload)
        choice = (raw.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        content = message.get("content") or ""
        tool_calls = message.get("tool_calls") or []
        return ChatResult(
            content=content if isinstance(content, str) else "",
            tool_calls=list(tool_calls),
            finish_reason=str(choice.get("finish_reason") or ""),
            model=str(raw.get("model") or payload["model"]),
            raw=raw,
        )

    def embed(
        self,
        texts: str | list[str],
        *,
        model: str | None = None,
    ) -> list[list[float]]:
        """Embed text via /v1/embeddings. Returns one vector per input string."""
        inputs = [texts] if isinstance(texts, str) else list(texts)
        if not inputs:
            return []
        payload: dict[str, Any] = {
            "model": model or self.embedding_model or self.model,
            "input": inputs,
        }
        raw = self._post("/embeddings", payload)
        rows = sorted(raw.get("data") or [], key=lambda row: row.get("index", 0))
        vectors: list[list[float]] = []
        for row in rows:
            embedding = row.get("embedding") or []
            vectors.append([float(x) for x in embedding])
        return vectors
