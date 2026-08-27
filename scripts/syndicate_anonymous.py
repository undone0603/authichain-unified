import httpx
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agentz.syndication")

def markdown_to_telegraph_nodes(text):
    """
    Very basic conversion of newline-separated text to Telegraph Node format.
    """
    nodes = []
    lines = text.split('\n')
    for line in lines:
        line = line.strip()
        if not line: continue
        
        # Heading 1
        if line.startswith('Title:'):
            nodes.append({"tag": "h3", "children": [line.replace('Title:', '').strip()]})
        # Sections
        elif line.endswith(':'):
            nodes.append({"tag": "h4", "children": [line.strip()]})
        # Bullet points
        elif line.startswith(('1.', '2.', '3.')):
             nodes.append({"tag": "li", "children": [line.strip()]})
        # Regular paragraph
        else:
            nodes.append({"tag": "p", "children": [line]})
    return nodes

async def create_telegraph_account():
    url = "https://api.telegra.ph/createAccount"
    payload = {
        "short_name": "AuthiChain",
        "author_name": "AuthiChain R&D",
        "author_url": "https://authichain.com"
    }
    async with httpx.AsyncClient() as client:
        r = await client.get(url, params=payload)
        data = r.json()
        if data.get("ok"):
            return data["result"]["access_token"]
    return None

async def post_to_telegraph(file_path):
    path = Path(file_path)
    if not path.exists():
        logger.error(f"File not found: {file_path}")
        return
    
    # Create fresh account for this session
    access_token = await create_telegraph_account()
    if not access_token:
        logger.error("Failed to create Telegraph account.")
        return

    content = path.read_text(encoding="utf-8")
    title = "AuthiChain: Scaling Autonomous Trust (Technical Report)"
    nodes = markdown_to_telegraph_nodes(content)
    
    url = "https://api.telegra.ph/createPage"
    payload = {
        "access_token": access_token,
        "title": title,
        "author_name": "AuthiChain R&D",
        "author_url": "https://authichain.com",
        "content": json.dumps(nodes),
        "return_content": True
    }
    
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(url, data=payload)
            data = r.json()
            if data.get("ok"):
                page_url = data["result"]["url"]
                logger.info(f"✅ Successfully posted to Telegra.ph: {page_url}")
                return page_url
            else:
                logger.error(f"❌ Failed to post: {data.get('error')}")
        except Exception as e:
            logger.error(f"❌ Connection error: {e}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(post_to_telegraph("agentz/logs/marketing/technical_blog_20260519.md"))
