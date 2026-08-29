"""
agentz.core.outreach
--------------------
Core logic for managing, reviewing, and posting outreach DMs.
"""
from __future__ import annotations
import json
import logging
from pathlib import Path
from typing import List, Dict, Any

logger = logging.getLogger("agentz.outreach")

OUTREACH_DB_PATH = Path("agentz/logs/outreach/pending_dms.json")
PROMPT_TEMPLATE_PATH = Path("agentz/logs/outreach/prompt_template.txt")

def get_current_prompt() -> str:
    if not PROMPT_TEMPLATE_PATH.exists():
        return "Default outreach prompt..."
    return PROMPT_TEMPLATE_PATH.read_text(encoding="utf-8")

def persist_new_prompt(new_prompt: str):
    PROMPT_TEMPLATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROMPT_TEMPLATE_PATH.write_text(new_prompt, encoding="utf-8")

def tune_outreach_prompt(feedback: Dict[str, Any]):
    """Dynamically updates the outreach system prompt."""
    current_prompt = get_current_prompt()
    # Logic to inject feedback into prompt
    new_prompt = f"{current_prompt}\n\nOptimization Tip: {feedback['suggestion']}"
    persist_new_prompt(new_prompt)

def get_pending_dms() -> List[Dict[str, Any]]:
    """Loads the list of pending DMs from the local JSON store."""
    if not OUTREACH_DB_PATH.exists():
        return []
    try:
        return json.loads(OUTREACH_DB_PATH.read_text(encoding="utf-8"))
    except:
        return []

def save_pending_dms(dms: List[Dict[str, Any]]):
    """Saves the list of pending DMs."""
    OUTREACH_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTREACH_DB_PATH.write_text(json.dumps(dms, indent=2), encoding="utf-8")

import random

def add_pending_dm(lead_name: str, personalized_hook: str, generic_hook: str, message: str, microsite_url: str):
    """Adds a new DM to the pending queue, randomly assigning either a personalized or generic hook for A/B testing."""
    dms = get_pending_dms()
    # Avoid duplicates
    if any(d['lead_name'] == lead_name for d in dms):
        return
        
    # Randomly assign A or B
    variant = random.choice(['personalized', 'generic'])
    chosen_hook = personalized_hook if variant == 'personalized' else generic_hook
    
    dms.append({
        "lead_name": lead_name,
        "variant": variant,
        "chosen_hook": chosen_hook,
        "personalized_hook": personalized_hook,
        "generic_hook": generic_hook,
        "message": message,
        "microsite_url": microsite_url,
        "status": "pending"
    })
    save_pending_dms(dms)

from agentz.core.llm import get_llm

async def analyze_reply_sentiment(reply_text: str) -> str:
    """
    Analyzes the sentiment of a prospect's reply.
    """
    llm = get_llm(model="gpt-4o", temperature=0.0)
    prompt = f"""
    Analyze the sentiment of the following reply to a business DM:
    "{reply_text}"
    
    Return ONLY 'positive', 'neutral', or 'negative'.
    """
    response = await llm.ainvoke(prompt)
    return response.content.strip().lower()

async def trigger_nurture_sequence(lead_name: str):
    """
    Triggers a polite nurture sequence for negative/objection responses.
    """
    logger.info(f"Triggering nurture sequence for {lead_name}...")
    # Placeholder for the actual nurture DM dispatch logic
    pass

async def post_dm(lead_name: str, message: str) -> bool:
    """
    Uses browser-use to post a DM to the target's social profile.
    """
    from agentz.core.browser import run_browser_task
    from agentz.core.modes import ExecutionContext, Mode
    
    logger.info(f"Posting DM to {lead_name}...")
    
    # Task for the browser agent
    task = f"Go to X.com (Twitter), search for the official profile of '{lead_name}', and send this DM: {message}"
    
    # Create a transient context for the sub-task
    ctx = ExecutionContext(workflow_id="outreach_post", mode=Mode.AUTO)
    
    try:
        # Note: In a real run, this needs a valid twitter_session cookie injected via browser.py logic
        # For now, we utilize the run_browser_task wrapper which handles LLM-to-Browser mapping.
        res = await run_browser_task(task, ctx)
        return res is not None
    except Exception as e:
        logger.error(f"Failed to post DM for {lead_name}: {e}")
        return False
