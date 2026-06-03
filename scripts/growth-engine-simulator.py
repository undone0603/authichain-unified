"""
scripts/growth-engine-simulator.py
----------------------------------
Simulates global engagement to demonstrate the "Truth Layer" and QRON reward utility.
1. Simulates product scans from various global locations.
2. Triggers authenticity score recalculations.
3. Appends events to the Dynamic Identity Timelines.
4. Generates community proof rewards.
"""
import asyncio
import logging
import random
import sys
from pathlib import Path

# Fix module imports
project_root = str(Path(__file__).parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from agentz.core.modes import ExecutionContext, Mode

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("growth-simulator")

CITIES = [
    {"city": "Paris", "country": "FR", "target": "Luxury"},
    {"city": "Tokyo", "country": "JP", "target": "Electronics"},
    {"city": "New York", "country": "US", "target": "Pharma"},
    {"city": "Dubai", "country": "AE", "target": "Watch"},
    {"city": "London", "country": "GB", "target": "Art"}
]

async def simulate_engagement(count: int = 5):
    ctx = ExecutionContext(workflow_id="growth_sim_v1", mode=Mode.DRY_RUN)
    
    logger.info(f"📈 STARTING GROWTH ENGINE SIMULATION ({count} events)")
    
    for i in range(count):
        location = random.choice(CITIES)
        product_id = random.randint(1, 10)
        
        logger.info(f"--- Event {i+1}: Simulated Scan ---")
        logger.info(f"📍 Location: {location['city']}, {location['country']}")
        logger.info(f"📦 Product ID: {product_id} ({location['target']} vertical)")
        
        # Simulate the 'qrcode.scan' logic
        logger.info("  🔍 Recalculating Authenticity Score...")
        # Simulate velocity/geo check
        score = random.randint(94, 100)
        logger.info(f"  ✅ Result: AUTHENTIC (Confidence: {score}%)")
        
        logger.info("  📝 Appending to Dynamic Identity Timeline...")
        logger.info(f"  ✅ Event: 'Verified Field Scan' at {location['city']} registered.")
        
        # Simulate Reward Claim
        if random.random() > 0.3:
            logger.info("  💰 User claiming engagement reward...")
            logger.info("  ✅ 10.00 QRON awarded to Agent Wallet.")
            
        # Simulate Photo Proof
        if random.random() > 0.7:
            logger.info("  📸 Community Photo Proof submitted!")
            logger.info("  🧠 Vision Agent analyzing proof context...")
            logger.info("  ✅ Proof VALID. 20.00 QRON bonus issued.")

        await asyncio.sleep(0.5)

    logger.info("\n🏁 SIMULATION COMPLETE. Truth Layer engagement metrics updated.")

if __name__ == "__main__":
    num_events = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    asyncio.run(simulate_engagement(num_events))
