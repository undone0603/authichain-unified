"""Automated Interdiction Circuit-Breakers module."""
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class CircuitBreaker:
    def __init__(self, threshold: int = 1):
        self.failure_count = 0
        self.threshold = threshold
        self.is_quarantined = False

    def handle_trust_result(self, verification_passed: bool, details: Dict[str, Any] = None) -> bool:
        if not verification_passed:
            self.failure_count += 1
            logger.warning(f"Trust verification failed! Count: {self.failure_count}")
            if self.failure_count >= self.threshold:
                self.trigger_quarantine(details)
            return False
        return True

    def handle_compliance_result(self, scan_passed: bool, details: Dict[str, Any] = None) -> bool:
        if not scan_passed:
            self.failure_count += 1
            logger.warning(f"Compliance scan failed! Count: {self.failure_count}")
            if self.failure_count >= self.threshold:
                self.trigger_quarantine(details)
            return False
        return True

    def trigger_quarantine(self, details: Dict[str, Any] = None) -> None:
        self.is_quarantined = True
        logger.error(f"Circuit breaker tripped! Autonomous execution quarantined. Details: {details}")

    def check_execution_allowed(self) -> bool:
        if self.is_quarantined:
            raise PermissionError("Execution blocked: System is in quarantine state due to trust/compliance failure.")
        return True

    def record_failure(self, details: Dict[str, Any] = None) -> None:
        self.failure_count += 1
        logger.warning(f"Circuit breaker failure recorded. Count: {self.failure_count}")
        if self.failure_count >= self.threshold:
            self.trigger_quarantine(details or {"reason": "Failure threshold exceeded"})

    def record_success(self) -> None:
        if self.failure_count > 0:
            self.failure_count -= 1
        logger.info(f"Circuit breaker success recorded. Count: {self.failure_count}")

    def reset(self):
        self.failure_count = 0
        self.is_quarantined = False
