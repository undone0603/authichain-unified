"""
agentz.core.submission
----------------------
Submission Agent: Autonomously navigates federal and private portals 
to upload drafted proposals and submit formal bids.
Uses browser-use for complex web interactions.
"""
from __future__ import annotations
import os
import logging
from typing import Dict, Any, Optional, Tuple
from agentz.core.llm import get_llm
from agentz.core.modes import ExecutionContext
from browser_use import Agent, Browser

logger = logging.getLogger("agentz.submission")

async def submit_proposal_via_browser(
    ctx: ExecutionContext,
    notice_id: str, 
    artifact_path: str, 
    target_url: str = "https://www.sam.gov"
) -> Tuple[bool, str]:
    """
    Instantiates a browser agent to navigate to the target portal and submit a proposal.
    Returns (success, proof).
    """
    if not os.path.exists(artifact_path):
        logger.error(f"Artifact not found at: {artifact_path}")
        return False, "Artifact missing"

    prompt = f"""
    You are the AgentZ Autonomous Submitter for AUTHICHAIN.
    1. Navigate to {target_url}.
    2. Search for or locate the submission page for Notice ID: {notice_id}.
    3. Fill out the submission form with these official company details:
       - Company Name: AUTHICHAIN
       - UEI: R34XKWRJY9A5
       - CAGE Code: 1PUJ6
       - Physical Address: 109 N 4th St, Roscommon, MI 48653-9090 USA
    4. Upload the proposal file located at: {artifact_path}.
    5. Click Submit and confirm that the 'Submitted' status or a receipt is visible.
    
    If the site requires a login and you don't have credentials, record the failure reason.
    Your final answer should summarize the outcome and provide the confirmation ID if available.
    """

    llm = get_llm(model="gpt-4o")
    browser = Browser(headless=True)
    agent = Agent(task=prompt, llm=llm, browser=browser, max_steps=30)

    try:
        history = await agent.run()
        # Analyze history for success signals
        last_msg = str(history.final_result() or "")
        proof = last_msg if len(last_msg) > 5 else "Submission confirmed by agent"
        
        if any(x in last_msg.lower() for x in ["success", "submitted", "confirmed"]):
            return True, proof
        return False, f"Agent ended without confirmation: {last_msg}"
    except Exception as e:
        logger.error(f"Submission failed for {notice_id}: {e}")
        return False, str(e)
    finally:
        # Browser session is cleaned up by reset or context
        pass
    
    return False, "Submission process ended."
