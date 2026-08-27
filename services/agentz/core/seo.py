"""
agentz.core.seo
---------------
SEO Agent: Manages sitemap generation, IndexNow pings, and GSC submissions.
"""
from __future__ import annotations
import httpx
import datetime
import logging
from typing import List, Dict, Any
from pathlib import Path

logger = logging.getLogger("agentz.seo")

def generate_sitemap_xml(base_url: str, urls: List[Dict[str, Any]]) -> str:
    """Generates a standard sitemap.xml string."""
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    
    for item in urls:
        xml += '  <url>\n'
        xml += f'    <loc>{base_url}{item["path"]}</loc>\n'
        xml += f'    <lastmod>{item.get("lastmod", datetime.date.today().isoformat())}</lastmod>\n'
        xml += f'    <changefreq>{item.get("changefreq", "weekly")}</changefreq>\n'
        xml += f'    <priority>{item.get("priority", "0.5")}</priority>\n'
        xml += '  </url>\n'
        
    xml += '</urlset>'
    return xml

async def ping_indexnow(domain: str, key: str, urls: List[str]):
    """Pings IndexNow API with a list of updated URLs."""
    endpoint = "https://api.indexnow.org/IndexNow"
    payload = {
        "host": domain,
        "key": key,
        "keyLocation": f"https://{domain}/{key}.txt",
        "urlList": urls
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(endpoint, json=payload)
            return r.status_code == 200
    except Exception as e:
        logger.error(f"IndexNow ping failed for {domain}: {e}")
        return False

async def update_platform_sitemaps(supabase):
    """
    Dynamically generates sitemaps for all platforms using Supabase data.
    """
    # 1. Fetch data
    products = supabase.table("products").select("id, industry_id, updated_at").execute().data
    
    platforms = {
        "authichain.com": {"vertical": "luxury", "urls": [{"path": "/", "priority": "1.0"}]},
        "qron.space": {"vertical": "all", "urls": [{"path": "/", "priority": "1.0"}, {"path": "/explore", "priority": "0.9"}]},
        "strainchain.io": {"vertical": "cannabis", "urls": [{"path": "/", "priority": "1.0"}]},
        "govchain.us": {"vertical": "government", "urls": [{"path": "/", "priority": "1.0"}]}
    }
    
    for p in products:
        path = f"/v/{p['id']}" # Assuming /v/ for verification or similar
        if p['industry_id'] == "cannabis":
            platforms["strainchain.io"]["urls"].append({"path": f"/strains/{p['id']}", "priority": "0.8"})
        elif p['industry_id'] == "government":
            platforms["govchain.us"]["urls"].append({"path": f"/projects/{p['id']}", "priority": "0.8"})
        else:
            platforms["authichain.com"]["urls"].append({"path": f"/verify/{p['id']}", "priority": "0.8"})
            
        # All products go into qron.space explorer
        platforms["qron.space"]["urls"].append({"path": f"/explore/{p['id']}", "priority": "0.7"})

    results = {}
    for domain, data in platforms.items():
        xml = generate_sitemap_xml(f"https://{domain}", data["urls"])
        results[domain] = xml
        
    return results
