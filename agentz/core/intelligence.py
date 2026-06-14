\"\"\"
agentz.core.intelligence
-----------------------
Loads "Win Signals" from the AuthiChain Training Bridge and provides
optimized context for workflow handlers using LLMs.
Supports persistent storage in Supabase if available.
\"\"\"
import json
import os
import logging
from pathlib import Path
from typing import Any, List, Optional

from agentz.core.credentials import get

logger = logging.getLogger("agentz.intelligence")
TRAINING_LOG = Path(__file__).resolve().parents[1] / "logs" / "training_data.jsonl"

def get_recent_success_signals(limit: int = 5) -> List[dict]:
    \"\"\"Reads the last N success patterns from the training ledger (JSONL fallback).\"\"\"
    if not TRAINING_LOG.exists():
        return []
        
    signals = []
    try:
        with open(TRAINING_LOG, "r") as f:
            lines = f.readlines()
            for line in lines[-limit:]:
                line = line.strip()
                if not line:
                    continue
                try:
                    signals.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    except Exception as e:
        logger.warning(f"Could not read training ledger: {e}")
        
    return signals

def optimize_outreach_prompt(base_template: str, context: List[dict]) -> str:
    \"\"\"
    Uses an LLM to rewrite the outreach template based on the 'context' (recent wins).
    Preferably uses Groq for speed, falls back to Ollama.
    \"\"\"
    if not context:
        return base_template

    context_str = json.dumps(context, indent=2)
    
    prompt = f\"\"\"
    You are an expert sales copywriter. You are optimizing a LinkedIn outreach template
    based on recent "Win Signals" from the platform.
    
    RECENT WINS CONTEXT:
    {context_str}
    
    ORIGINAL TEMPLATE:
    {base_template}
    
    TASK:
    Rewrite the template to emphasize the hooks and value props that led to the recent wins.
    Return ONLY the rewritten template text.
    \"\"\"

    try:
        from langchain_groq import ChatGroq
        api_key = get("groq_api_key", required=False)
        if api_key:
            llm = ChatGroq(model="llama-3.3-70b-versatile", api_key=api_key)
            response = llm.invoke(prompt)
            return response.content.strip()
    except (ImportError, Exception):
        try:
            from langchain_ollama import ChatOllama
            llm = ChatOllama(model="llama3.2", temperature=0.1)
            response = llm.invoke(prompt)
            return response.content.strip()
        except Exception as e:
            logger.warning(f"LLM optimization failed: {e}. Using base template.")
            return base_template
    
    return base_template

def record_win_signal_to_db(supabase: Any, signal: dict):
    \"\"\"Saves a win signal to Supabase for global intelligence.\"\"\"
    try:
        supabase.table("training_signals").insert({
            "workflow_id": signal.get("workflow_id"),
            "duration_s": signal.get("duration_s"),
            "notes": signal.get("notes"),
            "metadata": signal
        }).execute()
    except Exception as e:
        logger.error(f"Failed to save signal to Supabase: {e}")
