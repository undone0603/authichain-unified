"""Python execution paths use the same AgentZ auto policy as the resolver."""

from agentz.core.auto_policy import consult_agentz_policy
from agentz.core.modes import Mode
from agentz.core.runner import Workflow, execute


def test_auto_is_frozen_and_confirm_is_allowed():
    auto = consult_agentz_policy("auto")
    confirm = consult_agentz_policy("confirm")
    assert auto["allowed"] is False
    assert "frozen" in auto["reason"]
    assert confirm["allowed"] is True


def test_runner_blocks_auto_before_the_handler():
    wf = Workflow(
        id="si-split-brain",
        title="must not run",
        priority="low",
        blocks_revenue=False,
        handler="this-handler-does-not-exist",
        type="task",
        estimated_minutes=1,
    )
    result = execute(wf, Mode.AUTO, verbose=False)
    assert result.status == "blocked"
    assert "frozen" in result.notes
