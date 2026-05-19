import httpx
import base64
from agentz.core.credentials import get

def fix_vercel_json():
    pat = get('github_pat_zkie')
    repo = "undone0603/authichain-unified"
    path = "vercel.json"
    
    # 1. Get current SHA
    r = httpx.get(f"https://api.github.com/repos/{repo}/contents/{path}", headers={"Authorization": f"token {pat}"})
    sha = r.json().get('sha')
    
    # 2. Prepare new content
    content = """{
  "version": 2,
  "buildCommand": "pnpm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/server.js"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}"""
    encoded = base64.b64encode(content.encode()).decode()
    
    # 3. Update file
    r = httpx.put(
        f"https://api.github.com/repos/{repo}/contents/{path}",
        headers={"Authorization": f"token {pat}"},
        json={
            "message": "fix: correct vercel framework and output directory for vite",
            "content": encoded,
            "sha": sha
        }
    )
    print(f"Status: {r.status_code}")
    print(f"Body: {r.text}")

if __name__ == "__main__":
    fix_vercel_json()
