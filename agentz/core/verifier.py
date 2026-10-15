"""Independent post-run verifier for AgentZ workflows.

A workflow's registry entry may declare ``verify:`` checks. After a handler
reports success, the runner evaluates them independently of the handler's own
return value, so "the handler said done" is never the only evidence.

Fail-closed: an unknown check type, a malformed spec, or any exception while
evaluating counts as a FAILED check. No checks declared means there is nothing
to verify (``configured`` is False and ``ok`` is True) so existing workflows are
unaffected until they opt in.

All checks are read-only:

  file_exists    {type, path}
  file_contains  {type, path, text}
  file_fresh     {type, path, max_age_seconds}
  json_field     {type, path, key, equals?}    dotted key, list indexes allowed
  http_status    {type, url, expect=200, timeout=10}    http(s) GET only
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, Mapping, Optional, Sequence, Tuple


@dataclass(frozen=True)
class CheckResult:
    check: str
    ok: bool
    detail: str


@dataclass(frozen=True)
class VerifyResult:
    ok: bool
    configured: bool
    results: Tuple[CheckResult, ...] = ()

    def summary(self) -> str:
        if not self.configured:
            return "[verify] no checks declared; nothing to verify"
        passed = sum(1 for r in self.results if r.ok)
        lines = [f"[verify] {'PASS' if self.ok else 'FAIL'}: {passed}/{len(self.results)} checks passed"]
        for r in self.results:
            lines.append(f"[verify]   {'ok  ' if r.ok else 'FAIL'} {r.check}: {r.detail}")
        return "\n".join(lines)


def _req(spec: Mapping[str, Any], key: str) -> Any:
    value = spec.get(key)
    if value is None or (isinstance(value, str) and not value.strip()):
        raise ValueError(f"missing required field '{key}'")
    return value


def _file_exists(spec: Mapping[str, Any]) -> Tuple[bool, str]:
    path = Path(str(_req(spec, "path")))
    return path.exists(), f"{path} {'exists' if path.exists() else 'is missing'}"


def _file_contains(spec: Mapping[str, Any]) -> Tuple[bool, str]:
    path = Path(str(_req(spec, "path")))
    text = str(_req(spec, "text"))
    if not path.is_file():
        return False, f"{path} is missing"
    found = text in path.read_text(errors="replace")
    return found, f"{path} {'contains' if found else 'does not contain'} {text!r}"


def _file_fresh(spec: Mapping[str, Any]) -> Tuple[bool, str]:
    path = Path(str(_req(spec, "path")))
    limit = float(_req(spec, "max_age_seconds"))
    if not path.exists():
        return False, f"{path} is missing"
    age = time.time() - path.stat().st_mtime
    return age <= limit, f"{path} is {age:.0f}s old (max {limit:.0f}s)"


def _json_field(spec: Mapping[str, Any]) -> Tuple[bool, str]:
    path = Path(str(_req(spec, "path")))
    key = str(_req(spec, "key"))
    if not path.is_file():
        return False, f"{path} is missing"
    current: Any = json.loads(path.read_text())
    for part in key.split("."):
        if isinstance(current, Mapping) and part in current:
            current = current[part]
        elif isinstance(current, list) and part.isdigit() and int(part) < len(current):
            current = current[int(part)]
        else:
            return False, f"{key!r} not found in {path}"
    if "equals" in spec:
        return current == spec["equals"], f"{key}={current!r} (want {spec['equals']!r})"
    return True, f"{key!r} present in {path}"


def _http_status(spec: Mapping[str, Any]) -> Tuple[bool, str]:
    url = str(_req(spec, "url"))
    if not url.lower().startswith(("http://", "https://")):
        raise ValueError("only http(s) URLs are allowed")
    expect = int(spec.get("expect", 200))
    timeout = float(spec.get("timeout", 10))
    request = urllib.request.Request(url, method="GET", headers={"User-Agent": "agentz-verifier/1"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310 - scheme checked above
            code = response.status
    except urllib.error.HTTPError as exc:
        code = exc.code
    return code == expect, f"{url} -> {code} (want {expect})"


CHECKS: Dict[str, Callable[[Mapping[str, Any]], Tuple[bool, str]]] = {
    "file_exists": _file_exists,
    "file_contains": _file_contains,
    "file_fresh": _file_fresh,
    "json_field": _json_field,
    "http_status": _http_status,
}


def run_checks(specs: Optional[Sequence[Any]]) -> VerifyResult:
    """Evaluate every declared check; the result is ok only if all of them pass."""
    if specs is None or (isinstance(specs, (list, tuple)) and len(specs) == 0):
        return VerifyResult(ok=True, configured=False)
    if not isinstance(specs, (list, tuple)):
        bad = CheckResult("verify", False, "verify must be a list of check mappings")
        return VerifyResult(ok=False, configured=True, results=(bad,))

    results = []
    for index, spec in enumerate(specs):
        label = f"#{index}"
        try:
            if not isinstance(spec, Mapping):
                raise ValueError("check must be a mapping")
            kind = spec.get("type")
            label = str(kind)
            check = CHECKS.get(kind)  # type: ignore[arg-type]
            if check is None:
                raise ValueError(f"unknown check type {kind!r}")
            ok, detail = check(spec)
            results.append(CheckResult(label, bool(ok), detail))
        except Exception as exc:  # noqa: BLE001 - fail closed on anything unexpected
            results.append(CheckResult(label, False, f"error: {exc}"))
    return VerifyResult(ok=all(r.ok for r in results), configured=True, results=tuple(results))
