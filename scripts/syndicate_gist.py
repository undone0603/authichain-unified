import httpx
import logging
from pathlib import Path
from agentz.core.credentials import get

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agentz.gist")

async def post_to_gist(file_path):
    path = Path(file_path)
    if not path.exists():
        logger.error(f"File not found: {file_path}")
        return
    
    content = path.read_text(encoding="utf-8")
    pat = get("github_pat_zkie")
    
    url = "https://api.github.com/gists"
    headers = {
        "Authorization": f"token {pat}",
        "Accept": "application/vnd.github.v3+json"
    }
    payload = {
        "description": "AuthiChain Technical Retrospective: Scaling Autonomous Trust (EU DPP 2026)",
        "public": True,
        "files": {
            "authichain_technical_report_2026.md": {
                "content": content
            }
        }
    }
    
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(url, headers=headers, json=payload)
            data = r.json()
            if r.status_code == 201:
                gist_url = data["html_url"]
                logger.info(f"✅ Successfully posted to GitHub Gist: {gist_url}")
                return gist_url
            else:
                logger.error(f"❌ Failed to post Gist: {data.get('message')}")
        except Exception as e:
            logger.error(f"❌ Gist error: {e}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(post_to_gist("agentz/logs/marketing/technical_blog_20260519.md"))
