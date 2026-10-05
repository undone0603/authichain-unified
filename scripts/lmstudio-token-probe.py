#!/usr/bin/env python3
"""Non-leaking LM Studio token + health probe.

Loads gitignored env files, reports name/length/mode/gitignore/health.
Never prints secret values. Idempotent. Exit 0 only if a token of
expected length is present AND LM Studio answers /v1/models.

Cost: $0/mo. Run from repo root.
"""
from __future__ import annotations

import os
import stat
import subprocess
import sys
from pathlib import Path

EXPECTED_LEN = 35
NAMES = ("LM_STUDIO_API_TOKEN", "LM_API_TOKEN")
REPO = Path("/home/zac/projects/authichain-unified")
ENV_FILES = (
    REPO / ".env",
    Path.home() / ".config/grok-secrets/secrets.env",
)


def _load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip("'\"")
        if key in NAMES and val and key not in os.environ:
            os.environ[key] = val


def _mode(path: Path) -> str:
    if not path.exists():
        return "missing"
    return oct(stat.S_IMODE(path.stat().st_mode))


def _gitignored(path: Path) -> str:
    try:
        r = subprocess.run(
            ["git", "check-ignore", "-q", str(path)],
            cwd=str(REPO),
            check=False,
        )
        return "yes" if r.returncode == 0 else "NO"
    except OSError:
        return "unknown"


def main() -> int:
    for path in ENV_FILES:
        _load_env_file(path)

    token = os.environ.get("LM_STUDIO_API_TOKEN") or os.environ.get("LM_API_TOKEN") or ""
    present = bool(token)
    length = len(token)
    token = ""  # drop value; metadata only from here

    print("event=lmstudio.token_probe")
    for path in ENV_FILES:
        print(
            f"file={path} exists={str(path.is_file()).lower()} "
            f"mode={_mode(path)} gitignored={_gitignored(path)}"
        )
    print(
        f"names={','.join(NAMES)} present={str(present).lower()} "
        f"length={length} expected={EXPECTED_LEN}"
    )

    if not present:
        print("status=missing_token")
        return 2
    if length != EXPECTED_LEN:
        print(f"status=unexpected_length actual={length}")
        return 3

    sys.path.insert(0, str(REPO))
    from agentz.lm_studio import LMStudioClient

    client = LMStudioClient()
    alive = client.health_check()
    models = client.list_models() if alive else []
    print(f"lm_studio_up={str(alive).lower()} model_count={len(models)}")
    if models:
        print("models=" + ",".join(models))
    print("status=" + ("ok" if alive else "token_present_studio_down"))
    return 0 if alive else 1


if __name__ == "__main__":
    sys.exit(main())
