"""List GitHub repository secret names for a given repo.

Usage:
  python -m agentz.tools.list_github_secrets <owner>/<repo>

Note: GitHub does not expose secret values via the API; this will only list
secret names and provide guidance for manual retrieval or rotation.
"""
from __future__ import annotations

import sys
import os
import httpx
from agentz.core.credentials import get


def list_secrets(token: str, owner_repo: str) -> list[str]:
    url = f"https://api.github.com/repos/{owner_repo}/actions/secrets"
    headers = {"Authorization": f"token {token}", "Accept": "application/vnd.github+json"}
    r = httpx.get(url, headers=headers, timeout=15.0)
    r.raise_for_status()
    data = r.json()
    return [s["name"] for s in data.get("secrets", [])]


def main(argv) -> int:
    if len(argv) < 2:
        print("Usage: python -m agentz.tools.list_github_secrets <owner>/<repo>")
        return 2
    owner_repo = argv[1]

    try:
        token = get("github_pat_undone", required=False) or os.environ.get("GITHUB_TOKEN")
    except Exception:
        token = None

    if not token:
        print("GitHub PAT not set (GITHUB_PAT_UNDONE or GITHUB_TOKEN). Set it and rerun.")
        return 3

    names = list_secrets(token, owner_repo)
    if not names:
        print(f"No secrets found for {owner_repo} or insufficient permissions.")
        return 1

    print(f"Secrets in {owner_repo}:")
    for n in names:
        print(f"  - {n}")
    print("\nNote: GitHub API does not return secret values. To retrieve them, use the GitHub UI or rotate them into your .env.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
