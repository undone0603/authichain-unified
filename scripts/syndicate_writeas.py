import httpx
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agentz.writeas")

async def post_to_writeas(file_path):
    path = Path(file_path)
    if not path.exists():
        logger.error(f"File not found: {file_path}")
        return
    
    content = path.read_text(encoding="utf-8")
    title = "AuthiChain: Scaling Autonomous Trust (Technical Report 2026)"
    
    url = "https://write.as/api/posts"
    payload = {
        "title": title,
        "body": content,
        "font": "mono",
        "lang": "en"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(url, json=payload)
            data = r.json()
            if r.status_code == 201:
                # Write.as anonymous posts are accessible via slug
                post_url = f"https://write.as/{data['data']['id']}"
                logger.info(f"✅ Successfully posted to Write.as: {post_url}")
                return post_url
            else:
                logger.error(f"❌ Failed to post to Write.as: {data}")
        except Exception as e:
            logger.error(f"❌ Write.as error: {e}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(post_to_writeas("agentz/logs/marketing/technical_blog_20260519.md"))
