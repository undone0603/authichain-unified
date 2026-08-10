import httpx
import os
import json
from agentz.core.credentials import get

def get_logs():
    token = get('vercel_session')
    p = 'prj_mIb6SSMtMy8KsXg9gNta0T3tDJg1'
    url = f'https://api.vercel.com/v6/deployments?projectId={p}&limit=1'
    r = httpx.get(url, headers={'Authorization': f'Bearer {token}'})
    d = r.json().get('deployments', [{}])[0]
    uid = d['uid']
    print(f"UID: {uid}")
    
    # Get build events
    url_logs = f'https://api.vercel.com/v2/deployments/{uid}/events'
    r2 = httpx.get(url_logs, headers={'Authorization': f'Bearer {token}'})
    logs = r2.json()
    for log in logs:
        if 'payload' in log and 'text' in log['payload']:
             print(log['payload']['text'])
        elif 'text' in log:
             print(log['text'])

if __name__ == "__main__":
    get_logs()
