"""AgentZ capability policy: autonomy for reversible work, explicit gates for impact.

This module does not execute tasks or grant credentials. Callers must enforce the
returned decision at the actual execution boundary.
"""
from dataclasses import dataclass
from enum import Enum


class Capability(str, Enum):
    RESEARCH = "research"
    BROWSER_READ = "browser_read"
    MEMORY_WRITE = "memory_write"
    EXPERIMENT = "experiment"
    TEST_ISOLATED = "test_isolated"
    CODE_BRANCH = "code_branch"
    PR_CREATE = "pr_create"
    EXTERNAL_MESSAGE = "external_message"
    MERGE = "merge"
    DEPLOY = "deploy"
    PAYMENT = "payment"
    CREDENTIALS = "credentials"
    POLICY_CHANGE = "policy_change"


AUTONOMOUS = frozenset({
    Capability.RESEARCH, Capability.BROWSER_READ, Capability.MEMORY_WRITE,
    Capability.EXPERIMENT, Capability.TEST_ISOLATED, Capability.CODE_BRANCH,
    Capability.PR_CREATE,
})
GOVERNED = frozenset(set(Capability) - AUTONOMOUS)


@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason: str
    requires_release_gate: bool = False


def decide(capability: Capability | str, *, isolated: bool = False,
           authorized: bool = False, release_gate_passed: bool = False) -> Decision:
    """Fail closed for unknown capabilities; never infer permission from task text."""
    try:
        action = Capability(capability)
    except ValueError:
        return Decision(False, "unknown capability")
    if action in AUTONOMOUS:
        if action in (Capability.EXPERIMENT, Capability.TEST_ISOLATED) and not isolated:
            return Decision(False, "isolated executor required")
        return Decision(True, "autonomous reversible capability")
    if action in (Capability.MERGE, Capability.DEPLOY):
        if not authorized or not release_gate_passed:
            return Decision(False, "authorization and verified release gate required", True)
        return Decision(True, "authorized with verified release gate", True)
    if not authorized:
        return Decision(False, "explicit scoped authorization required")
    return Decision(True, "explicitly authorized governed capability")
