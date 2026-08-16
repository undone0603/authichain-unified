"""
compliance_scanner.py
---------------------
Autonomous workflow handler: Periodically audits products for EU DPP compliance
and triggers remediation for gaps.
"""
from agentz.core.compliance import run_global_compliance_audit
from agentz.core.credentials import get_supabase_client
from agentz.core.modes import ExecutionContext

def run(ctx: ExecutionContext):
    ctx.step("Initiating global compliance audit...")
    supabase = get_supabase_client()
    
    results = run_global_compliance_audit(supabase, ctx)
    
    non_compliant = [r for r in results if r["status"] == "NON_COMPLIANT"]
    
    if non_compliant:
        msg = f"Compliance audit complete. {len(non_compliant)} products require remediation."
        ctx.step(msg)
        return msg
    
    return "All products compliant."
