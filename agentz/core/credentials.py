"""
agentz.core.credentials
-----------------------
Centralized credential loading. Reads from .env file in AgentZ root.
Never logs secret values; only logs which keys were resolved.
"""
from __future__ import annotations

import os
import logging
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv

logger = logging.getLogger("agentz.credentials")

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
    "hubspot_token":        "HUBSPOT_SERVICE_KEY",
    "hubspot_owner_id":     "HUBSPOT_OWNER_ID",
    "gmail_oauth":          "GMAIL_OAUTH_REFRESH_TOKEN",
    "linkedin_session":     "LINKEDIN_SESSION_COOKIE",
    "reddit_session":       "REDDIT_SESSION_COOKIE",
    "twitter_session":      "TWITTER_SESSION_COOKIE",
    "polygon_session":      "POLYGON_SESSION_COOKIE",
    "github_pat_zkie":      "GITHUB_PAT_ZKIE",
    "github_pat_undone":    "GITHUB_PAT_UNDONE",
    "supabase_anon":        "SUPABASE_ANON_KEY",
    "supabase_service_key": "SUPABASE_SERVICE_ROLE_KEY",
    "supabase_url":         "SUPABASE_URL",
    "pinecone_api_key":     "PINECONE_API_KEY",
    "groq_api_key":         "GROQ_API_KEY",
    "gemini_api_key":       "GEMINI_API_KEY",
    "huggingface_token":    "HF_TOKEN_PRIMARY",
    "openai_api_key":       "OPENAI_API_KEY",
    "fal_key":              "FAL_KEY",
    "heygen_api_key":       "HEYGEN_API_KEY",
    "outreach_admin_token": "OUTREACH_ADMIN_TOKEN",
    "outreach_worker_url":   "OUTREACH_WORKER_URL",
    "agent_secret":         "AGENT_SECRET",
    "polygon_rpc_url":      "POLYGON_RPC_URL",
    "deepseek_api_key":      "DEEPSEEK_API_KEY",
    "pi_api_key":            "PI_API_KEY",
    "cerebras_api_key":      "CEREBRAS_API_KEY",
}

_loaded = False


def _ensure_loaded() -> None:
    global _loaded
    if _loaded:
        return
    # Look for .env in AgentZ root (parent of agentz/ package)
    here = Path(__file__).resolve()
    # Support multiple project structures
    candidates = [
        here.parents[2] / ".env", 
        here.parents[1] / ".env",
        Path.cwd() / ".env"
    ]
    for candidate in candidates:
        if candidate.exists():
            load_dotenv(candidate)
            logger.info(f"Loaded credentials from {candidate}")
            break
    _loaded = True


def get(key: str, required: bool = True) -> Optional[str]:
    """Resolve a credential key from registry → env var."""
    _ensure_loaded()
    env_name = CRED_KEY_TO_ENV.get(key)
    if not env_name:
        # Registry miss: try the uppercased key as an env var before giving up.
        # Prevents the May 2026 polygon_grants crash where a new credential
        # was used in code before being registered in CRED_KEY_TO_ENV.
        fallback_env = key.upper()
        fallback_val = os.environ.get(fallback_env)
        if fallback_val:
            logger.warning(
                f"Credential '{key}' is not registered in CRED_KEY_TO_ENV; "
                f"using env var {fallback_env} as fallback. Please register it."
            )
            return fallback_val
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
    """Cred getter that returns a safe placeholder in dry-run mode."""
    from agentz.core.modes import Mode
    if ctx.mode == Mode.DRY_RUN:
        env_name = CRED_KEY_TO_ENV.get(key, key.upper())
        val = os.environ.get(env_name)
        return val if val else f"<{key}:placeholder>"
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


def verify_credential(key: str) -> tuple[bool, str]:
    """Perform a minimal smoke-test for the given credential key."""
    val = get(key, required=False)
    if not val:
        return False, "Not set in .env"

    verifiers = {
        "hubspot_token": _verify_hubspot,
        "vercel_session": _verify_vercel,
        "stripe_secret": _verify_stripe,
    }

    checker = verifiers.get(key)
    if not checker:
        return True, "Present (no health-check available)"

    try:
        return checker(val)
    except Exception as e:
        return False, f"Check failed: {e}"


def _verify_hubspot(token: str) -> tuple[bool, str]:
    r = httpx.get("https://api.hubapi.com/crm/v3/objects/contacts?limit=1",
                  headers={"Authorization": f"Bearer {token}"}, timeout=10.0)
    if r.status_code == 200:
        return True, "Valid (HubSpot API ok)"
    return False, f"Invalid (HTTP {r.status_code}: {r.text[:50]})"


def _verify_vercel(token: str) -> tuple[bool, str]:
    r = httpx.get("https://api.vercel.com/v2/user",
                  headers={"Authorization": f"Bearer {token}"}, timeout=10.0)
    if r.status_code == 200:
        return True, "Valid (Vercel API ok)"
    return False, f"Invalid (HTTP {r.status_code})"


def _verify_stripe(key: str) -> tuple[bool, str]:
    r = httpx.get("https://api.stripe.com/v1/accounts",
                  headers={"Authorization": f"Bearer {key}"}, timeout=10.0)
    if r.status_code == 200:
        return True, "Valid (Stripe API ok)"
    return False, f"Invalid (HTTP {r.status_code})"
