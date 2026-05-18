"""
agentz.workflows.handlers.authichain_sovereign_healer
----------------------------------------------------
Orchestrates autonomous infrastructure healing.
Detects framework-level anomalies and triggers corrective actions.
"""
from __future__ import annotations
import logging
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.pulse import PulseAgent
from agentz.workflows.handlers import vercel_fix_preset

logger = logging.getLogger("agentz.sovereign_healer")

def run(ctx: ExecutionContext) -> str:
    ctx.step("[^] --- INITIALIZING SOVEREIGN INFRASTRUCTURE HEALER --- [^]")
    
    # 1. Perform Deep Health Check
    pulse = PulseAgent()
    ctx.step("Executing deep infrastructure health scan...")
    health = pulse.check_deep_health()
    
    infra_status = health.get("infrastructure", "unknown")
    ctx.step(f"Infrastructure State: {infra_status}")
    
    # 2. Analyze Anomaly
    if infra_status == "error_framework_preset":
        ctx.step("‼ CRITICAL ANOMALY DETECTED: Vercel Framework Misconfiguration.")
        
        if ctx.mode == Mode.DRY_RUN:
            ctx.step("  [Dry-run] Would trigger vercel_fix_preset self-healing workflow.")
            return "Sovereign Healer: Anomaly detected (Dry-run)."
        
        # 3. Autonomous Healing
        ctx.step("Triggering autonomous self-healing: VERCEL_FIX_PRESET...")
        try:
            # Dynamically execute the fix preset handler
            result = vercel_fix_preset.run(ctx)
            ctx.step(f"  ✓ Healing Cycle Result: {result}")
            return f"Infrastructure Healed: {result}"
        except Exception as e:
            ctx.step(f"  ✖ Healing Cycle Failed: {e}")
            return f"Healing Failed: {e}"
            
    elif infra_status == "ok":
        return "Infrastructure is stable. No healing required."
    else:
        return f"Infrastructure in state '{infra_status}'. No automated recovery path defined."
