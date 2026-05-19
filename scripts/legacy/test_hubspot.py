import httpx
import os

def test_hubspot():
    token = os.environ.get("HUBSPOT_SERVICE_KEY", "")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    print("1. Searching for contacts in 'IN_PROGRESS' prospecting agent status...")
    body = {
        "filterGroups": [{
            "filters": [
                {"propertyName": "hs_prospecting_agent_enrollment_status", "operator": "EQ", "value": "IN_PROGRESS"}
            ]
        }],
        "limit": 100
    }
    r = httpx.post("https://api.hubapi.com/crm/v3/objects/contacts/search", headers=headers, json=body)
    if r.status_code == 200:
        results = r.json().get("results", [])
        print(f"Found {len(results)} contacts in IN_PROGRESS status.")
    else:
        print(f"Error: {r.text}")

    print("\n2. Searching for ANY custom property that might be 'drip_status'...")
    r = httpx.get("https://api.hubapi.com/crm/v3/properties/contacts", headers=headers)
    if r.status_code == 200:
        props = r.json().get("results", [])
        custom = [p['name'] for p in props if not p['name'].startswith('hs_')]
        print(f"Custom properties found: {custom}")
        drip_like = [p['name'] for p in props if 'drip' in p['name'].lower() or 'drip' in p['label'].lower()]
        print(f"Drip-like properties found: {drip_like}")

if __name__ == "__main__":
    test_hubspot()
