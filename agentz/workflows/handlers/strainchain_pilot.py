"""
agentz.workflows.handlers.strainchain_pilot
------------------------------------------
Executes a StrainChain authenticated cannabis pilot.
"""
from __future__ import annotations
import asyncio
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.credentials import get_or_placeholder
from agentz.core.strain import register_strain_identity, get_mock_lab_results
from agentz.core.media import generate_story_mode
from agentz.core.pages import generate_living_page_config, publish_living_page
from agentz.core.growth import reward_repeat_scans
from supabase import create_client, Client

def run(ctx: ExecutionContext) -> str:
    # 1. Setup credentials
    supabase_url = get_or_placeholder("supabase_url", ctx)
    supabase_key = get_or_placeholder("supabase_service_key", ctx)
    supabase: Client = create_client(supabase_url, supabase_key)
    
    # 2. Define Strain Data
    lab_results = get_mock_lab_results()
    strain_data = {
        "name": "Blueberry Muffin Kush",
        "grower": "Lake Effect Cultivation",
        "thc": lab_results["thc"],
        "terpenes": lab_results["terpenes"],
        "lab_url": lab_results["lab_url"],
        "story": "Grown in nutrient-rich soil near Lake Michigan, this strain offers a unique blueberry profile with deep relaxation."
    }
    
    # 3. Register on StrainChain
    if ctx.mode == Mode.DRY_RUN:
        product_id = "dry-run-strain-id"
        ctx.step(f"Register strain: {strain_data['name']} (Dry-run)")
        mock_res = {"strain": {"id": product_id}}
    else:
        mock_res = ctx.step(
            f"Register verified strain on StrainChain: {strain_data['name']}",
            action=lambda: asyncio.run(register_strain_identity(supabase, strain_data))
        )
        product_id = mock_res["strain"]["id"]
        
    # 4. Generate StoryMode
    ctx.step(
        f"Generate AI StoryMode for {strain_data['name']}",
        action=lambda pid=product_id: asyncio.run(generate_story_mode(supabase, pid))
    )
    
    # 5. Publish Living Page
    # Re-fetch or use mock to generate config
    mock_qr = {"id": 123456}
    mock_record = {
        "id": product_id,
        "name": strain_data["name"],
        "brand": strain_data["grower"],
        "industry_id": "cannabis",
        "authenticity_score": 100,
        "metadata": {
            "thc_content": strain_data["thc"],
            "terpene_profile": strain_data["terpenes"],
            "lab_results_url": strain_data["lab_url"],
            "grower_story": strain_data["story"]
        }
    }
    
    living_config = generate_living_page_config(mock_record, mock_qr)
    ctx.step(
        f"Publish Living Product Page for {strain_data['name']}",
        action=lambda pid=product_id, cfg=living_config: asyncio.run(publish_living_page(supabase, pid, cfg))
    )
    
    # 6. Initialize Rewards
    ctx.step(
        f"Initialize QRON rewards for {strain_data['name']}",
        action=lambda: asyncio.run(reward_repeat_scans(supabase, "0x0000000000000000000000000000000000000000"))
    )
    
    return f"StrainChain pilot successfully deployed for {strain_data['name']}. Product ID: {product_id}"
