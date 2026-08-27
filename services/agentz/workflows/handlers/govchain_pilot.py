"""
agentz.workflows.handlers.govchain_pilot
----------------------------------------
Executes a GovChain municipal transparency pilot.
"""
from __future__ import annotations
import asyncio
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.credentials import get_or_placeholder
from agentz.core.gov import register_public_project
from agentz.core.pages import generate_living_page_config, publish_living_page
from supabase import create_client, Client

def run(ctx: ExecutionContext) -> str:
    # 1. Setup credentials
    supabase_url = get_or_placeholder("supabase_url", ctx)
    supabase_key = get_or_placeholder("supabase_service_key", ctx)
    supabase: Client = create_client(supabase_url, supabase_key)
    
    # 2. Define Public Project
    project_data = {
        "name": "Grand River Ave Infrastructure Maintenance",
        "municipality": "City of Detroit",
        "type": "infrastructure",
        "status": "in-progress",
        "budget": "$1.2M"
    }
    
    # 3. Register on GovChain
    if ctx.mode == Mode.DRY_RUN:
        project_id = "dry-run-gov-project-id"
        ctx.step(f"Register public project: {project_data['name']} (Dry-run)")
    else:
        res = ctx.step(
            f"Register public project on GovChain: {project_data['name']}",
            action=lambda: asyncio.run(register_public_project(supabase, project_data))
        )
        project_id = res["project"]["id"]
        
    # 4. Generate Living Transparency Page
    # We reuse the Living Page config but customize it for government transparency
    mock_qr = {"id": f"gov-{project_id[:8]}"}
    mock_project_record = {
        "id": project_id,
        "name": project_data["name"],
        "brand": project_data["municipality"],
        "authenticity_score": 100,
        "metadata": {"vertical": "government", "transparency": "High"}
    }
    
    living_config = generate_living_page_config(mock_project_record, mock_qr)
    # Customize for GovChain
    living_config["supply_chain"]["timeline"] = [
        {"event": "Project Authorized", "status": "complete"},
        {"event": "Budget Allocated", "status": "complete"},
        {"event": "Maintenance Started", "status": "active"}
    ]
    living_config["merchant"]["cta"] = "View Municipal Budget"
    
    ctx.step(
        f"Publish Living Transparency Page for {project_data['name']}",
        action=lambda pid=project_id, cfg=living_config: asyncio.run(publish_living_page(supabase, pid, cfg))
    )
    
    return f"GovChain pilot successfully initialized for {project_data['name']}. Project ID: {project_id}"
