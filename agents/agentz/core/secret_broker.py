"""
agentz.core.secret_broker
-------------------------
Scoped credential resolver. A handler asks for the keys it needs;
the broker hands them back in a dict and logs (names only) what it
provided. If the handler accidentally tries to print the broker
itself, it gets masked output instead of the raw secrets.

Usage:
    from agentz.core.secret_broker import SecretBroker

    secrets = SecretBroker.for_workflow("hubspot_drip_unstick", [
        "hubspot_token",
        "supabase_url",
        "supabase_anon",
    ])
    token = secrets["hubspot_token"]              # real value
    print(secrets)                                # masked repr
    secrets.audit()                               # ["hubspot_token", "supabase_url", "supabase_anon"]
"""
from __future__ import annotations

from typing import Iterable

from agentz.core.credentials import get


class SecretBroker:
    """A locked-down dict of credentials. __repr__ never leaks values."""

    __slots__ = ("_workflow", "_data")

    def __init__(self, workflow: str, data: dict[str, str]):
        # Use object.__setattr__ since __slots__ is set
        object.__setattr__(self, "_workflow", workflow)
        object.__setattr__(self, "_data", data)

    @classmethod
    def for_workflow(
        cls, workflow_id: str, keys: Iterable[str], required: bool = True
    ) -> "SecretBroker":
        """Resolve all keys at once. Raises early if any required key is missing."""
        data: dict[str, str] = {}
        missing: list[str] = []
        for key in keys:
            try:
                value = get(key, required=required)
            except RuntimeError:
                missing.append(key)
                continue
            if value is None:
                missing.append(key)
            else:
                data[key] = value
        if missing and required:
            raise RuntimeError(
                f"Workflow {workflow_id!r} cannot start — missing credentials: {missing}"
            )
        return cls(workflow_id, data)

    def __getitem__(self, key: str) -> str:
        if key not in self._data:
            raise KeyError(
                f"Workflow {self._workflow!r} did not request credential {key!r} "
                f"at broker construction. Add it to the for_workflow() keys list."
            )
        return self._data[key]

    def get(self, key: str, default=None):
        return self._data.get(key, default)

    def has(self, key: str) -> bool:
        return key in self._data

    def audit(self) -> list[str]:
        """Return the list of credential keys this broker holds. Names only."""
        return sorted(self._data.keys())

    def __repr__(self) -> str:
        return (
            f"<SecretBroker workflow={self._workflow!r} "
            f"keys={self.audit()} (values masked)>"
        )

    def __str__(self) -> str:
        return repr(self)

    # Block accidental iteration that might dump values
    def __iter__(self):
        return iter(self._data.keys())
