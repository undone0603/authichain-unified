import httpx
import os
from datetime import datetime, timezone

def check_tasks():
    token = os.environ.get("HUBSPOT_SERVICE_KEY", "")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    print("Checking for Zac's tasks in HubSpot...")
    # Owner ID for Zac is 87978084
    body = {
        "filterGroups": [{
            "filters": [
                {"propertyName": "hubspot_owner_id", "operator": "EQ", "value": "87978084"},
                {"propertyName": "hs_task_status", "operator": "NEQ", "value": "COMPLETED"}
            ]
        }],
        "properties": ["hs_task_subject", "hs_task_body", "hs_task_status", "hs_timestamp"],
        "limit": 20
    }
    r = httpx.post("https://api.hubapi.com/crm/v3/objects/tasks/search", headers=headers, json=body)
    if r.status_code == 200:
        results = r.json().get("results", [])
        print(f"Found {len(results)} open tasks.")
        for t in results:
            print(f"  Task {t['id']}: {t['properties'].get('hs_task_subject')} | Status: {t['properties'].get('hs_task_status')}")
    else:
        print(f"Error: {r.text}")

if __name__ == "__main__":
    check_tasks()
