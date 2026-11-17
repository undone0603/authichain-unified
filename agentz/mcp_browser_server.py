"""AgentZ MCP tools for a locally authenticated, operator-owned MCP client.

Transport is stdio only. For remote use, deploy a separately authenticated
MCP gateway with TLS, per-client identity and private network connectivity.
Never expose stdio subprocess or FastAPI admin tokens publicly.
"""
from mcp.server.fastmcp import FastMCP

from agentz.core.browser_executor import execute_browser_task
from agentz.core.public_navigation import navigate_public
from agentz.core.code_proposals import propose_code_change

mcp = FastMCP("AgentZ Browser Executor")


@mcp.tool()
def browser_inspect(task: str) -> dict:
    """Inspect a predefined GitHub page with private evidence capture."""
    return execute_browser_task(task)


@mcp.tool()
def browser_navigate(url: str) -> dict:
    """Read a public HTTPS URL using the isolated browser host."""
    return navigate_public(url)


@mcp.tool()
def code_proposal(branch_ref: str, path: str, content: str,
                  expected_blob_sha: str | None = None) -> dict:
    """Create or update a file on a scoped AgentZ development branch."""
    return propose_code_change(branch_ref, path, content,
                               expected_blob_sha=expected_blob_sha)


@mcp.tool()
def readiness() -> dict:
    """Report prerequisites without revealing credentials or secret values."""
    import os
    from pathlib import Path
    browser = os.environ.get("AGENTZ_BROWSER_BIN", "")
    evidence = os.environ.get("AGENTZ_BROWSER_EVIDENCE_DIR", "")
    checks = {
        "browser_binary": bool(browser and Path(browser).is_file()),
        "evidence_directory": bool(evidence and Path(evidence).is_absolute() and Path(evidence).is_dir()),
        "network_isolation_declared": os.environ.get("AGENTZ_BROWSER_NETWORK_ISOLATED") == "true",
        "github_code_token_present": bool(os.environ.get("AGENTZ_GITHUB_CODE_TOKEN")),
    }
    return {"checks": checks, "ready_for_read_only_inspection":
            checks["browser_binary"] and checks["evidence_directory"],
            "ready_for_public_navigation":
            checks["browser_binary"] and checks["network_isolation_declared"],
            "production_dispatch_available": False,
            "remote_mcp_gateway_configured": False}


if __name__ == "__main__":
    mcp.run(transport="stdio")
