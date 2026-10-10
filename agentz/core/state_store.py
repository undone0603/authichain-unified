"""Persistent State Storage module."""
import json
import os
import time
from typing import Dict, Any, List, Optional

class StateStore:
    def __init__(self, store_path: str = "agentz/logs/state_store.json"):
        self.store_path = store_path
        dirname = os.path.dirname(self.store_path)
        if dirname:
            os.makedirs(dirname, exist_ok=True)
        if not os.path.exists(self.store_path):
            self._save({"runs": [], "nonces": [], "audit_results": []})

    def _load(self) -> Dict[str, Any]:
        try:
            with open(self.store_path, 'r') as f:
                return json.load(f)
        except Exception:
            return {"runs": [], "nonces": [], "audit_results": []}

    def _save(self, data: Dict[str, Any]) -> None:
        with open(self.store_path, 'w') as f:
            json.dump(data, f, indent=2)

    def record_run(self, run_id: str, details: Dict[str, Any]) -> None:
        data = self._load()
        data["runs"].append({"run_id": run_id, "timestamp": time.time(), "details": details})
        self._save(data)

    def record_nonce(self, nonce: str) -> bool:
        data = self._load()
        if nonce in data["nonces"]:
            return False
        data["nonces"].append(nonce)
        self._save(data)
        return True

    def record_audit(self, audit_id: str, result: Dict[str, Any]) -> None:
        data = self._load()
        data["audit_results"].append({"audit_id": audit_id, "timestamp": time.time(), "result": result})
        self._save(data)

    def get_runs(self) -> List[Dict[str, Any]]:
        return self._load().get("runs", [])
