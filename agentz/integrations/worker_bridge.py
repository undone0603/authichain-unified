"""Worker/Queue Remote Dispatch Hookup module."""
import logging
from typing import Dict, Any, Callable, Optional

logger = logging.getLogger(__name__)

class WorkerBridge:
    def __init__(self, dispatch_handler: Optional[Callable[[Dict[str, Any]], Any]] = None):
        self.dispatch_handler = dispatch_handler

    def process_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        logger.info(f"Processing remote trigger webhook: {payload}")
        task_type = payload.get("task_type", "sweep")
        if self.dispatch_handler:
            result = self.dispatch_handler(payload)
        else:
            result = {"status": "dispatched", "task_type": task_type, "payload": payload}
        return result

    def handle_queue_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        return self.process_webhook(event)

    def dispatch(self, task: Dict[str, Any]) -> Dict[str, Any]:
        return self.process_webhook(task)
