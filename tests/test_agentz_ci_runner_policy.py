"""Protect against running unreviewed AgentZ PR code on privileged runners.

Parse the workflow file rather than relying on a comment or job name.
"""
from pathlib import Path

import yaml


WORKFLOW = Path(__file__).resolve().parents[1] / ".github/workflows/agentz-ci.yml"


def test_scoped_tinyfish_job_uses_only_github_hosted_runner():
    jobs = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))["jobs"]
    job = jobs["tinyfish-offline"]
    assert job["runs-on"] == "ubuntu-24.04"
    assert job["steps"][0]["with"]["persist-credentials"] is False
    assert "secrets." not in str(job)
    assert "TINYFISH_API_KEY" in str(job)
    assert "AGENTZ_TINYFISH_SCOUT_ENABLED" in str(job)


def test_verify_and_heal_protects_self_hosted_runner_from_prs():
    jobs = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))["jobs"]
    assert jobs["verify-and-heal"]["steps"][0]["with"]["persist-credentials"] is False
    selector = jobs["verify-and-heal"]["runs-on"]
    assert selector.startswith("${{")
    assert selector.endswith("}}")
    assert "github.event_name == 'push'" in selector
    assert "github.ref == 'refs/heads/main'" in selector
    assert "vars.AUTHICHAIN_CI_SELF_HOSTED == 'true'" in selector
    assert selector.index("github.event_name == 'push'") < selector.index(
        'fromJSON('
    )
    assert "'ubuntu-24.04'" in selector
    assert '"authichain-ops"' in selector


def test_agentz_ci_provisions_python_and_runs_pytest_with_declared_deps():
    """#2156 intent: setup-python, requirements-agentz.txt, pytest not unittest."""
    text = WORKFLOW.read_text(encoding="utf-8")
    jobs = yaml.safe_load(text)["jobs"]
    assert "unittest discover" not in text
    for name in ("tinyfish-offline", "verify-and-heal"):
        steps = jobs[name]["steps"]
        python = next(s for s in steps if str(s.get("uses", "")).startswith("actions/setup-python"))
        assert python["uses"] == "actions/setup-python@v7"
        assert str(python["with"]["python-version"]) == "3.12"
        blob = yaml.dump(jobs[name])
        assert "requirements-agentz.txt" in blob
        assert "-m pytest" in blob
        assert "tests/test_agentz_" in blob
