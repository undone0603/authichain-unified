"""
agentz.core.intelligence
-----------------------
Loads "Win Signals" from the AuthiChain Training Bridge and provides
optimized context for workflow handlers.
"""
import json
import os
from pathlib import Path
from typing import Any, List

TRAINING_LOG = Path("/home/zac/agentz/agentz/logs/training_data.jsonl")
KNOWLEDGE_BASE = Path(__file__).parent.parent / "knowledge"

def get_knowledge(doc_name: str) -> str:
    """Retrieves a specific document from the AgentZ Knowledge Base."""
    doc_path = KNOWLEDGE_BASE / f"{doc_name}.md"
    if not doc_path.exists():
        # Try templates folder as fallback
        doc_path = KNOWLEDGE_BASE.parent / "templates" / f"{doc_name}.md"
        
    if not doc_path.exists():
        return ""
        
    with open(doc_path, "r") as f:
        return f.read()

def get_ecosystem_context() -> str:
    """Returns the core strategy and value props for LLM prompts."""
    return get_knowledge("ECOSYSTEM_STRATEGY")

def get_recent_success_signals(limit: int = 5) -> List[dict]:
    """Reads the last N success patterns from the training ledger."""
    if not TRAINING_LOG.exists():
        return []
        
    signals = []
    try:
        with open(TRAINING_LOG, "r") as f:
            lines = f.readlines()
            for line in lines[-limit:]:
                if line.strip():
                    signals.append(json.loads(line))
    except Exception as e:
        print(f"  [Intelligence] Warning: Could not read training ledger: {e}")
        
    return signals

def optimize_outreach_prompt(base_template: str, context: List[dict]) -> str:
    """
    Simulates LLM-based template optimization.
    In production, this would call ChatOllama to rewrite the template
    based on the 'context' (recent wins).
    """
    if not context:
        return base_template
        
    # Heuristic: If we have recent wins in 'GOV' segment, emphasize compliance.
    gov_wins = [s for s in context if s.get('context', {}).get('segment') == 'GOV']
    
    if len(gov_wins) > 0:
        return base_template.replace(
            "compliance middleware", 
            "proven federal compliance middleware (MUSA/EO-ready)"
        )
        
    return base_template
