"""
tests.test_infrastructure
------------------------
Integration tests verifying live connectivity to production end-points.
"""
import pytest
from agentz.core.credentials import get
from supabase import create_client
import httpx

def test_supabase_connection():
    """Verify Supabase is reachable and authenticated."""
    url = get("supabase_url")
    key = get("supabase_service_key")
    supabase = create_client(url, key)
    res = supabase.table("products").select("count", count="exact").limit(1).execute()
    assert res.count is not None

def test_polygon_rpc():
    """Verify the Polygon RPC is responding."""
    rpc_url = get("polygon_rpc_url") or "https://rpc-amoy.polygon.technology"
    payload = {"jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1}
    r = httpx.post(rpc_url, json=payload, timeout=10.0)
    assert r.status_code == 200
    assert "result" in r.json()

def test_stripe_api():
    """Verify Stripe API key is valid."""
    stripe_key = get("stripe_secret")
    headers = {"Authorization": f"Bearer {stripe_key}"}
    r = httpx.get("https://api.stripe.com/v1/accounts", headers=headers, timeout=10.0)
    assert r.status_code == 200

def test_hubspot_api():
    """Verify HubSpot API token is valid."""
    token = get("hubspot_token")
    headers = {"Authorization": f"Bearer {token}"}
    r = httpx.get("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", headers=headers, timeout=10.0)
    assert r.status_code == 200
