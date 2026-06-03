"""
agentz.workflows.handlers.media_worker
--------------------------------------
Autonomous Viral Media Factory: Identifies high-value products and 
automatically renders StoryMode assets and AI avatar videos via HeyGen.
"""
import asyncio
import logging
import os
import sys
from pathlib import Path

# Fix module imports
project_root = str(Path(__file__).parent.parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from agentz.core.supabase import get_supabase
from agentz.core.media import generate_story_mode
from agentz.core.modes import ExecutionContext, Mode

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("media-worker")

async def process_media_queue():
    ctx = ExecutionContext(workflow_id="daily_media_factory_v1", mode=Mode.AUTO)
    logger.info("🎬 INITIALIZING VIRAL MEDIA FACTORY")
    
    sb = get_supabase()
    if not sb:
        logger.error("❌ Supabase connection failed.")
        return

    # 1. Identify Products needing Media Assets
    # Criteria: Score > 95, Media Status not 'completed' or 'processing'
    logger.info("📊 Step 1: Identifying high-value artifacts for StoryMode...")
    res = sb.table("products").select("*").filter("authenticity_score", "gte", 95).execute()
    candidates = res.data or []
    
    # Filter out those already processed
    queue = [p for p in candidates if p.get("metadata", {}).get("media_status") not in ["completed", "processing"]]
    
    if not queue:
        logger.info("✅ All high-value products have active StoryMode assets.")
        return

    logger.info(f"🔍 Found {len(queue)} products awaiting media generation.")

    # 2. Render StoryMode
    for p in queue:
        try:
            logger.info(f"\n--- 🎬 Rendering StoryMode for: {p['name']} ---")
            video_url = await generate_story_mode(sb, p["id"])
            logger.info(f"  ✅ Enqueued HeyGen Job. Initial URL: {video_url}")
            
            # Record action in automation logs
            sb.table("automation_logs").insert({
                "workflow_name": "media_factory_enqueue",
                "status": "success",
                "payload": {"product_id": p["id"], "provider": "heygen", "status": "queued"}
            }).execute()

        except Exception as e:
            logger.error(f"  ❌ Media rendering failed for {p['id']}: {e}")

    logger.info("\n🏁 MEDIA FACTORY CYCLE COMPLETE.")

if __name__ == "__main__":
    asyncio.run(process_media_queue())
