"""Fetch Vercel project environment variables and persist known credentials.

Usage:
  python -m agentz.tools.fetch_vercel_envs

This script reads `VERCEL_TOKEN` (via AgentZ credential `vercel_session`) and
any `VERCEL_PROJECT_*` env vars registered in `agentz.core.credentials`. It
fetches environment variables from each project and writes matching vars into
the AgentZ `.env` using `update_credential()` where possible.
"""
from __future__ import annotations

import os
import sys
import httpx
import logging
from agentz.core.credentials import CRED_KEY_TO_ENV, get, update_credential

logger = logging.getLogger("agentz.fetch_vercel_envs")


def reverse_mapping() -> dict[str, str]:
    # env_name -> cred_key
    return {v: k for k, v in CRED_KEY_TO_ENV.items()}


def fetch_project_envs(token: str, project_id: str) -> list[dict]:
    url = f"https://api.vercel.com/v9/projects/{project_id}/env"
    headers = {"Authorization": f"Bearer {token}"}
    r = httpx.get(url, headers=headers, timeout=15.0)
    r.raise_for_status()
    return r.json().get("environmentVariables") or r.json().get("env") or r.json()


def persist_var(env_name: str, value: str) -> None:
    rev = reverse_mapping()
    cred_key = rev.get(env_name)
    if cred_key:
        ok = update_credential(cred_key, value)
        if ok:
            logger.info(f"Persisted {env_name} -> credential '{cred_key}'")
        else:
            logger.warning(f"Failed to persist {env_name} to .env (credential '{cred_key}')")
    else:
        # Fallback: write raw env var to .env if possible
        written = update_credential(env_name, value)
        if written:
            logger.info(f"Persisted raw env {env_name} to .env")
        else:
            logger.warning(f"Could not persist raw env {env_name} to .env")


def main() -> int:
    try:
        token = get("vercel_session", required=False)
    except Exception:
        token = None

    if not token:
        print("VERCEL_TOKEN (vercel_session) not set. Set it and rerun.")
        return 2

    # Look for known project env var names
    proj_keys = [k for k in CRED_KEY_TO_ENV if k.startswith("vercel_project_")]
    found_any = False
    for pk in proj_keys:
        env_name = CRED_KEY_TO_ENV[pk]
        project_id = os.environ.get(env_name)
        if not project_id:
            continue
        print(f"Fetching envs for project {project_id} (env {env_name})...")
        try:
            items = fetch_project_envs(token, project_id)
        except Exception as e:
            print(f"Failed to fetch envs for {project_id}: {e}")
            continue
        # items expected to be list of {key, value, target} - handle multiple shapes
        for it in items:
            if isinstance(it, dict):
                key = it.get("key") or it.get("name") or it.get("env")
                val = it.get("value") or it.get("value_preview") or it.get("preview_value") or None
                if key and val:
                    persist_var(key, val)
                    found_any = True
                else:
                    logger.debug(f"Skipping item (no key/value): {it}")
            else:
                logger.debug(f"Unexpected env item shape: {it}")

    if not found_any:
        print("No matching env vars persisted. Check project IDs or token scopes.")
        return 1

    print("Done: Vercel env sync complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
