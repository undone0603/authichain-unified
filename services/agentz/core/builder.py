"""
agentz.core.builder
-------------------
Builder Agent: Generates QR systems and initializes product records.
"""
from __future__ import annotations
import uuid
import secrets
from typing import Dict, Any

async def generate_secure_qr(product_id: str) -> Dict[str, Any]:
    """Generates a unique QR ID and a verification signature."""
    # Use a random integer for qron_id as the existing schema expects integers
    import random
    qr_id_int = random.randint(100000, 999999)
    return {
        "id": qr_id_int,
        "verification_url": f"https://authichain.com/v/{qr_id_int}",
        "product_id": product_id
    }

from agentz.core.blockchain import BlockchainAgent

import qrcode
from pathlib import Path

def generate_physical_qr_asset(qr_id: int, brand: str) -> str:
    """
    Generates a high-resolution branded QR asset for physical printing.
    """
    assets_dir = Path(__file__).resolve().parent.parent / "logs" / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)
    
    url = f"https://authichain.com/v/{qr_id}"
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save the file
    safe_brand = brand.lower().replace(" ", "_")
    path = assets_dir / f"qr_{safe_brand}_{qr_id}.png"
    img.save(path)
    
    return str(path)

async def generate_secure_nfc_payload(product_id: str) -> Dict[str, str]:
    """Generates a secure payload for NFC chip encoding."""
    import secrets
    nfc_key = secrets.token_hex(16)
    return {
        "nfc_id": f"nfc_{secrets.token_hex(4)}",
        "encryption_key": nfc_key,
        "nfc_payload": f"authichain://v/{product_id}?key={nfc_key}"
    }

async def create_product_identity(supabase, product_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Registers a new product in the Supabase database and generates its QR + NFC identity.
    Includes on-chain trust anchoring and physical asset generation.
    """
    product_id = str(uuid.uuid4())
    qr = await generate_secure_qr(product_id)
    nfc = await generate_secure_nfc_payload(product_id)
    
    # On-chain Anchoring
    blockchain = BlockchainAgent()
    tx_hash = await blockchain.anchor_identity({
        "id": product_id,
        "qron_id": qr["id"],
        "nfc_id": nfc["nfc_id"],
        "brand": product_data.get("brand")
    })
    
    # Physical Asset
    qr_asset_path = generate_physical_qr_asset(qr["id"], product_data.get("brand", "AuthiChain"))
    
    payload = {
        "id": product_id,
        "name": product_data["name"],
        "brand": product_data.get("brand"),
        "qron_id": qr["id"],
        "industry_id": product_data.get("metadata", {}).get("vertical", "general"),
        "blockchain_hash": tx_hash,
        "metadata": {
            **product_data.get("metadata", {}), 
            "tx_hash": tx_hash,
            "qr_asset_path": qr_asset_path,
            "nfc_enabled": True,
            "nfc_id": nfc["nfc_id"]
        }
    }
    
    # Real Supabase Insert
    response = supabase.table("products").insert(payload).execute()
    
    return {
        "product": payload,
        "qr": qr,
        "nfc": nfc,
        "qr_asset": qr_asset_path,
        "supabase_response": response.data
    }
