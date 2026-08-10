import httpx
import os
from agentz.core.credentials import get

def check_deploy():
    token = get('vercel_session')
    p = 'prj_mIb6SSMtMy8KsXg9gNta0T3tDJg1'
    url = f'https://api.vercel.com/v6/deployments?projectId={p}&limit=1'
    r = httpx.get(url, headers={'Authorization': f'Bearer {token}'})
    d = r.json().get('deployments', [{}])[0]
    print(f"Status: {d.get('readyState')}")
    print(f"URL: {d.get('url')}")

if __name__ == "__main__":
    check_deploy()
