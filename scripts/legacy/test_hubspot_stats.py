import httpx
import os

def test_hubspot():
    token = "HUBSPOT_SERVICE_KEY_REDACTED"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    print("Searching for ALL contacts with 'IN_PROGRESS' lead status...")
    body = {
        "filterGroups": [{
            "filters": [
                {"propertyName": "hs_lead_status", "operator": "EQ", "value": "IN_PROGRESS"}
            ]
        }],
        "limit": 100
    }
    r = httpx.post("https://api.hubapi.com/crm/v3/objects/contacts/search", headers=headers, json=body)
    if r.status_code == 200:
        results = r.json().get("results", [])
        total = r.json().get("total", 0)
        print(f"Found {total} contacts in IN_PROGRESS status.")
    else:
        print(f"Error: {r.text}")

if __name__ == "__main__":
    test_hubspot()
