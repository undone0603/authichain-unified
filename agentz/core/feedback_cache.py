"""
agentz.core.feedback_cache
-------------------------
Cache for storing high-performance outreach hooks.
"""
from pathlib import Path
import json
from typing import List, Dict

CACHE_PATH = Path("agentz/logs/outreach/high_performance_hooks.json")

def add_high_performance_hook(vertical: str, hook: str):
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    data = {}
    if CACHE_PATH.exists():
        try:
            data = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        except:
            data = {}
            
    if vertical not in data:
        data[vertical] = []
        
    if hook not in data[vertical]:
        data[vertical].append(hook)
        CACHE_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")

def get_high_performance_hooks(vertical: str) -> List[str]:
    if not CACHE_PATH.exists():
        return []
    try:
        data = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        return data.get(vertical, [])
    except:
        return []
