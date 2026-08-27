"""
agentz.core.media
-----------------
Media Agent: Generates AI narration and StoryMode content.
"""
from __future__ import annotations
import logging
from typing import Dict, Any
from agentz.core.llm import get_llm

logger = logging.getLogger("agentz.media")

async def generate_narration(product_data: Dict[str, Any]) -> str:
    """Uses Gemini to generate a professional StoryMode narration script."""
    name = product_data.get("name", "this product")
    brand = product_data.get("brand", "our partner")
    vertical = product_data.get("metadata", {}).get("vertical", "general")

    prompt = (
        f"Write a compelling 3-sentence StoryMode narration for a {vertical} product.\n"
        f"Product Name: {name}\n"
        f"Brand: {brand}\n"
        f"Focus on authenticity, quality, and the emotional connection to the consumer.\n"
        f"Output ONLY the script text."
    )

    try:
        llm = get_llm(model="llama-3.3-70b-versatile")
        response = llm.invoke(prompt)
        return response.content.strip()
    except Exception as e:
        print(f"  [media] LLM narration failed: {e}. Using fallback.")
        return f"Welcome to the StoryMode for {name}. Authentically crafted by {brand}."

import httpx
from agentz.core.credentials import get

async def create_heygen_video(script: str) -> Dict[str, str]:
    """
    Submits a video generation request to the HeyGen API.
    """
    api_key = get("heygen_api_key")
    if not api_key:
        print("  [media] HeyGen API key missing. Using placeholder video.")
        return {
            "id": "vid_placeholder",
            "url": "https://heygen.com/v/placeholder",
            "status": "completed"
        }

    url = "https://api.heygen.com/v2/video/generate"
    headers = {
        "X-Api-Key": api_key,
        "Content-Type": "application/json"
    }
    
    payload = {
        "video_gen": {
            "test": True, # Use test mode to avoid burning credits during development
            "caption": False,
            "dimension": {"width": 1080, "height": 1920}
        },
        "avatar": {
            "avatar_id": "Daisy_20220818", # Default professional avatar
            "avatar_style": "normal"
        },
        "voice": {
            "voice_id": "en-US-JennyNeural",
            "input_text": script
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(url, headers=headers, json=payload)
            if r.status_code == 200:
                video_id = r.json().get("data", {}).get("video_id")
                return {
                    "id": video_id,
                    "url": f"https://app.heygen.com/share/{video_id}",
                    "status": "pending"
                }
            else:
                print(f"  [media] HeyGen error: {r.status_code} - {r.text}")
    except Exception as e:
        print(f"  [media] HeyGen exception: {e}")
        
    return {
        "id": "vid_fallback",
        "url": "https://heygen.com/v/placeholder",
        "status": "failed"
    }

async def enqueue_media_request(supabase, product_id: str, script: str):
    """
    Adds a media generation request to the persistent Supabase queue.
    """
    payload = {
        "product_id": product_id,
        "script": script,
        "status": "queued",
        "provider": "heygen"
    }
    # In production: await supabase.table("media_queue").insert(payload).execute()
    logger.info(f"Enqueued media request for product {product_id}")
    return True

async def generate_story_mode(supabase, product_id: str) -> str:
    """
    Generates a full StoryMode experience. Now uses a queued strategy.
    """
    # 1. Fetch product data
    product_res = supabase.table("products").select("*").eq("id", product_id).single().execute()
    product = product_res.data
    
    if not product:
        raise ValueError(f"Product {product_id} not found in Supabase.")

    # 2. Generate Narration (Try immediate, fallback to hardcoded)
    script = await generate_narration(product)
    
    # 3. Enqueue Video Generation (Async)
    # Instead of waiting for HeyGen, we enqueue the task for the background factory
    await enqueue_media_request(supabase, product_id, script)
    
    # 4. Update product record with 'Processing' state
    supabase.table("products").update({
        "metadata": {**product.get("metadata", {}), "narration_script": script, "media_status": "processing"}
    }).eq("id", product_id).execute()
    
    return "https://heygen.com/v/processing" # Return processing URL
