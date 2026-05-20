"""
agentz.core.alerts
------------------
Alerts Agent: Detects suspicious activity and triggers real-time notifications.
"""
from __future__ import annotations
import logging
from typing import Dict, Any, List
from agentz.core.credentials import get

logger = logging.getLogger("agentz.alerts")

async def detect_suspicious_activity(supabase) -> List[Dict[str, Any]]:
    """
    Analyzes recent scans for patterns indicating counterfeit or bot activity.
    """
    # 1. Fetch recent scans with business/product context
    # In a real query, we'd look for velocity spikes or impossible geo-jumps
    scans = supabase.table("scan_events").select("*").order("scanned_at", desc=True).limit(50).execute().data
    
    alerts = []
    
    # Simple Velocity Logic
    qron_counts = {}
    for s in scans:
        qid = s.get("qron_id")
        qron_counts[qid] = qron_counts.get(qid, 0) + 1
        
    for qid, count in qron_counts.items():
        if count > 10: # Threshold for 50 scans (simplified)
            alerts.append({
                "type": "VELOCITY_SPIKE",
                "qron_id": qid,
                "count": count,
                "severity": "CRITICAL"
            })
            
    return alerts

async def trigger_notifications(alerts: List[Dict[str, Any]]):
    """
    Sends alerts to configured channels (Simulated).
    """
    for alert in alerts:
        msg = f"🚨 [AgentZ Alert] {alert['type']} detected for QR {alert['qron_id']}. Severity: {alert['severity']}"
        logger.warning(msg)
        # In production, this would call Resend/Slack/Discord
        print(f"  [alerts] NOTIFY: {msg}")
