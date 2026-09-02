"""
agentz.core.outreach
--------------------
Core logic for managing, reviewing, and posting outreach DMs.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import random
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List

logger = logging.getLogger("agentz.outreach")

OUTREACH_DB_PATH = Path("agentz/logs/outreach/pending_dms.json")
PROMPT_TEMPLATE_PATH = Path("agentz/logs/outreach/prompt_template.txt")
_LOCK_PATH = OUTREACH_DB_PATH.with_suffix(".json.lock")


def get_current_prompt() -> str:
    if not PROMPT_TEMPLATE_PATH.exists():
        return "Default outreach prompt..."
    return PROMPT_TEMPLATE_PATH.read_text(encoding="utf-8")


def persist_new_prompt(new_prompt: str) -> None:
    PROMPT_TEMPLATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROMPT_TEMPLATE_PATH.write_text(new_prompt, encoding="utf-8")


def tune_outreach_prompt(feedback: Dict[str, Any]) -> None:
    """Dynamically updates the outreach system prompt."""
    current_prompt = get_current_prompt()
    new_prompt = f"{current_prompt}\n\nOptimization Tip: {feedback['suggestion']}"
    persist_new_prompt(new_prompt)


def _acquire_lock(timeout_s: float = 5.0) -> int:
    """Exclusive file lock via O_EXCL lockfile. Returns fd; caller must close/unlink."""
    _LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    deadline = time.time() + timeout_s
    while True:
        try:
            fd = os.open(str(_LOCK_PATH), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o644)
            os.write(fd, str(os.getpid()).encode())
            return fd
        except FileExistsError:
            if time.time() >= deadline:
                # Stale lock recovery: if lock older than 60s, remove and retry once
                try:
                    age = time.time() - _LOCK_PATH.stat().st_mtime
                    if age > 60:
                        _LOCK_PATH.unlink(missing_ok=True)
                        continue
                except OSError:
                    pass
                raise TimeoutError(f"Could not acquire outreach lock at {_LOCK_PATH}")
            time.sleep(0.05)


def _release_lock(fd: int) -> None:
    try:
        os.close(fd)
    finally:
        try:
            _LOCK_PATH.unlink(missing_ok=True)
        except OSError:
            pass


def get_pending_dms() -> List[Dict[str, Any]]:
    """Loads the list of pending DMs from the local JSON store."""
    if not OUTREACH_DB_PATH.exists():
        return []
    try:
        data = json.loads(OUTREACH_DB_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError) as e:
        logger.error("Failed to read pending DMs from %s: %s", OUTREACH_DB_PATH, e)
        return []


def save_pending_dms(dms: List[Dict[str, Any]]) -> None:
    """Atomically saves the list of pending DMs (temp file + replace)."""
    OUTREACH_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(dms, indent=2)
    fd, tmp_name = tempfile.mkstemp(
        dir=str(OUTREACH_DB_PATH.parent),
        prefix=".pending_dms.",
        suffix=".tmp",
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(payload)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_name, OUTREACH_DB_PATH)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


def _payload_fingerprint(
    lead_name: str,
    message: str,
    microsite_url: str,
    personalized_hook: str,
    generic_hook: str,
) -> str:
    raw = "|".join(
        [
            lead_name.strip().lower(),
            (message or "").strip(),
            (microsite_url or "").strip(),
            (personalized_hook or "").strip(),
            (generic_hook or "").strip(),
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def add_pending_dm(
    lead_name: str,
    personalized_hook: str = "",
    generic_hook: str = "",
    message: str = "",
    microsite_url: str = "",
) -> Dict[str, Any]:
    """
    Queue a pending outreach DM.

    Idempotency: same lead_name with status=pending is ignored (no duplicate).
    Same full payload fingerprint also ignored even if status changed recently.

    Returns a status dict: {ok, action, lead_name, reason?}.
    """
    # Compat: historical 3-arg form was (lead_name, message, microsite_url).
    # If personalized_hook looks like a full message and message is empty, remap.
    if message == "" and microsite_url == "" and personalized_hook and generic_hook:
        # Could be (name, message, url) mapped into first three positionals
        if generic_hook.startswith("http://") or generic_hook.startswith("https://"):
            message = personalized_hook
            microsite_url = generic_hook
            personalized_hook = ""
            generic_hook = ""

    lead_name = (lead_name or "").strip()
    if not lead_name:
        logger.warning("add_pending_dm rejected: empty lead_name")
        return {"ok": False, "action": "rejected", "lead_name": "", "reason": "empty_lead_name"}

    message = message or ""
    microsite_url = microsite_url or ""
    personalized_hook = personalized_hook or ""
    generic_hook = generic_hook or ""

    if not message and not personalized_hook and not generic_hook:
        logger.warning("add_pending_dm rejected for %s: empty message/hooks", lead_name)
        return {
            "ok": False,
            "action": "rejected",
            "lead_name": lead_name,
            "reason": "empty_payload",
        }

    fingerprint = _payload_fingerprint(
        lead_name, message, microsite_url, personalized_hook, generic_hook
    )

    lock_fd = _acquire_lock()
    try:
        dms = get_pending_dms()

        for d in dms:
            if d.get("lead_name") == lead_name and d.get("status") == "pending":
                logger.info("add_pending_dm idempotent skip (pending exists): %s", lead_name)
                return {
                    "ok": True,
                    "action": "ignored_duplicate",
                    "lead_name": lead_name,
                    "reason": "pending_exists",
                }
            if d.get("fingerprint") == fingerprint:
                logger.info("add_pending_dm idempotent skip (fingerprint): %s", lead_name)
                return {
                    "ok": True,
                    "action": "ignored_duplicate",
                    "lead_name": lead_name,
                    "reason": "fingerprint_match",
                }

        variant = random.choice(["personalized", "generic"])
        if personalized_hook and generic_hook:
            chosen_hook = personalized_hook if variant == "personalized" else generic_hook
        else:
            variant = "message"
            chosen_hook = personalized_hook or generic_hook or message

        record = {
            "lead_name": lead_name,
            "variant": variant,
            "chosen_hook": chosen_hook,
            "personalized_hook": personalized_hook,
            "generic_hook": generic_hook,
            "message": message,
            "microsite_url": microsite_url,
            "status": "pending",
            "fingerprint": fingerprint,
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        dms.append(record)
        save_pending_dms(dms)
        logger.info("add_pending_dm created pending DM for %s (%s)", lead_name, fingerprint)
        return {"ok": True, "action": "created", "lead_name": lead_name, "fingerprint": fingerprint}
    except Exception as e:
        logger.exception("add_pending_dm failed for %s: %s", lead_name, e)
        return {"ok": False, "action": "error", "lead_name": lead_name, "reason": str(e)}
    finally:
        _release_lock(lock_fd)


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


async def trigger_nurture_sequence(lead_name: str) -> None:
    """
    Triggers a polite nurture sequence for negative/objection responses.
    """
    logger.info("Triggering nurture sequence for %s...", lead_name)


async def post_dm(lead_name: str, message: str) -> bool:
    """
    Uses browser-use to post a DM to the target's social profile.
    """
    from agentz.core.browser import run_browser_task
    from agentz.core.modes import ExecutionContext, Mode

    logger.info("Posting DM to %s...", lead_name)

    task = (
        f"Go to X.com (Twitter), search for the official profile of '{lead_name}', "
        f"and send this DM: {message}"
    )

    ctx = ExecutionContext(workflow_id="outreach_post", mode=Mode.AUTO)

    try:
        res = await run_browser_task(task, ctx)
        return res is not None
    except Exception as e:
        logger.error("Failed to post DM for %s: %s", lead_name, e)
        return False
