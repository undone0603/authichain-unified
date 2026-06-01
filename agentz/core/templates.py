"""
agentz.core.templates
---------------------
Template Manager: Loads customized templates from local storage or cloud
to replace live LLM calls. Provides consistency and quota protection.
"""
from __future__ import annotations
import logging
import os
import json
import httpx
from pathlib import Path
from typing import Dict, Any, Optional
from agentz.core.credentials import get

logger = logging.getLogger("agentz.templates")

TEMPLATE_ROOT = Path("templates")

def get_template(category: str, name: str) -> Optional[str]:
    """
    Retrieves a template by category and name.
    Example: get_template("social", "twitter_default")
    """
    # 1. Local File Check
    local_path = TEMPLATE_ROOT / category / f"{name}.md"
    if not local_path.exists():
        local_path = TEMPLATE_ROOT / category / f"{name}.txt"
        
    if local_path.exists():
        try:
            return local_path.read_text(encoding="utf-8")
        except Exception as e:
            logger.error(f"Failed to read template {local_path}: {e}")
            
    # 2. Hardcoded Fallbacks
    return _get_hardcoded_fallback(category, name)

def fill_template(template: str, context: Dict[str, Any]) -> str:
    """
    Replaces {{key}} placeholders in the template with context values.
    Supports simple conditional logic: {{IF key}}...{{ENDIF}}
    """
    import re
    result = template
    
    # 1. Handle Conditionals: {{IF key}}...{{ENDIF}}
    def handle_if(match):
        key = match.group(1).strip()
        body = match.group(2)
        if context.get(key) or (key in context and context[key] is not False):
            return body
        return ""
    
    result = re.sub(r"\{\{IF ([^}]*)\}\}((?:(?!\{\{ENDIF\}\}).)*)\{\{ENDIF\}\}", handle_if, result, flags=re.DOTALL)

    # 2. Standard Placeholders
    for key, value in context.items():
        placeholder = "{{" + str(key) + "}}"
        result = result.replace(placeholder, str(value))
    
    # Clean up remaining placeholders
    result = re.sub(r"\{\{.*?\}\}", "", result)
    return result.strip()

async def sync_with_cloud(bucket_name: str = "authichain-templates"):
    """
    Synchronizes the local template root with Cloudflare R2.
    """
    account_id = get("cloudflare_account_id")
    token = get("cloudflare_api_token")
    
    if not account_id or not token:
        logger.warning("Missing Cloudflare credentials. Skipping template cloud sync.")
        return False

    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/r2/buckets/{bucket_name}/objects"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(url, headers=headers)
            if r.status_code != 200:
                logger.error(f"Failed to list R2 templates: {r.text}")
                return False
                
            objects = r.json().get("result", {}).get("objects", [])
            for obj in objects:
                key = obj["key"]
                # Only sync .md or .json or .txt
                if not key.endswith((".md", ".json", ".txt")):
                    continue
                    
                # Download and save locally
                dl_url = f"{url}/{key}"
                dl_res = await client.get(dl_url, headers=headers)
                if dl_res.status_code == 200:
                    local_path = TEMPLATE_ROOT / key
                    local_path.parent.mkdir(parents=True, exist_ok=True)
                    local_path.write_text(dl_res.text, encoding="utf-8")
                    logger.info(f"Cloud Synced: {key}")
                    
        return True
    except Exception as e:
        logger.error(f"Template sync failed: {e}")
        return False

def _get_hardcoded_fallback(category: str, name: str) -> Optional[str]:
    """Provides base templates if files are missing."""
    fallbacks = {
        "social": {
            "twitter_default": "Excited to announce our latest blockchain trust anchor for {{brand}}! 🛡️\n\nProvenance verified. Authenticity secured.\n\n#AuthiChain #Web3 #TrustEconomy #DigitalTwin",
            "linkedin_default": "We are proud to partner with {{brand}} to bring autonomous trust to their supply chain.\n\nBy leveraging blockchain-anchored digital twins, we are reducing risk and protecting brand integrity at scale.\n\n#AuthiChain #SupplyChain #Innovation",
        },
        "marketing": {
            "blog_default": "# {{name}} by {{brand}}\n\nVerified by AuthiChain.\n\nThis product is anchored to the Polygon blockchain for immutable provenance. Consumers can scan the QRON code to view the full lifecycle of this item.\n\nOrigin: {{origin}}",
        },
        "media": {
            "story_mode_default": "You are looking at {{name}} from {{brand}}. This item has been verified by the AuthiChain Sovereign OS and is anchored to the global trust ledger. Authenticity: 100%.",
        }
    }
    return fallbacks.get(category, {}).get(name)
