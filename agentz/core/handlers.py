from abc import ABC, abstractmethod
from agentz.core.modes import ExecutionContext

class BaseWorkflowHandler(ABC):
    """Abstract base class for all workflow handlers."""

    @abstractmethod
    def run(self, ctx: ExecutionContext) -> str:
        """Execute the workflow step."""
        pass
