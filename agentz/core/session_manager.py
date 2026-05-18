"""
agentz.core.session_manager
---------------------------
Injects session cookies from .env into browser-use contexts to bypass logins.
"""
from typing import Optional
from browser_use import Browser
from agentz.core.credentials import get

COOKIE_MAP = {
    "linkedin_session": {
        "name": "li_at",
        "domain": ".linkedin.com"
    },
    "reddit_session": {
        "name": "reddit_session",
        "domain": ".reddit.com"
    },
    "twitter_session": {
        "name": "auth_token",
        "domain": ".twitter.com"
    },
    "polygon_session": {
        "name": "session_id", # Placeholder
        "domain": ".polygon.technology"
    },
    "google_session": {
        "name": "SID",
        "domain": ".google.com"
    },
    "sam_auth": {
        "name": "SAM_AUTH",
        "domain": ".sam.gov"
    }
}

def get_browser_with_session(platform_keys: list[str]) -> Browser:
    """
    Returns a Browser instance configured with session cookies for the given keys.
    """
    cookies = []
    
    for platform in platform_keys:
        config = COOKIE_MAP.get(platform)
        if not config:
            continue
            
        cookie_val = get(platform, required=False)
        # Skip placeholders or missing cookies
        if cookie_val and cookie_val not in ["TODO_PASTE", ""]:
            cookies.append({
                "name": config["name"],
                "value": cookie_val,
                "domain": config["domain"],
                "path": "/",
                "httpOnly": True,
                "secure": True,
                "sameSite": "Lax"
            })
            
    if not cookies:
        return Browser()
        
    storage_state = {
        "cookies": cookies,
        "origins": []
    }
    
    return Browser(storage_state=storage_state)
