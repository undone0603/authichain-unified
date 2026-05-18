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
from dotenv import load_dotenv, set_key

logger = logging.getLogger("agentz.credentials")

# Map registry credential keys -> env var names.
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
    "sam_auth":             "SAM_AUTH_COOKIE",
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
    "polygon_private_key":  "POLYGON_PRIVATE_KEY",
    "deepseek_api_key":      "DEEPSEEK_API_KEY",
    "pi_api_key":            "PI_API_KEY",
    "cerebras_api_key":      "CEREBRAS_API_KEY",
    # ── Ollama ──
    "ollama_api_key":        "OLLAMA_API_KEY",
    "ollama_host":           "OLLAMA_HOST",
    "ollama_model":          "OLLAMA_MODEL",
    # ── HF secondary ──
    "hf_token_secondary":    "HF_TOKEN_SECONDARY",
    "hf_endpoint":           "HF_ENDPOINT",
    # ── Telegram ──
    "telegram_authichain_token": "TELEGRAM_AUTHICHAINBOT_TOKEN",
    "telegram_qron_token":   "TELEGRAM_QRONTOKEN_BOT_TOKEN",
    # ── Slack ──
    "slack_app_id":          "SLACK_APP_ID",
    "slack_client_id":       "SLACK_CLIENT_ID",
    "slack_client_secret":   "SLACK_CLIENT_SECRET",
    "slack_signing_secret":  "SLACK_SIGNING_SECRET",
    # ── Notion ──
    "notion_vault_page_id":  "NOTION_VAULT_PAGE_ID",
    "notion_launch_page_id": "NOTION_LAUNCH_PAGE_ID",
    "notion_codex_page_id":  "NOTION_CODEX_PAGE_ID",
    # ── DocuSign ──
    "docusign_account_id":   "DOCUSIGN_ACCOUNT_ID",
    "docusign_host":         "DOCUSIGN_HOST",
    # ── Gmail SMTP ──
    "gmail_user":            "GMAIL_USER",
    "gmail_app_password":    "GMAIL_APP_PASSWORD",
    # ── Stripe extended ──
    "stripe_account_id":     "STRIPE_ACCOUNT_ID",
    "stripe_webhook_secret_qron_app": "STRIPE_WEBHOOK_SECRET_QRON_APP",
    "stripe_webhook_qron_space_id":   "STRIPE_WEBHOOK_QRON_SPACE_ID",
    "stripe_webhook_qron_space_secret": "STRIPE_WEBHOOK_QRON_SPACE_SECRET",
    "stripe_webhook_qron_space_url":  "STRIPE_WEBHOOK_QRON_SPACE_URL",
    "stripe_webhook_authichain_id":   "STRIPE_WEBHOOK_AUTHICHAIN_ID",
    "stripe_webhook_authichain_secret": "STRIPE_WEBHOOK_AUTHICHAIN_SECRET",
    "stripe_publishable_key": "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    # ── Supabase extended ──
    "supabase_db_password":  "SUPABASE_DB_PASSWORD",
    "supabase_stripe_webhook": "SUPABASE_STRIPE_WEBHOOK",
    # ── Cloudflare extended ──
    "cloudflare_d1_database_id":     "CLOUDFLARE_D1_DATABASE_ID",
    "cloudflare_kv_dedup_namespace": "CLOUDFLARE_KV_DEDUP_NAMESPACE",
    # ── Vercel projects ──
    "vercel_project_qron_app":    "VERCEL_PROJECT_QRON_APP",
    "vercel_project_authi_chain": "VERCEL_PROJECT_AUTHI_CHAIN",
    "vercel_project_unified":     "VERCEL_PROJECT_UNIFIED",
    # ── Blockchain extended ──
    "polygon_qron_token":         "POLYGON_QRON_TOKEN",
    "polygon_authichain_nft":     "POLYGON_AUTHICHAIN_NFT",
    "btc_taproot_ordinals":       "BTC_TAPROOT_ORDINALS",
    "etherscan_qron_api_key":     "ETHERSCAN_QRON_API_KEY",
    "etherscan_authichain_api_key": "ETHERSCAN_AUTHICHAIN_API_KEY",
    "etherscan_strainchain_api_key": "ETHERSCAN_STRAINCHAIN_API_KEY",
    # ── HubSpot extended ──
    "hubspot_portal_id":              "HUBSPOT_PORTAL_ID",
    "hubspot_personal_access_token":  "HUBSPOT_PERSONAL_ACCESS_TOKEN",
    # ── Resend extended ──
    "resend_domain_id_qron":    "RESEND_DOMAIN_ID_QRON",
    # ── Pinecone extended ──
    "pinecone_index":           "PINECONE_INDEX",
    "pinecone_host":            "PINECONE_HOST",
    # ── Anthropic / OpenRouter ──
    "anthropic_api_key":        "ANTHROPIC_API_KEY",
    "openrouter_api_key":       "OPENROUTER_API_KEY",
    # ── Airtable ──
    "airtable_api_key":         "AIRTABLE_API_KEY",
    "airtable_base_id":         "AIRTABLE_BASE_ID",
    # ── Apollo ──
    "apollo_api_key":           "APOLLO_API_KEY",
    # ── Video / Media ──
    "runway_api_key":           "RUNWAY_API_KEY",
    # ── Email ──
    "sendgrid_api_key":         "SENDGRID_API_KEY",
    # ── Analytics ──
    "posthog_api_key":          "POSTHOG_API_KEY",
    "posthog_host":             "POSTHOG_HOST",
    "ga4_measurement_id":       "GA4_MEASUREMENT_ID",
    # ── Auth / Web3 ──
    "jwt_secret":               "JWT_SECRET",
    "thirdweb_secret_key":      "THIRDWEB_SECRET_KEY",
    "thirdweb_client_id":       "THIRDWEB_CLIENT_ID",
    # ── Twilio ──
    "twilio_api_key":           "TWILIO_API_KEY",
    "twilio_sid":               "TWILIO_SID",
    # ── Make ──
    "make_webhook_url":         "MAKE_WEBHOOK_URL",
}

_loaded = False
_env_path: Optional[Path] = None


def _ensure_loaded() -> None:
    global _loaded, _env_path
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
            _env_path = candidate
            logger.info(f"Loaded credentials from {candidate}")
            break
    _loaded = True


def get(key: str, required: bool = True) -> Optional[str]:
    """Resolve a credential key from registry -> env var."""
    _ensure_loaded()
    env_name = CRED_KEY_TO_ENV.get(key)
    if not env_name:
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


def update_credential(key: str, value: str) -> bool:
    """Updates a credential in the environment and persists it to .env."""
    _ensure_loaded()
    env_name = CRED_KEY_TO_ENV.get(key, key.upper())
    
    # 1. Update In-Memory
    os.environ[env_name] = value
    
    # 2. Persist to .env
    if _env_path:
        try:
            set_key(str(_env_path), env_name, value)
            logger.info(f"Persisted updated credential '{key}' to {_env_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to persist credential '{key}' to .env: {e}")
            return False
    else:
        logger.warning(f"No .env path found to persist credential '{key}'.")
        return False


def get_or_placeholder(key: str, ctx) -> str:
    """Cred getter that returns a safe placeholder in dry-run mode."""
    from agentz.core.modes import Mode
    if ctx.mode == Mode.DRY_RUN:
        env_name = CRED_KEY_TO_ENV.get(key, key.upper())
        val = os.environ.get(env_name)
        return val if val else f"<{key}:placeholder>"
    return get(key, required=True)


_PLACEHOLDER_VALUES = frozenset({
    "TODO_PASTE",
    "TODO_PASTE_OR_GENERATE",
    "TODO_PASTE_DEEPSEEK_KEY",
    "TODO_PASTE_PI_KEY",
    "INVALID_REPLACE_WITH_AIza_KEY_FROM_AISTUDIO",
    "'new_healed_token'",
    "new_healed_token",
})

_VERIFIABLE_KEYS = {"hubspot_token", "vercel_session", "stripe_secret"}


def audit_all() -> dict:
    """Check presence and API validity of all registered credentials.

    Returns a dict with keys: present, missing, verified, failed, skipped.
    """
    _ensure_loaded()
    report: dict[str, list] = {
        "present": [],
        "missing": [],
        "verified": [],
        "failed": [],
        "skipped": [],
    }
    for key, env_name in CRED_KEY_TO_ENV.items():
        val = os.environ.get(env_name)
        if not val or val in _PLACEHOLDER_VALUES:
            report["missing"].append({
                "key": key,
                "env": env_name,
                "reason": "placeholder" if val else "not set",
            })
            continue
        report["present"].append(key)
        if key in _VERIFIABLE_KEYS:
            ok, msg = verify_credential(key)
            target = report["verified"] if ok else report["failed"]
            target.append({"key": key, "env": env_name, "msg": msg})
        else:
            report["skipped"].append(key)
    return report


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
