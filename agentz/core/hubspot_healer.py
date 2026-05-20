"""
agentz.core.hubspot_healer
-------------------------
Autonomous Token Healer: Rotates HubSpot Private App tokens via browser-use.
"""
from __future__ import annotations
import logging
from agentz.core.llm import get_llm
from browser_use import Agent, Browser

logger = logging.getLogger("agentz.hubspot_healer")

async def rotate_hubspot_token() -> str | None:
    """
    Instantiates a browser agent to rotate the HubSpot Private App token.
    Returns the new token string on success, or None on failure.
    """
    logger.info("Initiating HubSpot Token Rotation...")
    
    prompt = """
    1. Navigate to https://app.hubspot.com/
    2. Log in if required (use existing session or look for 'Log In' button).
    3. Navigate to Settings (cog icon) -> Integrations -> Private Apps.
    4. Locate the 'AgentZ Master' or 'AuthiChain' private app.
    5. Click on the app, go to the 'Access token' tab.
    6. Click 'Rotate' and confirm the rotation.
    7. Copy the NEW access token.
    
    Your final answer MUST be ONLY the copied token string.
    """

    llm = get_llm(model="gpt-4o")
    browser = Browser(headless=True)
    agent = Agent(task=prompt, llm=llm, browser=browser)

    try:
        history = await agent.run()
        token = str(history.final_result() or "").strip()
        
        # Basic validation: HubSpot PATs typically start with 'pat-na1-' or similar
        if "pat-" in token:
            logger.info("HubSpot Token rotated successfully.")
            return token
        else:
            logger.error(f"Failed to find a valid token in agent result: {token}")
            return None
    except Exception as e:
        logger.error(f"HubSpot Token Rotation failed: {e}")
        return None
    finally:
        await browser.close()
