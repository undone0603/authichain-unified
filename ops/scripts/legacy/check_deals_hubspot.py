import httpx
import os

def check_deals():
    token = os.environ.get("HUBSPOT_SERVICE_KEY", "")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    deals = ["Cloud Cannabis", "Oakley Signs", "PufCreativ", "Lettuce"]
    
    for deal_name in deals:
        print(f"\nChecking deal: {deal_name}")
        body = {
            "filterGroups": [{
                "filters": [
                    {"propertyName": "dealname", "operator": "CONTAINS_TOKEN", "value": deal_name}
                ]
            }],
            "properties": ["dealname", "dealstage", "amount", "hubspot_owner_id", "notes_last_contacted", "lastmodifieddate", "hs_lastmodifieddate"],
            "limit": 5
        }
        r = httpx.post("https://api.hubapi.com/crm/v3/objects/deals/search", headers=headers, json=body)
        if r.status_code == 200:
            results = r.json().get("results", [])
            print(f"Found {len(results)} matches.")
            for d in results:
                print(f"  Deal {d['id']}: {d['properties'].get('dealname')} | Stage: {d['properties'].get('dealstage')}")
                # Find associated contacts
                r2 = httpx.get(f"https://api.hubapi.com/crm/v3/objects/deals/{d['id']}/associations/contacts", headers=headers)
                if r2.status_code == 200:
                    contacts = r2.json().get("results", [])
                    for c in contacts:
                        r3 = httpx.get(f"https://api.hubapi.com/crm/v3/objects/contacts/{c['id']}?properties=email,firstname,lastname,hs_lead_status", headers=headers)
                        if r3.status_code == 200:
                            cp = r3.json().get("properties", {})
                            print(f"    Associated Contact: {cp.get('email')} ({cp.get('firstname')} {cp.get('lastname')}) | Lead Status: {cp.get('hs_lead_status')}")
        else:
            print(f"Error: {r.text}")

if __name__ == "__main__":
    check_deals()
