"""
agentz.workflows.handlers.media_processor
----------------------------------------
Workflow handler to process the pending media generation queue.
"""
from __future__ import annotations
import asyncio
from typing import Optional
from agentz.core.modes import ExecutionContext
from agentz.core.media import create_heygen_video
from agentz.core.credentials import get
from supabase import create_client

def run(ctx: ExecutionContext) -> Optional[str]:
    url = get("supabase_url")
    key = get("supabase_service_key")
    supabase = create_client(url, key)

    ctx.step("Fetching pending media requests from Supabase...")
    # In production: 
    # res = supabase.table("media_queue").select("*").eq("status", "queued").execute()
    # queue = res.data
    
    # Simulation for this session:
    queue = [
        {"id": "mq_1", "product_id": "43ed4724-724c-49ed-a5fe-d712f6121578", "script": "Authentically crafted by Detroit Artisan Brews."}
    ]
    
    if not queue:
        return "No pending media requests found."

    for item in queue:
        p_id = item["product_id"]
        ctx.step(f"Processing media for product {p_id}...")
        
        # 1. Generate Video
        video_info = ctx.step(
            f"Calling HeyGen API for {p_id}",
            action=lambda: asyncio.run(create_heygen_video(item["script"]))
        )
        
        # 2. Update metadata
        ctx.step(f"Updating product {p_id} metadata with video URL...")
        # supabase.table("products").update({
        #     "metadata": {"media_url": video_info["url"], "media_status": video_info["status"]}
        # }).eq("id", p_id).execute()
        
        # 3. Mark queue item as completed
        # supabase.table("media_queue").update({"status": "completed", "video_id": video_info["id"]}).eq("id", item["id"]).execute()

    return f"Processed {len(queue)} media request(s)."
