"""
agentz.core.scout
-----------------
Scout Agent: Identifies pilot businesses and ranks opportunities.
Uses browser-use for real-world business discovery.
"""
from __future__ import annotations
import json
from typing import List, Dict, Any, Optional
from agentz.core.llm import get_llm
from agentz.core.modes import ExecutionContext, Mode

def calculate_pilot_fit(business: Dict[str, Any]) -> float:
    """Computes a score from 0-100 based on business metadata."""
    score = 50.0 # Base score
    
    # Verticals that are high-value for AuthiChain
    high_value_verticals = ["brewery", "dispensary", "cannabis", "museum", "tourism", "luxury", "boutique", "artisanal"]
    category = business.get("category", "").lower()
    if any(v in category for v in high_value_verticals):
        score += 30
        
    # Geographic priority (optional, can be passed in)
    # Metadata presence
    if business.get("website") and business.get("website") != "N/A":
        score += 10
    if business.get("rating") and float(business.get("rating", 0)) > 4.0:
        score += 10
        
    return min(score, 100.0)

async def scout_businesses(city: str, ctx: Optional[ExecutionContext] = None) -> List[Dict[str, Any]]:
    """
    Uses browser-use to find real-world business candidates in a given city.
    """
    if ctx and ctx.mode == Mode.DRY_RUN:
        return [
            {"name": f"{city} Artisan Brews", "category": "brewery", "city": city, "rating": 4.8, "website": "https://example.com"},
            {"name": f"Green Leaf {city}", "category": "dispensary", "city": city, "rating": 4.5},
        ]

    from browser_use import Agent, Controller
    from agentz.core.browser import attach_interceptor, run_with_healing
    
    controller = Controller()
    if ctx:
        attach_interceptor(controller, ctx)
        
    task = (
        f"Search for top-rated artisanal businesses, breweries, and dispensaries in {city}, Michigan. "
        "Extract a list of 5 businesses including their name, category (vertical), city, rating, and website. "
        "Return the data as a clean JSON list of objects."
    )
    
    llm = get_llm(model="gpt-4o") # Browser-use often works best with gpt-4o
    agent = Agent(task=task, llm=llm, controller=controller)
    
    # In a real execution, we'd run the agent. For this turn, I'll keep the logic
    # but since I don't want to burn too many tokens/time in a single tool call,
    # I'll implement it so it's callable.
    
    if not ctx:
        # Fallback for simple calls
        history = await agent.run()
    else:
        history = await run_with_healing(agent, ctx)
        
    # Extract JSON from history
    last_content = history.final_result()
    try:
        # Simple cleanup if the LLM wrapped it in code blocks
        if "```json" in last_content:
            last_content = last_content.split("```json")[1].split("```")[0].strip()
        elif "```" in last_content:
            last_content = last_content.split("```")[1].split("```")[0].strip()
            
        results = json.loads(last_content)
        
        # Rank them
        for b in results:
            b["score"] = calculate_pilot_fit(b)
            
        return sorted(results, key=lambda x: x.get("score", 0), reverse=True)
    except Exception as e:
        if ctx:
            ctx.step(f"Scout: Failed to parse results: {e}. Raw content: {last_content[:100]}...")
        return []
