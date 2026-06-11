"""
agentz.core.resolvers
--------------------
Dynamic credential resolvers that fetch secrets from external APIs.
"""
from __future__ import annotations

import os
from typing import Any, Callable, Dict, Optional

import httpx

class VercelResolver:
    """
    Fetches environment variables from Vercel's API for a specific project.
    Caches results to avoid excessive API calls.
    """
    def __init__(self, project_id: str, team_id: Optional[str] = None):
        self.project_id = project_id
        self.team_id = team_id
        self._cache: Dict[str, str] = {}
        self._loaded = False

    def _load(self) -> None:
        if self._loaded:
            return

        token = os.environ.get("VERCEL_TOKEN")
        if not token:
            # We don't raise here so dry-runs can still initialize the resolver
            return

        url = f"https://api.vercel.com/v9/projects/{self.project_id}/env"
        params = {"decrypt": "true", "limit": "100"}
        if self.team_id:
            params["teamId"] = self.team_id

        headers = {"Authorization": f"Bearer {token}"}
        
        try:
            # Using a synchronous client for simplicity in the core creds loader
            with httpx.Client() as client:
                r = client.get(url, headers=headers, params=params, timeout=10.0)
                r.raise_for_status()
                data = r.json()
                for env in data.get("envs", []):
                    key = env.get("key")
                    val = env.get("value", "")
                    if key:
                        self._cache[key] = val
            self._loaded = True
        except Exception as e:
            # Log error but don't crash; the get() will handle missing values
            print(f"  [Resolver] Warning: Failed to fetch Vercel env for {self.project_id}: {e}")

    def __call__(self, env_key: str) -> Callable[[], Optional[str]]:
        """Returns a callable that resolves a specific env key."""
        def resolve() -> Optional[str]:
            self._load()
            return self._cache.get(env_key)
        return resolve

def vercel_project(project_id: str, team_id: Optional[str] = None) -> VercelResolver:
    """Helper to create a VercelResolver instance."""
    return VercelResolver(project_id, team_id)
