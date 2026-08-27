"""
agentz.core.network
------------------
Network Agent: Aggregates real-time, anonymized scan activity for public display.
Provides the data backbone for the Live Trust Map.
"""
from __future__ import annotations
from typing import List, Dict, Any

async def get_live_scan_pulses(supabase, limit: int = 100) -> List[Dict[str, Any]]:
    """
    Fetches the most recent scan events, anonymizing personal data but 
    retaining city/country and approximate coordinates for mapping.
    """
    res = supabase.table("scan_events").select("id, city, country, scanned_at").order("scanned_at", desc=True).limit(limit).execute()
    scans = res.data
    
    pulses = []
    for s in scans:
        # Simple coordinate simulation based on city if real lat/lng not in schema
        # In production, this would use a GeoIP or provided coordinates
        pulses.append({
            "pulse_id": s["id"],
            "location": f"{s.get('city', 'Secret City')}, {s.get('country', '??')}",
            "timestamp": s["scanned_at"],
            # Simulated jittered coordinates for privacy/demo
            "lat": 42.3314, # Detroit Base
            "lng": -83.0458
        })
        
    return pulses

async def get_network_summary(supabase) -> Dict[str, Any]:
    """
    Returns high-level network health metrics.
    """
    from agentz.core.aggregator import get_global_network_stats
    return await get_global_network_stats(supabase)
