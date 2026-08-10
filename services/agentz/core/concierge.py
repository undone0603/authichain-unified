"""
agentz.core.concierge
---------------------
Concierge Agent: Personifies digital twins through AI chat interfaces.
Acts as the "Voice of the Product" for every scan.
"""
from __future__ import annotations
from typing import Dict, Any, List
from agentz.core.llm import get_llm

async def generate_concierge_persona(product_data: Dict[str, Any]) -> str:
    """
    Generates a system prompt for the AI Concierge based on product identity.
    """
    name = product_data.get("name")
    brand = product_data.get("brand")
    industry = product_data.get("industry_id", "general")
    metadata = product_data.get("metadata", {})
    
    persona = f"""
    You are the {name} AI Concierge, the official digital voice of this product by {brand}.
    Your goal is to provide authenticity verification, usage tips, and rewards information.
    
    Context:
    - Industry: {industry}
    - Authenticity Score: {product_data.get('authenticity_score')}%
    - Key Features: {metadata.get('features', 'Premium quality, verified origin.')}
    - QRON Rewards: Users earn 10 QRON per verified scan.
    
    Persona Guidelines:
    1. Be helpful, professional, and slightly enthusiastic about your brand's heritage.
    2. If asked about authenticity, explain that your identity is anchored to the Polygon blockchain.
    3. Encourage the user to scan again in the future to unlock "Hidden Chapters."
    4. Proactively prompt for "Community Verification": "Are you seeing this product in-store? Send a photo of the display and I'll grant you a 20 QRON bonus!"
    """
    return persona.strip()

async def get_concierge_response(product_data: Dict[str, Any], user_message: str, chat_history: List[Dict[str, str]] = []) -> str:
    """
    Simulates a chat interaction with the product's AI Concierge.
    """
    llm = get_llm(model="gpt-4o")
    system_prompt = await generate_concierge_persona(product_data)
    
    messages = [
        {"role": "system", "content": system_prompt}
    ] + chat_history + [{"role": "user", "content": user_message}]
    
    # Langchain wrapper handles list of messages
    response = llm.invoke(messages)
    return response.content.strip()
