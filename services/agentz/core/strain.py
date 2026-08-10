"""
agentz.core.strain
------------------
Strain Agent: Manages cannabis-specific data, lab results, and terpene profiles.
Now includes 'Golden Batch' logic for premium craft narratives.
"""
from __future__ import annotations
import uuid
import logging
from typing import Dict, Any, List
from agentz.core.llm import get_llm

logger = logging.getLogger("agentz.strain")

async def generate_golden_batch_narrative(strain_data: Dict[str, Any]) -> Dict[str, str]:
    """
    Uses the LLM factory to translate raw lab data into a sensory 'Master Grower' narrative.
    """
    llm = get_llm(model="gpt-4o")
    
    terpenes = strain_data.get("terpenes", {})
    terp_list = ", ".join([f"{k} ({v})" for k, v in terpenes.items()])
    
    prompt = f"""
    You are the Master Grower for StrainChain. Translate this raw lab data into an emotional sensory story.
    Strain: {strain_data['name']}
    THC: {strain_data.get('thc')}
    Terpene Profile: {terp_list}
    Harvest Context: {strain_data.get('story')}
    
    Include:
    1. A 'Grower's Note' on why this specific batch is special.
    2. A 'Somatic Guide': describe the taste and physical effect using the terpenes.
    3. A 'Freshness Proof' based on the cure time.
    
    Output in professional Markdown.
    """
    
    response = llm.invoke(prompt)
    return {
        "master_grower_script": response.content.strip(),
        "somatic_summary": f"Dominated by {list(terpenes.keys())[0] if terpenes else 'natural notes'}"
    }

async def register_strain_identity(supabase, strain_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Registers a verified cannabis product, with optional Golden Batch hardening.
    """
    product_id = str(uuid.uuid4())
    is_golden = strain_data.get("is_golden_batch", False)
    
    # Generate Narrative if Golden
    narrative = {}
    if is_golden:
        narrative = await generate_golden_batch_narrative(strain_data)
    
    payload = {
        "id": product_id,
        "name": strain_data["name"],
        "brand": strain_data.get("grower", "Premium Cultivator"),
        "industry_id": "cannabis",
        "metadata": {
            "type": "strain",
            "is_golden_batch": is_golden,
            "thc_content": strain_data.get("thc"),
            "terpene_profile": strain_data.get("terpenes", {}),
            "lab_results_url": strain_data.get("lab_url"),
            "grower_story": narrative.get("master_grower_script", strain_data.get("story")),
            "somatic_summary": narrative.get("somatic_summary"),
            "scarcity": strain_data.get("scarcity_limit"),
            "harvest_date": strain_data.get("harvest_date")
        }
    }
    
    # Real Supabase Insert
    response = supabase.table("products").insert(payload).execute()
    
    return {
        "strain": payload,
        "supabase_response": response.data
    }

def get_mock_lab_results() -> Dict[str, Any]:
    return {
        "thc": "24.5%",
        "terpenes": {
            "Myrcene": "0.8%",
            "Limonene": "0.5%",
            "Caryophyllene": "0.3%"
        },
        "lab_url": "https://strainchain.io/labs/verify/12345"
    }
