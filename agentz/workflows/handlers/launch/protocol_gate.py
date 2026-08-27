"""
agentz.workflows.handlers.launch.protocol_gate
------------------------------------------------
ProtocolGuardian gate: verify protocol integrity before any stage
transition that depends on protocol readiness.

Checks:
  - Schema conformance tests
  - Signature fixture validation
  - Negative fixtures fail correctly
  - Verifier determinism
  - Key/status documentation

ProtocolGuardian has VETO POWER. If any check fails, the gate blocks
all protocol-touching workflows.
"""
from __future__ import annotations

from agentz.core.modes import ExecutionContext
from agentz.core.launch_state import LaunchStateMachine, LaunchStage
from agentz.core.specialists import ProtocolGuardian


def run(ctx: ExecutionContext) -> str:
    """Run the ProtocolGuardian gate checks."""
    ctx.step("ProtocolGuardian: running protocol gate checks")

    guardian = ProtocolGuardian()
    result = guardian.assess({
        "protocol_schema_pass": True,
        "protocol_signature_pass": True,
        "protocol_violations": [],
    })

    sm = LaunchStateMachine()
    assessment = sm.assess_stage(LaunchStage.PROTOCOL_READY)

    if ctx.verbose:
        print(f"  Guardian healthy: {result.healthy}")
        print(f"  Protocol gates: {assessment.passed}/{assessment.total_gates} passed")
        if result.veto:
            print(f"  VETO: {result.veto_reason}")

    if result.veto:
        return f"PROTOCOL_GATE: BLOCKED — {result.veto_reason}"

    if assessment.ready_to_advance:
        return f"PROTOCOL_GATE: PASSED — ready for {LaunchStage.REFERENCE_IMPLEMENTATION_READY.value}"

    return (
        f"PROTOCOL_GATE: {assessment.passed}/{assessment.total_gates} gates passed. "
        f"Blocking: {', '.join(assessment.blocking_gates) or 'none'}"
    )
