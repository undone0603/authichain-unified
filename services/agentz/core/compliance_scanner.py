"""
agentz.core.compliance_scanner
------------------------------
ComplianceScanner Agent: Audits ledger gaps and fraud alerts against 
regulatory requirements (e.g., EU DPP).
"""
from __future__ import annotations
import logging
from typing import Dict, Any, List
from agentz.core.compliance import scan_product_compliance, research_dpp_requirements

logger = logging.getLogger("agentz.compliance_scanner")

async def run_automated_audit(supabase) -> Dict[str, Any]:
    """
    Runs a full audit of products and ledger fraud alerts.
    """
    logger.info("Starting automated compliance audit.")
    
    # 1. DPP Compliance Scan
    dpp_reqs = await research_dpp_requirements("luxury") # Defaulting to luxury for now
    products = supabase.table("products").select("id").execute().data or []
    
    audit_results = []
    for p in products:
        dpp_res = await scan_product_compliance(supabase, p["id"], dpp_reqs)
        audit_results.append(dpp_res)
        
    # 2. Fraud Alert Ledger Check
    fraud_alerts = supabase.table("fraud_alerts").select("*").execute().data or []
    
    report = {
        "dpp_audit": audit_results,
        "fraud_alerts": fraud_alerts,
        "compliance_score": calculate_score(audit_results, fraud_alerts)
    }
    
    # 3. Store Report
    await supabase.table("public_reports").insert({
        "id": "compliance_audit_final",
        "data": report
    }).execute()
    
    return report

def calculate_score(dpp_audit: List[Dict[str, Any]], fraud_alerts: List[Dict[str, Any]]) -> float:
    # Basic scoring logic
    non_compliant = [r for r in dpp_audit if r["status"] == "NON_COMPLIANT"]
    return max(0.0, 100.0 - (len(non_compliant) * 5.0) - (len(fraud_alerts) * 10.0))
