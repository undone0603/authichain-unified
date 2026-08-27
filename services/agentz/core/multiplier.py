"""
agentz.core.multiplier
----------------------
Content Multiplication Agent: Programmatically transforms 1 verified product
into N marketing assets (Blog, Twitter Thread, LinkedIn, etc.)
"""
from __future__ import annotations
import json
import logging
from typing import Dict, Any, List
from agentz.core.llm import get_llm

logger = logging.getLogger("agentz.multiplier")

async def multiply_content(product_data: Dict[str, Any]) -> Dict[str, str]:
    """
    Generates a suite of marketing assets from product data.
    """
    brand = product_data.get("brand", "Strategic Partner")
    name = product_data.get("name", "Verified Product")
    
    prompt = f"""
    You are the AgentZ Content Multiplier. 
    Transform this verified product into 3 high-impact marketing assets:
    1. A SEO-optimized Blog Post (Markdown).
    2. A 5-post X (Twitter) Thread (JSON list).
    3. A professional LinkedIn Post (Markdown).

    PRODUCT DATA:
    Brand: {brand}
    Name: {name}
    Metadata: {json.dumps(product_data.get('metadata', {}))}

    Return ONLY a JSON object with keys: 'blog', 'twitter_thread', 'linkedin'.
    """
    
    llm = get_llm()
    try:
        res = await llm.ainvoke(prompt)
        content = res.content.strip()
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        
        assets = json.loads(content)
        logger.info(f"Multiplied content for {brand}: {name}")
        return assets
    except Exception as e:
        logger.error(f"Content multiplication failed: {e}")
        return {
            "blog": f"# {name} by {brand}\nVerified by AuthiChain.",
            "twitter_thread": [f"Excited to launch {name} with {brand}! #AuthiChain"],
            "linkedin": f"Proud to announce our partnership with {brand} for {name}."
        }

async def archive_multiplied_assets(brand: str, name: str, assets: Dict[str, Any]):
    """
    Saves generated assets to the local log directory.
    """
    from pathlib import Path
    import datetime
    
    slug = "".join(c if c.isalnum() else "-" for c in brand.lower()).strip("-")
    dir_path = Path("agentz/logs/marketing") / slug
    dir_path.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M")
    
    # Save Blog
    (dir_path / f"blog_{timestamp}.md").write_text(assets.get("blog", ""), encoding="utf-8")
    # Save Twitter
    (dir_path / f"twitter_{timestamp}.json").write_text(json.dumps(assets.get("twitter_thread", []), indent=2), encoding="utf-8")
    # Save LinkedIn
    (dir_path / f"linkedin_{timestamp}.md").write_text(assets.get("linkedin", ""), encoding="utf-8")
    
    return str(dir_path)
