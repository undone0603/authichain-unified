"""
agentz.core.credentials
-----------------------
Centralized credential loading. Reads from .env file in AgentZ root.
Never logs secret values; only logs which keys were resolved.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Map registry credential keys → env var names.
# Add new entries here when introducing new workflows.
CRED_KEY_TO_ENV = {
    "vercel_session":       "VERCEL_TOKEN",
    "vercel_team_id":       "VERCEL_TEAM_ID",
    "google_session":       "GOOGLE_SESSION_COOKIE",
    "cloudflare_api_token": "CLOUDFLARE_API_TOKEN",
    "cloudflare_account":   "CLOUDFLARE_ACCOUNT_ID",
    "stripe_secret":        "STRIPE_SECRET_KEY",
    "n8n_api_key":          "N8N_API_KEY",
    "n8n_base_url":         "N8N_BASE_URL",
    "resend_api_key":       "RESEND_API_KEY",
    "hubspot_token":        "HUBSPOT_PRIVATE_APP_TOKEN",
    "hubspot_owner_id":     "HUBSPOT_OWNER_ID",
    "gmail_oauth":          "GMAIL_OAUTH_REFRESH_TOKEN",
    "linkedin_session":     "LINKEDIN_SESSION_COOKIE",
    "reddit_session":       "REDDIT_SESSION_COOKIE",
    "polygon_session":      "POLYGON_SESSION_COOKIE",
    "github_pat_zkie":      "GITHUB_PAT_ZKIE",
    "github_pat_undone":    "GITHUB_PAT_UNDONE",
    "supabase_anon":        "SUPABASE_ANON_KEY",
    "supabase_url":         "SUPABASE_URL",
    "pinecone_api_key":     "PINECONE_API_KEY",
    "groq_api_key":         "GROQ_API_KEY",
    "gemini_api_key":       "GEMINI_API_KEY",
    "huggingface_token":    "HF_TOKEN_PRIMARY",
    "fal_key":              "FAL_KEY",
}

_loaded = False


def _ensure_loaded() -> None:
    global _loaded
    if _loaded:
        return
    # Look for .env in AgentZ root (parent of agentz/ package)
    here = Path(__file__).resolve()
    for candidate in [here.parents[2] / ".env", here.parents[1] / ".env"]:
        if candidate.exists():
            load_dotenv(candidate)
            break
    _loaded = True


def get(key: str, required: bool = True) -> Optional[str]:
    """Resolve a credential key from registry → env var."""
    _ensure_loaded()
    env_name = CRED_KEY_TO_ENV.get(key)
    if not env_name:
        if required:
            raise KeyError(f"Unknown credential key: {key}")
        return None
    value = os.environ.get(env_name)
    if not value and required:
        raise RuntimeError(
            f"Missing credential '{key}' (env var {env_name}). "
            f"Add it to your .env file."
        )
    return value


def get_or_placeholder(key: str, ctx) -> str:
    """Cred getter that returns a safe placeholder in dry-run mode.
    Use in handlers so they can render plans without real secrets."""
    from agentz.core.modes import Mode
    if ctx.mode == Mode.DRY_RUN:
        env_name = CRED_KEY_TO_ENV.get(key, key.upper())
        return os.environ.get(env_name) or f"<{key}:placeholder>"
    return get(key, required=True)


def check_all(keys: list[str]) -> tuple[list[str], list[str]]:
    """Return (present, missing) credential keys."""
    _ensure_loaded()
    present, missing = [], []
    for k in keys:
        env_name = CRED_KEY_TO_ENV.get(k)
        if env_name and os.environ.get(env_name):
            present.append(k)
        else:
            missing.append(k)
    return present, missing
