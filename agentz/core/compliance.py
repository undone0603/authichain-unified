"""
agentz.core.compliance
----------------------
Compliance Agent: Monitors EU Digital Product Passport (DPP) regulations
and flags products for metadata gaps.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Dict, Any, List, Optional

from agentz.core.llm import get_llm
from agentz.core.modes import ExecutionContext

logger = logging.getLogger("agentz.compliance")


class ProviderWrapper:
    def __init__(self, llm, provider_name: str):
        self.llm = llm
        self.provider = provider_name

    def __getattr__(self, name):
        return getattr(self.llm, name)

    def invoke(self, *args, **kwargs):
        return self.llm.invoke(*args, **kwargs)


def _extract_json(text: str):
    text = text.strip()
    if "```json" in text:
        text = text.split("```json", 1).split("```", 1).strip()[1]
    return json.loads(text)


async def research_dpp_requirements(vertical: str, ctx: Optional[ExecutionContext] = None) -> List[str]:
    from browser_use import Agent, Controller
    from agentz.core.browser import attach_interceptor, run_with_healing

    controller = Controller()
    if ctx:
        attach_interceptor(controller, ctx)

    task = (
        f"Search official EU Commission websites for the latest 2026/2027 mandates regarding "
        f"the Digital Product Passport (DPP) for the {vertical} industry. "
        "Extract a list of mandatory data fields (e.g., origin, recycled content, carbon footprint)."
    )

    provider = os.getenv("LLM_PROVIDER", "groq").lower()

    if provider == "groq":
        from langchain_openai import ChatOpenAI

        active_model = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")
        groq_key = os.getenv("GROQ_API_KEY")
        if not groq_key:
            raise RuntimeError("Missing GROQ_API_KEY")

        raw_llm = ChatOpenAI(
            api_key=groq_key,
            base_url="https://api.groq.com/openai/v1",
            model=active_model,
            temperature=0,
        )
        llm = ProviderWrapper(raw_llm, "groq")
    else:
        active_model = os.getenv("LLM_MODEL", "gpt-4o")
        llm = get_llm(model=active_model)

    agent = Agent(task=task, llm=llm, controller=controller)

    if not ctx:
        history = await agent.run()
    else:
        history = await run_with_healing(agent, ctx)

    prompt = f"Convert this browser history into a clean JSON list of mandatory DPP fields: {history.final_result()}"
    res = llm.invoke(prompt)
    content = getattr(res, "content", str(res))

    try:
        data = _extract_json(content)
        return data if isinstance(data, list) else ["origin_country", "material_composition", "carbon_footprint_total", "circularity_index"]
    except Exception:
        return ["origin_country", "material_composition", "carbon_footprint_total", "circularity_index"]


async def scan_product_compliance(supabase, product_id: str, requirements: List[str]) -> Dict[str, Any]:
    product_res = supabase.table("products").select("metadata").eq("id", product_id).single().execute()
    metadata = product_res.data.get("metadata", {})

    missing_fields = [req for req in requirements if req not in metadata]
    status = "COMPLIANT" if not missing_fields else "NON_COMPLIANT"

    supabase.table("products").update({
        "metadata": {
            **metadata,
            "dpp_compliance": {
                "status": status,
                "missing_fields": missing_fields,
                "last_checked": "now()"
            }
        }
    }).eq("id", product_id).execute()

    return {
        "product_id": product_id,
        "status": status,
        "missing": missing_fields
    }


async def run_global_compliance_audit(supabase, ctx: Optional[ExecutionContext] = None):
    reqs = await research_dpp_requirements("luxury", ctx)
    products = supabase.table("products").select("id").limit(10).execute().data

    results = []
    for p in products:
        res = await scan_product_compliance(supabase, p["id"], reqs)
        results.append(res)

    return results
