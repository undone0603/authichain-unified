"""
agentz.core.pulse
-----------------
Pulse Agent: Emits a system heartbeat to verify continuous operation.
Zero-dependency, high-frequency, low-impact.
Enhanced with Infrastructure Anomaly Detection (Phase 18).
"""
from __future__ import annotations
import time
import json
import logging
import os
import httpx
from pathlib import Path
from typing import Dict, Any

logger = logging.getLogger("agentz.pulse")

class PulseAgent:
    def __init__(self, log_dir: str = "agentz/logs"):
        self.log_dir = Path(log_dir)
        self.pulse_path = self.log_dir / "heartbeat.json"
        self.pulse_path.parent.mkdir(parents=True, exist_ok=True)

    def check_deep_health(self) -> Dict[str, Any]:
        """Verifies core system dependencies and infrastructure stability."""
        health = {
            "supabase": "unknown",
            "pipeline_ledger": "unknown",
            "hubspot": "unknown",
            "infrastructure": "unknown"
        }
        
        # 1. Check Pipeline Ledger
        ledger_path = self.log_dir / "grants" / "pipeline_ledger.json"
        if ledger_path.exists():
            try:
                ledger_path.read_text(encoding="utf-8")
                health["pipeline_ledger"] = "ok"
            except:
                health["pipeline_ledger"] = "error"
        else:
            health["pipeline_ledger"] = "missing"

        # 2. Check Supabase (Dynamic Import to avoid circularity)
        from agentz.core.credentials import get
        from supabase import create_client
        try:
            url = get("supabase_url", required=False)
            key = get("supabase_service_key", required=False)
            if url and key:
                supabase = create_client(url, key)
                # Simple connectivity probe
                supabase.table("products").select("id").limit(1).execute()
                health["supabase"] = "ok"
            else:
                health["supabase"] = "missing_keys"
        except:
            health["supabase"] = "offline"

        # 3. Check Infrastructure (Vercel Framework Detection)
        # We poll a critical CSS asset. If it returns text/html, the framework preset is wrong.
        asset_url = "https://authichain.com/assets/index-BRxg5LyC.css"
        try:
            # Use short timeout to avoid hanging the pulse
            r = httpx.get(asset_url, timeout=5.0)
            c_type = r.headers.get("Content-Type", "").lower()
            if "text/html" in c_type:
                logger.error(f"Infrastructure Anomaly Detected: {asset_url} served as {c_type}")
                health["infrastructure"] = "error_framework_preset"
            elif r.status_code != 200:
                health["infrastructure"] = f"error_http_{r.status_code}"
            else:
                health["infrastructure"] = "ok"
        except Exception as e:
            logger.warning(f"Infrastructure health check failed: {e}")
            health["infrastructure"] = "unreachable"

        return health

    def emit(self):
        """Writes a fresh heartbeat pulse with deep health context."""
        deep_health = self.check_deep_health()
        data = {
            "timestamp": time.time(),
            "status": "SOVEREIGN" if all(v == "ok" for v in deep_health.values()) else "DEGRADED",
            "pid": os.getpid(),
            "engine": "Sovereign OS v2.0",
            "deep_health": deep_health
        }
        try:
            with self.pulse_path.open("w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            return True
        except Exception as e:
            logger.error(f"Pulse Emission Failed: {e}")
            return False
