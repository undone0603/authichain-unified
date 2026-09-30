#!/usr/bin/env python3
"""LM Studio bind probe. Prints host/port/status only. Never prints tokens."""
from __future__ import annotations

import json
import os
import socket
import sys
import urllib.error
import urllib.request
from pathlib import Path

PORTS = (1234, 59646)
HOSTS = ("127.0.0.1", "localhost")
TIMEOUT = 2.0

def load_env_files() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    root = Path("/home/zac/projects/authichain-unified")
    load_dotenv(root / ".env")
    extra = Path.home() / ".config/grok-secrets/secrets.env"
    if extra.is_file():
        load_dotenv(extra)

def token_present() -> tuple[bool, int]:
    val = os.environ.get("LM_STUDIO_API_TOKEN") or os.environ.get("LM_API_TOKEN") or ""
    return bool(val), len(val)

def tcp_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=TIMEOUT):
            return True
    except OSError:
        return False

def models_status(url: str, token: str | None) -> tuple[str, int]:
    req = urllib.request.Request(url, method="GET")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            body = json.loads(resp.read() or b"{}")
            n = len(body.get("data") or [])
            return f"http_{resp.status}", n
    except urllib.error.HTTPError as e:
        return f"http_{e.code}", 0
    except Exception as e:
        return type(e).__name__, 0

def main() -> int:
    load_env_files()
    present, length = token_present()
    token = os.environ.get("LM_STUDIO_API_TOKEN") or os.environ.get("LM_API_TOKEN") or None
    print(f"event=lmstudio.bind_probe token_present={str(present).lower()} token_length={length}")
    any_up = False
    for port in PORTS:
        for host in HOSTS:
            open_ = tcp_open(host, port)
            url = f"http://{host}:{port}/v1/models"
            http, models = models_status(url, token) if open_ else ("tcp_closed", 0)
            print(f"host={host} port={port} tcp={'open' if open_ else 'closed'} http={http} model_count={models}")
            if open_ and http in {"http_200", "http_401"}:
                any_up = True
    print("status=" + ("studio_up_nondefault_or_default" if any_up else "studio_down"))
    print("note=prefer Developer Server port 1234; 59646 is ephemeral; do not commit it")
    return 0 if any_up else 1

if __name__ == "__main__":
    sys.exit(main())
