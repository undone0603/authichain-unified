# scripts/migrate_ledger.py
"""
Migration utility to move local JSON ledger data to Supabase (Phase 14).
"""
import sys
from pathlib import Path

# Add project root to sys.path
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))

from agentz.core.grants_pipeline import read_ledger, update_status, LOGS_DIR

def migrate():
    ledger_path = LOGS_DIR / "pipeline_ledger.json"
    if not ledger_path.exists():
        print("No local ledger found to migrate.")
        return

    print(f"Reading ledger from {ledger_path}...")
    data = read_ledger(ledger_path)
    print(f"Found {len(data)} items. Starting migration to Supabase...")

    for nid, entry in data.items():
        print(f" Migrating {nid}...")
        try:
            # update_status handles the Supabase upsert automatically
            # We pass existing metadata to preserve history and fields
            update_status(nid, entry["status"], **entry)
        except Exception as e:
            print(f" Failed to migrate {nid}: {e}")

    print("Migration Complete.")

if __name__ == "__main__":
    migrate()
