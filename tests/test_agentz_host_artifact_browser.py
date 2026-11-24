"""Policy tests: ARM64 image installs Playwright Chromium and smokes it locked down."""
from __future__ import annotations

from pathlib import Path

import yaml

DOCKERFILE = Path("workers/authichain-agentz/Dockerfile")
WORKFLOW = Path(".github/workflows/agentz-protected-host-artifact.yml")
SIDECAR = Path("workers/authichain-agentz/BROWSER_RUNTIME.md")


def test_dockerfile_installs_playwright_chromium_only_as_non_root():
    text = DOCKERFILE.read_text(encoding="utf-8")
    assert "FROM python:3.12-slim AS wheels" in text
    assert "COPY requirements-agentz.txt" in text
    assert "playwright install-deps chromium" in text
    assert "playwright install chromium" in text
    assert "firefox" in text  # removal guard, not an install
    assert "playwright install firefox" not in text
    assert "playwright install webkit" not in text
    assert "playwright install" in text and "chromium" in text
    assert "USER agentz" in text
    assert "ARG AGENTZ_UID=10001" in text
    assert "chgrp -R 0" in text
    assert "chmod -R g=u" in text
    assert "chmod -R o-w" in text
    assert "777" not in text
    assert "XDG_CONFIG_HOME=/app/.xdg/config" in text
    assert "BROWSER_USE_CONFIG_DIR=/app/.xdg/config/browseruse" in text
    assert 'CMD ["uvicorn", "agentz.api.main:app", "--host", "0.0.0.0", "--port", "8000"]' in text
    assert "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1" in text
    assert SIDECAR.is_file()
    sidecar = SIDECAR.read_text(encoding="utf-8")
    assert "--cap-drop ALL" in sidecar
    assert "no-new-privileges" in sidecar
    assert "--group-add 0" in sidecar
    assert "--disable-dev-shm-usage" in sidecar
    assert "--shm-size=1g" in sidecar
    assert "user-namespace" in sidecar or "userns" in sidecar
    assert "IN_DOCKER=1" in sidecar
    assert "always" in sidecar.lower() and "--no-sandbox" in sidecar
    assert "XDG_CONFIG_HOME" in sidecar
    assert "BROWSER_USE_CONFIG_DIR" in sidecar


def test_host_artifact_workflow_smokes_chromium_on_self_hosted_arm64():
    """This job is self-hosted ARM64 (laptop). Do not copy it onto hosted runners."""
    text = WORKFLOW.read_text(encoding="utf-8")
    data = yaml.safe_load(text)
    job = data["jobs"]["build"]
    assert job["runs-on"] == ["self-hosted", "Linux", "ARM64", "authichain-deploy"]
    assert "self-hosted" in text
    assert "linux/arm64" in text
    assert "python -m agentz.core.chromium_runtime --smoke" in text
    assert "--cap-drop ALL" in text
    assert "no-new-privileges" in text
    assert "--group-add 0" in text
    assert "sandbox_mode" in text
    assert "image_bytes" in text
    assert "archive_bytes" in text
    assert "self-hosted ARM64" in text or "self-hosted ARM64 laptop" in text
    # Sparse build context must still include AgentZ + the pinned requirements.
    assert "git archive" in text
    assert "requirements-agentz.txt" in text
    assert "workers/authichain-agentz/Dockerfile" in text
    # Not a deploy workflow.
    assert "wrangler deploy" not in text
    assert "deploy-workers" not in text
